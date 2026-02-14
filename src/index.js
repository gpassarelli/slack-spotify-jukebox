import 'dotenv/config';
import crypto from 'node:crypto';
import express from 'express';
import { getConfig } from './config.js';
import { logInfo, logError } from './logger.js';
import {
  buildSpotifyAuthorizeUrl,
  createSpotifyClient,
  exchangeCodeForTokens
} from './spotify.js';
import { buildSlackInstallUrl, createSlackApp, registerSlackHandlers } from './slack.js';

const config = getConfig();

// Only create Spotify client if refresh token is available
// OAuth routes don't need the client, only the song-adding functionality does
let spotifyApi = null;
if (config.spotifyRefreshToken) {
  spotifyApi = createSpotifyClient(config);
  logInfo('spotify.client.initialized', { hasRefreshToken: true });
} else {
  logInfo('spotify.client.skipped', { 
    reason: 'no_refresh_token',
    message: 'Spotify client not initialized. Complete OAuth flow first.'
  });
}

const { boltApp, receiver } = createSlackApp(config);

// Only register Slack handlers if we have a Spotify client
if (spotifyApi) {
  registerSlackHandlers(boltApp, spotifyApi, config);
} else {
  logInfo('slack.handlers.skipped', { reason: 'no_spotify_client' });
}

export const expressApp = express();
expressApp.use(receiver.router);

expressApp.get('/', (_req, res) => {
  const hasRefreshToken = Boolean(config.spotifyRefreshToken);
  const statusMessage = hasRefreshToken 
    ? '<p style="color:#1DB954;">✓ Spotify is connected and ready!</p>' 
    : '<p style="color:#ffa500;">⚠️ Spotify not connected yet. Click below to connect.</p>';
  
  res.status(200).send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Slack Spotify Jukebox</title>
    <style>
      body { font-family: Arial, sans-serif; background: #121212; color: white; display: grid; place-items: center; min-height: 100vh; margin: 0; }
      .card { width: min(560px, 90vw); background: #1f1f1f; border-radius: 12px; padding: 24px; box-shadow: 0 6px 22px rgba(0,0,0,0.25); }
      .button-row { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 12px; }
      a.button { display: inline-block; color: #fff; text-decoration: none; padding: 12px 18px; border-radius: 999px; font-weight: bold; }
      a.spotify { background: #1DB954; }
      a.slack { background: #4A154B; }
      code { background: #2b2b2b; padding: 2px 6px; border-radius: 4px; }
    </style>
  </head>
  <body>
    <main class="card">
      <h1>Slack Spotify Jukebox</h1>
      ${statusMessage}
      <p>Connect your Spotify account so this app can add songs to your playlist.</p>
      <div class="button-row">
        <a id="spotify-login-link" class="button spotify" href="/spotify/login">Login with Spotify</a>
        <a id="slack-install-link" class="button slack" href="/slack/install">Add to Slack workspace</a>
      </div>
      <p><strong>First time setup:</strong></p>
      <ol>
        <li>Click "Login with Spotify" above</li>
        <li>Approve the app</li>
        <li>Copy the refresh token from the next page</li>
        <li>Set <code>SPOTIFY_REFRESH_TOKEN</code> in your <code>.env</code> file</li>
        <li>Restart the app</li>
      </ol>
      <p>If Slack OAuth is not configured, the Slack install route will show a configuration message.</p>
    </main>

    <script>
      const isNetlify = window.location.hostname.endsWith('.netlify.app');
      if (isNetlify) {
        const prefix = '/.netlify/functions/app';
        document.getElementById('spotify-login-link').href = prefix + '/spotify/login';
        document.getElementById('slack-install-link').href = prefix + '/slack/install';
      }
    </script>
  </body>
</html>`);
});

expressApp.get('/slack/install', (_req, res) => {
  if (!config.slackClientId) {
    res.status(400).send('Missing SLACK_CLIENT_ID. Configure it to enable Slack OAuth installation.');
    return;
  }

  const state = crypto.randomUUID();
  const installUrl = buildSlackInstallUrl({
    clientId: config.slackClientId,
    scopes: config.slackScopes,
    redirectUri: config.slackOAuthRedirectUri,
    state
  });

  res.redirect(installUrl);
});

expressApp.get('/slack/oauth/callback', (req, res) => {
  const error = req.query.error;
  const code = req.query.code;

  if (typeof error === 'string' && error.length > 0) {
    logInfo('slack.oauth.failed', { error });
    res.status(400).send(`Slack OAuth failed: ${error}`);
    return;
  }

  if (!code || typeof code !== 'string') {
    logInfo('slack.oauth.failed', { error: 'missing_code' });
    res.status(400).send('Missing Slack OAuth code.');
    return;
  }

  logInfo('slack.oauth.success', { codeLength: code.length });

  res.status(200).send(`<!doctype html>
<html lang="en"><head><meta charset="UTF-8" /><title>Slack OAuth Complete</title></head>
<body style="font-family:Arial,sans-serif;padding:24px;background:#121212;color:#fff;">
  <h1>Slack installation authorized ✅</h1>
  <p>Received OAuth code. Exchange this code on your backend if you want to automate token setup.</p>
  <pre style="white-space:pre-wrap;background:#1f1f1f;padding:12px;border-radius:8px;">${code}</pre>
</body></html>`);
});

expressApp.get('/spotify/login', (_req, res) => {
  const state = crypto.randomUUID();
  const authorizeUrl = buildSpotifyAuthorizeUrl({
    clientId: config.spotifyClientId,
    redirectUri: config.spotifyRedirectUri,
    state
  });

  res.redirect(authorizeUrl);
});

expressApp.get('/spotify/oauth/callback', async (req, res) => {
  const code = req.query.code;
  if (!code || typeof code !== 'string') {
    logInfo('spotify.oauth.failed', { error: 'missing_code' });
    res.status(400).send('Missing Spotify OAuth code.');
    return;
  }

  try {
    const tokenResponse = await exchangeCodeForTokens({
      clientId: config.spotifyClientId,
      clientSecret: config.spotifyClientSecret,
      redirectUri: config.spotifyRedirectUri,
      code
    });

    logInfo('spotify.oauth.success', { hasRefreshToken: Boolean(tokenResponse.refresh_token) });

    res.status(200).send(`<!doctype html>
<html lang="en"><head><meta charset="UTF-8" /><title>Spotify Connected</title></head>
<body style="font-family:Arial,sans-serif;padding:24px;background:#121212;color:#fff;">
  <h1>Spotify connected ✅</h1>
  <p>Copy this refresh token and set <code>SPOTIFY_REFRESH_TOKEN</code> in your environment variables:</p>
  <pre style="white-space:pre-wrap;background:#1f1f1f;padding:12px;border-radius:8px;">${tokenResponse.refresh_token || 'No refresh token returned'}</pre>
</body></html>`);
  } catch (error) {
    logError('spotify.oauth.failed', error);
    res.status(500).send(`Spotify OAuth failed: ${error.message}`);
  }
});

expressApp.get('/health', (_req, res) => {
  res.status(200).json({ ok: true });
});

export async function startServer(port = process.env.PORT || 3000) {
  logInfo('server.starting', {
    port,
    commandPrefix: config.commandPrefix,
    channelRestricted: Boolean(config.listenChannelId)
  });

  await boltApp.start();

  expressApp.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`⚡️ Slack Spotify Jukebox listening on port ${port}`);
  });
}

if (process.env.START_HTTP_SERVER === 'true') {
  startServer();
}
