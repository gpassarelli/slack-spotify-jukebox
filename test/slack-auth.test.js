import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSlackInstallUrl } from '../src/slack.js';

test('buildSlackInstallUrl includes required slack oauth params', () => {
  const url = buildSlackInstallUrl({
    clientId: '123.456',
    scopes: 'chat:write,channels:history',
    redirectUri: 'http://localhost:3000/slack/oauth/callback',
    state: 'state-1'
  });

  const parsed = new URL(url);
  assert.equal(parsed.origin, 'https://slack.com');
  assert.equal(parsed.pathname, '/oauth/v2/authorize');
  assert.equal(parsed.searchParams.get('client_id'), '123.456');
  assert.equal(parsed.searchParams.get('scope'), 'chat:write,channels:history');
  assert.equal(parsed.searchParams.get('redirect_uri'), 'http://localhost:3000/slack/oauth/callback');
  assert.equal(parsed.searchParams.get('state'), 'state-1');
});
