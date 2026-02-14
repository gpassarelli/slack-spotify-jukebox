import { SpotifyApi } from '@spotify/web-api-ts-sdk';
import { logInfo } from './logger.js';

const authorizeScopes = ['playlist-modify-public', 'playlist-modify-private'];

export function createSpotifyClient(config) {
  // Create a lazy auth strategy that only gets tokens when needed
  const authStrategy = {
    getOrCreateAccessToken: async () => {
      if (!config.spotifyRefreshToken) {
        throw new Error('Spotify refresh token not configured');
      }

      const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${config.spotifyClientId}:${config.spotifyClientSecret}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: config.spotifyRefreshToken
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Failed to refresh access token: ${error.error_description || error.error}`);
      }

      const data = await response.json();
      return {
        access_token: data.access_token,
        token_type: 'Bearer',
        expires_in: data.expires_in,
        refresh_token: config.spotifyRefreshToken
      };
    },
    setConfiguration: () => {},
    getConfiguration: () => ({})
  };

  // Use a promise-based initialization to defer token fetching
  return SpotifyApi.withAccessToken(config.spotifyClientId, authStrategy.getOrCreateAccessToken());
}

export async function findTrack(spotifyApi, query, market = 'US') {
  const result = await spotifyApi.search(query, ['track'], market, 1);
  return result.tracks.items[0] || null;
}

export async function addTrackToPlaylist(spotifyApi, playlistId, trackUri) {
  await spotifyApi.playlists.addItemsToPlaylist(playlistId, [trackUri]);
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

export async function addSongToPlaylist(spotifyApi, playlistId, songQuery, market = 'US') {
  logInfo('spotify.add_song.start', { songQuery, market });
  const track = await findTrack(spotifyApi, songQuery, market);

  if (!track) {
    logInfo('spotify.add_song.not_found', { songQuery });
    return {
      ok: false,
      message: `I couldn't find anything on Spotify for: *${songQuery}*`
    };
  }

  await addTrackToPlaylist(spotifyApi, playlistId, track.uri);
  logInfo('spotify.add_song.added', {
    songQuery,
    trackUri: track.uri,
    trackName: track.name,
    artists: track.artists?.map((artist) => artist.name).join(', ') || null
  });

  return {
    ok: true,
    message: `Added *${formatTrack(track)}* to the jukebox playlist :notes:`
  };
}
