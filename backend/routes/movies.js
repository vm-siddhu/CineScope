const express = require('express');
const router = express.Router();
const axios = require('axios');
const NodeCache = require('node-cache');
const Movie = require('../models/Movie');
const auth = require('../middleware/authMiddleware');

const TMDB_BASE_URL = 'https://api.tmdb.org/3';

// ─── Server-side cache (TTL = 7 minutes) ────────────────────────────────────
// Caches /popular and /details/:id responses so repeated requests don't hit
// the TMDB API every time. Hits/misses are logged so we can report hit rate.
const cache = new NodeCache({ stdTTL: 7 * 60, checkperiod: 60 });
let cacheHits = 0;
let cacheMisses = 0;

function getCacheStats() {
    const total = cacheHits + cacheMisses;
    return {
        hits: cacheHits,
        misses: cacheMisses,
        hitRate: total === 0 ? '0%' : `${((cacheHits / total) * 100).toFixed(1)}%`
    };
}

// ─── Retry helper with exponential backoff ──────────────────────────────────
// Retries on TMDB 429 (rate-limit) or 5xx errors up to maxRetries times.
async function tmdbGet(url, params, maxRetries = 3, timeoutMs = 8000) {
    let lastError;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const response = await axios.get(url, {
                params: { api_key: process.env.TMDB_API_KEY, ...params },
                timeout: timeoutMs
            });
            return response;
        } catch (err) {
            lastError = err;
            const status = err.response?.status;
            // Retry only on rate-limit or server errors
            if (status === 429 || (status >= 500 && status < 600)) {
                const delay = Math.pow(2, attempt) * 500; // 500ms, 1s, 2s …
                console.warn(`TMDB ${status} on attempt ${attempt + 1}. Retrying in ${delay}ms…`);
                await new Promise(r => setTimeout(r, delay));
            } else {
                throw err; // Non-retryable error — propagate immediately
            }
        }
    }
    throw lastError;
}

// ─── Search Movies (TMDB) ────────────────────────────────────────────────────
router.get('/search', async (req, res) => {
    try {
        const { query } = req.query;
        // query is passed as a structured param — axios handles encoding safely.
        const response = await tmdbGet(`${TMDB_BASE_URL}/search/movie`, { query });
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ─── Popular Movies (TMDB) — Cached ─────────────────────────────────────────
router.get('/popular', async (req, res) => {
    const cacheKey = 'popular';
    const cached = cache.get(cacheKey);
    if (cached) {
        cacheHits++;
        console.log(`[CACHE HIT]  /popular  | stats: ${JSON.stringify(getCacheStats())}`);
        return res.json(cached);
    }
    cacheMisses++;
    console.log(`[CACHE MISS] /popular  | stats: ${JSON.stringify(getCacheStats())}`);

    try {
        const response = await tmdbGet(`${TMDB_BASE_URL}/movie/popular`, {});
        cache.set(cacheKey, response.data);
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ─── Movie Details (TMDB) — Cached ──────────────────────────────────────────
router.get('/details/:id', async (req, res) => {
    const cacheKey = `details:${req.params.id}`;
    const cached = cache.get(cacheKey);
    if (cached) {
        cacheHits++;
        console.log(`[CACHE HIT]  /details/${req.params.id} | stats: ${JSON.stringify(getCacheStats())}`);
        return res.json(cached);
    }
    cacheMisses++;
    console.log(`[CACHE MISS] /details/${req.params.id} | stats: ${JSON.stringify(getCacheStats())}`);

    try {
        const response = await tmdbGet(
            `${TMDB_BASE_URL}/movie/${req.params.id}`,
            { append_to_response: 'credits,videos' }
        );
        cache.set(cacheKey, response.data);
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ─── Watchlist — Get All ─────────────────────────────────────────────────────
router.get('/watchlist', auth, async (req, res) => {
    try {
        const movies = await Movie.find({ userId: req.user });
        res.json(movies);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ─── Watchlist — Add ─────────────────────────────────────────────────────────
// The application-level duplicate check is kept as a fast path, but the DB
// compound unique index is the real safety net against race conditions.
router.post('/watchlist', auth, async (req, res) => {
    try {
        const { tmdbId, title, poster, overview, rating, year } = req.body;

        const newMovie = new Movie({
            userId: req.user,
            tmdbId, title, poster, overview, rating, year
        });

        await newMovie.save();
        res.status(201).json({ message: 'Added to watchlist' });
    } catch (error) {
        // MongoDB duplicate key error (E11000) → 409 Conflict
        if (error.code === 11000) {
            return res.status(409).json({ message: 'Movie already in watchlist' });
        }
        res.status(500).json({ error: error.message });
    }
});

// ─── Watchlist — Remove ──────────────────────────────────────────────────────
router.delete('/watchlist/:id', auth, async (req, res) => {
    try {
        await Movie.findOneAndDelete({ userId: req.user, tmdbId: req.params.id });
        res.json({ message: 'Removed from watchlist' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ─── Cache stats endpoint (optional, for monitoring) ────────────────────────
router.get('/cache-stats', (req, res) => {
    res.json(getCacheStats());
});

module.exports = router;
