# Fairway FC

Football trivia footgolf: rarer answers kick further. Daily round, quick and full rounds, theme and speed rounds,
pass & play, match play, online rooms, badges, streaks and a shared leaderboard.

## Layout

- `site/questions.js` is the question bank. **Edit this to refresh questions.** Players load it from GitHub via
  jsDelivr, and Netlify skips deploying when only this file changes, so question updates cost no Netlify credits.
  Allow up to 12 hours for the CDN to pick up a change.
- `src/head.html` and `src/game.js` are the game. After editing them run `python3 tools/build.py`, which rebuilds
  `site/index.html`. Changes here do trigger a Netlify deploy (15 credits).
- `site/voice/` holds the pre-recorded commentary (Piper "Alan" voice). A line plays from a clip when its text
  matches exactly; any other line falls back to the phone's own voice.
- `netlify/functions/board.mts` is the leaderboard API (`/api/board`, today, this week, all time).
- `netlify/functions/room.mts` is the online rooms API (`/api/room`).
