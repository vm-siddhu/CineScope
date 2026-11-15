const axios = require('axios');
const MovieVerdict = require('../models/MovieVerdict');
const User = require('../models/User');

const TMDB_BASE_URL = 'https://api.tmdb.org/3';
const inFlight = new Set();

const INDIAN_PLATFORM_SEARCH = [
    { key: 'netflix', url: 'https://www.netflix.com/search?q=' },
    { key: 'prime', url: 'https://www.primevideo.com/search/ref=atv_nb_sr?phrase=' },
    { key: 'amazon', url: 'https://www.primevideo.com/search/ref=atv_nb_sr?phrase=' },
    { key: 'hotstar', url: 'https://www.hotstar.com/in/explore?search_query=' },
    { key: 'disney', url: 'https://www.hotstar.com/in/explore?search_query=' },
    { key: 'jiocinema', url: 'https://www.jiocinema.com/search/' },
    { key: 'jio', url: 'https://www.jiocinema.com/search/' },
    { key: 'sonyliv', url: 'https://www.sonyliv.com/custompage/search?query=' },
    { key: 'sony', url: 'https://www.sonyliv.com/custompage/search?query=' },
    { key: 'zee5', url: 'https://www.zee5.com/search?q=' },
    { key: 'zee', url: 'https://www.zee5.com/search?q=' },
    { key: 'apple', url: 'https://tv.apple.com/in/search?term=' },
    { key: 'youtube', url: 'https://www.youtube.com/results?search_query=' },
    { key: 'google', url: 'https://play.google.com/store/search?c=movies&q=' },
    { key: 'aha', url: 'https://www.aha.video/search?q=' },
    { key: 'sun', url: 'https://www.sunnxt.com/search/' },
    { key: 'lionsgate', url: 'https://lionsgateplay.com/search?query=' },
    { key: 'mx', url: 'https://www.mxplayer.in/search?q=' }
];

function buildIndianOttUrl(providerName = '', movieTitle = '', justWatchLink = null) {
    const encoded = encodeURIComponent(movieTitle);
    const lower = String(providerName || '').toLowerCase();

    for (const p of INDIAN_PLATFORM_SEARCH) {
        if (lower.includes(p.key)) {
            return `${p.url}${encoded}`;
        }
    }

    return justWatchLink || `https://www.justwatch.com/in/search?q=${encoded}`;
}

function getQuickSearchLinks(movieTitle = '') {
    const encoded = encodeURIComponent(movieTitle);
    return [
        { name: 'Netflix', url: `https://www.netflix.com/search?q=${encoded}`, brand: 'netflix' },
        { name: 'Prime Video', url: `https://www.primevideo.com/search/ref=atv_nb_sr?phrase=${encoded}`, brand: 'prime' },
        { name: 'JioHotstar', url: `https://www.hotstar.com/in/explore?search_query=${encoded}`, brand: 'hotstar' },
        { name: 'JioCinema', url: `https://www.jiocinema.com/search/${encoded}`, brand: 'jiocinema' },
        { name: 'SonyLIV', url: `https://www.sonyliv.com/custompage/search?query=${encoded}`, brand: 'sonyliv' },
        { name: 'ZEE5', url: `https://www.zee5.com/search?q=${encoded}`, brand: 'zee5' },
        { name: 'YouTube', url: `https://www.youtube.com/results?search_query=${encoded}+full+movie`, brand: 'youtube' }
    ];
}

function tmdbParams(extra = {}) {
    return { api_key: process.env.TMDB_API_KEY, ...extra };
}

function isValidVerdict(obj) {
    if (!obj || typeof obj !== 'object') return false;

    const validBadges = ['Must Watch', 'Sleeper Hit', 'Mixed / Niche', 'Overhyped', 'Skip'];
    if (!validBadges.includes(obj.verdictBadge)) return false;

    if (typeof obj.organicSentimentScore !== 'number' || obj.organicSentimentScore < 0 || obj.organicSentimentScore > 100) {
        return false;
    }

    if (typeof obj.audienceVsCriticGap !== 'string') return false;
    if (!Array.isArray(obj.praisedFor) || !Array.isArray(obj.criticizedFor)) return false;

    return true;
}

async function recordVerdictCheck(userId, { tmdbId, title, verdictBadge }) {
    const user = await User.findById(userId);
    if (!user) return;

    user.recentVerdictChecks = user.recentVerdictChecks.filter(v => v.tmdbId !== tmdbId);
    user.recentVerdictChecks.unshift({
        tmdbId,
        title,
        verdictBadge,
        checkedAt: new Date()
    });
    user.recentVerdictChecks = user.recentVerdictChecks.slice(0, 10);

    await user.save();
}

async function getVerdict(req, res) {
    const startTime = Date.now();
    const tmdbId = Number(req.params.id);

    if (!Number.isInteger(tmdbId) || tmdbId < 1) {
        return res.status(400).json({ message: 'Movie ID must be a positive integer' });
    }

    try {
        const cached = await MovieVerdict.findOne({ tmdbId });
        if (cached) {
            if (req.user) {
                try {
                    await recordVerdictCheck(req.user, {
                        tmdbId: cached.tmdbId,
                        title: cached.movieTitle,
                        verdictBadge: cached.verdictBadge
                    });
                } catch (histErr) {
                    console.warn('Could not record verdict check:', histErr.message);
                }
            }

            return res.json({
                ...cached.toObject(),
                meta: { cached: true, latencyMs: Date.now() - startTime }
            });
        }
    } catch (dbErr) {
        console.error('Verdict cache lookup failed:', dbErr.message);
    }

    if (!process.env.GEMINI_API_KEY) {
        return res.status(503).json({
            error: 'AI verdict service is not configured',
            message: 'GEMINI_API_KEY is missing from environment variables'
        });
    }

    const flightKey = `verdict:${tmdbId}`;
    if (inFlight.has(flightKey)) {
        return res.status(429).json({
            error: 'Verdict generation is already in progress for this movie. Please retry in a few seconds.'
        });
    }

    const movieTitle = typeof req.query.title === 'string' ? req.query.title.trim() : '';
    const releaseYear = typeof req.query.year === 'string' ? req.query.year.trim() : '';

    if (!movieTitle) {
        return res.status(400).json({ message: 'title query parameter is required' });
    }

    inFlight.add(flightKey);

    try {
        const { GoogleGenAI } = require('@google/genai');
        const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

        const systemInstruction =
            'You are an objective film analyst. Research publicly accessible audience discussions, ' +
            'including X (Twitter), Reddit, and entertainment news, for the specified movie. ' +
            'Prioritize genuine audience opinions over promotional content. ' +
            'Ignore obvious bots, duplicate posts, actor fan-war spam, and paid promotional hype. ' +
            'Never reveal plot twists, character deaths, or ending spoilers. ' +
            'Distinguish actual audience sentiment from critic ratings, box-office performance, and marketing hype. ' +
            'Do not invent sources, quotations, ratings, or public reactions. ' +
            'If evidence is insufficient, clearly communicate uncertainty.';

        const prompt =
            `Analyze audience sentiment and news for the movie "${movieTitle}"` +
            (releaseYear ? ` (${releaseYear})` : '') +
            `. Search X (Twitter), Reddit, and entertainment news for genuine audience reactions. ` +
            `Return a JSON object with exactly these fields:
{
  "verdictBadge": one of ["Must Watch", "Sleeper Hit", "Mixed / Niche", "Overhyped", "Skip"],
  "organicSentimentScore": integer 0-100 (genuine audience positivity, not critic score),
  "audienceVsCriticGap": string describing any gap between audience and critic reception,
  "praisedFor": array of up to 3 strings (what audiences genuinely praise, NO spoilers),
  "criticizedFor": array of up to 3 strings (what audiences genuinely criticize, NO spoilers),
  "boxOfficeAndNewsPulse": string summarizing box office and news highlights
}
Return ONLY valid JSON. No markdown, no explanation outside the JSON.`;

        let geminiResponse;
        let modelName = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
        if (modelName === 'gemini-2.0-flash' || modelName === 'gemini-2.5-flash' || modelName === 'gemini-2.5-flash-lite') {
            modelName = 'gemini-3.5-flash-lite';
        }

        try {
            geminiResponse = await genai.models.generateContent({
                model: modelName,
                contents: prompt,
                config: {
                    systemInstruction,
                    tools: [{ googleSearch: {} }],
                    temperature: 0.3
                }
            });
        } catch (groundingErr) {
            console.warn('Grounding attempt failed, falling back to direct analysis:', groundingErr.message);
            try {
                geminiResponse = await genai.models.generateContent({
                    model: modelName,
                    contents: prompt,
                    config: {
                        systemInstruction,
                        temperature: 0.3
                    }
                });
            } catch (geminiErr) {
                console.error('Gemini API call failed:', geminiErr.message);
                const errStr = (geminiErr.message || '').toLowerCase();
                if (errStr.includes('429') || errStr.includes('resource_exhausted') || errStr.includes('quota')) {
                    return res.status(429).json({
                        error: 'Gemini API quota exceeded or rate limited',
                        message: 'Your Gemini API key has exceeded its quota or rate limit. Please wait 1 minute, or generate a fresh key from Google AI Studio.'
                    });
                }
                const isTimeout = errStr.includes('timeout') || errStr.includes('deadline');
                return res.status(isTimeout ? 504 : 502).json({
                    error: 'AI verdict temporarily unavailable',
                    message: 'The Gemini API did not respond. Please try again.'
                });
            }
        }

        const rawText = geminiResponse?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (!rawText) {
            return res.status(502).json({
                error: 'AI verdict returned an empty response. Please try again.'
            });
        }

        let parsed;
        try {
            const firstBrace = rawText.indexOf('{');
            const lastBrace = rawText.lastIndexOf('}');
            if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
                throw new Error('No JSON object found in response');
            }
            const cleaned = rawText.substring(firstBrace, lastBrace + 1);
            parsed = JSON.parse(cleaned);
        } catch {
            return res.status(502).json({
                error: 'AI returned an unreadable response. Please try again.',
                hint: 'The model did not return valid JSON.'
            });
        }

        if (!isValidVerdict(parsed)) {
            return res.status(502).json({
                error: 'AI verdict was incomplete or invalid. Please try again.'
            });
        }

        const groundingChunks =
            geminiResponse?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

        const sources = groundingChunks
            .filter(chunk => chunk?.web?.uri)
            .slice(0, 3)
            .map(chunk => ({
                title: chunk.web.title || chunk.web.uri,
                uri:   chunk.web.uri
            }));

        let saved;
        try {
            saved = await MovieVerdict.create({
                tmdbId,
                movieTitle,
                releaseYear,
                verdictBadge:          parsed.verdictBadge,
                organicSentimentScore: parsed.organicSentimentScore,
                audienceVsCriticGap:   parsed.audienceVsCriticGap || '',
                praisedFor:            (parsed.praisedFor || []).slice(0, 3),
                criticizedFor:         (parsed.criticizedFor || []).slice(0, 3),
                boxOfficeAndNewsPulse: parsed.boxOfficeAndNewsPulse || '',
                sources
            });
        } catch (saveErr) {
            if (saveErr.code === 11000) {
                const existing = await MovieVerdict.findOne({ tmdbId });
                if (existing) {
                    return res.json({
                        ...existing.toObject(),
                        meta: { cached: true, latencyMs: Date.now() - startTime }
                    });
                }
            }
            return res.json({
                tmdbId,
                movieTitle,
                releaseYear,
                verdictBadge:          parsed.verdictBadge,
                organicSentimentScore: parsed.organicSentimentScore,
                audienceVsCriticGap:   parsed.audienceVsCriticGap || '',
                praisedFor:            (parsed.praisedFor || []).slice(0, 3),
                criticizedFor:         (parsed.criticizedFor || []).slice(0, 3),
                boxOfficeAndNewsPulse: parsed.boxOfficeAndNewsPulse || '',
                sources,
                meta: { cached: false, latencyMs: Date.now() - startTime, dbSaved: false }
            });
        }

        if (req.user) {
            try {
                await recordVerdictCheck(req.user, {
                    tmdbId: saved.tmdbId,
                    title: saved.movieTitle,
                    verdictBadge: saved.verdictBadge
                });
            } catch (histErr) {
                console.warn('Could not record verdict check in user history:', histErr.message);
            }
        }

        return res.json({
            ...saved.toObject(),
            meta: { cached: false, latencyMs: Date.now() - startTime }
        });
    } finally {
        inFlight.delete(flightKey);
    }
}

async function getVideos(req, res) {
    const movieId = req.params.id;
    if (!/^\d+$/.test(movieId) || Number(movieId) < 1) {
        return res.status(400).json({ message: 'Movie ID must be a positive integer' });
    }

    try {
        const response = await axios.get(
            `${TMDB_BASE_URL}/movie/${movieId}/videos`,
            { params: tmdbParams(), timeout: 8000 }
        );

        const allVideos = response.data.results || [];
        const youtubeVideos = allVideos.filter(v => v.site === 'YouTube');

        const trailers = youtubeVideos
            .filter(v => v.type === 'Trailer')
            .sort((a, b) => (b.official ? 1 : 0) - (a.official ? 1 : 0))
            .map(({ key, name, type, official }) => ({ key, name, type, official }));

        const clips = youtubeVideos
            .filter(v => ['Teaser', 'Featurette', 'Clip'].includes(v.type))
            .sort((a, b) => (b.official ? 1 : 0) - (a.official ? 1 : 0))
            .map(({ key, name, type, official }) => ({ key, name, type, official }));

        return res.json({ trailers, clips });
    } catch (err) {
        console.error('TMDB videos request failed:', err.message);
        return res.status(err.code === 'ECONNABORTED' ? 504 : 502).json({
            error: 'Video information is temporarily unavailable'
        });
    }
}

async function getProviders(req, res) {
    const movieId = req.params.id;
    if (!/^\d+$/.test(movieId) || Number(movieId) < 1) {
        return res.status(400).json({ message: 'Movie ID must be a positive integer' });
    }

    const movieTitle = typeof req.query.title === 'string' ? req.query.title.trim() : '';

    try {
        const response = await axios.get(
            `${TMDB_BASE_URL}/movie/${movieId}/watch/providers`,
            { params: tmdbParams(), timeout: 8000 }
        );

        const results = response.data.results || {};
        const IN = results.IN;
        const US = results.US;
        const justWatchLink = IN?.link || (movieTitle ? `https://www.justwatch.com/in/search?q=${encodeURIComponent(movieTitle)}` : null);

        const mapProviders = (arr = [], extra = {}) => {
            if (!Array.isArray(arr)) return [];
            return arr.map(p => ({
                providerId: p.provider_id,
                providerName: p.provider_name,
                logoPath: p.logo_path ? `https://image.tmdb.org/t/p/original${p.logo_path}` : null,
                searchUrl: buildIndianOttUrl(p.provider_name, movieTitle, justWatchLink),
                ...extra
            }));
        };

        const flatrate = mapProviders(IN?.flatrate, { plan: 'subscription' });
        const free = mapProviders(IN?.free, { plan: 'free' });
        const ads = mapProviders(IN?.ads, { plan: 'ads' });
        const rent = mapProviders(IN?.rent, { plan: 'rent' });
        const buy = mapProviders(IN?.buy, { plan: 'buy' });

        const hasLocalStream = flatrate.length > 0 || free.length > 0 || ads.length > 0;
        const globalStream = !hasLocalStream ? mapProviders(US?.flatrate, { plan: 'global' }).slice(0, 4) : [];

        return res.json({
            region: 'IN',
            justWatchLink,
            flatrate,
            free,
            ads,
            rent,
            buy,
            globalStream,
            quickSearch: getQuickSearchLinks(movieTitle)
        });
    } catch (err) {
        console.error('TMDB providers request failed:', err.message);
        return res.status(err.code === 'ECONNABORTED' ? 504 : 502).json({
            error: 'OTT availability information is temporarily unavailable'
        });
    }
}

module.exports = { getVerdict, getVideos, getProviders };
