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

- Simple message command (`play <song name>` by default)
- Optional single-channel lock (only listen in one Slack channel)
- Friendly confirmation/error replies

## Prerequisites

- Node.js 20+
- A Slack app with bot token + event subscriptions
- A Spotify app with API credentials and a refresh token

## Slack setup

1. Create a Slack app at https://api.slack.com/apps.
2. Enable **Socket Mode** _or_ Events over HTTP (this app defaults to HTTP with Bolt `app.start`).
3. Under **OAuth & Permissions**, add bot scopes:
   - `app_mentions:read` (optional)
   - `channels:history` (or equivalent for your channel type)
   - `chat:write`
4. Install the app to your workspace and copy the **Bot User OAuth Token**.
5. Under **Event Subscriptions**, enable events and add `message.channels` (and/or relevant message events for private channels/DMs).
6. Point Request URL to your deployed bot URL (for local dev, use something like ngrok).

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

## Install and run

```bash
npm install
npm start
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
- For production, deploy to a public HTTPS endpoint reachable by Slack.
