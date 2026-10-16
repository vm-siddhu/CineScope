/**
 * benchmark.js — Compares explain('executionStats') with and without
 * the compound index { userId, tmdbId }.
 *
 * Run AFTER seeding:
 *   node seed.js --clean
 *   node benchmark.js
 *
 * Output shows docsExamined, totalKeysExamined, and executionTimeMillis
 * so you can copy the numbers into your Version B write-up.
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const Movie = require('./models/Movie');

async function run() {
    let indexDropped = false;
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        await Movie.init();
        console.log('Connected to MongoDB\n');

        // Pick a real userId that exists in the collection.
        const sample = await Movie.findOne({});
        if (!sample) {
            throw new Error('No documents found. Seed a disposable benchmark database first.');
        }
        const { userId, tmdbId } = sample;

        console.log('=== WITH compound index { userId: 1, tmdbId: 1 } ===');
        const withIndex = await Movie.find({ userId, tmdbId }).explain('executionStats');
        printStats(withIndex);

        console.log('\n=== WITHOUT compound index (collection scan) ===');
        await Movie.collection.dropIndex('userId_1_tmdbId_1');
        indexDropped = true;
        const withoutIndex = await Movie.find({ userId, tmdbId }).explain('executionStats');
        printStats(withoutIndex);
    } finally {
        // Restore the correctness constraint even if explain() fails.
        if (indexDropped) {
            await Movie.collection.createIndex({ userId: 1, tmdbId: 1 }, { unique: true });
            console.log('\nIndex recreated');
        }
        if (mongoose.connection.readyState !== 0) {
            await mongoose.disconnect();
        }
    }
}

function printStats(explainResult) {
    const stats = explainResult.executionStats;
    if (!stats) {
        // Sharded cluster — look inside shards
        console.log(JSON.stringify(explainResult, null, 2));
        return;
    }
    console.log(`  Winning plan stage : ${explainResult.queryPlanner?.winningPlan?.stage ?? 'N/A'}`);
    console.log(`  Docs examined      : ${stats.totalDocsExamined}`);
    console.log(`  Keys examined      : ${stats.totalKeysExamined}`);
    console.log(`  Docs returned      : ${stats.nReturned}`);
    console.log(`  Execution time     : ${stats.executionTimeMillis} ms`);
}

run().catch(err => {
    console.error(err);
    process.exit(1);
});
