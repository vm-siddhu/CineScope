const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const { createApp } = require('./app');

const app = createApp();
const PORT = process.env.PORT || 5000;

async function startServer() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    } catch (error) {
        console.error('MongoDB connection failed:', error.message);
        process.exitCode = 1;
    }
}

startServer();
