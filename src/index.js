import express from 'express';
import bolt from '@slack/bolt';
const { App, ExpressReceiver } = bolt;
import { getConfig } from './config.js';
import { extractSongQuery } from './message-parser.js';
import {
  addTrackToPlaylist,
  createSpotifyClient,
  ensureAccessToken,
  findTrack,
  formatTrack
} from './spotify.js';

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

expressApp.get('/health', (_req, res) => {
  res.status(200).json({ ok: true });
});

export async function startServer(port = process.env.PORT || 3000) {
  await boltApp.init();

  expressApp.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`⚡️ Slack Spotify Jukebox listening on port ${port}`);
  });
}

if (process.env.START_HTTP_SERVER === 'true') {
  startServer();
}
