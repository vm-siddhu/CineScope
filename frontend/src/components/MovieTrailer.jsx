import React from 'react';

const MovieTrailer = ({ videos }) => {
    // Find the YouTube trailer from the passed prop
    const trailer = videos?.results?.find(
        vid =>  vid.site === "YouTube" && (vid.type === "Trailer" || vid.type === "Teaser") 
    );

    if (!trailer) return null;

    return (
        <div className="aspect-video w-full mt-8 rounded-3xl overflow-hidden shadow-2xl border border-slate-800">
            <iframe
                width="100%"
                height="100%"
                src={`https://www.youtube.com/embed/${trailer.key}`}
                title="Movie Trailer"
                allowFullScreen
                className="w-full h-full"
            ></iframe>
        </div>
    );
};

export default MovieTrailer;