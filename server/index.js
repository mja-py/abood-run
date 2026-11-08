// Abood Run room server: introduces two players' browsers to each other (PeerJS signalling) and hands out
// short-lived Cloudflare TURN credentials for networks that block direct play. The race itself never passes
// through here.
//
// Privacy: no request or connection logging. The peer server keeps each connected player's id and socket in
// memory only while they are connected (and drops it about 90 s after they go quiet). Nothing is written to disk.
import http from 'node:http';
import express from 'express';
import { ExpressPeerServer } from 'peer';
import { WebSocketServer } from 'ws';

const PORT = Number(process.env.PORT) || 9000;
// Pages that may use this server. Browsers always send Origin on WebSockets and cross-site fetches.
const ORIGINS = (process.env.ALLOWED_ORIGINS || 'https://mja-py.github.io').split(',').map(s => s.trim()).filter(Boolean);
const LOCAL = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/; // local testing (python3 -m http.server)
const originOk = o => !!o && (ORIGINS.includes(o) || (process.env.ALLOW_LOCALHOST !== '0' && LOCAL.test(o)));

// Only ids the game uses: a room code (abood-run-vN-123456) or a guest id the server itself generated (a UUID).
const ID_OK = /^(abood-run-v\d{1,2}-\d{6}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;
const KEY = 'abood';

const app = express();
app.disable('x-powered-by');
const server = http.createServer(app);

app.get('/', (req, res) => res.type('text').send('Abood Run room server'));
app.get('/health', (req, res) => { res.set('Access-Control-Allow-Origin', '*'); res.set('Cache-Control', 'no-store'); res.type('text').send('ok'); });

// Short-lived TURN credentials. The Cloudflare TURN key and API token stay here (Render environment variables);
// the page only ever sees credentials that expire after TURN_TTL seconds. One set is shared for a few minutes so a
// busy afternoon doesn't mean one Cloudflare call per player.
const TURN_ID = process.env.TURN_KEY_ID, TURN_TOKEN = process.env.TURN_KEY_API_TOKEN;
const TURN_TTL = Math.max(600, Number(process.env.TURN_TTL) || 6 * 3600);
const REUSE = 10 * 60 * 1000;
let turnCache = null, turnAt = 0, turnBusy = null;
async function freshTurn() {
  const r = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(TURN_ID)}/credentials/generate-ice-servers`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TURN_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ttl: TURN_TTL }),
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error('cloudflare ' + r.status);
  const j = await r.json();
  const list = Array.isArray(j.iceServers) ? j.iceServers : [j.iceServers];
  // keep only the relay entries (the game has its own STUN) and drop port 53, which browsers block
  const iceServers = list.filter(s => s && s.username && s.credential).map(s => ({
    urls: [].concat(s.urls).filter(u => typeof u === 'string' && !/:53(\?|$)/.test(u)),
    username: s.username, credential: s.credential,
  })).filter(s => s.urls.length);
  if (!iceServers.length) throw new Error('no turn urls');
  return iceServers;
}
app.get('/turn', async (req, res) => {
  const o = req.get('origin');
  res.set('Cache-Control', 'no-store'); res.set('Vary', 'Origin');
  if (!originOk(o)) { res.status(403).json({ error: 'origin' }); return; }
  res.set('Access-Control-Allow-Origin', o);
  if (!TURN_ID || !TURN_TOKEN) { res.status(503).json({ error: 'turn not set up' }); return; }
  try {
    if (!turnCache || Date.now() - turnAt > REUSE) {
      turnBusy = turnBusy || freshTurn().then(s => { turnCache = s; turnAt = Date.now(); }).finally(() => { turnBusy = null; });
      await turnBusy;
    }
    // how long the credentials still have, so the page knows when to ask again
    res.json({ iceServers: turnCache, ttl: Math.floor(TURN_TTL - (Date.now() - turnAt) / 1000) });
  } catch (e) {
    res.status(502).json({ error: 'turn unavailable' });
  }
});

// Signalling. Mounted at /race, so the client uses path '/race/' and the WebSocket lives at /race/peerjs.
const peer = ExpressPeerServer(server, {
  path: '/',
  key: KEY,
  proxied: true, // Render sits in front of us
  allow_discovery: false, // never list who is connected
  alive_timeout: 90000,
  concurrent_limit: 2000,
  corsOptions: { origin: (o, cb) => cb(null, !o || originOk(o)) },
  createWebSocketServer: opts => new WebSocketServer({
    ...opts,
    maxPayload: 64 * 1024, // offers and answers are a few KB
    verifyClient: ({ origin, req }) => {
      if (!originOk(origin)) return false;
      const id = new URL(req.url || '', 'https://x').searchParams.get('id') || '';
      return ID_OK.test(id);
    },
  }),
});
peer.on('error', () => {}); // a bad socket must not crash the server; nothing is logged
app.use('/race', peer);

server.listen(PORT, () => console.log('Abood Run room server listening on port ' + PORT));
