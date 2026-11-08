# Abood Run room server

A small Node server for online races. It does two jobs:

- **Introduces players.** It runs [PeerServer](https://github.com/peers/peerjs-server) at `/race/` so two browsers can find each other by room code. The race itself goes directly between the browsers, never through here.
- **Hands out relay credentials.** `GET /turn` returns Cloudflare TURN credentials that expire after 6 hours (`TURN_TTL`). The Cloudflare key stays in this server's settings; one set of credentials is reused for 10 minutes.

GitHub Pages doesn't publish this folder; the deploy workflow copies only the game files.

## Privacy

- No request or connection logs. The only line printed is "listening on port …" at start-up.
- Each connected player's id and connection stay in memory only while they are connected (and up to 90 s after they go quiet), then they are gone. Nothing is written to disk.
- `allow_discovery` is off, so nobody can list who is connected.
- Only the game's own ids are accepted: room codes (`abood-run-v2-123456`) and the random guest ids this server makes itself.
- Only pages from `ALLOWED_ORIGINS` (default `https://mja-py.github.io`) can connect or get relay credentials.
- Render shows request logs only on paid workspaces. Those logs record method, path and status, not the game's data.

## Set it up (about 15 minutes, free)

### 1. Cloudflare TURN key

1. Sign up or sign in at https://dash.cloudflare.com (free account).
2. Open **Realtime** (in older dashboards it is **Calls**), then **TURN Server**, then **Create**. Give it a name such as `abood-run`.
3. Copy the two values it shows: the **Turn Token ID** and the **API Token**. The token is shown only once.

Cost: Cloudflare charges $0.05 per GB relayed, and only for players whose network blocks direct play. A race sends small position messages (a few KB per second), so even hundreds of relayed races come to well under one GB. You can skip this step: without the key, the game uses the PeerJS relay for those players.

### 2. Render

1. Sign up at https://render.com with your GitHub account.
2. **New > Blueprint**, pick the `mja-py/abood-run` repository, and confirm the `render.yaml` it finds. It creates a free web service called `abood-run-race`.
3. When asked, paste the **Turn Token ID** into `TURN_KEY_ID` and the **API Token** into `TURN_KEY_API_TOKEN`.
4. Wait for the first deploy, then open `https://abood-run-race.onrender.com/health`. It should say `ok`.

If Render gives the service a different address (for example `abood-run-race-x1y2.onrender.com`), put that address in `OWN_URL` at the top of `js/net.js`.

The free plan sleeps after 15 minutes without players and takes about a minute to wake. The game wakes it when the race screen opens. While it wakes, the loading screen says the server is waking up. If it answers with an error, or not within 55 seconds, that room uses the public PeerJS server instead. 750 free hours a month is enough to keep one service running all month.

## Settings

| Variable | Default | What it does |
| --- | --- | --- |
| `PORT` | 9000 | Port (Render sets it). |
| `ALLOWED_ORIGINS` | `https://mja-py.github.io` | Comma-separated pages allowed to use the server. |
| `ALLOW_LOCALHOST` | on | Also allow `http://localhost` and `http://127.0.0.1` pages. `render.yaml` turns it off. |
| `TURN_KEY_ID`, `TURN_KEY_API_TOKEN` | none | Cloudflare TURN key. Without them `/turn` answers 503 and the game uses the PeerJS relay. |
| `TURN_TTL` | 21600 | How long relay credentials last, in seconds (at least 600). |

## Run it locally

```bash
cd server && npm ci && npm start
```

Then serve the game with `python3 -m http.server 8000` from the repo root and open `http://localhost:8000/?peer=http://localhost:9000`. For a second player with separate saved data, use `http://127.0.0.1:8000/?peer=http://127.0.0.1:9000` in another tab. The `?peer=` override works only on localhost pages.
