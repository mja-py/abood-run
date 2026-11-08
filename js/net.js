// Online race with a friend. One player creates a room and gets a 6-digit code; the friend types the code to join. The two browsers then talk directly over WebRTC (PeerJS). The public PeerJS server only
// introduces them (and relays through its TURN servers on networks that block direct play), so the code works across
// different networks. Nothing touches the network until a player opens "Race a friend".
// No chat: the game only sends its own small messages (hello, start, position, result).
//
// Dropped connections: both sides send a heartbeat every second and treat 5 s of silence as a drop. The joining
// player then keeps trying to reconnect to the same code; the host keeps the room open. The game decides what a
// returning player means (see the race section in game.js).
export const PROTO = 3;
const PFX = 'abood-run-v2-';
const LIB = new URL('./vendor/peerjs.min.js', import.meta.url).href;
const BEAT = 1000, SILENT = 5000, RETRY = 2500;
// How the two phones find each other: Cloudflare's public STUN server tells each phone its own public address
// (instead of PeerJS's default, Google). The PeerJS TURN relay stays for networks that block direct connections.
const ICE = [
  { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: ['turn:eu-0.turn.peerjs.com:3478', 'turn:us-0.turn.peerjs.com:3478'], username: 'peerjs', credential: 'peerjsp' },
];
const OPTS = { debug: 0, config: { iceServers: ICE } };

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
const newCode = () => String(100000 + crypto.getRandomValues(new Uint32Array(1))[0] % 900000);
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

// Host: register a 6-digit room code with the broker and wait for the friend. The code is the host's id on the PeerJS
// server, and the server lets only one live peer hold an id, so two open rooms can never share a code: if the code is
// taken ('unavailable-id'), we pick a new one and try again. The code is freed when the host leaves.
export async function host(pid) {
  leave(); role = 'host'; myPid = pid;
  try { await loadLib(); } catch (e) { fail('offline'); return; }
  const tryOpen = n => {
    code = newCode();
    const p = peer = new window.Peer(PFX + code, OPTS);
    keepBroker(p);
    p.on('open', () => emit('hosting', { code }));
    p.on('connection', c => wire(c, c.metadata && String(c.metadata.pid || '')));
    p.on('error', e => {
      if (peer !== p) return;
      if (e.type === 'unavailable-id' && n < 5) { try { p.destroy(); } catch (x) {} tryOpen(n + 1); return; }
      if (code && !offlineErr(e.type) && e.type !== 'unavailable-id') return; // per-connection trouble: the room stays open
      if (conn && conn.open) return; // the race keeps going if only the broker drops; keepBroker reconnects it
      if (!p.open) fail(offlineErr(e.type) ? 'offline' : 'error');
    });
  };
  tryOpen(0);
}

// Guest: connect to the host's room code, and keep trying again after a drop.
export async function join(c, pid) {
  leave(); role = 'guest'; code = cleanCode(c); myPid = pid;
  if (code.length !== 6) { fail('badcode'); return; }
  try { await loadLib(); } catch (e) { fail('offline'); return; }
  const p = peer = new window.Peer(OPTS);
  keepBroker(p);
  p.on('open', () => connect());
  p.on('error', e => {
    if (peer !== p) return;
    if (retryT || (conn && conn.open)) { if (e.type === 'peer-unavailable' && !conn) scheduleRetry(); return; } // already reconnecting
    fail(e.type === 'peer-unavailable' ? 'noroom' : offlineErr(e.type) ? 'offline' : 'error');
  });
  timer = setTimeout(() => { if (!isOpen() && role === 'guest' && !retryT) fail('timeout'); }, 20000);
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
  clearTimeout(timer); clearTimeout(retryT); retryT = 0; clearInterval(beat);
  const c = conn, p = peer; conn = null; peer = null; role = null; code = null; connPid = '';
  if (c) { try { c.send({ t: 'bye' }); } catch (e) {} setTimeout(() => { try { c.close(); } catch (e) {} }, 150); }
  if (p) setTimeout(() => { try { p.destroy(); } catch (e) {} }, 200);
}
addEventListener('pagehide', () => { if (conn) { try { conn.send({ t: 'bye' }); } catch (e) {} } });
