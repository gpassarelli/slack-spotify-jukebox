# First Time Setup Guide

## Prerequisites

Before you begin, you need:
1. A Slack workspace where you have permissions to add apps
2. A Spotify account
3. Node.js 20+ installed

## Step 1: Create Slack App

1. Go to https://api.slack.com/apps
2. Click "Create New App" → "From scratch"
3. Give it a name (e.g., "Spotify Jukebox") and select your workspace
4. Under **OAuth & Permissions**, add bot scopes:
   - `channels:history` (to read messages)
   - `chat:write` (to post responses)
5. Install the app to your workspace
6. Copy the **Bot User OAuth Token** (starts with `xoxb-`)
7. Copy the **Signing Secret** from "Basic Information"

## Step 2: Create Spotify App

1. Go to https://developer.spotify.com/dashboard
2. Click "Create app"
3. Fill in the details:
   - App name: "Slack Jukebox"
   - Redirect URI: `http://localhost:3000/spotify/oauth/callback`
4. Copy your **Client ID** and **Client Secret**

## Step 3: Get Playlist ID

1. Open Spotify and go to the playlist you want to use
2. Click "Share" → "Copy link to playlist"
3. Extract the ID from the URL:
   - URL: `https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M`
   - ID: `37i9dQZF1DXcBWIGoYBM5M` (everything after `/playlist/`)

## Step 4: Configure Environment

1. Clone this repository
2. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

3. Edit `.env` and fill in the values:
   ```bash
   SLACK_BOT_TOKEN=xoxb-your-token-here
   SLACK_SIGNING_SECRET=your-signing-secret-here
   
   SPOTIFY_CLIENT_ID=your-client-id-here
   SPOTIFY_CLIENT_SECRET=your-client-secret-here
   SPOTIFY_PLAYLIST_ID=your-playlist-id-here
   SPOTIFY_REDIRECT_URI=http://localhost:3000/spotify/oauth/callback
   
   # Leave SPOTIFY_REFRESH_TOKEN empty for now - we'll get it next
   
   START_HTTP_SERVER=true
   PORT=3000
   ```

4. Install dependencies:
   ```bash
   npm install
   ```

## Step 5: Get Spotify Refresh Token

This is a one-time setup to connect your Spotify account:

1. Start the app:
   ```bash
   npm start
   ```

2. Open your browser to `http://localhost:3000`

3. You should see the Jukebox home page with a warning that Spotify is not connected

4. Click **"Login with Spotify"**

5. Approve the permissions (the app needs to modify your playlists)

6. You'll be redirected back to a page showing your **refresh token**

7. Copy the refresh token

8. Stop the app (Ctrl+C)

9. Edit `.env` and add the refresh token:
   ```bash
   SPOTIFY_REFRESH_TOKEN=AQD...your-long-token-here
   ```

10. Start the app again:
    ```bash
    npm start
    ```

11. Open `http://localhost:3000` - you should now see "✓ Spotify is connected and ready!"

## Step 6: Configure Slack Events

Now we need to tell Slack where to send events:

1. If testing locally, use a tunnel service like ngrok:
   ```bash
   ngrok http 3000
   ```
   Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)

2. In your Slack app settings, go to **Event Subscriptions**

3. Enable events and set Request URL to:
   ```
   https://your-ngrok-url.ngrok.io/slack/events
   ```

4. Under "Subscribe to bot events", add:
   - `message.channels` (for public channels)
   - Or `message.groups` for private channels
   - Or `message.im` for DMs

5. Save changes

6. Reinstall the app to your workspace (Slack will prompt you)

## Step 7: Optional - Slash Command

To use `/play` as a slash command:

1. In Slack app settings, go to **Slash Commands**

2. Click "Create New Command"

3. Set:
   - Command: `/play`
   - Request URL: `https://your-ngrok-url.ngrok.io/slack/commands`
   - Short description: "Add a song to the jukebox"
   - Usage hint: `bohemian rhapsody queen`

4. Save

## Step 8: Test It!

1. In your Slack workspace, go to a channel where the bot is a member

2. Send a message:
   ```
   play never gonna give you up
   ```

3. The bot should respond with:
   ```
   Added *Never Gonna Give You Up — Rick Astley* to the jukebox playlist 🎵
   ```

4. Check your Spotify playlist - the song should be there!

## Troubleshooting

### "Spotify account is not connected yet"
- Make sure you completed Step 5 and set `SPOTIFY_REFRESH_TOKEN` in `.env`
- Restart the app after updating `.env`

### "Missing required environment variables"
- Double-check all required variables in `.env`
- Make sure there are no extra spaces or quotes

### Bot doesn't respond to messages
- Check that the bot is added to the channel
- Verify Event Subscriptions are configured correctly
- Check the app logs for errors

### OAuth redirect fails
- Make sure the redirect URI in Spotify dashboard matches exactly
- For local development: `http://localhost:3000/spotify/oauth/callback`
- For production: update to your production URL

## Next Steps

- Deploy to Netlify or other hosting (see README.md)
- Restrict to specific channel with `JUKEBOX_CHANNEL_ID`
- Customize command prefix with `JUKEBOX_COMMAND_PREFIX`
