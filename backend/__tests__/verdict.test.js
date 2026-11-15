/**
 * verdict.test.js
 *
 * Tests for GET /api/movies/:id/verdict and GET /api/movies/:id/videos
 * and GET /api/movies/:id/providers
 *
 * All external dependencies (axios, @google/genai, MovieVerdict) are mocked.
 */

jest.mock('axios', () => ({ get: jest.fn() }));
jest.mock('@google/genai', () => ({
    GoogleGenAI: jest.fn().mockImplementation(() => ({
        models: {
            generateContent: jest.fn()
        }
    }))
}));

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const { GoogleGenAI } = require('@google/genai');

process.env.JWT_SECRET = 'test-secret-key';
process.env.GEMINI_API_KEY = 'test-gemini-key';
process.env.TMDB_API_KEY = 'test-tmdb-key';

const { createApp } = require('../app');

let mongod, app, authToken;

beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    app = createApp();

    // Register a user so we can test authenticated verdict history
    const res = await request(app)
        .post('/api/auth/register')
        .send({ name: 'VerdictUser', email: 'verdict@test.com', password: 'password123' });
    authToken = res.body.token;
});

afterAll(async () => {
    await mongoose.disconnect();
    await mongod.stop();
});

afterEach(async () => {
    jest.clearAllMocks();
    // Clear MovieVerdict collection between tests
    const col = mongoose.connection.collections['movieverdicts'];
    if (col) await col.deleteMany({});
});

// ─────────────────────────────────────────────────────────────
// VERDICT — input validation
// ─────────────────────────────────────────────────────────────
describe('GET /api/movies/:id/verdict — validation', () => {
    it('returns 400 for a non-numeric movie ID', async () => {
        const res = await request(app).get('/api/movies/not-a-number/verdict');
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/positive integer/i);
    });

    it('returns 400 when title query param is missing', async () => {
        const res = await request(app).get('/api/movies/550/verdict');
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/title/i);
    });
});

// ─────────────────────────────────────────────────────────────
// VERDICT — cache hit
// ─────────────────────────────────────────────────────────────
describe('GET /api/movies/:id/verdict — cache hit', () => {
    it('returns cached verdict without calling Gemini', async () => {
        const MovieVerdict = require('../models/MovieVerdict');

        // Insert a cached verdict directly
        await MovieVerdict.create({
            tmdbId: 550,
            movieTitle: 'Fight Club',
            releaseYear: '1999',
            verdictBadge: 'Must Watch',
            organicSentimentScore: 88,
            audienceVsCriticGap: 'Audiences love it more than critics',
            praisedFor: ['Direction', 'Acting'],
            criticizedFor: ['Pacing'],
            boxOfficeAndNewsPulse: 'Cult classic status',
            sources: [{ title: 'Reddit', uri: 'https://reddit.com/r/movies' }]
        });

        const res = await request(app).get('/api/movies/550/verdict?title=Fight+Club');

        expect(res.status).toBe(200);
        expect(res.body.verdictBadge).toBe('Must Watch');
        expect(res.body.meta.cached).toBe(true);
        expect(typeof res.body.meta.latencyMs).toBe('number');
        // Gemini should NOT have been called
        expect(GoogleGenAI).not.toHaveBeenCalled();
    });
});

// ─────────────────────────────────────────────────────────────
// VERDICT — cache miss (Gemini called)
// ─────────────────────────────────────────────────────────────
describe('GET /api/movies/:id/verdict — cache miss', () => {
    it('calls Gemini, saves verdict, and returns it with cached:false', async () => {
        const mockGenerateContent = jest.fn().mockResolvedValue({
            candidates: [{
                content: {
                    parts: [{
                        text: JSON.stringify({
                            verdictBadge: 'Sleeper Hit',
                            organicSentimentScore: 72,
                            audienceVsCriticGap: 'Underrated by critics, loved on Reddit',
                            praisedFor: ['Atmosphere', 'Score'],
                            criticizedFor: ['Slow pacing'],
                            boxOfficeAndNewsPulse: 'Modestly performed but gained cult following'
                        })
                    }]
                },
                groundingMetadata: {
                    groundingChunks: [
                        { web: { title: 'Reddit post', uri: 'https://reddit.com/r/movies/abc' } }
                    ]
                }
            }]
        });

        GoogleGenAI.mockImplementation(() => ({
            models: { generateContent: mockGenerateContent }
        }));

        const res = await request(app).get('/api/movies/278/verdict?title=The+Shawshank+Redemption&year=1994');

        expect(res.status).toBe(200);
        expect(res.body.verdictBadge).toBe('Sleeper Hit');
        expect(res.body.organicSentimentScore).toBe(72);
        expect(res.body.sources).toHaveLength(1);
        expect(res.body.meta.cached).toBe(false);
        expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    });
});

// ─────────────────────────────────────────────────────────────
// VERDICT — Gemini API failures
// ─────────────────────────────────────────────────────────────
describe('GET /api/movies/:id/verdict — Gemini failures', () => {
    it('returns 503 when GEMINI_API_KEY is missing', async () => {
        const original = process.env.GEMINI_API_KEY;
        delete process.env.GEMINI_API_KEY;

        const res = await request(app).get('/api/movies/999/verdict?title=SomeMovie');
        expect(res.status).toBe(503);
        expect(res.body.error).toMatch(/not configured/i);

        process.env.GEMINI_API_KEY = original;
    });

    it('returns 502 when Gemini throws a network error', async () => {
        GoogleGenAI.mockImplementation(() => ({
            models: { generateContent: jest.fn().mockRejectedValue(new Error('Network error')) }
        }));

        const res = await request(app).get('/api/movies/111/verdict?title=SomeMovie');
        expect(res.status).toBe(502);
        expect(res.body.error).toMatch(/temporarily unavailable/i);
    });

    it('returns 502 when Gemini returns invalid JSON', async () => {
        GoogleGenAI.mockImplementation(() => ({
            models: {
                generateContent: jest.fn().mockResolvedValue({
                    candidates: [{
                        content: { parts: [{ text: 'This is not JSON at all' }] }
                    }]
                })
            }
        }));

        const res = await request(app).get('/api/movies/222/verdict?title=BadJsonMovie');
        expect(res.status).toBe(502);
        expect(res.body.error).toMatch(/unreadable/i);
    });

    it('returns 502 when Gemini returns structurally invalid verdict', async () => {
        GoogleGenAI.mockImplementation(() => ({
            models: {
                generateContent: jest.fn().mockResolvedValue({
                    candidates: [{
                        content: { parts: [{ text: JSON.stringify({ verdictBadge: 'Unknown Badge', organicSentimentScore: 999 }) }] }
                    }]
                })
            }
        }));

        const res = await request(app).get('/api/movies/333/verdict?title=InvalidVerdictMovie');
        expect(res.status).toBe(502);
        expect(res.body.error).toMatch(/incomplete or invalid/i);
    });

    it('returns 502 when Gemini returns empty response', async () => {
        GoogleGenAI.mockImplementation(() => ({
            models: {
                generateContent: jest.fn().mockResolvedValue({
                    candidates: [{ content: { parts: [{ text: '' }] } }]
                })
            }
        }));

        const res = await request(app).get('/api/movies/444/verdict?title=EmptyMovie');
        expect(res.status).toBe(502);
        expect(res.body.error).toMatch(/empty response/i);
    });
});

// ─────────────────────────────────────────────────────────────
// VIDEOS
// ─────────────────────────────────────────────────────────────
describe('GET /api/movies/:id/videos', () => {
    it('returns 400 for a non-numeric movie ID', async () => {
        const res = await request(app).get('/api/movies/abc/videos');
        expect(res.status).toBe(400);
    });

    it('returns trailers and clips separated', async () => {
        axios.get.mockResolvedValue({
            data: {
                results: [
                    { site: 'YouTube', type: 'Trailer', key: 'abc', name: 'Official Trailer', official: true },
                    { site: 'YouTube', type: 'Teaser',  key: 'def', name: 'First Look', official: false },
                    { site: 'Vimeo',   type: 'Trailer', key: 'ghi', name: 'Vimeo Trailer', official: true }
                ]
            }
        });

        const res = await request(app).get('/api/movies/550/videos');
        expect(res.status).toBe(200);
        expect(res.body.trailers).toHaveLength(1);
        expect(res.body.trailers[0].key).toBe('abc');
        expect(res.body.clips).toHaveLength(1);
        expect(res.body.clips[0].key).toBe('def');
    });

    it('returns empty arrays when no YouTube videos exist', async () => {
        axios.get.mockResolvedValue({ data: { results: [] } });
        const res = await request(app).get('/api/movies/550/videos');
        expect(res.status).toBe(200);
        expect(res.body.trailers).toEqual([]);
        expect(res.body.clips).toEqual([]);
    });

    it('returns 502 on TMDB failure', async () => {
        axios.get.mockRejectedValue(Object.assign(new Error('TMDB down'), { response: { status: 503 } }));
        const res = await request(app).get('/api/movies/550/videos');
        expect(res.status).toBe(502);
    });
});

// ─────────────────────────────────────────────────────────────
// PROVIDERS
// ─────────────────────────────────────────────────────────────
describe('GET /api/movies/:id/providers', () => {
    it('returns 400 for a non-numeric movie ID', async () => {
        const res = await request(app).get('/api/movies/abc/providers');
        expect(res.status).toBe(400);
    });

    it('returns empty arrays when IN region is not in TMDB response', async () => {
        axios.get.mockResolvedValue({ data: { results: { US: {} } } });
        const res = await request(app).get('/api/movies/550/providers');
        expect(res.status).toBe(200);
        expect(res.body.region).toBe('IN');
        expect(res.body.flatrate).toEqual([]);
        expect(res.body.rent).toEqual([]);
        expect(res.body.buy).toEqual([]);
    });

    it('returns flatrate providers for IN region with logo paths', async () => {
        axios.get.mockResolvedValue({
            data: {
                results: {
                    IN: {
                        link: 'https://www.justwatch.com/in/movie/test',
                        flatrate: [
                            { provider_id: 8, provider_name: 'Netflix', logo_path: '/netflix.png' }
                        ]
                    }
                }
            }
        });

        const res = await request(app).get('/api/movies/550/providers?title=Fight+Club');
        expect(res.status).toBe(200);
        expect(res.body.flatrate).toHaveLength(1);
        expect(res.body.flatrate[0].providerName).toBe('Netflix');
        expect(res.body.flatrate[0].searchUrl).toContain('netflix.com');
        expect(res.body.flatrate[0].logoPath).toContain('tmdb');
        expect(res.body.justWatchLink).toBeTruthy();
    });

    it('returns 502 on TMDB failure', async () => {
        axios.get.mockRejectedValue(Object.assign(new Error('TMDB error'), { response: { status: 500 } }));
        const res = await request(app).get('/api/movies/550/providers');
        expect(res.status).toBe(502);
    });
});
