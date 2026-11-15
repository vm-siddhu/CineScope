import React, { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
    Film, Eye, Bookmark, Sparkles, BarChart2, ThumbsUp, Meh, ThumbsDown,
    RefreshCw, Clapperboard, ChevronRight, Clock
} from 'lucide-react';
import api from '../utils/api';
import { toastSuccess, toastError } from '../utils/toast';

const REACTION_LABELS = {
    worth_it: { label: 'Worth It', icon: <ThumbsUp size={11} />, color: 'text-emerald-400' },
    meh:      { label: 'Meh',      icon: <Meh size={11} />,      color: 'text-yellow-400'  },
    skip:     { label: 'Skip',     icon: <ThumbsDown size={11} />, color: 'text-red-400'   }
};

const BADGE_COLORS = {
    'Must Watch':    'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    'Sleeper Hit':   'text-teal-400    bg-teal-500/10    border-teal-500/20',
    'Mixed / Niche': 'text-yellow-400  bg-yellow-500/10  border-yellow-500/20',
    'Overhyped':     'text-orange-400  bg-orange-500/10  border-orange-500/20',
    'Skip':          'text-red-400     bg-red-500/10     border-red-500/20'
};

const ProfileHub = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = searchParams.get('tab') || 'hub';

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [tonightPick, setTonightPick] = useState(null);
    const [pickLoading, setPickLoading] = useState(false);

    const fetchHub = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/user/hub');
            setData(res.data);
            setTonightPick(res.data.tonightPick || null);
        } catch {
            toastError('Could not load your Cinema Hub.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchHub(); }, [fetchHub]);

    const handlePickAgain = async () => {
        setPickLoading(true);
        try {
            const res = await api.get('/user/hub');
            setTonightPick(res.data.tonightPick || null);
        } catch {
            toastError('Could not fetch a pick.');
        } finally {
            setPickLoading(false);
        }
    };

    const handleStatusChange = async (tmdbId, newStatus) => {
        try {
            await api.patch(`/user/movies/${tmdbId}`, { status: newStatus });
            toastSuccess(newStatus === 'watched' ? 'Marked as watched!' : 'Moved to watchlist!');
            fetchHub();
        } catch {
            toastError('Could not update status.');
        }
    };

    const handleReactionChange = async (tmdbId, reaction) => {
        try {
            await api.patch(`/user/movies/${tmdbId}`, { personalReaction: reaction });
            toastSuccess('Reaction saved!');
            fetchHub();
        } catch {
            toastError('Could not save reaction.');
        }
    };

    const handleRemove = async (tmdbId) => {
        try {
            await api.delete(`/user/movies/${tmdbId}`);
            toastSuccess('Removed from library.');
            fetchHub();
        } catch {
            toastError('Could not remove.');
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-[60vh]">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-primary border-t-transparent" />
            </div>
        );
    }

    const { tasteAnalytics, savedMovies, recentVerdictChecks, user: userData } = data || {};
    const wantToWatch = savedMovies?.wantToWatch || [];
    const watched     = savedMovies?.watched || [];

    const tabs = [
        { key: 'hub',       label: 'Overview' },
        { key: 'watchlist', label: `Want to Watch (${wantToWatch.length})` },
        { key: 'watched',   label: `Watched (${watched.length})` }
    ];

    return (
        <div className="space-y-8 py-6 animate-fade-up">
            <header className="space-y-1">
                <h1 className="text-2xl font-bold text-white">
                    {userData?.name ? `${userData.name}'s` : 'My'} Cinema Hub
                </h1>
                <p className="text-sm text-brand-muted">Your personal movie intelligence dashboard</p>
            </header>

            <div className="flex gap-1 p-1 bg-brand-card rounded-xl border border-brand-border w-fit">
                {tabs.map(t => (
                    <button
                        key={t.key}
                        onClick={() => setSearchParams({ tab: t.key })}
                        className={`px-4 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                            activeTab === t.key
                                ? 'bg-brand-primary text-white'
                                : 'text-brand-muted hover:text-white'
                        }`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {activeTab === 'hub' && (
                <div className="space-y-8">
                    <section className="bg-brand-card rounded-xl border border-brand-border p-6 space-y-5">
                        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                            <BarChart2 size={15} className="text-brand-primary" /> Taste Snapshot
                        </h2>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <StatBox label="Watched" value={tasteAnalytics?.watchedCount || 0} icon={<Eye size={16} />} />
                            <StatBox label="Watchlist" value={tasteAnalytics?.wantToWatchCount || 0} icon={<Bookmark size={16} />} />
                            {tasteAnalytics?.topGenres?.slice(0, 2).map((g, i) => (
                                <StatBox key={i} label="Top Genre" value={g.genre} sub={`${g.count} saved`} />
                            ))}
                        </div>

                        {tasteAnalytics?.topGenres?.length > 0 && (
                            <div>
                                <p className="text-xs text-slate-500 mb-2 uppercase tracking-wider">Your top genres</p>
                                <div className="flex flex-wrap gap-2">
                                    {tasteAnalytics.topGenres.map((g, i) => (
                                        <span key={i} className="px-3 py-1 bg-brand-primary/10 border border-brand-primary/20 text-brand-primary text-xs font-medium rounded-full">
                                            {g.genre} <span className="opacity-60">({g.count})</span>
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </section>

                    <section className="bg-brand-card rounded-xl border border-brand-border p-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                                <Sparkles size={15} className="text-brand-primary" /> Pick a Movie For Me Tonight
                            </h2>
                            {wantToWatch.length > 0 && (
                                <button
                                    onClick={handlePickAgain}
                                    disabled={pickLoading}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-brand-surface border border-brand-border text-brand-muted hover:border-slate-500 hover:text-white transition-all cursor-pointer disabled:opacity-50"
                                >
                                    <RefreshCw size={11} className={pickLoading ? 'animate-spin' : ''} />
                                    Pick Again
                                </button>
                            )}
                        </div>

                        {tonightPick ? (
                            <div className="flex gap-4 items-start">
                                <Link to={`/movie/${tonightPick.tmdbId}`} className="shrink-0">
                                    {tonightPick.posterPath ? (
                                        <img
                                            src={`https://image.tmdb.org/t/p/w200${tonightPick.posterPath}`}
                                            alt={tonightPick.title}
                                            className="w-20 rounded-lg border border-brand-border hover:border-brand-primary/50 transition-all"
                                        />
                                    ) : (
                                        <div className="w-20 h-28 rounded-lg bg-brand-surface border border-brand-border flex items-center justify-center">
                                            <Clapperboard size={20} className="text-slate-600" />
                                        </div>
                                    )}
                                </Link>
                                <div className="space-y-2">
                                    <Link to={`/movie/${tonightPick.tmdbId}`} className="text-base font-semibold text-white hover:text-brand-primary transition-colors">
                                        {tonightPick.title}
                                    </Link>
                                    <p className="text-xs text-brand-muted">
                                        {tonightPick.releaseYear && <span>{tonightPick.releaseYear} • </span>}
                                        {tonightPick.voteAverage > 0 && <span className="text-yellow-400">★ {Number(tonightPick.voteAverage).toFixed(1)} • </span>}
                                        {tonightPick.genres?.slice(0, 2).join(', ')}
                                    </p>
                                    <Link
                                        to={`/movie/${tonightPick.tmdbId}`}
                                        className="inline-flex items-center gap-1 text-xs text-brand-primary hover:underline"
                                    >
                                        View details <ChevronRight size={11} />
                                    </Link>
                                </div>
                            </div>
                        ) : (
                            <EmptyState
                                icon={<Clapperboard size={28} className="text-slate-600" />}
                                message="Add movies to your watchlist to get a personalized pick."
                                actionTo="/"
                                actionLabel="Browse Movies"
                            />
                        )}
                    </section>

                    <section className="bg-brand-card rounded-xl border border-brand-border p-6 space-y-4">
                        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                            <Sparkles size={15} className="text-brand-primary" /> Recent AI Verdicts
                        </h2>
                        {recentVerdictChecks?.length > 0 ? (
                            <div className="space-y-2">
                                {recentVerdictChecks.map((v, i) => (
                                    <Link
                                        key={i}
                                        to={`/movie/${v.tmdbId}`}
                                        className="flex items-center justify-between p-3 rounded-lg bg-brand-surface border border-brand-border hover:border-slate-600 transition-all group"
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <Film size={13} className="text-slate-500 shrink-0" />
                                            <span className="text-sm text-brand-text truncate group-hover:text-white">{v.title}</span>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0 ml-2">
                                            {v.verdictBadge && (
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${BADGE_COLORS[v.verdictBadge] || ''}`}>
                                                    {v.verdictBadge}
                                                </span>
                                            )}
                                            <span className="text-[10px] text-slate-600 flex items-center gap-1">
                                                <Clock size={9} /> {formatTimeAgo(v.checkedAt)}
                                            </span>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-brand-muted">
                                No recent verdict checks. Run the AI Pulse on a movie detail page to see results here.
                            </p>
                        )}
                    </section>
                </div>
            )}

            {activeTab === 'watchlist' && (
                <div className="space-y-4">
                    {wantToWatch.length === 0 ? (
                        <EmptyState
                            icon={<Bookmark size={28} className="text-slate-600" />}
                            message="Your watchlist is empty. Start adding movies you want to watch."
                            actionTo="/"
                            actionLabel="Browse Movies"
                        />
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {wantToWatch.map(movie => (
                                <LibraryCard
                                    key={movie.tmdbId}
                                    movie={movie}
                                    onStatusChange={handleStatusChange}
                                    onReactionChange={handleReactionChange}
                                    onRemove={handleRemove}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'watched' && (
                <div className="space-y-4">
                    {watched.length === 0 ? (
                        <EmptyState
                            icon={<Eye size={28} className="text-slate-600" />}
                            message="No watched movies yet. Mark a movie as watched on its detail page."
                            actionTo="/"
                            actionLabel="Discover Movies"
                        />
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {watched.map(movie => (
                                <LibraryCard
                                    key={movie.tmdbId}
                                    movie={movie}
                                    onStatusChange={handleStatusChange}
                                    onReactionChange={handleReactionChange}
                                    onRemove={handleRemove}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const StatBox = ({ label, value, sub, icon }) => (
    <div className="bg-brand-surface rounded-lg p-4 border border-brand-border">
        <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
            {icon} {label}
        </div>
        <p className="text-xl font-bold text-white">{value}</p>
        {sub && <p className="text-[10px] text-slate-500 mt-0.5">{sub}</p>}
    </div>
);

const LibraryCard = ({ movie, onStatusChange, onReactionChange, onRemove }) => {
    const isWatched = movie.status === 'watched';

    return (
        <div className="bg-brand-card rounded-xl border border-brand-border p-4 space-y-3">
            <div className="flex gap-3">
                <Link to={`/movie/${movie.tmdbId}`} className="shrink-0">
                    {movie.posterPath ? (
                        <img
                            src={`https://image.tmdb.org/t/p/w92${movie.posterPath}`}
                            alt={movie.title}
                            className="w-14 rounded-lg object-cover"
                        />
                    ) : (
                        <div className="w-14 h-20 rounded-lg bg-brand-surface border border-brand-border flex items-center justify-center">
                            <Clapperboard size={16} className="text-slate-600" />
                        </div>
                    )}
                </Link>
                <div className="flex-1 min-w-0">
                    <Link to={`/movie/${movie.tmdbId}`} className="text-sm font-semibold text-white hover:text-brand-primary transition-colors line-clamp-2">
                        {movie.title}
                    </Link>
                    <p className="text-xs text-brand-muted mt-0.5">
                        {movie.releaseYear}
                        {movie.voteAverage > 0 && <span className="text-yellow-400 ml-1">★ {Number(movie.voteAverage).toFixed(1)}</span>}
                    </p>
                    {movie.genres?.length > 0 && (
                        <p className="text-[10px] text-slate-600 mt-0.5 truncate">{movie.genres.slice(0, 3).join(' • ')}</p>
                    )}
                </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
                {!isWatched ? (
                    <button
                        onClick={() => onStatusChange(movie.tmdbId, 'watched')}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-all cursor-pointer"
                    >
                        <Eye size={10} /> Mark Watched
                    </button>
                ) : (
                    <button
                        onClick={() => onStatusChange(movie.tmdbId, 'want_to_watch')}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium bg-brand-surface border border-brand-border text-brand-muted hover:border-slate-500 hover:text-white transition-all cursor-pointer"
                    >
                        <Bookmark size={10} /> Move to Watchlist
                    </button>
                )}

                <button
                    onClick={() => onRemove(movie.tmdbId)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium bg-red-500/5 border border-red-500/15 text-red-400/70 hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer ml-auto"
                >
                    Remove
                </button>
            </div>

            {isWatched && (
                <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] text-slate-500">Your take:</span>
                    {Object.entries(REACTION_LABELS).map(([key, { label, icon, color }]) => (
                        <button
                            key={key}
                            onClick={() => onReactionChange(movie.tmdbId, movie.personalReaction === key ? null : key)}
                            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] border transition-all cursor-pointer ${
                                movie.personalReaction === key
                                    ? `${color} bg-current/10 border-current/30`
                                    : 'text-slate-500 border-slate-700 hover:border-slate-500 hover:text-slate-300'
                            }`}
                        >
                            {icon} {label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

const EmptyState = ({ icon, message, actionTo, actionLabel }) => (
    <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
        {icon}
        <p className="text-sm text-brand-muted max-w-xs">{message}</p>
        {actionTo && (
            <Link to={actionTo} className="btn-primary mt-1">{actionLabel}</Link>
        )}
    </div>
);

function formatTimeAgo(dateStr) {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

export default ProfileHub;
