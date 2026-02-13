import crypto from 'node:crypto';

export function buildSlackInstallUrl({ clientId, scopes, redirectUri, state }) {
  const url = new URL('https://slack.com/oauth/v2/authorize');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('scope', scopes);

  if (redirectUri) {
    url.searchParams.set('redirect_uri', redirectUri);
  }

  if (state) {
    url.searchParams.set('state', state);
  }

  return url.toString();
}

export function verifySlackRequest({ signingSecret, timestamp, signature, rawBody }) {
  if (!signingSecret || !timestamp || !signature || !rawBody) {
    return false;
  }

  const ageMs = Math.abs(Date.now() - Number(timestamp) * 1000);
  if (!Number.isFinite(ageMs) || ageMs > 5 * 60 * 1000) {
    return false;
  }

  const baseString = `v0:${timestamp}:${rawBody}`;
  const expected = `v0=${crypto
    .createHmac('sha256', signingSecret)
    .update(baseString)
    .digest('hex')}`;

  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
}
