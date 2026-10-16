# Refactor changelog

## 2026-10-16

### Backend correctness and errors

- Kept the unique email index as the authority and map duplicate-key registration races to the existing `409 User already exists` response.
- Replaced raw internal exception messages in auth, middleware, watchlist, and TMDB error responses with safe messages while preserving the existing `{ error }` field shape. TMDB timeout errors now return `504`; other upstream errors return `502`.
- Added validation for empty search terms, invalid movie IDs, and invalid watchlist documents; added a safe configuration response when `JWT_SECRET` is missing. The server now opens its HTTP listener only after MongoDB connects.
- Added regression coverage for concurrent same-email registration, cross-user delete isolation, safe TMDB proxy failures, request validation, and missing JWT configuration. The TMDB test checks that the configured key is passed only to the backend Axios request and is absent from the response.

### Frontend search and auth initialization

- Search now aborts the active request and clears a pending debounce timer immediately when the input changes. The effect cleanup repeats cancellation on query change/unmount, and a request ID guards every result/loading update. Clearing search restores popular movies.
- AuthContext initializes persisted state synchronously, handles malformed JSON, and stores the context value separately to satisfy the configured Fast Refresh lint rule. This removes the initialization state update that failed lint.
- Updated page imports for the separated context and removed the stale Home effect dependency warning.

### Documentation and CI

- Replaced the README's machine-local links and unverified benchmark/performance claims with setup, API, environment, limitations, and safe benchmark instructions.
- Added `docs/ARCHITECTURE.md` and `docs/INTERVIEW_GUIDE.md` with code-grounded flows, trade-offs, and honest limitations. Replaced the prior architecture/interview documents with links to the maintained versions.
- Added backend/frontend `.env.example` files containing placeholders, and extended CI to run frontend lint and build in addition to backend tests.
- Updated `backend/benchmark.js` to wait for model index initialization and restore the index in a `finally` path after dropping it. The benchmark was not run because it mutates index state in its configured MongoDB database.

### Verification

- `cd backend && npm test` — final run passed: 3 suites, 26 tests. The suite still emits Jest's force-exit open-handles advisory.
- `cd frontend && npm run lint` — passed with no warnings or errors.
- `cd frontend && npm run build` — passed. Node emitted a `module.register()` deprecation warning from the runtime; Vite completed successfully.
- `git diff --check` — passed.

The final backend run emitted a `mongodb-memory-server` child-process shutdown warning; all suites completed successfully and Jest then force-exited as configured. Before changes, the backend baseline passed 19 tests; the frontend baseline build passed and lint failed with two errors and one warning.

No real benchmark measurements, production deployment checks, or browser-level tests were performed. The in-memory backend tests do not exercise live TMDB or a persistent application database.
