const express = require('express');
const router = express.Router();
const axios = require('axios');
const NodeCache = require('node-cache');
const jwt = require('jsonwebtoken');
const Movie = require('../models/Movie');
const auth = require('../middleware/authMiddleware');
const { getVerdict, getVideos, getProviders } = require('../controllers/movieController');

const TMDB_BASE_URL = 'https://api.tmdb.org/3';
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

async function tmdbGet(url, params, maxAttempts = 3, timeoutMs = 8000) {
    let lastError;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
            return await axios.get(url, {
                params: { api_key: process.env.TMDB_API_KEY, ...params },
                timeout: timeoutMs
            });
        } catch (err) {
            lastError = err;
            const status = err.response?.status;
            if (status === 429 || (status >= 500 && status < 600)) {
                const delay = Math.pow(2, attempt) * 500;
                await new Promise(r => setTimeout(r, delay));
            } else {
                throw err;
            }
        }
    }
    throw lastError;
}

router.get('/search', async (req, res) => {
    const query = typeof req.query.query === 'string' ? req.query.query.trim() : '';
    if (!query) {
        return res.status(400).json({ message: 'Search query is required' });
    }

    try {
        const response = await tmdbGet(`${TMDB_BASE_URL}/search/movie`, { query });
        res.json(response.data);
    } catch (error) {
        console.error('TMDB search failed:', error.message);
        res.status(error.code === 'ECONNABORTED' ? 504 : 502).json({ error: 'Movie search is temporarily unavailable' });
    }
});

router.get('/popular', async (req, res) => {
    const cacheKey = 'popular';
    const cached = cache.get(cacheKey);
    if (cached) {
        cacheHits++;
        return res.json(cached);
    }
    cacheMisses++;

    try {
        const response = await tmdbGet(`${TMDB_BASE_URL}/movie/popular`, {});
        cache.set(cacheKey, response.data);
        res.json(response.data);
    } catch (error) {
        console.error('TMDB popular movies request failed:', error.message);
        res.status(error.code === 'ECONNABORTED' ? 504 : 502).json({ error: 'Popular movies are temporarily unavailable' });
    }
});

router.get('/details/:id', async (req, res) => {
    if (!/^\d+$/.test(req.params.id) || Number(req.params.id) < 1) {
        return res.status(400).json({ message: 'Movie ID must be a positive integer' });
    }

    const cacheKey = `details:${req.params.id}`;
    const cached = cache.get(cacheKey);
    if (cached) {
        cacheHits++;
        return res.json(cached);
    }
    cacheMisses++;

    try {
        const response = await tmdbGet(
            `${TMDB_BASE_URL}/movie/${req.params.id}`,
            { append_to_response: 'credits,videos' }
        );
        cache.set(cacheKey, response.data);
        res.json(response.data);
    } catch (error) {
        console.error('TMDB movie details request failed:', error.message);
        res.status(error.code === 'ECONNABORTED' ? 504 : 502).json({ error: 'Movie details are temporarily unavailable' });
    }
});

router.get('/watchlist', auth, async (req, res) => {
    try {
        const movies = await Movie.find({ userId: req.user });
        res.json(movies);
    } catch (error) {
        console.error('Watchlist read failed:', error);
        res.status(500).json({ error: 'Unable to load watchlist' });
    }
});

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
        if (error.code === 11000) {
            return res.status(409).json({ message: 'Movie already in watchlist' });
        }
        if (error.name === 'ValidationError' || error.name === 'CastError') {
            return res.status(400).json({ message: 'Movie data is invalid' });
        }
        console.error('Watchlist add failed:', error);
        res.status(500).json({ error: 'Unable to add movie to watchlist' });
    }
});

router.delete('/watchlist/:id', auth, async (req, res) => {
    if (!/^\d+$/.test(req.params.id) || Number(req.params.id) < 1) {
        return res.status(400).json({ message: 'Movie ID must be a positive integer' });
    }

    try {
        await Movie.findOneAndDelete({ userId: req.user, tmdbId: req.params.id });
        res.json({ message: 'Removed from watchlist' });
    } catch (error) {
        console.error('Watchlist removal failed:', error);
        res.status(500).json({ error: 'Unable to remove movie from watchlist' });
    }
});

router.get('/cache-stats', (req, res) => {
    res.json(getCacheStats());
});

router.get('/:id/verdict', (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (token) {
        try {
            const payload = jwt.verify(token, process.env.JWT_SECRET);
            req.user = payload.id;
        } catch {}
    }
    next();
}, getVerdict);

router.get('/:id/videos', getVideos);
router.get('/:id/providers', getProviders);

module.exports = router;
