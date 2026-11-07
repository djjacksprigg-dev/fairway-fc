# Fairway FC

Football trivia golf: a 3D daily round, pass-and-play, online rooms and a shared leaderboard.

- `site/` is the game (one page plus a local copy of three.js).
- `netlify/functions/board.mts` is the daily and all-time leaderboard (`/api/board`).
- `netlify/functions/room.mts` is the online rooms (`/api/room`).
- Scores and rooms are stored in Netlify Blobs, which needs no setup.

## Deploy

From this folder:

    npx netlify-cli deploy --prod

The first run asks you to log in and to create a new site. Pick a name such as `fairway-fc`.
