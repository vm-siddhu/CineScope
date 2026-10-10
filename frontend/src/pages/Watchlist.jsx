import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Trash2, Film } from 'lucide-react';
import api from '../utils/api';
import MovieCard from '../components/MovieCard';
import { toastSuccess, toastError } from '../utils/toast';

const Watchlist = () => {
    const [movies, setMovies] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchWatchlist();
    }, []);

    const fetchWatchlist = async () => {
        try {
            setLoading(true);
            const res = await api.get('/movies/watchlist');
            setMovies(res.data);
        } catch (err) {
            toastError('Failed to load watchlist');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const removeFromWatchlist = async (movie) => {
        try {
            await api.delete(`/movies/watchlist/${movie.tmdbId}`);
            setMovies(prev => prev.filter(m => m.tmdbId !== movie.tmdbId));
            toastSuccess('Removed from watchlist');
        } catch (err) {
            toastError('Failed to remove. Try again.');
            console.error('Removal failed', err);
        }
    };

    return (
        <div className="space-y-8 py-8">
            <header className="space-y-1">
                <h1 className="text-2xl font-bold text-white">Your Watchlist</h1>
                <p className="text-sm text-brand-muted">
                    {movies.length > 0
                        ? `${movies.length} ${movies.length === 1 ? 'movie' : 'movies'} saved`
                        : 'Movies you save will appear here'
                    }
                </p>
            </header>

            {loading ? (
                <div className="flex justify-center py-20">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-primary border-t-transparent" />
                </div>
            ) : movies.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                    <Film className="w-12 h-12 text-slate-700 mb-4" />
                    <p className="text-brand-muted font-medium mb-1">Your watchlist is empty</p>
                    <p className="text-sm text-slate-600 mb-5">Start exploring and add movies you want to watch</p>
                    <Link to="/" className="btn-primary">
                        Browse Movies
                    </Link>
                </div>
            ) : (
                <div className="movie-grid">
                    {movies.map(movie => (
                        <MovieCard
                            key={movie._id}
                            movie={movie}
                            onAction={removeFromWatchlist}
                            isWatchlistPage
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export default Watchlist;
