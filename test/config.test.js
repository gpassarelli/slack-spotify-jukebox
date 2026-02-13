import test from 'node:test';
import assert from 'node:assert/strict';
import { getConfig } from '../src/config.js';

function baseEnv(overrides = {}) {
  return {
    SLACK_BOT_TOKEN: 'xoxb-test',
    SLACK_SIGNING_SECRET: 'secret',
    SPOTIFY_CLIENT_ID: 'spotify-id',
    SPOTIFY_CLIENT_SECRET: 'spotify-secret',
    SPOTIFY_PLAYLIST_ID: 'playlist-id',
    ...overrides
  };
}

test('getConfig defaults Slack OAuth redirect to local callback when no URL vars are provided', () => {
  const config = getConfig(baseEnv());
  assert.equal(config.slackOAuthRedirectUri, 'http://localhost:3000/slack/oauth/callback');
});

test('getConfig builds Netlify Slack OAuth redirect from URL env var', () => {
  const config = getConfig(baseEnv({ URL: 'https://slack-spotify-jukebox.netlify.app' }));
  assert.equal(
    config.slackOAuthRedirectUri,
    'https://slack-spotify-jukebox.netlify.app/.netlify/functions/app/slack/oauth/callback'
  );
});

test('getConfig prefers explicit SLACK_OAUTH_REDIRECT_URI', () => {
  const config = getConfig(
    baseEnv({
      URL: 'https://slack-spotify-jukebox.netlify.app',
      SLACK_OAUTH_REDIRECT_URI: 'https://example.com/custom/slack/oauth/callback'
    })
  );

  assert.equal(config.slackOAuthRedirectUri, 'https://example.com/custom/slack/oauth/callback');
});
