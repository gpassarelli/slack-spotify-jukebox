import { App } from '@slack/bolt';
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

const app = new App({
  token: config.slackBotToken,
  signingSecret: config.slackSigningSecret
});

app.message(async ({ message, say, logger }) => {
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

(async () => {
  await app.start(process.env.PORT || 3000);
  // eslint-disable-next-line no-console
  console.log('⚡️ Slack Spotify Jukebox is running!');
})();
