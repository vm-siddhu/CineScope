import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import api from '../utils/api';
import MovieTrailer from '../components/MovieTrailer';

const MovieDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [movie, setMovie] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchDetails = async () => {
            try {
                setError('');
                const res = await api.get(`/movies/details/${id}`);
                setMovie(res.data);
            } catch (err) {
                console.error(err);
                setError('Could not load movie details.');
            } finally {
                setLoading(false);
            }
        };
        fetchDetails();
    }, [id]);

    if (loading) return (
        <div className="flex justify-center items-center h-[60vh]">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-primary border-t-transparent" />
        </div>
    );

    if (error || !movie) return (
        <div className="flex flex-col items-center justify-center py-24 text-center">
            <p className="text-brand-muted font-medium mb-4">{error || 'Movie not found.'}</p>
            <button onClick={() => navigate(-1)} className="btn-primary">
                ← Go Back
            </button>
        </div>
    );

    return (
        <div className="animate-fade-up">
            {/* Back button */}
            <button
                onClick={() => navigate(-1)}
                className="flex items-center gap-1.5 text-sm text-brand-muted hover:text-white transition-colors mb-6 cursor-pointer"
            >
                <ArrowLeft size={16} />
                Back
            </button>

            {/* Backdrop hero */}
            <div className="relative h-[350px] md:h-[500px] rounded-2xl overflow-hidden border border-brand-border">
                {movie.backdrop_path && (
                    <img
                        src={`https://image.tmdb.org/t/p/original${movie.backdrop_path}`}
                        alt=""
                        className="absolute inset-0 w-full h-full object-cover"
                    />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-brand-bg via-brand-bg/70 to-transparent" />

                <div className="absolute inset-0 flex items-end p-6 md:p-12">
                    <div className="flex flex-col md:flex-row gap-6 items-start md:items-end w-full">
                        {movie.poster_path && (
                            <img
                                src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`}
                                alt={movie.title}
                                className="w-32 md:w-52 rounded-xl shadow-2xl border-2 border-slate-800 hidden md:block"
                            />
                        )}
                        <div className="space-y-3 flex-1">
                            {/* Genres */}
                            <div className="flex flex-wrap gap-2">
                                {movie.genres?.map(g => (
                                    <span
                                        key={g.id}
                                        className="px-2.5 py-1 bg-brand-primary/15 text-brand-primary text-[11px] font-medium rounded-md border border-brand-primary/20"
                                    >
                                        {g.name}
                                    </span>
                                ))}
                            </div>

                            <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-white leading-tight">
                                {movie.title}
                            </h1>

                            <div className="flex items-center flex-wrap gap-3 text-sm text-brand-muted">
                                {movie.release_date && (
                                    <span>{movie.release_date.split('-')[0]}</span>
                                )}
                                {movie.runtime > 0 && (
                                    <>
                                        <span className="text-slate-600">•</span>
                                        <span>{movie.runtime} min</span>
                                    </>
                                )}
                                {movie.vote_average > 0 && (
                                    <>
                                        <span className="text-slate-600">•</span>
                                        <span className="flex items-center text-yellow-500 font-medium">
                                            <svg className="w-3.5 h-3.5 mr-1 fill-current" viewBox="0 0 20 20">
                                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                            </svg>
                                            {movie.vote_average.toFixed(1)}
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 mt-10">
                <div className="lg:col-span-2 space-y-8">
                    {/* Overview */}
                    {movie.overview && (
                        <section className="space-y-3">
                            <h2 className="text-lg font-semibold text-white border-l-3 border-brand-primary pl-3">
                                Overview
                            </h2>
                            <p className="text-base text-brand-muted leading-relaxed">
                                {movie.overview}
                            </p>
                        </section>
                    )}

                    {/* Trailer */}
                    <MovieTrailer videos={movie.videos} />
                </div>

                {/* Sidebar — Cast */}
                <div className="space-y-6">
                    {movie.credits?.cast?.length > 0 && (
                        <section className="bg-brand-card p-5 rounded-xl border border-brand-border space-y-4">
                            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                Top Cast
                            </h3>
                            <div className="space-y-3">
                                {movie.credits.cast.slice(0, 6).map(person => (
                                    <div key={person.id} className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-full bg-brand-surface overflow-hidden flex-shrink-0">
                                            {person.profile_path ? (
                                                <img
                                                    src={`https://image.tmdb.org/t/p/w200${person.profile_path}`}
                                                    alt=""
                                                    className="w-full h-full object-cover"
                                                    loading="lazy"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-slate-600 text-xs font-bold">
                                                    {person.name?.charAt(0)}
                                                </div>
                                            )}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-white truncate">{person.name}</p>
                                            <p className="text-xs text-brand-muted truncate">{person.character}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Production info */}
                    {(movie.budget > 0 || movie.revenue > 0 || movie.production_companies?.length > 0) && (
                        <section className="bg-brand-card p-5 rounded-xl border border-brand-border space-y-3">
                            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                Details
                            </h3>
                            <div className="space-y-2 text-sm">
                                {movie.budget > 0 && (
                                    <div className="flex justify-between">
                                        <span className="text-brand-muted">Budget</span>
                                        <span className="text-white font-medium">${(movie.budget / 1_000_000).toFixed(0)}M</span>
                                    </div>
                                )}
                                {movie.revenue > 0 && (
                                    <div className="flex justify-between">
                                        <span className="text-brand-muted">Revenue</span>
                                        <span className="text-white font-medium">${(movie.revenue / 1_000_000).toFixed(0)}M</span>
                                    </div>
                                )}
                                {movie.production_companies?.length > 0 && (
                                    <div>
                                        <span className="text-brand-muted block mb-1">Studios</span>
                                        <p className="text-white text-xs leading-relaxed">
                                            {movie.production_companies.map(c => c.name).join(', ')}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </section>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MovieDetail;
