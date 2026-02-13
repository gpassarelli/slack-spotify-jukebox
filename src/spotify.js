import SpotifyWebApi from 'spotify-web-api-node';

const authorizeScopes = ['playlist-modify-public', 'playlist-modify-private'];

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

export function buildSpotifyAuthorizeUrl({ clientId, redirectUri, state }) {
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: authorizeScopes.join(' '),
    state
  });

  return `https://accounts.spotify.com/authorize?${params.toString()}`;
}

export async function exchangeCodeForTokens({
  clientId,
  clientSecret,
  redirectUri,
  code
}) {
  const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri
  });

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${authHeader}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: body.toString()
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error_description || payload.error || 'Failed to exchange Spotify OAuth code');
  }

  return payload;
}
