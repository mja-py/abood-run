// Play nearby: race a friend on the same Wi-Fi or phone hotspot with no internet and no servers at all.
// Plain WebRTC with no STUN/TURN: the phones connect over the local network. Instead of a server introducing them,
// each phone shows its connection details as a QR code holding a link to the game, and the other phone scans it with
// its normal camera app (so the game never asks for camera access):
//   1. host: shows QR #n1 (its offer)  ->  friend's camera opens the game with it
//   2. friend: shows QR #n2 (its answer)  ->  host's camera opens the game in a new tab, which hands the answer
//      to the host's open race tab over BroadcastChannel (or localStorage) and tells the host to go back to it.
// The details are packed into about 100 bytes (ICE username/password, DTLS fingerprint, local candidates).
// Same interface as net.js (on / send / isOpen / leave), so the race code works the same either way.
const BEAT = 1000, SILENT = 5000, LINK_WAIT = 25000;
const H = {};
export const on = (ev, fn) => { H[ev] = fn; };
const emit = (ev, d) => { try { H[ev] && H[ev](d); } catch (e) { console.error(e); } };

let pc = null, dc = null, role = null, beat = 0, lastRx = 0, quiet = false, linkT = 0, bc = null;
export const isOpen = () => !!(dc && dc.readyState === 'open');
export const getRole = () => role;
export const supported = () => typeof RTCPeerConnection === 'function';

// ---- packing an SDP into a short code and back ----
const b64u = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
const SETUP = ['actpass', 'active', 'passive'];
function pack(sdp, kind) {
  const ufrag = /a=ice-ufrag:(\S+)/.exec(sdp)[1], pwd = /a=ice-pwd:(\S+)/.exec(sdp)[1];
  const fp = /a=fingerprint:sha-256 (\S+)/i.exec(sdp)[1].split(':').map(h => parseInt(h, 16));
  const setup = Math.max(0, SETUP.indexOf(/a=setup:(\S+)/.exec(sdp)[1]));
  const cands = [];
  for (const m of sdp.matchAll(/a=candidate:\S+ 1 udp \d+ (\S+) (\d+) typ host/gi)) {
    const a = m[1], port = +m[2];
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.local$/i.test(a)) cands.push([1, ...a.slice(0, 36).replace(/-/g, '').match(/../g).map(h => parseInt(h, 16)), port >> 8, port & 255]);
    else if (/^\d+\.\d+\.\d+\.\d+$/.test(a)) cands.push([2, ...a.split('.').map(Number), port >> 8, port & 255]);
    if (cands.length >= 4) break;
  }
  const bytes = [1, kind, setup, ufrag.length, ...[...ufrag].map(c => c.charCodeAt(0)), pwd.length, ...[...pwd].map(c => c.charCodeAt(0)), ...fp, cands.length, ...cands.flat()];
  return b64u(bytes);
}
function unpack(code) {
  const b = unb64u(code); let i = 0;
  const take = n => { const r = b.slice(i, i + n); i += n; if (r.length < n) throw new Error('short'); return r; };
  const str = n => String.fromCharCode(...take(n));
  if (take(1)[0] !== 1) throw new Error('version');
  const kind = take(1)[0], setup = SETUP[take(1)[0]] || 'actpass', ufrag = str(take(1)[0]), pwd = str(take(1)[0]);
  const fp = [...take(32)].map(x => x.toString(16).padStart(2, '0').toUpperCase()).join(':');
  const n = take(1)[0], cands = [];
  for (let k = 0; k < n; k++) {
    const t = take(1)[0];
    if (t === 1) { const h = [...take(16)].map(x => x.toString(16).padStart(2, '0')).join(''); cands.push(`${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}.local`); }
    else if (t === 2) cands.push([...take(4)].join('.'));
    else throw new Error('candidate');
    const p = take(2); cands[cands.length - 1] += ' ' + ((p[0] << 8) | p[1]);
  }
  const lines = ['v=0', `o=- ${Date.now()} 2 IN IP4 127.0.0.1`, 's=-', 't=0 0', 'a=group:BUNDLE 0', 'a=msid-semantic: WMS',
    'm=application 9 UDP/DTLS/SCTP webrtc-datachannel', 'c=IN IP4 0.0.0.0'];
  cands.forEach((c, k) => lines.push(`a=candidate:${k + 1} 1 udp ${2122260223 - k} ${c} typ host generation 0`));
  lines.push('a=end-of-candidates', 'a=ice-ufrag:' + ufrag, 'a=ice-pwd:' + pwd, 'a=fingerprint:sha-256 ' + fp, 'a=setup:' + setup,
    'a=mid:0', 'a=sctp-port:5000', 'a=max-message-size:262144');
  return { kind, sdp: lines.join('\r\n') + '\r\n' };
}
const linkWith = (key, code) => { const u = new URL(location.href); u.search = ''; u.hash = key + '=' + code; return u.href; };

// ---- the connection ----
function newPc() {
  close();
  pc = new RTCPeerConnection({ iceServers: [] }); // local network only
  const ch = dc = pc.createDataChannel('race', { negotiated: true, id: 0, ordered: true });
  dc.onopen = () => { clearTimeout(linkT); quiet = false; startBeat(); emit('open'); };
  dc.onmessage = e => {
    lastRx = Date.now(); if (quiet) { quiet = false; emit('open'); } // came back after a silent spell
    let d; try { d = JSON.parse(e.data); } catch (x) { return; }
    if (d && typeof d.t === 'string' && d.t !== 'k') emit('data', d);
  };
  dc.onclose = () => { if (ch === dc) { clearInterval(beat); emit('lost'); } }; // the link is gone for good: pairing again is the only way back
  pc.onconnectionstatechange = () => { if (pc && pc.connectionState === 'failed' && !isOpen()) fail(); };
}
function gathered() {
  return new Promise(res => {
    if (pc.iceGatheringState === 'complete') { res(); return; }
    const t = setTimeout(res, 3000);
    pc.addEventListener('icegatheringstatechange', () => { if (pc && pc.iceGatheringState === 'complete') { clearTimeout(t); res(); } });
  });
}
function startBeat() {
  clearInterval(beat); lastRx = Date.now();
  beat = setInterval(() => {
    if (!isOpen()) return;
    if (!quiet && Date.now() - lastRx > SILENT) { quiet = true; emit('lost'); } // keep the channel: it may come back
    send({ t: 'k' });
  }, BEAT);
}
function fail() { clearTimeout(linkT); emit('error', 'near'); close(); }

// Host: make the offer and its QR link, then wait for the friend's answer to come back (see takeAnswer).
export async function host() {
  role = 'host'; emit('stage', 'nearMake');
  try {
    newPc(); await pc.setLocalDescription(await pc.createOffer()); await gathered();
    if (!/typ host/.test(pc.localDescription.sdp)) { fail(); return; } // no local network at all
    emit('nearCode', { link: linkWith('n1', pack(pc.localDescription.sdp, 1)) });
    listenForAnswer();
  } catch (e) { console.error(e); fail(); }
}
// Friend: read the host's code, make the answer and its QR link.
export async function answer(code) {
  role = 'guest'; emit('stage', 'nearJoin');
  try {
    const o = unpack(code); if (o.kind !== 1) throw new Error('not an offer');
    newPc(); await pc.setRemoteDescription({ type: 'offer', sdp: o.sdp });
    await pc.setLocalDescription(await pc.createAnswer()); await gathered();
    emit('nearCode', { link: linkWith('n2', pack(pc.localDescription.sdp, 2)) });
    linkT = setTimeout(() => { if (!isOpen()) fail(); }, 180000); // the host has 3 minutes to scan it
  } catch (e) { console.error(e); emit('error', 'nearOld'); close(); }
}
// Host: the answer arrives from the relay tab (or this tab's own address changing); link up.
async function takeAnswer(code) {
  if (role !== 'host' || !pc || pc.signalingState !== 'have-local-offer') return;
  try {
    const a = unpack(code); if (a.kind !== 2) throw new Error('not an answer');
    emit('stage', 'nearLink');
    await pc.setRemoteDescription({ type: 'answer', sdp: a.sdp });
    linkT = setTimeout(() => { if (!isOpen()) fail(); }, LINK_WAIT);
  } catch (e) { console.error(e); emit('error', 'nearOld'); }
}
const CH = 'abood-run-near', KEY = 'abood-run-near';
function listenForAnswer() {
  try { bc = new BroadcastChannel(CH); bc.onmessage = e => { if (e.data && e.data.t === 'answer') takeAnswer(String(e.data.code)); }; } catch (e) {}
}
addEventListener('storage', e => { if (e.key === KEY && e.newValue) { try { takeAnswer(JSON.parse(e.newValue).code); } catch (x) {} } });
addEventListener('hashchange', () => { const m = /^#n2=([\w-]+)$/.exec(location.hash); if (m && role === 'host') { history.replaceState(null, '', location.pathname); takeAnswer(m[1]); } });
// The relay tab (opened by the host's camera app with #n2=...) calls this: pass the answer to the race tab.
export function relay(code) {
  try { const c = new BroadcastChannel(CH); c.postMessage({ t: 'answer', code }); setTimeout(() => c.close(), 500); } catch (e) {}
  try { localStorage.setItem(KEY, JSON.stringify({ code, at: Date.now() })); setTimeout(() => localStorage.removeItem(KEY), 2000); } catch (e) {}
}

export function send(o) { if (isOpen()) { try { dc.send(JSON.stringify(o)); } catch (e) {} } }
function close() {
  clearInterval(beat); clearTimeout(linkT);
  const c = dc, p = pc; dc = null; pc = null;
  try { c && c.close(); } catch (e) {} try { p && p.close(); } catch (e) {}
  if (bc) { try { bc.close(); } catch (e) {} bc = null; }
}
export function leave() {
  if (isOpen()) send({ t: 'bye' });
  clearInterval(beat); clearTimeout(linkT); role = null;
  const c = dc, p = pc; dc = null; pc = null;
  if (bc) { try { bc.close(); } catch (e) {} bc = null; }
  setTimeout(() => { try { c && c.close(); } catch (e) {} try { p && p.close(); } catch (e) {} }, 150); // let the goodbye go out first
}
