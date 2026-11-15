const mongoose = require('mongoose');

const savedMovieSchema = new mongoose.Schema({
    tmdbId: {
        type: Number,
        required: true
    },
    title: {
        type: String,
        required: true
    },
    posterPath: {
        type: String,
        default: null
    },
    releaseYear: {
        type: String,
        default: ''
    },
    voteAverage: {
        type: Number,
        default: null
    },
    genres: {
        type: [String],
        default: []
    },
    status: {
        type: String,
        enum: ['want_to_watch', 'watched'],
        default: 'want_to_watch'
    },
    personalReaction: {
        type: String,
        enum: ['worth_it', 'meh', 'skip', null],
        default: null
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, { _id: false });

const recentVerdictSchema = new mongoose.Schema({
    tmdbId: { type: Number, required: true },
    title: { type: String, required: true },
    verdictBadge: { type: String, default: '' },
    checkedAt: { type: Date, default: Date.now }
}, { _id: false });

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    password: {
        type: String,
        required: true
    },
    savedMovies: {
        type: [savedMovieSchema],
        default: []
    },
    recentVerdictChecks: {
        type: [recentVerdictSchema],
        default: []
    }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
