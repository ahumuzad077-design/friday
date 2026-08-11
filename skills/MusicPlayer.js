import React from 'react';

const MusicPlayer = ({ playlistId = '5OTJUgKeV4Oe0NfcNYDC8J' }) => {
  return (
    <iframe
      title="Spotify Embed"
      src={`https://open.spotify.com/embed/playlist/${playlistId}?utm_source=generator&theme=0`}
      width="100%"
      height="360px"
      frameBorder="0"
      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
      loading="lazy"
    />
  );
};

export default MusicPlayer;
