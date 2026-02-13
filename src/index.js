import 'dotenv/config';
import crypto from 'node:crypto';
import express from 'express';
import bolt from '@slack/bolt';
import { getConfig } from './config.js';
import { extractSongQuery } from './message-parser.js';
import {
  addTrackToPlaylist,
  buildSpotifyAuthorizeUrl,
  createSpotifyClient,
  ensureAccessToken,
  exchangeCodeForTokens,
  findTrack,
  formatTrack
} from './spotify.js';
import { buildSlackInstallUrl } from './slack.js';

const { App, ExpressReceiver } = bolt;
const config = getConfig();
const spotifyApi = createSpotifyClient(config);

const receiver = new ExpressReceiver({
  signingSecret: config.slackSigningSecret,
  endpoints: '/slack/events'
});
const boltApp = new App({
  token: config.slackBotToken,
  receiver
});

boltApp.message(async ({ message, say, logger }) => {
  if (message.subtype || !message.text) {
    return;
  }

  if (config.listenChannelId && message.channel !== config.listenChannelId) {
    return;
  }

  const songQuery = extractSongQuery(message.text, config.commandPrefix);
  if (!songQuery) {
    return;
  }

  if (!config.spotifyRefreshToken) {
    await say('Spotify account is not connected yet. Ask an admin to connect it from the app home page.');
    return;
  }

  try {
    await ensureAccessToken(spotifyApi);
    const track = await findTrack(spotifyApi, songQuery, config.spotifyMarket);

    if (!track) {
      await say(`I couldn't find anything on Spotify for: *${songQuery}*`);
      return;
    }

    await addTrackToPlaylist(spotifyApi, config.spotifyPlaylistId, track.uri);
    await say(`Added *${formatTrack(track)}* to the jukebox playlist :notes:`);
  } catch (error) {
    logger.error(error);
    await say('Sorry, something went wrong while talking to Spotify.');
  }
});

export const expressApp = express();
expressApp.use(receiver.router);

expressApp.get('/', (_req, res) => {
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
      <p>Connect your Spotify account once so this app can add songs to your playlist.</p>
      <div class="button-row">
        <a class="button spotify" href="/spotify/login">Login with Spotify</a>
        ${
          config.slackClientId
            ? '<a class="button slack" href="/slack/install">Add to Slack workspace</a>'
            : ''
        }
      </div>
      <p>After connecting, copy the refresh token shown on the callback page and set <code>SPOTIFY_REFRESH_TOKEN</code> in your environment.</p>
      ${
        config.slackClientId
          ? '<p>Use <code>SLACK_CLIENT_ID</code> (and optional <code>SLACK_OAUTH_REDIRECT_URI</code>) to enable Slack OAuth install.</p>'
          : '<p>Set <code>SLACK_CLIENT_ID</code> to show an “Add to Slack workspace” install button.</p>'
      }
    </main>
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
    res.status(400).send(`Slack OAuth failed: ${error}`);
    return;
  }

  if (!code || typeof code !== 'string') {
    res.status(400).send('Missing Slack OAuth code.');
    return;
  }

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

    res.status(200).send(`<!doctype html>
<html lang="en"><head><meta charset="UTF-8" /><title>Spotify Connected</title></head>
<body style="font-family:Arial,sans-serif;padding:24px;background:#121212;color:#fff;">
  <h1>Spotify connected ✅</h1>
  <p>Copy this refresh token and set <code>SPOTIFY_REFRESH_TOKEN</code> in your environment variables:</p>
  <pre style="white-space:pre-wrap;background:#1f1f1f;padding:12px;border-radius:8px;">${tokenResponse.refresh_token || 'No refresh token returned'}</pre>
</body></html>`);
  } catch (error) {
    res.status(500).send(`Spotify OAuth failed: ${error.message}`);
  }
});

expressApp.get('/health', (_req, res) => {
  res.status(200).json({ ok: true });
});

export async function startServer(port = process.env.PORT || 3000) {
  await boltApp.start();

  expressApp.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`⚡️ Slack Spotify Jukebox listening on port ${port}`);
  });
}

if (process.env.START_HTTP_SERVER === 'true') {
  startServer();
}
