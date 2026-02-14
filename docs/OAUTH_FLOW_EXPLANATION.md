# OAuth Flow Explanation

## How It Works with @spotify/web-api-ts-sdk

### Important Note
The `@spotify/web-api-ts-sdk` is primarily designed for browser-based apps with PKCE. For server-side OAuth (Authorization Code Flow), we handle the token exchange manually.

### Why Manual Token Exchange?

The SDK doesn't provide built-in methods for server-side authorization code exchange because:
1. It requires client secret (should never be exposed to browsers)
2. Server-side apps have different security requirements
3. The SDK focuses on client-side (PKCE) and client credentials flows

### Our Implementation

1. **OAuth Initiation** (`/spotify/login`):
   - Redirect user to Spotify authorization page
   - Built with `buildSpotifyAuthorizeUrl()` helper

2. **Token Exchange** (`/spotify/oauth/callback`):
   - Manually call `https://accounts.spotify.com/api/token`
   - Use Basic Auth with client_id:client_secret
   - Exchange authorization code for access_token and refresh_token
   - This is in `exchangeCodeForTokens()` function

3. **SDK Usage** (after setup):
   - Create SDK client with custom auth strategy
   - Auth strategy uses refresh_token to get new access_tokens automatically
   - SDK handles token refresh transparently on API calls

### The Flow:

```
User clicks "Login with Spotify"
  ↓
Redirect to Spotify authorization page
  ↓
User approves
  ↓
Spotify redirects back with code
  ↓
exchangeCodeForTokens() - Manual HTTP call to get tokens
  ↓
Display refresh_token to user
  ↓
User sets SPOTIFY_REFRESH_TOKEN env var
  ↓
createSpotifyClient() creates SDK with auth strategy
  ↓
Auth strategy automatically refreshes tokens when needed
```

### Key Functions:

- `buildSpotifyAuthorizeUrl()` - Generate authorization URL
- `exchangeCodeForTokens()` - Exchange code for tokens (manual)
- `createSpotifyClient()` - Create SDK with auto-refresh strategy
- `addSongToPlaylist()` - Use SDK to interact with Spotify API

### Testing

The OAuth exchange endpoint still uses the standard Spotify endpoint:
- `POST https://accounts.spotify.com/api/token`
- Grant type: `authorization_code`
- Requires: code, redirect_uri, client credentials

This is the same endpoint used by all Spotify OAuth implementations and hasn't changed.
