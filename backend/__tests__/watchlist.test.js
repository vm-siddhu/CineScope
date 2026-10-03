const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { createApp } = require('../app');

process.env.JWT_SECRET = 'test-secret-key';

let mongod;
let app;
let authToken;
let userId;

beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    app = createApp();

    // Register and log in to get a valid token for watchlist tests
    const res = await request(app)
        .post('/api/auth/register')
        .send({ name: 'Eve', email: 'eve@example.com', password: 'password123' });

    authToken = res.body.token;
    userId = res.body.user.id;
});

afterAll(async () => {
    await mongoose.disconnect();
    await mongod.stop();
});

afterEach(async () => {
    // Only clear Movie collection between tests (keep the user)
    await mongoose.connection.collections['movies']?.deleteMany({});
});

// ─────────────────────────────────────────────────────────────
// AUTH MIDDLEWARE
// ─────────────────────────────────────────────────────────────
describe('Auth middleware', () => {
    it('returns 401 when no token is provided', async () => {
        const res = await request(app).get('/api/movies/watchlist');
        expect(res.status).toBe(401);
    });

    it('returns 401 for a malformed token', async () => {
        const res = await request(app)
            .get('/api/movies/watchlist')
            .set('Authorization', 'Bearer this-is-not-a-jwt');
        expect(res.status).toBe(401);
    });

    it('returns 401 for an expired token', async () => {
        const expiredToken = jwt.sign(
            { id: new mongoose.Types.ObjectId() },
            process.env.JWT_SECRET,
            { expiresIn: -1 } // already expired
        );
        const res = await request(app)
            .get('/api/movies/watchlist')
            .set('Authorization', `Bearer ${expiredToken}`);
        expect(res.status).toBe(401);
    });
});

// ─────────────────────────────────────────────────────────────
// WATCHLIST — ADD
// ─────────────────────────────────────────────────────────────
describe('POST /api/movies/watchlist', () => {
    const movie = {
        tmdbId: 550,
        title: 'Fight Club',
        poster: '/poster.jpg',
        overview: 'An underground fight club',
        rating: 8.4,
        year: '1999'
    };

    it('adds a movie to the watchlist', async () => {
        const res = await request(app)
            .post('/api/movies/watchlist')
            .set('Authorization', `Bearer ${authToken}`)
            .send(movie);

        expect(res.status).toBe(201);
        expect(res.body.message).toBe('Added to watchlist');
    });

    it('returns 409 on a duplicate (race-condition safety)', async () => {
        // Add once
        await request(app)
            .post('/api/movies/watchlist')
            .set('Authorization', `Bearer ${authToken}`)
            .send(movie);

        // Simulate concurrent second request
        const res = await request(app)
            .post('/api/movies/watchlist')
            .set('Authorization', `Bearer ${authToken}`)
            .send(movie);

        expect(res.status).toBe(409);
        expect(res.body.message).toBe('Movie already in watchlist');
    });

    it('returns 401 without token', async () => {
        const res = await request(app)
            .post('/api/movies/watchlist')
            .send(movie);
        expect(res.status).toBe(401);
    });
});

// ─────────────────────────────────────────────────────────────
// WATCHLIST — GET
// ─────────────────────────────────────────────────────────────
describe('GET /api/movies/watchlist', () => {
    it('returns an empty array for a new user', async () => {
        const res = await request(app)
            .get('/api/movies/watchlist')
            .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });

    it('returns the movies in the watchlist', async () => {
        await request(app)
            .post('/api/movies/watchlist')
            .set('Authorization', `Bearer ${authToken}`)
            .send({ tmdbId: 999, title: 'Test Movie', poster: null, overview: '', rating: 7, year: '2020' });

        const res = await request(app)
            .get('/api/movies/watchlist')
            .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(1);
        expect(res.body[0].title).toBe('Test Movie');
    });

    it('only returns movies belonging to the authenticated user', async () => {
        // Register a second user
        const res2 = await request(app)
            .post('/api/auth/register')
            .send({ name: 'Frank', email: 'frank@example.com', password: 'password123' });
        const token2 = res2.body.token;

        // Add a movie as user 2
        await request(app)
            .post('/api/movies/watchlist')
            .set('Authorization', `Bearer ${token2}`)
            .send({ tmdbId: 111, title: "Frank's Movie", poster: null, overview: '', rating: 6, year: '2019' });

        // User 1 should still see an empty list
        const res = await request(app)
            .get('/api/movies/watchlist')
            .set('Authorization', `Bearer ${authToken}`);

        expect(res.body).toEqual([]);
    });
});

// ─────────────────────────────────────────────────────────────
// WATCHLIST — REMOVE
// ─────────────────────────────────────────────────────────────
describe('DELETE /api/movies/watchlist/:id', () => {
    it('removes a movie from the watchlist', async () => {
        await request(app)
            .post('/api/movies/watchlist')
            .set('Authorization', `Bearer ${authToken}`)
            .send({ tmdbId: 42, title: 'To Delete', poster: null, overview: '', rating: 5, year: '2021' });

        const del = await request(app)
            .delete('/api/movies/watchlist/42')
            .set('Authorization', `Bearer ${authToken}`);

        expect(del.status).toBe(200);

        // Confirm it's gone
        const list = await request(app)
            .get('/api/movies/watchlist')
            .set('Authorization', `Bearer ${authToken}`);

        expect(list.body).toHaveLength(0);
    });
});
