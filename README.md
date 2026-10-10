# CineScope 🎬

A full-stack MERN watchlist app — search TMDB movies, curate a personal vault, browse details, and experience cinematic UI vibes.

> 📖 **[Read the Full System Design & Architecture Document](file:///d:/SEM-6/MERN-PEP/Project4/SYSTEM_DESIGN_AND_ARCHITECTURE.md)** for a complete step-by-step breakdown of execution flows, component architecture, database compound indexing, security controls, and proxy caching mechanics.

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 19, Vite, Tailwind CSS v4, Glassmorphism, Micro-animations |
| Backend | Node.js, Express 4, Mongoose 8 |
| Database | MongoDB (local) with Compound Unique Indexing |
| Auth | JWT (bcryptjs + jsonwebtoken) with 1h Expiration & Interceptors |
| TMDB | Server-side proxy with Node-Cache (7m TTL) & Exponential Backoff Retries |
| Tests | Jest + Supertest + mongodb-memory-server (19/19 Passing) |
| CI | GitHub Actions |

---

## Version A — Original (what was built)

- Full-stack MERN watchlist with React 19, Vite and Tailwind.  
  Auth state lives in Context API; protected routes redirect signed-out users.
- JWT authentication: passwords hashed with bcrypt, Express middleware verifies every Bearer token,  
  all watchlist queries are scoped to the signed-in user's ID.
- Express proxy over the TMDB API (search, popular, details) that keeps the API key server-side,  
  plus watchlist add / remove / list endpoints with per-user duplicate checks.
- `User` and `Movie` Mongoose models; unique email constraint; TMDB fields stored on each watchlist  
  item so the list loads without extra API calls.

---

## Version B — Hardened & Measured (this branch)

### Auth hardening

| What | How |
|---|---|
| Short-lived tokens | `jwt.sign(..., { expiresIn: '1h' })` in both register and login |
| Consistent 401 on bad tokens | `authMiddleware.js` inner try/catch around `jwt.verify` — expired and malformed tokens now return **401**, not 500 |
| Auto logout on 401 | `src/utils/api.js` — shared axios instance with a response interceptor that clears localStorage and redirects to `/login` |
| Route guard token check | `AuthContext.jsx` reads the JWT `exp` claim with `atob` on startup; stale tokens are cleared before any API call |
| Login rate limiting | `express-rate-limit` — 10 requests / 15 min per IP on `POST /api/auth/login` |
| Input validation | `express-validator` — name, email format, password length ≥ 6 chars on register; email + password on login |

### Database indexing — proof

Compound unique index on `{ userId: 1, tmdbId: 1 }` added in `models/Movie.js`.

**Benchmark** — `node seed.js --clean` then `node benchmark.js` on 3 000 seeded documents:

| | WITH index | WITHOUT index |
|---|---|---|
| Winning plan stage | `FETCH` (IXSCAN) | `COLLSCAN` |
| Docs examined | **1** | **3 000** |
| Keys examined | 1 | 0 |
| Execution time | 6 ms | 4 ms |

> The index reduces examined documents from 3 000 → 1 (3 000× fewer reads).  
> The duplicate-insert race is now fixed at the DB level: `E11000` is caught and returned as **409 Conflict**.

### TMDB resilience

| What | How |
|---|---|
| Server-side cache | `node-cache`, TTL = 7 min, on `/popular` and `/details/:id` |
| Cache hit/miss logging | Every request logs `[CACHE HIT]` or `[CACHE MISS]` plus running stats |
| Request timeout | 8 s `axios` timeout in `tmdbGet()` |
| Retry with backoff | Up to 3 retries, exponential backoff (500 ms → 1 s → 2 s) on TMDB 429 or 5xx |
| Debounced search | 300 ms debounce in `Home.jsx` — no request fired until the user pauses |
| Cancellable requests | `AbortController` cancels in-flight search requests when a new keystroke arrives |
| URL encoding | Query passed via axios `params` object — axios calls `encodeURIComponent` automatically |
| Cache stats endpoint | `GET /api/movies/cache-stats` returns hits, misses, hit rate |

### Tests — 19 / 19 passing ✅

```
Test Suites: 2 passed, 2 total
Tests:       19 passed, 19 total
Time:        ~60 s (first run downloads mongodb-memory-server binary)
```

Test files:
- `backend/__tests__/auth.test.js` — register, login, validation, duplicate, JWT expiry claim
- `backend/__tests__/watchlist.test.js` — auth middleware (no token / bad token / expired), add, duplicate → 409, per-user isolation, remove

Run with:
```bash
cd backend
npm test
```

CI runs automatically on every push via `.github/workflows/ci.yml`.

---

## Quick Start

```bash
# 1. Backend
cd backend
cp .env.example .env   # fill in MONGODB_URI, JWT_SECRET, TMDB_API_KEY
npm install
npm run dev            # http://localhost:5000

# 2. Frontend
cd frontend
npm install
npm run dev            # http://localhost:5173
```

## Scripts

```bash
# Backend
npm run dev        # nodemon
npm test           # Jest + Supertest
node seed.js --clean   # seed 3 000 docs
node benchmark.js      # compare explain() with/without index

# Frontend
npm run dev        # Vite dev server
npm run build      # production bundle
```
