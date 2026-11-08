// Online race with a friend. One player creates a room and gets a 6-digit code; the friend types the code to join. The
// two browsers then talk directly over WebRTC (PeerJS). Our own room server (server/ in this repo) only introduces
// them, and hands out short-lived credentials for the Cloudflare TURN relay used on networks that block direct play.
// If our server can't be reached, the free public PeerJS server and its relay take over. Nothing touches the network
// until a player opens "Race a friend". No chat: the game only sends its own small messages (hello, start, position,
// result).
//
// Which server a room is on is in its code: codes starting 1-8 live on our server, codes starting 9 on the public
// PeerJS fallback. The friend's game reads the first digit and asks the right server, so it never has to try both
// (and can never land in a stranger's room on the other server).
//
// Dropped connections: both sides send a heartbeat every second and treat 5 s of silence as a drop. The joining
// player then keeps trying to reconnect to the same code; the host keeps the room open. The game decides what a
// returning player means (see the race section in game.js).
export const PROTO = 4;
const PFX = 'abood-run-v2-';
const LIB = new URL('./vendor/peerjs.min.js', import.meta.url).href;
const BEAT = 1000, SILENT = 5000, RETRY = 2500, WAIT = 75000; // WAIT: give a slow (waking) server up to 75 s
// Our room server. On a local copy of the game (localhost) ?peer=http://localhost:9000 points it at a local server.
const OWN_URL = 'https://abood-run-race.onrender.com';
const OWN_PATH = '/race/', OWN_KEY = 'abood';
// Render's free plan sleeps when idle and takes about a minute to wake. While it wakes, the request just waits, so a
// slow answer means "waking" and the host keeps waiting (the lobby says so); an error or no answer in WAKE means
// "down", and the room opens on the public server instead.
const WAKE = 55000;
function ownBase() {
  const local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  const q = local && new URLSearchParams(location.search).get('peer');
  if (q && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(q)) return new URL(q);
  return new URL(OWN_URL);
}
// Cloudflare's public STUN server tells each phone its own public address (instead of PeerJS's default, Google).
const STUN = { urls: 'stun:stun.cloudflare.com:3478' };
const PEERJS_TURN = { urls: ['turn:eu-0.turn.peerjs.com:3478', 'turn:us-0.turn.peerjs.com:3478'], username: 'peerjs', credential: 'peerjsp' };
const isOwnCode = c => c[0] !== '9';

// Wake our server (and find out whether it is there) as soon as the race screen opens, so it is ready by the time
// a player taps Create or Join. A good answer is reused for 5 minutes; a failed one is asked again next time.
let warmP = null, warmAt = 0;
export function warm() {
  if (warmP && Date.now() - warmAt < 5 * 60000) return warmP;
  warmAt = Date.now();
  const p = warmP = fetch(new URL('/health', ownBase()), { cache: 'no-store', credentials: 'omit', signal: AbortSignal.timeout(WAKE) })
    .then(r => r.ok).catch(() => false)
    .then(ok => { if (!ok && warmP === p) warmP = null; return ok; });
  return p;
}
// Short-lived TURN credentials from our server (it keeps the Cloudflare key). Without them the PeerJS relay is used.
async function ownIce() {
  try {
    const r = await fetch(new URL('/turn', ownBase()), { cache: 'no-store', credentials: 'omit', signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error('turn');
    const j = await r.json();
    if (!Array.isArray(j.iceServers) || !j.iceServers.length) throw new Error('turn');
    return { list: [STUN, ...j.iceServers], ttl: Number(j.ttl) || 3600 };
  } catch (e) { return { list: [STUN, PEERJS_TURN], ttl: 0 }; }
}
async function optsFor(own) {
  if (!own) return { debug: 0, config: { iceServers: [STUN, PEERJS_TURN] } };
  const u = ownBase(), ice = await ownIce();
  const secure = u.protocol === 'https:';
  if (ice.ttl) iceRefresh(ice.ttl);
  return { debug: 0, host: u.hostname, port: Number(u.port) || (secure ? 443 : 80), path: OWN_PATH, key: OWN_KEY, secure, config: { iceServers: ice.list } };
}
// Ask for new credentials before the old ones run out, for connections made later (a reconnect after a long race day).
let iceT = 0;
function iceRefresh(ttl) {
  clearTimeout(iceT);
  iceT = setTimeout(async () => {
    const p = peer; if (!p || p.destroyed) return;
    const ice = await ownIce();
    if (peer !== p || !ice.ttl) return;
    p.options.config.iceServers = ice.list;
    try { const pc = conn && conn.peerConnection; if (pc) pc.setConfiguration({ ...pc.getConfiguration(), iceServers: ice.list }); } catch (e) {}
    iceRefresh(ice.ttl);
  }, Math.max(60, ttl * 0.75) * 1000);
}

let gen = 0; // bumped by leave(), so a slow start that finishes after the player left does nothing
let peer = null, conn = null, connPid = '', role = null, code = null, timer = 0, beat = 0, retryT = 0, lastRx = 0, lib = null, myPid = '';
const H = {};
export const on = (ev, fn) => { H[ev] = fn; };
const emit = (ev, d) => { try { H[ev] && H[ev](d); } catch (e) { console.error(e); } };

function loadLib() {
  if (window.Peer) return Promise.resolve();
  return lib || (lib = new Promise((ok, bad) => {
    const s = document.createElement('script'); s.src = LIB; s.async = true;
    s.onload = () => (window.Peer ? ok() : bad(new Error('lib')));
    s.onerror = () => { lib = null; s.remove(); bad(new Error('lib')); };
    document.head.appendChild(s);
  }));
}
const rnd = n => crypto.getRandomValues(new Uint32Array(1))[0] % n;
const newCode = own => String(own ? 100000 + rnd(800000) : 900000 + rnd(100000)); // see "Which server" above
export const cleanCode = s => String(s || '').replace(/\D/g, '').slice(0, 6);
export const showCode = c => (c && c.length === 6 ? c.slice(0, 3) + ' ' + c.slice(3) : c || '');
export const isOpen = () => !!(conn && conn.open);
export const getRole = () => role;
export const getCode = () => code;

function startBeat() {
  clearInterval(beat); lastRx = Date.now();
  beat = setInterval(() => {
    if (!conn) return;
    if (Date.now() - lastRx > SILENT) { drop(conn); return; } // the other side went quiet: count it as a drop
    send({ t: 'k' });
  }, BEAT);
}
function drop(c) {
  if (c !== conn) return;
  conn = null; connPid = ''; clearInterval(beat);
  try { c.close(); } catch (e) {}
  emit('lost');
  if (role === 'guest') scheduleRetry();
}
function wire(c, pid) {
  c.on('open', () => {
    // the host accepts a second connection only from the same player coming back (a stale one may still look open)
    if (conn && conn !== c && conn.open && pid !== connPid) { try { c.send({ t: 'full' }); } catch (e) {} setTimeout(() => c.close(), 300); return; }
    if (conn && conn !== c) { const old = conn; conn = null; try { old.close(); } catch (e) {} }
    conn = c; connPid = pid || ''; clearTimeout(timer); clearTimeout(retryT); startBeat(); emit('open');
  });
  c.on('data', d => { if (c !== conn) return; lastRx = Date.now(); if (d && typeof d.t === 'string' && d.t !== 'k') emit('data', d); });
  c.on('close', () => drop(c));
  c.on('error', () => drop(c));
}
function fail(why) { clearTimeout(timer); emit('error', why); leave(); }
const offlineErr = t => t === 'network' || t === 'server-error' || t === 'socket-error' || t === 'socket-closed';
function keepBroker(p) { p.on('disconnected', () => { if (peer === p && !p.destroyed) setTimeout(() => { try { if (peer === p && p.disconnected) p.reconnect(); } catch (e) {} }, 1500); }); }

// Host: register a 6-digit room code with the room server and wait for the friend. The code is the host's id on the
// server, and the server lets only one live peer hold an id, so two open rooms can never share a code: if the code is
// taken ('unavailable-id'), we pick a new one and try again. The code is freed when the host leaves.
// Our server is tried first; if it is down, the room opens on the public one.
export async function host(pid) {
  leave(); role = 'host'; myPid = pid; const me = ++gen;
  emit('stage', 'lib');
  try { await loadLib(); } catch (e) { fail('offline'); return; }
  if (gen !== me) return; // left while loading
  emit('stage', 'server');
  const t0 = Date.now(), arm = ms => { clearTimeout(timer); timer = setTimeout(() => { if (gen === me && !(peer && peer.open)) fail('timeout'); }, ms); };
  arm(WAIT);
  const own = await warm();
  if (gen !== me) return;
  const tryOpen = async (n, own) => {
    if (n) emit('stage', 'retry'); // that code was taken: try another
    const opts = await optsFor(own);
    if (gen !== me) return;
    code = newCode(own);
    const p = peer = new window.Peer(PFX + code, opts);
    keepBroker(p);
    p.on('open', () => { clearTimeout(timer); emit('hosting', { code }); });
    p.on('connection', c => wire(c, c.metadata && String(c.metadata.pid || '')));
    p.on('error', e => {
      if (peer !== p) return;
      if (e.type === 'unavailable-id' && n < 5) { try { p.destroy(); } catch (x) {} tryOpen(n + 1, own); return; }
      if (own && !p.open && offlineErr(e.type)) { try { p.destroy(); } catch (x) {} toPublic(); return; } // our server is down
      if (code && !offlineErr(e.type) && e.type !== 'unavailable-id') return; // per-connection trouble: the room stays open
      if (conn && conn.open) return; // the race keeps going if only the broker drops; keepBroker reconnects it
      if (!p.open) fail(offlineErr(e.type) ? 'offline' : 'error');
    });
  };
  // the public server gets whatever is left of WAIT, and at least 20 s
  const toPublic = () => { arm(Math.max(20000, WAIT - (Date.now() - t0))); tryOpen(0, false); };
  if (own) tryOpen(0, true); else toPublic();
}

// Guest: connect to the host's room code on the server its first digit names, and keep trying again after a drop.
export async function join(c, pid) {
  leave(); role = 'guest'; code = cleanCode(c); myPid = pid; const me = ++gen;
  if (code.length !== 6) { fail('badcode'); return; }
  emit('stage', 'lib');
  try { await loadLib(); } catch (e) { fail('offline'); return; }
  if (gen !== me) return; // left while loading
  emit('stage', 'server');
  timer = setTimeout(() => { if (!isOpen() && role === 'guest' && !retryT) fail('timeout'); }, WAIT);
  const opts = await optsFor(isOwnCode(code));
  if (gen !== me) return;
  const p = peer = new window.Peer(opts);
  keepBroker(p);
  p.on('open', () => { if (!isOpen()) emit('stage', 'peer'); connect(); });
  p.on('error', e => {
    if (peer !== p) return;
    if (retryT || (conn && conn.open)) { if (e.type === 'peer-unavailable' && !conn) scheduleRetry(); return; } // already reconnecting
    fail(e.type === 'peer-unavailable' ? 'noroom' : offlineErr(e.type) ? 'offline' : 'error');
  });
}
let pending = null;
function connect() {
  if (!peer || peer.destroyed) return;
  if (pending && pending !== conn && !pending.open) { try { pending.close(); } catch (e) {} } // drop the last attempt that never opened
  try { pending = peer.connect(PFX + code, { reliable: true, metadata: { pid: myPid } }); wire(pending, myPid); } catch (e) {}
}
function scheduleRetry() {
  clearTimeout(retryT);
  retryT = setTimeout(() => {
    retryT = 0; if (role !== 'guest' || !peer || isOpen()) return;
    try { if (peer.disconnected) peer.reconnect(); } catch (e) {}
    connect(); scheduleRetry(); // keep trying until the game gives up (leave) or a connection opens
  }, RETRY);
}

export function testDrop() { if (conn) { try { conn.close(); } catch (e) {} } } // testing: cut the connection without a goodbye
export function send(o) { if (conn && conn.open) { try { conn.send(o); } catch (e) {} } }
export function leave() {
  gen++; clearTimeout(iceT); clearTimeout(timer); clearTimeout(retryT); retryT = 0; clearInterval(beat);
  const c = conn, p = peer; conn = null; peer = null; role = null; code = null; connPid = '';
  if (c) { try { c.send({ t: 'bye' }); } catch (e) {} setTimeout(() => { try { c.close(); } catch (e) {} }, 150); }
  if (p) setTimeout(() => { try { p.destroy(); } catch (e) {} }, 200);
}
addEventListener('pagehide', () => { if (conn) { try { conn.send({ t: 'bye' }); } catch (e) {} } });
