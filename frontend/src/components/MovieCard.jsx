import React from 'react';
import { Link } from 'react-router-dom';

const MovieCard = ({ movie, onAction, actionLabel }) => {
    return (
        <div className="group flex flex-col bg-brand-card rounded-xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 border border-slate-800">
            <Link to={`/movie/${movie.id || movie.tmdbId}`} className="relative aspect-[2/3] overflow-hidden">
                <img
                    src={movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : movie.poster}
                    alt={movie.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/80 to-transparent translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                    <span className="text-xs font-bold text-brand-primary uppercase tracking-wider">View Details</span>
                </div>
            </Link>

            <div className="flex flex-col flex-1 p-4 pt-4">
                <h3 className="text-sm font-bold text-brand-text line-clamp-1 mb-1" title={movie.title}>
                    {movie.title}
                </h3>
                <p className="text-xs text-brand-muted mb-4">
                    {movie.release_date ? movie.release_date.split('-')[0] : movie.year}
                </p>

                <div className="mt-auto">
                    <button
                        onClick={() => onAction(movie)}
                        className={`w-full py-2 px-3 rounded-lg text-xs font-bold transition-all duration-200 border ${actionLabel 
                                ? 'bg-red-700 border-red-600 text-white cursor-pointer'
                                : 'bg-brand-primary/10 border-brand-primary/20 text-brand-primary hover:bg-brand-primary hover:text-white'
                            }`}
                    >
                        {actionLabel  ? "remove" : "Add to Watchlist"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MovieCard;
