import React, { useState } from 'react';
import { Zap, ExternalLink, RefreshCw, AlertCircle, Clock, Sparkles } from 'lucide-react';
import api from '../utils/api';

const BADGE_STYLES = {
    'Must Watch':   { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' },
    'Sleeper Hit':  { bg: 'bg-teal-500/15',    text: 'text-teal-400',    border: 'border-teal-500/30'    },
    'Mixed / Niche':{ bg: 'bg-yellow-500/15',  text: 'text-yellow-400',  border: 'border-yellow-500/30'  },
    'Overhyped':    { bg: 'bg-orange-500/15',  text: 'text-orange-400',  border: 'border-orange-500/30'  },
    'Skip':         { bg: 'bg-red-500/15',     text: 'text-red-400',     border: 'border-red-500/30'     }
};

const VerdictCard = ({ movieId, movieTitle, releaseYear, tmdbRating }) => {
    const [verdict, setVerdict] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const runPulse = async () => {
        setLoading(true);
        setError('');
        setVerdict(null);
        try {
            const res = await api.get(`/movies/${movieId}/verdict`, {
                params: { title: movieTitle, year: releaseYear }
            });
            setVerdict(res.data);
        } catch (err) {
            const msg = err.response?.data?.error
                || err.response?.data?.message
                || 'Could not fetch verdict. Please try again.';
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    const badgeStyle = verdict ? (BADGE_STYLES[verdict.verdictBadge] || BADGE_STYLES['Mixed / Niche']) : null;

    return (
        <section className="bg-brand-card rounded-xl border border-brand-border p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                        <Sparkles size={14} className="text-brand-primary" />
                        Audience &amp; News Pulse
                    </h3>
                    <p className="text-[10px] text-slate-500 mt-0.5">X • Reddit • Entertainment News</p>
                </div>
                <button
                    onClick={runPulse}
                    disabled={loading}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer shrink-0
                        ${loading
                            ? 'bg-brand-primary/10 text-brand-primary/50 cursor-not-allowed'
                            : verdict
                                ? 'bg-brand-surface border border-brand-border text-brand-muted hover:border-slate-500 hover:text-white'
                                : 'bg-brand-primary text-white hover:bg-blue-500'
                        }`}
                >
                    {loading
                        ? <><RefreshCw size={11} className="animate-spin" /> Analyzing…</>
                        : verdict
                            ? <><RefreshCw size={11} /> Refresh</>
                            : <><Zap size={11} /> Run Live Pulse</>
                    }
                </button>
            </div>

            {loading && (
                <div className="space-y-3 animate-pulse">
                    <div className="h-7 w-32 bg-brand-surface rounded-lg" />
                    <div className="h-2 bg-brand-surface rounded-full" />
                    <div className="h-2 bg-brand-surface rounded-full w-5/6" />
                    <div className="grid grid-cols-2 gap-3 mt-2">
                        <div className="h-16 bg-brand-surface rounded-lg" />
                        <div className="h-16 bg-brand-surface rounded-lg" />
                    </div>
                    <p className="text-[10px] text-slate-600 text-center">
                        Searching X, Reddit and news… this takes ~5–15 seconds
                    </p>
                </div>
            )}

            {!loading && error && (
                <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <AlertCircle size={14} className="text-red-400 shrink-0 mt-0.5" />
                    <div>
                        <p className="text-xs text-red-300">{error}</p>
                        <button onClick={runPulse} className="text-[10px] text-red-400 hover:text-red-300 mt-1 underline cursor-pointer">
                            Try again
                        </button>
                    </div>
                </div>
            )}

            {!loading && !error && !verdict && (
                <div className="text-center py-4 space-y-2">
                    <p className="text-xs text-brand-muted">
                        Run a live analysis to see what audiences and news are saying about this movie.
                    </p>
                    <p className="text-[10px] text-slate-600">
                        Powered by Gemini AI with Google Search Grounding — no reviews needed
                    </p>
                </div>
            )}

            {!loading && verdict && (
                <div className="space-y-4 animate-fade-in">
                    <div className="flex items-center gap-3 flex-wrap">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold border ${badgeStyle.bg} ${badgeStyle.text} ${badgeStyle.border}`}>
                            {verdict.verdictBadge}
                        </span>
                        <div className="flex items-center gap-4 text-xs">
                            <div>
                                <span className="text-slate-500">Audience Score </span>
                                <span className="text-white font-semibold">{verdict.organicSentimentScore}/100</span>
                            </div>
                            {tmdbRating > 0 && (
                                <div>
                                    <span className="text-slate-500">TMDB Rating </span>
                                    <span className="text-yellow-400 font-semibold">★ {Number(tmdbRating).toFixed(1)}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div>
                        <div className="h-1.5 bg-brand-surface rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-700 ${
                                    verdict.organicSentimentScore >= 70 ? 'bg-emerald-500' :
                                    verdict.organicSentimentScore >= 50 ? 'bg-yellow-500' :
                                    'bg-red-500'
                                }`}
                                style={{ width: `${verdict.organicSentimentScore}%` }}
                            />
                        </div>
                        <div className="flex justify-between text-[9px] text-slate-600 mt-1">
                            <span>Organic audience sentiment</span>
                            <span>Not critic score</span>
                        </div>
                    </div>

                    {verdict.audienceVsCriticGap && (
                        <p className="text-xs text-brand-muted italic border-l-2 border-brand-border pl-3">
                            {verdict.audienceVsCriticGap}
                        </p>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {verdict.praisedFor?.length > 0 && (
                            <div className="bg-emerald-500/5 border border-emerald-500/15 rounded-lg p-3 space-y-1.5">
                                <p className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">
                                    ✓ Praised For
                                </p>
                                <ul className="space-y-1">
                                    {verdict.praisedFor.map((item, i) => (
                                        <li key={i} className="text-xs text-brand-muted">{item}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        {verdict.criticizedFor?.length > 0 && (
                            <div className="bg-red-500/5 border border-red-500/15 rounded-lg p-3 space-y-1.5">
                                <p className="text-[10px] font-semibold text-red-400 uppercase tracking-wider">
                                    ✗ Criticized For
                                </p>
                                <ul className="space-y-1">
                                    {verdict.criticizedFor.map((item, i) => (
                                        <li key={i} className="text-xs text-brand-muted">{item}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>

                    {verdict.boxOfficeAndNewsPulse && (
                        <div className="bg-brand-surface rounded-lg p-3">
                            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                                Box Office & News Pulse
                            </p>
                            <p className="text-xs text-brand-muted leading-relaxed">
                                {verdict.boxOfficeAndNewsPulse}
                            </p>
                        </div>
                    )}

                    {verdict.sources?.length > 0 && (
                        <div className="space-y-1.5">
                            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                                Grounded Sources
                            </p>
                            {verdict.sources.map((src, i) => (
                                <a
                                    key={i}
                                    href={src.uri}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1.5 text-[10px] text-brand-primary hover:text-blue-400 transition-colors truncate"
                                >
                                    <ExternalLink size={9} className="shrink-0" />
                                    <span className="truncate">{src.title || src.uri}</span>
                                </a>
                            ))}
                        </div>
                    )}

                    <div className="flex items-center gap-1.5 text-[10px] text-slate-600 pt-1 border-t border-brand-border">
                        <Clock size={9} />
                        {verdict.meta?.cached
                            ? `Cached • ${verdict.meta.latencyMs}ms`
                            : `Live Grounded • ${((verdict.meta?.latencyMs || 0) / 1000).toFixed(1)}s`
                        }
                        <span className="ml-auto opacity-60">AI-generated • may contain inaccuracies</span>
                    </div>
                </div>
            )}
        </section>
    );
};

export default VerdictCard;
