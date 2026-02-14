# Debugging Guide

This guide explains how to debug the Slack Spotify Jukebox application.

## VS Code Debugging

### Quick Start

1. Open the project in VS Code
2. Press **F5** or go to **Run and Debug** (Ctrl/Cmd+Shift+D)
3. Select "Debug Jukebox Server" from the dropdown
4. Set breakpoints by clicking left of line numbers
5. Use debug controls to step through code

### Available Configurations

#### 1. Debug Jukebox Server
Runs the full application with debugger attached.

- **When to use**: Debugging server startup, HTTP routes, Slack event handlers
- **Environment**: Automatically loads `.env` file and sets `START_HTTP_SERVER=true`
- **Port**: Server runs on port 3000 (or `PORT` from `.env`)
- **Debugger**: Attaches to Node.js inspector

**Common breakpoint locations:**
- `src/slack.js` line ~45: Message event handler
- `src/slack.js` line ~89: Slash command handler  
- `src/spotify.js` line ~75: Add song to playlist function
- `src/index.js` line ~100: OAuth callback routes

#### 2. Debug Tests
Runs all tests with debugger attached.

- **When to use**: Debugging test failures or understanding test behavior
- **Run**: Set breakpoints in test files, then press F5

#### 3. Debug Single Test File
Debugs only the currently open test file.

- **When to use**: Focusing on a specific test suite
- **Run**: Open a test file (e.g., `test/message-parser.test.js`), then press F5

## Command Line Debugging

### Using npm script

```bash
npm run dev
```

This starts the server with Node.js inspector on port 9229. You can:

1. **Chrome DevTools**: Open `chrome://inspect` in Chrome, click "inspect"
2. **VS Code**: Use "Attach to Node Process" configuration
3. **WebStorm/IntelliJ**: Use "Attach to Node.js/Chrome" configuration

### Manual debugging

```bash
# Start with inspector
START_HTTP_SERVER=true node --inspect src/index.js

# Start with inspector, break on first line
START_HTTP_SERVER=true node --inspect-brk src/index.js

# Use custom port
START_HTTP_SERVER=true node --inspect=0.0.0.0:9230 src/index.js
```

## Common Debugging Scenarios

### Debugging Slack Message Events

1. Set breakpoint in `src/slack.js` at line ~45 (message handler)
2. Start debugger
3. Send a message in Slack channel: `play test song`
4. Debugger pauses at your breakpoint
5. Inspect `message.text`, `config`, etc.

### Debugging Spotify API Calls

1. Set breakpoint in `src/spotify.js` at `addSongToPlaylist` function (line ~101)
2. Start debugger  
3. Trigger a song request
4. Step through search and playlist add operations
5. The SDK automatically handles token refresh via the custom auth strategy

### Debugging OAuth Flows

1. Set breakpoint in `src/index.js` at OAuth callback routes
2. Start debugger
3. Open browser to `http://localhost:3000`
4. Click "Login with Spotify"
5. Debugger pauses when Spotify redirects back

## Tips

- **Skip Node.js internals**: Breakpoints in `node_modules` are skipped automatically
- **Console output**: All logs appear in the integrated terminal
- **Hot reload**: Not enabled - restart debugger after code changes
- **Environment variables**: Edit `.env` file, then restart debugger

## Troubleshooting

### Debugger won't attach
- Check if port 3000 or 9229 are already in use
- Kill existing Node processes: `ps aux | grep node`

### Breakpoints not hitting
- Ensure `START_HTTP_SERVER=true` is set
- Check if code path is actually executed
- Verify source maps are working (ES modules don't need them)

### Missing environment variables
- Ensure `.env` file exists with required variables
- Check `.env.example` for reference
- Debug configuration automatically loads `.env`
