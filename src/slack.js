import bolt from '@slack/bolt';
import { logInfo, logError } from './logger.js';
import { extractSongQuery } from './message-parser.js';
import { addSongToPlaylist } from './spotify.js';

const { App, ExpressReceiver } = bolt;

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

export function createSlackApp(config) {
  const receiver = new ExpressReceiver({
    signingSecret: config.slackSigningSecret,
    signatureVerification:false,
    endpoints: {
      events: '/slack/events',
      commands: '/slack/commands'
    }
  });

  const boltApp = new App({
    token: config.slackBotToken,
    receiver
  });

  return { boltApp, receiver };
}

export function registerSlackHandlers(boltApp, spotifyApi, config) {
  // Message event handler
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
      const result = await addSongToPlaylist(spotifyApi, config.spotifyPlaylistId, songQuery, config.spotifyMarket);
      await say(result.message);
      logInfo('slack.message.responded', { channel: message.channel, ok: result.ok });
    } catch (error) {
      logError('slack.message.failed', error, { channel: message.channel, songQuery });
      logger.error(error);
      await say('Sorry, something went wrong while talking to Spotify.');
    }
  });

  // Slash command handler
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
      const result = await addSongToPlaylist(spotifyApi, config.spotifyPlaylistId, songQuery, config.spotifyMarket);
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

  // Register slash commands
  const configuredSlashCommandName = config.commandPrefix.startsWith('/')
    ? config.commandPrefix
    : `/${config.commandPrefix}`;

  const slashCommands = new Set(['/play', configuredSlashCommandName]);
  for (const slashCommandName of slashCommands) {
    boltApp.command(slashCommandName, handleSlashCommand);
  }

  logInfo('slack.handlers.registered', {
    commandPrefix: config.commandPrefix,
    slashCommands: Array.from(slashCommands)
  });
}
