const mongoose = require('mongoose');

const sourceSchema = new mongoose.Schema({
    title: { type: String, default: '' },
    uri:   { type: String, default: '' }
}, { _id: false });

const movieVerdictSchema = new mongoose.Schema({
    tmdbId: {
        type: Number,
        required: true,
        unique: true,
        index: true
    },
    movieTitle: {
        type: String,
        required: true
    },
    releaseYear: {
        type: String,
        default: ''
    },
    verdictBadge: {
        type: String,
        enum: ['Must Watch', 'Sleeper Hit', 'Mixed / Niche', 'Overhyped', 'Skip'],
        required: true
    },
    organicSentimentScore: {
        type: Number,
        min: 0,
        max: 100,
        required: true
    },
    audienceVsCriticGap: {
        type: String,
        default: ''
    },
    praisedFor: {
        type: [String],
        validate: { validator: arr => arr.length <= 3, message: 'praisedFor may contain at most 3 items' },
        default: []
    },
    criticizedFor: {
        type: [String],
        validate: { validator: arr => arr.length <= 3, message: 'criticizedFor may contain at most 3 items' },
        default: []
    },
    boxOfficeAndNewsPulse: {
        type: String,
        default: ''
    },
    sources: {
        type: [sourceSchema],
        default: []
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

movieVerdictSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 });

module.exports = mongoose.model('MovieVerdict', movieVerdictSchema);
