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
  endpoints: {
    events: '/slack/events',
    commands: '/slack/commands'
  }
});
const boltApp = new App({
  token: config.slackBotToken,
  receiver
});

function logInfo(message, context = {}) {
  // eslint-disable-next-line no-console
  console.log(`[jukebox] ${message}`, context);
}

function logError(message, error, context = {}) {
  // eslint-disable-next-line no-console
  console.error(`[jukebox] ${message}`, {
    ...context,
    error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : error
  });
}

async function addSongToPlaylist(songQuery) {
  logInfo('spotify.add_song.start', { songQuery, market: config.spotifyMarket });
  await ensureAccessToken(spotifyApi);
  const track = await findTrack(spotifyApi, songQuery, config.spotifyMarket);

  if (!track) {
    logInfo('spotify.add_song.not_found', { songQuery });
    return {
      ok: false,
      message: `I couldn't find anything on Spotify for: *${songQuery}*`
    };
  }

  await addTrackToPlaylist(spotifyApi, config.spotifyPlaylistId, track.uri);
  logInfo('spotify.add_song.added', {
    songQuery,
    trackUri: track.uri,
    trackName: track.name,
    artists: track.artists?.map((artist) => artist.name).join(', ') || null
  });

  return {
    ok: true,
    message: `Added *${formatTrack(track)}* to the jukebox playlist :notes:`
  };
}

boltApp.message(async ({ message, say, logger }) => {
  logInfo('slack.message.received', {
    channel: message.channel,
    subtype: message.subtype || null,
    hasText: Boolean(message.text)
  });

  if (message.subtype || !message.text) {
    logInfo('slack.message.ignored', { reason: 'subtype_or_empty_text' });
    return;
  }

  if (config.listenChannelId && message.channel !== config.listenChannelId) {
    logInfo('slack.message.ignored', { reason: 'channel_mismatch', expected: config.listenChannelId, received: message.channel });
    return;
  }

  const songQuery = extractSongQuery(message.text, config.commandPrefix);
  if (!songQuery) {
    logInfo('slack.message.ignored', { reason: 'no_command_prefix_match', prefix: config.commandPrefix });
    return;
  }

  logInfo('slack.message.command_detected', { channel: message.channel, songQuery });

  if (!config.spotifyRefreshToken) {
    await say('Spotify account is not connected yet. Ask an admin to connect it from the app home page.');
    return;
  }

  try {
    const result = await addSongToPlaylist(songQuery);
    await say(result.message);
    logInfo('slack.message.responded', { channel: message.channel, ok: result.ok });
  } catch (error) {
    logError('slack.message.failed', error, { channel: message.channel, songQuery });
    logger.error(error);
    await say('Sorry, something went wrong while talking to Spotify.');
  }
});

const configuredSlashCommandName = config.commandPrefix.startsWith('/')
  ? config.commandPrefix
  : `/${config.commandPrefix}`;

async function handleSlashCommand({ command, ack, respond, logger }) {
  logInfo('slack.command.received', {
    command: command.command,
    channel: command.channel_id,
    user: command.user_id,
    text: command.text || ''
  });

  await ack();
  logInfo('slack.command.acknowledged', { command: command.command, channel: command.channel_id });

  if (config.listenChannelId && command.channel_id !== config.listenChannelId) {
    logInfo('slack.command.rejected', {
      reason: 'channel_mismatch',
      command: command.command,
      expected: config.listenChannelId,
      received: command.channel_id
    });
    await respond(`This command is only enabled in channel ${config.listenChannelId}.`);
    return;
  }

  const songQuery = command.text?.trim();
  if (!songQuery) {
    logInfo('slack.command.rejected', { reason: 'missing_song_query', command: command.command });
    await respond(`Please provide a song name, for example: ${command.command} bohemian rhapsody queen`);
    return;
  }

  logInfo('slack.command.processing', { command: command.command, channel: command.channel_id, songQuery });

  if (!config.spotifyRefreshToken) {
    await respond('Spotify account is not connected yet. Ask an admin to connect it from the app home page.');
    return;
  }

  try {
    const result = await addSongToPlaylist(songQuery);
    await respond(result.message);
    logInfo('slack.command.responded', { command: command.command, channel: command.channel_id, ok: result.ok });
  } catch (error) {
    logError('slack.command.failed', error, {
      command: command.command,
      channel: command.channel_id,
      user: command.user_id,
      songQuery
    });
    logger.error(error);
    await respond('Sorry, something went wrong while talking to Spotify.');
  }
}

const slashCommands = new Set(['/play', configuredSlashCommandName]);
for (const slashCommandName of slashCommands) {
  boltApp.command(slashCommandName, handleSlashCommand);
}

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
        <a id="spotify-login-link" class="button spotify" href="/spotify/login">Login with Spotify</a>
        <a id="slack-install-link" class="button slack" href="/slack/install">Add to Slack workspace</a>
      </div>
      <p>After connecting, copy the refresh token shown on the callback page and set <code>SPOTIFY_REFRESH_TOKEN</code> in your environment.</p>
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
    slashCommands: Array.from(slashCommands),
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
