import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSpotifyAuthorizeUrl } from '../src/spotify.js';

test('buildSpotifyAuthorizeUrl includes required spotify oauth params', () => {
  const url = buildSpotifyAuthorizeUrl({
    clientId: 'client-id',
    redirectUri: 'http://localhost:3000/spotify/oauth/callback',
    state: 'abc123'
  });

  const parsed = new URL(url);
  assert.equal(parsed.origin, 'https://accounts.spotify.com');
  assert.equal(parsed.pathname, '/authorize');
  assert.equal(parsed.searchParams.get('client_id'), 'client-id');
  assert.equal(parsed.searchParams.get('response_type'), 'code');
  assert.equal(parsed.searchParams.get('redirect_uri'), 'http://localhost:3000/spotify/oauth/callback');
  assert.equal(parsed.searchParams.get('state'), 'abc123');
  assert.match(parsed.searchParams.get('scope'), /playlist-modify-public/);
  assert.match(parsed.searchParams.get('scope'), /playlist-modify-private/);
});
