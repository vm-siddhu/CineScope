const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const {
    addOrUpdateMovie,
    updateMovieStatus,
    removeMovie,
    getHub
} = require('../controllers/userController');

router.post('/movies', auth, addOrUpdateMovie);
router.patch('/movies/:tmdbId', auth, updateMovieStatus);
router.delete('/movies/:tmdbId', auth, removeMovie);
router.get('/hub', auth, getHub);

module.exports = router;
