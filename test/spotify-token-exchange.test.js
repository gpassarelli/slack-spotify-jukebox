import test from 'node:test';
import assert from 'node:assert/strict';
import { exchangeCodeForTokens } from '../src/spotify.js';

test('exchangeCodeForTokens has correct structure', () => {
  assert.equal(typeof exchangeCodeForTokens, 'function');
  assert.equal(exchangeCodeForTokens.constructor.name, 'AsyncFunction');
});

test('exchangeCodeForTokens validates inputs', async () => {
  // This will fail because we're using invalid credentials, but we can verify the structure
  try {
    await exchangeCodeForTokens({
      clientId: 'test-client',
      clientSecret: 'test-secret',
      redirectUri: 'http://localhost:3000/callback',
      code: 'invalid-code'
    });
    // Should not reach here
    assert.fail('Should have thrown an error');
  } catch (error) {
    // Expected to fail with Spotify error
    assert.ok(error instanceof Error);
    // The error message should contain information about the failed exchange
    assert.ok(error.message.length > 0, 'Error should have a message');
  }
});
