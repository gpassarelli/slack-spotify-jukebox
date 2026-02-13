import SpotifyWebApi from 'spotify-web-api-node';

export function createSpotifyClient(config) {
  return new SpotifyWebApi({
    clientId: config.spotifyClientId,
    clientSecret: config.spotifyClientSecret,
    refreshToken: config.spotifyRefreshToken
  });
}

export async function ensureAccessToken(spotifyApi) {
  const tokenResponse = await spotifyApi.refreshAccessToken();
  spotifyApi.setAccessToken(tokenResponse.body.access_token);
}

export async function findTrack(spotifyApi, query, market = 'US') {
  const result = await spotifyApi.searchTracks(query, { limit: 1, market });
  return result.body.tracks.items[0] || null;
}

export async function addTrackToPlaylist(spotifyApi, playlistId, trackUri) {
  await spotifyApi.addTracksToPlaylist(playlistId, [trackUri]);
}

export function formatTrack(track) {
  const artists = track.artists.map((artist) => artist.name).join(', ');
  return `${track.name} — ${artists}`;
}
