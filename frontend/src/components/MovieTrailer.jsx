import React, { useState, useEffect } from 'react';
import { Film, AlertCircle, ChevronRight } from 'lucide-react';
import api from '../utils/api';

const MovieTrailer = ({ movieId }) => {
    const [trailers, setTrailers] = useState([]);
    const [clips, setClips] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [activeTab, setActiveTab] = useState('trailer');
    const [selectedKey, setSelectedKey] = useState(null);

    useEffect(() => {
        if (!movieId) return;
        let cancelled = false;

        const fetchVideos = async () => {
            setLoading(true);
            setError(false);
            try {
                const res = await api.get(`/movies/${movieId}/videos`);
                if (cancelled) return;
                setTrailers(res.data.trailers || []);
                setClips(res.data.clips || []);

                const first = res.data.trailers?.[0] || res.data.clips?.[0];
                setSelectedKey(first?.key || null);
                if (!res.data.trailers?.length && res.data.clips?.length) {
                    setActiveTab('clips');
                }
            } catch {
                if (!cancelled) setError(true);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        fetchVideos();
        return () => { cancelled = true; };
    }, [movieId]);

    if (loading) {
        return (
            <section className="space-y-3">
                <h2 className="text-lg font-semibold text-white border-l-[3px] border-brand-primary pl-3">
                    Trailers & Clips
                </h2>
                <div className="aspect-video w-full rounded-xl bg-brand-card border border-brand-border animate-pulse" />
            </section>
        );
    }

    if (!trailers.length && !clips.length) {
        return (
            <section className="space-y-3">
                <h2 className="text-lg font-semibold text-white border-l-[3px] border-brand-primary pl-3">
                    Trailers & Clips
                </h2>
                <div className="flex flex-col items-center justify-center py-12 rounded-xl bg-brand-card border border-brand-border gap-3">
                    {error
                        ? <AlertCircle className="text-red-400" size={28} />
                        : <Film className="text-slate-600" size={28} />
                    }
                    <p className="text-sm text-brand-muted">
                        {error ? 'Could not load videos. Please try again.' : 'No trailers or clips available.'}
                    </p>
                </div>
            </section>
        );
    }

    const currentList = activeTab === 'trailer' ? trailers : clips;
    const displayVideo = currentList.find(v => v.key === selectedKey) || currentList[0];

    return (
        <section className="space-y-4">
            <h2 className="text-lg font-semibold text-white border-l-[3px] border-brand-primary pl-3">
                Trailers & Clips
            </h2>

            <div className="flex gap-2">
                {trailers.length > 0 && (
                    <button
                        onClick={() => { setActiveTab('trailer'); setSelectedKey(trailers[0].key); }}
                        className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                            activeTab === 'trailer'
                                ? 'bg-brand-primary text-white'
                                : 'bg-brand-card text-brand-muted border border-brand-border hover:border-slate-500'
                        }`}
                    >
                        Official Trailer
                    </button>
                )}
                {clips.length > 0 && (
                    <button
                        onClick={() => { setActiveTab('clips'); setSelectedKey(clips[0].key); }}
                        className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                            activeTab === 'clips'
                                ? 'bg-brand-primary text-white'
                                : 'bg-brand-card text-brand-muted border border-brand-border hover:border-slate-500'
                        }`}
                    >
                        Teasers & Clips
                        <span className="ml-1.5 text-[10px] opacity-70">({clips.length})</span>
                    </button>
                )}
            </div>

            {displayVideo && (
                <div className="aspect-video w-full rounded-xl overflow-hidden border border-brand-border">
                    <iframe
                        key={displayVideo.key}
                        width="100%"
                        height="100%"
                        src={`https://www.youtube-nocookie.com/embed/${displayVideo.key}?rel=0&modestbranding=1`}
                        title={displayVideo.name || 'Movie Video'}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        className="w-full h-full"
                        loading="lazy"
                    />
                </div>
            )}

            {currentList.length > 1 && (
                <div className="space-y-1">
                    {currentList.map(video => (
                        <button
                            key={video.key}
                            onClick={() => setSelectedKey(video.key)}
                            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-xs transition-all cursor-pointer ${
                                selectedKey === video.key
                                    ? 'bg-brand-primary/15 text-white border border-brand-primary/30'
                                    : 'text-brand-muted hover:text-white hover:bg-brand-card border border-transparent'
                            }`}
                        >
                            <ChevronRight size={12} className="shrink-0" />
                            <span className="truncate">{video.name}</span>
                            <span className="ml-auto shrink-0 opacity-50 capitalize">{video.type}</span>
                        </button>
                    ))}
                </div>
            )}
        </section>
    );
};

export default MovieTrailer;
