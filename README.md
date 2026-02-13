# Slack Spotify Jukebox

A Slack bot that turns a channel into a Spotify-powered jukebox.

When someone sends a message like:

```text
play bohemian rhapsody queen
```

the bot will:
1. Search Spotify for the song.
2. Take the top result.
3. Add it to your configured Spotify playlist.

## Features

- HTTP-based Slack Events API receiver (Express)
- Simple message command (`play <song name>` by default)
- Optional single-channel lock (only listen in one Slack channel)
- Friendly confirmation/error replies

## Prerequisites

- Node.js 20+
- A Slack app with bot token + event subscriptions
- A Spotify app with API credentials and a refresh token

## Slack setup

1. Create a Slack app at https://api.slack.com/apps.
2. Under **OAuth & Permissions**, add bot scopes:
   - `channels:history` (or equivalent for your channel type)
   - `chat:write`
3. Install the app to your workspace and copy the **Bot User OAuth Token**.
4. Under **Event Subscriptions**, enable events and add `message.channels` (and/or relevant message events for private channels/DMs).
5. Set your Slack Request URL to:
   - Local dev: `https://<your-tunnel-domain>/slack/events`
   - Netlify: `https://<your-site>.netlify.app/.netlify/functions/slack-events/slack/events`

## Spotify setup

1. Create an app at https://developer.spotify.com/dashboard.
2. Collect:
   - Client ID
   - Client Secret
3. Generate a refresh token with playlist-modify scope (e.g. `playlist-modify-public` and/or `playlist-modify-private`).
4. Create or choose the playlist that will act as the jukebox queue and copy its playlist ID.

## Configuration

Create a `.env` file (or set env vars in your host):

```bash
SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=...

SPOTIFY_CLIENT_ID=...
SPOTIFY_CLIENT_SECRET=...
SPOTIFY_REFRESH_TOKEN=...
SPOTIFY_PLAYLIST_ID=...

# Optional
JUKEBOX_COMMAND_PREFIX=play
JUKEBOX_CHANNEL_ID=C0123456789
SPOTIFY_MARKET=US
PORT=3000
```

## Local development (Express HTTP server)

```bash
npm install
npm start
```

This starts an Express server and registers Slack events at `POST /slack/events`.

## Netlify deployment

This repo includes a Netlify Function wrapper at `netlify/functions/slack-events.js` that serves the same Express app.

- Deploy to Netlify.
- Configure the same environment variables in Netlify site settings.
- Use this as your Slack Events Request URL:

```text
https://<your-site>.netlify.app/.netlify/functions/slack-events/slack/events
```

## How users interact

By default, users add songs by sending:

```text
play song title artist
```

You can change `play` to another prefix using `JUKEBOX_COMMAND_PREFIX`.

## Development checks

```bash
npm test
```

## Notes

- The bot intentionally ignores messages that do not start with the configured command prefix.
- If `JUKEBOX_CHANNEL_ID` is set, only that channel can submit songs.
