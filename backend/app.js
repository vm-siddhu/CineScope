const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const movieRoutes = require('./routes/movies');

/**
 * Creates and returns the Express app without starting a listener.
 * This allows Supertest to bind the app to an ephemeral port.
 */
function createApp() {
    const app = express();
    app.use(cors());
    app.use(express.json());
    app.use('/api/auth', authRoutes);
    app.use('/api/movies', movieRoutes);
    app.get('/', (req, res) => res.send('CineScope API is running'));
    return app;
}

module.exports = { createApp };
