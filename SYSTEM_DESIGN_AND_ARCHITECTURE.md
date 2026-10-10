# CineScope — System Design, Architecture & Full Project Flow

Welcome to the comprehensive system design and architectural documentation for **CineScope**. This document provides an exhaustive breakdown of the application architecture, system design principles, data models, security controls, and step-by-step execution flows for every major system interaction.

---

## 1. System Architecture Overview

CineScope is built following a decoupled, layered **Client-Server Architecture** with a server-side proxy layer for third-party API integration (TMDB) and a MongoDB data layer equipped with compound indexing for concurrency control.

```mermaid
graph TD
    User([User Browser]) <-->|React 19 SPA / Vite| FE[Frontend App]
    FE <-->|Axios + Bearer Token| API[Express API Server]
    
    subgraph Express Backend Layer
        API -->|Express Validator & Rate Limiter| AuthMiddleware[Auth & Security Middleware]
        AuthMiddleware --> AuthCtrl[Auth Controller / Router]
        AuthMiddleware --> WatchlistCtrl[Watchlist Controller / Router]
        AuthMiddleware --> MovieCtrl[TMDB Proxy & Cache Controller]
        
        MovieCtrl <-->|Node-Cache In-Memory TTL 7m| Cache[(Node-Cache Store)]
        MovieCtrl <-->|Axios + Exponential Backoff| TMDB[TMDB External API]
    end

    subgraph Database Layer
        AuthCtrl <-->|Mongoose 8| MongoDB[(MongoDB - Local)]
        WatchlistCtrl <-->|Compound Index {userId, tmdbId}| MongoDB
    end
```

---

## 2. Tech Stack & Infrastructure

| Tier | Component | Technology | Primary Function |
|---|---|---|---|
| **Frontend** | Single Page Application | React 19 + Vite 6 | Dynamic UI, client routing, state management |
| **Styling** | UI Framework & CSS | Vanilla CSS + Tailwind CSS v4 | Dark-mode theme, glassmorphism, responsive grids |
| **HTTP Client** | API Interceptor | Axios | Request/Response interceptors, token auto-attach, 401 handling |
| **Backend** | REST API Server | Node.js + Express 4 | Business logic, middleware pipeline, proxy endpoints |
| **Database** | Persistence Layer | MongoDB + Mongoose 8 | User credentials, watchlist collection with compound index |
| **Caching** | In-Memory Cache | Node-Cache | Server-side response caching (7 min TTL) with hit/miss analytics |
| **Auth & Security** | Cryptography & Guard | JSON Web Tokens (JWT) + BcryptJS | Short-lived tokens (1h), password hashing (cost factor 10) |
| **External API** | Movie Provider | TMDB (The Movie Database) | Movie discovery, details, credits, videos, posters |

---

## 3. Step-by-Step System Flow Breakdown

### Flow 1: User Registration
```
[Client Input] -> [Password Strength Meter] -> [POST /api/auth/register] -> [Express Validator] -> [Bcrypt Hash] -> [Mongo Save] -> [JWT Sign] -> [201 Response]
```
1. **User Action**: The user enters their `name`, `email`, and `password` on `/register`.
2. **Real-time UX**: As the user types, a client-side `getPasswordStrength()` algorithm evaluates length, uppercase/lowercase, and special characters, rendering a color-coded strength bar (Weak / Fair / Good / Strong).
3. **Form Submission**: Form submits to `POST http://localhost:5000/api/auth/register`.
4. **Backend Validation**: `express-validator` validates:
   - `name`: Must not be empty.
   - `email`: Must be valid email format (`isEmail()`) and normalized.
   - `password`: Must be at least 6 characters.
5. **Duplicate Check**: Query `User.findOne({ email })`. If user exists, returns `409 Conflict`.
6. **Password Hashing**: `bcrypt.hash(password, 10)` generates a salt and hashes the password asynchronously.
7. **Database Save**: A new `User` document is created and persisted to MongoDB.
8. **Token Generation**: `jwt.sign({ id: savedUser._id }, process.env.JWT_SECRET, { expiresIn: '1h' })` generates a short-lived token expiring in 1 hour.
9. **Response**: HTTP `201 Created` returns `{ token, user: { id, name, email } }`.
10. **Client Context**: Frontend saves token to `localStorage`, sets `AuthContext` state, triggers toast notification, and redirects to `/`.

---

### Flow 2: User Login & Session Guarding
```
[POST /api/auth/login] -> [Rate Limiter Check] -> [Express Validator] -> [User Lookup] -> [Bcrypt Compare] -> [JWT Sign] -> [200 Response]
```
1. **Rate Limiting**: Request hits `loginLimiter` (`express-rate-limit`). Allows maximum 10 attempts per 15-minute window per IP to prevent brute-force attacks.
2. **Credentials Lookup**: Database queries `User.findOne({ email })`. If user is missing, returns `401 Invalid credentials` (generic message prevents account enumeration).
3. **Password Comparison**: `bcrypt.compare(password, user.password)` checks hash match. If mismatch, returns `401 Invalid credentials`.
4. **Token Issuance**: Returns JWT expiring in 1 hour.
5. **Axios Response Interceptor**: `frontend/src/utils/api.js` catches all 401s globally. If a protected API route returns 401 (e.g. expired token), it clears `localStorage` and redirects to `/login`. Auth endpoints (`/auth/login`, `/auth/register`) are explicitly bypassed by the interceptor so inline form validation messages can display without page reloads.

---

### Flow 3: TMDB Movie Browsing, Live Search & Caching
```
[User Typing] -> [300ms Debounce] -> [AbortController Cancel Stale] -> [GET /api/movies/search?query=...] -> [TMDB API] -> [Response]
```
1. **Live Search Debounce**: Typing in the search input triggers `handleSearchChange` with a 300ms debounce timer.
2. **Request Cancellation**: If a user types quickly (e.g., "Inception"), any in-flight request is immediately aborted via `AbortController.abort()` to prevent race conditions or out-of-order responses.
3. **URL Encoding**: Query parameters are passed via Axios `params: { query }` object, ensuring symbols like `#` and `&` are automatically URL-encoded (`encodeURIComponent`).
4. **Server-side Caching (Popular & Movie Details)**:
   - Request to `/api/movies/popular` checks `node-cache`.
   - **Cache Hit**: Returns cached JSON payload immediately (< 5ms response time). Logged with hit/miss statistics.
   - **Cache Miss**: Calls TMDB API via proxy function `tmdbGet()`.
5. **Exponential Backoff Resilience**: `tmdbGet()` retries failed TMDB requests on `429` (rate limit) or `5xx` server errors up to 3 times with exponential backoff delays (500ms, 1000ms, 2000ms).
6. **Cache Set**: Stores successful response in Node-Cache with a 7-minute TTL (`stdTTL: 420`).

---

### Flow 4: Watchlist Management & Race-Condition Safety
```
[User Clicks "Add to Watchlist"] -> [POST /api/movies/watchlist] -> [Auth Middleware] -> [DB Compound Index Check] -> [Mongo Save / 409 Conflict]
```
1. **Authentication Guard**: `authMiddleware` reads `Authorization: Bearer <token>` header, verifies token via `jwt.verify`, and attaches `req.user` (user ID).
2. **Database Insertion**: Saves document containing `{ userId, tmdbId, title, poster, overview, rating, year }`.
3. **Compound Unique Index**: The MongoDB `Movie` collection is indexed with a compound unique key:
   $$\text{Index: } \{ \text{userId}: 1, \text{tmdbId}: 1 \}, \{ \text{unique}: \text{true} \}$$
4. **Concurrency & Race Condition Handling**: If two requests to add the same movie arrive simultaneously, MongoDB enforces the unique index at the engine level:
   - First request succeeds (`201 Created`).
   - Second request triggers MongoDB Error `11000 (E11000 duplicate key error)`.
   - Express error handler catches code `11000` and returns clean HTTP `409 Conflict`.
   - Frontend catches 409 gracefully, maintaining UI consistency without crashing or adding duplicates.

---

## 4. Database Schema & Indexing Strategy

### User Schema (`models/User.js`)
```javascript
const userSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});
```

### Movie Schema (`models/Movie.js`)
```javascript
const movieSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    tmdbId: { type: Number, required: true },
    title: { type: String, required: true },
    poster: { type: String },
    overview: { type: String },
    rating: { type: Number },
    year: { type: String },
    addedAt: { type: Date, default: Date.now }
});

// Compound unique index ensuring one watchlist entry per user per movie
movieSchema.index({ userId: 1, tmdbId: 1 }, { unique: true });
```

---

## 5. Security Architecture

1. **Short-Lived JWT Tokens**: Auth tokens expire after **1 hour** (`expiresIn: '1h'`). Prevents indefinite access if tokens are compromised.
2. **Password Cryptography**: Passwords are salted and hashed using `bcryptjs` with a work factor of 10.
3. **Rate Limiting**: `express-rate-limit` enforces 10 login attempts per 15 minutes per IP address.
4. **Input Validation & Sanitization**: `express-validator` validates and normalizes all incoming auth bodies.
5. **CORS Isolation**: Configured to restrict or handle cross-origin requests safely.
6. **API Key Encapsulation**: TMDB API key is kept strictly in server `.env` files and never exposed to the client bundle.

---

## 6. UI Aesthetic & Design System

The application features a cinematic dark aesthetic designed for movie enthusiasts:

- **Color Palette**: Deep space navy (`#080C14`), slate dark cards (`#111827`), ambient blue glow (`#3b82f6`).
- **Glassmorphism**: Backdrop blur overlays (`backdrop-blur-md`) with high contrast text.
- **Micro-Animations**: Custom CSS keyframes for fade-up, error shake, staggered list loading, and hover scales.
- **Aesthetic Assets**: Hero backdrop banners and visual poster grid walls generated for visual depth.

---

## 7. Testing & Quality Assurance

The codebase includes an automated Jest & Supertest integration suite (19 passing test cases) utilizing `mongodb-memory-server` for isolated database testing:

- **Auth Suite (`auth.test.js`)**: Tests user registration, password hashing, login, token expiration, rate limiting, and validation error messages.
- **Watchlist Suite (`watchlist.test.js`)**: Tests watchlist addition, deletion, retrieval, duplicate compound index constraint, and unauthenticated request rejection.
- **CI Pipeline (`.github/workflows/ci.yml`)**: Automatically executes tests on every push and pull request.

---

*Documentation compiled and maintained for CineScope.*
