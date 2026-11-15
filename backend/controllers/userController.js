const User = require('../models/User');

async function addOrUpdateMovie(req, res) {
    const {
        tmdbId,
        title,
        posterPath,
        releaseYear,
        voteAverage,
        genres,
        status,
        personalReaction
    } = req.body;

    if (!tmdbId || !title) {
        return res.status(400).json({ message: 'tmdbId and title are required' });
    }

    const numericId = Number(tmdbId);
    if (!Number.isInteger(numericId) || numericId < 1) {
        return res.status(400).json({ message: 'tmdbId must be a positive integer' });
    }

    const validStatuses = ['want_to_watch', 'watched'];
    const validReactions = ['worth_it', 'meh', 'skip', null, undefined];

    if (status && !validStatuses.includes(status)) {
        return res.status(400).json({ message: `status must be one of: ${validStatuses.join(', ')}` });
    }
    if (personalReaction !== undefined && !validReactions.includes(personalReaction)) {
        return res.status(400).json({ message: 'personalReaction must be one of: worth_it, meh, skip, or null' });
    }

    try {
        const user = await User.findById(req.user);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const existingIdx = user.savedMovies.findIndex(m => m.tmdbId === numericId);

        if (existingIdx !== -1) {
            const existing = user.savedMovies[existingIdx];
            if (status) existing.status = status;
            if (personalReaction !== undefined) existing.personalReaction = personalReaction ?? null;
            if (posterPath) existing.posterPath = posterPath;
            if (releaseYear) existing.releaseYear = releaseYear;
            if (voteAverage != null) existing.voteAverage = voteAverage;
            if (Array.isArray(genres) && genres.length) existing.genres = genres;
            existing.updatedAt = new Date();
            user.savedMovies[existingIdx] = existing;
        } else {
            user.savedMovies.push({
                tmdbId: numericId,
                title,
                posterPath: posterPath || null,
                releaseYear: releaseYear || '',
                voteAverage: voteAverage ?? null,
                genres: Array.isArray(genres) ? genres : [],
                status: status || 'want_to_watch',
                personalReaction: personalReaction ?? null,
                updatedAt: new Date()
            });
        }

        await user.save();

        return res.status(existingIdx !== -1 ? 200 : 201).json({
            message: existingIdx !== -1 ? 'Movie updated' : 'Movie saved',
            movie: user.savedMovies.find(m => m.tmdbId === numericId)
        });
    } catch (err) {
        console.error('addOrUpdateMovie failed:', err);
        return res.status(500).json({ error: 'Could not save movie. Please try again.' });
    }
}

async function updateMovieStatus(req, res) {
    const tmdbId = Number(req.params.tmdbId);
    if (!Number.isInteger(tmdbId) || tmdbId < 1) {
        return res.status(400).json({ message: 'tmdbId must be a positive integer' });
    }

    const { status, personalReaction } = req.body;
    const validStatuses = ['want_to_watch', 'watched'];
    const validReactions = ['worth_it', 'meh', 'skip', null];

    if (status && !validStatuses.includes(status)) {
        return res.status(400).json({ message: `status must be one of: ${validStatuses.join(', ')}` });
    }
    if (personalReaction !== undefined && !validReactions.includes(personalReaction)) {
        return res.status(400).json({ message: 'personalReaction must be one of: worth_it, meh, skip, or null' });
    }

    try {
        const user = await User.findById(req.user);
        if (!user) return res.status(404).json({ message: 'User not found' });

        const movie = user.savedMovies.find(m => m.tmdbId === tmdbId);
        if (!movie) return res.status(404).json({ message: 'Movie not found in your library' });

        if (status !== undefined) movie.status = status;
        if (personalReaction !== undefined) movie.personalReaction = personalReaction;
        movie.updatedAt = new Date();

        await user.save();
        return res.json({ message: 'Movie updated', movie });
    } catch (err) {
        console.error('updateMovieStatus failed:', err);
        return res.status(500).json({ error: 'Could not update movie. Please try again.' });
    }
}

async function removeMovie(req, res) {
    const tmdbId = Number(req.params.tmdbId);
    if (!Number.isInteger(tmdbId) || tmdbId < 1) {
        return res.status(400).json({ message: 'tmdbId must be a positive integer' });
    }

    try {
        const user = await User.findById(req.user);
        if (!user) return res.status(404).json({ message: 'User not found' });

        const before = user.savedMovies.length;
        user.savedMovies = user.savedMovies.filter(m => m.tmdbId !== tmdbId);

        if (user.savedMovies.length === before) {
            return res.status(404).json({ message: 'Movie not found in your library' });
        }

        await user.save();
        return res.json({ message: 'Movie removed from your library' });
    } catch (err) {
        console.error('removeMovie failed:', err);
        return res.status(500).json({ error: 'Could not remove movie. Please try again.' });
    }
}

async function getHub(req, res) {
    try {
        const user = await User.findById(req.user).select('-password');
        if (!user) return res.status(404).json({ message: 'User not found' });

        const saved = user.savedMovies || [];
        const wantToWatch = saved.filter(m => m.status === 'want_to_watch');
        const watched = saved.filter(m => m.status === 'watched');

        const genreCount = {};
        saved.forEach(movie => {
            (movie.genres || []).forEach(genre => {
                genreCount[genre] = (genreCount[genre] || 0) + 1;
            });
        });

        const topGenres = Object.entries(genreCount)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([genre, count]) => ({ genre, count }));

        let tonightPick = null;
        if (wantToWatch.length > 0) {
            const preferredGenres = new Set(topGenres.map(g => g.genre));
            const scored = wantToWatch.map(movie => {
                const overlap = (movie.genres || []).filter(g => preferredGenres.has(g)).length;
                return { movie, overlap };
            });

            scored.sort((a, b) => {
                if (b.overlap !== a.overlap) return b.overlap - a.overlap;
                return Math.random() - 0.5;
            });

            tonightPick = scored[0].movie;
        }

        return res.json({
            user: {
                id: user._id,
                name: user.name,
                email: user.email
            },
            savedMovies: {
                wantToWatch,
                watched
            },
            recentVerdictChecks: user.recentVerdictChecks || [],
            tasteAnalytics: {
                wantToWatchCount: wantToWatch.length,
                watchedCount: watched.length,
                topGenres
            },
            tonightPick
        });
    } catch (err) {
        console.error('getHub failed:', err);
        return res.status(500).json({ error: 'Could not load your Cinema Hub. Please try again.' });
    }
}

module.exports = { addOrUpdateMovie, updateMovieStatus, removeMovie, getHub };
