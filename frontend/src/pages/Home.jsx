import React, { useState, useEffect, useRef, useCallback } from 'react';
import api from '../utils/api';
import MovieCard from '../components/MovieCard';
import { toastSuccess } from '../utils/toast';

const DEBOUNCE_MS = 300;

const Home = () => {
    const [movies, setMovies] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [addedMovieIds, setAddedMovieIds] = useState([]);

    // Keep a ref to the current AbortController so we can cancel stale requests.
    const abortRef = useRef(null);
    // Timer ref for debouncing
    const debounceTimer = useRef(null);

    useEffect(() => {
        fetchInitialData();
        // Cleanup: cancel any in-flight request when the component unmounts.
        return () => abortRef.current?.abort();
    }, []);

    const fetchInitialData = async () => {
        await Promise.all([fetchPopularMovies(), fetchWatchlistIds()]);
    };

    const fetchWatchlistIds = async () => {
        try {
            const res = await api.get('/movies/watchlist');
            const ids = res.data.map(m => m.tmdbId);
            setAddedMovieIds(ids);
        } catch (err) {
            if (err.name !== 'CanceledError') {
                console.error('Failed to fetch watchlist IDs:', err);
            }
        }
    };

    const fetchPopularMovies = async () => {
        try {
            setLoading(true);
            setError('');
            const res = await api.get('/movies/popular');
            setMovies(res.data.results || []);
        } catch (err) {
            if (err.name !== 'CanceledError') {
                console.error('Fetch error:', err);
                setError('Unable to reach the movie server. Please check your connection.');
            }
        } finally {
            setLoading(false);
        }
    };

    /**
     * Debounced live search.
     * - Cancels the previous in-flight request with AbortController.
     * - Uses encodeURIComponent via the axios `params` object (automatic encoding).
     */
    const handleSearchChange = useCallback((e) => {
        const value = e.target.value;
        setSearchQuery(value);

        // Clear any pending debounce timer
        clearTimeout(debounceTimer.current);

        if (!value.trim()) {
            fetchPopularMovies();
            return;
        }

        debounceTimer.current = setTimeout(async () => {
            // Cancel the previous request if still in-flight
            abortRef.current?.abort();
            abortRef.current = new AbortController();

            try {
                setLoading(true);
                const res = await api.get('/movies/search', {
                    // Passing `query` as a param object — axios calls
                    // encodeURIComponent automatically, so & and # are safe.
                    params: { query: value },
                    signal: abortRef.current.signal
                });
                setMovies(res.data.results || []);
            } catch (err) {
                if (err.name !== 'CanceledError' && err.code !== 'ERR_CANCELED') {
                    console.error(err);
                }
            } finally {
                setLoading(false);
            }
        }, DEBOUNCE_MS);
    }, []);

    const addToWatchlist = async (movie) => {
        if (addedMovieIds.includes(movie.id)) return;
        try {
            await api.post('/movies/watchlist', {
                tmdbId: movie.id,
                title: movie.title,
                poster: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null,
                overview: movie.overview,
                rating: movie.vote_average,
                year: movie.release_date ? movie.release_date.split('-')[0] : 'N/A'
            });
            setAddedMovieIds(prev => [...prev, movie.id]);
            toastSuccess('Added 🎬');
        } catch (err) {
            if (err.response?.status === 409) {
                // Already in watchlist (race-condition caught by DB index)
                setAddedMovieIds(prev => [...prev, movie.id]);
            } else {
                console.error('Add failed', err);
            }
        }
    };

    const removeFromWatchlist = async (movie) => {
        try {
            await api.delete(`/movies/watchlist/${movie.id}`);
            setAddedMovieIds(prev => prev.filter(id => id !== movie.id));
            toastSuccess('Removed 🎬');
        } catch (err) {
            console.error('Removal failed', err);
        }
    };

    return (
        <div className="space-y-12">
            <header className="max-w-3xl mx-auto text-center space-y-6 pt-12">
                <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-white">
                    Cinema Without <span className="text-brand-primary">Boundaries</span>
                </h1>
                <p className="text-lg text-brand-muted max-w-xl mx-auto">
                    Curated collections of the world's most exceptional storytelling, delivered directly to your vault.
                </p>

                <div className="relative max-w-md mx-auto">
                    <input
                        type="text"
                        placeholder="Search for titles..."
                        className="w-full pl-12 pr-4 py-3 bg-slate-800/50 border border-slate-700 rounded-2xl focus:ring-2 focus:ring-brand-primary/50 text-white transition-all outline-none"
                        value={searchQuery}
                        onChange={handleSearchChange}
                    />
                    <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                </div>
            </header>

            <section className="space-y-8">
                <div className="flex items-baseline justify-between border-b border-slate-800 pb-4">
                    <h2 className="text-xl font-bold text-white tracking-tight">
                        {searchQuery ? `Scanning context: "${searchQuery}"` : 'Global Curations'}
                    </h2>
                    <span className="text-xs font-bold text-brand-muted uppercase tracking-widest">{movies.length} Results</span>
                </div>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl text-red-400 text-sm text-center">
                        {error}
                    </div>
                )}

                {loading ? (
                    <div className="flex justify-center items-center py-20">
                        <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-primary border-t-transparent"></div>
                    </div>
                ) : (
                    <div className="movie-grid">
                        {movies.map(movie => (
                            <MovieCard
                                key={movie.id}
                                movie={movie}
                                onAction={addedMovieIds.includes(movie.id) ? removeFromWatchlist : addToWatchlist}
                                actionLabel={addedMovieIds.includes(movie.id) ? true : false}
                            />
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
};

export default Home;
