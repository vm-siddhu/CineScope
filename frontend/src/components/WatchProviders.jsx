import React, { useState, useEffect } from 'react';
import { Tv, ExternalLink, Search, Globe, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../utils/api';

const BRAND_COLORS = {
    netflix: 'hover:border-red-500/50 hover:bg-red-500/10 hover:text-red-300 text-slate-300',
    prime: 'hover:border-sky-500/50 hover:bg-sky-500/10 hover:text-sky-300 text-slate-300',
    hotstar: 'hover:border-cyan-500/50 hover:bg-cyan-500/10 hover:text-cyan-300 text-slate-300',
    jiocinema: 'hover:border-pink-500/50 hover:bg-pink-500/10 hover:text-pink-300 text-slate-300',
    sonyliv: 'hover:border-amber-500/50 hover:bg-amber-500/10 hover:text-amber-300 text-slate-300',
    zee5: 'hover:border-purple-500/50 hover:bg-purple-500/10 hover:text-purple-300 text-slate-300',
    youtube: 'hover:border-rose-500/50 hover:bg-rose-500/10 hover:text-rose-300 text-slate-300'
};

const WatchProviders = ({ movieId, movieTitle }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [showMoreSearch, setShowMoreSearch] = useState(false);

    useEffect(() => {
        if (!movieId) return;
        let cancelled = false;

        const fetchProviders = async () => {
            setLoading(true);
            setError(false);
            try {
                const res = await api.get(`/movies/${movieId}/providers`, {
                    params: { title: movieTitle || '' }
                });
                if (!cancelled) setData(res.data);
            } catch {
                if (!cancelled) setError(true);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        fetchProviders();
        return () => { cancelled = true; };
    }, [movieId, movieTitle]);

    if (loading) {
        return (
            <section className="bg-brand-card rounded-xl border border-brand-border p-5 space-y-4">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Where to Watch in India
                </h3>
                <div className="flex gap-3">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="w-12 h-12 rounded-xl bg-brand-surface animate-pulse" />
                    ))}
                </div>
            </section>
        );
    }

    if (error) {
        return (
            <section className="bg-brand-card rounded-xl border border-brand-border p-5 space-y-2">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Where to Watch in India
                </h3>
                <p className="text-xs text-brand-muted">OTT availability temporarily unavailable.</p>
            </section>
        );
    }

    const flatrate = data?.flatrate || [];
    const free = data?.free || [];
    const ads = data?.ads || [];
    const rent = data?.rent || [];
    const buy = data?.buy || [];
    const globalStream = data?.globalStream || [];
    const quickSearch = data?.quickSearch || [];

    // Deduplicate streams for India
    const seenIds = new Set();
    const allStream = [];
    [...flatrate, ...free, ...ads].forEach(p => {
        if (!seenIds.has(p.providerId)) {
            seenIds.add(p.providerId);
            allStream.push(p);
        }
    });

    const hasAnyLocal = allStream.length > 0 || rent.length > 0 || buy.length > 0;

    return (
        <section className="bg-brand-card rounded-xl border border-brand-border p-5 space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <Tv size={13} className="text-brand-primary" /> Where to Watch in India
                </h3>
                {data?.justWatchLink && (
                    <a
                        href={data.justWatchLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-brand-muted hover:text-brand-primary transition-colors"
                    >
                        JustWatch <ExternalLink size={10} />
                    </a>
                )}
            </div>

            {allStream.length > 0 && (
                <ProviderGroup label="Stream" providers={allStream} />
            )}

            {rent.length > 0 && (
                <ProviderGroup label="Rent" providers={rent} />
            )}

            {buy.length > 0 && (
                <ProviderGroup label="Buy" providers={buy} />
            )}

            {!hasAnyLocal && (
                <div className="rounded-lg bg-brand-surface/60 border border-brand-border/60 p-3.5 space-y-2">
                    <p className="text-xs text-slate-300 font-medium">
                        Not yet listed as streaming in India on TMDB / JustWatch.
                    </p>
                    <p className="text-[11px] text-brand-muted leading-relaxed">
                        Catalog indexing can take a few weeks for newly added OTT releases or regional titles. Check your subscribed platforms directly below:
                    </p>
                </div>
            )}

            {globalStream.length > 0 && (
                <div className="space-y-2 pt-1 border-t border-brand-border/40">
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                        <Globe size={11} className="text-slate-400" /> Streaming in Other Regions
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {globalStream.map(p => (
                            <span
                                key={p.providerId}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-brand-surface border border-brand-border text-[11px] text-slate-300"
                            >
                                {p.logoPath && (
                                    <img src={p.logoPath} alt={p.providerName} className="w-3.5 h-3.5 rounded object-cover" />
                                )}
                                {p.providerName}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Quick 1-click direct search on top Indian OTT platforms */}
            {(!hasAnyLocal || showMoreSearch) && quickSearch.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-brand-border/40">
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                        <Search size={11} /> Search Direct on Indian OTT
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                        {quickSearch.map(item => (
                            <a
                                key={item.name}
                                href={item.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-brand-surface border border-brand-border transition-all ${
                                    BRAND_COLORS[item.brand] || 'hover:border-brand-primary text-slate-300'
                                }`}
                                title={`Search "${movieTitle}" on ${item.name}`}
                            >
                                {item.name}
                                <ExternalLink size={10} className="opacity-60" />
                            </a>
                        ))}
                    </div>
                </div>
            )}

            {hasAnyLocal && quickSearch.length > 0 && (
                <button
                    onClick={() => setShowMoreSearch(prev => !prev)}
                    className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-300 transition-colors pt-1"
                >
                    {showMoreSearch ? (
                        <>Hide direct search shortcuts <ChevronUp size={12} /></>
                    ) : (
                        <>Can't find your platform? Search directly <ChevronDown size={12} /></>
                    )}
                </button>
            )}

            <p className="text-[10px] text-slate-600 leading-relaxed pt-1">
                Links open platform search pages. Streaming rights change frequently and depend on your regional subscription.
            </p>
        </section>
    );
};

const ProviderGroup = ({ label, providers }) => (
    <div className="space-y-2">
        <div className="flex items-center gap-2">
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
            <span className="text-[9px] text-slate-500 bg-brand-surface px-1.5 py-0.5 rounded-full border border-brand-border">
                {providers.length}
            </span>
        </div>
        <div className="flex flex-wrap gap-2">
            {providers.map(p => (
                <a
                    key={p.providerId}
                    href={p.searchUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`Search "${p.providerName}" for this movie`}
                    className="group relative"
                >
                    {p.logoPath ? (
                        <div className="relative">
                            <img
                                src={p.logoPath}
                                alt={p.providerName}
                                className="w-11 h-11 rounded-xl object-cover border border-brand-border group-hover:border-brand-primary/60 transition-all group-hover:scale-105"
                                loading="lazy"
                            />
                            {p.plan === 'free' && (
                                <span className="absolute -top-1 -right-1 bg-emerald-500 text-black font-bold text-[8px] px-1 rounded-sm shadow">
                                    FREE
                                </span>
                            )}
                            {p.plan === 'ads' && (
                                <span className="absolute -top-1 -right-1 bg-amber-500 text-black font-bold text-[8px] px-1 rounded-sm shadow">
                                    ADS
                                </span>
                            )}
                        </div>
                    ) : (
                        <div className="w-11 h-11 rounded-xl bg-brand-surface border border-brand-border flex items-center justify-center group-hover:border-brand-primary/60 transition-all">
                            <span className="text-[9px] text-brand-muted text-center px-1 leading-tight">
                                {p.providerName}
                            </span>
                        </div>
                    )}
                    <span className="absolute -bottom-7 left-1/2 -translate-x-1/2 text-[10px] bg-black/90 text-white px-2 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-lg border border-brand-border">
                        {p.providerName} {p.plan === 'free' ? '(Free)' : p.plan === 'ads' ? '(With Ads)' : ''}
                    </span>
                </a>
            ))}
        </div>
    </div>
);

export default WatchProviders;
