/**
 * seed.js — Seeds ~3 000 watchlist documents for index benchmarking.
 *
 * Usage:
 *   node seed.js           # seed 3000 docs for 10 users
 *   node seed.js --clean   # drop the collection first, then seed
 *
 * After seeding, run benchmark.js to compare explain() stats.
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const Movie = require('./models/Movie');
const User = require('./models/User');
const bcrypt = require('bcryptjs');

const TOTAL_DOCS = 3000;
const NUM_USERS = 10;

async function seed() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    if (process.argv.includes('--clean')) {
        await Movie.deleteMany({});
        await User.deleteMany({});
        console.log('Collection cleared');
    }

    // Create test users
    const password = await bcrypt.hash('password123', 10);
    const users = [];
    for (let i = 0; i < NUM_USERS; i++) {
        const u = await User.findOneAndUpdate(
            { email: `seeduser${i}@test.com` },
            { name: `Seed User ${i}`, email: `seeduser${i}@test.com`, password },
            { upsert: true, new: true }
        );
        users.push(u._id);
    }
    console.log(`Ensured ${NUM_USERS} seed users`);

    // Bulk-insert watchlist entries, skipping duplicates
    const perUser = Math.ceil(TOTAL_DOCS / NUM_USERS);
    let inserted = 0;
    const docs = [];

    for (const userId of users) {
        for (let tmdbId = 1; tmdbId <= perUser; tmdbId++) {
            docs.push({
                userId,
                tmdbId,
                title: `Movie ${tmdbId}`,
                poster: null,
                overview: `Overview for movie ${tmdbId}`,
                rating: parseFloat((Math.random() * 10).toFixed(1)),
                year: String(2000 + (tmdbId % 24))
            });
        }
    }

    try {
        const result = await Movie.insertMany(docs, { ordered: false });
        inserted = result.length;
    } catch (err) {
        // Some duplicates may exist if run without --clean
        inserted = err.result?.nInserted ?? 0;
    }

    console.log(`Inserted ${inserted} watchlist documents`);
    await mongoose.disconnect();
}

seed().catch(err => {
    console.error(err);
    process.exit(1);
});
