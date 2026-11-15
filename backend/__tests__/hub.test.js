/**
 * hub.test.js
 *
 * Tests for the Personal Cinema Hub API endpoints:
 *   POST  /api/user/movies
 *   PATCH /api/user/movies/:tmdbId
 *   DELETE /api/user/movies/:tmdbId
 *   GET   /api/user/hub
 */

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const { createApp } = require('../app');

process.env.JWT_SECRET = 'test-secret-key';

let mongod, app, authToken, userId;

beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    app = createApp();

    const res = await request(app)
        .post('/api/auth/register')
        .send({ name: 'HubUser', email: 'hub@test.com', password: 'password123' });
    authToken = res.body.token;
    userId = res.body.user.id;
});

afterAll(async () => {
    await mongoose.disconnect();
    await mongod.stop();
});

afterEach(async () => {
    // Reset only the savedMovies / recentVerdictChecks, keep the user
    const User = require('../models/User');
    await User.updateMany({}, { savedMovies: [], recentVerdictChecks: [] });
});

const sampleMovie = {
    tmdbId: 550,
    title: 'Fight Club',
    posterPath: '/poster.jpg',
    releaseYear: '1999',
    voteAverage: 8.4,
    genres: ['Drama', 'Thriller'],
    status: 'want_to_watch'
};

// ─────────────────────────────────────────────────────────────
// POST /api/user/movies — add movie
// ─────────────────────────────────────────────────────────────
describe('POST /api/user/movies', () => {
    it('requires authentication', async () => {
        const res = await request(app).post('/api/user/movies').send(sampleMovie);
        expect(res.status).toBe(401);
    });

    it('adds a new movie to the library', async () => {
        const res = await request(app)
            .post('/api/user/movies')
            .set('Authorization', `Bearer ${authToken}`)
            .send(sampleMovie);

        expect(res.status).toBe(201);
        expect(res.body.message).toBe('Movie saved');
        expect(res.body.movie.tmdbId).toBe(550);
        expect(res.body.movie.status).toBe('want_to_watch');
    });

    it('updates an existing movie instead of duplicating', async () => {
        // Add once
        await request(app)
            .post('/api/user/movies')
            .set('Authorization', `Bearer ${authToken}`)
            .send(sampleMovie);

        // Add again with different status
        const res = await request(app)
            .post('/api/user/movies')
            .set('Authorization', `Bearer ${authToken}`)
            .send({ ...sampleMovie, status: 'watched' });

        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Movie updated');
        expect(res.body.movie.status).toBe('watched');
    });

    it('returns 400 when tmdbId is missing', async () => {
        const res = await request(app)
            .post('/api/user/movies')
            .set('Authorization', `Bearer ${authToken}`)
            .send({ title: 'No ID Movie' });

        expect(res.status).toBe(400);
    });

    it('returns 400 for invalid status value', async () => {
        const res = await request(app)
            .post('/api/user/movies')
            .set('Authorization', `Bearer ${authToken}`)
            .send({ ...sampleMovie, status: 'invalid_status' });

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/status/i);
    });
});

// ─────────────────────────────────────────────────────────────
// PATCH /api/user/movies/:tmdbId — update status
// ─────────────────────────────────────────────────────────────
describe('PATCH /api/user/movies/:tmdbId', () => {
    beforeEach(async () => {
        await request(app)
            .post('/api/user/movies')
            .set('Authorization', `Bearer ${authToken}`)
            .send(sampleMovie);
    });

    it('updates movie status to watched', async () => {
        const res = await request(app)
            .patch('/api/user/movies/550')
            .set('Authorization', `Bearer ${authToken}`)
            .send({ status: 'watched' });

        expect(res.status).toBe(200);
        expect(res.body.movie.status).toBe('watched');
    });

    it('updates personal reaction', async () => {
        const res = await request(app)
            .patch('/api/user/movies/550')
            .set('Authorization', `Bearer ${authToken}`)
            .send({ personalReaction: 'worth_it' });

        expect(res.status).toBe(200);
        expect(res.body.movie.personalReaction).toBe('worth_it');
    });

    it('returns 400 for invalid personalReaction', async () => {
        const res = await request(app)
            .patch('/api/user/movies/550')
            .set('Authorization', `Bearer ${authToken}`)
            .send({ personalReaction: 'amazing' });

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/personalReaction/i);
    });

    it('returns 404 for a movie not in the library', async () => {
        const res = await request(app)
            .patch('/api/user/movies/9999')
            .set('Authorization', `Bearer ${authToken}`)
            .send({ status: 'watched' });

        expect(res.status).toBe(404);
    });
});

// ─────────────────────────────────────────────────────────────
// DELETE /api/user/movies/:tmdbId
// ─────────────────────────────────────────────────────────────
describe('DELETE /api/user/movies/:tmdbId', () => {
    beforeEach(async () => {
        await request(app)
            .post('/api/user/movies')
            .set('Authorization', `Bearer ${authToken}`)
            .send(sampleMovie);
    });

    it('removes a movie from the library', async () => {
        const del = await request(app)
            .delete('/api/user/movies/550')
            .set('Authorization', `Bearer ${authToken}`);

        expect(del.status).toBe(200);
        expect(del.body.message).toMatch(/removed/i);
    });

    it('returns 404 when movie is not in the library', async () => {
        const res = await request(app)
            .delete('/api/user/movies/9999')
            .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(404);
    });
});

// ─────────────────────────────────────────────────────────────
// GET /api/user/hub — cinema hub
// ─────────────────────────────────────────────────────────────
describe('GET /api/user/hub', () => {
    it('requires authentication', async () => {
        const res = await request(app).get('/api/user/hub');
        expect(res.status).toBe(401);
    });

    it('returns empty hub for a new user', async () => {
        const res = await request(app)
            .get('/api/user/hub')
            .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(200);
        expect(res.body.savedMovies.wantToWatch).toEqual([]);
        expect(res.body.savedMovies.watched).toEqual([]);
        expect(res.body.tasteAnalytics.watchedCount).toBe(0);
        expect(res.body.tasteAnalytics.wantToWatchCount).toBe(0);
        expect(res.body.tonightPick).toBeNull();
    });

    it('returns correct counts after adding movies', async () => {
        // Add two movies
        await request(app)
            .post('/api/user/movies')
            .set('Authorization', `Bearer ${authToken}`)
            .send({ ...sampleMovie, tmdbId: 100, title: 'Movie A', status: 'want_to_watch' });

        await request(app)
            .post('/api/user/movies')
            .set('Authorization', `Bearer ${authToken}`)
            .send({ ...sampleMovie, tmdbId: 101, title: 'Movie B', status: 'watched' });

        const res = await request(app)
            .get('/api/user/hub')
            .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(200);
        expect(res.body.tasteAnalytics.wantToWatchCount).toBe(1);
        expect(res.body.tasteAnalytics.watchedCount).toBe(1);
    });

    it('calculates top genres correctly', async () => {
        await request(app)
            .post('/api/user/movies')
            .set('Authorization', `Bearer ${authToken}`)
            .send({ ...sampleMovie, tmdbId: 200, genres: ['Action', 'Drama'] });

        await request(app)
            .post('/api/user/movies')
            .set('Authorization', `Bearer ${authToken}`)
            .send({ ...sampleMovie, tmdbId: 201, title: 'Movie 2', genres: ['Action', 'Comedy'] });

        const res = await request(app)
            .get('/api/user/hub')
            .set('Authorization', `Bearer ${authToken}`);

        const topGenres = res.body.tasteAnalytics.topGenres;
        expect(topGenres[0].genre).toBe('Action'); // Most frequent
        expect(topGenres[0].count).toBe(2);
    });

    it('returns a tonightPick from the want_to_watch list', async () => {
        await request(app)
            .post('/api/user/movies')
            .set('Authorization', `Bearer ${authToken}`)
            .send({ ...sampleMovie, tmdbId: 300, title: 'Tonight Movie', status: 'want_to_watch' });

        const res = await request(app)
            .get('/api/user/hub')
            .set('Authorization', `Bearer ${authToken}`);

        expect(res.body.tonightPick).not.toBeNull();
        expect(res.body.tonightPick.title).toBe('Tonight Movie');
    });
});
