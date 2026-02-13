import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { buildSlackInstallUrl, verifySlackRequest } from '../src/slack.js';

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

test('verifySlackRequest accepts a valid slack signature', (t) => {
  const signingSecret = 'secret-1';
  const timestamp = '1700000000';
  const rawBody = 'token=abc&team_id=T1&text=bohemian+rhapsody';
  const signature = `v0=${crypto
    .createHmac('sha256', signingSecret)
    .update(`v0:${timestamp}:${rawBody}`)
    .digest('hex')}`;

  t.mock.method(Date, 'now', () => Number(timestamp) * 1000);

  assert.equal(
    verifySlackRequest({ signingSecret, timestamp, signature, rawBody }),
    true
  );
});

test('verifySlackRequest rejects stale slack signatures', (t) => {
  const signingSecret = 'secret-1';
  const timestamp = '1700000000';
  const rawBody = 'token=abc&team_id=T1&text=bohemian+rhapsody';
  const signature = `v0=${crypto
    .createHmac('sha256', signingSecret)
    .update(`v0:${timestamp}:${rawBody}`)
    .digest('hex')}`;

  t.mock.method(Date, 'now', () => (Number(timestamp) + 301) * 1000);

  assert.equal(
    verifySlackRequest({ signingSecret, timestamp, signature, rawBody }),
    false
  );
});
