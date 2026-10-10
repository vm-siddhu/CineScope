import React from 'react';
import { Link } from 'react-router-dom';
import { Plus, Check, Trash2 } from 'lucide-react';

const MovieCard = ({ movie, onAction, isInWatchlist, isWatchlistPage }) => {
    const posterSrc = movie.poster_path
        ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
        : movie.poster;

    const year = movie.release_date
        ? movie.release_date.split('-')[0]
        : movie.year;

    const rating = movie.vote_average ?? movie.rating;

    return (
        <div className="group flex flex-col bg-brand-card rounded-xl overflow-hidden border border-brand-border hover:border-slate-600 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-brand-primary/5">
            {/* Poster */}
            <Link
                to={`/movie/${movie.id || movie.tmdbId}`}
                className="relative aspect-[2/3] overflow-hidden bg-brand-surface"
            >
                {posterSrc ? (
                    <img
                        src={posterSrc}
                        alt={movie.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-600">
                        <Clapperboard size={40} />
                    </div>
                )}

                {/* Rating badge */}
                {rating != null && (
                    <div className="absolute top-2 right-2 px-2 py-1 bg-black/70 backdrop-blur-sm rounded-lg text-xs font-semibold text-yellow-400 flex items-center gap-1">
                        <svg className="w-3 h-3 fill-current" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        {Number(rating).toFixed(1)}
                    </div>
                )}

                {/* Hover overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-3">
                    <span className="text-xs font-medium text-white/90">View Details →</span>
                </div>
            </Link>

            {/* Info */}
            <div className="flex flex-col flex-1 p-3.5">
                <h3
                    className="text-sm font-semibold text-brand-text line-clamp-1 mb-0.5"
                    title={movie.title}
                >
                    {movie.title}
                </h3>
                <p className="text-xs text-brand-muted mb-3">{year || '—'}</p>

                <div className="mt-auto">
                    {isWatchlistPage ? (
                        <button
                            onClick={() => onAction(movie)}
                            className="w-full py-2 px-3 rounded-lg text-xs font-medium transition-all duration-200 cursor-pointer
                            bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 hover:border-red-500/30
                            flex items-center justify-center gap-1.5"
                        >
                            <Trash2 size={13} />
                            Remove
                        </button>
                    ) : isInWatchlist ? (
                        <button
                            onClick={() => onAction(movie)}
                            className="w-full py-2 px-3 rounded-lg text-xs font-medium transition-all duration-200 cursor-pointer
                            bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-red-500/10 hover:border-red-500/20 hover:text-red-400
                            flex items-center justify-center gap-1.5 group/btn"
                        >
                            <Check size={13} className="group-hover/btn:hidden" />
                            <Trash2 size={13} className="hidden group-hover/btn:block" />
                            <span className="group-hover/btn:hidden">In Watchlist</span>
                            <span className="hidden group-hover/btn:inline">Remove</span>
                        </button>
                    ) : (
                        <button
                            onClick={() => onAction(movie)}
                            className="w-full py-2 px-3 rounded-lg text-xs font-medium transition-all duration-200 cursor-pointer
                            bg-brand-primary/10 border border-brand-primary/20 text-brand-primary hover:bg-brand-primary hover:text-white
                            flex items-center justify-center gap-1.5"
                        >
                            <Plus size={13} />
                            Add to Watchlist
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MovieCard;
