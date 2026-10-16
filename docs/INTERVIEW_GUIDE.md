# CineScope interview guide

Use these as explanations of the current code, not as claims about who originally designed it. Be clear that this is a student portfolio application and describe limits honestly.

## Request walkthroughs

### Login

`Login.jsx` submits through the shared Axios client to `POST /api/auth/login`. The route validates and normalizes email, applies the login rate limit, finds the user, and compares the password with the bcrypt hash. It returns a generic `401` for either an unknown email or wrong password. On success it signs a one-hour JWT and returns `{ token, user }`. AuthContext stores them in local storage; the API interceptor later attaches the bearer token.

### Add a movie

The movie card calls the add handler in `Home.jsx`. The frontend posts TMDB movie fields to `/api/movies/watchlist`; Axios adds the bearer token. Auth middleware verifies its signature and supplies `req.user`. The route stores the movie with that ID. The MongoDB `{ userId, tmdbId }` unique index rejects a duplicate, including concurrent duplicates, and the route returns `409` for duplicate key error `11000`.

### Search

`Home.jsx` waits 300 ms after the last typed query, then calls `/api/movies/search`. It cancels the prior browser request when the query changes, and a request ID prevents stale results from replacing newer ones. The Express route calls TMDB with the API key on the server. Express returns the TMDB JSON response. A browser abort stops waiting for the response; it does not guarantee that the server's outbound TMDB request is cancelled.

## Questions and sample answers

1. **What does CineScope do?** It lets a user discover movies through TMDB, view details, and maintain a personal watchlist. The React/Vite frontend talks to an Express API, which stores users and watchlist entries in MongoDB.

2. **Why is there a backend if TMDB is public?** The backend keeps the TMDB API key out of browser code and provides one place for authentication and watchlist persistence.

3. **How are passwords stored?** Registration hashes them with bcryptjs at cost 10. Login compares the submitted password against the hash. The raw password is not stored or returned.

4. **What is in the JWT?** The server signs the user ID and applies a one-hour expiry. The client decodes `exp` only for a quick display guard; only the server verifies the signature.

5. **How are protected routes enforced?** Axios sends the bearer token; middleware verifies it and attaches the ID as `req.user`. The route then scopes every watchlist database operation to that ID.

6. **Why store a token in local storage?** It is straightforward for this learning app, but script running after an XSS flaw can read it. An alternative is secure HttpOnly cookies with CSRF protections.

7. **How does the unique compound index work?** `{ userId: 1, tmdbId: 1 }` makes each movie unique per user. Two users can save the same movie, while one user cannot add it twice. The database enforces this even if requests race.

8. **Why catch Mongo duplicate key errors?** A pre-check can race: two requests can both observe no existing entry. The index is authoritative; error code `11000` is mapped to a client-facing `409`.

9. **How does one user's delete avoid affecting another?** The delete filter contains both the authenticated `userId` and the TMDB movie ID. A different user's document does not match.

10. **Why proxy TMDB requests?** The key is attached in Express, not shipped to the browser. The same backend can also apply timeouts, retries, and caching.

11. **Which responses are cached?** Popular movie results and details by movie ID use a seven-minute `node-cache` TTL. Search is not cached. The cache is local to one Node process.

12. **How does retry work?** TMDB calls have an eight-second timeout. The helper makes up to three total attempts for 429 and 5xx responses, with 500 ms and 1,000 ms delays. Other statuses and timeouts are not retried.

13. **How does search debounce and cancellation work?** Nonempty search waits 300 ms. Query effect cleanup clears the timer and aborts its browser request; the request ID check prevents stale updates. Clearing the field fetches popular movies. The backend TMDB request may continue after the browser aborts.

14. **What HTTP statuses matter?** `201` means registration or watchlist insertion succeeded; `200` is used for reads/removal/login; `400` indicates invalid input; `401` indicates bad credentials or auth; `409` indicates an existing account/movie; `502`/`504` report upstream movie-service failures; `500` is an unexpected server-side failure or missing JWT configuration.

15. **What do the backend tests cover?** Jest and Supertest send HTTP requests through the Express app against `mongodb-memory-server`. The tests cover registration, validation, password/token behavior, login, auth rejection, watchlist add/list/remove, duplicate behavior, and user isolation. They are integration tests, not a full browser test suite.

16. **What does the CI workflow check?** GitHub Actions installs backend and frontend dependencies from lockfiles, runs backend Jest tests, and runs frontend lint and production build.

17. **What is the index benchmark evidence?** The script prints MongoDB explain stats with and without the compound index. No result is asserted in this guide because results depend on the database and workload. The script temporarily drops an index, so it belongs only on a disposable benchmark database.

18. **What would you improve before production?** Restrict CORS, use safer session/token storage, add registration rate limits and stronger input bounds, move cache/rate-limit state to shared infrastructure for multiple instances, and add browser-level tests and deployment monitoring.

## Difficult follow-ups

- **Does a JWT make the API stateful?** The current verification is stateless in that the server does not look up a session. The watchlist request still queries MongoDB, and there is no built-in token revocation before expiry.
- **Can the client trust `user` from local storage?** No. It is display state only. Authorization comes from the verified token ID on the backend.
- **Will `AbortController` stop TMDB work?** No. It cancels the frontend HTTP request. The Express-to-TMDB Axios call does not receive that browser signal.
- **Is three retries plus the first request four calls?** No. The loop has three attempts total, so there are at most two retries.
- **Is the cache shared between servers?** No. Each Node process has its own cache, which is lost on restart.
- **What does the benchmark prove?** It shows query-plan/execution counters for one selected query on the database you run it against. It is not a portable latency guarantee or proof of overall application performance.
- **What is not covered?** There are no frontend component/browser tests; TMDB retry and timeout paths are not currently integration tested; there is no deployment/demo URL in the repository.

## Honest resume claims

Source and test files verify that the project uses React/Vite, Express/Mongoose, bcrypt, JWT, a server-side TMDB key, a process-local cache, a unique compound index, request debounce/cancellation, Jest/Supertest, and GitHub Actions. The current tests verify the documented auth/watchlist cases. Benchmark numbers, production security, scalability, uptime, user counts, and real TMDB reliability require separate measurements and should not be claimed without that evidence.
