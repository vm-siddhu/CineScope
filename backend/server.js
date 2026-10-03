const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const { createApp } = require('./app');

const app = createApp();

mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
