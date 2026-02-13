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
