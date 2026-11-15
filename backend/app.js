const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const movieRoutes = require('./routes/movies');
const userRoutes = require('./routes/userRoutes');

function createApp() {
    const app = express();
    app.use(cors());
    app.use(express.json());
    app.use('/api/auth', authRoutes);
    app.use('/api/movies', movieRoutes);
    app.use('/api/user', userRoutes);
    app.get('/', (req, res) => res.send('CineScope API is running'));
    return app;
}

module.exports = { createApp };
