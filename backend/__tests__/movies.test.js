jest.mock('axios', () => ({ get: jest.fn() }));

const axios = require('axios');
const request = require('supertest');
const { createApp } = require('../app');

const app = createApp();
const originalTmdbKey = process.env.TMDB_API_KEY;

describe('TMDB proxy errors', () => {
    afterEach(() => {
        jest.clearAllMocks();
        jest.restoreAllMocks();
        if (originalTmdbKey === undefined) {
            delete process.env.TMDB_API_KEY;
        } else {
            process.env.TMDB_API_KEY = originalTmdbKey;
        }
    });

    it('returns a safe gateway error without exposing upstream details', async () => {
        process.env.TMDB_API_KEY = 'server-only-test-key';
        const logError = jest.spyOn(console, 'error').mockImplementation(() => {});
        axios.get.mockRejectedValue(Object.assign(
            new Error('Request failed with status code 401 server-only-test-key'),
            { response: { status: 401 } }
        ));

        const response = await request(app).get('/api/movies/search?query=Alien');

        expect(response.status).toBe(502);
        expect(response.body).toEqual({ error: 'Movie search is temporarily unavailable' });
        expect(JSON.stringify(response.body)).not.toContain('server-only-test-key');
        expect(axios.get).toHaveBeenCalledWith(
            'https://api.tmdb.org/3/search/movie',
            expect.objectContaining({ params: { api_key: 'server-only-test-key', query: 'Alien' }, timeout: 8000 })
        );
    });

    it('rejects empty searches before calling TMDB', async () => {
        const response = await request(app).get('/api/movies/search?query=%20%20');

        expect(response.status).toBe(400);
        expect(response.body.message).toBe('Search query is required');
        expect(axios.get).not.toHaveBeenCalled();
    });

    it('rejects a non-numeric movie ID before calling TMDB', async () => {
        const response = await request(app).get('/api/movies/details/not-a-number');

        expect(response.status).toBe(400);
        expect(response.body.message).toBe('Movie ID must be a positive integer');
        expect(axios.get).not.toHaveBeenCalled();
    });
});
