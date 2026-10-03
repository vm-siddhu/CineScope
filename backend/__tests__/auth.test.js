const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const { createApp } = require('../app');

// Set JWT_SECRET before the app is required so authMiddleware picks it up
process.env.JWT_SECRET = 'test-secret-key';

let mongod;
let app;

beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    app = createApp();
});

afterAll(async () => {
    await mongoose.disconnect();
    await mongod.stop();
});

afterEach(async () => {
    // Clear all collections between tests
    const collections = mongoose.connection.collections;
    for (const key in collections) {
        await collections[key].deleteMany({});
    }
});

// ─────────────────────────────────────────────────────────────
// REGISTER
// ─────────────────────────────────────────────────────────────
describe('POST /api/auth/register', () => {
    it('registers a new user and returns a token', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({ name: 'Alice', email: 'alice@example.com', password: 'password123' });

        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty('token');
        expect(res.body.user).toMatchObject({ name: 'Alice', email: 'alice@example.com' });
    });

    it('returns 400 when fields are missing', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({ email: 'nope@example.com' }); // missing name & password

        expect(res.status).toBe(400);
    });

    it('returns 400 for an invalid email format', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({ name: 'Bob', email: 'not-an-email', password: 'password123' });

        expect(res.status).toBe(400);
    });

    it('returns 409 when the email is already registered', async () => {
        const payload = { name: 'Alice', email: 'alice@example.com', password: 'password123' };
        await request(app).post('/api/auth/register').send(payload);
        const res = await request(app).post('/api/auth/register').send(payload);

        expect(res.status).toBe(409);
    });

    it('returns a token that includes an exp claim (short-lived)', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({ name: 'Carol', email: 'carol@example.com', password: 'password123' });

        const payload = JSON.parse(Buffer.from(res.body.token.split('.')[1], 'base64').toString());
        expect(payload).toHaveProperty('exp');
        // Should expire in roughly 1 hour (≤ 3600 + 5 seconds for clock drift)
        expect(payload.exp - payload.iat).toBeLessThanOrEqual(3605);
    });
});

// ─────────────────────────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────────────────────────
describe('POST /api/auth/login', () => {
    beforeEach(async () => {
        await request(app)
            .post('/api/auth/register')
            .send({ name: 'Dave', email: 'dave@example.com', password: 'password123' });
    });

    it('logs in with valid credentials', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'dave@example.com', password: 'password123' });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('token');
    });

    it('returns 401 on wrong password', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'dave@example.com', password: 'wrongpassword' });

        expect(res.status).toBe(401);
    });

    it('returns 401 on unknown email', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'ghost@example.com', password: 'password123' });

        expect(res.status).toBe(401);
    });

    it('returns 400 when email is missing', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ password: 'password123' });

        expect(res.status).toBe(400);
    });
});
