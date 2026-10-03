const mongoose = require('mongoose');

const movieSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    tmdbId: {
        type: Number,
        required: true
    },
    title: {
        type: String,
        required: true
    },
    poster: String,
    overview: String,
    rating: Number,
    year: String
}, { timestamps: true });

// Compound unique index: prevents duplicate (user, movie) pairs at the DB level.
// Also fixes the race-condition duplicate bug — a concurrent INSERT that slips
// past the application-level check will still fail with error code 11000.
movieSchema.index({ userId: 1, tmdbId: 1 }, { unique: true });

module.exports = mongoose.model('Movie', movieSchema);
