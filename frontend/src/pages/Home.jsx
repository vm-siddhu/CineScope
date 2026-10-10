import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search } from 'lucide-react';
import api from '../utils/api';
import MovieCard from '../components/MovieCard';
import { toastSuccess, toastError } from '../utils/toast';

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
                setError('Unable to load movies. Please check your connection.');
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
            toastSuccess('Added to watchlist');
        } catch (err) {
            if (err.response?.status === 409) {
                // Already in watchlist (race-condition caught by DB index)
                setAddedMovieIds(prev => [...prev, movie.id]);
            } else {
                toastError('Failed to add. Try again.');
                console.error('Add failed', err);
            }
        }
    };

    const removeFromWatchlist = async (movie) => {
        try {
            await api.delete(`/movies/watchlist/${movie.id}`);
            setAddedMovieIds(prev => prev.filter(id => id !== movie.id));
            toastSuccess('Removed from watchlist');
        } catch (err) {
            toastError('Failed to remove. Try again.');
            console.error('Removal failed', err);
        }
    };

    return (
        <div className="space-y-10">
            {/* Hero / Search */}
            <header className="relative rounded-3xl overflow-hidden p-8 md:p-12 text-center border border-brand-border/60 shadow-2xl">
                <div 
                    className="absolute inset-0 bg-cover bg-center filter brightness-[0.35] scale-105 transition-transform duration-700 hover:scale-100"
                    style={{ backgroundImage: "url('/assets/cinematic_bg.jpg')" }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-brand-bg via-brand-bg/60 to-transparent" />

                <div className="relative z-10 max-w-2xl mx-auto space-y-5">
                    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium tracking-wide">
                        <span>🎬 Premier Movie Vault</span>
                    </div>

                    <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white leading-tight">
                        Discover & Curate <span className="text-brand-primary bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">Cinematic Masterpieces</span>
                    </h1>
                    <p className="text-sm md:text-base text-slate-300 max-w-lg mx-auto font-normal leading-relaxed">
                        Search TMDB's global repository, explore movie details, trailers, cast info, and sync your personal watchlist.
                    </p>

                    <div className="relative max-w-md mx-auto pt-2">
                        <input
                            type="text"
                            placeholder="Search movies by title..."
                            className="w-full pl-11 pr-4 py-3.5 bg-brand-surface/90 backdrop-blur-md border border-brand-border/80 rounded-xl
                            text-white placeholder-slate-400 text-sm shadow-xl
                            transition-all duration-200
                            focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20
                            hover:border-slate-500"
                            value={searchQuery}
                            onChange={handleSearchChange}
                        />
                        <Search className="absolute left-3.5 top-[calc(50%+4px)] -translate-y-1/2 w-4 h-4 text-slate-400" />
                    </div>
                </div>
            </header>

            {/* Results */}
            <section className="space-y-6">
                <div className="flex items-baseline justify-between border-b border-brand-border pb-3">
                    <h2 className="text-lg font-semibold text-white">
                        {searchQuery ? `Results for "${searchQuery}"` : 'Popular Right Now'}
                    </h2>
                    <span className="text-xs text-brand-muted">
                        {movies.length} {movies.length === 1 ? 'movie' : 'movies'}
                    </span>
                </div>

                {/* Error state */}
                {error && (
                    <div className="bg-red-500/8 border border-red-500/15 p-4 rounded-xl text-red-400 text-sm text-center">
                        {error}
                    </div>
                )}

                {/* Loading state */}
                {loading ? (
                    <div className="flex justify-center items-center py-20">
                        <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-primary border-t-transparent" />
                    </div>
                ) : movies.length === 0 ? (
                    /* Empty state */
                    <div className="flex flex-col items-center justify-center py-24 text-center">
                        <Search className="w-10 h-10 text-slate-700 mb-3" />
                        <p className="text-brand-muted font-medium">No movies found</p>
                        <p className="text-sm text-slate-600 mt-1">Try a different search term</p>
                    </div>
                ) : (
                    <div className="movie-grid">
                        {movies.map(movie => (
                            <MovieCard
                                key={movie.id}
                                movie={movie}
                                isInWatchlist={addedMovieIds.includes(movie.id)}
                                onAction={addedMovieIds.includes(movie.id) ? removeFromWatchlist : addToWatchlist}
                            />
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
};

export default Home;
