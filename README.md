# Fairway FC

Live: https://fairway-fc.djjacksprigg.workers.dev (Cloudflare). The old Netlify site no longer rebuilds.


Football trivia footgolf: rarer answers kick further. Daily round, quick and full rounds, theme and speed rounds,
pass & play, match play, online rooms, badges and streaks, with sharing to social apps (no public leaderboard).

## Layout

- `site/questions.js` is the question bank. **Edit this to refresh questions.** Players load it from GitHub via
  jsDelivr, and Netlify skips deploying when only this file changes, so question updates cost no Netlify credits.
  Allow up to 12 hours for the CDN to pick up a change.
- `src/head.html` and `src/game.js` are the game. After editing them run `python3 tools/build.py`, which rebuilds
  `site/index.html`. Changes here do trigger a Netlify deploy (15 credits).
- `site/voice/` holds the pre-recorded commentary (Piper "Alan" voice). A line plays from a clip when its text
  matches exactly; any other line falls back to the phone's own voice.
- `netlify/functions/room-cleanup.mts` runs daily: clears old room entries (and any leftover data from the removed leaderboard).
- `netlify/functions/room.mts` is the online rooms API (`/api/room`).

## Hosting (Cloudflare)

- `wrangler.jsonc` configures the Cloudflare Worker: static files from `site/`, and `cloudflare/worker.js` for `/api/room`.
- `/api/news` (also in `cloudflare/worker.js`) feeds the home-screen ticker: the BBC Sport football RSS headlines, cached for 15 minutes.
  If the feed is down the ticker falls back to game tips.
- Each online room is a Durable Object holding players in memory only (nothing saved to disk).
- `site/_headers` sets the security headers and caching.
- `netlify/` and `netlify.toml` are left from the old Netlify hosting; Netlify builds are switched off (`ignore = "exit 0"`).
