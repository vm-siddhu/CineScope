import React from 'react';

const MovieTrailer = ({ videos }) => {
    // Find the YouTube trailer from the passed prop
    const trailer = videos?.results?.find(
        vid => vid.site === "YouTube" && (vid.type === "Trailer" || vid.type === "Teaser")
    );

    if (!trailer) return null;

    return (
        <section className="space-y-3">
            <h2 className="text-lg font-semibold text-white border-l-3 border-brand-primary pl-3">
                Trailer
            </h2>
            <div className="aspect-video w-full rounded-xl overflow-hidden border border-brand-border">
                <iframe
                    width="100%"
                    height="100%"
                    src={`https://www.youtube.com/embed/${trailer.key}`}
                    title={`${trailer.name || 'Movie'} Trailer`}
                    allowFullScreen
                    className="w-full h-full"
                    loading="lazy"
                />
            </div>
        </section>
    );
};

export default MovieTrailer;