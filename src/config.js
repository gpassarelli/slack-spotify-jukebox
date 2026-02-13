const required = [
  'SLACK_BOT_TOKEN',
  'SLACK_SIGNING_SECRET',
  'SPOTIFY_CLIENT_ID',
  'SPOTIFY_CLIENT_SECRET',
  'SPOTIFY_PLAYLIST_ID'
];

function normalizeBaseUrl(url) {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

function buildDefaultSlackRedirectUri(env) {
  if (env.SLACK_OAUTH_REDIRECT_URI) {
    return env.SLACK_OAUTH_REDIRECT_URI;
  }

  if (env.URL) {
    return `${normalizeBaseUrl(env.URL)}/.netlify/functions/app/slack/oauth/callback`;
  }

  return 'http://localhost:3000/slack/oauth/callback';
}

export function getConfig(env = process.env) {
  const missing = required.filter((name) => !env[name]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  return {
    slackBotToken: env.SLACK_BOT_TOKEN,
    slackSigningSecret: env.SLACK_SIGNING_SECRET,
    spotifyClientId: env.SPOTIFY_CLIENT_ID,
    spotifyClientSecret: env.SPOTIFY_CLIENT_SECRET,
    spotifyRefreshToken: env.SPOTIFY_REFRESH_TOKEN,
    spotifyPlaylistId: env.SPOTIFY_PLAYLIST_ID,
    commandPrefix: env.JUKEBOX_COMMAND_PREFIX || 'play',
    listenChannelId: env.JUKEBOX_CHANNEL_ID || null,
    spotifyMarket: env.SPOTIFY_MARKET || 'US',
    slackClientId: env.SLACK_CLIENT_ID || null,
    slackScopes: env.SLACK_SCOPES || 'chat:write,channels:history',
    slackOAuthRedirectUri: buildDefaultSlackRedirectUri(env),
    spotifyRedirectUri:
      env.SPOTIFY_REDIRECT_URI ||
      'http://localhost:3000/spotify/oauth/callback'
  };
}
