# Copilot Instructions for Slack Spotify Jukebox

## Build, Test, and Lint Commands

- **Start the app**: `npm start` (starts Express server on port 3000 by default)
- **Run with debugger**: `npm run dev` (starts server with Node inspector on port 9229)
- **Run all tests**: `npm test` (uses Node.js built-in test runner)
- **Run single test file**: `node --test test/message-parser.test.js`
- **Install dependencies**: `npm install` (or `yarn install`, both supported)

### VS Code Debugging

Three launch configurations are available in `.vscode/launch.json`:

1. **Debug Jukebox Server**: Launches the full app with debugger attached
   - Reads `.env` file for configuration
   - Sets `START_HTTP_SERVER=true` automatically
   - Use F5 to start or select from Run and Debug panel

2. **Debug Tests**: Runs all tests with debugger attached
   - Set breakpoints in test files or source code
   - Step through test execution

3. **Debug Single Test File**: Debugs the currently open test file
   - Open a test file and press F5
   - Useful for focusing on specific test cases

## Architecture Overview

This is a Slack bot that integrates with Spotify to add songs to a playlist. It has two deployment modes:

### Dual Deployment Architecture

1. **Local/Standard Express Server** (`src/index.js`):
   - Direct HTTP server for local development
   - Exports `expressApp` for use in Netlify wrapper
   - Only starts server when `START_HTTP_SERVER=true` is set

2. **Netlify Serverless Function** (`netlify/functions/app.js`):
   - Wraps the same Express app with `serverless-http`
   - Configured with `basePath: '/.netlify/functions/app'`
   - Uses `netlify.toml` to redirect root (`/`) to function endpoint
   - All routes must account for this base path in production

### Key Integration Points

- **Slack Bolt** (`@slack/bolt`): 
  - All setup in `src/slack.js`
  - `createSlackApp()` creates ExpressReceiver with custom endpoints (`/slack/events`, `/slack/commands`)
  - `registerSlackHandlers()` attaches message and slash command handlers
  - Both `/play` and custom prefix slash commands are supported (e.g., if `JUKEBOX_COMMAND_PREFIX=queue`, then `/queue` is also registered)
  - Handlers use `spotifyApi` and `config` passed as parameters

- **Spotify API** (`@spotify/web-api-ts-sdk`):
  - All logic in `src/spotify.js`
  - Uses custom auth strategy with refresh token (stored as env var)
  - Auth strategy automatically refreshes access token on demand
  - Search uses `spotifyApi.search(query, ['track'], market, limit)`
  - Playlist operations use `spotifyApi.playlists.*` methods

### Module Organization

- **`src/config.js`**: Centralized configuration with env var validation
- **`src/logger.js`**: Shared logging utilities (`logInfo`, `logError`)
- **`src/message-parser.js`**: Command prefix parsing logic
- **`src/slack.js`**: All Slack Bolt logic (app creation, message handlers, slash command handlers, OAuth URL building)
- **`src/spotify.js`**: All Spotify API interactions (search, playlist modification, OAuth, token management)
- **`src/index.js`**: Express HTTP routes and server startup only
- **`netlify/functions/app.js`**: Serverless wrapper for Netlify deployment

### Message Flow

1. User sends Slack message: `play <song name>` or uses slash command `/play <song name>`
2. Slack Bolt handlers in `src/slack.js` receive the event
3. `extractSongQuery()` (in `message-parser.js`) parses and validates the command prefix
4. Optional channel filter: only `JUKEBOX_CHANNEL_ID` can submit (if configured)
5. `addSongToPlaylist()` (in `spotify.js`) refreshes Spotify token, searches for track (top result only), adds to playlist
6. Bot replies with confirmation or error message

### Separation of Concerns

- **`index.js`**: Pure HTTP layer - Express routes for OAuth callbacks, health checks, and static pages. No business logic.
- **`slack.js`**: Slack Bolt app setup and all event/command handlers. Orchestrates calls to Spotify module.
- **`spotify.js`**: Spotify API client and all music-related operations. Self-contained with its own logging.

## Key Conventions

### Configuration Management

All configuration is centralized in `src/config.js`:
- Required env vars are validated at startup (throws if missing)
- Config object uses camelCase keys (e.g., `slackBotToken`, not `SLACK_BOT_TOKEN`)
- Always access config via the exported object, never directly from `process.env` in other modules

### Logging Pattern

Uses structured logging with `logInfo()` and `logError()` functions from `src/logger.js`:
- First parameter is a dot-separated event name (e.g., `'slack.message.received'`, `'spotify.add_song.not_found'`)
- Second parameter is context object with relevant data
- For errors, third parameter is additional context, error object is second
- All logs are prefixed with `[jukebox]` for filtering
- Import from `logger.js` in any module that needs logging

Example:
```javascript
import { logInfo, logError } from './logger.js';

logInfo('spotify.add_song.start', { songQuery, market: config.spotifyMarket });
logError('slack.message.failed', error, { channel: message.channel, songQuery });
```

### OAuth Flow Pattern

Both Slack and Spotify use similar OAuth patterns:
1. Login route (`/spotify/login`, `/slack/install`) generates state UUID and redirects to authorize URL
2. Callback route (`/spotify/oauth/callback`, `/slack/oauth/callback`) receives code
3. For Spotify: Exchange code for tokens and display refresh token to user (must be manually copied to env)
4. For Slack: Display code to user (automated token exchange not implemented)

### Command Prefix Handling

- Message commands: case-insensitive prefix match with `extractSongQuery()` in `message-parser.js`
- Slash commands: both `/play` (hardcoded) and custom prefix are registered as slash commands
- Slash commands accept full query as `command.text`, no prefix stripping needed
- Channel restrictions apply to both message and slash commands

### Spotify Business Logic

All Spotify operations are in `src/spotify.js`:
- Uses official Spotify TypeScript SDK (`@spotify/web-api-ts-sdk`)
- `createSpotifyClient()` creates client with custom auth strategy that auto-refreshes tokens
- `addSongToPlaylist()` is the main entry point that handles the full workflow (search, playlist add, logging)
- Lower-level functions (`findTrack`, `addTrackToPlaylist`) wrap SDK methods
- Token refresh is handled automatically by the SDK's auth strategy
- This module handles its own logging via imported `logInfo` from `logger.js`

### Slack Handler Pattern

All Slack event handlers are in `src/slack.js`:
- `createSlackApp()` initializes the Bolt app with ExpressReceiver
- `registerSlackHandlers()` sets up message and slash command handlers with access to `spotifyApi` and `config`
- Handlers are closures that capture dependencies, making them testable and modular
- The receiver's Express router is exposed to `index.js` for integration

### Testing Conventions

- Uses Node.js built-in test runner (`node:test`)
- Test files mirror source structure: `test/message-parser.test.js` tests `src/message-parser.js`
- Tests use `node:assert/strict` for assertions
- Use `test()` function, not `describe()`/`it()`
- Tests are primarily unit tests for pure functions (message parsing, URL building)

### Netlify-Specific Considerations

- Front page HTML includes client-side JavaScript to detect `.netlify.app` hostname and rewrite URLs with `/.netlify/functions/app` prefix
- When testing Netlify deployment, ensure all Slack/Spotify redirect URIs include the function base path
- The Express receiver in Bolt must not duplicate the base path in route definitions

### Development Environment Setup

- The app can start WITHOUT `SPOTIFY_REFRESH_TOKEN` to allow completing OAuth flow
- If no refresh token: Spotify client is not initialized, Slack handlers are not registered
- OAuth routes (`/spotify/login`, `/spotify/oauth/callback`) work without refresh token
- After OAuth: User manually copies refresh token to `.env` and restarts app
- With refresh token: Full functionality is enabled (Slack handlers, song requests)
- The `.vscode/launch.json` configuration sets this automatically
- For manual debugging: `START_HTTP_SERVER=true node --inspect src/index.js` then attach Chrome DevTools or VS Code to port 9229

### Bootstrap Flow

1. **First Startup** (no refresh token):
   - App starts successfully
   - Spotify client NOT created (logged as `spotify.client.skipped`)
   - Slack handlers NOT registered
   - Only OAuth routes are functional
   - Home page shows "⚠️ Spotify not connected yet"

2. **Complete OAuth**:
   - User visits `/spotify/login`
   - Completes Spotify authorization
   - Gets refresh token on callback page
   - Adds token to `.env` file
   - Restarts app

3. **Subsequent Startups** (with refresh token):
   - App starts successfully
   - Spotify client created with auto-refresh strategy
   - Slack handlers registered
   - Full song-request functionality enabled
   - Home page shows "✓ Spotify is connected and ready!"
