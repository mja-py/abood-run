// Run, Abood! — اركض يا عبود
// Canvas endless runner. Characters and scenery are drawn in code, then baked into cached
// sprite frames and background tiles so phones only blit images each frame.
import { T, getLang, applyLang, setLang, onLang, hasStoredLang, FLAG, setGirl } from './i18n.js?v=__BUILD__';
import * as M from './meta.js?v=__BUILD__';
import * as N from './net.js?v=__BUILD__';

const BUILD = '__BUILD__';

// Safari < 16 has no roundRect
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    r = Math.min(typeof r === 'number' ? r : (r && r[0]) || 0, w / 2, h / 2);
    this.moveTo(x + r, y); this.arcTo(x + w, y, x + w, y + h, r); this.arcTo(x + w, y + h, x, y + h, r);
    this.arcTo(x, y + h, x, y, r); this.arcTo(x, y, x + w, y, r); this.closePath(); return this;
  };
}

const $ = id => document.getElementById(id);
const cv = $('cv'), ctx = cv.getContext('2d', { alpha: false });
const H = 400, GROUND = 330, INK = '#2b1a12', FONT = '"Baloo Bhaijaan 2", "Trebuchet MS", Tahoma, system-ui, sans-serif';
const TAU = Math.PI * 2, PHN = 16, STEP = TAU / PHN;
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const COARSE = matchMedia('(pointer: coarse)').matches;
const IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const STANDALONE = matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches || navigator.standalone === true;

// ---------- quality ----------
// Render-resolution caps per level. Phones start lower; the frame monitor steps down when frames run long.
const QDPR = [2, 1.5, 1.15, 0.85];
let qLevel = COARSE ? 1 : 0;
if ((navigator.deviceMemory || 8) <= 3) qLevel = 2;
let W = 700, scale = 1, offY = 0, ABX = 300, RES = 1, bakeRes = 1, FX = 1, MAXP = 160;

const sr = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const pick = a => a[Math.floor(Math.random() * a.length)];
// Course randomness: Math.random in solo play; in a race both players use the same seed, so they get the same course
const seeded = a => () => { a = (a + 0x6D2B79F5) | 0; let x = Math.imul(a ^ (a >>> 15), 1 | a); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
let crand = Math.random;
const crnd = (a, b) => a + crand() * (b - a), cpick = a => a[Math.floor(crand() * a.length)];
const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (a, b, f) => a.map((v, i) => v + (b[i] - v) * f);
const rgb = (a, al = 1) => `rgba(${a[0] | 0},${a[1] | 0},${a[2] | 0},${al})`;
const qph = ph => Math.floor((((ph % TAU) + TAU) % TAU) / STEP) % PHN;
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; };
function compact(a, keep) { let j = 0; for (let i = 0; i < a.length; i++) { const v = a[i]; if (keep(v)) a[j++] = v; } a.length = j; }

const TILES = new Map(), SPR = new Map();
const TILE_MAX = COARSE ? 70 : 120, SPR_MAX = COARSE ? 220 : 340;
let tileBudget = 0, sprBudget = 0;

function resize() {
  const w = cv.clientWidth || innerWidth, h = cv.clientHeight || innerHeight, d = Math.min(devicePixelRatio || 1, QDPR[qLevel]);
  if (!w || !h) return;
  cv.width = Math.round(w * d); cv.height = Math.round(h * d);
  scale = h / H; W = w / scale; offY = 0;
  if (W < 520) { scale = w / 520; W = 520; offY = h / scale - H; }
  ABX = Math.min(W * 0.5, 360);
  RES = scale * d;
  const nb = Math.max(0.5, Math.round(RES * 4) / 4); // quantised so the phone toolbar sliding doesn't flush caches
  if (nb !== bakeRes) { bakeRes = nb; TILES.clear(); SPR.clear(); }
  FX = qLevel >= 2 ? 0.55 : 1; MAXP = Math.round(160 * FX);
  buildStars();
}
let rzT = 0;
addEventListener('resize', () => { clearTimeout(rzT); rzT = setTimeout(resize, 80); });
// The observer runs after layout and before paint, so resizing here means the picture is never shown stretched
// (e.g. Safari's toolbar sliding in or out), without measuring the canvas every frame.
if (window.ResizeObserver) new ResizeObserver(() => resize()).observe(cv);

// ---------- shared sprites ----------
const GLOW = (() => { const c = mk(64, 64), g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,190,100,1)'); gr.addColorStop(1, 'rgba(255,190,100,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return c; })();
const PUFF = new Map();
function puffSprite(col) {
  let c = PUFF.get(col); if (c) return c;
  c = mk(32, 32); const g = c.getContext('2d'); g.fillStyle = col; g.beginPath(); g.arc(16, 16, 13, 0, TAU); g.fill();
  g.globalCompositeOperation = 'destination-in'; const gr = g.createRadialGradient(16, 16, 6, 16, 16, 15);
  gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
  PUFF.set(col, c); return c;
}
let STARS = null;
function buildStars() {
  const h = offY + 240; STARS = mk(W, h); const g = STARS.getContext('2d'); g.fillStyle = '#fff8e6';
  for (let i = 0; i < 90; i++) { const s = sr(i + 40) > 0.85 ? 2.2 : 1.5; g.globalAlpha = 0.5 + sr(i + 3) * 0.5; g.fillRect(sr(i) * W, sr(i + 9) * h, s, s); }
}
const pc = mk(6, 6);
{ const p = pc.getContext('2d'); p.fillStyle = '#c8202b'; p.fillRect(0, 0, 6, 6); p.fillStyle = '#fff1e8';
  p.fillRect(0, 0, 2, 2); p.fillRect(3, 3, 2, 2); p.fillStyle = '#8e121b'; p.fillRect(3, 0, 1, 1); p.fillRect(0, 3, 1, 1); }
const SHEMAGH = ctx.createPattern(pc, 'repeat');
let PITG = null;

// ---------- the route: areas in real order, a 60 km loop from Al Mamzar and back (positions live in meta.js) ----------
const ZONES = [
  { id: 'mamzar', obs: ['basket', 'ball', 'crab', 'cooler', 'cat', 'castle'], plat: 'pergola' },
  { id: 'creek', obs: ['sack', 'carpet', 'dallah', 'cat', 'mandoos', 'wood'], plat: ['#a8322d', '#f6e3b4'] },
  { id: 'downtown', obs: ['escooter', 'cone', 'dbag', 'dbike', 'flower', 'box'], plat: ['#1f7a74', '#e8f1f2'] },
  { id: 'jumeirah', obs: ['crab', 'cooler', 'ball', 'castle', 'cone', 'escooter'], plat: 'plank' },
  { id: 'palm', obs: ['ring', 'cooler', 'ball', 'crab', 'flower', 'castle'], plat: 'plank' },
  { id: 'jbr', obs: ['escooter', 'ball', 'ring', 'dbag', 'cone', 'cooler'], plat: ['#2b6cb0', '#fffaf0'] },
  { id: 'expo', obs: ['escooter', 'cone', 'dbag', 'flower', 'box', 'ball'], plat: ['#1f7a74', '#f4f1ea'] },
  { id: 'golf', obs: ['gbag', 'cart', 'ball', 'flower', 'cone', 'basket'], plat: 'pergola' },
  { id: 'nadsheba', obs: ['basket', 'ball', 'cat', 'flower', 'cooler', 'escooter'], plat: 'pergola' },
  { id: 'khawaneej', obs: ['goat', 'sack', 'rock', 'bush', 'dallah', 'basket'], plat: 'sadu' },
  { id: 'harbour', obs: ['escooter', 'ball', 'dbag', 'cone', 'flower', 'ring'], plat: ['#2b6cb0', '#fffaf0'] },
];
// startM: where on the route this run began; routeM: where Abood is now. Scenery follows the route,
// while difficulty, score and missions follow the distance of this run only.
let startM = 0, routeM = 0;
const zoneAt = M.areaAt, routeOfX = wx => startM + wx / 40;
// The route is a loop: positions keep growing, and the scenery repeats every RL metres.
const RL = M.ROUTE_END, NZ = M.AREAS.length;
const lapStart = m => Math.floor(m / RL) * RL;
const nextAreaAt = m => { const z = zoneAt(m), base = lapStart(m); return base + (z + 1 < NZ ? M.AREAS[z + 1].at : RL); }; // where the next area begins
const TUN = M.STOPS.find(s => s.id === 'tunnel');
const tunnelF = m => { m = M.loopM(m); return clamp(Math.min(m - TUN.m, TUN.m + TUN.len - m) / 40, 0, 1); }; // 0 outside, 1 deep inside the glass tunnel
// the next landmark after route position m, on this lap or the next
function stopAfter(m) {
  let best = null; const base = lapStart(m);
  for (const L of [base, base + RL]) for (let i = 0; i < M.STOPS.length; i++) { const abs = M.STOPS[i].m + L; if (abs > m && (!best || abs < best.abs)) best = { i, abs }; }
  return best;
}
const stopAbs = s => s.m + Math.round((routeM - s.m) / RL) * RL; // the copy of a landmark nearest to Abood

// ---------- day & night ----------
const DAY = ['#3f8fd6', '#73b4e8', '#a9d6f2', '#eaf2e4'].map(hex), NIGHT = ['#070b22', '#141c45', '#28306a', '#3b3f7a'].map(hex);
const SKY = [
  { at: 0, c: DAY, n: 0, sun: 110 },
  { at: .2, c: ['#3a5a9a', '#9b6f9a', '#f09a6a', '#ffd08a'].map(hex), n: .05, sun: 190 },
  { at: .3, c: ['#232a52', '#7d3f6b', '#e2735b', '#f7c070'].map(hex), n: .3, sun: 260 },
  { at: .42, c: NIGHT, n: 1, sun: 380 },
  { at: .66, c: NIGHT, n: 1, sun: 380 },
  { at: .8, c: ['#3a4a8a', '#9a7fb0', '#f0a8a0', '#ffd9a0'].map(hex), n: .3, sun: 250 },
  { at: 1, c: DAY, n: 0, sun: 110 },
];
function skyAt(tod) {
  let k = 0; while (k < SKY.length - 2 && SKY[k + 1].at <= tod) k++;
  const A = SKY[k], B = SKY[k + 1], f = clamp((tod - A.at) / (B.at - A.at), 0, 1);
  return { c: A.c.map((col, i) => mix(col, B.c[i], f)), n: A.n + (B.n - A.n) * f, sun: A.sun + (B.sun - A.sun) * f };
}
let SK = skyAt(.15), lights = [];

// ---------- sound (ZzFX sound effects + a small Hijaz-scale synth) ----------
let actx = null, master = null, muted = false, nextNote = 0, step = 0, ZZ = null;
const SND = {};
const SFX_DEF = {
  jump: [[1, .05, 180, 0, .05, .12, 0, 1.6, 9.5, 0, 0, 0, 0, 0, 0, 0, 0, .6, .02], .5],
  flip: [[1, .05, 320, 0, .06, .2, 0, 1.8, 14, 0, 0, 0, 0, 0, 0, 0, 0, .6, .03], .45],
  candy: [[1, 0, 1400, 0, .02, .12, 1, 1.6, 0, 0, 520, .04, 0, 0, 0, 0, 0, .6, .01], .3],
  power: [[1, 0, 440, .02, .2, .35, 0, 1.6, 0, 0, 220, .07, .07, 0, 0, 0, 0, .8, .02], .5],
  hit: [[1, .1, 120, 0, .04, .28, 4, 2.2, -8, 0, 0, 0, 0, 1.5, 0, .15, 0, .6, .04], .6],
  smash: [[1, .15, 90, 0, .03, .4, 4, 1.2, -2, 0, 0, 0, 0, 2.5, 0, .3, 0, .5, .05], .55],
  whoosh: [[1, .2, 500, .06, .06, .24, 3, 1, -18, 0, 0, 0, 0, .8, 0, 0, 0, .5, .05], .4],
  close: [[1, 0, 900, 0, .03, .14, 0, 2, 0, 0, 450, .05, 0, 0, 0, 0, 0, .6], .35],
  zone: [[1, 0, 520, .02, .3, .45, 0, 1.4, 0, 0, 260, .12, .12, 0, 0, 0, 0, .7, .02], .45],
  lose: [[1, 0, 330, .02, .25, .6, 1, 1.4, -2.5, 0, -110, .18, 0, 0, 0, 0, 0, .7, .05], .5],
  dum: [[1, 0, 95, 0, .02, .22, 0, 3, -3.5, 0, 0, 0, 0, 0, 0, 0, 0, .4, .05], .9],
  tek: [[1, 0, 1800, 0, 0, .05, 4, 1, 0, 0, 0, 0, 0, 4, 0, 0, 0, .3, .02], .3],
};
async function initAudio() {
  try { ZZ = (await import('./vendor/zzfx.js?v=__BUILD__')).ZZFX; actx = ZZ.audioContext; }
  catch (e) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e2) { actx = null; } }
  if (!actx) return;
  master = actx.createGain(); master.gain.value = muted ? 0 : 1; master.connect(actx.destination);
  if (!ZZ) return;
  for (const [name, [p, vol]] of Object.entries(SFX_DEF)) {
    try { const s = ZZ.buildSamples(...p); const b = actx.createBuffer(1, s.length, ZZ.sampleRate); b.getChannelData(0).set(s); SND[name] = { b, vol }; } catch (e) {}
    await nextFrame();
  }
}
let unlocked = false;
function unlockAudio() {
  if (!actx) return;
  if (actx.state === 'suspended') actx.resume().catch(() => {});
  if (!unlocked) { unlocked = true; try { const s = actx.createBufferSource(); s.buffer = actx.createBuffer(1, 1, 22050); s.connect(actx.destination); s.start(0); } catch (e) {} }
}
function play(name, rate = 1, vol = 1, at = 0) {
  const s = SND[name]; if (!s || !actx || muted || actx.state !== 'running') return;
  const src = actx.createBufferSource(), g = actx.createGain();
  src.buffer = s.b; src.playbackRate.value = rate; g.gain.value = s.vol * vol;
  src.connect(g).connect(master); src.start(at || actx.currentTime);
}
function tone(f, d, type, vol, at) {
  const o = actx.createOscillator(), g = actx.createGain();
  o.type = type; o.frequency.setValueAtTime(f, at); g.gain.setValueAtTime(vol, at); g.gain.exponentialRampToValueAtTime(0.0001, at + d);
  o.connect(g).connect(master); o.start(at); o.stop(at + d + 0.02);
}
const sfx = {
  jump: () => play('jump'), dbl: () => play('flip'), candy: m => play('candy', 1 + m * 0.08), power: () => play('power'),
  hit: () => play('hit'), smash: () => play('smash'), whoosh: () => play('whoosh'), close: () => play('close'), zone: () => play('zone'), lose: () => play('lose'),
};
// Hijaz maqam on D with a maqsum darbuka beat
const HIJAZ = [0, 1, 4, 5, 7, 8, 10, 12, 13, 16];
const MEL = [0, -1, 1, 2, 3, -1, 2, 1, 2, -1, 3, 4, 5, 4, 3, 2, 4, -1, 5, 4, 3, 2, 1, 2, 3, 2, 1, -1, 0, -1, -1, -1,
  4, -1, 5, 6, 7, -1, 6, 5, 4, 5, 4, 3, 2, -1, 1, -1, 3, 4, 5, 4, 3, -1, 2, 1, 2, 1, 0, 1, 0, -1, -1, -1];
const BASS = [0, 0, 4, 4, 3, 3, 0, 0];
function music() {
  if (!actx || muted || st !== 'play' || actx.state !== 'running') { if (actx) nextNote = actx.currentTime + 0.05; return; }
  const SP = 60 / 138 / 2;
  if (nextNote < actx.currentTime) nextNote = actx.currentTime + 0.05;
  while (nextNote < actx.currentTime + 0.12) {
    const s = step % MEL.length, b = step % 8, at = nextNote;
    if (MEL[s] >= 0) { const f = 293.66 * Math.pow(2, HIJAZ[MEL[s]] / 12); tone(f, SP * 1.6, 'triangle', 0.02, at); tone(f * 2, SP * 0.7, 'square', 0.004, at); }
    if (b === 0 || b === 4) play('dum', b === 0 ? 1 : 0.9, 0.5, at);
    if (b === 1 || b === 3 || b === 6) play('tek', 1, b === 3 ? 0.5 : 0.35, at);
    if (s % 4 === 0) tone(146.83 * Math.pow(2, HIJAZ[BASS[(s / 4 | 0) % 8]] / 12), SP * 3, 'sine', 0.03, at);
    nextNote += SP; step++;
  }
}
function buzz(ms) { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} }

// ---------- state ----------
let race = null; // set while racing a friend online (see the race section)
let st = 'boot', t = 0, stT = 0, worldX = 0, speed = 320, lead = 0.6, dist = 0, candies = 0, candyCount = 0, boost = 0, shake = 0, graceT = 0;
let combo = 0, comboT = 0, closeCalls = 0, zoneNow = 0, banner = null;
let gaps = [], plats = [], obs = [], items = [], parts = [], sandals = [], birds = [], fish = [], genX = 0, holding = false;
// route progress and per-run mission counters
let nextStop = null, prevStopAt = 0, lastStop = null, stopBanner = null, runHit = 0, runPow = 0, maxFocus = 0, comboMax = 0, runDone = [];
const kid = { y: GROUND, vy: 0, on: true, jumps: 0, coyote: 0, buf: 0, inv: 0, stumble: 0, ph: 0, sx: 1, sy: 1, spin: 0, scoot: 0, mag: 0, say: '', sayT: 0, next: 5 };
const dad = { y: GROUND, vy: 0, on: true, ph: 0, slow: 0, freeze: 0, say: '', sayT: 0, next: 1.5, wx: 0, anger: 0, windup: 0, cd: 8, has: true, regrab: 0 };
try { muted = localStorage.getItem('abood-muted') === '1'; } catch (e) {}

// Focus streak: every 20 s without a hit raises the level (max 3); each level slows Baba by 10%
const FOCUS_STEP = 20, FOCUS_MAX = 3;
// Director (dynamic difficulty): eases off until the player nears their usual distance, then squeezes
// harder. Focus cancels most of the squeeze, and a burst of hits triggers a short mercy break.
let paceT = 500, assist = 1, spawnBoost = 1, sandalMul = 1, mercyT = 0, hitTimes = [], playT = 0;
function director(dt) {
  mercyT = Math.max(0, mercyT - dt);
  if (race) { assist = 1; spawnBoost = 1; sandalMul = 1; mercyT = 0; return; } // a race is classic: the same course and pace for both, no tuning, no mercy breaks
  const p = dist / paceT;
  let mult;
  if (p < 0.85) { mult = 0.75; spawnBoost = 1.4; sandalMul = 1.4; }            // enjoy
  else if (p < 1.1) { mult = 1; spawnBoost = 1; sandalMul = 1; }               // fair
  else { const squeeze = Math.min(0.8, (p - 1.1) / 0.5 * 0.8);                 // crush, up to +80% by 1.6x target
    mult = 1 + squeeze * (1 - 0.3 * focusLv); spawnBoost = 0.85; sandalMul = 0.85 + 0.15 * focusLv / FOCUS_MAX; }
  if (mercyT > 0) { mult *= 0.6; spawnBoost = 1.5; sandalMul = 1.6; }
  assist = mult;
}
let focusT = 0, focusLv = 0;
// Grace at the start of every run and after a second chance: for 2 minutes Baba catches up at half speed,
// then he builds back up to full speed over 10 seconds.
const GRACE_HOLD = 120, GRACE_RAMP = 10, GRACE = GRACE_HOLD + GRACE_RAMP;
const graceK = () => 0.5 + 0.5 * clamp((GRACE - graceT - GRACE_HOLD) / GRACE_RAMP, 0, 1);
const pT = id => { if (!race) return M.powerTime(id); const u = M.UPGRADES.find(x => x.id === id); return u ? u.base : M.powerTime(id); }; // races use the base power-up times (no shop upgrades)
const runSpeed = d => 310 + Math.min(260, d * 0.05); // grows steadily: 360 at 1 km, 410 at 2 km, 560 at 5 km, capped at 570 from 5.2 km
function reset() {
  focusT = 0; focusLv = 0; paceT = M.paceTarget(); assist = 1; spawnBoost = 1; sandalMul = 1; mercyT = 0; hitTimes = [];
  t = 0; worldX = 0; lead = 0.7; dist = 0; routeM = startM; nextStop = stopAfter(startM + 25); prevStopAt = startM; lastStop = null; stopBanner = null; fish = []; runHit = 0; runPow = 0; maxFocus = 0; comboMax = 0; runDone = []; candies = 0; candyCount = 0; boost = 0; shake = 0; graceT = GRACE; combo = 0; comboT = 0; closeCalls = 0; zoneNow = 0; banner = null;
  gaps = []; plats = []; obs = []; items = []; parts = []; sandals = []; genX = 900;
  Object.assign(kid, { y: GROUND, vy: 0, on: true, jumps: 0, coyote: 0, buf: 0, inv: 0, stumble: 0, sx: 1, sy: 1, spin: 0, scoot: 0, mag: 0, shield: 0, held: 0, say: '', sayT: 0, next: 6 });
  Object.assign(dad, { y: GROUND, vy: 0, on: true, slow: 0, freeze: 0, say: T('s_come'), sayT: 2, next: 3, anger: 0, windup: 0, cd: 9, has: true, regrab: 0 });
}

// ---------- level generation ----------
const OB = { box: { w: 34, h: 32 }, bin: { w: 30, h: 46 }, cat: { w: 34, h: 30 }, cone: { w: 24, h: 36 }, goat: { w: 44, h: 38, vx: -45 }, ball: { w: 22, h: 22, bounce: 1, vx: -60 },
  sack: { w: 30, h: 36 }, carpet: { w: 58, h: 20 }, crab: { w: 30, h: 18, side: 1 }, cooler: { w: 40, h: 30 }, rock: { w: 42, h: 28 }, bush: { w: 38, h: 30 }, lizard: { w: 46, h: 14, vx: -110 },
  bike: { w: 44, h: 30 }, gas: { w: 22, h: 36 }, dbag: { w: 32, h: 30 }, dbike: { w: 60, h: 54, vx: -170 }, crate: { w: 32, h: 40 }, chairs: { w: 30, h: 46 },
  castle: { w: 40, h: 28 }, mandoos: { w: 36, h: 32 }, ring: { w: 30, h: 30, vx: -40 }, gbag: { w: 22, h: 40 }, cart: { w: 50, h: 40, vx: -120 }, escooter: { w: 40, h: 38 }, basket: { w: 32, h: 24 }, flower: { w: 30, h: 32 }, dallah: { w: 28, h: 34 }, wood: { w: 44, h: 20 }, buggy: { w: 58, h: 38, vx: -150 } };
function addObs(x, k) { obs.push({ x, x0: x, kind: k, w: OB[k].w, h: OB[k].h, hit: false, hx: 0, hy: 0, rot: 0, ph: 0, lift: 0, clear: 999, passed: false, seed: crand() * 6 }); }
function candyArc(x0, x1, yBase, h) { const n = Math.max(3, Math.round((x1 - x0) / 36)); for (let i = 0; i < n; i++) { const f = i / (n - 1); items.push({ x: x0 + (x1 - x0) * f, y: yBase - Math.sin(f * Math.PI) * h, kind: 'candy', c: i }); } }
function power() { const r = crand(); return r < 0.24 ? 'vimto' : r < 0.46 ? 'marbles' : r < 0.62 ? 'phone' : r < 0.82 ? 'magnet' : 'scooter'; }
function gen() {
  while (genX < worldX + W + 400) {
    const z = ZONES[zoneAt(routeOfX(genX))], r = crand(), gd = race ? Math.max(0, (genX - 900) / 40) + SPRINT_HARD : dist, hard = Math.min(1, gd / 8000), spread = Math.sqrt(runSpeed(gd) / 320); // spacing grows with speed so it stays jumpable
    if (r < 0.34) {
      const k = cpick(z.obs); addObs(genX, k);
      if (crand() < 0.5) candyArc(genX - 50, genX + OB[k].w + 50, GROUND - 50, 62);
      if (crand() < 0.12 + hard * 0.38) { const dx = crnd(200, 250) * spread; addObs(genX + dx, cpick(z.obs)); genX += dx; }
      genX += crnd(270, 450) * spread;
    } else if (r < 0.52) {
      const w = crnd(85, 110 + hard * 50); gaps.push({ x0: genX, x1: genX + w });
      candyArc(genX - 30, genX + w + 30, GROUND - 60, 72); genX += w + crnd(250, 340);
    } else if (r < 0.72) {
      const w = crnd(170, 260), y = GROUND - crnd(85, 120); plats.push({ x: genX, y, w, z: zoneAt(routeOfX(genX)) });
      if (crand() < 0.4) { const gw = Math.min(w - 40, crnd(90, 140)); gaps.push({ x0: genX + 20, x1: genX + 20 + gw }); }
      if (crand() < 0.4 * spawnBoost) items.push({ x: genX + w / 2, y: y - 34, kind: power() });
      else for (let x = genX + 24; x < genX + w - 10; x += 34) items.push({ x, y: y - 26, kind: 'candy', c: x });
      genX += w + crnd(230, 320);
    } else if (r < 0.88) {
      if (crand() < 0.1 * (spawnBoost - 0.8)) { items.push({ x: genX + 100, y: GROUND - 74, kind: power() }); genX += 260; continue; }
      const jar = crand() < 0.18;
      for (let i = 0; i < 6; i++) items.push({ x: genX + i * 34, y: GROUND - 26 - (i === 5 && jar ? 30 : 0), kind: i === 5 && jar ? 'jar' : 'candy', c: i }); genX += crnd(280, 360);
    } else {
      items.push({ x: genX, y: GROUND - 74, kind: power() }); genX += crnd(260, 340);
    }
  }
  if (!Number.isFinite(genX)) genX = worldX + W + 100;
  const cut = worldX - ABX - 200;
  compact(gaps, g => g.x1 > cut); compact(plats, p => p.x + p.w > cut); compact(obs, o => o.x + o.hx + 80 > cut && o.hy < 300); compact(items, i => i.x > cut && !i.got);
}
const overGap = (x, m = 5) => { for (const g of gaps) if (x > g.x0 + m && x < g.x1 - m) return true; return false; };

// ---------- input ----------
function press() {
  unlockAudio();
  if (!$('langPick').hidden || !$('sheet').hidden || !$('loginPop').hidden || !$('friend').hidden) return;
  if (race && st !== 'play' && st !== 'pause') return; // in a race, the next round starts from the course picker
  if (st === 'menu') { start(); return; }
  if (st === 'over') { if (swap && !swap.done) { endSwap(); return; } if (stT > 0.9 && !$('over').hidden) start(); return; }
  if (st === 'pause') { setPause(false); return; }
  if (st === 'play') { kid.buf = 0.13; holding = true; }
}
function release() { holding = false; }
const isUI = e => e.target && e.target.closest && e.target.closest('button, a, .panel, #toast, #sheet, #loginPop');
addEventListener('keydown', e => {
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return; // typing a name or a race code
  if (['Space', 'ArrowUp', 'KeyW'].includes(e.code)) { e.preventDefault(); if (!e.repeat && !(st !== 'play' && e.target.closest && e.target.closest('button'))) press(); }
  if ((e.code === 'KeyP' || e.code === 'Escape') && !race) { if (st === 'play') setPause(true); else if (st === 'pause') setPause(false); } // no pausing a race: the friend keeps running
});
addEventListener('keyup', e => { if (['Space', 'ArrowUp', 'KeyW'].includes(e.code)) release(); });
addEventListener('pointerdown', e => { unlockAudio(); if (st === 'boot' || isUI(e)) return; press(); });
addEventListener('pointerup', release); addEventListener('pointercancel', release);
addEventListener('touchend', unlockAudio, { passive: true });
addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { if (st === 'play' && !race) setPause(true); }
  else if (st === 'play') wakeOn();
});

$('startBtn').onclick = () => { unlockAudio(); start(); };
$('againBtn').onclick = () => { unlockAudio(); if (race) openPick(); else start(); };
$('sheetClose').onclick = () => closeSheet();
document.querySelectorAll('[data-sheet]').forEach(b => b.onclick = () => openSheet(b.dataset.sheet));
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('.lang [data-lang]');
  if (b && b.dataset.lang !== getLang()) setLang(b.dataset.lang);
  const pk = e.target.closest && e.target.closest('[data-pick]');
  if (pk) { setLang(pk.dataset.pick); $('langPick').hidden = true; showMenu(); }
});
$('flagAr').innerHTML = FLAG.ar; $('flagEn').innerHTML = FLAG.en;
function showMenu() {
  $('menu').hidden = false; renderMenu(); maybeToast(); maybeLogin(); const rf = M.takeRefund(); if (rf) setTimeout(() => note(T('refund', rf)), 600); }
// sound: the round corner button while running, and the speaker in the menu's top bar (the same look as Abood to the Moon)
const SPK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="',
  SPK_ON = SPK + 'M15.5 9a4.2 4.2 0 0 1 0 6M18.2 6.5a8 8 0 0 1 0 11"/></svg>', SPK_OFF = SPK + 'M16 9.5l5 5M21 9.5l-5 5"/></svg>';
function setMuteBtn() {
  $('mute').textContent = muted ? '✕' : '♪'; $('menuMute').innerHTML = muted ? SPK_OFF : SPK_ON;
  for (const b of [$('mute'), $('menuMute')]) b.setAttribute('aria-pressed', muted ? 'true' : 'false');
}
$('mute').onclick = $('menuMute').onclick = e => { unlockAudio(); muted = !muted; if (master) master.gain.value = muted ? 0 : 1; try { localStorage.setItem('abood-muted', muted ? '1' : '0'); } catch (e2) {} setMuteBtn(); e.currentTarget.blur(); };
$('pauseBtn').onclick = () => { if (st === 'play') setPause(true); else if (st === 'pause') setPause(false); $('pauseBtn').blur(); };
function setPause(p) { st = p ? 'pause' : 'play'; $('pauseBtn').textContent = p ? '▶' : 'II'; if (p) wakeOff(); else wakeOn(); }

// full screen (Android / desktop) and an Add-to-Home-Screen hint for iPhone
const fsEl = document.documentElement;
const fsOK = !!(document.fullscreenEnabled || document.webkitFullscreenEnabled) && !!(fsEl.requestFullscreen || fsEl.webkitRequestFullscreen) && !STANDALONE;
$('fsBtn').hidden = !fsOK;
$('iosHint').hidden = !(IOS && !STANDALONE);
$('fsBtn').onclick = async () => {
  try { await (fsEl.requestFullscreen ? fsEl.requestFullscreen({ navigationUI: 'hide' }) : fsEl.webkitRequestFullscreen()); } catch (e) {}
  try { await screen.orientation.lock('landscape'); } catch (e) {}
  $('fsBtn').blur();
};
const portraitMQ = matchMedia('(orientation: portrait)');
const syncRotate = () => { $('rotateHint').hidden = !(COARSE && portraitMQ.matches); };
portraitMQ.addEventListener ? portraitMQ.addEventListener('change', syncRotate) : portraitMQ.addListener(syncRotate);

let wake = null;
async function wakeOn() { try { if (navigator.wakeLock && !wake) { wake = await navigator.wakeLock.request('screen'); wake.addEventListener('release', () => { wake = null; }); } } catch (e) { wake = null; } }
function wakeOff() { try { wake && wake.release(); } catch (e) {} wake = null; }

function showBest() { const b = M.bestDist(); $('menuBest').hidden = b <= 0; if (b > 0) $('menuBest').textContent = T('bestTag', b); }
const selBoost = new Set();
let run = null, runBadges = [], badgeTimer = 0;
function start(rc) {
  if (race && !rc) return;
  startM = M.AREAS[rc ? rc.area : M.startArea()].at; crand = rc ? seeded(rc.seed) : Math.random; reset(); st = 'play';
  run = { dist: 0, sweets: 0, close: 0, zoneMax: 0, paid: 0, route: rc ? 0 : startM, race: rc ? 1 : 0, noHit: 0, comboMax: 0, focusMax: 0, powers: 0, stops: 0 }; runBadges = []; lastRes = null; M.track('run');
  if (!rc && M.robeOf().shield) kid.shield = 1;
  if (!rc) for (const id of selBoost) if (M.useBooster(id)) {
    if (id === 'vimto') boost = 6; if (id === 'magnet') kid.mag = 10; if (id === 'shield') kid.shield = 1;
    if (id === 'headstart') { kid.scoot = 6; lead = 0.85; }
  }
  if (!rc) selBoost.clear(); renderMenu(); stT = 0; $('menu').hidden = true; $('over').hidden = true; $('toast').hidden = true; $('hud').hidden = false; $('routeHud').hidden = false; $('pauseBtn').hidden = !!rc; $('pauseBtn').textContent = 'II'; $('sprintBar').hidden = !rc;
  if (actx) nextNote = actx.currentTime + 0.05; step = 0; zoneNow = zoneAt(startM); showBanner(zoneNow); wakeOn(); hudCache.fill(null);
  document.activeElement && document.activeElement.blur && document.activeElement.blur();
}
let lastOver = null;
function fillOver() {
  if (!lastOver) return; const { why, m, nb } = lastOver;
  const fin = why === 'finish';
  $('overQuote').textContent = T(fin ? 's_fin' : why === 'fell' ? 's_fell' : 's_got');
  $('overTitle').textContent = fin ? T('sp_finT', fmtTm(lastOver.tm || 0)) : T(why === 'fell' ? 'fellT' : 'caughtT');
  $('overMsg').textContent = fin ? T('sp_course', T('zn_' + M.AREAS[race ? race.area : 0].id), SPRINT_M) : nb ? T('newBest') : T('beat', M.bestDist());
  $('sDist').textContent = m; $('sBest').textContent = M.bestDist(); $('sClose').textContent = closeCalls;
  $('avNameOver').textContent = kname();
  // where Abood got to on the route, and what is next
  const nx = M.STOPS[nextStop.i], here = lastStop ? T('st_' + lastStop.id) : T('zn_' + ZONES[zoneAt(routeM)].id);
  $('overRoute').textContent = T('o_reached', here, kmTxt(M.loopM(routeM))) + ' · ' + T('o_next', T('st_' + nx.id), kmTxt(Math.max(0, nextStop.abs - routeM)));
  const ms = $('overMissions'); ms.innerHTML = '';
  if (lastRes && lastRes.levelUp) { const u = lastRes.levelUp; ms.appendChild(el('p', 'levelup', T('o_levelUp', u.lv, u.mult, u.reward))); }
  if (runDone.length) { ms.appendChild(el('p', 'label', T('o_missions'))); const row = el('div', 'badge-strip'); for (const d of runDone) row.appendChild(el('span', 'badge-chip ms-chip', '✓ ' + missionText(d))); ms.appendChild(row); }
  const strip = $('overBadges'); strip.innerHTML = '';
  if (!runBadges.length) strip.innerHTML = '<span class="hint">' + T('o_none') + '</span>';
  for (const b of runBadges) { const e2 = document.createElement('span'); e2.className = 'badge-chip'; const cnv = mk(56, 56); drawMedal(cnv.getContext('2d'), b.id, b.cat ? b.tier : 2, 56); e2.appendChild(cnv); e2.append(badgeName(b) + ' · ' + T('bg_reward', b.reward)); strip.appendChild(e2); }
  const rv = M.data().boosters.revive || 0; $('reviveBtn').hidden = !!race; fillRace();
  $('reviveBtn').textContent = !run || !run.freeRevive ? T('o_reviveFree') : rv > 0 ? T('o_revive', rv) : T('o_reviveBuy', M.REVIVE_PRICE);
  if (!swap || swap.done) { syncCoins(); swapShow(lastRes ? lastRes.ex : null, 1, 3); }
}
const kmTxt = m => (Math.round(m / 100) / 10).toFixed(1);
// ---- sweets exchange animation on the results card ----
let swap = null;
function swapShow(ex, f, phase = 3) {
  if (!ex) return;
  const c1 = clamp(f, 0, 1);
  const sw = phase >= 1 ? Math.round(ex.sweets * (phase === 1 ? 1 - c1 : 0)) : ex.sweets;
  const base = ex.s + ex.d;
  let coins = phase === 1 ? Math.floor(ex.s * c1) : phase === 2 ? ex.s + Math.floor(ex.d * c1) : phase >= 3 ? Math.round(base + (ex.total - base) * c1) : 0;
  $('swSweets').textContent = sw; $('swCoins').textContent = coins;
  const ar = ' ' + T('arrow') + ' ';
  $('swPartS').textContent = phase >= 1 ? T('sw_sweets', ex.sweets) + ar + ex.s : '';
  $('swPartD').textContent = phase >= 2 ? T('sw_dist', ex.dist) + ar + ex.d : '';
  $('swPartM').textContent = phase >= 3 ? T('sw_mult') + ' ×' + ex.mult : '';
  $('swPartM').classList.toggle('hot', phase >= 3 && ex.mult > 1);
  return coins;
}
function startSwap() {
  if (!lastRes) return; const ex = lastRes.ex, paid = lastRes.earned;
  const c = $('swCandyIc').getContext('2d'); c.setTransform(64 / 40, 0, 0, 64 / 40, 0, 0); c.clearRect(0, 0, 40, 40); drawItem(c, 'candy', 20, 20, 0, true);
  swap = { t: -0.45, ex, paid, base: M.data().coins - paid, done: false, tick: 0, fly: 0, phase: 0 };
  swapShow(ex, 0, 0); $('swPartS').textContent = ''; $('swPartD').textContent = ''; $('swPartM').textContent = '';
  setCoinPill(swap.base);
}
function setCoinPill(v) { const s2 = T('coins', v); document.querySelectorAll('.coinVal').forEach(e => { e.textContent = s2; }); }
function flyCoin() {
  const from = $('swCoinIc').getBoundingClientRect(), to = document.querySelector('#over .coinpill .coin'); if (!to || REDUCED) return;
  const b = to.getBoundingClientRect(), e = el('i', 'coin flycoin'); e.style.left = from.left + 'px'; e.style.top = from.top + 'px'; document.body.appendChild(e);
  requestAnimationFrame(() => requestAnimationFrame(() => { e.style.transform = `translate(${b.left - from.left}px, ${b.top - from.top}px) scale(.85)`; e.style.opacity = '.3'; }));
  setTimeout(() => e.remove(), 700);
}
const SW_T = [0, 1.1, 0.55, 0.6]; // phase lengths: sweets, distance, multiplier
function stepSwap(dt) {
  if (!swap || swap.done || $('over').hidden) return;
  swap.t += dt; if (swap.t < 0) return;
  const ex = swap.ex; let ph = 1, acc = 0;
  const len = [0, ex.sweets > 0 ? SW_T[1] : 0.01, ex.d > 0 ? SW_T[2] : 0.01, ex.mult > 1 ? SW_T[3] : 0.01];
  while (ph < 3 && swap.t > acc + len[ph]) { acc += len[ph]; ph++; }
  const f = (swap.t - acc) / len[ph];
  if (ph !== swap.phase) { swap.phase = ph; if (ph === 3 && ex.mult > 1) { play('power', 1.4, 0.7); bump('swPartM'); } }
  const coins = swapShow(ex, f, ph);
  setCoinPill(swap.base + Math.round(swap.paid * (ex.total ? clamp(coins / ex.total, 0, 1) : 1)));
  swap.tick -= dt; if (swap.tick <= 0 && f < 1) { swap.tick = 0.055; play('candy', 1 + clamp(swap.t / 2.2, 0, 1) * 0.9, 0.55); }
  swap.fly -= dt; if (swap.fly <= 0 && f < 1 && ex.total > 0) { swap.fly = 0.12; flyCoin(); }
  if (ph === 3 && f >= 1) endSwap();
}
function endSwap() {
  if (!swap) return; swapShow(swap.ex, 1, 3); swap.done = true; syncCoins(); bump('swCoins'); if (swap.ex.total > 0) { sfx.zone(); buzz(20); }
}
let lastRes = null;
function settleRun() {
  if (!run) return null;
  syncRun();
  const res = M.endRun(run); missionPops(); for (const b of res.badges) runBadges.push(b);
  if (res.girl) setTimeout(() => note(T('girlNew'), 4500), 1800); // after the results card is up
  lastRes = Object.assign({}, res, { levelUp: res.levelUp || (lastRes && lastRes.levelUp) }); return res;
}
// where Baba stands on the results scene: just behind Abood, but never on thin air. If that spot is over a hole
// (Abood fell in), he stands on the edge of the hole and lifts Abood out.
let overX = 0;
function overSpot() {
  let x = ABX - 40;
  for (const g of gaps) {
    const x0 = g.x0 - worldX + ABX, x1 = g.x1 - worldX + ABX;
    if (x + 22 > x0 && x - 22 < x1) x = x0 - 24 > 30 ? x0 - 24 : x1 + 24; // the near edge if it is on screen, else the far one
  }
  return x;
}
function gameOver(why) {
  if (st !== 'play') return; st = 'over'; stT = 0; wakeOff();
  const fin = why === 'finish'; if (fin) { sfx.zone(); play('power', 1.2, 0.8); buzz(40); } else { sfx.lose(); buzz([60, 40, 120]); }
  const res = settleRun(), m = Math.floor(dist), tm = fin && race ? +race.myTm.toFixed(2) : null;
  if (race) { race.me = { d: m, s: candies, why, tm }; race.final = false; N.send({ t: 'out', d: m, s: candies, why, tm }); }
  dad.say = T(fin ? 's_fin' : why === 'fell' ? 's_fell' : 's_got'); dad.sayT = 99; kid.say = T(fin ? 's_finKid' : 's_sorry'); kid.sayT = 99;
  lastOver = { why, m, tm, nb: res && res.newBest }; swap = null; fillOver(); showBest(); overX = overSpot();
  $('hud').hidden = true; $('routeHud').hidden = true; $('sprintBar').hidden = true; $('pauseBtn').hidden = true; $('powers').textContent = ''; lastHud = '';
  const showOver = () => { if (st === 'over') { $('over').hidden = false; startSwap(); maybeToast(); } };
  setTimeout(() => {
    // Ads hook: set window.aboodAfterRun = async ({ distance, sweets }) => { ...show an ad... }.
    // The results card appears when it finishes (or straight away if it is not set or fails, and after 15 s at most).
    const hook = window.aboodAfterRun;
    if (typeof hook === 'function') Promise.race([Promise.resolve().then(() => hook({ distance: m, sweets: candies })), new Promise(r => setTimeout(r, 15000))]).catch(() => {}).finally(showOver); else showOver();
  }, 1100);
}
function revive() {
  if (st !== 'over' || race) return;
  // the first second chance in every run is free; after that use a bought one, or pay on the spot
  if (run && !run.freeRevive) run.freeRevive = true;
  else if (!M.useBooster('revive') && !M.spend(M.REVIVE_PRICE)) { note(T('notEnough')); return; }
  M.track('revive'); for (const b of M.checkBadges(null)) runBadges.push(b);
  st = 'play'; stT = 0; $('over').hidden = true; $('hud').hidden = false; $('routeHud').hidden = false; $('pauseBtn').hidden = false; hudCache.fill(null); if (swap && !swap.done) endSwap(); swap = null;
  focusT = 0; focusLv = 0; graceT = GRACE;
  lead = 0.6; kid.y = GROUND; kid.vy = 0; kid.on = true; kid.inv = 2.5; kid.stumble = 0; kid.sayT = 0; dad.sayT = 0; dad.windup = 0; dad.cd = 6;
  compact(gaps, g => g.x1 < worldX - 60 || g.x0 > worldX + 500); compact(obs, o => o.x < worldX - 60 || o.x > worldX + 500); sandals.length = 0;
  floatText(T('f_revive'), worldX, kid.y - 80, '#9ff0ff'); wakeOn();
}
$('reviveBtn').onclick = () => { unlockAudio(); revive(); };

// ---------- race a friend online ----------
// The host creates a room and gets a 6-digit code; the friend types it to join the room. Both games get
// the same seed and start area, so the course is identical, and the difficulty director is fixed. Each player runs
// their own game and they swap positions 20 times a second; the friend shows as a see-through ghost that plays a
// tenth of a second behind, gliding between the positions it received.
// A race is a sprint: the first to the finish line SPRINT_M metres on wins the round. Falling in a hole or being caught
// by Baba costs time, never the race. A match is the best of 3 rounds; the loser of each round picks the next course
// (any of the 11 areas, reached or not), and the loser of a match picks the first course of the next one.
// Dropped connections: the race goes on, the friend's last record stays, and the joining side keeps reconnecting.
// When the same player comes back (same player id), both sides swap where they are and the result is worked out
// again. After a minute without them, their last record counts.
const num = v => (Number.isFinite(+v) ? +v : 0);
const GHOST_DELAY = 110, LOST_GIVEUP = 60000;
const SPRINT_M = 600, SPRINT_HARD = 2000, ROUNDS = 3, TO_WIN = 2; // course length; the obstacle mix of a run 2 km in; best of 3
const fmtTm = sec => { const m = Math.floor(sec / 60), r = sec - m * 60; return m + ':' + (r < 10 ? '0' : '') + r.toFixed(1); };
const finTm = d => (d && d.why === 'finish' && Number.isFinite(+d.tm) ? clamp(+d.tm, 0, 3600) : null);
const newMatch = () => ({ rd: 0, me: 0, opp: 0, last: 0, over: false });
const mp = () => { const d = M.data(); if (!d.mp) d.mp = {}; if (!d.mp.pid) { d.mp.pid = Array.from(crypto.getRandomValues(new Uint8Array(8)), b => b.toString(16).padStart(2, '0')).join(''); M.save(); } return d.mp; };
// Race names are typed by the player: letters only, in the game's language (Arabic letters in Arabic, English
// letters in English), 2 to 12, single spaces; no numbers or symbols. Only the friend you race sees it.
const NAME_AR = /^[ء-غف-ي]+( [ء-غف-ي]+)*$/, NAME_EN = /^[A-Za-z]+( [A-Za-z]+)*$/;
const nameOk = n => typeof n === 'string' && n.length <= 12 && n.replace(/ /g, '').length >= 2 && (NAME_AR.test(n) || NAME_EN.test(n));
const nameFilter = v => (getLang() === 'ar' ? v.replace(/[^ء-غف-ي ]/g, '') : v.replace(/[^A-Za-z ]/g, '')).replace(/^ +/, '').replace(/ {2,}/g, ' ').slice(0, 12);
const myName = () => (nameOk(mp().name) ? mp().name : kname());
const newOpp = () => ({ here: false, pid: '', name: '', ch: 'abood', robe: '', head: '', round: 0, d: 0, s: 0, tm: null, out: false, run: false, gone: false, lost: false, lostAt: 0, buf: [], off: null });
const oppGirl = () => race.opp.ch === 'mozah';
const oppName = () => race.opp.name || T('ch_' + race.opp.ch);
const oppLook = () => lookOf(race.opp.robe, race.opp.head, oppGirl());
function openFriend(mode, c) {
  if (race) leaveRace(true);
  race = { role: mode === 'choose' ? null : mode, fs: mode === 'choose' ? 'choose' : 'connecting', err: '', code: '', seed: 0, area: 0, hold: 0, goT: 0, sendT: 0, me: null, final: false, opp: newOpp(), match: newMatch(), scored: 0, picked: false };
  if (race.fs === 'connecting') setConnecting();
  $('menu').hidden = true; $('friend').hidden = false;
  if (!mp().ok) { race.fs = 'gate'; race.after = { mode, c }; newGateQ(); renderFriend(); setTimeout(() => $('fGateA').focus(), 50); return; } // a grown-up agrees once, before the first race
  renderFriend(); startMode(mode, c);
}
function startMode(mode, c) {
  if (mode === 'guest') N.join(c, mp().pid);
}
function newGateQ() { const a = 12 + Math.floor(Math.random() * 8), b = 3 + Math.floor(Math.random() * 7); race.gate = a * b; $('fGateQ').textContent = T('mp_gateQ', a, b); $('fGateQ').dataset.ab = a + 'x' + b; $('fGateA').value = ''; }
function gateOk() {
  if (!race || race.fs !== 'gate') return;
  if (parseInt($('fGateA').value.replace(/\D/g, ''), 10) !== race.gate) { note(T('mp_gateWrong')); newGateQ(); $('fGateA').focus(); return; }
  mp().ok = 1; M.save();
  const { mode, c } = race.after; if (mode === 'choose') race.fs = 'choose'; else setConnecting(); renderFriend();
  startMode(mode, c);
}
function fillNameTag() { $('fNameTxt').textContent = myName(); }
// Pop-up cards over the lobby: one for the race name, one for the room code (six boxes).
let popKind = null;
const codeBoxes = () => [...$('fPopCode').querySelectorAll('input')];
function openPop(kind) {
  if (!canStart()) return;
  const name = kind === 'name', ar = getLang() === 'ar'; popKind = kind; $('fPop').hidden = false;
  $('fPopName').hidden = !name; $('fPopCode').hidden = name; $('fPopHint').classList.remove('bad');
  $('fPopTitle').textContent = T(name ? 'mp_namePop' : 'mp_codePop');
  $('fPopHint').textContent = T(name ? (ar ? 'mp_nameHintAr' : 'mp_nameHintEn') : 'mp_codeHint');
  $('fPopOk').textContent = T(name ? 'mp_save' : 'mp_join');
  if (name) { const inp = $('fPopName'); inp.value = nameFilter(mp().name || ''); inp.dir = ar ? 'rtl' : 'ltr'; inp.lang = ar ? 'ar' : 'en'; inp.placeholder = kname(); setTimeout(() => inp.focus(), 60); }
  else { for (const b of codeBoxes()) b.value = ''; setTimeout(() => codeBoxes()[0].focus(), 60); }
}
function closePop() { $('fPop').hidden = true; popKind = null; }
function popBad(msg) { const h = $('fPopHint'); h.textContent = msg; h.classList.add('bad'); buzz(30); }
function popOk() {
  if (popKind === 'name') {
    const n = nameFilter($('fPopName').value).trim();
    if (n && !nameOk(n)) { popBad(T(getLang() === 'ar' ? 'mp_nameBadAr' : 'mp_nameBadEn')); return; }
    mp().name = n; M.save(); closePop(); fillNameTag(); return; // an empty name means the character's own name
  }
  if (popKind === 'code') {
    const c = codeBoxes().map(b => b.value).join('');
    if (c.length !== 6) { popBad(T('mp_err_badcode')); return; }
    closePop(); goJoin(c);
  }
}
function fillCode(d, from) { const all = codeBoxes(); for (let k = 0; k < d.length && from + k < 6; k++) all[from + k].value = d[k]; all[Math.min(5, from + d.length)].focus(); if (all.every(x => x.value)) popOk(); }
codeBoxes().forEach((b, i, all) => {
  b.addEventListener('input', () => { const d = b.value.replace(/\D/g, ''); if (d.length > 1) { fillCode(d, i); return; } b.value = d; if (d && i < 5) all[i + 1].focus(); if (all.every(x => x.value)) popOk(); });
  b.addEventListener('keydown', e => {
    if (e.key === 'Backspace' && !b.value && i > 0) { e.preventDefault(); all[i - 1].value = ''; all[i - 1].focus(); }
    else if (e.key === 'Enter') { e.preventDefault(); popOk(); } else if (e.key === 'Escape') closePop();
  });
  b.addEventListener('paste', e => { const d = ((e.clipboardData && e.clipboardData.getData('text')) || '').replace(/\D/g, ''); if (d) { e.preventDefault(); fillCode(d, i); } });
});
$('fPopName').addEventListener('input', e => { if (e.isComposing) return; const v = e.target.value, f = nameFilter(v); if (f !== v) e.target.value = f; });
$('fPopName').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); popOk(); } else if (e.key === 'Escape') closePop(); });
$('fPopOk').onclick = () => { unlockAudio(); popOk(); };
$('fPopCancel').onclick = () => { unlockAudio(); closePop(); };
$('fNameBtn').onclick = () => { unlockAudio(); openPop('name'); };
// While connecting, the lobby shows a progress bar with each step, and the buttons are gone, so a slow
// (or waking) server never tempts a second tap; goHost/goJoin also ignore taps that arrive mid-connect.
function setConnecting() { race.fs = 'connecting'; race.stage = 'lib'; race.loadAt = race.stageAt = performance.now(); race.slow = false; }
const canStart = () => race && (race.fs === 'choose' || race.fs === 'err');
const STAGE = { host: { lib: [0.05, 0.25, 'mp_st_lib'], server: [0.25, 0.85, 'mp_st_make'], retry: [0.5, 0.85, 'mp_st_retry'] },
  guest: { lib: [0.05, 0.25, 'mp_st_lib'], server: [0.25, 0.6, 'mp_st_server'], peer: [0.6, 0.95, 'mp_st_peer'] } };
const stageOf = () => (STAGE[race.role] || STAGE.host)[race.stage] || STAGE.host.lib;
function friendLoad() { // runs every frame while connecting: the bar creeps forward within the current step
  const [a, b] = stageOf(), now = performance.now(), p = a + (b - a) * (1 - Math.exp(-(now - race.stageAt) / 6000));
  $('fLoadFill').style.transform = 'scaleX(' + p.toFixed(3) + ')';
  const slow = now - race.loadAt > 6000;
  if (slow !== race.slow) { race.slow = slow; $('fLoadHint').textContent = T(slow ? 'mp_slow' : 'mp_noTap'); }
}
N.on('stage', s => { if (!race || race.fs !== 'connecting') return; race.stage = s; race.stageAt = performance.now(); renderFriend(); });
function goHost() { if (!canStart()) return; race.role = 'host'; setConnecting(); renderFriend(); N.host(mp().pid); }
function goJoin(code) {
  if (!canStart()) return; const c = N.cleanCode(code);
  if (c.length !== 6) { race.fs = 'err'; race.err = 'badcode'; renderFriend(); return; }
  race.role = 'guest'; setConnecting(); renderFriend(); N.join(c, mp().pid);
}
function leaveRace(quiet) {
  N.leave(); race = null; crand = Math.random; $('cPick').hidden = true; $('sprintBar').hidden = true;
  $('raceBox').hidden = true; $('over').classList.remove('racing'); $('againBtn').hidden = false; $('againBtn').disabled = false;
  $('againBtn').textContent = T('again'); $('againHint').textContent = T('againHint'); $('overMenuBtn').textContent = T('b_menu');
  if (!$('friend').hidden) { $('friend').hidden = true; if (!quiet) showMenu(); }
}
function hello() {
  const d = M.data();
  N.send({ t: 'hi', v: N.PROTO, pid: mp().pid, name: nameOk(mp().name) ? mp().name : '', ch: d.char, robe: d.robe, head: d.head,
    seed: race.seed, me: race.me, live: !!race.seed && !race.me && (st === 'play' || st === 'pause'), d: Math.floor(dist) });
}
N.on('hosting', ({ code }) => { if (!race) return; race.code = code; if (race.fs === 'connecting') race.fs = 'waiting'; renderFriend(); });
N.on('open', () => { if (!race) return; race.fs = 'joined'; hello(); renderFriend(); });
N.on('error', why => { if (!race) return; race.fs = 'err'; race.err = why; renderFriend(); });
N.on('lost', () => {
  if (!race) return; const o = race.opp; if (o.gone || !o.here || o.lost) return;
  o.lost = true; o.lostAt = Date.now(); o.buf = [];
  if (st === 'play' || st === 'pause') floatText(T('mp_lost', oppName(), oppGirl()), worldX + 80, 120, '#9ff0ff'); else note(T('mp_lost', oppName(), oppGirl()), 2500);
  renderFriend(); if (st === 'over') fillRace();
});
setInterval(() => { // a friend who stays away for a minute is out, with their last record
  if (!race || !race.opp.lost || Date.now() - race.opp.lostAt < LOST_GIVEUP) return;
  const o = race.opp; o.lost = false; o.gone = true; o.run = false; if (race.seed && o.round === race.seed) o.out = true;
  note(T('mp_left', oppName(), oppGirl()), 3000);
  if (race.role === 'guest') { N.leave(); if (!$('friend').hidden) { race.fs = 'err'; race.err = 'noroom'; } }
  else if (!$('friend').hidden) { race.opp = newOpp(); race.fs = 'waiting'; }
  renderFriend(); if (st === 'over') fillRace();
}, 1000);
N.on('data', d => {
  if (!race) return; let o = race.opp;
  if (d.t === 'p') {
    if (o.round !== race.seed) return; // a position from a race we are not in
    const now = performance.now(), ts = num(d.ts), off = now - ts, x = num(d.x), b = o.buf;
    o.off = o.off == null || off < o.off ? off : o.off + (off - o.off) * 0.01; // the smallest delay seen, drifting slowly
    const last = b[b.length - 1], at = last ? Math.max(last.t + 1, ts + o.off) : ts + o.off;
    b.push({ t: at, x, y: clamp(num(d.y), -200, H + 60), a: !!d.a, sc: !!d.sc }); if (b.length > 40) b.shift();
    o.d = Math.max(0, num(d.d) | 0); o.s = num(d.s) | 0; o.run = true;
    if (st === 'over') fillRace();
  } else if (d.t === 'hi') {
    if (d.v !== N.PROTO) { note(T('mp_version'), 4000); leaveRace(); return; }
    const pid = String(d.pid || '').slice(0, 40), back = !!o.pid && pid === o.pid;
    if (!back) { race.opp = o = newOpp(); o.pid = pid; o.round = num(d.seed) >>> 0; }
    o.name = nameOk(d.name) ? d.name : ''; o.ch = d.ch === 'mozah' ? 'mozah' : 'abood'; o.robe = String(d.robe || '').slice(0, 24); o.head = String(d.head || '').slice(0, 24);
    o.here = true; o.gone = false;
    if (back) {
      const wasLost = o.lost; o.lost = false; o.buf = []; o.off = null;
      if (race.seed && o.round === race.seed) {
        if ((num(d.seed) >>> 0) === race.seed) { // the same race: catch up with where they are now
          if (d.me) { o.out = true; o.run = false; o.d = Math.max(0, num(d.me.d) | 0); o.tm = finTm(d.me); } else { o.d = Math.max(o.d, num(d.d) | 0); o.run = !!d.live; }
        } else if (!o.out) { o.out = true; o.run = false; } // their page restarted mid-race: their last record counts
      }
      if (wasLost) { if (st === 'play' || st === 'pause') floatText(T('mp_back', oppName(), oppGirl()), worldX + 80, 120, '#7ee0b0'); else note(T('mp_back', oppName(), oppGirl())); }
    }
    renderFriend(); if (st === 'over') fillRace();
  } else if (d.t === 'go' && race.role === 'guest') {
    race.seed = num(d.seed) >>> 0; race.area = clamp(num(d.area) | 0, 0, M.AREAS.length - 1);
    Object.assign(race.match, { rd: clamp(num(d.rd) | 0, 1, ROUNDS), me: clamp(num(d.gw) | 0, 0, TO_WIN), opp: clamp(num(d.hw) | 0, 0, TO_WIN), over: false }); // the host keeps the score
    $('cPick').hidden = true; beginRace();
  } else if (d.t === 'pick' && race.role === 'host') {
    if (nextPicker() === 'guest') hostGo(num(d.area) | 0); // the friend lost the last round, so they chose the course
  } else if (d.t === 'out') {
    if (o.round !== race.seed) return;
    o.out = true; o.run = false; o.d = Math.max(0, num(d.d) | 0); o.s = num(d.s) | 0; o.tm = finTm(d);
    if (st === 'play' || st === 'pause') floatText(o.tm != null ? T('sp_oppFin', oppName(), oppGirl(), fmtTm(o.tm)) : T('mp_oppOut', oppName(), o.d), worldX + 80, 120, '#ffe066');
    fillRace();
  } else if (d.t === 'bye') oppGone();
  else if (d.t === 'full') { note(T('mp_full'), 3500); leaveRace(); }
});
function oppGone() { // the friend left on purpose
  if (!race || race.opp.gone) return; const o = race.opp;
  o.gone = true; o.lost = false; o.run = false;
  if (o.here) note(T('mp_left', oppName(), oppGirl()), 3000);
  if (race.role === 'guest') N.leave(); // the host closed the room: stop reconnecting
  if (!$('friend').hidden) {
    if (race.role === 'host' && race.code) { race.opp = newOpp(); race.fs = 'waiting'; } // another friend can still join the same code
    else { race.fs = 'err'; race.err = 'noroom'; }
  }
  renderFriend(); if (st === 'over') fillRace();
}
const pickReady = () => race && N.isOpen() && race.opp.here && !race.opp.lost && st !== 'play' && st !== 'pause' &&
  !(race.me && race.opp.round === race.seed && !race.opp.out); // the next round starts once both have finished
function hostGo(area) {
  if (!race || race.role !== 'host' || !pickReady()) return;
  const m = race.match; if (!m.rd || m.over) Object.assign(m, newMatch(), { rd: 1 }); else m.rd++;
  race.seed = crypto.getRandomValues(new Uint32Array(1))[0] || 1; race.area = clamp(area | 0, 0, M.AREAS.length - 1);
  N.send({ t: 'go', seed: race.seed, area: race.area, rd: m.rd, hw: m.me, gw: m.opp }); $('cPick').hidden = true; beginRace();
}
// who picks the next course: the loser of the last round, or of the match once it is over; the host on a tie
function nextPicker() {
  const m = race.match; if (!m.rd) return 'host';
  const r = m.over ? Math.sign(m.me - m.opp) : m.last, other = race.role === 'host' ? 'guest' : 'host';
  return r > 0 ? other : r < 0 ? race.role : 'host';
}
const iPick = () => !!race && !!race.role && nextPicker() === race.role;
// the course picker: every area, as picture cards
function openPick() {
  if (!race || !iPick() || !pickReady()) return;
  const m = race.match, fresh = !m.rd || m.over, row = $('cpRow'); row.innerHTML = ''; dragScroll(row);
  $('cpRound').textContent = T('sp_round', fresh ? 1 : m.rd + 1, ROUNDS);
  $('cpHint').textContent = T(!m.rd ? 'sp_pickFirst' : m.over ? 'sp_pickMatch' : 'sp_pickLost');
  M.AREAS.forEach((a, i) => {
    const b = el('button', 'area-card'); b.type = 'button'; b.setAttribute('aria-label', T('zn_' + a.id));
    const pic = mk(TH_W, TH_H); pic.setAttribute('aria-hidden', 'true'); b.appendChild(pic);
    setTimeout(() => pic.getContext('2d').drawImage(areaThumb(i), 0, 0), 20 + i * 30);
    b.appendChild(el('b', null, T('zn_' + a.id))); b.appendChild(el('small', null, T('sp_len', SPRINT_M)));
    b.onclick = () => { if (row.moved) return; unlockAudio(); pickCourse(i); };
    row.appendChild(b);
  });
  $('cPick').hidden = false;
}
function pickCourse(i) {
  $('cPick').hidden = true;
  if (race.role === 'host') { hostGo(i); return; }
  race.picked = true; N.send({ t: 'pick', area: i }); fillRace(); renderFriend();
}
$('cpCancel').onclick = () => { unlockAudio(); $('cPick').hidden = true; };
// a race doesn't end on a fall or on Baba: both cost time
function finishSprint(dt) {
  const over = (dist - SPRINT_M) / Math.max(1, speed / 40); // how long ago this frame crossed the line
  race.myTm = Math.max(0, race.runT + dt - over);
  worldX = SPRINT_M * 40; dist = SPRINT_M; routeM = startM + dist; gameOver('finish');
}
function sprintFell() { // out on the far side of the hole after a short stop: it costs time, and nobody gets stuck on a jump
  let x1 = worldX; for (const g of gaps) if (g.x0 < worldX + 20 && g.x1 > worldX - 260) x1 = Math.max(x1, g.x1);
  worldX = x1 + 30; dist = worldX / 40; routeM = startM + dist;
  Object.assign(kid, { y: GROUND, vy: 0, on: true, jumps: 0, spin: 0, inv: 1.8, held: 1.5 }); focusT = 0; focusLv = 0;
  shake = 0.25; sfx.hit(); buzz(50); shout(T('s_fell')); floatText(T('sp_fell'), worldX + 40, GROUND - 100, '#ffb3b3');
}
function sprintCaught() { // Baba grabs you, tells you off, and lets go
  lead = 0.45; Object.assign(kid, { held: 1, inv: 1.6, stumble: 0 }); focusT = 0; focusLv = 0;
  shake = 0.3; sfx.hit(); buzz([40, 30, 40]); shout(T('s_got')); kidSay(T('s_sorry'), 1); floatText(T('sp_caught'), worldX + 40, kid.y - 100, '#ffb3b3');
}
// 1: I won the round, -1: the friend did, 0: a tie. The faster finish wins; a finish beats no finish (a friend who left).
function roundRes() {
  const mt = race.me.tm, o = race.opp, ot = o.out ? o.tm : null;
  if (mt != null && ot != null) return Math.abs(mt - ot) < 0.05 ? 0 : mt < ot ? 1 : -1;
  if (mt != null) return 1; if (ot != null) return -1;
  return Math.sign(race.me.d - o.d);
}
function beginRace() {
  if (!race) return;
  $('friend').hidden = true; $('menu').hidden = true; $('over').hidden = true; $('sheet').hidden = true; $('loginPop').hidden = true; $('cPick').hidden = true;
  if (swap && !swap.done) endSwap(); swap = null;
  Object.assign(race.opp, { round: race.seed, d: 0, s: 0, tm: null, out: false, run: false, buf: [], off: null });
  race.me = null; race.final = false; race.picked = false;
  sbCache.fill(null); start(race); graceT = 0; race.hold = 3; race.goT = 0; race.sendT = 0; race.runT = 0; race.myTm = 0; play('tek', 1.2, 0.9); // no 2-minute grace: Baba chases at full pace from the start
}
function raceHold(dt) {
  const k = Math.ceil(race.hold); race.hold -= dt;
  if (race.hold <= 0) { race.hold = 0; race.goT = 0.8; sfx.zone(); buzz(30); }
  else if (Math.ceil(race.hold) !== k) play('tek', 1.2, 0.9);
  raceTick(dt); hud();
}
function raceTick(dt) {
  race.goT = Math.max(0, race.goT - dt);
  if (race.hold <= 0 && st === 'play') race.runT += dt; // the race clock: game time, so a slow phone isn't penalised
  race.sendT -= dt; if (race.sendT > 0) return; race.sendT = 0.05;
  N.send({ t: 'p', ts: Math.round(performance.now()), x: Math.round(worldX), y: Math.round(kid.y), d: Math.floor(dist), s: candies, a: kid.on ? 0 : 1, sc: kid.scoot > 0 ? 1 : 0 });
}
// where the ghost is now: GHOST_DELAY ms in the past, between the two positions around that moment
function ghostPos() {
  const b = race.opp.buf; if (!b.length) return null;
  const rt = performance.now() - GHOST_DELAY;
  let i = b.length - 1; while (i > 0 && b[i].t > rt) i--;
  const p = b[i], q = b[i + 1];
  if (q) { const f = clamp((rt - p.t) / Math.max(1, q.t - p.t), 0, 1); return { x: p.x + (q.x - p.x) * f, y: p.y + (q.y - p.y) * f, a: f < 0.5 ? p.a : q.a, sc: q.sc }; }
  const r = b[i - 1]; if (!r || rt < p.t) return p;
  const vx = (p.x - r.x) / Math.max(1, p.t - r.t); // past the newest one: keep going a little (up to 0.25 s)
  return { x: p.x + vx * Math.min(250, rt - p.t), y: p.y, a: p.a, sc: p.sc };
}
function tag(c, txt, x, y) {
  c.save(); c.font = '800 14px ' + FONT; c.direction = getLang() === 'ar' ? 'rtl' : 'ltr'; c.textAlign = 'center'; c.textBaseline = 'middle';
  const w = c.measureText(txt).width + 18; x = clamp(x, w / 2 + 6, W - w / 2 - 6);
  c.globalAlpha = 0.92; c.fillStyle = '#fffaf0'; c.strokeStyle = INK; c.lineWidth = 2; c.beginPath(); c.roundRect(x - w / 2, y - 12, w, 24, 12); c.fill(); c.stroke();
  c.globalAlpha = 1; c.fillStyle = INK; c.fillText(txt, x, y + 1); c.restore();
}
function drawGhost(c) {
  const o = race.opp; if (!o.here || o.gone || o.out || o.round !== race.seed) return;
  const name = oppName();
  if (o.lost) { tag(c, T('mp_lostTag', name), W / 2, 150); return; }
  const g = o.run && ghostPos(); if (!g) return;
  const x = g.x - worldX + ABX;
  if (x > -40 && x < W + 40) {
    let y = g.y; const a = g.a && !g.sc, idx = a || g.sc ? 0 : qph(g.x * 0.034), look = oppLook();
    c.save(); c.globalAlpha *= 0.5;
    if (g.sc) { scooter(c, x, y); y -= 6; }
    const e = spriteGet('gh' + o.ch + o.robe + o.head + (a ? 1 : 0) + (g.sc ? 1 : 0) + idx, KB, gg => person(gg, 0, 0, idx * STEP, a, Object.assign(look, { mouth: 'grin', still: g.sc, arm: g.sc ? 'grip' : undefined, baked: true })));
    if (e) blitSprite(c, e, x, y, 0, 1, 1, 1, null); else person(c, x, y, idx * STEP, a, Object.assign(look, { mouth: 'grin', still: g.sc, arm: g.sc ? 'grip' : undefined }));
    c.restore();
    tag(c, name, x, y - 98);
  } else {
    const m = Math.round(Math.abs(g.x - worldX) / 40), ahead = g.x > worldX;
    tag(c, T(ahead ? 'mp_ahead' : 'mp_behind', name, m), ahead ? W - 80 : 80, 150);
  }
}
// the finish line: a checkered strip on the ground and a banner on two poles
function drawFinish(c, x) {
  if (x < -90 || x > W + 90) return;
  const top = GROUND - 150, sq = 8;
  c.save(); c.lineWidth = 2; c.strokeStyle = INK;
  for (let i = 0; i < 2; i++) for (let j = 0; j < 3; j++) { c.fillStyle = (i + j) % 2 ? INK : '#fffaf0'; c.fillRect(x - sq + i * sq, GROUND + j * 4, sq, 4); }
  for (const px of [x - 66, x + 66]) { c.fillStyle = '#d9b57f'; c.fillRect(px - 3, top, 6, GROUND - top); c.strokeRect(px - 3, top, 6, GROUND - top); }
  c.fillStyle = '#fffaf0'; c.beginPath(); c.roundRect(x - 74, top - 4, 148, 30, 6); c.fill(); c.stroke();
  for (let i = 0; i < 18; i++) { c.fillStyle = i % 2 ? INK : '#fffaf0'; c.fillRect(x - 72 + i * 8, top + 20, 8, 4); }
  c.font = '800 16px ' + FONT; c.textAlign = 'center'; c.textBaseline = 'middle'; c.direction = getLang() === 'ar' ? 'rtl' : 'ltr';
  c.fillStyle = '#c8202b'; c.fillText(T('sp_finish'), x, top + 9); c.restore();
}
function drawCountdown(c) {
  if (race.hold <= 0 && race.goT <= 0) return;
  const go = race.hold <= 0, txt = go ? T('mp_go') : String(Math.ceil(race.hold)), f = go ? race.goT / 0.8 : race.hold % 1, s = REDUCED ? 1 : 1 + 0.25 * f;
  c.save(); c.translate(W / 2, 205); c.scale(s, s); c.font = '800 72px ' + FONT; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.direction = getLang() === 'ar' ? 'rtl' : 'ltr'; c.globalAlpha = go ? Math.min(1, f * 2) : 1;
  c.lineJoin = 'round'; c.lineWidth = 8; c.strokeStyle = INK; c.strokeText(txt, 0, 0); c.fillStyle = go ? '#ffe066' : '#fffaf0'; c.fillText(txt, 0, 0); c.restore();
}
function fillRace() {
  const box = $('raceBox');
  if (!race) { box.hidden = true; $('over').classList.remove('racing'); return; }
  const o = race.opp, on = !!race.me && !!race.seed && o.round === race.seed, done = o.out || o.gone || !o.here;
  const live = N.isOpen() && o.here && !o.gone && !o.lost, m = race.match, name = oppName(), g = oppGirl();
  if (on && done && race.scored !== race.seed) { // count the round once, the moment both results are in
    race.scored = race.seed; const r = roundRes(); m.last = r; if (r > 0) m.me++; else if (r < 0) m.opp++;
    m.over = m.me >= TO_WIN || m.opp >= TO_WIN || m.rd >= ROUNDS;
  }
  const scored = on && race.scored === race.seed, mine = scored && live && iPick();
  $('over').classList.toggle('racing', on);
  $('againBtn').hidden = !mine; $('againBtn').disabled = false; $('againBtn').textContent = T(m.over ? 'sp_newMatch' : 'sp_next');
  $('againHint').textContent = !scored || !live ? '' : race.picked ? T('sp_starting') : mine ? '' : T('sp_theyPick', name, g); $('overMenuBtn').textContent = T('mp_leave');
  if (!on) { box.hidden = true; return; }
  const me = race.me, r = scored ? m.last : 0, left = done && !o.out; // left: the friend quit this round without a record
  box.hidden = false;
  $('raceMe').textContent = me.tm != null ? fmtTm(me.tm) : T('sp_m', me.d);
  $('raceOpp').textContent = o.out ? (o.tm != null ? fmtTm(o.tm) : T('sp_m', o.d)) : left ? '–' : T('sp_m', o.d);
  $('raceMeName').textContent = myName(); $('raceOppName').textContent = name;
  $('raceHead').textContent = !done ? (o.lost ? T('mp_lostWait', name, g, o.d) : T('mp_wait', name, g)) : left ? T('mp_winLeft')
    : r === 0 ? T('mp_tie') : m.over ? T(r > 0 ? 'sp_matchWin' : 'sp_matchLose', name, g) : T(r > 0 ? 'sp_rdWin' : 'sp_rdLose', name, g, m.rd);
  $('raceScore').textContent = T('sp_score', m.rd, ROUNDS) + ' · ' + myName() + ' ' + m.me + ' – ' + m.opp + ' ' + name;
  box.querySelector('.race-me').classList.toggle('win', scored && r > 0); box.querySelector('.race-opp').classList.toggle('win', scored && r < 0);
  if (scored && !race.final) { race.final = true; if (r > 0) { play('power', 1.4, 0.8); buzz(30); } }
}
function renderFriend() {
  if (!race || $('friend').hidden) return;
  const host = race.role === 'host', o = race.opp, fs = race.fs; let msg = '', go = null;
  const gate = fs === 'gate', choose = fs === 'choose' || fs === 'err', showCode = host && !!race.code && (fs === 'waiting' || o.lost || !o.here);
  $('fLoad').hidden = fs !== 'connecting'; $('fGate').hidden = !gate; $('fChoose').hidden = !choose; if (choose) fillNameTag(); $('fJoin').hidden = !choose; $('fVs').hidden = true; $('fCodeBig').hidden = !showCode;
  if (showCode) $('fCodeBig').textContent = N.showCode(race.code);
  if (gate) { msg = T('mp_gateLead'); go = 'mp_gateOk'; const ab = ($('fGateQ').dataset.ab || '').split('x'); if (ab.length === 2) $('fGateQ').textContent = T('mp_gateQ', ab[0], ab[1]); }
  else if (choose) { msg = fs === 'err' ? T('mp_err_' + race.err) : T('mp_choose'); go = 'mp_host'; }
  else if (fs === 'connecting') { msg = T(stageOf()[2]); $('fLoadHint').textContent = T(race.slow ? 'mp_slow' : 'mp_noTap'); }
  else if (o.lost) msg = host ? T('mp_lostTag', oppName()) : T('mp_reconnecting');
  else if (fs === 'waiting' || !o.here) msg = host ? T('mp_send') : T('mp_hello');
  else {
    $('fVs').hidden = false; $('fMeName').textContent = myName(); $('fOppName').textContent = oppName();
    msg = host ? T('mp_joined', oppName(), oppGirl()) : T('sp_waitPick', oppName(), oppGirl()); if (host) go = 'mp_start';
  }
  $('fStatus').textContent = msg; $('fGo').hidden = !go; if (go) { $('fGo').textContent = T(go); $('fGo').dataset.act = go; }
}
$('friendBtn').onclick = () => { unlockAudio(); openFriend('choose'); };
$('fLeave').onclick = () => { unlockAudio(); leaveRace(); };
$('fJoin').onclick = () => { unlockAudio(); openPop('code'); };
$('fGo').onclick = () => {
  unlockAudio(); const a = $('fGo').dataset.act;
  if (a === 'mp_start') openPick(); // the host picks the first course
  else if (a === 'mp_gateOk') gateOk();
  else if (a === 'mp_host') goHost();
};
$('overMenuBtn').onclick = () => { if (race) leaveRace(); if (swap && !swap.done) endSwap(); swap = null; st = 'menu'; $('over').hidden = true; startM = M.AREAS[M.startArea()].at; reset(); worldX = 0; showMenu(); };
onLang(() => { renderFriend(); if (swap && !swap.done) endSwap(); if (st === 'over' && lastOver) { const fin = lastOver.why === 'finish'; dad.say = T(fin ? 's_fin' : lastOver.why === 'fell' ? 's_fell' : 's_got'); kid.say = T(fin ? 's_finKid' : 's_sorry'); } else { dad.sayT = 0; kid.sayT = 0; } fillOver(); showBest(); renderMenu(); if (!$('sheet').hidden) openSheet(sheetKind); hudCache.fill(null); lastHud = ''; });
const fmt = s => s.replace('{n}', kname());
function shout(s, d = 1.8) { dad.say = fmt(s); dad.sayT = d; }
function kidSay(s, d = 1.6) { kid.say = fmt(s); kid.sayT = d; }
function showBanner(z) { banner = { z, t: 0 }; }

// ---------- update ----------
function dadScreenX() { return ABX - 36 - lead * (ABX - 70); }
function puff(x, y, n, col, spd = 60, up = 10) { n = Math.ceil(n * FX); for (let i = 0; i < n && parts.length < MAXP; i++) parts.push({ x, y, vx: rnd(-spd, spd) - speed * 0.2, vy: rnd(-spd, up), life: rnd(0.3, 0.6), max: 0.6, col, r: rnd(2.5, 5) }); }
function floatText(s, x, y, col = '#ffe066') { parts.push({ x, y, vx: -speed * 0.12, vy: -55, life: 1.1, max: 1.1, text: s, col }); }

function update(dt) {
  t += dt; stT += dt; music();
  updAmbient(dt);
  if (banner) { banner.t += dt; if (banner.t > 3.4) banner = null; }
  if (st === 'menu') {
    worldX += 240 * dt; dist = worldX / 40; routeM = startM + dist; kid.ph += dt * 9; dad.ph += dt * 10; gen(); gaps.length = 0; obs.length = 0; items.length = 0; plats.length = 0;
    dad.sayT -= dt; kid.sayT -= dt; if (dad.sayT < -1.2) shout(pick(T('s_shouts')), 2); if (kid.sayT < -3 && dad.sayT < 0) kidSay(pick(T('s_taunts')), 1.6);
    zoneNow = zoneAt(routeM); return;
  }
  if (st === 'over') { updParts(dt); kid.ph += dt * 16; return; }
  if (st !== 'play') return;
  if (race && race.hold > 0) { raceHold(dt); return; } // the 3-2-1 countdown: everyone stands still
  playT += dt; // stops while paused or on the results card, so moving obstacles and the mercy window don't jump

  const base = runSpeed(dist);
  speed = base * Math.max(boost > 0 ? 1.3 : 1, kid.scoot > 0 ? 1.42 : 1) * (kid.stumble > 0 ? 0.65 : 1) * (kid.held > 0 ? 0 : 1);
  worldX += speed * dt; dist = worldX / 40; routeM = startM + dist;
  if (race && dist >= SPRINT_M) { finishSprint(dt); return; }
  const z = zoneAt(routeM); if (z !== zoneNow) { zoneNow = z; showBanner(z); sfx.zone(); lead = Math.min(1, lead + 0.05); M.track('zone', z); if (z === 0) floatText(T('loopBack'), worldX + 60, 150, '#9ff0ff'); }
  if (run) run.zoneMax = Math.max(run.zoneMax, z);
  while (routeM >= nextStop.abs - 20) { passStop(M.STOPS[nextStop.i]); prevStopAt = nextStop.abs; nextStop = stopAfter(nextStop.abs); }
  if (stopBanner) { stopBanner.t += dt; if (stopBanner.t > 3.8) stopBanner = null; }
  badgeTimer -= dt; if (badgeTimer <= 0 && run) { badgeTimer = 1; syncRun(); M.runTick(run); missionPops();
    for (const b of M.checkBadges({ dist, close: closeCalls })) { runBadges.push(b); floatText(T('f_badge', badgeName(b)), worldX + 60, 140, '#ffe066'); sfx.zone(); } }

  director(dt);
  focusT += dt; const fl = Math.min(FOCUS_MAX, Math.floor(focusT / FOCUS_STEP));
  if (fl > focusLv) { focusLv = fl; maxFocus = Math.max(maxFocus, fl); floatText(T('f_focus', fl), worldX + 40, kid.y - 90, '#9ff0ff'); sfx.close(); }
  let dl = -(0.03 + Math.min(0.11, dist * 0.000016)) * (race ? 1 : M.robeOf().slow || 1) * (1 - 0.1 * focusLv) * assist; // Baba closes in steadily: 0.046/s at 1 km, 0.078/s at 3 km, 0.11/s at 5 km, 0.14/s from ~7 km. Gold kandura 0.6, kits 0.8
  if (graceT > 0) { graceT = Math.max(0, graceT - dt); dl *= graceK(); }
  if (dad.freeze > 0) dl = 0.12; else if (dad.slow > 0) dl = 0.065;
  if (boost > 0) dl += 0.09; if (kid.scoot > 0) dl += 0.1;
  if (kid.held > 0) dl = 0; // Baba has just let go of you
  lead = clamp(lead + dl * dt, 0, 1);

  boost = Math.max(0, boost - dt); dad.slow = Math.max(0, dad.slow - dt); dad.freeze = Math.max(0, dad.freeze - dt);
  kid.scoot = Math.max(0, kid.scoot - dt); kid.mag = Math.max(0, kid.mag - dt);
  kid.inv = Math.max(0, kid.inv - dt); kid.stumble = Math.max(0, kid.stumble - dt); kid.held = Math.max(0, kid.held - dt); shake = Math.max(0, shake - dt);
  comboT -= dt; if (comboT < 0) combo = 0;

  // kid physics (coyote time + jump buffer + variable jump height)
  kid.buf -= dt; kid.coyote -= dt;
  if (kid.buf > 0) {
    if (kid.on || kid.coyote > 0) { kid.vy = -760; kid.on = false; kid.jumps = 1; kid.coyote = 0; kid.buf = 0; sfx.jump(); puff(worldX, GROUND, 5, '#e7cfa3'); }
    else if (kid.jumps < 2) { kid.vy = -650; kid.jumps = 2; kid.buf = 0; kid.spin = 0.001; sfx.dbl(); puff(worldX - 6, kid.y - 10, 8, '#ffffff', 80); }
  }
  kid.vy += 2300 * dt * (!holding && kid.vy < 0 ? 2.2 : 1);
  const py = kid.y; kid.y += kid.vy * dt; kid.on = false;
  if (kid.vy >= 0) {
    for (const p of plats) { if (worldX + 8 > p.x && worldX - 8 < p.x + p.w && py <= p.y + 1 && kid.y >= p.y) { kid.y = p.y; land(); break; } }
    if (!kid.on && !overGap(worldX) && py <= GROUND + 1 && kid.y >= GROUND) { kid.y = GROUND; land(); }
  }
  if (kid.spin > 0) { kid.spin += dt * TAU / 0.42; if (kid.spin >= TAU || kid.on) kid.spin = 0; }
  if (kid.on) { kid.coyote = 0.1; kid.ph += dt * speed * 0.034; if (Math.random() < dt * (kid.scoot > 0 ? 30 : 8)) puff(worldX - 8, kid.y, 1, kid.scoot > 0 ? '#fff4c2' : '#e7cfa3', 20); }
  if (kid.y > H + 40) { if (race) sprintFell(); else { gameOver('fell'); return; } } // a race: a fall costs time, not the race

  // obstacles
  for (const o of obs) {
    const d = OB[o.kind];
    if (o.hit) { o.hx += o.hvx * dt; o.hy += o.hvy * dt; o.hvy += 1600 * dt; o.rot += dt * o.spin; continue; }
    if (d.vx) { const nx = o.x + d.vx * dt; if (!overGap(nx, 0) && !overGap(nx + o.w, 0)) o.x = nx; o.ph += dt * (o.kind === 'lizard' ? 22 : o.kind === 'dbike' || o.kind === 'buggy' ? 16 : 10); }
    if (d.side) { o.x = o.x0 + Math.sin(playT * 2.4 + o.seed) * 26; o.ph += dt * 8; }
    o.lift = d.bounce ? Math.abs(Math.sin(playT * 4.2 + o.seed)) * 46 : 0;
    if (d.bounce) o.ph -= dt * 6;
    const top = GROUND - o.lift - o.h, bot = GROUND - o.lift;
    const ox = worldX + 9 > o.x + 4 && worldX - 9 < o.x + o.w - 4;
    if (ox) o.clear = Math.min(o.clear, top - kid.y);
    if (ox && kid.y > top + 4 && kid.y - 54 < bot) {
      if (kid.scoot > 0) { knock(o, 520, -520); sfx.smash(); M.track('smash'); floatText(T('f_smash'), o.x, top - 10, '#ffb3b3'); shake = 0.15; }
      else if (kid.inv <= 0) hitKid(o.x + o.w / 2, top + o.h / 2, () => knock(o, 220, -400));
    }
    if (!o.passed && o.x + o.w < worldX - 10) { o.passed = true; if (!o.hit && o.clear >= 0 && o.clear < 20) closeCall(o.x + o.w / 2, top - 20); }
  }
  // flying sandals (screen space)
  for (const s of sandals) {
    s.age += dt;
    if (!s.hit) {
      s.sx += 450 * dt; s.y = GROUND - 8 - Math.abs(Math.sin(s.age * 12)) * 7; s.rot += dt * 14;
      if (Math.abs(s.sx - ABX) < 14 && kid.y > s.y - 7) { s.hit = true; s.vy = -480; if (kid.scoot <= 0 && kid.inv <= 0) hitKid(worldX, kid.y - 20); else sfx.smash(); }
      if (!s.passed && s.sx > ABX + 16) { s.passed = true; if (!s.hit) M.track('dodge'); if (!s.hit && !kid.on && kid.y > GROUND - 110) closeCall(worldX, kid.y - 60); }
    } else { s.sx -= 120 * dt; s.y += s.vy * dt; s.vy += 1500 * dt; s.rot += dt * 20; }
  }
  compact(sandals, s => s.sx < W + 60 && s.y < H + 60);
  // items
  for (const it of items) {
    if (it.got) continue;
    if (kid.mag > 0 && (it.kind === 'candy' || it.kind === 'jar') && it.x - worldX < 240 && it.x - worldX > -40) { it.mag = 1; const k = Math.min(1, dt * 9); it.x += (worldX - it.x) * k + speed * dt * 0.6; it.y += ((kid.y - 30) - it.y) * k; }
    const dx = it.x - worldX, dy = it.y - (kid.y - 30);
    if (dx * dx + dy * dy < 32 * 32) { it.got = true; grab(it); }
  }
  if (lead <= 0) { if (race) sprintCaught(); else { lead = 0; gameOver('caught'); return; } }

  // dad
  dad.wx = worldX - (ABX - dadScreenX());
  if (dad.freeze <= 0) {
    dad.ph += dt * speed * (dad.slow > 0 ? 0.04 : 0.03);
    if (dad.on) {
      let ahead = false;
      for (const o of obs) if (!o.hit && o.x - dad.wx > 18 && o.x - dad.wx < 80) { ahead = true; break; }
      if (!ahead) for (const g of gaps) if (g.x0 - dad.wx > 4 && g.x0 - dad.wx < 60) { ahead = true; break; }
      if (ahead) { dad.vy = -740; dad.on = false; }
    }
  }
  dad.vy += 2300 * dt; dad.y += dad.vy * dt; if (dad.y >= GROUND) { dad.y = GROUND; dad.vy = 0; dad.on = true; }
  dad.sayT -= dt; dad.next -= dt; dad.anger = Math.max(0, dad.anger - dt * 0.08);
  if (dad.anger < (1 - lead) * 0.7) dad.anger += dt * 0.1;
  if (dad.next <= 0 && dad.freeze <= 0 && dad.windup <= 0) { shout(pick(T('s_shouts'))); dad.next = rnd(2.8, 4.8); }
  if (dad.anger > 0.45 && Math.random() < dt * 6 * FX && parts.length < MAXP) { const fx = dadScreenX(); parts.push({ x: worldX - (ABX - fx) - 4, y: dad.y - 92, vx: -speed * 0.9 + rnd(-20, 20), vy: -rnd(40, 80), life: 0.7, max: 0.7, col: '#ffffff', r: rnd(3, 6), steam: 1 }); }
  // sandal throwing
  dad.cd -= dt;
  if (dist > 1000 && dad.cd <= 0 && dad.has && dad.freeze <= 0 && dad.slow <= 0 && dad.windup <= 0 && dad.on) { dad.windup = 0.85; shout(pick(T('s_throw')), 1.2); }
  if (dad.windup > 0) { dad.windup -= dt; if (dad.windup <= 0) { sandals.push({ sx: dadScreenX() + 16, y: GROUND - 10, age: 0, rot: 0, hit: false, passed: false }); dad.has = false; dad.regrab = 1.6; dad.cd = (rnd(8, 12) - Math.min(4, dist / 1500)) * sandalMul; sfx.whoosh(); } }
  if (!dad.has) { dad.regrab -= dt; if (dad.regrab <= 0) dad.has = true; }
  // kid chatter
  kid.sayT -= dt; kid.next -= dt;
  if (kid.next <= 0) { if (lead > 0.7) { kidSay(pick(T('s_taunts'))); dad.anger = Math.min(1, dad.anger + 0.25); } else if (lead < 0.22) kidSay(pick(T('s_scared'))); kid.next = rnd(4, 7); }

  if (race) raceTick(dt);
  updParts(dt); gen(); hud();
}
function land() { kid.vy = 0; kid.on = true; if (kid.jumps) puff(worldX, kid.y, 4, '#e7cfa3', 70); kid.jumps = 0; }
function knock(o, vx, vy) { o.hit = true; o.hvx = vx; o.hvy = vy; o.spin = rnd(6, 12); puff(o.x + o.w / 2, GROUND - o.h / 2, 10, '#c9a36b', 120); }
function hitKid(x, y, after) {
  if (kid.shield > 0) { kid.shield = 0; kid.inv = 1.2; after && after(); floatText(T('f_shield'), worldX, kid.y - 70, '#9fd8ff'); sfx.smash(); return; }
  if (run) run.noHit = Math.max(run.noHit, dist - runHit); runHit = dist;
  kid.stumble = 0.6; kid.inv = 1.3; lead -= 0.13; focusT = 0; focusLv = 0; hitTimes.push(playT); hitTimes = hitTimes.filter(h => playT - h < 30); if (hitTimes.length >= 3 && mercyT <= 0) { mercyT = 10; hitTimes = []; } shake = 0.3; sfx.hit(); buzz(50); after && after();
  puff(x, y, 6, '#ffffff', 100); parts.push({ x: worldX, y: kid.y - 64, vx: 0, vy: 0, life: 0.6, max: 0.6, stars: 1 });
  shout(pick(T('s_hit')));
}
function syncRun() {
  if (!run) return;
  run.dist = dist; run.sweets = candies; run.close = closeCalls; run.route = race ? 0 : routeM; // a race on a course you haven't reached doesn't unlock it
  run.noHit = Math.max(run.noHit, dist - runHit); run.comboMax = Math.max(run.comboMax, comboMax); run.focusMax = Math.max(run.focusMax, maxFocus); run.powers = runPow;
}
const missionText = d => T('ms_' + d.kind, d.goal);
function missionPops() {
  for (const d of M.takeDone()) {
    runDone.push(d); floatText('✓ ' + missionText(d), worldX + 80, 116, '#7ee0b0'); play('power', 1.25, 0.8); buzz(30);
    if (d.set === 'ladder' && M.ensureLadder().missions.every(m => m.done)) floatText(T('f_setDone'), worldX + 140, 146, '#ffe066');
  }
}
function passStop(s) {
  const got = race ? 0 : M.reachStop(s.id); // landmarks pay out on your own journey, not in a race if (run) run.stops++; lastStop = s;
  stopBanner = { id: s.id, t: 0, got }; sfx.close(); if (got) { play('zone', 1.2); buzz(20); }
}
function closeCall(x, y) { closeCalls++; M.track('close'); focusT += 3; lead = Math.min(1, lead + 0.02); sfx.close(); floatText(T('f_close'), x, y, '#9ff0ff'); }
function grab(it) {
  if (it.kind === 'candy' || it.kind === 'jar') {
    combo = comboT > 0 ? combo + 1 : 1; comboT = 0.7; comboMax = Math.max(comboMax, combo); const mult = Math.min(5, 1 + Math.floor(combo / 6));
    const gain = (it.kind === 'jar' ? 15 : 1) * mult; candies += gain; candyCount += gain; M.track('sweets', gain); sfx.candy(mult); puff(it.x, it.y, 4, '#ffd34d', 60);
    parts.push({ x: it.x, y: it.y, vx: -speed * 0.2, vy: 0, life: 0.35, max: 0.35, ring: 1 });
    if (it.kind === 'jar') floatText(T('f_jar', gain), it.x, it.y - 20);
    else if (combo % 6 === 0) floatText(T('f_combo', mult), it.x, it.y - 22, '#ffb3e6');
    if (candyCount >= 10) { candyCount -= 10; lead = Math.min(1, lead + 0.06); }
    bump('candyBox'); return;
  }
  sfx.power(); puff(it.x, it.y, 16, '#fff6c2', 150); buzz(25); M.track('power', it.kind); runPow++;
  if (it.kind === 'vimto') { boost = Math.max(boost, pT('vimto')); floatText(T('f_vimto'), it.x, it.y - 24); kidSay(T('s_yay'), 1.2); }
  if (it.kind === 'marbles') { dad.slow = pT('marbles'); dad.windup = 0; shout(T('s_slip'), 2); for (let i = 0; i < 8; i++) parts.push({ x: it.x, y: GROUND - 4, vx: -rnd(250, 420), vy: -rnd(0, 120), life: 1.3, max: 1.3, col: pick(['#3fa7d6', '#f25f5c', '#7bd389', '#ffe066']), r: 3.5, marble: 1 }); floatText(T('f_slip'), it.x, it.y - 24); }
  if (it.kind === 'phone') { dad.freeze = pT('phone'); dad.windup = 0; shout(T('s_phone'), dad.freeze); floatText(T('f_phone'), it.x, it.y - 24); }
  if (it.kind === 'magnet') { kid.mag = Math.max(kid.mag, pT('magnet')); floatText(T('f_magnet'), it.x, it.y - 24); }
  if (it.kind === 'scooter') { kid.scoot = Math.max(kid.scoot, pT('scooter')); floatText(T('f_scooter'), it.x, it.y - 24); kidSay(T('s_scoot'), 1.4); }
}
function bump(id) { const el = $(id); el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }
function updParts(dt) {
  for (const p of parts) { p.x += p.vx * dt; p.y += p.vy * dt; if (!p.text && !p.marble && !p.steam && !p.ring && !p.stars) p.vy += 200 * dt; if (p.marble && p.y > GROUND - 4) { p.y = GROUND - 4; p.vy *= -0.4; } p.life -= dt; }
  compact(parts, p => p.life > 0);
}
const SEA = [1, 0, 0, 1, 1, 1, 0, 0, 0, 0, 1]; // areas by the sea get gulls
function updAmbient(dt) {
  const z = zoneAt(routeM), tf = tunnelF(routeM), sp = (st === 'play' ? speed : 240);
  if (birds.length < 4 && Math.random() < dt * 0.25 && tf <= 0) {
    const n = SEA[z] ? 3 : pick([2, 3, 5]); const y = rnd(40, 150), dir = Math.random() < 0.5 ? -1 : 1;
    for (let i = 0; i < n; i++) birds.push({ x: dir > 0 ? -30 - i * 24 : W + 30 + i * 24, y: y + rnd(-14, 14), vx: dir * rnd(50, 80), ph: Math.random() * 6, gull: !!SEA[z] });
  }
  if (z === 1 && birds.length < 5 && Math.random() < dt * 0.04) birds.push({ x: W + 40, y: rnd(60, 120), vx: -rnd(30, 60), ph: 0, falcon: true });
  for (const b of birds) { b.x += (b.vx - sp * 0.1) * dt; b.ph += dt * 10; }
  compact(birds, b => b.x > -80 && b.x < W + 80);
  // aquarium life behind the glass tunnel
  if (tf > 0 && fish.length < 22 * FX && Math.random() < dt * 5) {
    const r = Math.random(), kind = r < 0.06 ? 'shark' : r < 0.12 ? 'ray' : r < 0.17 ? 'turtle' : r < 0.3 ? 'school' : 'fish', dir = Math.random() < 0.7 ? -1 : 1;
    fish.push({ kind, x: dir < 0 ? W + 80 : -80, y: rnd(30, GROUND - 60), vx: dir * rnd(20, 60) * (kind === 'shark' ? 1.4 : 1), ph: Math.random() * 6,
      s: kind === 'shark' ? rnd(1.1, 1.5) : kind === 'ray' ? rnd(0.9, 1.3) : rnd(0.6, 1.1), col: pick(['#ffb400', '#ff7a45', '#7ee0b0', '#8fd3ff', '#ffe066', '#ff5a8a', '#b48cff']) });
  }
  for (const f of fish) { f.x += (f.vx - sp * 0.16) * dt; f.ph += dt * (f.kind === 'ray' ? 2.5 : 8); f.y += Math.sin(f.ph * 0.3) * dt * 6; }
  compact(fish, f => f.x > -160 && f.x < W + 160);
}

// the race bar under the HUD: both runners on the way to the flag, your place and the metres left
const sbCache = [null, null, null, null];
function sprintHud() {
  const o = race.opp, with2 = o.here && !o.gone && o.round === race.seed, od = o.out && o.tm != null ? SPRINT_M : o.d;
  const pm = Math.round(clamp(dist / SPRINT_M, 0, 1) * 400) / 4, po = with2 ? Math.round(clamp(od / SPRINT_M, 0, 1) * 400) / 4 : -1;
  const place = !with2 ? 0 : (o.out && o.tm != null) || od > dist ? 2 : 1, left = Math.max(0, Math.ceil(SPRINT_M - dist));
  if (sbCache[0] !== pm) { sbCache[0] = pm; $('sbMe').style.left = pm + '%'; }
  if (sbCache[1] !== po) { sbCache[1] = po; $('sbOpp').hidden = po < 0; if (po >= 0) $('sbOpp').style.left = po + '%'; }
  if (sbCache[2] !== place) { sbCache[2] = place; $('sbPlace').hidden = !place; $('sbPlace').textContent = place ? T(place === 1 ? 'sp_1st' : 'sp_2nd') : ''; $('sbPlace').classList.toggle('first', place === 1); }
  if (sbCache[3] !== left) { sbCache[3] = left; $('sbLeft').textContent = T('sp_m', left); }
}
// HUD: write to the DOM only when a value changes
const hudCache = [null, null, null, null, null];
let lastHud = '';
function hud() {
  const d = Math.floor(dist), lf = Math.round(lead * 200) / 200, dg = lead < 0.25;
  if (hudCache[0] !== d) { hudCache[0] = d; $('mDist').textContent = d; }
  if (hudCache[1] !== candies) { hudCache[1] = candies; $('mCandy').textContent = candies; }
  if (hudCache[2] !== lf) { hudCache[2] = lf; $('leadFill').style.transform = 'scaleX(' + lf + ')'; }
  if (hudCache[3] !== dg) { hudCache[3] = dg; $('bar').classList.toggle('danger', dg); }
  const ns = M.STOPS[nextStop.i], rk = ns.id + Math.round((nextStop.abs - routeM) / 100);
  if (hudCache[4] !== rk) { hudCache[4] = rk;
    $('routeTxt').textContent = T('next', T('st_' + ns.id), kmTxt(Math.max(0, nextStop.abs - routeM)));
    $('routeFill').style.transform = 'scaleX(' + clamp((routeM - prevStopAt) / Math.max(1, nextStop.abs - prevStopAt), 0, 1).toFixed(3) + ')'; }
  if (race && race.seed) sprintHud();
  const chips = []; const ch = (k, v, m) => chips.push([T(k) + ' ' + v.toFixed(1) + T('sec'), v / m]);
  if (boost > 0) ch('c_vimto', boost, pT('vimto')); if (kid.scoot > 0) ch('c_scooter', kid.scoot, pT('scooter')); if (kid.mag > 0) ch('c_magnet', kid.mag, pT('magnet'));
  chips.push([T('c_focus', focusLv), focusLv >= FOCUS_MAX ? 1 : (focusT % FOCUS_STEP) / FOCUS_STEP]);
  if (dad.slow > 0) ch('c_slip', dad.slow, pT('marbles')); if (dad.freeze > 0) ch('c_phone', dad.freeze, pT('phone'));
  const h = chips.map(c => '<span class="chip">' + c[0] + '<i style="width:' + (c[1] * 100).toFixed(0) + '%"></i></span>').join('');
  if (h !== lastHud) { $('powers').innerHTML = h; lastHud = h; }
}

// ---------- drawing: people ----------
function limb(c, a, len, w, col, end, cuff) {
  c.save(); c.rotate(a); c.fillStyle = col; c.strokeStyle = INK; c.lineWidth = 1.4;
  c.beginPath(); c.roundRect(-w / 2, 0, w, len, w / 2); c.fill(); c.stroke();
  if (cuff) { c.strokeStyle = 'rgba(120,110,90,.55)'; c.lineWidth = 1; c.beginPath(); c.moveTo(-w / 2 + 1, len - 3); c.lineTo(w / 2 - 1, len - 3); c.stroke(); c.strokeStyle = INK; }
  if (end) end(c, len); c.restore();
}
const sockFoot = col => (c, len) => { // football socks and boots
  c.fillStyle = col; c.beginPath(); c.roundRect(-2.4, len - 9, 4.8, 9, 2); c.fill(); c.stroke();
  c.fillStyle = '#1d1f24'; c.beginPath(); c.ellipse(2.4, len + 0.4, 5.4, 2.3, 0, 0, TAU); c.fill(); c.stroke();
  c.strokeStyle = '#f4f4f2'; c.lineWidth = 1; c.beginPath(); c.moveTo(0, len - 0.4); c.lineTo(4.6, len - 0.4); c.stroke(); c.strokeStyle = INK; c.lineWidth = 1.4;
};
function kitBody(c, k) { // football jersey and shorts in club-inspired colours (no names or badges)
  const sh = () => { c.beginPath(); c.moveTo(-11, -26); c.lineTo(10.5, -26); c.lineTo(11.5, -14); c.lineTo(1.5, -14); c.lineTo(0, -18); c.lineTo(-1.5, -14); c.lineTo(-12, -14); c.closePath(); };
  sh(); c.fillStyle = k.shorts; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.5; c.stroke();
  c.strokeStyle = k.trim; c.lineWidth = 1.4; c.beginPath(); c.moveTo(-11.6, -18); c.lineTo(-11.2, -15); c.moveTo(11, -18); c.lineTo(11.3, -15); c.stroke();
  const jp = () => { c.beginPath(); c.moveTo(-8, -44); c.quadraticCurveTo(0, -47, 8, -44); c.quadraticCurveTo(10.5, -36, 10.5, -25); c.lineTo(-11, -25); c.quadraticCurveTo(-11, -36, -8, -44); c.closePath(); };
  jp(); c.fillStyle = k.main; c.fill();
  c.save(); c.clip();
  if (k.stripes) { c.fillStyle = k.trim; for (let x = -12; x < 12; x += 6) c.fillRect(x, -47, 2.6, 23); }
  if (k.band) { c.fillStyle = k.trim; c.fillRect(-12, -36, 24, 3.4); }
  c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(1, -46, 4, 21); c.fillStyle = 'rgba(0,0,0,.12)'; c.fillRect(-12, -46, 4, 21);
  c.restore();
  jp(); c.strokeStyle = INK; c.lineWidth = 1.6; c.stroke();
  c.strokeStyle = k.trim; c.lineWidth = 1.8; c.beginPath(); c.moveTo(-4, -44.6); c.lineTo(1.5, -40); c.lineTo(6.6, -44.6); c.stroke();
  c.fillStyle = k.num; c.font = '800 7px ' + FONT; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('7', -5, -35.5);
}
const sneaker = col => (c, len) => { // trainers under long trousers
  c.fillStyle = col; c.beginPath(); c.ellipse(2.4, len + 0.2, 5.6, 2.6, 0, 0, TAU); c.fill(); c.stroke();
  c.strokeStyle = '#c8202b'; c.lineWidth = 1; c.beginPath(); c.moveTo(-1.4, len - 0.2); c.lineTo(5.6, len - 0.2); c.stroke(); c.strokeStyle = INK; c.lineWidth = 1.4;
};
function sportBody(c, k) { // Mozah's modest sports set: a loose long-sleeve top to mid-thigh over long trousers
  const tp = () => { c.beginPath(); c.moveTo(-8, -44); c.quadraticCurveTo(0, -47, 8, -44); c.quadraticCurveTo(11, -32, 12.6, -13); c.lineTo(-13.4, -13); c.quadraticCurveTo(-12, -32, -8, -44); c.closePath(); };
  tp(); c.fillStyle = k.main; c.fill(); c.save(); c.clip();
  c.fillStyle = k.trim; c.fillRect(-15, -16.6, 30, 2.2); c.fillRect(8.2, -46, 2, 34); // hem band and a side stripe
  c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(1, -46, 4, 33); c.fillStyle = 'rgba(0,0,0,.12)'; c.fillRect(-14, -46, 4, 33);
  c.restore(); tp(); c.strokeStyle = INK; c.lineWidth = 1.6; c.stroke();
  c.strokeStyle = k.trim; c.lineWidth = 1.6; c.beginPath(); c.moveTo(-4, -44.6); c.quadraticCurveTo(1.5, -42, 6.6, -44.6); c.stroke();
}
function swimBody(c, k) { // rash guard and board shorts, or Mozah's full-length swimsuit (tunic over leggings)
  if (k.full) {
    const tu = () => { c.beginPath(); c.moveTo(-11.5, -28); c.lineTo(11, -28); c.quadraticCurveTo(13, -18, 13.6, -8.5); c.lineTo(-14.4, -8.5); c.quadraticCurveTo(-13, -18, -11.5, -28); c.closePath(); };
    tu(); c.fillStyle = k.top; c.fill(); c.save(); c.clip(); c.fillStyle = k.trim; c.fillRect(-16, -12, 32, 2.4); c.fillStyle = k.stripe; c.fillRect(-16, -15.2, 32, 1.6); c.restore();
    tu(); c.strokeStyle = INK; c.lineWidth = 1.5; c.stroke();
  }
  const sh = () => { c.beginPath(); c.moveTo(-11.5, -27); c.lineTo(11, -27); c.lineTo(12.2, -10.5); c.lineTo(2, -10.5); c.lineTo(0, -16); c.lineTo(-2, -10.5); c.lineTo(-12.8, -10.5); c.closePath(); };
  if (!k.full) {
  sh(); c.fillStyle = k.shorts; c.fill(); c.save(); c.clip(); c.fillStyle = k.stripe; c.fillRect(-13, -27, 3.2, 17); c.fillRect(9.4, -27, 3.2, 17);
  c.fillStyle = 'rgba(255,255,255,.22)'; for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(-6 + i * 4.4, -21 + (i % 2) * 5, 1.5, 0, TAU); c.fill(); } c.restore();
  sh(); c.strokeStyle = INK; c.lineWidth = 1.5; c.stroke();
  }
  const jp = () => { c.beginPath(); c.moveTo(-8, -44); c.quadraticCurveTo(0, -46.5, 8, -44); c.quadraticCurveTo(10.5, -36, 10.5, -25.5); c.lineTo(-11, -25.5); c.quadraticCurveTo(-11, -36, -8, -44); c.closePath(); };
  jp(); c.fillStyle = k.top; c.fill(); c.save(); c.clip();
  c.fillStyle = k.trim; c.fillRect(-12, -34, 24, 2.6); c.fillStyle = 'rgba(255,255,255,.2)'; c.fillRect(1, -46, 4, 21); c.fillStyle = 'rgba(0,0,0,.12)'; c.fillRect(-12, -46, 4, 21);
  if (k.cross) { c.fillStyle = '#fffaf0'; c.fillRect(2, -42, 3.4, 9.4); c.fillRect(-0.7, -39.3, 9, 3.4); }
  c.restore(); jp(); c.strokeStyle = INK; c.lineWidth = 1.6; c.stroke();
  c.strokeStyle = k.trim; c.lineWidth = 1.6; c.beginPath(); c.moveTo(-4.5, -44.4); c.quadraticCurveTo(1.5, -41.6, 6.8, -44.4); c.stroke();
}
const sandalFoot = (c, len) => {
  c.fillStyle = '#5a341c'; c.beginPath(); c.ellipse(2.2, len + 0.6, 5.4, 2, 0, 0, TAU); c.fill(); c.stroke();
  c.strokeStyle = '#a0643a'; c.lineWidth = 1.6; c.beginPath(); c.arc(2.5, len, 3, Math.PI * 1.05, Math.PI * 1.95); c.stroke(); c.strokeStyle = INK;
};
function sandalShape(c) {
  c.fillStyle = '#8a4b25'; c.strokeStyle = INK; c.lineWidth = 1.4; c.beginPath(); c.roundRect(-3.5, -1, 7, 15, 3.5); c.fill(); c.stroke();
  c.strokeStyle = '#d19a5b'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(-3, 4); c.lineTo(3, 6); c.stroke();
}
const hand = skin => (c, l) => { c.fillStyle = skin; c.beginPath(); c.arc(0, l + 1, 2.8, 0, TAU); c.fill(); c.stroke(); };

// person(): feet at (x,y), facing right. o.baked = draw for a cached frame, so every motion
// is driven by the stride phase (loops cleanly over PHN frames) instead of the clock.
function person(c, x, y, ph, air, o) {
  const A = o.baked ? ph : t * 7;
  c.save(); c.translate(x, y); if (o.rot) c.rotate(o.rot); c.scale(o.s * (o.sx || 1), o.s * (o.sy || 1));
  c.lineJoin = 'round'; c.lineCap = 'round';
  const sw = Math.sin(ph), still = o.still, run = !air && !still && !o.kick;
  if (run) { c.translate(0, -Math.abs(Math.sin(ph)) * 1.8); c.rotate(o.lean ?? 0.07); }
  const skin = o.skin, skinD = o.skinD, skinL = o.skinL || skin, robe = o.robe || '#fbfaf4', robeD = o.robeD || '#dcd8cb';
  const kick = o.kick ? Math.sin(ph * 1.4) : 0;
  const foot = o.kit ? sockFoot(o.kit.sock) : o.sport ? sneaker(o.sport.shoe) : sandalFoot;
  const legs = o.sport ? [o.sport.legD, o.sport.pants] : o.swim && o.swim.full ? [o.swim.legD, o.swim.shorts] : [skinD, skin];
  c.save(); c.translate(-1, -20); limb(c, o.kick ? kick * 0.9 : still ? 0.05 : air ? 0.75 : -sw * 0.85, 19, 4.4, legs[0], foot); c.restore();
  c.save(); c.translate(1, -20); limb(c, o.kick ? -kick * 0.9 : still ? -0.05 : air ? -0.55 : sw * 0.85, 19, 4.4, legs[1], foot); c.restore();
  let ba = still ? 0.1 : air ? -2.3 : sw * 0.9;
  if (o.arm === 'flail') ba = 2.4 + Math.sin(A * 3 + 1) * 1.1; if (o.arm === 'grip') ba = -1.1; if (o.arm === 'hold') ba = 0.35; if (o.arm === 'o') ba = -2.6 + Math.sin(A * 3) * 0.4;
  c.save(); c.translate(-1, -40); limb(c, ba, 15, 6, robeD, hand(skinD), 1); c.restore();
  if (o.kit) kitBody(c, o.kit);
  else if (o.sport) sportBody(c, o.sport);
  else if (o.swim) swimBody(c, o.swim);
  else {
  // kandura: soft side shading, hem shadow, folds, collar and tassel (furakha)
  const fl = Math.sin(ph * 2) * 2 * (still ? 0 : 1), b = o.belly || 0, fw = o.girl ? 2.2 : 0; // fw: the jalabiya flares a little
  const rg = c.createLinearGradient(-14, 0, 13 + b, 0); rg.addColorStop(0, robeD); rg.addColorStop(0.5, robe); rg.addColorStop(1, robe);
  const robePath = () => { c.beginPath(); c.moveTo(-8, -44); c.quadraticCurveTo(0, -47, 8, -44);
    c.quadraticCurveTo(10 + b * 0.6, -36, 10 + b, -28); c.quadraticCurveTo(13 + b + fw, -18, 12 + fw, -10 + fw * 0.6);
    c.lineTo(-13 - fl - fw, -9 + fw * 0.6); c.quadraticCurveTo(-12, -24, -9, -34); c.closePath(); };
  robePath(); c.fillStyle = rg; c.fill();
  c.save(); c.clip();
  c.fillStyle = 'rgba(120,108,85,.16)'; c.fillRect(-20, -15, 40, 7);
  if (b) { c.fillStyle = 'rgba(120,108,85,.12)'; c.beginPath(); c.ellipse(6 + b, -24, 6, 9, 0, 0, TAU); c.fill(); }
  c.fillStyle = 'rgba(255,255,255,.22)'; c.fillRect(0, -46, 5, 40);
  c.strokeStyle = 'rgba(150,140,120,.45)'; c.lineWidth = 1.1;
  c.beginPath(); c.moveTo(-6, -13); c.quadraticCurveTo(-7.5, -26, -5, -40); c.moveTo(1 + fl * 0.4, -10); c.quadraticCurveTo(2, -20, 0, -30); c.stroke();
  c.restore();
  robePath(); c.strokeStyle = INK; c.lineWidth = 1.6; c.stroke();
  c.strokeStyle = '#cfc9ba'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(-4, -44.5); c.quadraticCurveTo(2, -42.5, 7, -44.5); c.stroke();
  if (o.girl) { c.strokeStyle = '#d9a640'; c.lineWidth = 1.8; c.beginPath(); c.moveTo(-12.6 - fl, -11.5); c.lineTo(11.8, -12.5); c.moveTo(-3, -44); c.lineTo(3, -38); c.lineTo(7, -44); c.stroke();
    c.fillStyle = '#d9a640'; for (let k = 0; k < 4; k++) { c.beginPath(); c.arc(-9 + k * 6, -15, 1, 0, TAU); c.fill(); } }
  else { c.beginPath(); c.moveTo(5, -43); c.quadraticCurveTo(6.5, -38, 6, -32 + Math.sin(ph) * 0.8); c.stroke();
    c.fillStyle = '#c4bdac'; c.beginPath(); c.ellipse(6, -31, 1.5, 2.6, 0, 0, TAU); c.fill(); }
  }
  // head (kids get a bigger head and big eyes)
  const hs = o.hs || 1; c.save(); c.translate(2, -46); c.scale(hs, hs); c.translate(-2, 46);
  const hg = c.createRadialGradient(5, -55.5, 1, 2, -52, 10); hg.addColorStop(0, skinL); hg.addColorStop(0.55, skin); hg.addColorStop(1, skinD);
  c.fillStyle = hg; c.strokeStyle = INK; c.lineWidth = 1.6; c.beginPath(); c.arc(2, -52, 9, 0, TAU); c.fill(); c.stroke();
  if (o.red > 0.05) { c.fillStyle = `rgba(225,40,30,${o.red * 0.45})`; c.beginPath(); c.arc(2, -52, 8.2, 0, TAU); c.fill(); }
  if (o.beard) { const bg = c.createLinearGradient(0, -56, 0, -43); bg.addColorStop(0, '#3a261b'); bg.addColorStop(1, '#1c110b');
    c.fillStyle = bg; c.beginPath(); c.arc(2, -52, 9.6, -0.15, Math.PI * 0.75); c.quadraticCurveTo(0, -46, 4, -46.8); c.quadraticCurveTo(8, -47.6, 11.2, -52); c.closePath(); c.fill(); }
  else { c.fillStyle = 'rgba(240,110,110,.35)'; c.beginPath(); c.arc(6.2, -48.6, 2.3, 0, TAU); c.fill(); }
  c.strokeStyle = skinD; c.lineWidth = 1.2; c.beginPath(); c.moveTo(10.6, -52.4); c.quadraticCurveTo(12.4, -50.6, 10.5, -49.6); c.stroke();
  c.fillStyle = INK; c.strokeStyle = INK;
  if (o.blink && !o.baked && Math.sin(t * 1.7 + o.s * 3) > 0.97) { c.lineWidth = 1.3; c.beginPath(); c.moveTo(5.5, -52); c.lineTo(8.8, -52); c.stroke(); }
  else if (o.bigEyes) { c.fillStyle = '#fff'; c.beginPath(); c.ellipse(7.3, -52.6, 2.6, 3.1, 0, 0, TAU); c.fill(); c.lineWidth = 0.9; c.stroke();
    c.fillStyle = INK; c.beginPath(); c.arc(8, -52.3, 1.65, 0, TAU); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(8.6, -53.1, 0.6, 0, TAU); c.fill();
    if (o.girl) { c.lineWidth = 1; c.beginPath(); c.moveTo(9.4, -55.2); c.lineTo(10.8, -56.6); c.moveTo(7.6, -55.7); c.lineTo(8.2, -57.3); c.stroke(); } }
  else { c.beginPath(); c.arc(7, -52, 1.5, 0, TAU); c.fill(); c.fillStyle = 'rgba(255,255,255,.85)'; c.beginPath(); c.arc(7.5, -52.6, 0.45, 0, TAU); c.fill(); }
  c.fillStyle = INK; c.lineWidth = o.angry ? 2.3 : 1.6; c.beginPath();
  if (o.angry) { c.moveTo(3.6, -57.2); c.lineTo(10.2, -54.6); } else if (o.mouth === 'o') { c.moveTo(4.5, -56); c.quadraticCurveTo(7, -59, 10, -57.2); } else { c.moveTo(4.8, -56.6); c.quadraticCurveTo(7.5, -58.4, 10.2, -56.2); }
  c.stroke(); c.lineWidth = 1.5;
  if (o.mouth === 'shout') { c.fillStyle = '#5a1414'; c.beginPath(); c.ellipse(8.6, -47.4, 2.1, 2.7 + Math.sin(A * 3) * 0.6, 0, 0, TAU); c.fill(); c.fillStyle = '#d9505e'; c.beginPath(); c.ellipse(8.6, -46.2, 1.2, 0.8, 0, 0, TAU); c.fill(); }
  else if (o.mouth === 'talk') { c.beginPath(); c.moveTo(7, -47.4); c.lineTo(10, -47.4 + Math.sin(A * 2) * 0.8); c.stroke(); }
  else if (o.mouth === 'o') { c.fillStyle = '#5a1414'; c.beginPath(); c.ellipse(8.5, -47.4, 1.8, 2.4, 0, 0, TAU); c.fill(); }
  else if (o.mouth === 'tongue') { c.beginPath(); c.arc(7.6, -49, 2.6, 0.2, Math.PI - 0.6); c.stroke(); c.fillStyle = '#e8607a'; c.beginPath(); c.ellipse(9.5, -46.5, 1.9, 2.3, 0.3, 0, TAU); c.fill(); c.stroke(); }
  else { c.beginPath(); c.arc(7.6, -49.2, 2.7, 0.15, Math.PI - 0.55); c.stroke(); }
  if (o.beard) { c.fillStyle = '#1d120d'; c.beginPath(); c.moveTo(4.6, -49.4); c.quadraticCurveTo(8.4, -51.6, 11.8, -49.2); c.quadraticCurveTo(8.4, -48.3, 4.6, -49.4); c.fill(); }
  if (o.sweat) { const sy = -58 + (((A * 3 / TAU) * 10) % 10 + 10) % 10; c.fillStyle = '#8fd3ff'; c.lineWidth = 1; c.beginPath(); c.moveTo(-3, sy - 4); c.quadraticCurveTo(0, sy, -3, sy + 2); c.quadraticCurveTo(-6, sy, -3, sy - 4); c.fill(); c.stroke(); }
  // headwear: shayla or bukhnag, swim cap, or shemagh/ghutra with agal
  const wv = Math.sin(ph * 1.3) * 3 * (o.flap || 1), w2 = Math.cos(ph * 1.1) * 3 * (o.flap || 1), tipY = -45 + wv * 1.6 + (o.droop || 0);
  if (o.head === 'shayla' || o.head === 'bukhnag') { // headscarf wrapped around the face and falling over the shoulders
    const shp = () => { c.beginPath(); c.moveTo(9.6, -57); c.quadraticCurveTo(9, -65.5, 0, -65.5); c.quadraticCurveTo(-11.5, -64.5, -12.5, -52);
      c.quadraticCurveTo(-15 - wv * 0.5, -42, -17 - wv * 0.8, -35); c.quadraticCurveTo(-4, -33.5, 9, -38.5); c.quadraticCurveTo(7.5, -43, 5.8, -45.2);
      c.quadraticCurveTo(2, -46.5, 0.6, -50); c.quadraticCurveTo(1.6, -55.5, 9.6, -57); c.closePath(); };
    shp(); c.fillStyle = o.shaylaCol || '#e8789f'; c.fill();
    c.save(); c.clip(); c.fillStyle = 'rgba(0,0,0,.16)'; c.fillRect(-20, -52, 14, 22); c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(-6, -63); c.quadraticCurveTo(2, -65, 8, -60); c.stroke();
    c.strokeStyle = 'rgba(0,0,0,.18)'; c.lineWidth = 1; c.beginPath(); c.moveTo(-9, -50); c.quadraticCurveTo(-8, -42, -12, -36); c.moveTo(-3, -48); c.quadraticCurveTo(-2, -41, -5, -35); c.stroke(); c.restore();
    shp(); c.strokeStyle = INK; c.lineWidth = 1.6; c.stroke();
    if (o.head === 'bukhnag') { // gold embroidery round the face, along the hem, and a few gold dots
      c.strokeStyle = '#e8b64a'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(9.2, -56.6); c.quadraticCurveTo(1.8, -55.2, 1.2, -50); c.quadraticCurveTo(2.4, -46.6, 5.4, -45.4);
      c.moveTo(-16, -36.2); c.quadraticCurveTo(-4, -35, 8.2, -39.4); c.stroke();
      c.fillStyle = '#e8b64a'; for (const [dx, dy] of [[-8, -40], [-3, -39.5], [2, -40.6], [-11, -45], [-6, -46]]) { c.beginPath(); c.arc(dx, dy, 0.9, 0, TAU); c.fill(); }
    }
  } else if (o.head === 'sporthijab') {
    const hp = () => { c.beginPath(); c.moveTo(9.8, -57); c.quadraticCurveTo(9.4, -65.6, 0.5, -65.6); c.quadraticCurveTo(-11.4, -64.8, -11.6, -52.5);
      c.quadraticCurveTo(-12, -44, -9.5, -40.5); c.quadraticCurveTo(0, -38.6, 7.6, -41.6); c.quadraticCurveTo(6.8, -44.4, 5.6, -45.4);
      c.quadraticCurveTo(1.8, -46.6, 0.6, -50); c.quadraticCurveTo(1.6, -55.6, 9.8, -57); c.closePath(); };
    hp(); c.fillStyle = o.hijabCol; c.fill(); c.save(); c.clip(); c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(-14, -54, 8, 16);
    c.strokeStyle = 'rgba(255,255,255,.3)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(-6, -63); c.quadraticCurveTo(2, -65, 8, -60.4); c.stroke(); c.restore();
    hp(); c.strokeStyle = INK; c.lineWidth = 1.6; c.stroke();
  } else if (o.head === 'swimcap') {
    c.beginPath(); c.moveTo(-7.9, -50); c.quadraticCurveTo(-8.4, -65.8, 2.4, -65.8); c.quadraticCurveTo(11.6, -65.4, 11.2, -55.5); c.quadraticCurveTo(2, -57.5, -7.9, -50); c.closePath();
    c.fillStyle = o.capCol || (o.girl ? '#ef6f9a' : '#2b9bd6'); c.fill(); c.strokeStyle = INK; c.lineWidth = 1.5; c.stroke();
    if (o.helmet) { c.fillStyle = 'rgba(30,40,60,.85)'; c.beginPath(); c.moveTo(11.4, -60); c.quadraticCurveTo(14, -55, 11.6, -51); c.lineTo(7, -53); c.quadraticCurveTo(8, -57, 6.4, -60.4); c.closePath(); c.fill(); c.stroke(); }
    c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.ellipse(1, -63, 5, 1.6, -0.15, 0, TAU); c.fill();
    c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(-5, -60); c.quadraticCurveTo(2, -62, 9, -59); c.stroke();
  } else {
  const scarfPath = () => { c.beginPath(); c.moveTo(10.5, -55); c.quadraticCurveTo(11, -63, 1, -63.5); c.quadraticCurveTo(-9, -63, -11, -54);
    c.quadraticCurveTo(-14, -46, -15, -38); c.quadraticCurveTo(-24, -40 + wv, -33, tipY);
    c.quadraticCurveTo(-22, -49 + w2, -10, -46); c.quadraticCurveTo(-5, -48, -4, -52); c.quadraticCurveTo(3, -57.5, 10.5, -55); c.closePath(); };
  scarfPath(); c.fillStyle = o.scarf; c.fill();
  c.save(); c.clip(); c.fillStyle = 'rgba(40,10,10,.16)'; c.fillRect(-40, -50, 34, 16); c.fillRect(-14, -64, 4, 30);
  c.strokeStyle = 'rgba(255,255,255,.4)'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(-6, -61.5); c.quadraticCurveTo(2, -63.4, 8.5, -60); c.stroke(); c.restore();
  scarfPath(); c.strokeStyle = INK; c.lineWidth = 1.6; c.stroke();
  c.strokeStyle = o.fringe || '#f2ece4'; c.lineWidth = 1.1; c.beginPath();
  for (let k = 0; k < 4; k++) { const fx = -33 + k * 2.4, fy = tipY - 1.2 + k * 1.7; c.moveTo(fx, fy); c.lineTo(fx - 3.6, fy + 2.2 + Math.sin(ph * 2 + k) * 0.8); }
  c.stroke();
  if (o.messy) { // bent, untidy ghutra: a crumpled fold sticking up and a flap over the brow
    c.fillStyle = o.scarf; c.strokeStyle = INK; c.lineWidth = 1.6;
    c.beginPath(); c.moveTo(-3, -63); c.quadraticCurveTo(-9, -71 + w2, -14, -69); c.quadraticCurveTo(-9, -64, -7, -61); c.closePath(); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(4, -57); c.quadraticCurveTo(12, -58, 13, -51 + wv * 0.3); c.quadraticCurveTo(9, -54, 6, -55); c.closePath(); c.fill(); c.stroke();
    c.strokeStyle = '#cfccc2'; c.lineWidth = 1; c.beginPath(); c.moveTo(-6, -60); c.lineTo(-12, -48); c.moveTo(0, -61); c.lineTo(-8, -50); c.stroke();
  }
  if (o.agal !== false) {
  const at = o.agalTilt || 0, ay = -60.5 + (o.agalY || 0);
  c.strokeStyle = '#121212'; c.lineWidth = 2.4;
  c.beginPath(); c.ellipse(0, ay, 10.6, 2.6, at, 0, TAU); c.stroke(); c.lineWidth = 1.1; c.beginPath(); c.ellipse(0, ay + 2.3, 10.4, 2.3, at, 0.15, Math.PI - 0.15); c.stroke();
  c.strokeStyle = 'rgba(255,255,255,.25)'; c.lineWidth = 0.8; c.beginPath(); c.ellipse(0, ay - 0.6, 9.8, 2, at, Math.PI * 1.1, Math.PI * 1.7); c.stroke();
  const tx = -9.6, ty = ay + 2 - Math.sin(at) * 9;
  c.strokeStyle = '#121212'; c.lineWidth = 1.2; c.fillStyle = '#121212'; c.beginPath();
  c.moveTo(tx, ty); c.quadraticCurveTo(tx - 3 + wv * 0.3, ty + 6, tx - 4 + wv * 0.5, ty + 12); c.moveTo(tx + 1, ty); c.quadraticCurveTo(tx - 1 + wv * 0.3, ty + 6, tx - 1.5 + wv * 0.5, ty + 13); c.stroke();
  c.beginPath(); c.arc(tx - 4 + wv * 0.5, ty + 12.5, 1.1, 0, TAU); c.arc(tx - 1.5 + wv * 0.5, ty + 13.5, 1.1, 0, TAU); c.fill();
  }
  }
  c.restore();
  // front arm
  c.save(); c.translate(2, -41);
  const fa = o.arm;
  if (fa === 'slipper') limb(c, 2.8 + Math.sin(A * 2) * 0.28, 17, 6, robe, (c, l) => { hand(skin)(c, l); c.save(); c.translate(0, l + 2); c.rotate(-0.35 + Math.sin(A * 2) * 0.2); sandalShape(c); c.restore(); }, 1);
  else if (fa === 'windup') limb(c, 2.05 + Math.sin(A * 6) * 0.08, 17, 6, robe, (c, l) => { hand(skin)(c, l); c.save(); c.translate(0, l + 3); c.rotate(-0.4); sandalShape(c); c.restore(); }, 1);
  else if (fa === 'phone') limb(c, -2.85, 13, 6, robe, (c, l) => { c.fillStyle = '#222'; c.beginPath(); c.roundRect(-3, l - 3, 6, 10, 1.5); c.fill(); hand(skin)(c, l); }, 1);
  else if (fa === 'flail') limb(c, -2.6 + Math.sin(A * 3) * 1.2, 15, 6, robe, hand(skin), 1);
  else if (fa === 'grip') limb(c, -1.25, 15, 6, robe, hand(skin), 1);
  else if (fa === 'hold') limb(c, -3.0, 15, 6, robe, hand(skin), 1);
  else if (fa === 'o') limb(c, -2.4 + Math.sin(A * 3 + 2) * 0.4, 15, 6, robe, hand(skin), 1);
  else limb(c, still ? -0.1 : air ? -2.6 : -sw * 0.9, 15, 6, robe, hand(skin), 1);
  c.restore(); c.restore();
}

// cached character frames
const KB = { x0: -50, y0: -84, w: 82, h: 94 }, DB = { x0: -62, y0: -114, w: 100, h: 126 };
function spriteGet(key, box, fn) {
  let e = SPR.get(key);
  if (e) { SPR.delete(key); SPR.set(key, e); return e; }
  if (sprBudget <= 0) return null; sprBudget--;
  const c = mk(box.w * bakeRes, box.h * bakeRes), g = c.getContext('2d');
  g.scale(bakeRes, bakeRes); g.translate(-box.x0, -box.y0); fn(g);
  e = { c, box, w: c.width / bakeRes, h: c.height / bakeRes }; SPR.set(key, e); if (SPR.size > SPR_MAX) SPR.delete(SPR.keys().next().value);
  return e;
}
function blitSprite(c, e, x, y, rot, sx, sy, s, blinkSkin) {
  c.save(); c.translate(x, y); if (rot) c.rotate(rot); if (sx !== 1 || sy !== 1) c.scale(sx, sy);
  c.drawImage(e.c, e.box.x0, e.box.y0, e.w, e.h); // same scale on both axes
  if (blinkSkin) { c.scale(s, s); c.fillStyle = blinkSkin; c.beginPath(); c.arc(7, -52.8, 2.3, 0, TAU); c.fill(); c.strokeStyle = INK; c.lineWidth = 1.3; c.beginPath(); c.moveTo(5.5, -52.4); c.lineTo(8.5, -52.4); c.stroke(); }
  c.restore();
}
const blinkNow = seed => Math.sin(t * 1.7 + seed) > 0.97;
const SKIN = { skin: '#c98b5a', skinD: '#a8704a', skinL: '#e0a978' };
function lookOf(robeId, headId, girl) {
  const r = M.ROBES.find(x => x.id === robeId) || M.ROBES[0], h = M.HEADS.find(x => x.id === headId) || M.HEADS[0];
  const o = Object.assign({ s: 1, kit: r.kit || null, swim: r.swim || null, robe: r.col, robeD: r.shade, flap: 1.2, hs: 1.16, bigEyes: 1, agalTilt: -0.08, girl: !!girl }, SKIN);
  if (h.id === 'swimcap' || h.id === 'bukhnag') o.head = h.id;
  else if (h.id === 'shayla') { o.head = 'shayla'; o.shaylaCol = '#f7f5ef'; }
  else { o.head = 'scarf'; o.scarf = h.id === 'shemagh' ? SHEMAGH : '#f4f3ee'; o.fringe = h.id === 'ghutra' ? '#e3e0d6' : '#fff1e8'; }
  if (o.head === 'bukhnag') o.shaylaCol = '#1d1b22';
  if (r.sport) { o.sport = r.sport; o.head = 'sporthijab'; o.hijabCol = r.sport.hijab; }
  if (girl && o.swim && !o.swim.full) o.swim = Object.assign({}, o.swim, { full: 1, legD: r.shade }); // Mozah's swimwear always covers the legs
  return o;
}
const isGirl = () => M.data().char === 'mozah';
// the delivery rider: an adult in a blue jacket and a red helmet with a visor
const RIDER = { s: 1.12, skin: '#b97a4c', skinD: '#956039', skinL: '#cf9465', beard: 1, still: true, arm: 'grip', baked: true, head: 'swimcap', capCol: '#e23b4a', helmet: 1,
  sport: { main: '#2c5d9e', trim: '#f2c230', pants: '#26355c', legD: '#1c2848', shoe: '#1d1f24' }, robe: '#2c5d9e', robeD: '#22487c' };
const kidBase = () => { const d = M.data(); return lookOf(d.robe, d.head, isGirl()); };
const lookKey = () => { const d = M.data(); return d.char + d.robe + d.head; };
const kname = () => T(isGirl() ? 'ch_mozah' : 'ch_abood');
function scooter(c, x, y) {
  c.save(); c.translate(x, y); c.strokeStyle = INK; c.lineWidth = 1.6;
  c.fillStyle = '#e23b4a'; c.beginPath(); c.roundRect(-18, -6, 34, 5, 2.5); c.fill(); c.stroke();
  c.strokeStyle = '#c9ccd6'; c.lineWidth = 3; c.beginPath(); c.moveTo(15, -4); c.lineTo(19, -40); c.moveTo(13, -40); c.lineTo(24, -40); c.stroke();
  c.strokeStyle = INK; c.lineWidth = 1.6;
  for (const wx of [-14, 16]) { c.fillStyle = '#222'; c.beginPath(); c.arc(wx, -1, 5, 0, TAU); c.fill(); c.save(); c.translate(wx, -1); c.rotate(t * 30); c.strokeStyle = '#888'; c.beginPath(); c.moveTo(-3, 0); c.lineTo(3, 0); c.stroke(); c.restore(); }
  c.restore();
}
function kidFrame(mood, a, sc, idx) {
  return spriteGet('k' + lookKey() + mood + (a ? 1 : 0) + (sc ? 1 : 0) + idx, KB, g => person(g, 0, 0, idx * STEP, a,
    Object.assign(kidBase(), { mouth: mood, sweat: mood === 'o', still: sc, arm: sc ? 'grip' : undefined, baked: true })));
}
function drawKid(c, x, y, ph, air, alpha = 1, extra) {
  c.save(); if (alpha !== 1) c.globalAlpha *= alpha;
  const sc = kid.scoot > 0 && st === 'play';
  if (sc) { scooter(c, x, y); y -= 6; }
  if (kid.spin > 0) { c.translate(x, y - 30); c.rotate(kid.spin); c.translate(-x, -(y - 30)); }
  if (extra) { person(c, x, y, ph, air, Object.assign(kidBase(), extra)); c.restore(); return; }
  const scared = lead < 0.25 && st === 'play';
  const mood = scared ? 'o' : (kid.sayT > 0 && lead > 0.6 ? 'tongue' : 'grin');
  const a = !!air && !sc, idx = (a || sc) ? 0 : qph(ph), rot = kid.stumble > 0 ? 0.25 : 0;
  const e = kidFrame(mood, a, sc, idx);
  if (e) blitSprite(c, e, x, y, rot, 1, 1, 1, alpha === 1 && blinkNow(0) ? SKIN.skin : null);
  else person(c, x, y, ph, a, Object.assign(kidBase(), { mouth: mood, sweat: scared, still: sc, arm: sc ? 'grip' : undefined, rot }));
  if (kid.shield > 0 && st === 'play') { c.strokeStyle = `rgba(120,200,255,${0.5 + 0.2 * Math.sin(t * 8)})`; c.lineWidth = 3; c.beginPath(); c.ellipse(x, y - 34, 26, 40, 0, 0, TAU); c.stroke(); }
  c.restore();
}
function dadPose() {
  const fr = dad.freeze > 0 && st === 'play', sl = dad.slow > 0 && st === 'play';
  let arm = 'slipper'; if (fr) arm = 'phone'; else if (sl) arm = 'flail'; else if (dad.windup > 0) arm = 'windup'; else if (!dad.has) arm = 'empty';
  return { fr, sl, arm };
}
function dadOpts(arm, mouth, red, sweat, still, angry, over) {
  return { s: 1.38, skin: '#b97a4c', skinD: '#956039', skinL: '#cf9465', scarf: '#f4f3ee', fringe: '#dcd8cc', lean: 0.11, beard: 1, belly: 4, angry, messy: 1, agalTilt: 0.32, agalY: -1, flap: 1.8, droop: 6,
    red: red * 0.4 + (over ? 0.2 : 0), sweat, mouth, arm: arm === 'empty' ? undefined : arm, still, baked: true };
}
function dadFrame(arm, mouth, red, sweat, a, still, angry, over, idx) {
  return spriteGet('d' + arm + mouth + red + (sweat ? 1 : 0) + (a ? 1 : 0) + (still ? 1 : 0) + (angry ? 1 : 0) + idx, DB,
    g => person(g, 0, 0, idx * STEP, a, dadOpts(arm, mouth, red, sweat, still, angry, over)));
}
function drawDad(c, x, y, over) {
  const p = dadPose(), arm = over ? 'hold' : p.arm;
  const mouth = p.fr ? 'talk' : (over ? 'grin' : (dad.sayT > 0 ? 'shout' : 'talk'));
  const red = over ? 0 : (dad.anger > 0.66 ? 2 : dad.anger > 0.33 ? 1 : 0), sweat = !over && (red === 2 || p.sl);
  const still = p.fr || !!over, a = !dad.on && !still, idx = (still || a) ? 0 : qph(dad.ph), angry = !p.fr && !over;
  const rot = p.sl ? Math.sin(t * 18) * 0.22 : 0;
  const e = dadFrame(arm, mouth, red, sweat, a, still, angry, over, idx);
  if (e) blitSprite(c, e, x, y, rot, 1, 1, 1.38, red === 0 && !p.fr && blinkNow(2) ? '#b97a4c' : null);
  else person(c, x, y, dad.ph, a, Object.assign(dadOpts(arm, mouth, red, sweat, still, angry, over), { baked: false, rot }));
  if (p.sl) { c.fillStyle = 'rgba(255,255,255,.85)'; for (let i = 0; i < 3; i++) { const an = t * 5 + i * 2.1; c.beginPath(); c.arc(x + Math.cos(an) * 22, y - 100 + Math.sin(an) * 6, 2.5, 0, TAU); c.fill(); } }
  if (dad.windup > 0 && st === 'play') {
    const s = 1 + Math.sin(t * 30) * 0.1; c.save(); c.translate(x + 4, y - 118); c.scale(s, s); c.fillStyle = '#ffe066'; c.strokeStyle = INK; c.lineWidth = 2;
    c.beginPath(); c.arc(0, 0, 12, 0, TAU); c.fill(); c.stroke(); c.fillStyle = INK; c.font = '800 18px ' + FONT; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('!', 0, 1); c.restore();
  }
}
function bubble(c, x, y, s, small) {
  c.font = (small ? '700 13px ' : '700 15px ') + FONT; c.direction = getLang() === 'ar' ? 'rtl' : 'ltr';
  const w = c.measureText(s).width + 18, h = small ? 24 : 28;
  const bx = clamp(x - w / 2, 6, W - w - 6), by = y - h;
  c.fillStyle = '#fffaf0'; c.strokeStyle = INK; c.lineWidth = 2;
  c.beginPath(); c.roundRect(bx, by, w, h, 10); c.fill(); c.stroke();
  c.beginPath(); c.moveTo(x - 6, by + h - 1); c.lineTo(x + 4, by + h + 9); c.lineTo(x + 6, by + h - 1); c.closePath(); c.fill(); c.stroke();
  c.fillRect(x - 5, by + h - 3, 10, 4);
  c.fillStyle = small ? '#c8202b' : INK; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(s, bx + w / 2, by + h / 2 + 1);
  c.direction = 'inherit';
}

// ---------- drawing: items ----------
function drawItem(c, kind, x, y, k = 0, noBob) {
  c.save(); c.translate(x, y + (noBob ? 0 : Math.sin(t * 4 + k) * 3)); c.lineWidth = 1.6; c.strokeStyle = INK; c.lineJoin = 'round';
  if (kind === 'candy') {
    c.rotate(Math.sin(t * 3 + k) * 0.25);
    const col = ['#ff5a5f', '#ffb400', '#33b679', '#4a90e2'][Math.abs(Math.round(k)) % 4];
    c.fillStyle = col; c.beginPath(); c.moveTo(-7, 0); c.lineTo(-13, -5); c.lineTo(-13, 5); c.closePath(); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(7, 0); c.lineTo(13, -5); c.lineTo(13, 5); c.closePath(); c.fill(); c.stroke();
    c.beginPath(); c.arc(0, 0, 7, 0, TAU); c.fill(); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.7)'; c.beginPath(); c.arc(-1.5, -1.5, 3.5, Math.PI, Math.PI * 1.6); c.stroke();
  } else if (kind === 'jar') {
    c.fillStyle = 'rgba(200,235,255,.75)'; c.beginPath(); c.roundRect(-11, -12, 22, 26, 6); c.fill(); c.stroke();
    ['#ff5a5f', '#ffb400', '#33b679', '#4a90e2', '#ff5a5f'].forEach((col, i) => { c.fillStyle = col; c.beginPath(); c.arc(-5 + (i % 3) * 5, 6 - Math.floor(i / 3) * 7, 3.4, 0, TAU); c.fill(); });
    c.fillStyle = '#c8202b'; c.beginPath(); c.roundRect(-9, -16, 18, 6, 2); c.fill(); c.stroke();
  } else if (kind === 'sandal') {
    c.rotate(1.2); c.translate(0, -7); sandalShape(c);
  } else {
    c.fillStyle = 'rgba(255,246,194,.4)'; c.beginPath(); c.arc(0, 0, 21 + Math.sin(t * 6) * 2, 0, TAU); c.fill();
    c.save(); c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 2; c.rotate(t * 2); for (let i = 0; i < 4; i++) { c.rotate(Math.PI / 2); c.beginPath(); c.moveTo(19, 0); c.lineTo(24, 0); c.stroke(); } c.restore();
    c.strokeStyle = INK; c.lineWidth = 1.6;
    if (kind === 'vimto') {
      c.fillStyle = '#6e1b45'; c.beginPath(); c.roundRect(-7, -8, 14, 24, 4); c.fill(); c.stroke();
      c.beginPath(); c.roundRect(-3.5, -17, 7, 10, 2); c.fill(); c.stroke();
      c.fillStyle = '#e3a33b'; c.fillRect(-3.5, -19, 7, 3);
      c.fillStyle = '#fff3d6'; c.fillRect(-7, -1, 14, 9); c.fillStyle = '#7a1f5a'; for (const [gx, gy] of [[-2.4, 1.6], [2.4, 1.6], [0, 1.6], [-1.2, 4], [1.2, 4], [0, 6.2]]) { c.beginPath(); c.arc(gx, gy, 1.4, 0, TAU); c.fill(); } c.fillStyle = '#33b679'; c.fillRect(-0.5, -0.6, 1, 1.6);
    } else if (kind === 'marbles') {
      [['#3fa7d6', -7, 4], ['#f25f5c', 6, 5], ['#7bd389', -1, -6]].forEach(([col, mx, my]) => { c.fillStyle = col; c.beginPath(); c.arc(mx, my, 7, 0, TAU); c.fill(); c.stroke();
        c.fillStyle = 'rgba(255,255,255,.75)'; c.beginPath(); c.arc(mx - 2.4, my - 2.4, 2, 0, TAU); c.fill(); });
    } else if (kind === 'phone') {
      c.rotate(Math.sin(t * 30) * 0.12);
      c.fillStyle = '#1f2937'; c.beginPath(); c.roundRect(-8, -14, 16, 28, 3.5); c.fill(); c.stroke();
      c.fillStyle = '#7ee0b0'; c.fillRect(-5.5, -10, 11, 17); c.fillStyle = '#1f2937'; c.font = '800 7px ' + FONT; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(T('phoneScreen'), 0, -1);
      c.strokeStyle = '#ffe066'; c.lineWidth = 2; c.beginPath(); c.arc(0, 0, 15, -0.6, 0.6); c.stroke(); c.beginPath(); c.arc(0, 0, 15, Math.PI - 0.6, Math.PI + 0.6); c.stroke();
    } else if (kind === 'magnet') {
      c.rotate(-0.5 + Math.sin(t * 5) * 0.1); c.lineCap = 'butt';
      c.lineWidth = 9; c.strokeStyle = INK; c.beginPath(); c.arc(0, -2, 8, Math.PI, 0, false); c.lineTo(8, 9); c.moveTo(-8, -2); c.lineTo(-8, 9); c.stroke();
      c.lineWidth = 6; c.strokeStyle = '#d7263d'; c.stroke();
      c.fillStyle = '#e8e8ee'; c.lineWidth = 1.4; c.strokeStyle = INK; c.fillRect(-11.5, 7, 7, 6); c.strokeRect(-11.5, 7, 7, 6); c.fillRect(4.5, 7, 7, 6); c.strokeRect(4.5, 7, 7, 6);
    } else if (kind === 'scooter') {
      c.scale(0.62, 0.62); c.translate(-2, 22); scooter(c, 0, 0);
    }
  }
  c.restore();
}

// ---------- drawing: obstacles ----------
function drawObstacle(c, o, sx) {
  c.save(); c.translate(sx + o.w / 2 + o.hx, GROUND + o.hy - o.lift); if (o.rot) c.rotate(o.rot);
  c.strokeStyle = INK; c.lineWidth = 1.8; c.lineJoin = 'round'; c.lineCap = 'round'; const w = o.w, h = o.h, k = o.kind;
  if (k === 'box') { c.fillStyle = '#c68a4e'; c.beginPath(); c.rect(-w / 2, -h, w, h); c.fill(); c.stroke(); c.fillStyle = '#e8c38f'; c.fillRect(-4, -h, 8, h); c.strokeRect(-4, -h, 8, h);
    c.beginPath(); c.moveTo(-w / 2, -h + 6); c.lineTo(-w / 2 + 8, -h + 6); c.stroke(); }
  else if (k === 'bin') { c.fillStyle = '#2f8f5b'; c.beginPath(); c.moveTo(-w / 2, -h + 6); c.lineTo(w / 2, -h + 6); c.lineTo(w / 2 - 3, -3); c.lineTo(-w / 2 + 3, -3); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#257349'; c.beginPath(); c.roundRect(-w / 2 - 2, -h, w + 4, 7, 2); c.fill(); c.stroke(); c.fillStyle = '#222'; c.beginPath(); c.arc(-w / 2 + 6, -3, 3.5, 0, TAU); c.fill();
    c.strokeStyle = '#1d5c39'; c.beginPath(); c.moveTo(-5, -h + 14); c.lineTo(-5, -10); c.moveTo(5, -h + 14); c.lineTo(5, -10); c.stroke(); }
  else if (k === 'cone') { c.fillStyle = '#f57c20'; c.beginPath(); c.moveTo(-3, -h); c.lineTo(3, -h); c.lineTo(w / 2 - 2, -4); c.lineTo(-w / 2 + 2, -4); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#fff'; c.fillRect(-6, -h * 0.6, 12, 5); c.fillStyle = '#d9661a'; c.beginPath(); c.rect(-w / 2, -5, w, 5); c.fill(); c.stroke(); }
  else if (k === 'cat') { const tw = Math.sin(t * 5) * 4; c.fillStyle = '#e08a3c';
    c.lineWidth = 4; c.beginPath(); c.moveTo(w / 2 - 4, -4); c.quadraticCurveTo(w / 2 + 10, -10, w / 2 + 6 + tw, -24); c.stroke();
    c.lineWidth = 2.4; c.strokeStyle = '#e08a3c'; c.stroke(); c.strokeStyle = INK; c.lineWidth = 1.8;
    c.beginPath(); c.ellipse(2, -11, 13, 11, 0, 0, TAU); c.fill(); c.stroke();
    c.beginPath(); c.arc(-9, -22, 8, 0, TAU); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(-15, -26); c.lineTo(-15, -34); c.lineTo(-10, -29); c.moveTo(-7, -29); c.lineTo(-3, -34); c.lineTo(-3, -25); c.fill(); c.stroke();
    c.fillStyle = INK; if (Math.sin(t * 1.3 + o.seed) > 0.95) { c.fillRect(-13.5, -22, 3, 1.2); c.fillRect(-8, -22, 3, 1.2); } else { c.beginPath(); c.arc(-12, -22, 1.3, 0, TAU); c.arc(-6.5, -22, 1.3, 0, TAU); c.fill(); }
    c.strokeStyle = '#b4652a'; c.beginPath(); c.moveTo(0, -18); c.lineTo(4, -12); c.moveTo(6, -20); c.lineTo(9, -14); c.stroke(); }
  else if (k === 'goat') { const lg = Math.sin(o.ph);
    c.fillStyle = '#f2efe6'; for (const [lx, a] of [[-12, lg], [-6, -lg], [8, -lg], [14, lg]]) { c.save(); c.translate(lx, -16); c.rotate(a * 0.45); c.fillRect(-2, 0, 4, 16); c.strokeRect(-2, 0, 4, 16); c.restore(); }
    c.beginPath(); c.ellipse(2, -22, 18, 10, 0, 0, TAU); c.fill(); c.stroke();
    c.fillStyle = '#8a5a3b'; c.beginPath(); c.ellipse(8, -24, 6, 5, 0.3, 0, TAU); c.fill();
    c.fillStyle = '#f2efe6'; c.beginPath(); c.moveTo(18, -26); c.quadraticCurveTo(24, -14, 20, -10); c.lineTo(14, -14); c.closePath(); c.fill(); c.stroke();
    c.save(); c.translate(-16, -30 + Math.sin(o.ph * 2) * 1.5); c.beginPath(); c.ellipse(0, 0, 8, 6, -0.3, 0, TAU); c.fill(); c.stroke();
    c.strokeStyle = '#6b5a4a'; c.lineWidth = 2.4; c.beginPath(); c.moveTo(2, -5); c.quadraticCurveTo(8, -14, 12, -8); c.stroke();
    c.strokeStyle = INK; c.lineWidth = 1.6; c.beginPath(); c.moveTo(-5, 4); c.lineTo(-6, 10); c.stroke();
    c.fillStyle = INK; c.beginPath(); c.arc(-3, -1, 1.3, 0, TAU); c.fill(); c.restore(); }
  else if (k === 'ball') { c.translate(0, -h / 2); c.rotate(o.ph); c.fillStyle = '#fff'; c.beginPath(); c.arc(0, 0, h / 2, 0, TAU); c.fill(); c.stroke();
    c.fillStyle = INK; c.beginPath(); for (let i = 0; i < 5; i++) { const a = i * TAU / 5; c.lineTo(Math.cos(a) * 4.5, Math.sin(a) * 4.5); } c.fill();
    for (let i = 0; i < 5; i++) { const a = i * TAU / 5; c.beginPath(); c.moveTo(Math.cos(a) * 4.5, Math.sin(a) * 4.5); c.lineTo(Math.cos(a) * 11, Math.sin(a) * 11); c.stroke(); } }
  else if (k === 'sack') { c.fillStyle = '#d8a15a'; c.beginPath(); c.moveTo(-w / 2 + 2, 0); c.quadraticCurveTo(-w / 2 - 3, -h * 0.6, -w / 2 + 3, -h + 6); c.lineTo(w / 2 - 3, -h + 6); c.quadraticCurveTo(w / 2 + 3, -h * 0.6, w / 2 - 2, 0); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = o.seed > 3 ? '#d9462b' : '#e8b52a'; c.beginPath(); c.ellipse(0, -h + 6, w / 2 - 3, 5, 0, Math.PI, 0); c.fill(); c.stroke();
    c.strokeStyle = '#8c6236'; c.beginPath(); c.moveTo(-w / 2 + 4, -h + 12); c.lineTo(w / 2 - 4, -h + 12); c.stroke(); }
  else if (k === 'carpet') { c.fillStyle = '#9e2a2b'; c.beginPath(); c.roundRect(-w / 2, -h, w, h, 3); c.fill(); c.stroke();
    c.strokeStyle = '#e3b23c'; c.lineWidth = 2; for (let x = -w / 2 + 8; x < w / 2 - 6; x += 9) { c.beginPath(); c.moveTo(x, -h + 2); c.lineTo(x + 4, -2); c.stroke(); }
    c.strokeStyle = INK; c.lineWidth = 1.8; c.fillStyle = '#c6463d'; c.beginPath(); c.ellipse(-w / 2, -h / 2, 5, h / 2, 0, 0, TAU); c.fill(); c.stroke();
    c.beginPath(); c.arc(-w / 2, -h / 2, 4, 0, Math.PI * 1.5); c.stroke(); }
  else if (k === 'crab') { const lg = Math.sin(o.ph * 2) * 3; c.strokeStyle = '#c8442b'; c.lineWidth = 2.4;
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(s * 6, -6); c.lineTo(s * (13 + i * 2), -2 + lg * (i % 2 ? 1 : -1)); c.lineTo(s * (15 + i * 2), 2); c.stroke(); }
    c.strokeStyle = INK; c.lineWidth = 1.8; c.fillStyle = '#e8573b'; c.beginPath(); c.ellipse(0, -7, 12, 7, 0, 0, TAU); c.fill(); c.stroke();
    for (const s of [-1, 1]) { c.save(); c.translate(s * 12, -14); c.rotate(s * (0.3 + Math.sin(t * 6) * 0.2)); c.beginPath(); c.ellipse(0, -3, 4.5, 5, 0, 0, TAU); c.fill(); c.stroke(); c.restore(); }
    c.fillStyle = '#fff'; c.beginPath(); c.arc(-3, -15, 2.4, 0, TAU); c.arc(3, -15, 2.4, 0, TAU); c.fill(); c.stroke(); c.fillStyle = INK; c.beginPath(); c.arc(-3, -15, 1, 0, TAU); c.arc(3, -15, 1, 0, TAU); c.fill(); }
  else if (k === 'cooler') { c.fillStyle = '#2c7bd1'; c.beginPath(); c.roundRect(-w / 2, -h + 6, w, h - 6, 4); c.fill(); c.stroke(); c.fillStyle = '#f4f4f4'; c.beginPath(); c.roundRect(-w / 2 - 2, -h, w + 4, 9, 3); c.fill(); c.stroke();
    c.strokeStyle = '#f4f4f4'; c.lineWidth = 3; c.beginPath(); c.moveTo(-8, -h - 3); c.lineTo(8, -h - 3); c.stroke(); }
  else if (k === 'rock') { c.fillStyle = '#7f6f66'; c.beginPath(); c.moveTo(-w / 2, 0); c.lineTo(-w / 2 + 5, -h + 10); c.lineTo(-6, -h); c.lineTo(10, -h + 4); c.lineTo(w / 2, -8); c.lineTo(w / 2 - 3, 0); c.closePath(); c.fill(); c.stroke();
    c.strokeStyle = '#7c6248'; c.beginPath(); c.moveTo(-6, -h + 6); c.lineTo(0, -10); c.stroke(); }
  else if (k === 'bush') { c.strokeStyle = '#6f7a33'; c.lineWidth = 2.2; for (let i = 0; i < 9; i++) { const a = -Math.PI + 0.2 + i * (Math.PI - 0.4) / 8 + Math.sin(t * 3 + i) * 0.05; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a) * w * 0.6, Math.sin(a) * h); c.stroke(); }
    c.fillStyle = '#8f9a45'; c.strokeStyle = INK; c.lineWidth = 1.6; c.beginPath(); c.ellipse(0, -h * 0.45, w * 0.42, h * 0.45, 0, 0, TAU); c.fill(); c.stroke(); c.fillStyle = '#f2d24b'; c.beginPath(); c.arc(-6, -h * 0.6, 2, 0, TAU); c.arc(5, -h * 0.4, 2, 0, TAU); c.fill(); }
  else if (k === 'lizard') { const lg = Math.sin(o.ph); c.fillStyle = '#c7a56a';
    for (const [lx, a] of [[-10, lg], [10, -lg]]) { c.beginPath(); c.moveTo(lx, -5); c.lineTo(lx + a * 6, 0); c.stroke(); c.beginPath(); c.moveTo(lx, -9); c.lineTo(lx - a * 6, -14); c.stroke(); }
    c.beginPath(); c.moveTo(-23, -7); c.quadraticCurveTo(-14, -14, 4, -11); c.quadraticCurveTo(14, -10, 22 + Math.sin(t * 10) * 2, -4); c.quadraticCurveTo(10, -3, 2, -4); c.quadraticCurveTo(-14, -2, -23, -7); c.fill(); c.stroke();
    c.fillStyle = INK; c.beginPath(); c.arc(-18, -9, 1.2, 0, TAU); c.fill(); c.fillStyle = '#9c7b45'; c.beginPath(); c.arc(-4, -9, 2, 0, TAU); c.arc(4, -9, 2, 0, TAU); c.fill(); }

  else if (k === 'bike') { c.strokeStyle = INK; c.lineWidth = 2; for (const wx of [-14, 14]) { c.beginPath(); c.arc(wx, -9, 9, 0, TAU); c.stroke(); c.lineWidth = 0.8; c.beginPath(); for (let a = 0; a < 6; a++) { c.moveTo(wx, -9); c.lineTo(wx + Math.cos(a + t) * 8, -9 + Math.sin(a + t) * 8); } c.stroke(); c.lineWidth = 2; }
    c.strokeStyle = '#e23b4a'; c.lineWidth = 3; c.beginPath(); c.moveTo(-14, -9); c.lineTo(-3, -22); c.lineTo(9, -22); c.lineTo(0, -9); c.lineTo(-14, -9); c.moveTo(9, -22); c.lineTo(14, -9); c.moveTo(9, -22); c.lineTo(11, -28); c.stroke();
    c.strokeStyle = INK; c.lineWidth = 2; c.beginPath(); c.moveTo(7, -29); c.lineTo(15, -28); c.stroke(); c.fillStyle = INK; c.beginPath(); c.ellipse(-4, -24, 5, 2, 0, 0, TAU); c.fill(); }
  else if (k === 'gas') { c.fillStyle = '#e8572b'; c.beginPath(); c.roundRect(-w / 2, -h + 7, w, h - 7, 7); c.fill(); c.stroke(); c.fillStyle = '#fffaf0'; c.fillRect(-w / 2 + 1, -h / 2, w - 2, 4);
    c.fillStyle = '#9aa0aa'; c.fillRect(-4, -h, 8, 8); c.strokeRect(-4, -h, 8, 8); c.fillStyle = '#3b3b46'; c.fillRect(-7, -h - 2, 14, 3); c.fillStyle = 'rgba(255,255,255,.3)'; c.fillRect(-w / 2 + 3, -h + 10, 3, h - 16); }
  else if (k === 'dbag') { c.fillStyle = '#f28c28'; c.beginPath(); c.roundRect(-w / 2, -h, w, h, 4); c.fill(); c.stroke(); c.strokeStyle = '#b55f12'; c.beginPath(); c.moveTo(-w / 2, -h + 8); c.lineTo(w / 2, -h + 8); c.stroke();
    c.fillStyle = '#fffaf0'; c.fillRect(-w / 2 + 4, -h / 2, w - 8, 5); c.strokeStyle = INK; c.lineWidth = 2.4; c.beginPath(); c.moveTo(-8, -h); c.quadraticCurveTo(0, -h - 9, 8, -h); c.stroke(); }
  else if (k === 'dbike') { // delivery motorbike; the rider is drawn like everyone else, at adult size, crouched over the bars
    const wr = o.ph;
    c.fillStyle = '#e23b4a'; c.beginPath(); c.roundRect(10, -56, 26, 24, 3); c.fill(); c.stroke(); c.fillStyle = '#fffaf0'; c.fillRect(13, -47, 20, 3.4); // the box on the back
    c.save(); c.translate(6, -31); c.scale(-1, 1); c.rotate(0.5);
    person(c, 0, 22, 0.6, false, RIDER); c.restore();
    c.fillStyle = '#1b1b1f'; for (const wx of [-20, 20]) { c.beginPath(); c.arc(wx, -10, 10, 0, TAU); c.fill(); c.stroke(); c.fillStyle = '#b9bcc6'; c.beginPath(); c.arc(wx, -10, 4, 0, TAU); c.fill(); c.fillStyle = '#1b1b1f'; }
    c.fillStyle = '#d94a3a'; c.beginPath(); c.moveTo(-25, -17); c.lineTo(-13, -29); c.lineTo(16, -27); c.lineTo(24, -15); c.lineTo(-20, -13); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#1d1f24'; c.beginPath(); c.roundRect(-2, -33, 18, 6, 3); c.fill(); // seat
    c.strokeStyle = INK; c.lineWidth = 2.4; c.beginPath(); c.moveTo(-14, -28); c.lineTo(-22, -40); c.lineTo(-27, -40); c.stroke();
    c.fillStyle = '#ffe9a8'; c.lineWidth = 1.8; c.beginPath(); c.arc(-26, -22, 3, 0, TAU); c.fill(); c.stroke();
    c.fillStyle = 'rgba(200,200,200,.5)'; c.beginPath(); c.arc(32 + Math.sin(wr * 2) * 2, -12, 4.5, 0, TAU); c.fill(); }
  else if (k === 'crate') { for (let r = 0; r < 2; r++) { const y0 = -20 - r * 20; c.fillStyle = r ? '#2b6cb0' : '#d9462b'; c.fillRect(-w / 2, y0, w, 20); c.strokeRect(-w / 2, y0, w, 20);
      c.fillStyle = 'rgba(0,0,0,.25)'; for (let k2 = 0; k2 < 3; k2++) c.fillRect(-w / 2 + 4 + k2 * 10, y0 + 10, 6, 6); c.fillStyle = '#e3b23c'; for (let k2 = 0; k2 < 4; k2++) { c.beginPath(); c.arc(-w / 2 + 4 + k2 * 8, y0 + 3, 2.4, 0, TAU); c.fill(); } } }
  else if (k === 'chairs') { c.fillStyle = '#f4f4f2'; c.strokeStyle = SOFT; c.lineWidth = 1.2; c.fillRect(-w / 2 + 2, -h, 7, h - 14); c.strokeRect(-w / 2 + 2, -h, 7, h - 14);
    for (let k2 = 0; k2 < 4; k2++) { c.fillRect(-w / 2 + 2, -20 - k2 * 3, w - 2, 3); c.strokeRect(-w / 2 + 2, -20 - k2 * 3, w - 2, 3); }
    c.fillRect(-w / 2 + 3, -12, 3, 12); c.fillRect(w / 2 - 4, -12, 3, 12); c.strokeRect(-w / 2 + 3, -12, 3, 12); c.strokeRect(w / 2 - 4, -12, 3, 12); }
  else if (k === 'castle') { c.fillStyle = '#e3c48a'; c.fillRect(-w / 2, -14, w, 14); c.strokeRect(-w / 2, -14, w, 14);
    for (const tx of [-w / 2, -6, w / 2 - 12]) { c.fillRect(tx, -h, 12, h - 12); c.strokeRect(tx, -h, 12, h - 12); c.fillRect(tx, -h - 3, 3, 3); c.fillRect(tx + 9, -h - 3, 3, 3); }
    c.strokeStyle = INK; c.beginPath(); c.moveTo(0, -h); c.lineTo(0, -h - 12); c.stroke(); c.fillStyle = '#e23b4a'; c.beginPath(); c.moveTo(0, -h - 12); c.lineTo(8, -h - 9); c.lineTo(0, -h - 6); c.fill(); c.fillStyle = '#f08fb4'; c.beginPath(); c.arc(-10, -6, 2, 0, TAU); c.arc(8, -5, 2, 0, TAU); c.fill(); }
  else if (k === 'escooter') { // a parked rental e-scooter, drawn solid in calm colours so it does not shimmer when it scrolls past
    c.fillStyle = '#4a4f59'; c.beginPath(); c.moveTo(11, -7); c.lineTo(14.5, -h + 2); c.lineTo(19.5, -h + 2); c.lineTo(16, -7); c.closePath(); c.fill(); c.stroke(); // stem
    c.beginPath(); c.roundRect(8, -h - 1, 15, 5, 2.5); c.fill(); c.stroke(); // handlebar
    c.fillStyle = '#3a3e46'; c.beginPath(); c.roundRect(-18, -11, 36, 7, 3.5); c.fill(); c.stroke(); // deck
    c.fillStyle = '#6b7280'; c.fillRect(-14, -10, 22, 2);
    for (const wx of [-13, 13]) { c.fillStyle = '#26282e'; c.beginPath(); c.arc(wx, -4.5, 5, 0, TAU); c.fill(); c.stroke(); c.fillStyle = '#8b919c'; c.beginPath(); c.arc(wx, -4.5, 1.8, 0, TAU); c.fill(); }
    c.fillStyle = '#e8b65a'; c.beginPath(); c.arc(18, -h + 9, 2.2, 0, TAU); c.fill(); }
  else if (k === 'basket') { c.fillStyle = '#b5803e'; c.beginPath(); c.moveTo(-w / 2, -16); c.lineTo(w / 2, -16); c.lineTo(w / 2 - 3, 0); c.lineTo(-w / 2 + 3, 0); c.closePath(); c.fill(); c.stroke();
    c.strokeStyle = '#8a5a26'; c.lineWidth = 1; c.beginPath(); for (let y = -12; y < 0; y += 4) { c.moveTo(-w / 2 + 2, y); c.lineTo(w / 2 - 2, y); } c.stroke();
    c.fillStyle = '#e23b4a'; c.fillRect(-w / 2 + 2, -19, w - 4, 4); c.fillStyle = '#fff'; for (let x = -w / 2 + 2; x < w / 2 - 2; x += 6) c.fillRect(x, -19, 3, 4);
    c.strokeStyle = INK; c.lineWidth = 2.2; c.beginPath(); c.arc(0, -16, 10, Math.PI, 0); c.stroke(); }
  else if (k === 'flower') { c.fillStyle = '#c9a777'; c.beginPath(); c.moveTo(-w / 2, -16); c.lineTo(w / 2, -16); c.lineTo(w / 2 - 4, 0); c.lineTo(-w / 2 + 4, 0); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#3f7d3a'; c.beginPath(); c.arc(-7, -20, 8, 0, TAU); c.arc(7, -21, 8, 0, TAU); c.arc(0, -27, 8, 0, TAU); c.fill(); c.fillStyle = '#e0479e'; c.beginPath(); c.arc(-6, -24, 2.6, 0, TAU); c.arc(6, -28, 2.6, 0, TAU); c.arc(2, -19, 2.6, 0, TAU); c.fill(); }
  else if (k === 'dallah') { dallahShape(c, 0, 0, 1); }
  else if (k === 'mandoos') { mandoos(c, 0, 0, 1); }
  else if (k === 'gbag') { c.fillStyle = '#1f4fa0'; c.beginPath(); c.roundRect(-9, -30, 18, 30, 5); c.fill(); c.stroke(); c.fillStyle = '#f4f4f2'; c.fillRect(-9, -22, 18, 4);
    c.strokeStyle = '#9aa0aa'; c.lineWidth = 2; c.beginPath(); for (const [dx, a] of [[-4, -0.2], [0, 0], [4, 0.25]]) { c.moveTo(dx, -30); c.lineTo(dx + a * 30, -40); } c.stroke(); }
  else if (k === 'cart') { c.fillStyle = '#1b1b1f'; for (const wx of [-16, 16]) { c.beginPath(); c.arc(wx, -7, 7, 0, TAU); c.fill(); }
    c.fillStyle = '#f4f4f2'; c.beginPath(); c.moveTo(-24, -10); c.lineTo(-24, -24); c.lineTo(20, -24); c.lineTo(26, -12); c.lineTo(24, -10); c.closePath(); c.fill(); c.stroke();
    c.strokeStyle = '#9aa0aa'; c.lineWidth = 2; c.beginPath(); c.moveTo(-20, -24); c.lineTo(-20, -40); c.moveTo(14, -24); c.lineTo(10, -40); c.stroke(); c.fillStyle = '#1f7a74'; c.strokeStyle = INK; c.lineWidth = 1.4; c.fillRect(-24, -44, 38, 5); c.strokeRect(-24, -44, 38, 5); }
  else if (k === 'ring') { ring(c, 0, -h / 2, h / 2, -o.ph * 0.6); }
  else if (k === 'wood') { c.fillStyle = '#8a5a35'; c.beginPath(); c.roundRect(-w / 2, -10, w, 10, 5); c.fill(); c.stroke(); c.beginPath(); c.roundRect(-w / 2 + 6, -20, w - 12, 10, 5); c.fill(); c.stroke();
    c.fillStyle = '#d9a96f'; for (const [lx, ly] of [[-w / 2 + 5, -5], [w / 2 - 5, -5], [-w / 2 + 11, -15], [w / 2 - 11, -15]]) { c.beginPath(); c.arc(lx, ly, 4, 0, TAU); c.fill(); c.stroke(); } }
  else if (k === 'buggy') { c.fillStyle = '#1b1b1f'; for (const wx of [-20, 20]) { c.beginPath(); c.arc(wx, -11, 11, 0, TAU); c.fill(); c.fillStyle = '#f2c230'; c.beginPath(); c.arc(wx, -11, 4, 0, TAU); c.fill(); c.fillStyle = '#1b1b1f'; }
    c.strokeStyle = '#f57c20'; c.lineWidth = 3; c.beginPath(); c.moveTo(-26, -16); c.lineTo(-12, -36); c.lineTo(10, -36); c.lineTo(26, -16); c.lineTo(-26, -16); c.moveTo(-12, -36); c.lineTo(-4, -16); c.moveTo(10, -36); c.lineTo(4, -16); c.stroke();
    c.strokeStyle = INK; c.lineWidth = 1.4; c.beginPath(); c.moveTo(22, -16); c.lineTo(24, -52); c.stroke(); c.fillStyle = '#e23b4a'; c.beginPath(); c.moveTo(24, -52); c.lineTo(34 + Math.sin(t * 12) * 2, -48); c.lineTo(24, -44); c.fill();
    c.fillStyle = 'rgba(240,210,160,.6)'; c.beginPath(); c.arc(32, -6, 6, 0, TAU); c.arc(40, -10, 4, 0, TAU); c.fill(); }
  c.restore();
}

// ---------- background tiles (baked once, then blitted) ----------
let LT = null, LOX = 0;
function addLight(x, y, r) { (LT || lights).push([x + LOX, y, r]); }
function getTile(L, i, force) {
  const key = L.id + i + '|' + (L.v ? L.v() : 0);
  let e = TILES.get(key);
  if (e) { TILES.delete(key); TILES.set(key, e); return e; }
  if (!force) { if (tileBudget <= 0) return null; tileBudget--; }
  const [bx, by, bw, bh] = L.box, r = bakeRes * (L.q || 1);
  const c = mk(bw * r, bh * r), g = c.getContext('2d');
  g.scale(r, r); g.translate(-bx, -by); g.lineJoin = 'round'; g.lineCap = 'round';
  const sLT = LT, sLOX = LOX; LT = []; LOX = 0; L.draw(g, i); e = { c, bx, by, bw: c.width / r, bh: c.height / r, L: LT }; LT = sLT; LOX = sLOX;
  TILES.set(key, e); if (TILES.size > TILE_MAX) TILES.delete(TILES.keys().next().value);
  return e;
}
function tiled(c, L) {
  const off = worldX * L.par, i0 = Math.floor(off / L.tw) - 1, i1 = Math.floor((off + W) / L.tw) + 1;
  for (let i = i0; i <= i1; i++) {
    const x = i * L.tw - off;
    if (L.draw && (!L.has || L.has(i)) && x + L.box[0] + L.box[2] >= -4 && x + L.box[0] <= W + 4) {
      const e = getTile(L, i);
      if (e) { c.drawImage(e.c, x + e.bx, e.by, e.bw, e.bh); for (const l of e.L) lights.push([l[0] + x, l[1], l[2]]); }
      else { c.save(); c.translate(x, 0); LOX = x; L.draw(c, i); LOX = 0; c.restore(); }
    }
    if (L.live) L.live(c, i, x);
  }
}
const night = () => SK.n > 0.45;
const SOFT = 'rgba(43,26,18,.55)';
// signs and labels are written in the chosen language, so the language is part of the cache key
function label(c, txt, x, y, size, col) {
  c.save(); c.fillStyle = col; c.font = '800 ' + size + 'px ' + FONT; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.direction = getLang() === 'ar' ? 'rtl' : 'ltr'; c.fillText(txt, x, y); c.restore();
}
function archWin(c, wx, wy, w, h, lit) {
  c.fillStyle = lit ? '#ffd27a' : '#5b6f80'; c.beginPath(); c.moveTo(wx, wy + h); c.lineTo(wx, wy + w / 2); c.arc(wx + w / 2, wy + w / 2, w / 2, Math.PI, 0); c.lineTo(wx + w, wy + h); c.closePath(); c.fill();
  c.strokeStyle = 'rgba(255,248,232,.9)'; c.lineWidth = 1.6; c.stroke();
  if (!lit) { c.fillStyle = 'rgba(255,255,255,.22)'; c.fillRect(wx + 2, wy + w / 2, 3, h - w / 2 - 2); }
  else addLight(wx + w / 2, wy + h / 2, 28);
}
function rectWin(c, x, y, w, h, lit) {
  c.fillStyle = lit ? '#ffd27a' : '#5b6f80'; c.fillRect(x, y, w, h); c.strokeStyle = 'rgba(255,248,232,.9)'; c.lineWidth = 1.4; c.strokeRect(x, y, w, h);
  c.beginPath(); c.moveTo(x + w / 2, y); c.lineTo(x + w / 2, y + h); c.stroke();
  if (!lit) { c.fillStyle = 'rgba(255,255,255,.2)'; c.fillRect(x + 2, y + 2, 3, h - 4); } else addLight(x + w / 2, y + h / 2, 26);
}
function palm(c, x, y, h, i) {
  const sway = Math.sin(t * 1.5 + i) * 3; c.strokeStyle = '#7a5434'; c.lineWidth = 7; c.lineCap = 'round';
  c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x - 4, y - h * 0.5, x + 6 + sway, y - h); c.stroke();
  c.strokeStyle = 'rgba(60,35,20,.35)'; c.setLineDash([2, 6]); c.stroke(); c.setLineDash([]);
  const tx = x + 6 + sway, ty = y - h; c.strokeStyle = '#3f7d3a'; c.lineWidth = 5;
  c.beginPath();
  for (let k = 0; k < 7; k++) { const a = -Math.PI + k * (Math.PI / 6) + Math.sin(t * 2 + k + i) * 0.06; c.moveTo(tx, ty); c.quadraticCurveTo(tx + Math.cos(a) * 26, ty + Math.sin(a) * 26 - 12, tx + Math.cos(a) * 42, ty + Math.sin(a) * 20 + 18); }
  c.stroke(); c.strokeStyle = '#5a9a45'; c.lineWidth = 2; c.stroke();
  c.fillStyle = '#b3541e'; c.beginPath(); c.arc(tx - 3, ty + 5, 3.5, 0, TAU); c.arc(tx + 4, ty + 6, 3.5, 0, TAU); c.fill();
}
function lamp(c, x, col = '#3b3b46') {
  c.strokeStyle = col; c.lineWidth = 4; c.lineCap = 'round'; c.beginPath(); c.moveTo(x, GROUND); c.lineTo(x, GROUND - 120); c.quadraticCurveTo(x, GROUND - 134, x + 16, GROUND - 132); c.stroke();
  c.fillStyle = SK.n > 0.3 ? '#ffe39a' : '#cfd3d8'; c.strokeStyle = INK; c.lineWidth = 1.4; c.beginPath(); c.moveTo(x + 10, GROUND - 132); c.lineTo(x + 24, GROUND - 132); c.lineTo(x + 21, GROUND - 124); c.lineTo(x + 13, GROUND - 124); c.closePath(); c.fill(); c.stroke();
  addLight(x + 17, GROUND - 118, 70);
}

// ---- far: Dubai skyline (generic glass towers) ----
function towerTile(c, i) {
  const r = sr(i * 1.7 + 3), bw = 26 + sr(i + 2) * 26;
  const tg = c.createLinearGradient(0, 0, bw, 0); tg.addColorStop(0, '#46508f'); tg.addColorStop(0.55, '#2c3262'); tg.addColorStop(1, '#1d2145'); c.fillStyle = tg;
  let top;
  if (r > 0.92) { // supertall with set-backs and a spire
    const H2 = 250; top = GROUND - 60 - H2;
    for (let k = 0; k < 4; k++) { const w = bw * (1 - k * 0.2), y0 = GROUND - 60 - H2 * (k + 1) / 4; c.fillRect((bw - w) / 2, y0, w, H2 / 4 + 62); }
    c.fillRect(bw / 2 - 1.5, top - 26, 3, 30);
  } else {
    const h = 60 + r * 160; top = GROUND - 60 - h;
    c.fillRect(0, top, bw, h + 62);
    if (r > 0.7) c.fillRect(bw / 2 - 1.5, top - 24, 3, 24);
    if (r > 0.45 && r < 0.6) { c.beginPath(); c.moveTo(0, top); c.lineTo(bw / 2, top - 18); c.lineTo(bw, top); c.fill(); }
    if (r > 0.2 && r < 0.3) { c.beginPath(); c.moveTo(0, top + 10); c.quadraticCurveTo(bw * 0.2, top - 20, bw, top - 8); c.lineTo(bw, top + 10); c.fill(); }
  }
  c.fillStyle = 'rgba(255,255,255,.1)'; c.fillRect(bw * 0.18, top + 4, 3, GROUND - top - 60);
  const nq = SK.n > 0.3 ? Math.round(SK.n * 4) / 4 : 0;
  if (nq) { c.fillStyle = `rgba(255,215,130,${nq})`; for (let wy = top + 8; wy < GROUND - 64; wy += 10) for (let wx = 4; wx < bw - 4; wx += 7) if (sr(wx * 0.3 + wy + i) > 0.62) c.fillRect(wx, wy, 3, 4); }
}
// ---- far: Sharjah low skyline (domes and minarets) ----
function domeTile(c, i) {
  const r = sr(i * 3.1 + 7), h = 40 + r * 70, top = GROUND - 30 - h, bw = 40 + sr(i + 12) * 24; c.fillStyle = '#4c3550';
  if (r > 0.7) { c.fillRect(bw / 2 - 5, top - 60, 10, h + 70); c.fillRect(bw / 2 - 8, top - 40, 16, 5); c.beginPath(); c.moveTo(bw / 2 - 5, top - 60); c.lineTo(bw / 2, top - 76); c.lineTo(bw / 2 + 5, top - 60); c.fill(); }
  else if (r > 0.35) { c.fillRect(0, top + 30, bw + 10, h); c.beginPath(); c.arc(bw / 2 + 5, top + 30, bw / 2, Math.PI, 0); c.fill(); c.fillRect(bw / 2 + 4, top + 30 - bw / 2 - 10, 2, 12); }
  else c.fillRect(0, top + 20, bw, h + 22);
}

// ---- hedges and street lamps (Downtown, Creek Harbour) ----
function fareejNearTile(c, i) {
  const r = sr(i * 5.3 + 1);
  if (r > 0.5) lamp(c, 40);
  if (r < 0.65) { c.fillStyle = '#4f8a3a'; for (let k = 0; k < 6; k++) { c.beginPath(); c.arc(98 + k * 18, GROUND - 12 + Math.sin(k * 2 + i) * 3, 12, 0, TAU); c.fill(); }
    c.fillStyle = '#6aa64f'; for (let k = 0; k < 6; k++) { c.beginPath(); c.arc(95 + k * 18, GROUND - 16 + Math.sin(k * 2 + i) * 3, 6, 0, TAU); c.fill(); }
    c.fillStyle = '#e0479e'; for (let k = 0; k < 14; k++) { c.beginPath(); c.arc(90 + sr(i + k) * 104, GROUND - 24 + sr(k * 3 + i) * 14, 2.6, 0, TAU); c.fill(); } }
}

// ---- Jumeirah: kites over the beach, lifeguard towers and food trucks ----
function kites(c) {
  const cols = [['#c8202b', '#f2c230'], ['#1f7a74', '#fffaf0'], ['#2b6cb0', '#f57c20']];
  for (let k = 0; k < 3; k++) {
    const x = ((k * 330 + 120 - worldX * 0.04) % (W + 200) + W + 200) % (W + 200) - 100, y = 70 + k * 28 + Math.sin(t * 1.4 + k) * 10, a = Math.sin(t * 1.1 + k * 2) * 0.25;
    c.strokeStyle = 'rgba(43,26,18,.35)'; c.lineWidth = 1; c.beginPath(); c.moveTo(x, y + 18); c.quadraticCurveTo(x - 40, y + 120, x - 70, GROUND - 40); c.stroke();
    c.save(); c.translate(x, y); c.rotate(a); c.fillStyle = cols[k][0]; c.strokeStyle = INK; c.lineWidth = 1.4;
    c.beginPath(); c.moveTo(0, -16); c.lineTo(11, 0); c.lineTo(0, 18); c.lineTo(-11, 0); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = cols[k][1]; c.beginPath(); c.moveTo(0, -16); c.lineTo(11, 0); c.lineTo(0, 0); c.closePath(); c.fill();
    c.strokeStyle = cols[k][1]; c.lineWidth = 1.5; c.beginPath(); c.moveTo(0, 18); for (let s = 1; s <= 4; s++) c.lineTo(Math.sin(t * 4 + s + k) * 5, 18 + s * 9); c.stroke(); c.restore();
  }
}
function sea(c, lake) {
  const top = lake ? GROUND - 64 : GROUND - 78, dc = lake ? mix([46, 150, 160], [20, 40, 70], SK.n) : mix([58, 143, 199], [24, 36, 84], SK.n), hz = mix(dc, SK.c[3], 0.35);
  const g = c.createLinearGradient(0, top, 0, GROUND); g.addColorStop(0, rgb(hz)); g.addColorStop(1, rgb(dc));
  c.fillStyle = g; c.fillRect(-20, top, W + 40, GROUND - top + 2);
  c.strokeStyle = `rgba(255,255,255,${(lake ? 0.22 : 0.35) - SK.n * 0.12})`; c.lineWidth = 1.5; c.beginPath();
  for (let row = 0; row < 4; row++) { const y = top + 8 + row * 14, off = (worldX * (0.15 + row * 0.05) + t * (lake ? 8 : 20)) % 60; for (let x = -off; x < W; x += 60) { c.moveTo(x, y); c.quadraticCurveTo(x + 8, y - 3, x + 16 + row * 2, y); } }
  c.stroke();
  const sx = W * 0.78; c.fillStyle = `rgba(255,225,160,${0.45 * (1 - SK.n)})`; for (let k = 0; k < 5; k++) c.fillRect(sx - 20 + Math.sin(t * 3 + k) * 12, top + 6 + k * 10, 30 - k * 3, 2);
  if (lake) return;
  const off = worldX * 0.18 + t * 30;
  for (let i = Math.floor(off / 520) - 1; i <= Math.floor((off + W) / 520) + 1; i++) { if (sr(i * 4.1) < 0.4) continue; // jet skis
    const x = i * 520 - off + sr(i) * 160, y = top + 24 + sr(i + 1) * 30, bob = Math.sin(t * 5 + i) * 1.5;
    c.save(); c.translate(x, y + bob); c.fillStyle = 'rgba(255,255,255,.7)'; c.beginPath(); c.moveTo(-30, 2); c.quadraticCurveTo(-14, -2, -4, 2); c.fill();
    c.fillStyle = sr(i + 3) > 0.5 ? '#f2c230' : '#e23b4a'; c.strokeStyle = INK; c.lineWidth = 1.2; c.beginPath(); c.moveTo(-12, 0); c.lineTo(12, 0); c.lineTo(16, -5); c.lineTo(-8, -6); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#1d1f24'; c.beginPath(); c.arc(0, -11, 3, 0, TAU); c.fill(); c.fillRect(-2, -9, 4, 5); c.restore(); }
}
const TRUCKS = [['karak', '#e07b1a'], ['ice', '#f08fb4'], ['burger', '#2c7bd1']];
function beachTile(c, i) {
  const r = sr(i * 2.9 + 4);
  if (r < 0.34) { // lifeguard tower
    c.strokeStyle = '#8a5a35'; c.lineWidth = 4; c.beginPath(); c.moveTo(40, GROUND); c.lineTo(52, GROUND - 70); c.moveTo(104, GROUND); c.lineTo(92, GROUND - 70); c.moveTo(46, GROUND - 30); c.lineTo(98, GROUND - 46); c.stroke();
    c.fillStyle = '#d9a96f'; c.strokeStyle = INK; c.lineWidth = 1.6; c.fillRect(40, GROUND - 74, 64, 6); c.strokeRect(40, GROUND - 74, 64, 6);
    c.fillStyle = '#fffaf0'; c.fillRect(48, GROUND - 112, 48, 38); c.strokeRect(48, GROUND - 112, 48, 38); c.fillStyle = '#e23b4a'; for (let k = 0; k < 3; k++) c.fillRect(48 + k * 16, GROUND - 112, 8, 38);
    c.fillStyle = '#26384a'; c.fillRect(56, GROUND - 104, 32, 12);
    c.fillStyle = '#e23b4a'; c.beginPath(); c.moveTo(42, GROUND - 112); c.lineTo(72, GROUND - 128); c.lineTo(102, GROUND - 112); c.closePath(); c.fill(); c.stroke();
    c.strokeStyle = '#5b5b63'; c.lineWidth = 2; c.beginPath(); c.moveTo(100, GROUND - 128); c.lineTo(100, GROUND - 150); c.stroke(); c.fillStyle = '#f2c230'; c.fillRect(100, GROUND - 150, 16, 10); c.fillStyle = '#e23b4a'; c.fillRect(100, GROUND - 145, 16, 5);
    c.strokeStyle = '#8a5a35'; c.lineWidth = 2; c.beginPath(); for (let k = 0; k < 6; k++) { c.moveTo(106 + k * 2, GROUND - k * 11); c.lineTo(118 + k * 2, GROUND - k * 11); } c.moveTo(106, GROUND); c.lineTo(116, GROUND - 68); c.moveTo(118, GROUND); c.lineTo(128, GROUND - 68); c.stroke();
  } else if (r < 0.7) { // food truck
    const [k, col] = TRUCKS[Math.floor(sr(i + 2) * 3)];
    c.fillStyle = col; c.strokeStyle = INK; c.lineWidth = 1.6; c.beginPath(); c.roundRect(30, GROUND - 74, 120, 62, 8); c.fill(); c.stroke();
    c.beginPath(); c.roundRect(150, GROUND - 56, 34, 44, 6); c.fill(); c.stroke(); c.fillStyle = '#26384a'; c.fillRect(160, GROUND - 50, 20, 14);
    c.fillStyle = night() ? '#ffe7a8' : '#26384a'; c.fillRect(46, GROUND - 62, 70, 26); if (night()) addLight(80, GROUND - 50, 60);
    c.fillStyle = '#fffaf0'; c.beginPath(); c.moveTo(40, GROUND - 62); c.lineTo(122, GROUND - 62); c.lineTo(128, GROUND - 70); c.lineTo(34, GROUND - 70); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#fffaf0'; c.fillRect(36, GROUND - 86, 108, 14); c.strokeRect(36, GROUND - 86, 108, 14); label(c, T('truck_' + k), 90, GROUND - 79, 10, col);
    c.fillStyle = '#d9a96f'; c.fillRect(44, GROUND - 36, 76, 4);
    for (const wx of [56, 128, 168]) { c.fillStyle = '#1b1b1f'; c.beginPath(); c.arc(wx, GROUND - 10, 8, 0, TAU); c.fill(); c.fillStyle = '#b9bcc6'; c.beginPath(); c.arc(wx, GROUND - 10, 3, 0, TAU); c.fill(); }
    c.strokeStyle = '#4a3020'; c.lineWidth = 1; c.beginPath(); c.moveTo(30, GROUND - 90); c.quadraticCurveTo(90, GROUND - 80, 150, GROUND - 90); c.stroke();
    for (let k2 = 0; k2 < 8; k2++) { c.fillStyle = ['#ffe066', '#ff7eb6', '#7ee0b0'][k2 % 3]; c.beginPath(); c.arc(38 + k2 * 15, GROUND - 87 + Math.sin(k2 / 7 * Math.PI) * 5, 2.2, 0, TAU); c.fill(); }
  } else { // palm-leaf parasols and beach chairs
    for (const px of [50, 160]) {
      c.strokeStyle = '#8a5a35'; c.lineWidth = 4; c.beginPath(); c.moveTo(px, GROUND); c.lineTo(px, GROUND - 78); c.stroke();
      c.fillStyle = '#c99a52'; c.strokeStyle = INK; c.lineWidth = 1.4; c.beginPath(); c.moveTo(px - 46, GROUND - 66); c.quadraticCurveTo(px, GROUND - 100, px + 46, GROUND - 66); c.closePath(); c.fill(); c.stroke();
      c.strokeStyle = '#8a6a32'; c.lineWidth = 1.2; c.beginPath(); for (let k = -44; k <= 44; k += 5) { c.moveTo(px + k, GROUND - 66); c.lineTo(px + k * 1.04, GROUND - 58); } c.stroke();
      c.fillStyle = '#2b6cb0'; c.strokeStyle = INK; c.lineWidth = 1.2; c.beginPath(); c.moveTo(px + 6, GROUND - 6); c.lineTo(px + 40, GROUND - 14); c.lineTo(px + 46, GROUND - 30); c.lineTo(px + 42, GROUND - 31); c.lineTo(px + 36, GROUND - 17); c.lineTo(px + 8, GROUND - 10); c.closePath(); c.fill(); c.stroke();
      c.strokeStyle = '#9aa0aa'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(px + 12, GROUND - 8); c.lineTo(px + 10, GROUND); c.moveTo(px + 38, GROUND - 14); c.lineTo(px + 40, GROUND); c.stroke();
    }
  }
}

// ---- parks: trees, picnics and flowerbeds (Al Mamzar, Nad Al Sheba) ----
function tree(c, x, s = 1) {
  c.strokeStyle = '#6b4a2c'; c.lineWidth = 6 * s; c.lineCap = 'round'; c.beginPath(); c.moveTo(x, GROUND); c.lineTo(x, GROUND - 46 * s); c.stroke();
  c.fillStyle = '#3f7d3a'; c.beginPath(); c.arc(x - 16 * s, GROUND - 58 * s, 20 * s, 0, TAU); c.arc(x + 14 * s, GROUND - 60 * s, 22 * s, 0, TAU); c.arc(x, GROUND - 78 * s, 22 * s, 0, TAU); c.fill();
  c.fillStyle = '#5a9a45'; c.beginPath(); c.arc(x - 8 * s, GROUND - 82 * s, 10 * s, 0, TAU); c.arc(x + 16 * s, GROUND - 68 * s, 9 * s, 0, TAU); c.fill();
}
function sadu(c, x, y, w, h) { // woven sadu stripes: red, black, white with a zigzag band
  const cols = ['#a8262b', '#1d1d1d', '#f3ead6', '#1d1d1d', '#a8262b'];
  for (let k = 0; k < 5; k++) { c.fillStyle = cols[k]; c.fillRect(x, y + k * h / 5, w, h / 5 + 0.5); }
  c.strokeStyle = '#f3ead6'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(x, y + h / 2); for (let k = 0; k <= w; k += 6) c.lineTo(x + k, y + h / 2 + (k / 6 % 2 ? -h / 6 : h / 6)); c.stroke();
}
function sitter(c, x, abaya, kid) { // a seated family member
  const s = kid ? 0.7 : 1, y = GROUND - 6;
  c.fillStyle = abaya ? '#1d1d22' : '#fbfaf4'; c.strokeStyle = INK; c.lineWidth = 1.3;
  c.beginPath(); c.ellipse(x, y - 12 * s, 11 * s, 13 * s, 0, 0, TAU); c.fill(); c.stroke();
  c.fillStyle = '#c98b5a'; c.beginPath(); c.arc(x + 2 * s, y - 30 * s, 6.5 * s, 0, TAU); c.fill(); c.stroke();
  c.fillStyle = abaya ? '#1d1d22' : (kid ? SHEMAGH : '#f4f3ee'); c.beginPath(); c.arc(x + 1 * s, y - 32 * s, 7.4 * s, Math.PI * 0.95, Math.PI * 2.1); c.lineTo(x - 7 * s, y - 20 * s); c.closePath(); c.fill(); c.stroke();
  if (!abaya) { c.strokeStyle = '#121212'; c.lineWidth = 1.6; c.beginPath(); c.ellipse(x + 1 * s, y - 36.5 * s, 7 * s, 1.8 * s, 0, 0, TAU); c.stroke(); }
}
function parkTile(c, i) {
  const r = sr(i * 4.7 + 3);
  tree(c, 40, 0.9 + sr(i) * 0.3);
  if (r < 0.55) { // family picnic on a sadu mat with a dallah
    sadu(c, 90, GROUND - 7, 110, 7);
    sitter(c, 112, false, false); sitter(c, 140, true, false); sitter(c, 176, false, true);
    dallahShape(c, 158, GROUND - 7, 0.55); c.fillStyle = '#fffaf0'; c.fillRect(126, GROUND - 13, 4, 5); c.fillRect(132, GROUND - 13, 4, 5);
  } else { // bench and a lamp
    c.fillStyle = '#8a5a35'; c.strokeStyle = INK; c.lineWidth = 1.4; c.fillRect(100, GROUND - 22, 60, 5); c.strokeRect(100, GROUND - 22, 60, 5); c.fillRect(100, GROUND - 34, 60, 4); c.strokeRect(100, GROUND - 34, 60, 4);
    c.fillStyle = '#3b3b46'; c.fillRect(104, GROUND - 17, 4, 17); c.fillRect(152, GROUND - 17, 4, 17);
    lamp(c, 200, '#3b3b46');
  }
}
function flowerbedTile(c, i) {
  c.fillStyle = '#3f7d3a'; c.beginPath(); c.roundRect(20, GROUND - 20, 140, 22, 10); c.fill();
  const cols = ['#e0479e', '#f2c230', '#ffffff', '#e23b4a'];
  for (let k = 0; k < 22; k++) { c.fillStyle = cols[(k + i) % 4]; c.beginPath(); c.arc(26 + sr(i + k) * 128, GROUND - 16 + sr(k * 3 + i) * 10, 2.6, 0, TAU); c.fill(); }
}

// ---- shared props ----
function falcon(c, x, y, flying, ph = 0) {
  c.save(); c.translate(x, y); c.fillStyle = '#7a5a3a'; c.strokeStyle = INK; c.lineWidth = 1.2;
  if (flying) { const f = Math.sin(ph) * 8; c.beginPath(); c.moveTo(-18, -f); c.quadraticCurveTo(-6, -4, 0, 0); c.quadraticCurveTo(6, -4, 18, -f); c.quadraticCurveTo(6, 2, 0, 3); c.quadraticCurveTo(-6, 2, -18, -f); c.fill(); c.stroke(); c.beginPath(); c.arc(6, -1, 3, 0, TAU); c.fill(); }
  else { c.beginPath(); c.ellipse(0, -8, 5.5, 9, 0.15, 0, TAU); c.fill(); c.stroke(); c.fillStyle = '#c8a46a'; c.beginPath(); c.arc(2, -17, 4, 0, TAU); c.fill(); c.stroke();
    c.fillStyle = '#8c2a26'; c.beginPath(); c.arc(2, -18.5, 4, Math.PI, 0); c.fill(); c.fillStyle = '#e3b23c'; c.beginPath(); c.moveTo(5.5, -17); c.lineTo(8, -16); c.lineTo(5.5, -15.5); c.fill(); }
  c.restore();
}
function dallahShape(c, x, y, s) { // Arabic coffee pot
  c.save(); c.translate(x, y); c.scale(s, s); c.fillStyle = '#d9a640'; c.strokeStyle = INK; c.lineWidth = 1.6 / s * 0.8;
  c.beginPath(); c.moveTo(-10, 0); c.quadraticCurveTo(-14, -12, -6, -18); c.lineTo(-5, -26); c.quadraticCurveTo(0, -30, 5, -26); c.lineTo(6, -18); c.quadraticCurveTo(14, -12, 10, 0); c.closePath(); c.fill(); c.stroke();
  c.beginPath(); c.moveTo(6, -16); c.quadraticCurveTo(18, -22, 20, -32); c.lineTo(17, -31); c.quadraticCurveTo(14, -22, 6, -20); c.fill(); c.stroke();
  c.beginPath(); c.moveTo(-6, -22); c.quadraticCurveTo(-16, -20, -12, -8); c.stroke();
  c.beginPath(); c.moveTo(-3, -28); c.lineTo(0, -35); c.lineTo(3, -28); c.fill(); c.stroke();
  c.fillStyle = 'rgba(255,240,190,.6)'; c.fillRect(-7, -14, 3, 10); c.restore();
}

function mandoos(c, x, y, s) { // Emirati wooden chest with brass bands and studs
  c.save(); c.translate(x, y); c.scale(s, s); c.strokeStyle = INK; c.lineWidth = 1.6;
  c.fillStyle = '#7a4a26'; c.beginPath(); c.roundRect(-18, -24, 36, 24, 2); c.fill(); c.stroke();
  c.fillStyle = '#8f5a2e'; c.beginPath(); c.moveTo(-19, -24); c.quadraticCurveTo(0, -33, 19, -24); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = '#d9a640'; c.fillRect(-18, -20, 36, 2.4); c.fillRect(-18, -7, 36, 2.4); c.fillRect(-8, -28, 2.6, 28); c.fillRect(5.4, -28, 2.6, 28);
  c.fillStyle = '#f2d27a'; for (let k = 0; k < 6; k++) { c.beginPath(); c.arc(-14 + k * 5.6, -13.5, 1, 0, TAU); c.fill(); }
  c.fillStyle = '#b8862e'; c.fillRect(-2.6, -19, 5.2, 6); c.restore();
}
function ring(c, x, y, r, rot) { // inflatable swim ring
  c.save(); c.translate(x, y); c.rotate(rot); c.lineWidth = r * 0.62; c.strokeStyle = INK; c.beginPath(); c.arc(0, 0, r * 0.68, 0, TAU); c.stroke();
  c.lineWidth = r * 0.5; for (let k = 0; k < 8; k++) { c.strokeStyle = k % 2 ? '#fffaf0' : '#e8573b'; c.beginPath(); c.arc(0, 0, r * 0.68, k * TAU / 8, (k + 1) * TAU / 8 + 0.02); c.stroke(); }
  c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 1.6; c.beginPath(); c.arc(0, 0, r * 0.75, -2.4, -1.6); c.stroke(); c.restore();
}

// ---- Deira: the Creek and its abras, glimpsed between the souq arcades ----
function abra(c, x, y, s, col) { // wooden water taxi with a canopy
  c.save(); c.translate(x, y + Math.sin(t * 2 + x * 0.01) * 1.2); c.scale(s, s); c.strokeStyle = INK; c.lineWidth = 1.3;
  c.fillStyle = '#8a5a35'; c.beginPath(); c.moveTo(-42, -7); c.lineTo(42, -7); c.lineTo(35, 2); c.lineTo(-35, 2); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = '#c99a52'; c.fillRect(-38, -9, 76, 3);
  for (const [px, cc] of [[-20, '#fbfaf4'], [-7, '#1d1d22'], [8, '#fbfaf4'], [21, '#2c5d9e']]) { c.fillStyle = cc; c.beginPath(); c.ellipse(px, -13, 4, 5.5, 0, 0, TAU); c.fill(); c.fillStyle = '#c98b5a'; c.beginPath(); c.arc(px, -21, 3, 0, TAU); c.fill(); }
  c.strokeStyle = '#5b3a24'; c.lineWidth = 1.6; c.beginPath(); for (const px of [-32, 0, 32]) { c.moveTo(px, -9); c.lineTo(px, -28); } c.stroke();
  c.fillStyle = col; c.strokeStyle = INK; c.lineWidth = 1.2; c.beginPath(); c.moveTo(-36, -28); c.lineTo(36, -28); c.lineTo(31, -33); c.lineTo(-31, -33); c.closePath(); c.fill(); c.stroke();
  c.restore();
}
function creek(c) {
  const top = GROUND - 72, dc = mix([38, 118, 128], [18, 34, 64], SK.n), hz = mix(dc, SK.c[3], 0.3);
  const g = c.createLinearGradient(0, top, 0, GROUND); g.addColorStop(0, rgb(hz)); g.addColorStop(1, rgb(dc)); c.fillStyle = g; c.fillRect(-20, top, W + 40, GROUND - top + 2);
  c.strokeStyle = `rgba(255,255,255,${0.28 - SK.n * 0.1})`; c.lineWidth = 1.4; c.beginPath();
  for (let row = 0; row < 3; row++) { const y = top + 12 + row * 16, off = (worldX * (0.2 + row * 0.05) + t * 10) % 50; for (let x = -off; x < W; x += 50) { c.moveTo(x, y); c.quadraticCurveTo(x + 7, y - 2.5, x + 14, y); } }
  c.stroke();
  const off = worldX * 0.24 + t * 12;
  for (let i = Math.floor(off / 260) - 1; i <= Math.floor((off + W) / 260) + 1; i++) { if (sr(i * 3.7) < 0.3) continue;
    abra(c, i * 260 - off + sr(i) * 90, top + 30 + sr(i + 2) * 18, 0.5 + sr(i + 1) * 0.2, ['#e3b23c', '#c8202b', '#1f7a74', '#2c5d9e'][Math.floor(sr(i + 4) * 4)]); }
}

// ---- Palm Jumeirah: resort villas and beach clubs ----
function resortTile(c, i) {
  const r = sr(i * 2.2 + 5), lit = night();
  if (r < 0.55) {
    c.fillStyle = '#f3e7d3'; c.strokeStyle = SOFT; c.lineWidth = 1.4; c.fillRect(24, GROUND - 92, 170, 92); c.strokeRect(24, GROUND - 92, 170, 92);
    c.fillStyle = '#c9714a'; c.strokeStyle = INK; c.beginPath(); c.moveTo(14, GROUND - 92); c.lineTo(109, GROUND - 122); c.lineTo(204, GROUND - 92); c.closePath(); c.fill(); c.stroke();
    for (let k = 0; k < 4; k++) archWin(c, 38 + k * 40, GROUND - 80, 18, 30, lit && sr(i + k) > 0.3);
    c.fillStyle = '#4fd1e0'; c.fillRect(30, GROUND - 16, 158, 12); c.fillStyle = '#fffaf0'; c.fillRect(26, GROUND - 18, 166, 3);
    c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 1.2; c.beginPath(); for (let k = 40; k < 180; k += 22) { c.moveTo(k, GROUND - 10); c.quadraticCurveTo(k + 5, GROUND - 12, k + 10, GROUND - 10); } c.stroke();
  } else {
    for (const px of [60, 160]) {
      c.strokeStyle = '#9aa0aa'; c.lineWidth = 3; c.beginPath(); c.moveTo(px, GROUND); c.lineTo(px, GROUND - 70); c.stroke();
      c.fillStyle = '#fffaf0'; c.strokeStyle = INK; c.lineWidth = 1.4; c.beginPath(); c.moveTo(px - 40, GROUND - 60); c.quadraticCurveTo(px, GROUND - 90, px + 40, GROUND - 60); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#1f7a74'; for (let k = -40; k < 40; k += 16) c.fillRect(px + k, GROUND - 62, 8, 3);
      c.fillStyle = '#f4f4f2'; c.strokeStyle = INK; c.lineWidth = 1.2; c.beginPath(); c.moveTo(px + 6, GROUND - 6); c.lineTo(px + 40, GROUND - 12); c.lineTo(px + 46, GROUND - 26); c.lineTo(px + 42, GROUND - 27); c.lineTo(px + 36, GROUND - 15); c.lineTo(px + 8, GROUND - 10); c.closePath(); c.fill(); c.stroke();
    }
  }
}
// ---- JBR: the beach side of The Walk ----
function jbrTile(c, i) {
  const r = sr(i * 3.1 + 1);
  if (r < 0.45) { // striped cabanas
    for (const px of [30, 120]) { c.fillStyle = '#fffaf0'; c.strokeStyle = INK; c.lineWidth = 1.4; c.beginPath(); c.moveTo(px, GROUND); c.lineTo(px, GROUND - 44); c.lineTo(px + 34, GROUND - 70); c.lineTo(px + 68, GROUND - 44); c.lineTo(px + 68, GROUND); c.closePath(); c.fill(); c.stroke();
      c.save(); c.clip(); c.fillStyle = r < 0.22 ? '#2b9bd6' : '#f28c28'; for (let k = 0; k < 68; k += 14) c.fillRect(px + k, GROUND - 72, 7, 72); c.restore();
      c.fillStyle = '#3a2f2a'; c.fillRect(px + 22, GROUND - 34, 24, 34); }
  } else if (r < 0.75) { // kiosk
    c.fillStyle = '#f2c230'; c.strokeStyle = INK; c.lineWidth = 1.6; c.beginPath(); c.roundRect(50, GROUND - 70, 110, 70, 6); c.fill(); c.stroke();
    c.fillStyle = night() ? '#ffe7a8' : '#26384a'; c.fillRect(62, GROUND - 56, 86, 26); if (night()) addLight(105, GROUND - 44, 60);
    c.fillStyle = '#e8573b'; c.beginPath(); c.moveTo(44, GROUND - 70); c.lineTo(166, GROUND - 70); c.lineTo(156, GROUND - 86); c.lineTo(54, GROUND - 86); c.closePath(); c.fill(); c.stroke();
    label(c, T('truck_' + ['ice', 'karak', 'burger'][Math.floor(sr(i + 3) * 3)]), 105, GROUND - 78, 9, '#fffaf0');
  } else { // lifeguard chair and a ring on a post
    c.strokeStyle = '#8a5a35'; c.lineWidth = 4; c.beginPath(); c.moveTo(60, GROUND); c.lineTo(72, GROUND - 60); c.moveTo(110, GROUND); c.lineTo(98, GROUND - 60); c.moveTo(66, GROUND - 30); c.lineTo(104, GROUND - 30); c.stroke();
    c.fillStyle = '#e23b2a'; c.strokeStyle = INK; c.lineWidth = 1.6; c.fillRect(64, GROUND - 74, 42, 14); c.strokeRect(64, GROUND - 74, 42, 14);
    c.fillStyle = '#f2c230'; c.fillRect(70, GROUND - 100, 30, 26); c.strokeRect(70, GROUND - 100, 30, 26);
    c.strokeStyle = '#6b4a2c'; c.lineWidth = 3; c.beginPath(); c.moveTo(170, GROUND); c.lineTo(170, GROUND - 60); c.stroke(); ring(c, 170, GROUND - 50, 12, 0);
  }
}

// ---------- landmarks along the route ----------
// Near landmarks pass at the same depth as the street; far ones drift slowly across the sky as Abood gets closer.
const PAR_NEAR = 0.42;
const driftX = (m, r) => ABX + 40 + W * 0.52 * Math.tanh((m - routeM) / r);
const driftA = (m, r) => clamp((2.4 - Math.abs(m - routeM) / r) / 0.6, 0, 1);
function lmSign(c, txt, x, y, w, col, fg = '#fffaf0') { c.fillStyle = col; c.strokeStyle = INK; c.lineWidth = 1.6; c.beginPath(); c.roundRect(x - w / 2, y - 11, w, 22, 6); c.fill(); c.stroke(); label(c, txt, x, y + 1, 12, fg); }
const glassG = (c, x0, x1, a = '#a9bcd6', b = '#e2eaf3', d = '#6f83a6') => { const g = c.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, a); g.addColorStop(0.5, b); g.addColorStop(1, d); return g; };
function windTower(c, x, top, w) { // barjeel: open slats and the X brace
  c.fillStyle = '#d6c09a'; c.strokeStyle = SOFT; c.lineWidth = 1.2; c.fillRect(x, top, w, 50); c.strokeRect(x, top, w, 50);
  c.fillStyle = '#6b4a2c'; for (let k = 0; k < 3; k++) c.fillRect(x + 4 + k * (w - 8) / 3, top + 6, (w - 8) / 3 - 3, 24);
  c.fillStyle = '#c4ab80'; c.fillRect(x - 3, top - 4, w + 6, 5);
  c.strokeStyle = '#8a6a3a'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(x, top + 2); c.lineTo(x + w, top + 30); c.moveTo(x + w, top + 2); c.lineTo(x, top + 30); c.stroke();
}
function lmMamzar(c) {
  const lit = night();
  for (const px of [-128, 104]) { c.fillStyle = '#efe0c2'; c.strokeStyle = SOFT; c.lineWidth = 1.4; c.fillRect(px, GROUND - 124, 24, 124); c.strokeRect(px, GROUND - 124, 24, 124);
    c.fillStyle = '#d9c39a'; c.fillRect(px - 4, GROUND - 132, 32, 9); c.beginPath(); c.moveTo(px - 2, GROUND - 132); c.lineTo(px + 12, GROUND - 152); c.lineTo(px + 26, GROUND - 132); c.closePath(); c.fill();
    archWin(c, px + 6, GROUND - 110, 12, 22, lit); }
  c.fillStyle = '#1f7a74'; c.strokeStyle = INK; c.lineWidth = 1.8; c.beginPath(); c.moveTo(-104, GROUND - 100); c.quadraticCurveTo(0, GROUND - 150, 104, GROUND - 100); c.lineTo(104, GROUND - 80); c.quadraticCurveTo(0, GROUND - 128, -104, GROUND - 80); c.closePath(); c.fill(); c.stroke();
  c.strokeStyle = '#8fd3ff'; c.lineWidth = 2; c.beginPath(); for (let k = -84; k <= 70; k += 22) { const y = GROUND - 94 - (1 - (k / 104) * (k / 104)) * 22; c.moveTo(k, y); c.quadraticCurveTo(k + 6, y - 4, k + 12, y); } c.stroke();
  label(c, T('st_mamzarpark'), 0, GROUND - 113, 12, '#fffaf0');
}
function lmEtisalat(c, x, s) {
  c.save(); c.translate(x, GROUND - 50); c.scale(s, s); c.fillStyle = glassG(c, -24, 24, '#b9c2cf', '#e6ebf1', '#8e9aab'); c.strokeStyle = 'rgba(60,70,100,.55)'; c.lineWidth = 1;
  c.beginPath(); c.moveTo(-24, 0); c.lineTo(-14, -190); c.lineTo(14, -190); c.lineTo(24, 0); c.closePath(); c.fill(); c.stroke();
  c.strokeStyle = 'rgba(60,80,120,.3)'; c.beginPath(); for (let y = -12; y > -186; y -= 10) { const w = 24 + y / 190 * 10; c.moveTo(-w + 2, y); c.lineTo(w - 2, y); } c.stroke();
  const bg = c.createRadialGradient(-8, -234, 4, 0, -222, 34); bg.addColorStop(0, '#ffffff'); bg.addColorStop(1, '#b0bccb');
  c.fillStyle = '#c9d0da'; c.fillRect(-16, -196, 32, 8);
  c.fillStyle = bg; c.strokeStyle = 'rgba(60,70,100,.6)'; c.beginPath(); c.arc(0, -222, 32, 0, TAU); c.fill(); c.stroke();
  c.fillStyle = 'rgba(80,90,120,.22)'; for (let a = 0; a < 16; a++) for (let b2 = 0; b2 < 4; b2++) { const ang = a * TAU / 16 + b2 * 0.2, rr = 8 + b2 * 6; c.beginPath(); c.arc(Math.cos(ang) * rr, -222 + Math.sin(ang) * rr, 1.7, 0, TAU); c.fill(); }
  c.strokeStyle = '#8e9aab'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, -254); c.lineTo(0, -300); c.stroke();
  if (SK.n > 0.3) { c.fillStyle = '#ff4d4d'; c.beginPath(); c.arc(0, -300, 2.6, 0, TAU); c.fill(); }
  c.restore();
}
function lmClock(c) {
  c.fillStyle = '#d9cbb0'; c.strokeStyle = SOFT; c.lineWidth = 1.4; c.beginPath(); c.ellipse(0, GROUND - 6, 112, 10, 0, 0, TAU); c.fill(); c.stroke();
  c.fillStyle = '#5fb7d4'; c.beginPath(); c.ellipse(0, GROUND - 8, 98, 6, 0, 0, TAU); c.fill();
  c.fillStyle = '#f4f1ea'; c.strokeStyle = SOFT; c.lineWidth = 1.6;
  for (const sg of [-1, 1]) { c.beginPath(); c.moveTo(sg * 80, GROUND - 10); c.quadraticCurveTo(sg * 66, GROUND - 92, sg * 10, GROUND - 142); c.lineTo(sg * 4, GROUND - 122); c.quadraticCurveTo(sg * 50, GROUND - 82, sg * 60, GROUND - 10); c.closePath(); c.fill(); c.stroke(); }
  c.fillStyle = '#ece6da'; c.beginPath(); c.moveTo(-11, GROUND - 10); c.quadraticCurveTo(-6, GROUND - 80, -7, GROUND - 134); c.lineTo(7, GROUND - 134); c.quadraticCurveTo(6, GROUND - 80, 11, GROUND - 10); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = '#e8e2d4'; c.fillRect(-15, GROUND - 172, 30, 38); c.strokeRect(-15, GROUND - 172, 30, 38);
  c.fillStyle = '#fffaf0'; c.strokeStyle = INK; c.lineWidth = 1.4; c.beginPath(); c.arc(0, GROUND - 153, 10.5, 0, TAU); c.fill(); c.stroke();
  c.beginPath(); c.moveTo(0, GROUND - 153); c.lineTo(0, GROUND - 160); c.moveTo(0, GROUND - 153); c.lineTo(5, GROUND - 151); c.stroke();
  c.fillStyle = '#c9a777'; c.beginPath(); c.moveTo(-17, GROUND - 172); c.lineTo(0, GROUND - 190); c.lineTo(17, GROUND - 172); c.closePath(); c.fill(); c.stroke();
  if (night()) addLight(0, GROUND - 153, 40);
}
function jets(c, x0, x1, base, hMax, n, col) { // dancing fountain jets
  for (let k = 0; k < n; k++) { const x = x0 + (x1 - x0) * k / (n - 1), h = hMax * (0.45 + 0.55 * Math.abs(Math.sin(t * 1.7 + k * 0.55) * Math.sin(t * 0.6 + k * 0.2)));
    c.strokeStyle = col(k); c.lineWidth = 2.6; c.beginPath(); c.moveTo(x, base); c.quadraticCurveTo(x + 4, base - h * 1.6, x + 10, base); c.stroke(); }
}
function clockLive(c, x) { jets(c, x - 80, x + 70, GROUND - 8, 18, 7, () => 'rgba(235,248,255,.8)'); }
function souqWall(c, w, h, roof = true) {
  c.fillStyle = '#dcc7a2'; c.strokeStyle = SOFT; c.lineWidth = 1.4; c.fillRect(-w / 2, GROUND - h, w, h); c.strokeRect(-w / 2, GROUND - h, w, h);
  c.fillStyle = 'rgba(120,90,50,.12)'; for (let k = 0; k < 40; k++) c.fillRect(-w / 2 + sr(k * 3) * w, GROUND - h + sr(k * 5 + 1) * h, 3 + sr(k) * 4, 2);
  if (roof) { c.fillStyle = '#a8834f'; c.fillRect(-w / 2 - 6, GROUND - h - 10, w + 12, 12); c.strokeStyle = '#7a5a2f'; c.lineWidth = 1; c.beginPath(); for (let k = -w / 2 - 4; k < w / 2 + 6; k += 4) { c.moveTo(k, GROUND - h - 10); c.lineTo(k + 2, GROUND - h + 2); } c.stroke(); }
}
function lmSpice(c) {
  souqWall(c, 280, 130);
  for (const ax of [-90, 90]) { c.fillStyle = '#3d2417'; c.beginPath(); c.moveTo(ax - 32, GROUND); c.lineTo(ax - 32, GROUND - 60); c.quadraticCurveTo(ax, GROUND - 98, ax + 32, GROUND - 60); c.lineTo(ax + 32, GROUND); c.closePath(); c.fill(); c.strokeStyle = '#f1e4c6'; c.lineWidth = 3; c.stroke(); }
  lmSign(c, T('st_spice'), 0, GROUND - 108, 130, '#8c2a26', '#f2c230');
  const cols = ['#d9462b', '#e8b52a', '#8c4a24', '#c98a3b', '#6b8e23', '#b5352f', '#e07b1a'];
  for (let k = 0; k < 7; k++) { const sx = -124 + k * 36; c.fillStyle = '#b98a55'; c.strokeStyle = INK; c.lineWidth = 1.2; c.beginPath(); c.roundRect(sx, GROUND - 26, 30, 26, 4); c.fill(); c.stroke();
    c.fillStyle = cols[k]; c.beginPath(); c.moveTo(sx + 2, GROUND - 24); c.quadraticCurveTo(sx + 15, GROUND - 48, sx + 28, GROUND - 24); c.closePath(); c.fill(); c.stroke(); }
  for (let k = 0; k < 5; k++) { c.fillStyle = cols[(k + 3) % 7]; c.strokeStyle = INK; c.lineWidth = 1; c.beginPath(); c.arc(-40 + k * 20, GROUND - 74 + (k % 2) * 4, 6, 0, TAU); c.fill(); c.stroke(); }
}
function lmGold(c) {
  souqWall(c, 290, 150);
  c.fillStyle = '#5a3a22'; c.strokeStyle = INK; c.lineWidth = 1.6; c.fillRect(-60, GROUND - 176, 120, 30); c.strokeRect(-60, GROUND - 176, 120, 30);
  c.fillStyle = '#d9a640'; c.beginPath(); c.moveTo(-70, GROUND - 176); c.lineTo(0, GROUND - 196); c.lineTo(70, GROUND - 176); c.closePath(); c.fill(); c.stroke();
  label(c, T('st_gold'), 0, GROUND - 160, 14, '#f2c230');
  c.fillStyle = '#3d2417'; c.beginPath(); c.moveTo(-40, GROUND); c.lineTo(-40, GROUND - 80); c.quadraticCurveTo(0, GROUND - 130, 40, GROUND - 80); c.lineTo(40, GROUND); c.closePath(); c.fill(); c.strokeStyle = '#e3b23c'; c.lineWidth = 4; c.stroke();
  for (const wx of [-128, 64]) { c.fillStyle = '#2a1a14'; c.fillRect(wx, GROUND - 100, 64, 70); c.strokeStyle = '#d9a640'; c.lineWidth = 3; c.strokeRect(wx, GROUND - 100, 64, 70);
    c.fillStyle = '#ffe7a8'; c.fillRect(wx + 4, GROUND - 96, 56, 62); addLight(wx + 32, GROUND - 66, 50);
    c.strokeStyle = '#d4a017'; c.lineWidth = 2; for (let r2 = 0; r2 < 3; r2++) for (let k = 0; k < 3; k++) { c.beginPath(); c.arc(wx + 14 + k * 18, GROUND - 88 + r2 * 19, 6, 0.1, Math.PI - 0.1); c.stroke(); }
    c.fillStyle = '#f2c230'; for (let k = 0; k < 6; k++) { c.beginPath(); c.arc(wx + 10 + k * 9, GROUND - 40, 2.6, 0, TAU); c.fill(); } }
}
function goldLive(c, x) { c.fillStyle = '#fffbe6'; for (let k = 0; k < 6; k++) { const a = Math.sin(t * 5 + k * 1.7); if (a < 0.6) continue; const sx = x + (k < 3 ? -120 : 70) + sr(k) * 50, sy = GROUND - 92 + sr(k + 4) * 50, r = (a - 0.6) * 9;
  c.beginPath(); c.moveTo(sx, sy - r); c.lineTo(sx + r * 0.3, sy); c.lineTo(sx, sy + r); c.lineTo(sx - r * 0.3, sy); c.closePath(); c.fill(); c.beginPath(); c.moveTo(sx - r, sy); c.lineTo(sx, sy + r * 0.3); c.lineTo(sx + r, sy); c.lineTo(sx, sy - r * 0.3); c.closePath(); c.fill(); } }
function lmAbra(c) {
  c.fillStyle = '#3f8fa8'; c.fillRect(-160, GROUND - 46, 320, 36); c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 1.4; c.beginPath(); for (let k = -150; k < 150; k += 30) { c.moveTo(k, GROUND - 30); c.quadraticCurveTo(k + 7, GROUND - 33, k + 14, GROUND - 30); } c.stroke();
  c.fillStyle = '#8a5a35'; c.strokeStyle = INK; c.lineWidth = 1.4; c.fillRect(-160, GROUND - 12, 320, 12); c.strokeRect(-160, GROUND - 12, 320, 12);
  c.strokeStyle = 'rgba(43,26,18,.4)'; c.lineWidth = 1; c.beginPath(); for (let k = -150; k < 160; k += 16) { c.moveTo(k, GROUND - 11); c.lineTo(k, GROUND - 1); } c.stroke();
  c.fillStyle = '#6b4a2c'; for (const px of [-118, -40, 36, 112]) c.fillRect(px, GROUND - 108, 6, 96);
  c.fillStyle = '#d6c09a'; c.strokeStyle = SOFT; c.lineWidth = 1.4; c.fillRect(-130, GROUND - 124, 260, 18); c.strokeRect(-130, GROUND - 124, 260, 18);
  windTower(c, -18, GROUND - 174, 36);
  lmSign(c, T('st_abra'), 0, GROUND - 92, 110, '#1f7a74');
}
function abraLive(c, x) { abra(c, x - 70 + Math.sin(t * 0.5) * 8, GROUND - 14, 0.72, '#e3b23c'); abra(c, x + 78 - Math.sin(t * 0.4) * 10, GROUND - 16, 0.62, '#c8202b'); }
function lmAntique(c) { // heritage stall: chests, coffee pots, an old radio, lanterns and carpets
  souqWall(c, 330, 150);
  lmSign(c, T('st_antique'), 0, GROUND - 134, 170, '#5a3a22', '#f2c230');
  for (const [cx, col] of [[-150, '#9e2a2b'], [-112, '#2c5d9e']]) { c.fillStyle = col; c.strokeStyle = INK; c.lineWidth = 1.4; c.fillRect(cx, GROUND - 110, 32, 70); c.strokeRect(cx, GROUND - 110, 32, 70);
    c.strokeStyle = '#e3b23c'; c.lineWidth = 1.4; c.strokeRect(cx + 4, GROUND - 106, 24, 62); c.beginPath(); c.moveTo(cx + 16, GROUND - 100); c.lineTo(cx + 26, GROUND - 75); c.lineTo(cx + 16, GROUND - 50); c.lineTo(cx + 6, GROUND - 75); c.closePath(); c.stroke(); }
  c.fillStyle = '#6b4a2c'; c.fillRect(-64, GROUND - 92, 120, 5); c.fillRect(-64, GROUND - 58, 120, 5);
  for (let k = 0; k < 5; k++) dallahShape(c, -54 + k * 25, GROUND - 92, 0.5);
  for (let k = 0; k < 4; k++) { c.fillStyle = ['#c98a3b', '#2f8f5b', '#c8202b', '#e3b23c'][k]; c.strokeStyle = INK; c.lineWidth = 1; c.beginPath(); c.moveTo(-54 + k * 30, GROUND - 58); c.quadraticCurveTo(-64 + k * 30, GROUND - 72, -54 + k * 30, GROUND - 80); c.quadraticCurveTo(-44 + k * 30, GROUND - 72, -54 + k * 30, GROUND - 58); c.fill(); c.stroke(); }
  mandoos(c, -30, GROUND, 1.3); mandoos(c, 30, GROUND, 1.05);
  c.fillStyle = '#8a5a35'; c.strokeStyle = INK; c.lineWidth = 1.4; c.beginPath(); c.roundRect(80, GROUND - 58, 52, 34, 5); c.fill(); c.stroke(); // old radio on a stool
  c.fillStyle = '#e8d9b0'; c.beginPath(); c.arc(96, GROUND - 41, 10, 0, TAU); c.fill(); c.stroke(); c.strokeStyle = '#8a5a35'; c.lineWidth = 1; c.beginPath(); for (let k = -6; k <= 6; k += 3) { c.moveTo(90, GROUND - 41 + k); c.lineTo(102, GROUND - 41 + k); } c.stroke();
  c.fillStyle = '#f2c230'; c.strokeStyle = INK; c.fillRect(112, GROUND - 52, 14, 6); c.beginPath(); c.arc(119, GROUND - 34, 4, 0, TAU); c.fill(); c.stroke();
  c.strokeStyle = '#9aa0aa'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(126, GROUND - 58); c.lineTo(136, GROUND - 80); c.stroke();
  c.fillStyle = '#6b4a2c'; c.fillRect(84, GROUND - 24, 44, 5); c.fillRect(88, GROUND - 19, 4, 19); c.fillRect(120, GROUND - 19, 4, 19);
  c.fillStyle = '#c4ab80'; c.strokeStyle = INK; c.lineWidth = 1.2; c.beginPath(); c.moveTo(144, GROUND); c.lineTo(140, GROUND - 22); c.lineTo(160, GROUND - 22); c.lineTo(156, GROUND); c.closePath(); c.fill(); c.stroke(); // incense burner
}
function antiqueLive(c, x) {
  for (const [lx, k] of [[-80, 0], [70, 1], [150, 2]]) { const sw = Math.sin(t * 2 + k) * 0.18; c.save(); c.translate(x + lx, GROUND - 150); c.rotate(sw);
    c.strokeStyle = INK; c.lineWidth = 1.2; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, 12); c.stroke(); c.fillStyle = '#d9a640'; c.beginPath(); c.moveTo(-6, 12); c.lineTo(6, 12); c.lineTo(4, 26); c.lineTo(-4, 26); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#ffcf6b'; c.fillRect(-2.5, 15, 5, 8); c.restore(); addLight(x + lx, GROUND - 130, 40); }
  c.strokeStyle = 'rgba(240,240,240,.5)'; c.lineWidth = 2; c.beginPath(); for (let k = 0; k < 3; k++) { const y0 = GROUND - 24 - ((t * 18 + k * 12) % 36); c.moveTo(x + 150 + Math.sin(y0 * 0.2 + k) * 3, y0); c.lineTo(x + 150 + Math.sin(y0 * 0.2 + k + 1) * 3, y0 - 6); } c.stroke();
}
function lmLibrary(c) { // an open book resting on a rehal (Quran stand)
  c.fillStyle = '#d9d4c8'; c.strokeStyle = SOFT; c.lineWidth = 1.4; c.fillRect(-160, GROUND - 26, 320, 26); c.strokeRect(-160, GROUND - 26, 320, 26);
  c.fillStyle = '#ece8df'; c.strokeStyle = INK; c.lineWidth = 1.4;
  c.beginPath(); c.moveTo(-122, GROUND - 26); c.lineTo(-98, GROUND - 26); c.lineTo(108, GROUND - 118); c.lineTo(86, GROUND - 118); c.closePath(); c.fill(); c.stroke();
  c.beginPath(); c.moveTo(122, GROUND - 26); c.lineTo(98, GROUND - 26); c.lineTo(-108, GROUND - 118); c.lineTo(-86, GROUND - 118); c.closePath(); c.fill(); c.stroke();
  const pg = c.createLinearGradient(0, GROUND - 170, 0, GROUND - 100); pg.addColorStop(0, '#f6efe0'); pg.addColorStop(1, '#cbbf9f');
  for (const sg of [-1, 1]) { c.fillStyle = pg; c.beginPath(); c.moveTo(0, GROUND - 106); c.quadraticCurveTo(sg * 70, GROUND - 160, sg * 156, GROUND - 136); c.lineTo(sg * 156, GROUND - 118); c.quadraticCurveTo(sg * 70, GROUND - 140, 0, GROUND - 92); c.closePath(); c.fill(); c.stroke();
    c.strokeStyle = 'rgba(80,90,110,.45)'; c.lineWidth = 1; c.beginPath(); for (let k = 1; k < 4; k++) { const f = k / 4; c.moveTo(0, GROUND - 104 + f * 10); c.quadraticCurveTo(sg * 70, GROUND - 156 + f * 18, sg * 156, GROUND - 134 + f * 16); } c.stroke(); c.strokeStyle = INK; c.lineWidth = 1.4; }
  c.fillStyle = '#b9a77e'; c.fillRect(-4, GROUND - 108, 8, 18);
  if (night()) for (let k = -140; k <= 140; k += 35) addLight(k, GROUND - 130, 30);
}
function lmFrame(c, x, s) {
  c.save(); c.translate(x, GROUND - 46); c.scale(s, s);
  const g = glassG(c, -70, 70, '#c89b3c', '#f4d27a', '#a87b22'); c.fillStyle = g; c.strokeStyle = 'rgba(90,60,20,.6)'; c.lineWidth = 1.2;
  c.fillRect(-72, -236, 28, 236); c.strokeRect(-72, -236, 28, 236); c.fillRect(44, -236, 28, 236); c.strokeRect(44, -236, 28, 236);
  c.fillRect(-72, -260, 144, 26); c.strokeRect(-72, -260, 144, 26); c.fillStyle = 'rgba(140,190,230,.55)'; c.fillRect(-44, -254, 88, 12);
  c.strokeStyle = 'rgba(120,80,20,.35)'; c.beginPath(); for (let y = -228; y < 0; y += 12) { c.moveTo(-70, y); c.lineTo(-46, y + 6); c.moveTo(46, y); c.lineTo(70, y + 6); } c.stroke();
  c.restore();
}
// Museum of the Future: a wide stainless-steel torus (the "eye") on a green hill. Its windows are
// Arabic calligraphy, quotes by Sheikh Mohammed bin Rashid, flowing round the shell; they glow at night.
const MOF_TXT = ['لن نعيش مئات السنين', 'ولكن يمكن أن نصنع شيئاً يستمر لمئات السنين', 'المستقبل لمن يستطيع تخيله وتصميمه وتنفيذه',
  'المستقبل لا ينتظر', 'المستقبل يمكن تصميمه وبناؤه اليوم', 'سر تجدد الحياة وتطور الحضارة وتقدم البشرية', 'هو في كلمة واحدة: الابتكار'];
function lmMuseum(c) {
  const n = night(), cy = GROUND - 112, OX = 124, OY = 86, IX = 80, IY = 34, ix0 = 8, iy0 = -12; // outer and inner (void) ellipses
  const outer = () => { c.beginPath(); c.ellipse(0, cy, OX, OY, 0, 0, TAU); }, voidP = () => { c.beginPath(); c.ellipse(ix0, cy + iy0, IX, IY, 0, 0, TAU); };
  const ringP = () => { c.beginPath(); c.ellipse(0, cy, OX, OY, 0, 0, TAU); c.ellipse(ix0, cy + iy0, IX, IY, 0, 0, TAU); };
  // steel: light on top, darker underneath, with a soft sheen across the upper left
  const sg = c.createLinearGradient(0, cy - OY, 0, cy + OY);
  sg.addColorStop(0, n ? '#3e4453' : '#f3f5f8'); sg.addColorStop(0.45, n ? '#2c313d' : '#c9cfd8'); sg.addColorStop(1, n ? '#1c2029' : '#8b93a1');
  ringP(); c.fillStyle = sg; c.fill('evenodd');
  c.save(); ringP(); c.clip('evenodd');
  const sh = c.createRadialGradient(-50, cy - 60, 4, -50, cy - 60, 120); sh.addColorStop(0, n ? 'rgba(180,200,255,.18)' : 'rgba(255,255,255,.7)'); sh.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = sh; c.fillRect(-OX, cy - OY, OX * 2, OY * 2);
  // calligraphy: whole words laid along curves between the void and the outer edge, so the Arabic letters stay joined
  const P = (th, u) => [ix0 + IX * Math.cos(th) + (OX * Math.cos(th) - ix0 - IX * Math.cos(th)) * u, cy + iy0 + IY * Math.sin(th) + (OY * Math.sin(th) - iy0 - IY * Math.sin(th)) * u];
  const words = MOF_TXT.join(' ').split(' '); let wi = 0;
  c.fillStyle = n ? '#fff3d0' : 'rgba(34,46,68,.82)'; c.textAlign = 'center'; c.textBaseline = 'middle';
  if (n) { c.shadowColor = 'rgba(255,200,110,.9)'; c.shadowBlur = 6; }
  for (const u of [0.2, 0.5, 0.8]) {
    let th = -Math.PI + 0.02 + u * 0.7;
    for (let guard = 0; guard < 80 && th < Math.PI - 0.02; guard++) {
      const [x0, y0] = P(th, u), [x1, y1] = P(th + 0.01, u), thick = Math.hypot(P(th, 1)[0] - P(th, 0)[0], P(th, 1)[1] - P(th, 0)[1]);
      const size = Math.max(8, Math.min(17, thick * 0.29)), w = words[wi % words.length]; c.font = `700 ${size.toFixed(1)}px ${FONT}`;
      const tw = c.measureText(w).width, step = Math.hypot(x1 - x0, y1 - y0) / 0.01, dth = (tw + size * 0.55) / Math.max(1, step);
      const [mx, my] = P(th + dth / 2, u), [ax, ay] = P(th + dth / 2 + 0.01, u); let ang = Math.atan2(ay - my, ax - mx);
      if (Math.cos(ang) < 0) ang += Math.PI; // keep every word upright
      c.save(); c.translate(mx, my); c.rotate(ang); c.fillText(w, 0, 0); c.restore();
      th += dth; wi++;
    }
  }
  c.shadowBlur = 0; c.restore();
  // depth inside the void: the underside of the top of the ring, and the lit floor of the bottom
  c.save(); voidP(); c.clip();
  c.strokeStyle = n ? 'rgba(20,24,34,.85)' : 'rgba(70,78,92,.75)'; c.lineWidth = 16; c.beginPath(); c.ellipse(ix0 + 4, cy + iy0 - 10, IX, IY, 0, Math.PI * 1.02, Math.PI * 1.98); c.stroke();
  c.strokeStyle = n ? 'rgba(255,210,140,.35)' : 'rgba(255,255,255,.55)'; c.lineWidth = 6; c.beginPath(); c.ellipse(ix0, cy + iy0 + 6, IX, IY, 0, Math.PI * 0.08, Math.PI * 0.92); c.stroke();
  c.restore();
  outer(); c.strokeStyle = 'rgba(50,60,80,.65)'; c.lineWidth = 1.5; c.stroke(); voidP(); c.stroke();
  // the green hill it stands on, with planting and a path to the entrance
  const hg = c.createLinearGradient(0, GROUND - 60, 0, GROUND); hg.addColorStop(0, n ? '#2f5a34' : '#6fb352'); hg.addColorStop(1, n ? '#1f3d24' : '#3f7d3a');
  c.fillStyle = hg; c.strokeStyle = 'rgba(30,60,30,.6)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(-150, GROUND); c.bezierCurveTo(-110, GROUND - 40, -60, GROUND - 52, 0, GROUND - 52); c.bezierCurveTo(60, GROUND - 52, 110, GROUND - 40, 150, GROUND); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = n ? '#3d6d3f' : '#86c463'; for (let k = 0; k < 14; k++) { const x = -128 + k * 19 + sr(k) * 6, y = GROUND - 8 - Math.max(0, 44 - Math.abs(x) * 0.32) * sr(k + 3); c.beginPath(); c.arc(x, y, 3 + sr(k + 7) * 2.5, 0, TAU); c.fill(); }
  c.fillStyle = n ? '#9b8f78' : '#e8dcc2'; c.beginPath(); c.moveTo(-14, GROUND); c.lineTo(-6, GROUND - 40); c.lineTo(6, GROUND - 40); c.lineTo(14, GROUND); c.closePath(); c.fill();
  if (n) { addLight(0, cy, 110); addLight(0, GROUND - 40, 50); }
}
function lmTowers(c, x, s) {
  c.save(); c.translate(x, GROUND - 46); c.scale(s, s);
  for (const [dx, h, w] of [[-34, 260, 38], [28, 214, 32]]) {
    c.fillStyle = glassG(c, dx - w / 2, dx + w / 2, '#9fb0c8', '#e3e9f1', '#66789a'); c.strokeStyle = 'rgba(50,60,90,.6)'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(dx - w / 2, 0); c.lineTo(dx - w / 2, -h); c.lineTo(dx + w / 2, -h - w * 0.95); c.lineTo(dx + w / 2, 0); c.closePath(); c.fill(); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.45)'; c.beginPath(); c.moveTo(dx, 0); c.lineTo(dx, -h - w * 0.45); c.stroke();
    c.strokeStyle = '#8e9aab'; c.lineWidth = 2; c.beginPath(); c.moveTo(dx + w / 2, -h - w * 0.95); c.lineTo(dx + w / 2, -h - w * 0.95 - 30); c.stroke();
    if (SK.n > 0.3) { c.fillStyle = `rgba(255,220,150,${SK.n})`; for (let y = -10; y > -h; y -= 14) c.fillRect(dx - w / 2 + 4, y, w - 8, 2); }
  }
  c.restore();
}
function lmMall(c) {
  const lit = night();
  c.fillStyle = '#e9dcc4'; c.strokeStyle = SOFT; c.lineWidth = 1.4; c.fillRect(-176, GROUND - 116, 352, 116); c.strokeRect(-176, GROUND - 116, 352, 116);
  c.fillStyle = '#d5c3a3'; c.fillRect(-180, GROUND - 124, 360, 10);
  c.fillStyle = 'rgba(150,120,80,.35)'; for (let row = 0; row < 3; row++) for (let k = 0; k < 16; k++) { const x0 = -168 + k * 21, y0 = GROUND - 106 + row * 16; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x0 + 5, y0 - 5); c.lineTo(x0 + 10, y0); c.lineTo(x0 + 5, y0 + 5); c.closePath(); c.fill(); }
  label(c, T('st_mall'), 0, GROUND - 106, 16, '#5a3a22');
  c.fillStyle = lit ? '#ffe7a8' : '#7fa3b8'; c.beginPath(); c.moveTo(-60, GROUND); c.lineTo(-60, GROUND - 50); c.quadraticCurveTo(0, GROUND - 96, 60, GROUND - 50); c.lineTo(60, GROUND); c.closePath(); c.fill(); c.strokeStyle = INK; c.lineWidth = 1.6; c.stroke();
  c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = 1.2; c.beginPath(); for (let k = -48; k <= 48; k += 16) { c.moveTo(k, GROUND); c.lineTo(k, GROUND - 60 + Math.abs(k) * 0.3); } c.stroke();
  if (lit) addLight(0, GROUND - 40, 90);
  for (const wx of [-160, -116, 76, 120]) rectWin(c, wx, GROUND - 60, 34, 40, lit);
  c.fillStyle = '#c8202b'; c.strokeStyle = INK; c.lineWidth = 1.4; c.beginPath(); c.moveTo(-74, GROUND - 52); c.quadraticCurveTo(0, GROUND - 104, 74, GROUND - 52); c.lineTo(66, GROUND - 48); c.quadraticCurveTo(0, GROUND - 94, -66, GROUND - 48); c.closePath(); c.fill(); c.stroke();
}
const palmsAround = (dx, h = 86) => (c, x) => { palm(c, x - dx, GROUND - 4, h, 3); palm(c, x + dx, GROUND - 4, h - 6, 7); };
function fountainLive(c, x) { // the lake and its dancing fountain
  c.fillStyle = rgb(mix([22, 70, 110], [10, 20, 50], SK.n));
  c.fillRect(x - 210, GROUND - 26, 420, 22); c.fillStyle = '#d9cbb0'; c.fillRect(x - 214, GROUND - 6, 428, 6);
  const n = SK.n > 0.3;
  jets(c, x - 190, x + 180, GROUND - 22, 70, 22, k => n ? `hsla(${(t * 60 + k * 16) % 360},90%,72%,.85)` : 'rgba(240,250,255,.85)');
  c.fillStyle = 'rgba(240,250,255,.45)'; c.beginPath(); c.ellipse(x, GROUND - 22, 200, 5, 0, 0, TAU); c.fill();
  if (n) lights.push([x, GROUND - 60, 160]);
}
// Burj Khalifa: three wings round a central core. The wings step back in turn, each setback ending in a
// pointed tip, until the core rises alone into the long spire. Silver-blue glass with vertical steel fins.
const BURJ_L = [[38, 52], [33, 108], [28, 160], [23.5, 208], [19, 252], [15, 292], [11, 326]], BURJ_R = [[38, 80], [33.5, 134], [28.5, 184], [24, 230], [19.5, 272], [15.5, 310], [11.5, 340]];
function burjPath(c) {
  c.beginPath(); c.moveTo(-38, 0);
  for (let i = 0; i < BURJ_L.length; i++) { const [w, h] = BURJ_L[i], wn = i + 1 < BURJ_L.length ? BURJ_L[i + 1][0] : 6.5;
    c.lineTo(-w, -h + 6); c.quadraticCurveTo(-w, -h - 4, -w + 2, -h - 11); c.lineTo(-wn, -h); }
  c.lineTo(-6.5, -356); c.lineTo(-4.2, -368); c.lineTo(-0.7, -440); c.lineTo(0.7, -440); c.lineTo(4.2, -368); c.lineTo(6.5, -356);
  for (let i = BURJ_R.length - 1; i >= 0; i--) { const [w, h] = BURJ_R[i], wn = i + 1 < BURJ_R.length ? BURJ_R[i + 1][0] : 6.5;
    c.lineTo(wn, -h); c.lineTo(w - 2, -h - 11); c.quadraticCurveTo(w, -h - 4, w, -h + 6); }
  c.lineTo(38, 0); c.closePath();
}
function lmBurj(c, x, s) {
  const n = SK.n > 0.3;
  c.save(); c.translate(x, GROUND - 40); c.scale(s, s);
  // glass: darker on the shaded wing, bright down the core, cooler on the far wing
  const g = c.createLinearGradient(-38, 0, 38, 0);
  g.addColorStop(0, n ? '#3b4766' : '#7f93b4'); g.addColorStop(0.42, n ? '#56658a' : '#c9d6e6'); g.addColorStop(0.55, n ? '#6d7da3' : '#eef3f9'); g.addColorStop(1, n ? '#46557a' : '#9aaccb');
  burjPath(c); c.fillStyle = g; c.fill();
  c.save(); burjPath(c); c.clip();
  // the three wings: soft shadow lines where each wing meets the core
  c.fillStyle = n ? 'rgba(10,16,34,.3)' : 'rgba(40,55,90,.16)'; c.fillRect(-8, -360, 2.6, 360); c.fillRect(5.4, -360, 2.6, 360);
  // vertical steel fins, and a faint line at every floor band
  c.strokeStyle = n ? 'rgba(160,180,220,.18)' : 'rgba(255,255,255,.4)'; c.lineWidth = 0.6; c.beginPath();
  for (let fx = -37; fx <= 37; fx += 3) { c.moveTo(fx, 0); c.lineTo(fx, -360); } c.stroke();
  c.strokeStyle = n ? 'rgba(0,0,0,.18)' : 'rgba(60,75,110,.14)'; c.beginPath(); for (let fy = -10; fy > -360; fy -= 10) { c.moveTo(-39, fy); c.lineTo(39, fy); } c.stroke();
  // the spire: bare steel with service rings
  c.fillStyle = n ? '#8d97ad' : '#dfe5ee'; c.fillRect(-5, -440, 10, 84); c.fillStyle = n ? 'rgba(0,0,0,.25)' : 'rgba(90,100,120,.35)'; for (let ry = -372; ry > -430; ry -= 14) c.fillRect(-5, ry, 10, 1.4);
  if (n) { // lit windows and the LED facade glow
    c.fillStyle = `rgba(255,230,170,${0.55 * SK.n})`; for (let k = 0; k < 140; k++) { const fy = -6 - sr(k * 1.7) * 330, half = 36 * (1 + fy / 380); c.fillRect((sr(k * 3.1) * 2 - 1) * half, fy, 1.6, 2.2); }
    c.fillStyle = `rgba(140,190,255,${0.12 * SK.n})`; c.fillRect(-39, -360, 78, 360);
  }
  c.restore();
  burjPath(c); c.strokeStyle = n ? 'rgba(20,26,46,.8)' : 'rgba(44,56,88,.75)'; c.lineWidth = 1.2; c.stroke();
  if (n) { c.fillStyle = '#ff4d4d'; c.beginPath(); c.arc(0, -440, 2.4, 0, TAU); c.fill(); c.fillStyle = 'rgba(255,240,200,.9)'; for (const by of [-300, -230]) c.fillRect(-0.8, by, 1.6, 4); }
  c.restore(); if (n) lights.push([x, GROUND - 40 - 220 * s, 120]);
}
function lmOpera(c) { // glass building shaped like a dhow
  c.fillStyle = '#d9d4c8'; c.fillRect(-170, GROUND - 14, 340, 14);
  const g = c.createLinearGradient(0, GROUND - 120, 0, GROUND); g.addColorStop(0, '#d9e3ef'); g.addColorStop(1, '#7d92b2');
  c.fillStyle = g; c.strokeStyle = INK; c.lineWidth = 1.6; c.beginPath(); c.moveTo(-160, GROUND - 14); c.lineTo(-150, GROUND - 74); c.lineTo(84, GROUND - 80); c.quadraticCurveTo(134, GROUND - 84, 168, GROUND - 126); c.lineTo(150, GROUND - 46); c.quadraticCurveTo(124, GROUND - 14, 90, GROUND - 14); c.closePath(); c.fill(); c.stroke();
  c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 1; c.beginPath(); for (let k = -140; k < 120; k += 22) { c.moveTo(k, GROUND - 16); c.lineTo(k + 10, GROUND - 76); } c.moveTo(-150, GROUND - 46); c.lineTo(150, GROUND - 46); c.stroke();
  if (night()) { c.fillStyle = 'rgba(255,220,150,.55)'; c.fillRect(-150, GROUND - 44, 290, 26); addLight(0, GROUND - 40, 110); }
  label(c, T('st_opera'), -40, GROUND - 6, 9, '#5a3a22');
}
function lmMosque(c) {
  const lit = night(), stone = '#ecdcb8';
  for (const mx of [-142, 142]) { c.fillStyle = stone; c.strokeStyle = SOFT; c.lineWidth = 1.4; c.fillRect(mx - 8, GROUND - 200, 16, 200); c.strokeRect(mx - 8, GROUND - 200, 16, 200);
    c.fillRect(mx - 12, GROUND - 150, 24, 7); c.strokeRect(mx - 12, GROUND - 150, 24, 7); c.fillRect(mx - 11, GROUND - 196, 22, 6);
    c.beginPath(); c.arc(mx, GROUND - 200, 8, Math.PI, 0); c.fill(); c.stroke(); c.strokeStyle = '#c9a777'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(mx, GROUND - 208); c.lineTo(mx, GROUND - 218); c.stroke(); if (lit) addLight(mx, GROUND - 170, 30); }
  c.fillStyle = stone; c.strokeStyle = SOFT; c.lineWidth = 1.4; c.fillRect(-122, GROUND - 92, 244, 92); c.strokeRect(-122, GROUND - 92, 244, 92);
  c.fillStyle = '#d9c39a'; for (let k = -122; k < 122; k += 10) { c.beginPath(); c.moveTo(k, GROUND - 92); c.lineTo(k + 5, GROUND - 100); c.lineTo(k + 10, GROUND - 92); c.fill(); }
  for (let k = 0; k < 5; k++) archWin(c, -108 + k * 46, GROUND - 76, 18, 40, lit);
  c.fillStyle = stone; c.fillRect(-36, GROUND - 112, 72, 22); c.strokeRect(-36, GROUND - 112, 72, 22);
  const dg = c.createLinearGradient(-44, 0, 44, 0); dg.addColorStop(0, '#f6ead0'); dg.addColorStop(1, '#cdb48c'); c.fillStyle = dg;
  c.beginPath(); c.moveTo(-40, GROUND - 112); c.quadraticCurveTo(-42, GROUND - 168, 0, GROUND - 172); c.quadraticCurveTo(42, GROUND - 168, 40, GROUND - 112); c.closePath(); c.fill(); c.stroke();
  c.strokeStyle = 'rgba(150,120,80,.45)'; c.lineWidth = 1; c.beginPath(); for (let k = -30; k <= 30; k += 10) { c.moveTo(k, GROUND - 112); c.quadraticCurveTo(k * 0.7, GROUND - 150, 0, GROUND - 170); } c.stroke();
  c.strokeStyle = '#c9a777'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, GROUND - 172); c.lineTo(0, GROUND - 186); c.stroke(); c.fillStyle = '#c9a777'; c.beginPath(); c.arc(1, GROUND - 190, 4, 0.6, Math.PI * 1.7); c.fill();
  for (const dx of [-82, 82]) { c.fillStyle = dg; c.strokeStyle = SOFT; c.lineWidth = 1.4; c.beginPath(); c.arc(dx, GROUND - 92, 16, Math.PI, 0); c.fill(); c.stroke(); }
}
function lmLaMer(c) { // colourful beachfront with painted walls, a boardwalk and swings
  c.fillStyle = '#a8743f'; c.fillRect(-170, GROUND - 8, 340, 8);
  const cols = ['#e0479e', '#2b9bd6', '#f2c230', '#33b679'];
  for (let k = 0; k < 4; k++) { const x0 = -164 + k * 70; c.fillStyle = cols[k]; c.strokeStyle = INK; c.lineWidth = 1.4; c.fillRect(x0, GROUND - 78, 62, 70); c.strokeRect(x0, GROUND - 78, 62, 70);
    c.strokeStyle = cols[(k + 2) % 4]; c.lineWidth = 3; c.beginPath(); c.arc(x0 + 20, GROUND - 52, 10, 0, TAU); c.moveTo(x0 + 6, GROUND - 22); for (let j = 0; j < 5; j++) c.lineTo(x0 + 14 + j * 10, GROUND - 22 - (j % 2) * 10); c.stroke();
    c.fillStyle = '#fffaf0'; c.beginPath(); c.arc(x0 + 44, GROUND - 60, 5, 0, TAU); c.fill(); }
  c.strokeStyle = '#8a5a35'; c.lineWidth = 5; c.beginPath(); c.moveTo(118, GROUND); c.lineTo(136, GROUND - 92); c.lineTo(154, GROUND); c.moveTo(136, GROUND - 92); c.lineTo(170, GROUND - 92); c.stroke();
  c.strokeStyle = INK; c.lineWidth = 1.2; c.beginPath(); c.moveTo(146, GROUND - 92); c.lineTo(146, GROUND - 30); c.moveTo(162, GROUND - 92); c.lineTo(162, GROUND - 30); c.stroke(); c.fillStyle = '#e8573b'; c.fillRect(142, GROUND - 32, 24, 5);
  lmSign(c, T('st_lamer'), -60, GROUND - 96, 90, '#e0479e');
}
function kiteLive(c, x) { // kitesurfers on the sea and their arc kites
  const top = GROUND - 78;
  for (let k = 0; k < 3; k++) { const sx = x + (k - 1) * 150 + Math.sin(t * 0.8 + k) * 20, sy = top + 24 + k * 10, kx = sx + 40 + Math.sin(t * 1.1 + k) * 14, ky = 40 + k * 26 + Math.sin(t * 1.4 + k) * 8;
    c.strokeStyle = 'rgba(43,26,18,.4)'; c.lineWidth = 1; c.beginPath(); c.moveTo(sx, sy - 12); c.lineTo(kx - 22, ky + 6); c.moveTo(sx, sy - 12); c.lineTo(kx + 22, ky + 6); c.stroke();
    c.fillStyle = ['#e23b4a', '#f2c230', '#2b9bd6'][k]; c.strokeStyle = INK; c.lineWidth = 1.4; c.beginPath(); c.moveTo(kx - 26, ky + 8); c.quadraticCurveTo(kx, ky - 16, kx + 26, ky + 8); c.quadraticCurveTo(kx, ky - 4, kx - 26, ky + 8); c.fill(); c.stroke();
    c.fillStyle = '#fffaf0'; c.fillRect(sx - 9, sy, 18, 3); c.fillStyle = '#1d1f24'; c.beginPath(); c.arc(sx, sy - 14, 3, 0, TAU); c.fill(); c.fillRect(sx - 2, sy - 11, 4, 10);
    c.fillStyle = 'rgba(255,255,255,.7)'; c.beginPath(); c.moveTo(sx - 26, sy + 3); c.quadraticCurveTo(sx - 14, sy - 1, sx - 8, sy + 3); c.fill(); }
}
function sailHotel(c, x, s) { // sail-shaped hotel on its own island
  const y = GROUND - 76, h = 150;
  c.save(); c.translate(x, y); c.scale(s, s);
  c.strokeStyle = 'rgba(240,240,240,.85)'; c.lineWidth = 2; c.beginPath(); c.moveTo(-36, 1); c.lineTo(-240, 10); c.stroke();
  c.fillStyle = '#d8c39a'; c.beginPath(); c.ellipse(0, 0, 44, 6, 0, 0, TAU); c.fill();
  const g = c.createLinearGradient(-20, 0, 34, 0); g.addColorStop(0, '#f2f5fa'); g.addColorStop(1, '#b4c2d6');
  const sail = () => { c.beginPath(); c.moveTo(-18, -2); c.lineTo(-14, -h); c.quadraticCurveTo(34, -h * 0.62, 26, -2); c.closePath(); };
  sail(); c.fillStyle = g; c.fill();
  c.save(); sail(); c.clip(); c.strokeStyle = 'rgba(110,125,150,.35)'; c.lineWidth = 1; c.beginPath(); for (let k = 1; k < 12; k++) { const yy = -k * h / 12; c.moveTo(-20, yy); c.lineTo(40, yy); } c.stroke();
  if (SK.n > 0.3) { c.fillStyle = `rgba(150,180,255,${SK.n * 0.35})`; c.fillRect(-20, -h, 60, h); } c.restore();
  sail(); c.strokeStyle = '#7d8aa0'; c.lineWidth = 1.4; c.stroke();
  c.strokeStyle = '#e8edf4'; c.lineWidth = 4; c.beginPath(); c.moveTo(-21, 2); c.lineTo(-15, -h - 14); c.stroke();
  c.strokeStyle = '#9aa6ba'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(-20, -10); c.lineTo(-30, -h * 0.55); c.lineTo(-16, -h * 0.95); c.stroke();
  c.fillStyle = '#e8edf4'; c.beginPath(); c.ellipse(8, -h * 0.84, 10, 2.6, 0, 0, TAU); c.fill(); c.stroke();
  c.restore(); if (SK.n > 0.3) lights.push([x, y - h * 0.5 * s, 100]);
}
function lmMadinat(c) { // sandstone wind towers along a canal
  c.fillStyle = '#3f8fa8'; c.fillRect(-170, GROUND - 30, 340, 26); c.fillStyle = '#c4ab80'; c.fillRect(-170, GROUND - 6, 340, 6);
  const lit = night();
  for (const [bx, bw, bh] of [[-166, 90, 100], [-80, 70, 130], [-14, 100, 90], [82, 84, 120]]) { c.fillStyle = '#e3c99c'; c.strokeStyle = SOFT; c.lineWidth = 1.2; c.fillRect(bx, GROUND - 30 - bh, bw, bh); c.strokeRect(bx, GROUND - 30 - bh, bw, bh);
    for (let k = 0; k < Math.floor(bw / 26); k++) archWin(c, bx + 8 + k * 26, GROUND - 30 - bh + 20, 12, 22, lit && sr(bx + k) > 0.3);
    windTower(c, bx + bw / 2 - 14, GROUND - 30 - bh - 48, 28); }
}
function madinatLive(c, x) { abra(c, x - 40 + Math.sin(t * 0.4) * 30, GROUND - 14, 0.55, '#e3b23c'); }
function lmMonorail(c) {
  c.fillStyle = '#d9dce2'; c.strokeStyle = SOFT; c.lineWidth = 1.2;
  for (const px of [-160, -40, 80, 200]) { c.beginPath(); c.moveTo(px - 8, GROUND); c.lineTo(px - 5, GROUND - 100); c.lineTo(px + 5, GROUND - 100); c.lineTo(px + 8, GROUND); c.closePath(); c.fill(); c.stroke(); }
  c.fillStyle = '#e6e8ec'; c.fillRect(-210, GROUND - 112, 420, 12); c.strokeRect(-210, GROUND - 112, 420, 12);
  lmSign(c, T('st_monorail'), 20, GROUND - 60, 120, '#1f7a74');
}
function monoLive(c, x) {
  const tx = x - 260 + ((t * 70) % 520);
  for (let k = 0; k < 3; k++) { const cx = tx - k * 64; if (cx < x - 230 || cx > x + 220) continue;
    c.fillStyle = '#f4f6f8'; c.strokeStyle = INK; c.lineWidth = 1.3; c.beginPath(); if (k === 0) { c.moveTo(cx, GROUND - 112); c.lineTo(cx + 54, GROUND - 112); c.quadraticCurveTo(cx + 68, GROUND - 116, cx + 60, GROUND - 134); c.lineTo(cx, GROUND - 136); } else c.rect(cx, GROUND - 136, 60, 24); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#2b9bd6'; c.fillRect(cx + 2, GROUND - 118, 56, 3); c.fillStyle = SK.n > 0.3 ? '#ffe7a8' : '#3b5568'; for (let w = 0; w < 4; w++) c.fillRect(cx + 5 + w * 13, GROUND - 132, 9, 8); }
}
function lmRoyal(c, x, s) { // stacked, offset blocks
  c.save(); c.translate(x, GROUND - 74); c.scale(s, s);
  c.fillStyle = '#d8c39a'; c.beginPath(); c.ellipse(0, 0, 140, 7, 0, 0, TAU); c.fill();
  const blocks = [[-80, -100, 60, 100], [20, -100, 60, 100], [-100, -130, 90, 30], [-20, -160, 100, 30], [-70, -190, 90, 30], [10, -220, 80, 30], [-40, -250, 70, 30], [30, -130, 70, 30]];
  for (const [bx, by, bw, bh] of blocks) { c.fillStyle = '#efe6d6'; c.strokeStyle = 'rgba(60,60,80,.45)'; c.lineWidth = 1; c.fillRect(bx, by, bw, bh); c.strokeRect(bx, by, bw, bh);
    c.fillStyle = SK.n > 0.3 ? `rgba(255,220,150,${0.4 + SK.n * 0.4})` : '#8fb8d8'; c.fillRect(bx + 3, by + bh * 0.35, bw - 6, bh * 0.3); }
  c.restore();
}
function lmSlides(c) { // water-park temple with twisting slides
  c.fillStyle = '#4fd1e0'; c.fillRect(-150, GROUND - 14, 300, 14);
  for (let k = 0; k < 5; k++) { const w = 200 - k * 34, y = GROUND - 14 - k * 30; c.fillStyle = k % 2 ? '#d9b77a' : '#cfa865'; c.strokeStyle = SOFT; c.lineWidth = 1.2; c.fillRect(-w / 2, y - 30, w, 30); c.strokeRect(-w / 2, y - 30, w, 30); }
  c.fillStyle = '#b98f52'; c.fillRect(-26, GROUND - 210, 52, 46); c.fillStyle = '#3d2417'; c.fillRect(-10, GROUND - 196, 20, 32);
  const tube = (col, pts) => { c.lineCap = 'round'; for (const [lw, cc] of [[12, INK], [9, col]]) { c.strokeStyle = cc; c.lineWidth = lw; c.beginPath(); c.moveTo(pts[0], pts[1]); c.bezierCurveTo(pts[2], pts[3], pts[4], pts[5], pts[6], pts[7]); c.stroke(); } };
  tube('#2b9bd6', [-20, GROUND - 190, -150, GROUND - 160, -40, GROUND - 60, -140, GROUND - 16]);
  tube('#f2c230', [20, GROUND - 190, 150, GROUND - 140, 30, GROUND - 70, 130, GROUND - 16]);
  tube('#e23b4a', [0, GROUND - 168, 90, GROUND - 120, -90, GROUND - 80, 10, GROUND - 16]);
}
function lmWalk(c) { // JBR towers with cafés at their feet
  const lit = night();
  for (const [tx, tw, col] of [[-164, 120, '#e8c9a8'], [44, 120, '#d9b48f']]) { c.fillStyle = col; c.strokeStyle = SOFT; c.lineWidth = 1.4; c.fillRect(tx, GROUND - 300, tw, 300); c.strokeRect(tx, GROUND - 300, tw, 300);
    for (let y = GROUND - 290; y < GROUND - 60; y += 18) for (let k = 0; k < 4; k++) { c.fillStyle = lit && sr(tx + y + k) > 0.45 ? '#ffe7a8' : '#7f93a8'; c.fillRect(tx + 8 + k * 28, y, 20, 10); }
    c.fillStyle = 'rgba(255,255,255,.25)'; for (let y = GROUND - 280; y < GROUND - 60; y += 18) c.fillRect(tx + 4, y + 11, tw - 8, 2); }
  for (const ax of [-150, -60, 58, 150]) { c.fillStyle = '#fffaf0'; c.strokeStyle = INK; c.lineWidth = 1.3; c.beginPath(); c.moveTo(ax - 30, GROUND - 46); c.quadraticCurveTo(ax, GROUND - 70, ax + 30, GROUND - 46); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#1f7a74'; for (let k = -28; k < 28; k += 14) c.fillRect(ax + k, GROUND - 48, 7, 3); c.strokeStyle = '#9aa0aa'; c.lineWidth = 2; c.beginPath(); c.moveTo(ax, GROUND - 58); c.lineTo(ax, GROUND); c.stroke();
    c.fillStyle = '#f4f4f2'; c.fillRect(ax - 12, GROUND - 20, 24, 3); }
  if (lit) addLight(0, GROUND - 40, 120);
  lmSign(c, T('st_walk'), 0, GROUND - 80, 90, '#1f7a74');
}
function lmEye(c, x, s) { // giant observation wheel on its island
  c.save(); c.translate(x, GROUND - 70); c.scale(s, s);
  c.fillStyle = '#d8c39a'; c.beginPath(); c.ellipse(0, 0, 150, 8, 0, 0, TAU); c.fill();
  const hy = -170, R = 150, n = SK.n > 0.3;
  c.strokeStyle = '#e9edf2'; c.lineWidth = 9; c.lineCap = 'round'; c.beginPath(); c.moveTo(-80, 0); c.lineTo(-6, hy); c.moveTo(-34, 0); c.lineTo(-2, hy); c.moveTo(34, 0); c.lineTo(2, hy); c.moveTo(80, 0); c.lineTo(6, hy); c.stroke();
  c.strokeStyle = 'rgba(80,90,110,.5)'; c.lineWidth = 1; c.stroke();
  c.strokeStyle = n ? `hsla(${(t * 40) % 360},80%,70%,.9)` : '#cfd6df'; c.lineWidth = 4; c.beginPath(); c.arc(0, hy, R, 0, TAU); c.stroke(); c.lineWidth = 2; c.beginPath(); c.arc(0, hy, R - 10, 0, TAU); c.stroke();
  const rot = t * 0.05; c.strokeStyle = 'rgba(200,210,225,.7)'; c.lineWidth = 0.8; c.beginPath(); for (let k = 0; k < 32; k++) { const a = rot + k * TAU / 32; c.moveTo(0, hy); c.lineTo(Math.cos(a) * (R - 10), hy + Math.sin(a) * (R - 10)); } c.stroke();
  for (let k = 0; k < 24; k++) { const a = rot + k * TAU / 24, px = Math.cos(a) * (R + 6), py = hy + Math.sin(a) * (R + 6);
    c.fillStyle = n ? '#ffe7a8' : '#f4f6f8'; c.strokeStyle = 'rgba(60,70,90,.7)'; c.lineWidth = 1; c.beginPath(); c.ellipse(px, py, 7, 4.5, a, 0, TAU); c.fill(); c.stroke(); }
  c.fillStyle = '#e9edf2'; c.beginPath(); c.arc(0, hy, 12, 0, TAU); c.fill(); c.stroke();
  c.restore(); if (n) lights.push([x, GROUND - 70 + hy * s, 140]);
}
function lmMarina(c, x, s) { // marina skyline with a twisting tower
  c.save(); c.translate(x, GROUND - 50); c.scale(s, s);
  for (const [dx, h, w] of [[-130, 210, 30], [-90, 270, 34], [80, 240, 30], [124, 190, 28], [-170, 160, 26]]) { c.fillStyle = glassG(c, dx - w / 2, dx + w / 2, '#8fa3bf', '#d3dde9', '#5f7396'); c.fillRect(dx - w / 2, -h, w, h);
    c.fillStyle = '#8e9aab'; c.fillRect(dx - 1, -h - 26, 2, 26); if (SK.n > 0.3) { c.fillStyle = `rgba(255,220,150,${SK.n})`; for (let y = -10; y > -h; y -= 12) if (sr(dx + y) > 0.4) c.fillRect(dx - w / 2 + 4, y, w - 8, 3); } }
  for (let k = 0; k < 22; k++) { const ox = Math.sin(k * 0.3) * 9, w = 38; c.fillStyle = k % 2 ? '#c6d3e2' : '#9fb3cc'; c.fillRect(ox - w / 2, -14 - k * 14, w, 14); }
  c.restore();
}
// ---------- leg 2: inland, from Expo City back to the Creek ----------
function horse(c, x, y, ph, s, col, rider) { // galloping horse, optionally with a rider
  c.save(); c.translate(x, y); c.scale(s, s); c.strokeStyle = INK; c.lineWidth = 1.3; c.fillStyle = col;
  const g = Math.sin(ph);
  for (const [lx, a] of [[-14, g], [-8, -g], [12, -g], [18, g]]) { c.save(); c.translate(lx, -22); c.rotate(a * 0.55); c.fillRect(-1.8, 0, 3.6, 21); c.restore(); }
  c.beginPath(); c.ellipse(2, -28, 21, 9, 0, 0, TAU); c.fill(); c.stroke();
  c.beginPath(); c.moveTo(17, -33); c.quadraticCurveTo(24, -44 - g * 2, 29, -46); c.lineTo(35, -40); c.lineTo(31, -37); c.quadraticCurveTo(26, -34, 22, -26); c.closePath(); c.fill(); c.stroke();
  c.strokeStyle = '#2a1a14'; c.lineWidth = 3; c.beginPath(); c.moveTo(-19, -31); c.quadraticCurveTo(-28, -28 + g * 4, -30, -18); c.stroke();
  c.beginPath(); c.moveTo(20, -38); c.quadraticCurveTo(24, -44, 28, -46); c.stroke();
  if (rider) { c.fillStyle = rider; c.strokeStyle = INK; c.lineWidth = 1.2; c.beginPath(); c.ellipse(2, -42, 5, 8, 0.3, 0, TAU); c.fill(); c.stroke();
    c.fillStyle = '#c98b5a'; c.beginPath(); c.arc(5, -53, 4, 0, TAU); c.fill(); c.stroke(); c.fillStyle = '#fffaf0'; c.beginPath(); c.arc(5, -55, 4.4, Math.PI, 0); c.fill(); c.stroke(); }
  c.restore();
}
function camel(c, x, y, ph, s) {
  c.save(); c.translate(x, y); c.scale(s, s); c.fillStyle = '#b07a43'; c.strokeStyle = INK; c.lineWidth = 1.2;
  for (let k = 0; k < 4; k++) { const a = Math.sin(ph + (k % 2 ? Math.PI : 0) + (k > 1 ? 0.6 : 0)) * 0.3; c.save(); c.translate(-18 + k * 12, -34); c.rotate(a); c.fillRect(-2, 0, 4, 34); c.restore(); }
  c.beginPath(); c.ellipse(0, -40, 26, 12, 0, 0, TAU); c.fill(); c.stroke(); c.beginPath(); c.arc(-4, -50, 11, Math.PI, 0); c.fill();
  c.beginPath(); c.moveTo(22, -44); c.quadraticCurveTo(34, -48, 32, -66 + Math.sin(ph) * 1.5); c.lineTo(40, -68); c.lineTo(40, -62); c.lineTo(36, -60); c.quadraticCurveTo(38, -44, 24, -34); c.closePath(); c.fill(); c.stroke();
  sadu(c, -14, -56, 22, 6); c.restore();
}
function datePalm(c, x, h, i) { // date palm with fruit
  palm(c, x, GROUND - 2, h, i); c.fillStyle = '#d98a1f'; c.beginPath(); c.arc(x + 4, GROUND - 2 - h + 10, 4, 0, TAU); c.arc(x + 10, GROUND - 2 - h + 9, 3.5, 0, TAU); c.fill();
}
// Expo City: shaded walkways and pavilions
function expoTile(c, i) {
  const r = sr(i * 2.9 + 3), lit = night();
  if (r < 0.5) { // pavilion with a tensile shade roof
    c.fillStyle = ['#f2efe8', '#e9e2d4', '#efe9df'][Math.floor(sr(i + 1) * 3)]; c.strokeStyle = SOFT; c.lineWidth = 1.4; c.fillRect(20, GROUND - 82, 180, 82); c.strokeRect(20, GROUND - 82, 180, 82);
    c.fillStyle = lit ? '#ffe7a8' : '#7fa3b8'; c.fillRect(30, GROUND - 60, 160, 40); if (lit) addLight(110, GROUND - 40, 70);
    c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = 1; c.beginPath(); for (let k = 30; k <= 190; k += 20) { c.moveTo(k, GROUND - 60); c.lineTo(k, GROUND - 20); } c.stroke();
    c.fillStyle = '#fffaf0'; c.strokeStyle = INK; c.lineWidth = 1.4; c.beginPath(); c.moveTo(10, GROUND - 84); c.quadraticCurveTo(60, GROUND - 100, 110, GROUND - 122); c.quadraticCurveTo(160, GROUND - 100, 210, GROUND - 84); c.quadraticCurveTo(110, GROUND - 96, 10, GROUND - 84); c.fill(); c.stroke();
    c.strokeStyle = '#9aa0aa'; c.lineWidth = 2; c.beginPath(); c.moveTo(110, GROUND - 122); c.lineTo(110, GROUND - 140); c.stroke();
    c.fillStyle = ['#e8573b', '#1f7a74', '#f2c230', '#2b9bd6'][Math.floor(sr(i + 5) * 4)]; c.fillRect(40, GROUND - 76, 60, 10);
  } else { // shade canopy over a walkway with benches
    for (const px of [40, 110, 180]) { c.strokeStyle = '#c9ccd3'; c.lineWidth = 4; c.beginPath(); c.moveTo(px, GROUND); c.lineTo(px, GROUND - 90); c.stroke(); }
    c.fillStyle = 'rgba(244,240,230,.92)'; c.strokeStyle = SOFT; c.lineWidth = 1.2; c.beginPath(); c.moveTo(20, GROUND - 92); for (let k = 0; k < 6; k++) c.quadraticCurveTo(35 + k * 30, GROUND - 106 + (k % 2) * 18, 50 + k * 30, GROUND - 92); c.lineTo(200, GROUND - 88); c.lineTo(20, GROUND - 88); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#8a5a35'; c.fillRect(56, GROUND - 16, 40, 5); c.fillRect(126, GROUND - 16, 40, 5);
  }
}
// Al Habtoor: fairways, bunkers and flags
function golfTile(c, i) {
  const r = sr(i * 3.3 + 7);
  c.fillStyle = '#6aaa4f'; c.beginPath(); c.moveTo(0, GROUND); c.quadraticCurveTo(70, GROUND - 40 - r * 20, 150, GROUND - 22); c.quadraticCurveTo(200, GROUND - 14, 240, GROUND); c.closePath(); c.fill();
  c.fillStyle = '#82c062'; c.beginPath(); c.ellipse(90 + r * 40, GROUND - 22, 46, 8, 0, 0, TAU); c.fill();
  c.fillStyle = '#ecd9a4'; c.beginPath(); c.ellipse(30 + r * 30, GROUND - 8, 26, 5, 0, 0, TAU); c.fill();
  if (r > 0.3) { const fx = 100 + r * 40; c.strokeStyle = '#f4f4f2'; c.lineWidth = 2; c.beginPath(); c.moveTo(fx, GROUND - 22); c.lineTo(fx, GROUND - 58); c.stroke(); c.fillStyle = '#e23b2a'; c.beginPath(); c.moveTo(fx, GROUND - 58); c.lineTo(fx + 16, GROUND - 53); c.lineTo(fx, GROUND - 48); c.closePath(); c.fill(); }
  if (r < 0.4) { const gx = 170; c.fillStyle = '#f4f4f2'; c.strokeStyle = INK; c.lineWidth = 1.3; c.fillRect(gx, GROUND - 30, 40, 16); c.strokeRect(gx, GROUND - 30, 40, 16); c.fillStyle = '#1f7a74'; c.fillRect(gx - 2, GROUND - 46, 44, 5); c.strokeRect(gx - 2, GROUND - 46, 44, 5);
    c.strokeStyle = '#9aa0aa'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(gx + 2, GROUND - 41); c.lineTo(gx + 2, GROUND - 30); c.moveTo(gx + 38, GROUND - 41); c.lineTo(gx + 38, GROUND - 30); c.stroke();
    for (const wx of [gx + 8, gx + 32]) { c.fillStyle = '#1b1b1f'; c.beginPath(); c.arc(wx, GROUND - 8, 6, 0, TAU); c.fill(); } }
}
// Al Khawaneej: farms behind mud walls and date palms
function farmTile(c, i) {
  const r = sr(i * 2.3 + 9);
  c.fillStyle = '#d8b788'; c.strokeStyle = SOFT; c.lineWidth = 1.2; c.fillRect(0, GROUND - 44, 236, 44); c.strokeRect(0, GROUND - 44, 236, 44);
  c.fillStyle = '#c9a674'; for (let k = 0; k < 236; k += 18) { c.beginPath(); c.moveTo(k, GROUND - 44); c.lineTo(k + 9, GROUND - 52); c.lineTo(k + 18, GROUND - 44); c.fill(); }
  c.fillStyle = 'rgba(120,80,40,.15)'; for (let k = 0; k < 30; k++) c.fillRect(sr(i * 3 + k) * 230, GROUND - 40 + sr(i * 5 + k) * 36, 4, 2);
  if (r > 0.5) { c.fillStyle = '#6b4a2c'; c.strokeStyle = INK; c.lineWidth = 1.4; c.beginPath(); c.moveTo(96, GROUND); c.lineTo(96, GROUND - 34); c.quadraticCurveTo(118, GROUND - 52, 140, GROUND - 34); c.lineTo(140, GROUND); c.closePath(); c.fill(); c.stroke();
    c.strokeStyle = '#d9a640'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(118, GROUND - 42); c.lineTo(118, GROUND); c.stroke(); }
  else { c.fillStyle = '#5fb7d4'; c.fillRect(40, GROUND - 8, 150, 5); } // falaj water channel
}
// Dubai Creek Harbour: new towers and terraces
function harbourTile(c, i) {
  const r = sr(i * 1.7 + 4), h = 120 + r * 50, lit = night();
  const g = c.createLinearGradient(0, GROUND - h, 0, GROUND); g.addColorStop(0, '#d9e3ef'); g.addColorStop(1, '#8ea3bf');
  c.fillStyle = g; c.strokeStyle = SOFT; c.lineWidth = 1.4; c.beginPath(); c.moveTo(20, GROUND); c.lineTo(20, GROUND - h); c.quadraticCurveTo(110, GROUND - h - 18, 200, GROUND - h + 6); c.lineTo(200, GROUND); c.closePath(); c.fill(); c.stroke();
  for (let y = GROUND - h + 14; y < GROUND - 40; y += 14) { c.fillStyle = 'rgba(255,255,255,.55)'; c.fillRect(20, y, 180, 3); if (lit) for (let k = 0; k < 8; k++) if (sr(i + y + k) > 0.5) { c.fillStyle = '#ffe7a8'; c.fillRect(26 + k * 22, y - 9, 14, 7); } }
  c.fillStyle = lit ? '#ffe7a8' : '#2a3a4c'; c.fillRect(28, GROUND - 36, 164, 36); if (lit) addLight(110, GROUND - 20, 80);
  for (const ax of [60, 150]) { c.fillStyle = '#fffaf0'; c.strokeStyle = INK; c.lineWidth = 1.2; c.beginPath(); c.moveTo(ax - 22, GROUND - 30); c.quadraticCurveTo(ax, GROUND - 46, ax + 22, GROUND - 30); c.closePath(); c.fill(); c.stroke(); c.strokeStyle = '#9aa0aa'; c.lineWidth = 2; c.beginPath(); c.moveTo(ax, GROUND - 38); c.lineTo(ax, GROUND); c.stroke(); }
}
function sandHills(c) { // low sand hills behind the farms
  const off = worldX * 0.15, step = COARSE ? 14 : 10; c.fillStyle = rgb(mix([226, 186, 128], [70, 60, 90], SK.n * 0.7), 0.75);
  c.beginPath(); c.moveTo(0, GROUND); for (let x = 0; x <= W + step; x += step) { const X = x + off; c.lineTo(x, GROUND - 50 - Math.sin(X * 0.006) * 20 - Math.abs(Math.sin(X * 0.0023)) * 26); } c.lineTo(W + step, GROUND); c.fill();
}
function rails(c) { // racecourse rails
  const y = GROUND - 30, off = (worldX * 0.32) % 60; c.fillStyle = '#7fb85a'; c.fillRect(-20, y - 6, W + 40, 36);
  c.strokeStyle = '#fffaf0'; c.lineWidth = 3; c.beginPath(); c.moveTo(-20, y - 18); c.lineTo(W + 20, y - 18); for (let x = -off; x < W + 20; x += 60) { c.moveTo(x, y - 18); c.lineTo(x, y); } c.stroke();
}
// ---- leg 2 landmarks ----
function lmWasl(c) { // a huge steel trellis dome
  const R = 168, Hd = 212, n = night();
  c.fillStyle = n ? 'rgba(255,160,90,.28)' : 'rgba(225,236,246,.4)'; c.beginPath(); c.ellipse(0, GROUND, R, Hd, 0, Math.PI, 0); c.closePath(); c.fill();
  if (n) { for (let k = 0; k < 4; k++) { c.fillStyle = ['rgba(255,90,140,.25)', 'rgba(90,200,255,.25)', 'rgba(255,210,90,.25)', 'rgba(140,255,170,.2)'][k]; c.beginPath(); c.ellipse(-90 + k * 60, GROUND - 90 - (k % 2) * 30, 50, 60, 0, 0, TAU); c.fill(); } addLight(0, GROUND - 100, 160); }
  c.strokeStyle = '#eef2f6'; c.lineWidth = 2.2;
  for (let k = 1; k <= 5; k++) { c.beginPath(); c.ellipse(0, GROUND, R * k / 5, Hd, 0, Math.PI, 0); c.stroke(); }
  for (let j = 1; j <= 6; j++) { const a = j * Math.PI / 14, y = GROUND - Hd * Math.sin(a), w = R * Math.cos(a); c.beginPath(); c.ellipse(0, y, w, w * 0.1, 0, 0, Math.PI); c.stroke(); }
  c.strokeStyle = 'rgba(60,70,90,.5)'; c.lineWidth = 1.2; c.beginPath(); c.ellipse(0, GROUND, R, Hd, 0, Math.PI, 0); c.stroke();
  c.fillStyle = '#e8edf2'; c.strokeStyle = INK; c.lineWidth = 1.4; c.beginPath(); c.ellipse(0, GROUND - Hd, 22, 5, 0, 0, TAU); c.fill(); c.stroke();
  for (const ax of [-110, 0, 110]) { c.fillStyle = '#3d4f66'; c.beginPath(); c.moveTo(ax - 22, GROUND); c.lineTo(ax - 22, GROUND - 26); c.quadraticCurveTo(ax, GROUND - 44, ax + 22, GROUND - 26); c.lineTo(ax + 22, GROUND); c.closePath(); c.fill(); }
  label(c, T('st_wasl'), 0, GROUND - 62, 13, n ? '#fffaf0' : '#2c3753');
}
function lmTerra(c) { // a giant solar canopy and its energy trees
  c.fillStyle = '#d9d4c8'; c.strokeStyle = SOFT; c.lineWidth = 1.4; c.fillRect(-110, GROUND - 60, 220, 60); c.strokeRect(-110, GROUND - 60, 220, 60);
  c.fillStyle = '#5a9a45'; c.fillRect(-114, GROUND - 64, 228, 6);
  c.fillStyle = night() ? '#ffe7a8' : '#3d5568'; c.fillRect(-90, GROUND - 44, 180, 30); if (night()) addLight(0, GROUND - 30, 90);
  c.strokeStyle = '#9aa0aa'; c.lineWidth = 6; c.beginPath(); c.moveTo(0, GROUND - 64); c.lineTo(0, GROUND - 130); c.stroke();
  const panel = (cx, cy, rx, ry) => { c.fillStyle = '#26355c'; c.strokeStyle = INK; c.lineWidth = 1.4; c.beginPath(); c.ellipse(cx, cy, rx, ry, 0, 0, TAU); c.fill(); c.stroke();
    c.save(); c.beginPath(); c.ellipse(cx, cy, rx, ry, 0, 0, TAU); c.clip(); c.strokeStyle = 'rgba(140,190,255,.5)'; c.lineWidth = 1; c.beginPath(); for (let k = -rx; k < rx; k += 10) { c.moveTo(cx + k, cy - ry); c.lineTo(cx + k + 4, cy + ry); } c.stroke(); c.restore(); };
  panel(0, GROUND - 136, 150, 12);
  for (const tx of [-140, 140]) { c.strokeStyle = '#9aa0aa'; c.lineWidth = 3; c.beginPath(); c.moveTo(tx, GROUND); c.lineTo(tx, GROUND - 70); c.stroke(); panel(tx, GROUND - 74, 22, 5); }
  lmSign(c, T('st_terra'), 0, GROUND - 74, 110, '#33b679');
}
function lmSkyGarden(c, x, s) { // tower whose ring-shaped garden rises and falls
  c.save(); c.translate(x, GROUND - 46); c.scale(s, s);
  c.fillStyle = glassG(c, -8, 8, '#c9ccd3', '#f4f6f8', '#9aa0aa'); c.fillRect(-7, -260, 14, 260); c.strokeStyle = 'rgba(60,70,90,.5)'; c.lineWidth = 1; c.strokeRect(-7, -260, 14, 260);
  const ry = -40 - (Math.sin(t * 0.25) * 0.5 + 0.5) * 190;
  c.fillStyle = '#e8edf2'; c.strokeStyle = INK; c.lineWidth = 1.4; c.beginPath(); c.ellipse(0, ry, 46, 9, 0, 0, TAU); c.fill(); c.stroke();
  c.fillStyle = '#5a9a45'; for (let k = -40; k <= 40; k += 10) { c.beginPath(); c.arc(k, ry - 6, 6, 0, TAU); c.fill(); }
  c.fillStyle = '#2c3753'; c.fillRect(-44, ry - 2, 88, 3);
  c.restore();
}
function surrealLive(c, x) { // a ring of walls with water pouring down every side
  c.fillStyle = '#c9ccd3'; c.strokeStyle = SOFT; c.lineWidth = 1.4; c.fillRect(x - 150, GROUND - 120, 300, 18); c.strokeRect(x - 150, GROUND - 120, 300, 18);
  c.fillStyle = 'rgba(70,140,190,.9)'; c.fillRect(x - 150, GROUND - 24, 300, 20);
  c.strokeStyle = 'rgba(225,245,255,.85)'; c.lineWidth = 2.4; c.beginPath();
  for (let k = 0; k < 26; k++) { const wx = x - 144 + k * 11.5, ph = (t * 3 + sr(k) * 4) % 1; c.moveTo(wx, GROUND - 102); c.lineTo(wx + Math.sin(k) * 2, GROUND - 26); c.moveTo(wx - 2, GROUND - 102 + ph * 70); c.lineTo(wx - 2, GROUND - 96 + ph * 70); } c.stroke();
  c.fillStyle = 'rgba(240,250,255,.6)'; c.beginPath(); c.ellipse(x, GROUND - 24, 150, 6, 0, 0, TAU); c.fill();
  for (const px of [-150, -50, 50, 150]) { c.fillStyle = '#9aa0aa'; c.fillRect(x + px - 5, GROUND - 120, 10, 116); }
  if (SK.n > 0.3) lights.push([x, GROUND - 60, 130]);
}
function lmClubhouse(c) { // clubhouse with white tent-shaped roofs
  c.fillStyle = '#f4f1ea'; c.strokeStyle = SOFT; c.lineWidth = 1.4; c.fillRect(-150, GROUND - 56, 300, 56); c.strokeRect(-150, GROUND - 56, 300, 56);
  for (let k = 0; k < 5; k++) { const tx = -120 + k * 60, th = 46 + (k === 2 ? 26 : (k % 2) * 10); c.fillStyle = '#fffaf0'; c.strokeStyle = INK; c.lineWidth = 1.4;
    c.beginPath(); c.moveTo(tx - 34, GROUND - 56); c.quadraticCurveTo(tx - 12, GROUND - 56 - th * 0.6, tx, GROUND - 56 - th); c.quadraticCurveTo(tx + 12, GROUND - 56 - th * 0.6, tx + 34, GROUND - 56); c.closePath(); c.fill(); c.stroke();
    c.strokeStyle = 'rgba(150,140,120,.45)'; c.lineWidth = 1; c.beginPath(); c.moveTo(tx, GROUND - 56 - th); c.lineTo(tx - 18, GROUND - 56); c.moveTo(tx, GROUND - 56 - th); c.lineTo(tx + 18, GROUND - 56); c.stroke(); }
  for (let k = 0; k < 6; k++) archWin(c, -134 + k * 46, GROUND - 46, 18, 34, night());
  lmSign(c, T('st_clubhouse'), 0, GROUND - 14, 110, '#1f7a74');
}
function islandLive(c, x) { // the island green in the lake, with a golfer
  c.fillStyle = rgb(mix([58, 143, 199], [24, 36, 84], SK.n)); c.fillRect(x - 180, GROUND - 26, 360, 22);
  c.fillStyle = '#82c062'; c.strokeStyle = INK; c.lineWidth = 1.4; c.beginPath(); c.ellipse(x + 40, GROUND - 24, 90, 12, 0, 0, TAU); c.fill(); c.stroke();
  c.fillStyle = '#ecd9a4'; c.beginPath(); c.ellipse(x - 10, GROUND - 26, 22, 4, 0, 0, TAU); c.fill();
  const fx = x + 60, fl = Math.sin(t * 6) * 3; c.strokeStyle = '#f4f4f2'; c.lineWidth = 2.4; c.beginPath(); c.moveTo(fx, GROUND - 26); c.lineTo(fx, GROUND - 92); c.stroke();
  c.fillStyle = '#e23b2a'; c.beginPath(); c.moveTo(fx, GROUND - 92); c.quadraticCurveTo(fx + 12, GROUND - 90 + fl, fx + 24, GROUND - 84 + fl); c.lineTo(fx, GROUND - 76); c.closePath(); c.fill();
  c.strokeStyle = '#fffaf0'; c.lineWidth = 1; c.beginPath(); c.arc(x - 130 + ((t * 120) % 200), GROUND - 60 - Math.sin(((t * 120) % 200) / 200 * Math.PI) * 50, 2, 0, TAU); c.stroke();
  c.fillStyle = '#8a5a35'; c.fillRect(x - 176, GROUND - 6, 352, 6);
}
function poloLive(c, x) { // polo players galloping across the field
  c.fillStyle = '#7fb85a'; c.fillRect(x - 260, GROUND - 76, 520, 70);
  c.strokeStyle = '#fffaf0'; c.lineWidth = 3; c.beginPath(); c.moveTo(x - 260, GROUND - 76); c.lineTo(x + 260, GROUND - 76); c.stroke();
  for (let k = 0; k < 4; k++) { const hx = x - 180 + k * 110 + Math.sin(t * 0.7 + k) * 30, hy = GROUND - 30 - (k % 2) * 12;
    horse(c, hx, hy, t * 14 + k, 0.8, ['#8a5a35', '#5a3a22', '#b07a43', '#3a2618'][k], k % 2 ? '#c8202b' : '#2b6cb0');
    c.strokeStyle = '#6b4a2c'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(hx + 6, hy - 38); c.lineTo(hx + 22, hy - 4); c.stroke(); }
  c.fillStyle = '#fffaf0'; c.beginPath(); c.arc(x + Math.sin(t * 1.3) * 120, GROUND - 22, 3, 0, TAU); c.fill();
}
function lmNadPark(c) { // park gate, running track and shade trees
  c.fillStyle = '#c2553f'; c.fillRect(-150, GROUND - 10, 300, 10); c.fillStyle = '#f4f4f2'; c.fillRect(-150, GROUND - 6, 300, 1.5);
  for (const px of [-118, 92]) { c.fillStyle = '#d9cbb0'; c.strokeStyle = SOFT; c.lineWidth = 1.4; c.fillRect(px, GROUND - 110, 26, 100); c.strokeRect(px, GROUND - 110, 26, 100);
    c.fillStyle = '#1f7a74'; for (let k = 0; k < 4; k++) c.fillRect(px + 5, GROUND - 100 + k * 22, 16, 12); }
  c.fillStyle = '#1f7a74'; c.strokeStyle = INK; c.lineWidth = 1.6; c.fillRect(-122, GROUND - 132, 244, 24); c.strokeRect(-122, GROUND - 132, 244, 24);
  label(c, T('st_nadpark'), 0, GROUND - 119, 13, '#fffaf0');
  tree(c, -40, 0.7); tree(c, 40, 0.8);
}
function lmMeydan(c, x, s) { // grandstand under a long crescent roof
  c.save(); c.translate(x, GROUND - 40); c.scale(s, s);
  c.fillStyle = '#c9ccd3'; c.strokeStyle = 'rgba(60,70,90,.5)'; c.lineWidth = 1;
  c.beginPath(); c.moveTo(-230, 0); c.lineTo(-220, -60); c.lineTo(220, -60); c.lineTo(230, 0); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = SK.n > 0.3 ? 'rgba(255,220,150,.7)' : '#7f93a8'; for (let r = 0; r < 4; r++) c.fillRect(-214 + r * 4, -54 + r * 13, 428 - r * 8, 6);
  c.fillStyle = glassG(c, -240, 240, '#e9edf2', '#ffffff', '#b8c2d0'); c.beginPath(); c.moveTo(-250, -60); c.quadraticCurveTo(0, -150, 250, -60); c.quadraticCurveTo(0, -118, -250, -60); c.fill(); c.stroke();
  c.strokeStyle = 'rgba(120,130,150,.5)'; c.beginPath(); for (let k = -220; k <= 220; k += 30) { c.moveTo(k, -60); c.lineTo(k * 0.98, -60 - (1 - (k / 250) * (k / 250)) * 70); } c.stroke();
  c.restore(); if (SK.n > 0.3) lights.push([x, GROUND - 80, 180]);
}
function raceLive(c, x) { // racehorses and jockeys along the rails
  for (let k = 0; k < 5; k++) { const hx = x - 220 + k * 95 + ((t * 40 + k * 30) % 60), hy = GROUND - 18 - (k % 2) * 8;
    horse(c, hx, hy, t * 16 + k * 1.3, 0.75, ['#5a3a22', '#8a5a35', '#3a2618', '#b07a43', '#6b4a2c'][k], ['#c8202b', '#f2c230', '#2b6cb0', '#33b679', '#e0479e'][k]); }
}
function geoBand(c, x, y, w, h, col) { // Islamic star pattern band
  c.fillStyle = col; c.fillRect(x, y, w, h); c.strokeStyle = 'rgba(255,240,200,.75)'; c.lineWidth = 1.2; c.beginPath();
  for (let k = x + h / 2; k < x + w; k += h) { const cy = y + h / 2, r = h * 0.38; for (let j = 0; j < 8; j++) { const a = j * Math.PI / 4; c.moveTo(k + Math.cos(a) * r, cy + Math.sin(a) * r); c.lineTo(k + Math.cos(a + Math.PI * 0.75) * r, cy + Math.sin(a + Math.PI * 0.75) * r); } } c.stroke();
}
function lmQuranic(c) { // the park's great arched gate
  c.fillStyle = '#efe0c2'; c.strokeStyle = SOFT; c.lineWidth = 1.4; c.fillRect(-140, GROUND - 150, 280, 150); c.strokeRect(-140, GROUND - 150, 280, 150);
  geoBand(c, -140, GROUND - 150, 280, 22, '#1f7a74');
  c.fillStyle = '#3d2417'; c.beginPath(); c.moveTo(-56, GROUND); c.lineTo(-56, GROUND - 70); c.quadraticCurveTo(-56, GROUND - 118, 0, GROUND - 124); c.quadraticCurveTo(56, GROUND - 118, 56, GROUND - 70); c.lineTo(56, GROUND); c.closePath(); c.fill();
  c.strokeStyle = '#d9a640'; c.lineWidth = 4; c.stroke();
  c.fillStyle = '#5a9a45'; c.beginPath(); c.arc(0, GROUND - 30, 30, Math.PI, 0); c.fill();
  for (const ax of [-104, 104]) archWin(c, ax - 12, GROUND - 100, 24, 50, night());
  label(c, T('st_quranic'), 0, GROUND - 139, 12, '#fffaf0');
}
function lmGlass(c) { // greenhouse with a vaulted glass roof and a dome
  c.fillStyle = '#d9d4c8'; c.fillRect(-150, GROUND - 12, 300, 12);
  const g = c.createLinearGradient(0, GROUND - 150, 0, GROUND); g.addColorStop(0, 'rgba(210,240,250,.75)'); g.addColorStop(1, 'rgba(150,200,210,.75)');
  c.fillStyle = g; c.strokeStyle = INK; c.lineWidth = 1.4; c.beginPath(); c.moveTo(-140, GROUND - 12); c.lineTo(-140, GROUND - 70); c.quadraticCurveTo(-140, GROUND - 110, -60, GROUND - 110); c.lineTo(60, GROUND - 110); c.quadraticCurveTo(140, GROUND - 110, 140, GROUND - 70); c.lineTo(140, GROUND - 12); c.closePath(); c.fill(); c.stroke();
  c.beginPath(); c.moveTo(-44, GROUND - 110); c.quadraticCurveTo(-44, GROUND - 160, 0, GROUND - 162); c.quadraticCurveTo(44, GROUND - 160, 44, GROUND - 110); c.closePath(); c.fill(); c.stroke();
  c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 1.2; c.beginPath(); for (let k = -130; k <= 130; k += 20) { c.moveTo(k, GROUND - 12); c.lineTo(k, GROUND - 100 - (Math.abs(k) < 60 ? 8 : 0)); } c.moveTo(-140, GROUND - 60); c.lineTo(140, GROUND - 60); c.stroke();
  c.fillStyle = '#3f7d3a'; for (let k = -120; k < 130; k += 26) { c.beginPath(); c.arc(k, GROUND - 26, 14, 0, TAU); c.fill(); } c.fillStyle = '#e0479e'; for (let k = -110; k < 130; k += 40) { c.beginPath(); c.arc(k, GROUND - 34, 3, 0, TAU); c.fill(); }
  c.strokeStyle = '#7a5434'; c.lineWidth = 5; c.beginPath(); c.moveTo(0, GROUND - 14); c.lineTo(0, GROUND - 90); c.stroke(); c.fillStyle = '#3f7d3a'; c.beginPath(); c.arc(-10, GROUND - 100, 18, 0, TAU); c.arc(12, GROUND - 104, 18, 0, TAU); c.fill();
  lmSign(c, T('st_glasshouse'), 0, GROUND - 74, 112, '#1f7a74');
}
function lmCave(c) { // a rocky hill with a glowing cave mouth
  c.fillStyle = '#b98a5c'; c.strokeStyle = INK; c.lineWidth = 1.6; c.beginPath(); c.moveTo(-150, GROUND); c.quadraticCurveTo(-120, GROUND - 120, -30, GROUND - 140); c.quadraticCurveTo(60, GROUND - 160, 110, GROUND - 90); c.quadraticCurveTo(140, GROUND - 50, 150, GROUND); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = '#9c6f45'; c.beginPath(); c.moveTo(-100, GROUND - 60); c.lineTo(-60, GROUND - 90); c.lineTo(-40, GROUND - 70); c.closePath(); c.moveTo(40, GROUND - 110); c.lineTo(80, GROUND - 100); c.lineTo(60, GROUND - 80); c.closePath(); c.fill();
  c.fillStyle = '#2a1a14'; c.beginPath(); c.moveTo(-40, GROUND); c.lineTo(-40, GROUND - 46); c.quadraticCurveTo(0, GROUND - 92, 40, GROUND - 46); c.lineTo(40, GROUND); c.closePath(); c.fill();
  c.fillStyle = '#ffcf6b'; c.globalAlpha = 0.5; c.beginPath(); c.ellipse(0, GROUND - 24, 26, 22, 0, 0, TAU); c.fill(); c.globalAlpha = 1; addLight(0, GROUND - 30, 70);
  lmSign(c, T('st_cave'), 0, GROUND - 112, 120, '#6b4a2c', '#f2c230');
}
function lmFarms(c) { for (let k = 0; k < 6; k++) datePalm(c, -150 + k * 60, 80 + sr(k) * 30, k); c.fillStyle = '#d8b788'; c.fillRect(-170, GROUND - 22, 340, 22); c.fillStyle = '#c9a674'; c.fillRect(-170, GROUND - 26, 340, 5); }
function farmsLive(c, x) { for (let k = 0; k < 2; k++) camel(c, x - 80 + k * 120 + Math.sin(t * 0.3 + k) * 20, GROUND - 2, t * 3 + k * 2, 0.75); lmSign(c, T('st_farms'), x, GROUND - 120, 130, '#8a5a35', '#fffaf0'); }
function flamingoLive(c, x) { // flamingos in the shallow lagoon, with mangroves
  c.fillStyle = 'rgba(90,160,170,.85)'; c.fillRect(x - 260, GROUND - 60, 520, 40);
  c.fillStyle = '#3f6d3a'; for (let k = 0; k < 6; k++) { c.beginPath(); c.arc(x - 240 + k * 90, GROUND - 64, 16 + sr(k) * 8, 0, TAU); c.fill(); }
  for (let k = 0; k < 9; k++) { const fx = x - 220 + k * 52 + Math.sin(t * 0.4 + k) * 6, fy = GROUND - 30 - (k % 3) * 6, bob = Math.sin(t * 1.5 + k) * 1.5;
    c.strokeStyle = '#d65a80'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(fx, fy); c.lineTo(fx, fy - 16); if (k % 2) { c.moveTo(fx, fy - 10); c.lineTo(fx + 5, fy - 14); } c.stroke();
    c.fillStyle = '#f48fb1'; c.strokeStyle = 'rgba(60,20,30,.5)'; c.lineWidth = 1; c.beginPath(); c.ellipse(fx, fy - 20 + bob, 8, 5, -0.2, 0, TAU); c.fill(); c.stroke();
    c.strokeStyle = '#f48fb1'; c.lineWidth = 2; c.beginPath(); c.moveTo(fx + 5, fy - 22 + bob); c.quadraticCurveTo(fx + 12, fy - 30, fx + 6, fy - 36 + bob); c.stroke();
    c.fillStyle = '#2a1a14'; c.beginPath(); c.moveTo(fx + 6, fy - 37 + bob); c.lineTo(fx + 11, fy - 34 + bob); c.lineTo(fx + 6, fy - 34 + bob); c.fill(); }
  c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 1.2; c.beginPath(); for (let k = 0; k < 12; k++) { const wx = x - 250 + k * 44; c.moveTo(wx, GROUND - 26); c.quadraticCurveTo(wx + 6, GROUND - 28, wx + 12, GROUND - 26); } c.stroke();
}
function lmHarbour(c, x, s) { // the new towers of Dubai Creek Harbour
  c.save(); c.translate(x, GROUND - 46); c.scale(s, s);
  for (const [dx, h, w] of [[-120, 190, 34], [-70, 240, 38], [-20, 210, 32], [40, 260, 40], [100, 200, 34]]) {
    c.fillStyle = glassG(c, dx - w / 2, dx + w / 2, '#9fb3cc', '#e6edf5', '#6b7f9e'); c.beginPath(); c.moveTo(dx - w / 2, 0); c.lineTo(dx - w / 2, -h + 10); c.quadraticCurveTo(dx, -h - 14, dx + w / 2, -h); c.lineTo(dx + w / 2, 0); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(255,255,255,.4)'; c.lineWidth = 1; c.beginPath(); for (let y = -12; y > -h + 10; y -= 12) { c.moveTo(dx - w / 2, y); c.lineTo(dx + w / 2, y); } c.stroke();
    if (SK.n > 0.3) { c.fillStyle = `rgba(255,220,150,${SK.n})`; for (let y = -10; y > -h + 10; y -= 12) if (sr(dx + y) > 0.45) c.fillRect(dx - w / 2 + 4, y - 6, w - 8, 4); } }
  c.restore();
}
function lmCreekBeach(c) { // a lagoon beach with loungers and a pier
  c.fillStyle = '#4fd1e0'; c.fillRect(-170, GROUND - 30, 340, 22); c.fillStyle = '#ecd9a4'; c.fillRect(-170, GROUND - 10, 340, 10);
  for (const px of [-120, -40, 40, 120]) { c.strokeStyle = '#9aa0aa'; c.lineWidth = 2.4; c.beginPath(); c.moveTo(px, GROUND); c.lineTo(px, GROUND - 60); c.stroke();
    c.fillStyle = px % 80 ? '#f28c28' : '#fffaf0'; c.strokeStyle = INK; c.lineWidth = 1.3; c.beginPath(); c.moveTo(px - 30, GROUND - 52); c.quadraticCurveTo(px, GROUND - 76, px + 30, GROUND - 52); c.closePath(); c.fill(); c.stroke(); }
  c.fillStyle = '#8a5a35'; c.fillRect(60, GROUND - 32, 110, 6);
  lmSign(c, T('st_creekbeach'), -80, GROUND - 92, 100, '#2b9bd6');
}
function lmAtlantis(c, x, s) { // pink twin towers joined by the great arch, the crown and the bridge suite on top
  c.save(); c.translate(x, GROUND - 74); c.scale(s, s);
  const lit = SK.n > 0.3, pinkG = (x0, x1) => { const g = c.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, '#d98f7a'); g.addColorStop(0.45, '#f6cdbd'); g.addColorStop(1, '#c97c68'); return g; };
  // the island, its beach and palms
  c.fillStyle = '#e3cd9c'; c.beginPath(); c.ellipse(0, 2, 230, 10, 0, 0, TAU); c.fill(); c.fillStyle = '#d8c39a'; c.fillRect(-226, -6, 452, 8);
  const block = (x0, w, h, top) => { // a wing with window rows, balcony bands and pilasters
    c.fillStyle = pinkG(x0, x0 + w); c.strokeStyle = 'rgba(110,50,40,.55)'; c.lineWidth = 1; c.fillRect(x0, -h, w, h); c.strokeRect(x0, -h, w, h);
    for (let y = -10; y > -h + 8; y -= 8) for (let k = x0 + 4; k < x0 + w - 3; k += 6) { c.fillStyle = lit && sr(k * 3 + y) > 0.45 ? '#ffe2a0' : 'rgba(80,60,90,.55)'; c.fillRect(k, y - 4, 3, 4); }
    c.fillStyle = 'rgba(255,245,235,.55)'; for (let y = -18; y > -h + 8; y -= 24) c.fillRect(x0, y, w, 2);
    c.fillStyle = 'rgba(255,240,230,.5)'; c.fillRect(x0 + 2, -h, 3, h); c.fillRect(x0 + w - 5, -h, 3, h);
    c.fillStyle = '#f7d9cc'; c.strokeStyle = 'rgba(110,50,40,.6)'; c.fillRect(x0 - 2, -h - 4, w + 4, 5); c.strokeRect(x0 - 2, -h - 4, w + 4, 5);
    if (top) for (let k = 0; k < Math.floor(w / 14); k++) { const px = x0 + 7 + k * 14; c.fillStyle = '#e8b04a'; c.beginPath(); c.moveTo(px - 4, -h - 4); c.quadraticCurveTo(px, -h - 16, px + 4, -h - 4); c.fill(); }
  };
  block(-224, 40, 60, 1); block(184, 40, 60, 1); block(-188, 44, 92, 1); block(144, 44, 92, 1); block(-148, 48, 128, 1); block(100, 48, 128, 1);
  block(-104, 54, 172, 0); block(50, 54, 172, 0);
  for (const tx of [-77, 77]) { c.fillStyle = '#f7d9cc'; c.strokeStyle = 'rgba(110,50,40,.6)'; c.beginPath(); c.moveTo(tx - 22, -176); c.lineTo(tx - 16, -196); c.lineTo(tx + 16, -196); c.lineTo(tx + 22, -176); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#e8b04a'; c.beginPath(); c.arc(tx, -198, 9, Math.PI, 0); c.fill(); c.stroke(); c.strokeStyle = '#c98a1f'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(tx, -207); c.lineTo(tx, -220); c.stroke(); }
  // the great arch between the towers and the bridge suite above it
  c.fillStyle = pinkG(-50, 50); c.strokeStyle = 'rgba(110,50,40,.6)'; c.lineWidth = 1.2;
  c.beginPath(); c.moveTo(-50, -120); c.lineTo(-50, -200); c.lineTo(50, -200); c.lineTo(50, -120); c.quadraticCurveTo(50, -170, 0, -172); c.quadraticCurveTo(-50, -170, -50, -120); c.closePath(); c.fill(); c.stroke();
  c.strokeStyle = '#f7e3d6'; c.lineWidth = 3; c.beginPath(); c.moveTo(-46, -122); c.quadraticCurveTo(-46, -166, 0, -168); c.quadraticCurveTo(46, -166, 46, -122); c.stroke();
  for (let k = -40; k <= 32; k += 9) { c.fillStyle = lit ? '#ffe2a0' : 'rgba(80,60,90,.6)'; c.fillRect(k, -194, 5, 7); c.fillRect(k, -182, 5, 6); }
  c.fillStyle = '#f7d9cc'; c.strokeStyle = 'rgba(110,50,40,.6)'; c.lineWidth = 1; c.fillRect(-56, -206, 112, 7); c.strokeRect(-56, -206, 112, 7);
  // the crown: tiers of gold-tipped spires
  for (let k = 0; k < 7; k++) { const px = -42 + k * 14, ht = k === 3 ? 30 : k % 2 ? 18 : 22; c.fillStyle = '#f2c7b5'; c.beginPath(); c.moveTo(px - 6, -206); c.lineTo(px, -206 - ht); c.lineTo(px + 6, -206); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#e8b04a'; c.beginPath(); c.arc(px, -206 - ht, 2.4, 0, TAU); c.fill(); }
  c.fillStyle = '#e8b04a'; c.strokeStyle = '#a8741c'; c.beginPath(); c.arc(0, -238, 6, 0, TAU); c.fill(); c.stroke();
  // the lobby under the arch, with turquoise glass, and palms on the beach
  c.fillStyle = lit ? '#ffe7a8' : '#5fb7c8'; c.beginPath(); c.moveTo(-40, -6); c.lineTo(-40, -40); c.quadraticCurveTo(0, -62, 40, -40); c.lineTo(40, -6); c.closePath(); c.fill(); c.strokeStyle = 'rgba(110,50,40,.6)'; c.stroke();
  c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 1; c.beginPath(); for (let k = -30; k <= 30; k += 12) { c.moveTo(k, -6); c.lineTo(k, -48 + Math.abs(k) * 0.3); } c.stroke();
  for (const px of [-200, -150, 150, 200, -30, 30]) { c.strokeStyle = '#7a5434'; c.lineWidth = 2.4; c.beginPath(); c.moveTo(px, -4); c.quadraticCurveTo(px - 2, -16, px + 2, -28); c.stroke();
    c.strokeStyle = '#3f7d3a'; c.lineWidth = 2.4; c.beginPath(); for (let k = 0; k < 5; k++) { const a = -Math.PI + k * Math.PI / 4; c.moveTo(px + 2, -28); c.quadraticCurveTo(px + 2 + Math.cos(a) * 8, -32 + Math.sin(a) * 6, px + 2 + Math.cos(a) * 13, -26 + Math.sin(a) * 4); } c.stroke(); }
  c.restore(); if (lit) { lights.push([x, GROUND - 74 - 190 * s, 120]); lights.push([x, GROUND - 74 - 20 * s, 90]); }
}

const LMK = {
  mamzarpark: { lay: 'near', w: 300, h: 172, draw: lmMamzar, live: palmsAround(160, 92) },
  etisalat: { lay: 'far', r: 450, s: 0.72, draw: lmEtisalat },
  clocktower: { lay: 'near', w: 240, h: 192, draw: lmClock, live: clockLive },
  spice: { lay: 'near', w: 300, h: 162, draw: lmSpice },
  gold: { lay: 'near', w: 300, h: 200, draw: lmGold, live: goldLive },
  abra: { lay: 'near', w: 330, h: 178, draw: lmAbra, live: abraLive },
  antique: { lay: 'near', w: 340, h: 172, draw: lmAntique, live: antiqueLive },
  library: { lay: 'near', w: 330, h: 176, draw: lmLibrary },
  frame: { lay: 'far', r: 500, s: 0.8, draw: lmFrame },
  museum: { lay: 'near', w: 300, h: 210, draw: lmMuseum },
  towers: { lay: 'far', r: 500, s: 0.8, draw: lmTowers },
  mall: { lay: 'near', w: 364, h: 132, draw: lmMall, live: palmsAround(196, 90) },
  fountain: { lay: 'near', w: 440, live: fountainLive },
  burj: { lay: 'far', r: 2600, s: 0.78, draw: lmBurj },
  opera: { lay: 'near', w: 344, h: 132, draw: lmOpera },
  mosque: { lay: 'near', w: 320, h: 222, draw: lmMosque, live: palmsAround(178, 84) },
  lamer: { lay: 'near', w: 344, h: 110, draw: lmLaMer },
  kite: { lay: 'midfar', par: 0.3, w: 500, live: kiteLive },
  arab: { lay: 'midfar', r: 1100, s: 1, draw: sailHotel },
  madinat: { lay: 'near', w: 344, h: 230, draw: lmMadinat, live: madinatLive },
  monorail: { lay: 'near', w: 424, h: 140, draw: lmMonorail, live: monoLive },
  atlantis: { lay: 'midfar', r: 900, s: 0.95, draw: lmAtlantis },
  royal: { lay: 'midfar', r: 700, s: 0.85, draw: lmRoyal },
  slides: { lay: 'near', w: 304, h: 212, draw: lmSlides },
  walk: { lay: 'near', w: 344, h: 302, draw: lmWalk },
  eye: { lay: 'midfar', r: 1500, s: 0.8, draw: lmEye },
  marina: { lay: 'far', r: 700, s: 0.8, draw: lmMarina },
  wasl: { lay: 'near', w: 344, h: 222, draw: lmWasl },
  terra: { lay: 'near', w: 330, h: 156, draw: lmTerra },
  skygarden: { lay: 'far', r: 500, s: 0.85, draw: lmSkyGarden },
  surreal: { lay: 'near', w: 320, live: surrealLive },
  clubhouse: { lay: 'near', w: 310, h: 140, draw: lmClubhouse, live: palmsAround(170, 86) },
  island: { lay: 'near', w: 380, live: islandLive },
  polo: { lay: 'midfar', par: 0.3, w: 540, live: poloLive },
  nadpark: { lay: 'near', w: 310, h: 140, draw: lmNadPark },
  meydan: { lay: 'far', r: 700, s: 0.85, draw: lmMeydan },
  race: { lay: 'midfar', par: 0.3, w: 500, live: raceLive },
  quranic: { lay: 'near', w: 290, h: 160, draw: lmQuranic, live: palmsAround(160, 92) },
  glasshouse: { lay: 'near', w: 310, h: 172, draw: lmGlass },
  cave: { lay: 'near', w: 310, h: 172, draw: lmCave },
  farms: { lay: 'near', w: 360, h: 150, draw: lmFarms, live: farmsLive },
  flamingos: { lay: 'midfar', par: 0.3, w: 540, live: flamingoLive },
  harbourtowers: { lay: 'far', r: 600, s: 0.8, draw: lmHarbour },
  creekbeach: { lay: 'near', w: 344, h: 110, draw: lmCreekBeach },
  skyview: { lay: 'far', r: 2000, s: 0.7, draw: lmBurj },
};
const LMT = {};
function landmarks(c, lay) {
  for (const s of M.STOPS) {
    const L = LMK[s.id]; if (!L || L.lay !== lay) continue;
    if (L.r) { // far: drifts slowly across the sky
      const m = stopAbs(s); if (Math.abs(m - routeM) > L.r * 2.4) continue;
      const a = driftA(m, L.r), x = driftX(m, L.r), q = (m - routeM) / L.r, sc = L.s * (0.82 + 0.25 * Math.exp(-q * q));
      const A0 = c.globalAlpha; c.globalAlpha = A0 * a; L.draw(c, x, sc); c.globalAlpha = A0; continue;
    }
    const x = ABX + (stopAbs(s) - routeM) * 40 * (L.par || PAR_NEAR), half = (L.w || 400) / 2 + 60;
    if (x < -half || x > W + half) continue;
    if (L.draw) {
      const d = LMT[s.id] || (LMT[s.id] = { id: 'K' + s.id, box: [-L.w / 2, GROUND - L.h, L.w, L.h + 2], v: () => (night() ? 1 : 0) + getLang(), draw: g => L.draw(g) });
      const e = getTile(d, 0);
      if (e) { c.drawImage(e.c, x + e.bx, e.by, e.bw, e.bh); for (const l of e.L) lights.push([l[0] + x, l[1], l[2]]); }
      else { c.save(); c.translate(x, 0); LOX = x; L.draw(c); LOX = 0; c.restore(); }
    }
    if (L.live) L.live(c, x);
  }
}

// ---- the glass aquarium tunnel on the Palm ----
function drawFish(c, f) {
  c.save(); c.translate(f.x, f.y); const dir = f.vx < 0 ? -1 : 1; c.scale(dir * f.s, f.s); c.strokeStyle = 'rgba(10,30,50,.6)'; c.lineWidth = 1;
  const wag = Math.sin(f.ph) * 0.3;
  if (f.kind === 'shark') { c.fillStyle = '#6f8597'; c.beginPath(); c.moveTo(34, 0); c.quadraticCurveTo(10, -12, -24, -3); c.lineTo(-38, -12 + wag * 8); c.lineTo(-33, 0); c.lineTo(-38, 10 + wag * 8); c.lineTo(-24, 3); c.quadraticCurveTo(10, 10, 34, 0); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(4, -8); c.lineTo(-6, -22); c.lineTo(-10, -6); c.fill(); c.stroke(); c.fillStyle = '#dbe5ec'; c.beginPath(); c.moveTo(30, 2); c.quadraticCurveTo(8, 8, -18, 3); c.quadraticCurveTo(8, 4, 30, 2); c.fill();
    c.fillStyle = '#0d1b26'; c.beginPath(); c.arc(24, -2, 1.4, 0, TAU); c.fill(); }
  else if (f.kind === 'ray') { const fl = Math.sin(f.ph) * 6; c.fillStyle = '#5d7486'; c.beginPath(); c.moveTo(20, 0); c.quadraticCurveTo(0, -24 - fl, -14, -2); c.lineTo(-14, 2); c.quadraticCurveTo(0, 24 + fl, 20, 0); c.fill(); c.stroke();
    c.strokeStyle = '#5d7486'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(-14, 0); c.quadraticCurveTo(-30, wag * 10, -44, 2); c.stroke(); }
  else if (f.kind === 'turtle') { c.fillStyle = '#7fa35a'; for (const [fx, fy, a] of [[8, -8, -0.6], [8, 8, 0.6], [-10, -7, -2.4], [-10, 7, 2.4]]) { c.save(); c.translate(fx, fy); c.rotate(a + Math.sin(f.ph * 0.5) * 0.4); c.beginPath(); c.ellipse(4, 0, 7, 2.6, 0, 0, TAU); c.fill(); c.restore(); }
    c.beginPath(); c.arc(17, 0, 4.5, 0, TAU); c.fill(); c.fillStyle = '#5a7a3a'; c.beginPath(); c.ellipse(0, 0, 14, 10, 0, 0, TAU); c.fill(); c.stroke();
    c.strokeStyle = 'rgba(220,240,180,.45)'; c.beginPath(); c.moveTo(-8, 0); c.lineTo(8, 0); c.moveTo(0, -8); c.lineTo(0, 8); c.stroke(); }
  else { const n = f.kind === 'school' ? 6 : 1;
    for (let k = 0; k < n; k++) { const ox = n > 1 ? (k % 3) * 14 - 14 : 0, oy = n > 1 ? Math.floor(k / 3) * 10 - 5 + Math.sin(f.ph * 0.4 + k) * 2 : 0, sc = n > 1 ? 0.55 : 1;
      c.save(); c.translate(ox, oy); c.scale(sc, sc); c.fillStyle = f.col; c.beginPath(); c.ellipse(0, 0, 11, 6.5, 0, 0, TAU); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(-9, 0); c.lineTo(-17, -6 + wag * 6); c.lineTo(-17, 6 + wag * 6); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = 'rgba(255,255,255,.55)'; c.fillRect(-2, -6, 2.4, 12); c.fillStyle = '#0d1b26'; c.beginPath(); c.arc(6, -1.5, 1.3, 0, TAU); c.fill(); c.restore(); } }
  c.restore();
}
function aquarium(c, a) {
  c.save(); c.globalAlpha = a;
  const g = c.createLinearGradient(0, -offY, 0, GROUND); g.addColorStop(0, '#062a4f'); g.addColorStop(0.55, '#0b5f8a'); g.addColorStop(1, '#1689a8');
  c.fillStyle = g; c.fillRect(-20, -offY - 20, W + 40, GROUND + offY + 22);
  c.globalCompositeOperation = 'lighter'; c.fillStyle = 'rgba(140,220,255,.07)';
  for (let k = 0; k < 5; k++) { const x0 = ((k * 260 - worldX * 0.05 + Math.sin(t * 0.4 + k) * 30) % (W + 300) + W + 300) % (W + 300) - 150;
    c.beginPath(); c.moveTo(x0, -offY); c.lineTo(x0 + 60, -offY); c.lineTo(x0 + 150, GROUND); c.lineTo(x0 + 40, GROUND); c.closePath(); c.fill(); }
  c.globalCompositeOperation = 'source-over';
  const off = worldX * 0.3;
  for (let i = Math.floor(off / 180) - 1; i <= Math.floor((off + W) / 180) + 1; i++) { const x = i * 180 - off, r = sr(i * 3.3 + 1);
    c.fillStyle = '#0a4a66'; c.beginPath(); c.ellipse(x + 90, GROUND - 4, 110, 30 + r * 34, 0, Math.PI, 0); c.fill();
    c.strokeStyle = '#2f8f6b'; c.lineWidth = 4; c.lineCap = 'round'; c.beginPath(); for (let k = 0; k < 3; k++) { const sx = x + 30 + k * 50 + r * 20; c.moveTo(sx, GROUND - 10); c.quadraticCurveTo(sx + Math.sin(t * 1.5 + k + i) * 10, GROUND - 50, sx + Math.sin(t * 1.2 + k + i) * 6, GROUND - 84 - r * 30); } c.stroke();
    if (r > 0.4) { c.fillStyle = r > 0.7 ? '#ff7a8a' : '#ffb35a'; for (let k = 0; k < 5; k++) { c.beginPath(); c.arc(x + 96 + k * 8, GROUND - 34 - (k % 2) * 10, 6.5, 0, TAU); c.fill(); } } }
  for (const f of fish) drawFish(c, f);
  c.fillStyle = 'rgba(220,245,255,.5)'; for (let k = 0; k < 16; k++) { const bx = sr(k) * W + Math.sin(t + k) * 10, by = GROUND - ((t * 40 + sr(k + 5) * 400) % (GROUND + offY)); c.beginPath(); c.arc(bx, by, 1.5 + sr(k + 2) * 2.5, 0, TAU); c.fill(); }
  // the curved glass and its ribs
  const ro = ((worldX * 0.9) % 260 + 260) % 260;
  c.strokeStyle = 'rgba(200,240,255,.28)'; c.lineWidth = 8; c.beginPath(); for (let x = -ro - 260; x < W + 260; x += 260) { c.moveTo(x, GROUND); c.lineTo(x, 60 - offY * 0.3); c.quadraticCurveTo(x, 10 - offY * 0.6, x + 50, -offY); } c.stroke();
  c.fillStyle = 'rgba(255,255,255,.06)'; for (let x = -ro - 260; x < W + 260; x += 260) { c.beginPath(); c.moveTo(x + 60, GROUND); c.lineTo(x + 100, GROUND); c.lineTo(x + 180, -offY); c.lineTo(x + 140, -offY); c.closePath(); c.fill(); }
  const vg = c.createLinearGradient(0, -offY, 0, 70); vg.addColorStop(0, 'rgba(2,14,30,.75)'); vg.addColorStop(1, 'rgba(2,14,30,0)'); c.fillStyle = vg; c.fillRect(-20, -offY - 20, W + 40, 90 + offY);
  c.restore();
}
// ---- Downtown: elevated metro line with a passing train ----
function metro(c) {
  const y = GROUND - 120, off = worldX * 0.3;
  c.fillStyle = '#c9ccd3'; c.strokeStyle = SOFT; c.lineWidth = 1.2;
  for (let i = Math.floor(off / 180) - 1; i <= Math.floor((off + W) / 180) + 1; i++) { const x = i * 180 - off; c.beginPath(); c.moveTo(x - 7, GROUND); c.lineTo(x - 5, y + 10); c.lineTo(x + 5, y + 10); c.lineTo(x + 7, GROUND); c.closePath(); c.fill(); c.stroke(); }
  c.fillStyle = '#d9dce2'; c.fillRect(-20, y, W + 40, 10); c.strokeRect(-20, y, W + 40, 10); c.fillStyle = 'rgba(0,0,0,.12)'; c.fillRect(-20, y + 10, W + 40, 3);
  const span = W + 600, tx = ((t * 160) % span) - 300;
  for (let k = 0; k < 3; k++) { const x = tx - k * 78;
    c.fillStyle = '#f4f6f8'; c.strokeStyle = INK; c.lineWidth = 1.3; c.beginPath(); if (k === 0) { c.moveTo(x, y); c.lineTo(x + 70, y); c.quadraticCurveTo(x + 84, y - 2, x + 78, y - 20); c.lineTo(x, y - 22); } else c.rect(x, y - 22, 74, 22); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#2b4c7e'; c.fillRect(x + 2, y - 6, 70, 3); c.fillStyle = SK.n > 0.3 ? '#ffe7a8' : '#3b5568'; for (let w = 0; w < 5; w++) c.fillRect(x + 6 + w * 13, y - 18, 9, 8);
  }
}
const GLASS = ['#6f8fb3', '#7fa3a8', '#8a96b8', '#6d8a99'];
function downtownTile(c, i) {
  const r = sr(i * 2.1 + 9), h = 84 + r * 26, col = GLASS[Math.floor(sr(i + 4) * 4)], lit = night();
  const g = c.createLinearGradient(0, GROUND - h, 0, GROUND); g.addColorStop(0, col); g.addColorStop(1, '#3d4f66');
  c.fillStyle = g; c.strokeStyle = SOFT; c.lineWidth = 1.4; c.fillRect(4, GROUND - h, 200, h); c.strokeRect(4, GROUND - h, 200, h);
  c.fillStyle = '#e6e8ec'; c.fillRect(0, GROUND - h - 6, 208, 7);
  c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 1; c.beginPath(); for (let x = 4; x <= 204; x += 20) { c.moveTo(x, GROUND - h); c.lineTo(x, GROUND - 40); } for (let y = GROUND - h + 16; y < GROUND - 40; y += 16) { c.moveTo(4, y); c.lineTo(204, y); } c.stroke();
  for (let k = 0; k < 10; k++) for (let m = 0; m < 3; m++) if (lit && sr(i * 9 + k + m * 11) > 0.4) { c.fillStyle = '#ffe7a8'; c.fillRect(6 + k * 20, GROUND - h + 2 + m * 16, 16, 12); }
  c.fillStyle = lit ? '#ffe7a8' : '#26384a'; c.fillRect(12, GROUND - 38, 184, 38); if (lit) addLight(104, GROUND - 20, 80);
  c.fillStyle = 'rgba(255,255,255,.2)'; c.beginPath(); c.moveTo(40, GROUND - 38); c.lineTo(62, GROUND - 38); c.lineTo(36, GROUND); c.lineTo(14, GROUND); c.fill();
  c.fillStyle = '#e6e8ec'; c.fillRect(8, GROUND - 42, 192, 5);
  for (const px of [30, 170]) { c.fillStyle = '#8c8f96'; c.fillRect(px - 12, GROUND - 14, 24, 14); c.strokeStyle = SOFT; c.strokeRect(px - 12, GROUND - 14, 24, 14); }
}
function downtownLive(c, i, x) { if (sr(i * 2.1 + 9) > 0.15) { palm(c, x + 30, GROUND - 14, 70, i); if (sr(i + 3) > 0.5) palm(c, x + 170, GROUND - 14, 64, i + 1); } }
// ---- Al Mamzar: boats on the water ----
function dhow(c, x, y, s) {
  c.save(); c.translate(x, y); c.rotate(Math.sin(t * 1.6 + x) * 0.03); c.scale(s, s); c.fillStyle = '#7a4a26'; c.strokeStyle = INK; c.lineWidth = 1.4;
  c.beginPath(); c.moveTo(-34, -6); c.lineTo(30, -6); c.lineTo(42, -16); c.lineTo(24, 4); c.lineTo(-26, 4); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = '#c99a52'; c.fillRect(-28, -6, 52, 3);
  c.strokeStyle = '#4a2c18'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, -6); c.lineTo(-2, -58); c.stroke();
  c.fillStyle = '#f4ead2'; c.strokeStyle = INK; c.lineWidth = 1.2; c.beginPath(); c.moveTo(-28, -20); c.quadraticCurveTo(-4, -40, 22, -64); c.quadraticCurveTo(12, -34, -1, -10); c.closePath(); c.fill(); c.stroke();
  c.restore();
}
function speedboat(c, x, y, col) {
  c.save(); c.translate(x, y + Math.sin(t * 4 + x) * 1.2); c.fillStyle = 'rgba(255,255,255,.7)'; c.beginPath(); c.moveTo(-44, 3); c.quadraticCurveTo(-26, -1, -18, 3); c.fill();
  c.fillStyle = '#f4f6f8'; c.strokeStyle = INK; c.lineWidth = 1.3; c.beginPath(); c.moveTo(-20, -4); c.lineTo(18, -4); c.lineTo(26, -10); c.lineTo(14, 3); c.lineTo(-18, 3); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = col; c.fillRect(-18, -2, 34, 3); c.fillStyle = '#26384a'; c.beginPath(); c.moveTo(-4, -4); c.lineTo(8, -4); c.lineTo(4, -11); c.lineTo(-2, -11); c.closePath(); c.fill(); c.restore();
}
function mamzarSea(c) {
  sea(c, false);
  const top = GROUND - 78, off = worldX * 0.18 + t * 10;
  for (let i = Math.floor(off / 360) - 1; i <= Math.floor((off + W) / 360) + 1; i++) { const r = sr(i * 4.1 + 2); if (r < 0.25) continue;
    const x = i * 360 - off + sr(i) * 120, y = top + 12 + sr(i + 1) * 14;
    if (r > 0.6) dhow(c, x, y, 0.5 + sr(i + 2) * 0.3); else speedboat(c, x, y, ['#e23b4a', '#2b6cb0', '#1f7a74'][Math.floor(sr(i + 5) * 3)]); }
}
// ---- Deira old souq: coral-stone arcades, wooden mashrabiya, palm-frond roof, wind towers ----
function oldHouseTile(c, i) {
  const r = sr(i * 2.6 + 1), h = 90 + r * 40, w = 150; c.fillStyle = '#d6c09a'; c.strokeStyle = SOFT; c.lineWidth = 1.2;
  c.fillRect(0, GROUND - h, w, h + 2); c.strokeRect(0, GROUND - h, w, h + 2);
  c.fillStyle = '#c4ab80'; for (let k = 0; k < w; k += 14) { c.beginPath(); c.moveTo(k, GROUND - h); c.lineTo(k + 4, GROUND - h - 7); c.lineTo(k + 10, GROUND - h - 7); c.lineTo(k + 14, GROUND - h); c.fill(); }
  if (r > 0.35) { const tx = 96; c.fillStyle = '#d6c09a'; c.fillRect(tx, GROUND - h - 52, 34, 54); c.strokeRect(tx, GROUND - h - 52, 34, 54);
    c.fillStyle = '#6b4a2c'; for (let k = 0; k < 3; k++) c.fillRect(tx + 5 + k * 9, GROUND - h - 46, 5, 26); c.fillStyle = '#c4ab80'; c.fillRect(tx - 3, GROUND - h - 56, 40, 5);
    c.strokeStyle = '#8a6a3a'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(tx, GROUND - h - 50); c.lineTo(tx + 34, GROUND - h - 22); c.moveTo(tx + 34, GROUND - h - 50); c.lineTo(tx, GROUND - h - 22); c.stroke(); }
  c.fillStyle = '#6b4a2c'; for (let k = 0; k < 3; k++) c.fillRect(18 + k * 40, GROUND - h + 16, 16, 20);
}
function souqTile(c, i) {
  const r = sr(i * 3.7 + 2);
  c.fillStyle = '#dcc7a2'; c.strokeStyle = SOFT; c.lineWidth = 1.4; c.fillRect(0, GROUND - 140, 131, 142); c.strokeRect(0, GROUND - 140, 131, 142);
  c.fillStyle = 'rgba(120,90,50,.12)'; for (let k = 0; k < 40; k++) c.fillRect(sr(i * 3 + k) * 128, GROUND - 138 + sr(i * 5 + k * 1.7) * 136, 3 + sr(k) * 4, 2);
  c.fillStyle = '#a8834f'; c.fillRect(-3, GROUND - 150, 137, 12); c.strokeStyle = '#7a5a2f'; c.lineWidth = 1; c.beginPath(); for (let k = -2; k < 134; k += 4) { c.moveTo(k, GROUND - 150); c.lineTo(k + 2, GROUND - 138); } c.stroke();
  c.fillStyle = '#6b4a2c'; for (let k = 0; k < 4; k++) c.fillRect(10 + k * 32, GROUND - 138, 5, 10);
  c.fillStyle = '#7a5236'; c.fillRect(38, GROUND - 128, 54, 28); c.strokeStyle = '#c99a6a'; c.lineWidth = 1; c.beginPath();
  for (let k = 0; k <= 54; k += 6) { c.moveTo(38 + k, GROUND - 128); c.lineTo(38 + k, GROUND - 100); } for (let k = 0; k <= 28; k += 6) { c.moveTo(38, GROUND - 128 + k); c.lineTo(92, GROUND - 128 + k); } c.stroke();
  const arch = () => { c.beginPath(); c.moveTo(20, GROUND + 2); c.lineTo(20, GROUND - 52); c.quadraticCurveTo(20, GROUND - 92, 65, GROUND - 94); c.quadraticCurveTo(110, GROUND - 92, 110, GROUND - 52); c.lineTo(110, GROUND + 2); c.closePath(); };
  arch(); c.fillStyle = '#3d2417'; c.fill();
  if (r < 0.33) { const cols = ['#d9462b', '#e8b52a', '#8c4a24', '#c98a3b']; for (let k = 0; k < 4; k++) { c.fillStyle = '#b98a55'; c.fillRect(28 + k * 20, GROUND - 22, 16, 22); c.fillStyle = cols[k]; c.beginPath(); c.ellipse(36 + k * 20, GROUND - 22, 8, 5, 0, Math.PI, 0); c.fill(); } }
  else if (r < 0.66) { const cols = ['#9e2a2b', '#2c5d9e', '#a33fa0', '#e3b23c']; for (let k = 0; k < 4; k++) { c.fillStyle = cols[(k + i % 4 + 4) % 4]; c.fillRect(30 + k * 18, GROUND - 82, 14, 60); c.fillStyle = 'rgba(255,240,200,.45)'; c.fillRect(30 + k * 18, GROUND - 66, 14, 3); c.fillRect(30 + k * 18, GROUND - 46, 14, 3); } }
  else { c.fillStyle = '#6b4a2c'; c.fillRect(28, GROUND - 52, 74, 4); c.fillRect(28, GROUND - 26, 74, 4); for (let k = 0; k < 4; k++) { dallahShape(c, 38 + k * 18, GROUND - 52, 0.45); dallahShape(c, 38 + k * 18, GROUND - 26, 0.4); } }
  arch(); c.strokeStyle = '#f1e4c6'; c.lineWidth = 3; c.stroke();
}
function souqLive(c, i, x) {
  const sw = Math.sin(t * 2.2 + i) * 0.25;
  c.save(); c.translate(x + 65, GROUND - 92); c.rotate(sw); c.strokeStyle = INK; c.lineWidth = 1.2; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, 14); c.stroke();
  c.fillStyle = '#ffcf6b'; c.beginPath(); c.moveTo(0, 14); c.lineTo(6, 21); c.lineTo(4, 30); c.lineTo(-4, 30); c.lineTo(-6, 21); c.closePath(); c.fill(); c.stroke(); c.restore();
  addLight(x + 65 - Math.sin(sw) * 22, GROUND - 68, 60);
}

const TL = {
  dxb: { id: 'x', par: .1, tw: 60, box: [-2, GROUND - 340, 58, 344], q: .6, v: () => SK.n > 0.3 ? Math.round(SK.n * 4) : 0, draw: towerTile },
  shj: { id: 'j', par: .12, tw: 70, box: [-2, GROUND - 170, 84, 174], q: .6, draw: domeTile },
  fNear: { id: 'f', par: .72, tw: 300, box: [26, GROUND - 142, 200, 144], v: () => SK.n > 0.3 ? 1 : 0, draw: fareejNearTile },
  beach: { id: 'b', par: .42, tw: 300, box: [-4, GROUND - 154, 300, 156], v: () => (night() ? 1 : 0) + getLang(), draw: beachTile },
  park: { id: 'p', par: .42, tw: 260, box: [10, GROUND - 142, 240, 144], v: () => SK.n > 0.3 ? 1 : 0, draw: parkTile },
  beds: { id: 'e', par: .75, tw: 240, box: [18, GROUND - 26, 144, 28], has: i => sr(i * 2.9) > 0.35, draw: flowerbedTile },
  downtown: { id: 'd', par: .42, tw: 214, box: [-2, GROUND - 120, 212, 122], v: () => night() ? 1 : 0, draw: downtownTile, live: downtownLive },
  houses: { id: 'h', par: .25, tw: 170, box: [-2, GROUND - 190, 156, 192], draw: oldHouseTile },
  souq: { id: 'q', par: .42, tw: 131, box: [-4, GROUND - 152, 140, 154], has: i => sr(i * 1.9 + 0.3) > 0.28, draw: souqTile, live: (c, i, x) => { if (sr(i * 1.9 + 0.3) > 0.28) souqLive(c, i, x); } },
  resort: { id: 'r', par: .42, tw: 250, box: [8, GROUND - 124, 202, 126], has: i => sr(i * 2.7 + 1) > 0.3, v: () => night() ? 1 : 0, draw: resortTile,
    live: (c, i, x) => { if (sr(i + 0.37) > 0.4) palm(c, x + 228, GROUND - 4, 84 + sr(i) * 24, i); } },
  expo: { id: 'X', par: .42, tw: 230, box: [6, GROUND - 142, 210, 144], has: i => sr(i * 2.1 + 6) > 0.2, v: () => night() ? 1 : 0, draw: expoTile,
    live: (c, i, x) => { if (sr(i + 0.29) > 0.5) palm(c, x + 220, GROUND - 4, 80 + sr(i) * 20, i); } },
  golf: { id: 'G', par: .42, tw: 240, box: [-2, GROUND - 74, 244, 76], draw: golfTile, live: (c, i, x) => { if (sr(i + 0.61) > 0.45) palm(c, x + 200, GROUND - 4, 90 + sr(i) * 30, i); } },
  farm: { id: 'F', par: .42, tw: 236, box: [-2, GROUND - 54, 240, 56], draw: farmTile, live: (c, i, x) => { datePalm(c, x + 50, 96 + sr(i) * 30, i); if (sr(i + 0.4) > 0.4) datePalm(c, x + 180, 84 + sr(i + 2) * 24, i + 1); } },
  harbour: { id: 'H', par: .42, tw: 224, box: [16, GROUND - 190, 190, 192], has: i => sr(i * 2.6 + 3) > 0.22, v: () => night() ? 1 : 0, draw: harbourTile },
  jbrb: { id: 'y', par: .42, tw: 230, box: [24, GROUND - 104, 182, 106], has: i => sr(i * 3.3 + 2) > 0.25, v: () => (night() ? 1 : 0) + getLang(), draw: jbrTile,
    live: (c, i, x) => { if (sr(i + 0.53) > 0.45) palm(c, x + 214, GROUND - 4, 90 + sr(i) * 20, i); } },
};
const withAlpha = (a, fn) => c => { const A = c.globalAlpha; c.globalAlpha = A * a; fn(c); c.globalAlpha = A; };
// one entry per area, in route order (see ZONES)
const LAYERS = [
  // Al Mamzar: Sharjah's low skyline across the lagoon, boats, the beach park
  { far: withAlpha(0.38, c => tiled(c, TL.shj)), midfar: mamzarSea, mid: c => tiled(c, TL.park), near: c => tiled(c, TL.beds) },
  // Deira: wind-tower houses across the Creek, abras on the water, souq arcades on this side
  { far: withAlpha(0.42, c => tiled(c, TL.shj)), midfar: c => { withAlpha(0.85, c2 => tiled(c2, TL.houses))(c); creek(c); }, mid: c => tiled(c, TL.souq) },
  // Downtown: glass towers, the metro, shop fronts
  { far: withAlpha(0.42, c => tiled(c, TL.dxb)), midfar: metro, mid: c => tiled(c, TL.downtown), near: c => tiled(c, TL.fNear) },
  // Jumeirah: kites over the beach, the sea, lifeguard towers and food trucks
  { far: c => { withAlpha(0.3, c2 => tiled(c2, TL.dxb))(c); kites(c); }, midfar: c => sea(c, false), mid: c => tiled(c, TL.beach) },
  // Palm Jumeirah: open sea and resort villas
  { midfar: c => sea(c, false), mid: c => tiled(c, TL.resort) },
  // JBR: the marina skyline far off, the sea and the beach
  { far: withAlpha(0.32, c => tiled(c, TL.dxb)), midfar: c => sea(c, false), mid: c => tiled(c, TL.jbrb) },
  // Expo City: Jebel Ali far off, pavilions and shaded walks
  { far: withAlpha(0.22, c => tiled(c, TL.dxb)), mid: c => tiled(c, TL.expo), near: c => tiled(c, TL.beds) },
  // Al Habtoor golf: a lake behind the fairways
  { far: withAlpha(0.2, c => tiled(c, TL.dxb)), midfar: c => sea(c, true), mid: c => tiled(c, TL.golf) },
  // Nad Al Sheba: the racecourse rails and the park
  { far: withAlpha(0.3, c => tiled(c, TL.dxb)), midfar: rails, mid: c => tiled(c, TL.park), near: c => tiled(c, TL.beds) },
  // Al Khawaneej: sand hills, farms and date palms
  { far: sandHills, mid: c => tiled(c, TL.farm) },
  // Dubai Creek Harbour: Downtown across the water, the Creek, new towers
  { far: withAlpha(0.45, c => tiled(c, TL.dxb)), midfar: c => sea(c, true), mid: c => tiled(c, TL.harbour), near: c => tiled(c, TL.fNear) },
];
// Where the areas meet on screen, for a layer that scrolls at parallax p (the ground is 1): the area behind Abood,
// the one he is in, and the next, as [zone, x0, x1, start], start = where that area begins on screen. Each
// boundary moves at the layer's own speed and reaches Abood together with the ground's.
function areaSpans(p) {
  const zc = zoneAt(routeM), pz = (zc + NZ - 1) % NZ, a0 = lapStart(routeM) + M.AREAS[zc].at, a1 = nextAreaAt(routeM);
  const pStart = a0 - (((M.AREAS[zc].at - M.AREAS[pz].at) % RL + RL) % RL || RL);
  const toX = m => ABX + ((m - startM) * 40 - worldX) * p;
  return [[pz, -1e9, toX(a0), toX(pStart)], [zc, toX(a0), toX(a1), toX(a0)], [(zc + 1) % NZ, toX(a1), 1e9, toX(a1)]];
}
// one scenery layer drawn area by area, with a short soft edge where two areas meet (instead of fading both in place)
function layerSpan(name, p) {
  const F = 56, N = 4, sp = areaSpans(p), top = -offY - 40, hh = GROUND + offY + 42;
  for (let k = 0; k < 3; k++) {
    const [z, x0, x1] = sp[k], fn = LAYERS[z][name]; if (!fn) continue;
    const l = Math.max(-40, k > 0 ? x0 + F / 2 : -40), r = Math.min(W + 40, k < 2 ? x1 - F / 2 : W + 40); if (r <= l) continue;
    ctx.save(); ctx.beginPath(); ctx.rect(l, top, r - l, hh); ctx.clip(); fn(ctx); ctx.restore();
  }
  for (let k = 0; k < 2; k++) { // the seams: the two areas cross over in a few strips
    const bx = sp[k][2]; if (bx < -F || bx > W + F) continue;
    for (let i = 0; i < N; i++) { const xa = bx - F / 2 + i * F / N, a = (i + 0.5) / N;
      for (const [z, al] of [[sp[k][0], 1 - a], [sp[k + 1][0], a]]) { const fn = LAYERS[z][name]; if (!fn) continue;
        ctx.save(); ctx.globalAlpha = al; ctx.beginPath(); ctx.rect(xa, top, F / N + 0.5, hh); ctx.clip(); fn(ctx); ctx.restore(); } }
  }
}
function layer(name, A, B, blend) {
  const la = LAYERS[A][name], lb = LAYERS[B][name];
  if (la && blend < 1) { ctx.globalAlpha = 1 - blend; la(ctx); }
  if (lb && blend > 0) { ctx.globalAlpha = blend; lb(ctx); }
  ctx.globalAlpha = 1;
}

// ---------- ground: one seamless period per area, baked once ----------
// ground styles: corniche track, city pavement, park pavers, old stone, boardwalk, The Walk
const GSTYLE = [2, 3, 1, 0, 4, 5, 6, 7, 2, 8, 5], GP0 = [120, 120, 80, 70, 64, 96, 80, 90, 72], GP = GSTYLE.map(k => GP0[k]);
function groundTile(c, z) {
  const k = GSTYLE[z], P = GP[z], HB = H + 20;
  if (k === 0) { c.fillStyle = '#e8cf9a'; c.fillRect(0, GROUND, P, 8); c.fillStyle = '#c2553f'; c.fillRect(0, GROUND + 8, P, HB - GROUND - 8);
    c.fillStyle = '#f4f4f2'; c.fillRect(0, GROUND + 10, P, 2); c.fillRect(0, GROUND + 34, P, 1.6); c.fillRect(0, GROUND + 58, P, 1.6);
    c.fillStyle = 'rgba(255,255,255,.55)'; c.fillRect(20, GROUND + 20, 14, 2); c.fillRect(20, GROUND + 44, 14, 2); }
  else if (k === 1) { c.fillStyle = '#c9c3b8'; c.fillRect(0, GROUND, P, HB - GROUND); c.strokeStyle = 'rgba(70,60,50,.25)'; c.lineWidth = 1.2; c.beginPath();
    for (let x = 0; x <= P; x += 40) { c.moveTo(x, GROUND + 8); c.lineTo(x, GROUND + 40); } c.moveTo(0, GROUND + 40); c.lineTo(P, GROUND + 40); c.stroke();
    c.fillStyle = '#4a4a50'; c.fillRect(0, GROUND + 42, P, HB - GROUND - 42); c.fillStyle = 'rgba(242,242,242,.5)'; for (let x = 10; x < P; x += 60) c.fillRect(x, GROUND + 58, 30, 3);
    for (let x = 0; x < P; x += 120) { c.fillStyle = '#8d9099'; c.fillRect(x, GROUND, 60, 8); c.fillStyle = '#c4c7cd'; c.fillRect(x + 60, GROUND, 60, 8); } } // kerb: low contrast, wide blocks (fast thin stripes strain the eyes)
  else if (k === 2) { c.fillStyle = '#4f8a3a'; c.fillRect(0, GROUND, P, 7); c.fillStyle = '#d8b9a8'; c.fillRect(0, GROUND + 7, P, HB - GROUND - 7);
    c.strokeStyle = 'rgba(110,70,60,.3)'; c.lineWidth = 1.2; c.beginPath();
    for (let row = 0; row < 4; row++) { const yy = GROUND + 7 + row * 18; c.moveTo(0, yy); c.lineTo(P, yy); for (let x = (row % 2) * 20; x <= P; x += 40) { c.moveTo(x, yy); c.lineTo(x, yy + 18); } } c.stroke();
    c.fillStyle = '#6aa64f'; for (let x = 2; x < P; x += 6) c.fillRect(x, GROUND - 2, 2, 4); }
  else if (k === 3) { c.fillStyle = '#bf9a6c'; c.fillRect(0, GROUND, P, HB - GROUND); c.strokeStyle = 'rgba(80,50,25,.35)'; c.lineWidth = 1.5; c.beginPath();
    for (let row = 0; row < 3; row++) { const yy = GROUND + 8 + row * 22; c.moveTo(0, yy); c.lineTo(P, yy); for (let x = -(row % 2) * 35; x <= P; x += 70) { c.moveTo(x, yy); c.lineTo(x, yy + 22); } }
    c.stroke(); c.fillStyle = '#9c7a52'; c.fillRect(0, GROUND, P, 8); }
  else if (k === 4) { c.fillStyle = '#b07a4a'; c.fillRect(0, GROUND, P, 30); c.strokeStyle = 'rgba(70,40,20,.45)'; c.lineWidth = 1.4; c.beginPath(); for (let x = 0; x <= P; x += 16) { c.moveTo(x, GROUND); c.lineTo(x, GROUND + 30); } c.stroke();
    c.fillStyle = 'rgba(255,230,190,.25)'; c.fillRect(0, GROUND, P, 3); c.fillStyle = '#e8cf9a'; c.fillRect(0, GROUND + 30, P, HB - GROUND - 30); c.fillStyle = '#7a5434'; c.fillRect(0, GROUND + 30, P, 3); }
  else if (k === 6) { c.fillStyle = '#e6e2da'; c.fillRect(0, GROUND, P, HB - GROUND); c.fillStyle = '#1f7a74'; c.fillRect(0, GROUND, P, 5);
    c.strokeStyle = 'rgba(31,122,116,.35)'; c.lineWidth = 1.4; c.beginPath(); for (let x = 0; x <= P; x += 40) { c.moveTo(x, GROUND + 5); c.lineTo(x + 20, GROUND + 40); c.lineTo(x, GROUND + 75); } c.stroke(); }
  else if (k === 7) { c.fillStyle = '#5f9e46'; c.fillRect(0, GROUND, P, 8); c.fillStyle = '#c9c3b8'; c.fillRect(0, GROUND + 8, P, 30); c.fillStyle = '#6aaa4f'; c.fillRect(0, GROUND + 38, P, HB - GROUND - 38);
    c.fillStyle = '#82c062'; for (let x = 0; x < P; x += 30) c.fillRect(x, GROUND + 38, 15, HB - GROUND - 38); }
  else if (k === 8) { c.fillStyle = '#dcbf8e'; c.fillRect(0, GROUND, P, HB - GROUND); c.fillStyle = '#c4a272'; c.fillRect(0, GROUND, P, 6);
    c.fillStyle = 'rgba(150,110,60,.35)'; for (let x = 6; x < P; x += 18) { c.beginPath(); c.ellipse(x, GROUND + 22 + (x % 36 ? 18 : 0), 5, 2, 0, 0, TAU); c.fill(); } }
  else { c.fillStyle = '#ece0c8'; c.fillRect(0, GROUND, P, HB - GROUND); c.fillStyle = '#c9a777'; c.fillRect(0, GROUND, P, 6);
    c.strokeStyle = 'rgba(150,110,70,.45)'; c.lineWidth = 2; c.beginPath(); for (let row = 0; row < 3; row++) { const yy = GROUND + 18 + row * 22; c.moveTo(0, yy); for (let x = 0; x <= P; x += 24) c.quadraticCurveTo(x + 6, yy - 6, x + 12, yy), c.quadraticCurveTo(x + 18, yy + 6, x + 24, yy); } c.stroke(); }
  for (let j = 0; j < P * 0.45; j++) { c.fillStyle = j % 3 ? 'rgba(90,60,30,.12)' : 'rgba(255,255,255,.18)'; c.fillRect(sr(z * 31 + j) * P, GROUND + 10 + sr(z * 17 + j * 1.3) * 76, 1.6, 1.6); }
  c.fillStyle = 'rgba(0,0,0,.16)'; c.fillRect(0, GROUND + 8, P, 2);
}
const GL = GP.map((P, z) => ({ id: 'g' + z, box: [0, GROUND, P, H + 20 - GROUND], draw: c => groundTile(c, z) }));
function groundSeg(c, z, x0, x1, anchor) { // anchor: where this area begins on screen, so its paving pattern starts there
  x0 = Math.max(-20, x0); x1 = Math.min(W + 20, x1); if (x1 <= x0) return; const P = GP[z], e = getTile(GL[z], 0, true);
  c.save(); c.beginPath(); c.rect(x0, GROUND, x1 - x0, H - GROUND + 20); c.clip();
  for (let x = anchor + Math.floor((x0 - anchor) / P) * P; x < x1; x += P) c.drawImage(e.c, x, GROUND, P, H + 20 - GROUND);
  c.restore();
}
function ground(c) {
  const sp = areaSpans(1); // the area behind Abood keeps its paving until it scrolls off, so nothing pops as he crosses over
  for (const [z, x0, x1, a] of sp) groundSeg(c, z, x0, x1, a);
  for (let k = 0; k < 2; k++) { const bx = sp[k][2]; if (bx > -10 && bx < W + 10) { // a joint where the paving changes
    c.fillStyle = 'rgba(30,20,12,.35)'; c.fillRect(bx - 1.5, GROUND, 3, H - GROUND + 20); c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(bx + 1.5, GROUND, 1.5, H - GROUND + 20); } }
  if (!PITG) { PITG = c.createLinearGradient(0, GROUND, 0, H); PITG.addColorStop(0, '#3a2418'); PITG.addColorStop(1, '#120a06'); }
  for (const g of gaps) { const x0 = g.x0 - worldX + ABX, x1 = g.x1 - worldX + ABX; if (x1 < 0 || x0 > W) continue;
    c.fillStyle = PITG; c.fillRect(x0, GROUND, x1 - x0, H - GROUND + 20); c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(x0, GROUND, 6, H - GROUND + 20); c.fillRect(x1 - 6, GROUND, 6, H - GROUND + 20);
    c.strokeStyle = INK; c.lineWidth = 2; c.beginPath(); c.moveTo(x0, GROUND); c.lineTo(x0, H + 20); c.moveTo(x1, GROUND); c.lineTo(x1, H + 20); c.stroke(); }
}
const AWN = {};
function platform(c, p) {
  const x = p.x - worldX + ABX; if (x > W || x + p.w < 0) return; const style = ZONES[p.z].plat;
  if (style === 'plank') { c.strokeStyle = '#5a3a22'; c.lineWidth = 5; c.beginPath(); c.moveTo(x + 12, p.y); c.lineTo(x + 12, GROUND + 4); c.moveTo(x + p.w - 12, p.y); c.lineTo(x + p.w - 12, GROUND + 4); c.stroke();
    c.fillStyle = '#a8743f'; c.strokeStyle = INK; c.lineWidth = 2; c.beginPath(); c.roundRect(x, p.y, p.w, 12, 3); c.fill(); c.stroke(); c.strokeStyle = 'rgba(43,26,18,.4)'; c.lineWidth = 1; c.beginPath(); for (let k = 20; k < p.w; k += 26) { c.moveTo(x + k, p.y + 2); c.lineTo(x + k, p.y + 10); } c.stroke();
    c.fillStyle = '#e23b4a'; c.strokeStyle = INK; c.lineWidth = 1.4; c.beginPath(); c.arc(x + p.w - 24, p.y + 20, 7, 0, TAU); c.fill(); c.stroke(); c.strokeStyle = '#fff'; c.lineWidth = 2.4; c.beginPath(); c.arc(x + p.w - 24, p.y + 20, 7, 0.3, 1.2); c.stroke(); c.beginPath(); c.arc(x + p.w - 24, p.y + 20, 7, 3.4, 4.3); c.stroke(); return; }
  if (style === 'stone') { c.fillStyle = '#b98a5c'; c.strokeStyle = INK; c.lineWidth = 2; c.beginPath(); c.roundRect(x, p.y, p.w, 22, 5); c.fill(); c.stroke();
    c.fillStyle = '#d9a96f'; c.fillRect(x + 3, p.y + 2, p.w - 6, 4); c.strokeStyle = 'rgba(90,55,25,.45)'; c.lineWidth = 1.2; c.beginPath();
    c.moveTo(x + 6, p.y + 12); c.lineTo(x + p.w - 6, p.y + 12); for (let k = 30; k < p.w - 10; k += 46) { c.moveTo(x + k, p.y + 12); c.lineTo(x + k + 6, p.y + 21); } c.stroke();
    c.fillStyle = '#9c6f45'; c.fillRect(x + 14, p.y + 22, 10, GROUND - p.y - 22); c.fillRect(x + p.w - 24, p.y + 22, 10, GROUND - p.y - 22); return; }
  if (style === 'pergola') { c.fillStyle = '#8a5a35'; c.strokeStyle = INK; c.lineWidth = 1.6; c.fillRect(x + 8, p.y, 8, GROUND - p.y); c.fillRect(x + p.w - 16, p.y, 8, GROUND - p.y);
    c.beginPath(); c.roundRect(x, p.y, p.w, 10, 3); c.fill(); c.stroke(); c.fillStyle = '#4f8a3a'; for (let k = 6; k < p.w; k += 14) { c.beginPath(); c.arc(x + k, p.y - 2, 7, 0, TAU); c.arc(x + k + 4, p.y + 10, 4, 0, TAU); c.fill(); }
    c.fillStyle = '#e0479e'; for (let k = 10; k < p.w; k += 22) { c.beginPath(); c.arc(x + k, p.y - 4, 2.4, 0, TAU); c.fill(); } return; }
  if (style === 'sadu') { c.strokeStyle = '#6b4a2c'; c.lineWidth = 4; c.beginPath(); c.moveTo(x + 10, p.y); c.lineTo(x + 10, GROUND + 4); c.moveTo(x + p.w - 10, p.y); c.lineTo(x + p.w - 10, GROUND + 4); c.stroke();
    sadu(c, x, p.y, p.w, 12); for (let k = 0; k < p.w - 8; k += 14) { c.fillStyle = k / 14 % 2 ? '#1d1d1d' : '#a8262b'; c.beginPath(); c.moveTo(x + k, p.y + 12); c.lineTo(x + k + 14, p.y + 12); c.lineTo(x + k + 7, p.y + 19); c.closePath(); c.fill(); }
    c.strokeStyle = INK; c.lineWidth = 2; c.strokeRect(x, p.y, p.w, 12); return; }
  const [a, b] = style;
  c.strokeStyle = '#6b4a3a'; c.lineWidth = 4; c.beginPath(); c.moveTo(x + 10, p.y); c.lineTo(x + 10, GROUND + 4); c.moveTo(x + p.w - 10, p.y); c.lineTo(x + p.w - 10, GROUND + 4); c.stroke();
  const b2 = AWN[b] || (AWN[b] = rgb(mix(hex(b), hex(a), 0.45))); // calmer stripes: less contrast, and wider
  for (let k = 0; k < p.w; k += 24) { c.fillStyle = (k / 24) % 2 ? b2 : a; c.fillRect(x + k, p.y, Math.min(24, p.w - k), 12); }
  c.strokeStyle = INK; c.lineWidth = 1.4;
  for (let k = 0; k < p.w - 12; k += 24) { c.fillStyle = (k / 24) % 2 ? b2 : a; c.beginPath(); c.arc(x + k + 12, p.y + 12, 10, 0, Math.PI); c.fill(); c.stroke(); }
  c.lineWidth = 2; c.strokeRect(x, p.y, p.w, 12);
}
function foreground(c, z) {
  const off = worldX * 1.35, tw = 620, id = ZONES[z].id, tun = tunnelF(routeM) > 0.5;
  c.fillStyle = tun ? 'rgba(4,20,38,.85)' : 'rgba(30,18,12,.82)'; c.strokeStyle = 'rgba(30,18,12,.82)';
  for (let i = Math.floor(off / tw) - 1; i <= Math.floor((off + W) / tw) + 1; i++) { const r = sr(i * 9.7 + z); if (r < 0.45) continue; const x = i * tw - off + r * 200;
    if (tun) { c.fillRect(x, -offY - 20, 22, H + offY + 40); }
    else if (id === 'jumeirah' || id === 'creek' || id === 'jbr' || id === 'khawaneej') { c.beginPath(); c.arc(x, H + 6, 34, 0, TAU); c.arc(x + 36, H + 12, 28, 0, TAU); c.fill(); }
    else if (id === 'downtown' || id === 'expo' || id === 'harbour') { c.fillRect(x, H - 36, 10, 36); c.beginPath(); c.arc(x + 5, H - 36, 5, 0, TAU); c.fill(); c.fillRect(x + 90, H - 36, 10, 36); c.beginPath(); c.arc(x + 95, H - 36, 5, 0, TAU); c.fill(); }
    else { c.lineWidth = 4; c.lineCap = 'round'; c.beginPath(); for (let k = 0; k < 8; k++) { c.moveTo(x + k * 5, H + 4); c.lineTo(x + k * 5 - 10 + k * 3 + Math.sin(t * 3 + k) * 3, H - 30 - (k % 3) * 12); } c.stroke(); }
  }
}

// ---------- sky ----------
function sky(c) {
  const [a, b, d, e] = SK.c, n = SK.n;
  const g = c.createLinearGradient(0, -offY, 0, GROUND); g.addColorStop(0, rgb(a)); g.addColorStop(0.45, rgb(b)); g.addColorStop(0.78, rgb(d)); g.addColorStop(1, rgb(e));
  c.fillStyle = g; c.fillRect(-20, -offY - 20, W + 40, GROUND + offY + 22);
  if (n > 0.05 && STARS) { const ox = ((-worldX * 0.01) % W + W) % W; c.globalAlpha = n * 0.9; c.drawImage(STARS, ox - W, -offY); c.drawImage(STARS, ox, -offY); c.globalAlpha = 1; }
  const sx = W * 0.78, sy = SK.sun;
  if (sy < GROUND + 40) { const warm = clamp((sy - 110) / 150, 0, 1), sc = mix([255, 246, 214], [255, 170, 90], warm);
    const sg = c.createRadialGradient(sx, sy, 10, sx, sy, 130); sg.addColorStop(0, rgb(sc, .85)); sg.addColorStop(1, rgb(sc, 0)); c.fillStyle = sg; c.fillRect(sx - 130, sy - 130, 260, 260);
    c.fillStyle = rgb(mix([255, 250, 225], [255, 200, 120], warm)); c.beginPath(); c.arc(sx, sy, 40, 0, TAU); c.fill(); }
  if (n > 0.3) { const mx = W * 0.22, my = 80; c.globalAlpha = clamp((n - 0.3) * 1.6, 0, 1);
    c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha *= 0.25; c.drawImage(GLOW, mx - 90, my - 90, 180, 180); c.restore();
    c.fillStyle = '#f4f1dc'; c.beginPath(); c.arc(mx, my, 22, 0, TAU); c.fill(); c.fillStyle = rgb(a); c.beginPath(); c.arc(mx + 9, my - 5, 19, 0, TAU); c.fill(); c.globalAlpha = 1; }
}
function clouds(c) {
  const cc = mix(mix(SK.c[3], [255, 255, 255], 0.55), [70, 78, 130], SK.n * 0.8);
  const off = worldX * 0.05 + t * 10, tw = 240;
  for (let pass = 0; pass < 2; pass++) {
  c.fillStyle = pass ? rgb(mix(cc, [255, 255, 255], 0.45), 0.9) : rgb(mix(cc, [120, 110, 150], 0.18), 0.9);
  const dy = pass ? -3.5 : 0, sh = pass ? 0.78 : 1;
  c.beginPath();
  for (let i = Math.floor(off / tw) - 1; i <= Math.floor((off + W) / tw) + 1; i++) { const r = sr(i * 2.3 + 50); if (r < 0.4) continue;
    const x = i * tw - off + r * 70, y = -offY * 0.6 + 30 + sr(i + 3) * 110, s = 0.6 + r * 0.7;
    const q = s * sh, yy = y + dy * s;
    c.moveTo(x + 16 * q, yy); c.arc(x, yy, 16 * q, 0, TAU); c.moveTo(x + 18 * s + 20 * q, yy - 9 * s); c.arc(x + 18 * s, yy - 9 * s, 20 * q, 0, TAU); c.moveTo(x + 40 * s + 15 * q, yy); c.arc(x + 40 * s, yy, 15 * q, 0, TAU); if (!pass) { c.moveTo(x + 36 * s, y + 5 * s); c.arc(x + 20 * s, y + 5 * s, 16 * s, 0, TAU); } }
  c.fill(); }
}
function haze(c, y0, a) {
  const h = SK.c[3], g = c.createLinearGradient(0, y0, 0, GROUND); g.addColorStop(0, rgb(h, 0)); g.addColorStop(1, rgb(h, a * (1 - SK.n * 0.5)));
  c.fillStyle = g; c.fillRect(-20, y0, W + 40, GROUND - y0 + 2);
}
function drawBirds(c) {
  c.strokeStyle = SK.n > 0.5 ? '#c9cde8' : '#2b1a12'; c.lineWidth = 2; c.lineCap = 'round'; c.beginPath();
  for (const b of birds) if (b.falcon) falcon(c, b.x, b.y, true, b.ph);
  c.strokeStyle = SK.n > 0.5 ? '#c9cde8' : '#2b1a12'; c.lineWidth = 2; c.beginPath();
  for (const b of birds) { if (b.falcon) continue; const f = Math.sin(b.ph) * 5, s = b.gull ? 1.3 : 1; c.moveTo(b.x - 8 * s, b.y - f); c.quadraticCurveTo(b.x - 3 * s, b.y - 3, b.x, b.y); c.quadraticCurveTo(b.x + 3 * s, b.y - 3, b.x + 8 * s, b.y - f); }
  c.stroke();
}
function drawLights(c) {
  const n = SK.n; if (n < 0.08 || !lights.length) return;
  c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.5 * n;
  for (const [x, y, r] of lights) { if (x < -r || x > W + r) continue; c.drawImage(GLOW, x - r, y - r, r * 2, r * 2); }
  c.restore();
}
function drawBanner(c) {
  if (!banner) return; const bt = banner.t, big = T('zn_' + ZONES[banner.z].id), small = T('area', banner.z + 1);
  const e = bt < 0.5 ? 1 - Math.pow(1 - bt / 0.5, 3) : bt > 2.8 ? 1 - (bt - 2.8) / 0.6 : 1; const y = -offY * 0.3 + 60 + (e - 1) * 90;
  c.save(); c.globalAlpha = clamp(e, 0, 1); c.translate(W / 2, y + 46); c.rotate(Math.sin(bt * 3) * 0.02);
  c.font = '800 28px ' + FONT; const w1 = c.measureText(big).width; c.font = '800 18px ' + FONT; const w = Math.max(w1, c.measureText(small).width) + 50;
  c.fillStyle = '#f3dfb8'; c.strokeStyle = INK; c.lineWidth = 3; c.beginPath(); c.roundRect(-w / 2, -34, w, 66, 14); c.fill(); c.stroke();
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillStyle = '#c8202b'; c.font = '800 17px ' + FONT; c.fillText(small, 0, -15);
  c.fillStyle = INK; c.font = '800 28px ' + FONT; c.fillText(big, 0, 12); c.restore();
}
function drawStopBanner(c) {
  if (!stopBanner || banner || st !== 'play') return;
  const b = stopBanner, bt = b.t, e = bt < 0.4 ? 1 - Math.pow(1 - bt / 0.4, 3) : bt > 3.2 ? 1 - (bt - 3.2) / 0.6 : 1;
  const name = T('st_' + b.id), sub = b.got ? T('st_new', b.got) : T('st_pass');
  c.save(); c.globalAlpha = clamp(e, 0, 1); c.translate(W / 2, -offY * 0.3 + 100 + (e - 1) * 50); c.direction = getLang() === 'ar' ? 'rtl' : 'ltr';
  c.font = '800 21px ' + FONT; const w1 = c.measureText(name).width; c.font = '800 13px ' + FONT; const w = Math.max(w1, c.measureText(sub).width) + 70;
  c.fillStyle = b.got ? '#fff3c4' : '#fffaf0'; c.strokeStyle = INK; c.lineWidth = 2.5; c.beginPath(); c.roundRect(-w / 2, -26, w, 52, 12); c.fill(); c.stroke();
  const px = -w / 2 + 24; c.fillStyle = '#c8202b'; c.strokeStyle = INK; c.lineWidth = 2; c.beginPath(); c.moveTo(px, 12); c.bezierCurveTo(px - 14, -2, px - 10, -16, px, -16); c.bezierCurveTo(px + 10, -16, px + 14, -2, px, 12); c.fill(); c.stroke();
  c.fillStyle = '#fffaf0'; c.beginPath(); c.arc(px, -6, 3.6, 0, TAU); c.fill();
  c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = b.got ? '#b07a12' : '#1f7a74'; c.font = '800 13px ' + FONT; c.fillText(sub, 14, -10);
  c.fillStyle = INK; c.font = '800 21px ' + FONT; c.fillText(name, 14, 10); c.restore();
}
function star(c, x, y, r) { c.beginPath(); for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2, rr = i % 2 ? r * 0.45 : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } c.closePath(); c.fill(); c.stroke(); }

function render() {
  lights.length = 0; tileBudget = 2; sprBudget = 6;
  SK = skyAt((0.14 + dist / 1700) % 1);
  const A = zoneAt(routeM), na = nextAreaAt(routeM), B = (A + 1) % NZ, blend = clamp((routeM - (na - 35)) / 35, 0, 1), tf = tunnelF(routeM);
  ctx.setTransform(RES, 0, 0, RES, 0, offY * RES);
  if (shake > 0 && !REDUCED) ctx.translate(rnd(-2, 2) * shake * 2.5, rnd(-2, 2) * shake * 2.5);
  if (tf < 1) {
    sky(ctx); clouds(ctx);
    layer('far', A, B, blend); landmarks(ctx, 'far'); haze(ctx, GROUND - 230, 0.38); drawBirds(ctx); layer('midfar', A, B, blend); landmarks(ctx, 'midfar');
    haze(ctx, GROUND - 120, 0.22); layerSpan('mid', 0.42); landmarks(ctx, 'near'); layerSpan('near', 0.75);
    haze(ctx, GROUND - 170, 0.26); // pushes the street scenery back, so the obstacles in front read clearly
    if (SK.n > 0.02) { ctx.fillStyle = `rgba(12,16,48,${SK.n * 0.42})`; ctx.fillRect(-20, -offY - 20, W + 40, GROUND + offY + 22); }
  }
  if (tf > 0) aquarium(ctx, tf);
  ground(ctx);
  if (tf > 0) { ctx.fillStyle = `rgba(20,110,160,${tf * 0.3})`; ctx.fillRect(-20, GROUND, W + 40, H - GROUND + 20); }
  if (SK.n > 0.02) { ctx.fillStyle = `rgba(12,16,48,${SK.n * 0.28})`; ctx.fillRect(-20, GROUND, W + 40, H - GROUND + 20); }
  drawLights(ctx);
  ctx.textBaseline = 'alphabetic';
  for (const p of plats) platform(ctx, p);
  for (const it of items) if (!it.got) { const x = it.x - worldX + ABX; if (x > -30 && x < W + 30) drawItem(ctx, it.kind, x, it.y, it.c || it.x * 0.01, it.mag); }
  for (const o of obs) { const x = o.x - worldX + ABX; if (x > -120 && x < W + 80) {
    if (!o.hit) { ctx.fillStyle = 'rgba(20,12,8,.32)'; ctx.beginPath(); ctx.ellipse(x + o.w / 2, GROUND + 1.5, o.w * 0.62 * (1 - Math.min(0.5, o.lift / 90)), 4.5, 0, 0, TAU); ctx.fill(); }
    drawObstacle(ctx, o, x); } }
  if (race && race.seed && st !== 'menu') drawFinish(ctx, SPRINT_M * 40 - worldX + ABX);
  for (const s of sandals) { ctx.save(); ctx.translate(s.sx, s.y); ctx.rotate(s.rot); ctx.translate(0, -7); sandalShape(ctx); ctx.restore(); }
  const fx = dadScreenX();
  ctx.fillStyle = 'rgba(0,0,0,.18)';
  if (st !== 'over') { ctx.beginPath(); ctx.ellipse(fx, GROUND + 2, 20 * (1 - Math.min(0.6, (GROUND - dad.y) / 300)), 4, 0, 0, TAU); ctx.fill(); }
  if (kid.y <= GROUND + 2 && st !== 'over') { ctx.beginPath(); ctx.ellipse(ABX, GROUND + 2, 13 * (1 - Math.min(0.6, (GROUND - kid.y) / 300)), 3, 0, 0, TAU); ctx.fill(); }
  if (st === 'over') {
    const dx = overX || ABX - 40; ctx.beginPath(); ctx.ellipse(dx, GROUND + 2, 22, 4, 0, 0, TAU); ctx.fill();
    drawDad(ctx, dx, GROUND, true); drawKid(ctx, dx + 9, GROUND - 34 + Math.sin(t * 8) * 1.5, kid.ph, false, 1, { kick: 1, mouth: 'o', arm: 'o', rot: 0.12, sweat: 1 });
  } else {
    drawDad(ctx, fx, dad.y);
    if (race && st !== 'over') drawGhost(ctx);
    if ((boost > 0 || kid.scoot > 0) && st === 'play') for (let i = 1; i <= 3; i++) drawKid(ctx, ABX - i * 14, kid.y, kid.ph - i * 0.4, !kid.on, 0.16);
    if (!(kid.inv > 0 && Math.floor(t * 14) % 2 && st === 'play')) drawKid(ctx, ABX, kid.y, kid.ph, !kid.on && st === 'play');
    if (kid.mag > 0 && st === 'play') { ctx.strokeStyle = `rgba(255,120,140,${0.35 + 0.2 * Math.sin(t * 10)})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(ABX, kid.y - 30, 40 + ((t * 60) % 30), 0, TAU); ctx.stroke(); }
  }
  ctx.direction = getLang() === 'ar' ? 'rtl' : 'ltr';
  for (const p of parts) {
    const x = p.x - worldX + ABX, a = Math.max(0, p.life / p.max);
    if (p.text) { ctx.globalAlpha = Math.min(1, a * 1.6); const s = 1 + Math.max(0, (p.life - p.max + 0.15) / 0.15) * 0.4; ctx.save(); ctx.translate(x, p.y); ctx.scale(s, s); ctx.font = '800 17px ' + FONT; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.strokeText(p.text, 0, 0); ctx.fillStyle = p.col; ctx.fillText(p.text, 0, 0); ctx.restore(); ctx.globalAlpha = 1; continue; }
    if (p.ring) { ctx.strokeStyle = `rgba(255,230,120,${a})`; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(x, p.y, 8 + (1 - a) * 18, 0, TAU); ctx.stroke(); continue; }
    if (p.stars) { ctx.fillStyle = '#ffe066'; ctx.strokeStyle = INK; ctx.lineWidth = 1; for (let k = 0; k < 3; k++) { const ang = t * 8 + k * 2.1; star(ctx, ABX + Math.cos(ang) * 14, kid.y - 64 + Math.sin(ang) * 4, 4); } continue; }
    if (p.marble) { ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(x, p.y, p.r, 0, TAU); ctx.fill(); continue; }
    const r = (p.steam ? p.r * (1.6 - a) : p.r) * 1.7;
    ctx.globalAlpha = a * (p.steam ? 0.8 : 1); ctx.drawImage(puffSprite(p.col), x - r, p.y - r, r * 2, r * 2); ctx.globalAlpha = 1;
  }
  ctx.direction = 'inherit';
  if (race && (st === 'play' || st === 'pause')) drawCountdown(ctx);
  if (st === 'play' && (boost > 0 || kid.scoot > 0) && !REDUCED) { ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 2; ctx.beginPath(); for (let i = 0; i < 10; i++) { const y = 40 + sr(i * 3.3) * 280, x = ((sr(i) * W - t * 1400) % W + W) % W; ctx.moveTo(x, y); ctx.lineTo(x + 40 + sr(i) * 60, y); } ctx.stroke(); }
  if (qLevel < 3) foreground(ctx, A);
  const dsx = st === 'over' ? ABX - 40 : fx;
  if (dad.sayT > 0) bubble(ctx, Math.max(60, dsx + 10), (st === 'over' ? GROUND : dad.y) - 104, dad.say);
  if (kid.sayT > 0 && st !== 'over') bubble(ctx, ABX + 18, kid.y - 74, kid.say, true);
  if (kid.sayT > 0 && st === 'over' && stT > 0.5) bubble(ctx, ABX + 30, GROUND - 100, kid.say, true);
  if (st === 'play' && lead < 0.25) { const a = (0.25 - lead) * 2 * (0.6 + 0.4 * Math.sin(t * 10)); const g = ctx.createLinearGradient(0, 0, W * 0.3, 0);
    g.addColorStop(0, 'rgba(200,32,43,' + a + ')'); g.addColorStop(1, 'rgba(200,32,43,0)'); ctx.fillStyle = g; ctx.fillRect(-10, -offY, W * 0.3, H + offY); }
  drawBanner(ctx); drawStopBanner(ctx);
  if (st === 'pause') { ctx.fillStyle = 'rgba(20,15,35,.55)'; ctx.fillRect(-20, -offY - 20, W + 40, H + offY + 40); ctx.fillStyle = '#fffaf0'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.font = '800 34px ' + FONT; ctx.fillText(T('paused'), W / 2, 170); ctx.font = '600 16px ' + FONT; ctx.fillText(T('pausedHint'), W / 2, 202); }
}

// ---------- menus: avatar, dirhams, boosters, sheets ----------
function syncCoins() { const v = T('coins', M.data().coins); document.querySelectorAll('.coinVal').forEach(e => { e.textContent = v; }); }
let noteT = 0;
function note(msg, ms = 1800) { const n = $('note'); n.textContent = msg; n.hidden = false; clearTimeout(noteT); noteT = setTimeout(() => { n.hidden = true; }, ms); }
const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
// avatar: the same drawing as in the game, at one uniform scale
function drawAvatar(cnv, look, ph, mood, still) {
  const c = cnv.getContext('2d'), S2 = cnv.width, sc = S2 / 100;
  c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, S2, S2);
  c.fillStyle = 'rgba(43,26,18,.14)'; c.beginPath(); c.ellipse(S2 / 2, S2 * 0.9, S2 * 0.2, S2 * 0.035, 0, 0, TAU); c.fill();
  c.save(); c.translate(S2 / 2 + 6 * sc, S2 * 0.9); c.scale(sc, sc);
  person(c, 0, 0, ph, false, Object.assign({}, look, { s: 1, mouth: mood || 'grin', still: !!still, lean: 0.02 }));
  c.restore();
}
const TIER_COL = ['#c8823f', '#c3c8d1', '#f2c230'], TIER_RIB = ['#8a4b25', '#6b7280', '#c8202b'];
const SPECIAL_COL = { first: '#4a90e2', dist10000: '#f2c230', shopper: '#f28c28', postcards: '#e0479e', journey: '#1f7a74' };
// tier: -1 locked, 0 bronze, 1 silver, 2 gold (special badges pass 2 when earned)
function drawMedal(c, id, tier, size) {
  c.setTransform(size / 40, 0, 0, size / 40, 0, 0); c.clearRect(0, 0, 40, 40); c.lineJoin = 'round';
  const on = tier >= 0, base = !on ? '#cfc9ba' : SPECIAL_COL[id] && tier === 2 && !TIER_COL[3] && SPECIAL_COL[id] || TIER_COL[tier];
  c.fillStyle = on ? TIER_RIB[tier] : '#b9b3a5'; c.beginPath(); c.moveTo(10, 1); c.lineTo(18, 1); c.lineTo(22, 14); c.lineTo(15, 14); c.closePath(); c.fill();
  c.fillStyle = on ? '#1f7a74' : '#a9a397'; c.beginPath(); c.moveTo(22, 1); c.lineTo(30, 1); c.lineTo(25, 14); c.lineTo(18, 14); c.closePath(); c.fill();
  c.fillStyle = base; c.strokeStyle = INK; c.lineWidth = 1.6; c.beginPath(); c.arc(20, 25, 13, 0, TAU); c.fill(); c.stroke();
  c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 1.2; c.beginPath(); c.arc(20, 25, 10, 0, TAU); c.stroke();
  c.fillStyle = '#fffaf0'; c.strokeStyle = INK; c.lineWidth = 1; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = '800 8px ' + FONT;
  c.save(); c.translate(20, 25);
  if (id === 'dist') c.fillText(getLang() === 'ar' ? 'كم' : 'km', 0, 0.5);
  else if (id === 'dist10000') c.fillText('10K', 0, 0.5);
  else if (id === 'streak') c.fillText('7', 0, 0.5);
  else if (id === 'sweets') { c.scale(0.7, 0.7); drawItem(c, 'candy', 0, 0, 1, true); }
  else if (id === 'dodge') { c.rotate(1.1); c.translate(0, -7); c.scale(0.9, 0.9); sandalShape(c); }
  else if (id === 'powers') { c.scale(0.55, 0.55); drawItem(c, 'vimto', 0, 2, 0, true); }
  else if (id === 'first' || id === 'runs') { c.fillRect(-5, -7, 2, 14); c.beginPath(); c.moveTo(-3, -7); c.lineTo(7, -4); c.lineTo(-3, -1); c.fill(); }
  else if (id === 'close') { c.beginPath(); c.moveTo(2, -8); c.lineTo(-5, 1); c.lineTo(0, 1); c.lineTo(-2, 8); c.lineTo(5, -1); c.lineTo(0, -1); c.closePath(); c.fill(); }
  else if (id === 'revive') { c.beginPath(); c.moveTo(0, 7); c.bezierCurveTo(-10, 0, -6, -8, 0, -3); c.bezierCurveTo(6, -8, 10, 0, 0, 7); c.fill(); }
  else if (id === 'areas') { c.beginPath(); c.arc(0, -2, 5, Math.PI * 0.85, Math.PI * 2.15); c.lineTo(0, 8); c.closePath(); c.fill(); c.fillStyle = base; c.beginPath(); c.arc(0, -2, 2, 0, TAU); c.fill(); }
  else if (id === 'shopper') { c.beginPath(); c.arc(0, 0, 6, 0, TAU); c.fill(); c.fillStyle = SPECIAL_COL.shopper; c.font = '800 7px ' + FONT; c.fillText(getLang() === 'ar' ? 'د' : 'D', 0, 0.5); }
  else star(c, 0, 0, 7);
  c.restore();
}
const badgeName = b => b.cat ? T('bc_' + b.id) + ' · ' + T('tier_' + b.tier) : T('bg_' + b.id);
function drawBoosterIcon(c, id, size) {
  c.setTransform(size / 40, 0, 0, size / 40, 0, 0); c.clearRect(0, 0, 40, 40);
  if (id === 'vimto') drawItem(c, 'vimto', 20, 22, 0, true);
  else if (id === 'magnet') drawItem(c, 'magnet', 20, 20, 0, true);
  else if (id === 'headstart') drawItem(c, 'scooter', 20, 18, 0, true);
  else if (id === 'shield') { c.fillStyle = '#8fd3ff'; c.strokeStyle = INK; c.lineWidth = 1.8; c.beginPath(); c.moveTo(20, 6); c.lineTo(32, 11); c.quadraticCurveTo(32, 28, 20, 35); c.quadraticCurveTo(8, 28, 8, 11); c.closePath(); c.fill(); c.stroke(); c.fillStyle = '#fff'; c.fillRect(18, 13, 4, 14); c.fillRect(13, 18, 14, 4); }
  else if (id === 'revive') { c.fillStyle = '#e23b4a'; c.strokeStyle = INK; c.lineWidth = 1.8; c.beginPath(); c.moveTo(20, 33); c.bezierCurveTo(2, 20, 8, 5, 20, 13); c.bezierCurveTo(32, 5, 38, 20, 20, 33); c.fill(); c.stroke(); c.fillStyle = 'rgba(255,255,255,.6)'; c.beginPath(); c.arc(14, 15, 3, 0, TAU); c.fill(); }
}
// ---- start-point strip: a card with a little picture for every area on the route ----
// The picture is drawn with the game's own scenery: that area's sky, layers, ground and its best-known landmark.
const AREA_SIG = { mamzar: 'mamzarpark', creek: 'abra', downtown: 'burj', jumeirah: 'arab', palm: 'atlantis', jbr: 'eye', expo: 'wasl', golf: 'clubhouse', nadsheba: 'meydan', khawaneej: 'quranic', harbour: 'harbourtowers' };
const THUMBS = new Map(), TH_W = 232, TH_H = 128, TH_Y0 = 120; // canvas pixels, and the top of the world strip shown
function areaThumb(z) {
  const key = z + ':' + getLang(); if (THUMBS.has(key)) return THUMBS.get(key);
  const cnv = mk(TH_W, TH_H), c = cnv.getContext('2d'), sc = TH_H / (H - TH_Y0);
  const keep = { W, worldX, SK, lights };
  W = TH_W / sc; worldX = 9000 + z * 3700; SK = skyAt(0.08); lights = [];
  try {
    c.scale(sc, sc); c.translate(0, -TH_Y0);
    const sky = c.createLinearGradient(0, TH_Y0, 0, GROUND); SK.c.forEach((col, i) => sky.addColorStop(i / 3, rgb(col))); c.fillStyle = sky; c.fillRect(0, TH_Y0, W, GROUND - TH_Y0);
    const La = LAYERS[z], L = LMK[AREA_SIG[M.AREAS[z].id]];
    if (La.far) La.far(c);
    if (L && L.r && L.lay === 'far') L.draw(c, W * 0.64, L.s * 0.92);
    if (La.midfar) La.midfar(c);
    if (L && L.r && L.lay === 'midfar') L.draw(c, W * 0.62, L.s * 0.95);
    if (La.mid) La.mid(c);
    if (L && !L.r) { c.save(); c.translate(W * 0.56, 0); if (L.draw) L.draw(c); c.restore(); if (L.live) L.live(c, W * 0.56); }
    for (let x = 0; x < W; x += GP[z]) { c.save(); c.translate(x, 0); groundTile(c, z); c.restore(); }
    if (La.near) La.near(c);
  } finally { W = keep.W; worldX = keep.worldX; SK = keep.SK; lights = keep.lights; }
  THUMBS.set(key, cnv); return cnv;
}
// mouse users can drag the strip and scroll it with the wheel; on touch screens it swipes natively
function dragScroll(row) {
  if (row.dataset.drag) return; row.dataset.drag = 1; let x0 = 0, s0 = 0, down = false;
  row.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') return; down = true; row.moved = false; x0 = e.clientX; s0 = row.scrollLeft; });
  addEventListener('pointermove', e => { if (!down) return; const dx = e.clientX - x0; if (Math.abs(dx) > 5) row.moved = true; if (row.moved) row.scrollLeft = s0 - dx; });
  addEventListener('pointerup', () => { down = false; setTimeout(() => { row.moved = false; }, 0); });
  row.addEventListener('wheel', e => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { row.scrollLeft += e.deltaY; e.preventDefault(); } }, { passive: false });
}
function renderMenu() {
  syncCoins(); $('avName').textContent = kname();
  document.querySelectorAll('.multVal').forEach(e => { e.textContent = T('multPill', M.mult()); });
  const sr2 = $('startRow'), cur = M.startArea(), keepX = sr2.scrollLeft, first = !sr2.childElementCount; sr2.innerHTML = ''; dragScroll(sr2);
  const got = M.data().route.stops;
  M.AREAS.forEach((a, i) => { // every area, so the whole route is in view; the ones not reached yet are greyed with a lock
    const open = M.areaOpen(i), on = i === cur, end = i + 1 < M.AREAS.length ? M.AREAS[i + 1].at : M.ROUTE_END;
    const stops = M.STOPS.filter(s2 => s2.m >= a.at && s2.m < end), have = stops.filter(s2 => got[s2.id]).length;
    const b = el('button', 'area-card' + (open ? '' : ' shut') + (on ? ' on' : '')); b.type = 'button'; b.setAttribute('aria-pressed', on ? 'true' : 'false');
    b.setAttribute('aria-label', T('zn_' + a.id) + (open ? '' : ' ' + T('areaLocked', a.at / 1000)));
    const pic = mk(TH_W, TH_H); pic.setAttribute('aria-hidden', 'true'); b.appendChild(pic);
    const fill = () => pic.getContext('2d').drawImage(areaThumb(i), 0, 0);
    if (THUMBS.has(i + ':' + getLang())) fill(); else setTimeout(fill, 30 + i * 40); // draw the pictures a few at a time, after the menu is up
    if (!open) { const lk = el('span', 'lock'); lk.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>'; b.appendChild(lk); }
    b.appendChild(el('b', null, T('zn_' + a.id)));
    b.appendChild(el('small', null, open ? T('km', a.at / 1000) + ' · ' + T('pcShort', have, stops.length) : T('areaLocked', a.at / 1000)));
    b.onclick = () => { if (!open || sr2.moved) return; if (M.setStart(i) && st === 'menu') { startM = a.at; reset(); worldX = 0; zoneNow = zoneAt(startM); showBanner(zoneNow); } renderMenu(); };
    sr2.appendChild(b);
  });
  if (first) requestAnimationFrame(() => { const c2 = sr2.children[cur]; if (c2) sr2.scrollLeft += c2.getBoundingClientRect().left - sr2.getBoundingClientRect().left - 8; });
  else sr2.scrollLeft = keepX;
  $('journeyLine').textContent = T('journey', kmTxt(Math.min(RL, M.data().route.best)), M.postcards(), M.STOPS.length);
  const hk = document.querySelector('.chase span:last-child'); if (hk) hk.textContent = kname();
  const D = M.data(), row = $('boostRow'); row.innerHTML = '';
  const ids = ['vimto', 'magnet', 'headstart', 'shield'].filter(id => (D.boosters[id] || 0) > 0);
  if (!ids.length) { const g = el('button', 'boost-none', T('noBoosters')); g.type = 'button'; g.onclick = () => openSheet('shop'); row.appendChild(g); }
  for (const id of ids) {
    const b = el('button', 'boost'); b.type = 'button'; b.setAttribute('aria-pressed', selBoost.has(id) ? 'true' : 'false');
    const cnv = mk(52, 52); drawBoosterIcon(cnv.getContext('2d'), id, 52); b.appendChild(cnv); b.append(T('bo_' + id)); b.appendChild(el('small', null, '×' + D.boosters[id]));
    b.onclick = () => { if (selBoost.has(id)) selBoost.delete(id); else selBoost.add(id); renderMenu(); }; row.appendChild(b);
  }
  $('dotMissions').hidden = !(M.missionsReady() > 0 || M.loginStatus().canClaim);
  showBest();
}
let sheetKind = null;
function openSheet(kind) {
  const body = $('sheetBody'); if (kind !== sheetKind) body.scrollTop = 0; sheetKind = kind; body.innerHTML = ''; $('sheet').hidden = false; syncCoins();
  $('sheetTitle').textContent = T({ wardrobe: 'w_title', shop: 'shopTitle', badges: 'bg_title', missions: 'ms_title', help: 'help_title' }[kind]);
  ({ wardrobe: sheetWardrobe, shop: sheetShop, badges: sheetBadges, missions: sheetMissions, help: sheetHelp })[kind](body);
}
function closeSheet() { $('sheet').hidden = true; sheetKind = null; renderMenu(); }
function card(draw, name, sub, btn, on, locked) {
  const c = el('div', 'card' + (on ? ' on' : '') + (locked ? ' locked' : '')); const cnv = mk(192, 192); draw(cnv); c.appendChild(cnv);
  c.appendChild(el('b', null, name)); if (sub) c.appendChild(el('small', null, sub));
  if (btn) { const b = el('button', btn.cls || '', btn.text); b.type = 'button'; b.disabled = !!btn.disabled; if (btn.onClick) b.onclick = btn.onClick; c.appendChild(b); }
  return c;
}
function buyOrEquip(kind, id) {
  const D = M.data();
  if (!D.owned[kind].includes(id)) { if (!M.buy(kind, id)) { note(T('notEnough')); return; } note(T('bought')); }
  M.equip(kind, id); openSheet('wardrobe');
}
function sheetWardrobe(body) {
  const D = M.data(), girl = isGirl();
  // who you play as: Abood, or Mozah once she is unlocked. The sections below show only that character's outfits.
  body.appendChild(el('p', 'sec-title', T('w_char'))); const cg = el('div', 'cards chars');
  for (const ch of M.CHARS) {
    const on = D.char === ch, locked = ch === 'mozah' && !M.girlOpen(), her = ch === 'mozah', fit = M.outfitOf(ch);
    const sub = locked ? T('w_lock', Math.min(M.missionsDone(), M.GIRL_MISSIONS), M.GIRL_MISSIONS) : null;
    cg.appendChild(card(cnv => drawAvatar(cnv, lookOf(fit.robe, fit.head, her), 0.6, 'grin', true), T('ch_' + ch), sub,
      { text: on ? T(her ? 'w_playing' : 'w_playingB') : locked ? T('bg_locked') : T(her ? 'w_pick' : 'w_pickB'), cls: on ? 'sec' : '', disabled: on || locked,
        onClick: () => { if (M.setChar(ch)) { syncChar(); sfx.power(); openSheet('wardrobe'); } } }, on, locked));
  }
  body.appendChild(cg);
  body.appendChild(el('p', 'hint', T('w_note')));
  const section = (title, list, kind, lookFor) => {
    list = list.filter(it => M.fits(it, D.char)); if (!list.length) return;
    body.appendChild(el('p', 'sec-title', T(title))); const g = el('div', 'cards');
    for (const it of list) {
      const owned = D.owned[kind].includes(it.id), on = D[kind] === it.id, locked = it.badge && !owned;
      const sub = [locked ? T('badgeOnly') : null, it.perk ? T(it.perk) : !it.price && !it.badge ? T('free') : null].filter(Boolean).join(' · ') || null;
      const c2 = card(cnv => drawAvatar(cnv, lookFor(it.id), 0.6, 'grin', true), T((kind === 'head' ? 'h_' : 'r_') + it.id), sub,
        { text: on ? T('wearing') : owned ? T('wear') : locked ? T('bg_locked') : T('buy', it.price), cls: owned ? 'sec' : '', disabled: on || locked, onClick: () => buyOrEquip(kind, it.id) }, on, locked);
      if (it.perk) c2.classList.add('perk'); g.appendChild(c2);
    }
    body.appendChild(g);
  };
  const robe = id => lookOf(id, D.head, girl), head = id => lookOf(D.robe, id, girl);
  section(girl ? 'w_dresses' : 'w_robes', M.ROBES.filter(r => !r.kit && !r.swim && !r.sport), 'robe', robe);
  section('w_swim', M.ROBES.filter(r => r.swim), 'robe', robe);
  section('w_kits', M.ROBES.filter(r => r.kit || r.sport), 'robe', robe);
  section('w_heads', M.HEADS, 'head', head);
}
// the playing character changed: Baba's lines, titles and names switch to match
function syncChar() { setGirl(isGirl()); applyLang(); renderMenu(); }
function sheetShop(body) {
  body.appendChild(el('p', 'hint', T('shopNote'))); const D = M.data();
  body.appendChild(el('p', 'sec-title', T('up_title'))); body.appendChild(el('p', 'hint', T('up_note')));
  const ug = el('div', 'cards');
  for (const u of M.UPGRADES) {
    const k = M.upLevel(u.id), max = k >= M.UP_MAX, now = M.powerTime(u.id), nxt = Math.round(u.base * (1 + 0.15 * (k + 1)) * 10) / 10;
    const c2 = card(cnv => { const c = cnv.getContext('2d'); c.setTransform(192 / 40, 0, 0, 192 / 40, 0, 0); drawItem(c, u.id, 20, 20, 1, true); }, T('it_' + u.id),
      T('up_lv', k, M.UP_MAX) + ' · ' + (max ? now + T('sec') : T('up_secs', now, nxt)),
      { text: max ? T('up_max') : T('buy', M.UP_PRICE[k]), disabled: max, onClick: () => { if (M.buyUpgrade(u.id)) { note(T('bought')); sfx.power(); openSheet('shop'); } else note(T('notEnough')); } });
    const pips = el('div', 'pips'); for (let i = 0; i < M.UP_MAX; i++) pips.appendChild(el('i', i < k ? 'on' : '')); c2.insertBefore(pips, c2.querySelector('button'));
    ug.appendChild(c2);
  }
  body.appendChild(ug);
  body.appendChild(el('p', 'sec-title', T('sh_boosters'))); const g = el('div', 'cards');
  for (const b of M.BOOSTERS) g.appendChild(card(cnv => drawBoosterIcon(cnv.getContext('2d'), b.id, 192), T('bo_' + b.id), T('bo_' + b.id + '_d') + ' · ' + T('have', D.boosters[b.id] || 0),
    { text: T('buy', b.price), onClick: () => { if (M.buy('booster', b.id)) { note(T('bought')); openSheet('shop'); } else note(T('notEnough')); } }));
  body.appendChild(g);
}
function sheetBadges(body) {
  const D = M.data(), tiersGot = M.BADGE_CATS.reduce((a, c) => a + M.tierOf(c.id), 0), specialsGot = M.BADGES.filter(b => D.badges[b.id]).length;
  body.appendChild(el('p', 'sec-title', T('bg_count', tiersGot + specialsGot, M.BADGE_CATS.length * 3 + M.BADGES.length)));
  body.appendChild(el('p', 'hint', T('bg_tiered')));
  const g = el('div', 'cards');
  for (const c of M.BADGE_CATS) {
    const k = M.tierOf(c.id), done = k >= 3, cur = c.stat(D.stats);
    const sub = (done ? T('tier_all') : T('bc_' + c.id + '_d', c.goals[k]) + ' · ' + T('bg_reward', M.TIER_REWARD[k])) + ' · ' + T(k ? 'tier_' + (k - 1) : 'tier_none');
    const cardEl = card(cnv => drawMedal(cnv.getContext('2d'), c.id, k - 1, 192), T('bc_' + c.id), sub, null, false, k === 0);
    if (!done) { const pr = el('div', 'prog'); pr.style.width = '100%'; const f = el('i'); f.style.width = Math.min(100, cur / c.goals[k] * 100) + '%'; pr.appendChild(f); cardEl.appendChild(pr); cardEl.appendChild(el('small', null, T('bg_prog', Math.min(cur, c.goals[k]), c.goals[k]))); }
    g.appendChild(cardEl);
  }
  for (const b of M.BADGES) { const on = !!D.badges[b.id];
    g.appendChild(card(cnv => drawMedal(cnv.getContext('2d'), b.id, on ? 2 : -1, 192), T('bg_' + b.id), T('bg_' + b.id + '_d') + ' · ' + T('bg_reward', b.reward) + (on ? ' ✓' : ''), null, false, !on)); }
  body.appendChild(g);
}
function loginRow(wrap) {
  const st2 = M.loginStatus(), cur = st2.canClaim ? st2.streak : M.data().login.streak; wrap.innerHTML = '';
  M.LOGIN.forEach((r, k) => { const today = st2.canClaim && k + 1 === Math.min(cur, M.LOGIN.length); const d = el('div', today ? 'today' : (k + 1 < cur || (!st2.canClaim && k + 1 <= cur)) ? 'done' : ''); d.appendChild(el('span', null, T('lg_day', k + 1))); d.appendChild(el('b', null, String(r))); wrap.appendChild(d); });
}
function sheetMissions(body) {
  const st2 = M.loginStatus();
  body.appendChild(el('p', 'sec-title', T('lg_title'))); const days = el('div', 'login-days'); loginRow(days); body.appendChild(days);
  if (st2.canClaim) { const b = el('button', 'btn', T('lg_claim', st2.reward)); b.type = 'button'; b.onclick = () => { const got = M.claimLogin(); note(T('coins', '+' + got)); openSheet('missions'); }; body.appendChild(b); }
  else body.appendChild(el('p', 'hint', T('lg_done')));
  const L = M.ensureLadder();
  const head = el('div', 'ladder-head'); head.appendChild(el('p', 'sec-title', T('ms_ladder', L.lv))); head.appendChild(el('span', 'multpill', T('multPill', M.mult()))); body.appendChild(head);
  body.appendChild(el('p', 'hint', T('ms_ladderNote', M.mult(), M.nextMult(), M.ladderReward(L.lv))));
  L.missions.forEach((m, i) => {
    const row = el('div', 'mission' + (m.done ? ' done' : '')); const txt = el('div'); txt.appendChild(el('b', null, T('ms_' + m.kind, m.goal))); txt.appendChild(el('div', 'hint', m.done ? T('ms_wait') : T('bg_prog', Math.min(m.progress, m.goal), m.goal))); row.appendChild(txt);
    const b = el('button', 'skip', m.done ? T('ms_done') : T('skip', M.skipPrice())); b.type = 'button'; b.disabled = m.done;
    b.onclick = () => { if (M.skipLadder(i)) openSheet('missions'); else note(T('notEnough')); }; row.appendChild(b);
    const pr = el('div', 'prog'); const fill = el('i'); fill.style.width = Math.min(100, m.progress / m.goal * 100) + '%'; pr.appendChild(fill); row.appendChild(pr);
    body.appendChild(row);
  });
  body.appendChild(el('p', 'sec-title', T('ms_daily'))); body.appendChild(el('p', 'hint', T('ms_note')));
  const bon = el('p', 'label', (M.ensureDaily().bonus ? '✓ ' : '') + T('ms_bonus', M.DAILY_BONUS)); body.appendChild(bon);
  M.ensureDaily().missions.forEach((m, i) => {
    const row = el('div', 'mission'); const txt = el('div'); txt.appendChild(el('b', null, T('ms_' + m.kind, m.goal))); txt.appendChild(el('div', 'hint', T('bg_reward', m.reward) + ' · ' + T('bg_prog', Math.min(m.progress, m.goal), m.goal))); row.appendChild(txt);
    const b = el('button', null, m.claimed ? T('claimed') : T('claim')); b.type = 'button'; b.disabled = m.claimed || m.progress < m.goal;
    b.onclick = () => { const got = M.claimMission(i); if (got) note(T('coins', '+' + got)); openSheet('missions'); }; row.appendChild(b);
    const pr = el('div', 'prog'); const fill = el('i'); fill.style.width = Math.min(100, m.progress / m.goal * 100) + '%'; pr.appendChild(fill); row.appendChild(pr);
    body.appendChild(row);
  });
}
function sheetHelp(body) {
  body.appendChild(el('p', null, T('hint')));
  body.appendChild(el('p', null, T('help_focus')));
  body.appendChild(el('p', null, T('help_route')));
  body.appendChild(el('p', null, T('help_swap')));
  const pv = el('div', 'help-privacy'); pv.appendChild(el('p', null, T('help_privacy')));
  if (M.data().mp && M.data().mp.ok) { const b = el('button', 'ghost', T('help_privacyReset')); b.type = 'button'; b.onclick = () => { delete M.data().mp.ok; M.save(); b.remove(); }; pv.appendChild(b); }
  body.appendChild(pv);
  const g = el('div', 'cards');
  for (const k of ['vimto', 'marbles', 'phone', 'scooter', 'magnet', 'sandal']) g.appendChild(card(cnv => { const c = cnv.getContext('2d'); c.setTransform(192 / 40, 0, 0, 192 / 40, 0, 0); drawItem(c, k, 20, 20, 1, true); }, T('it_' + k), T('it_' + k + '_d')));
  body.appendChild(g);
}
let loginShown = false;
function maybeLogin() {
  if (loginShown) return; const st2 = M.loginStatus(); if (!st2.canClaim) return; loginShown = true;
  loginRow($('loginDays')); $('loginStreak').textContent = T('lg_streak', st2.streak); $('loginClaim').textContent = T('lg_claim', st2.reward); $('loginPop').hidden = false;
}
$('loginClaim').onclick = () => { const got = M.claimLogin(); $('loginPop').hidden = true; note(T('coins', '+' + got)); renderMenu(); };

// ---------- frame loop + automatic quality ----------
let last = 0, fAcc = 0, fN = 0, slowWins = 0, running = false;
function perf(raw) {
  if (st !== 'play' || raw > 0.1) return;
  fAcc += raw; fN++;
  if (fN >= 90) { const avg = fAcc / fN; fAcc = 0; fN = 0;
    if (avg > 1 / 42) { if (++slowWins >= 2 && qLevel < QDPR.length - 1) { qLevel++; slowWins = 0; resize(); } } else slowWins = 0; }
}
// Frame cap: at most 60 frames a second in a run and 30 behind the menus, pause and results card. Phones with
// 120 Hz screens would otherwise draw twice as many frames as needed, which runs them hot.
let nextDue = 0;
function loop(now) {
  requestAnimationFrame(loop);
  const gap = 1000 / (st === 'play' ? 60 : 30);
  if (now < nextDue - 2) return;
  nextDue = now - nextDue > gap ? now + gap : nextDue + gap;
  const raw = last ? (now - last) / 1000 : 0.016; last = now;
  perf(raw); update(clamp(raw, 0, 0.033)); render(); stepSwap(clamp(raw, 0, 0.05));
  if (!$('menu').hidden) drawAvatar($('avMenu'), kidBase(), t * 8, kid.sayT > 0 ? 'tongue' : 'grin', false);
  else if (!$('over').hidden) drawAvatar($('avOver'), kidBase(), t * 3, 'o', true);
  if (!$('friend').hidden && race && race.fs === 'connecting') friendLoad();
  if (!$('friend').hidden && race && race.opp.here) { drawAvatar($('avMe'), kidBase(), t * 8, 'grin', false); drawAvatar($('avOpp'), oppLook(), t * 8 + 1, 'grin', false); }
}

// ---------- service worker / updates ----------
let updateReady = false;
function maybeToast() { if (updateReady && st !== 'play') $('toast').hidden = false; }
$('toastBtn').onclick = () => location.reload();
function registerSW() {
  try {
    if (!('serviceWorker' in navigator) || !location.protocol.startsWith('http')) return;
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('./sw.js').catch(() => {});
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController) { updateReady = true; maybeToast(); } });
  } catch (e) { /* sandboxed frames refuse service workers; the game still runs */ }
}

// ---------- boot / loading screen ----------
const nextFrame = () => new Promise(r => requestAnimationFrame(() => r()));
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ldShown = 0, ldTarget = 0, ldRun = true;
function setLoad(p, msgKey) { ldTarget = p; if (msgKey) $('ldMsg').textContent = T(msgKey); }
function loaderLoop(now) {
  if (!ldRun) return;
  ldShown += (ldTarget - ldShown) * 0.2;
  $('ldFill').style.transform = 'scaleX(' + ldShown.toFixed(3) + ')';
  $('ldPct').textContent = Math.round(ldShown * 100) + '%';
  const c = $('ldCv').getContext('2d'), tt = now / 1000; t = tt;
  c.setTransform(2, 0, 0, 2, 0, 0); c.clearRect(0, 0, 240, 150);
  c.fillStyle = 'rgba(255,240,220,.22)';
  for (let k = 0; k < 9; k++) { const bw = 12 + (k * 7) % 11, bh = 26 + (k * 37) % 46; c.fillRect(8 + k * 26, 128 - bh, bw, bh); }
  let yy = 128; for (const [w2, h2] of [[16, 16], [13, 14], [10, 12], [7, 10], [4, 10]]) { c.fillRect(150 - w2 / 2, yy - h2, w2, h2); yy -= h2; } c.fillRect(149, yy - 14, 2, 14);
  c.beginPath(); c.moveTo(52, 128); c.lineTo(54, 74); c.quadraticCurveTo(76, 96, 72, 128); c.fill();
  c.fillStyle = 'rgba(43,26,18,.35)'; c.fillRect(10, 128, 220, 3);
  c.fillStyle = 'rgba(0,0,0,.2)'; c.beginPath(); c.ellipse(70, 130, 18, 3, 0, 0, TAU); c.ellipse(170, 130, 12, 3, 0, 0, TAU); c.fill();
  person(c, 70 + Math.sin(tt * 1.3) * 6, 128, tt * 10, false, { s: 1.15, skin: '#b97a4c', skinD: '#956039', skinL: '#cf9465', scarf: '#f4f3ee', fringe: '#dcd8cc', lean: 0.11, beard: 1, belly: 4, angry: 1, messy: 1, agalTilt: 0.32, agalY: -1, flap: 1.8, droop: 6, mouth: 'shout', arm: 'slipper' });
  person(c, 170, 128, tt * 11, false, Object.assign(kidBase(), { s: 1.05, mouth: 'tongue' }));
  requestAnimationFrame(loaderLoop);
}
async function prebake() {
  sprBudget = Infinity; const jobs = [];
  for (let i = 0; i < PHN; i++) {
    jobs.push(() => kidFrame('grin', false, false, i));
    jobs.push(() => dadFrame('slipper', 'shout', 0, false, false, false, true, false, i));
    jobs.push(() => dadFrame('slipper', 'talk', 0, false, false, false, true, false, i));
  }
  jobs.push(() => kidFrame('grin', true, false, 0), () => dadFrame('slipper', 'talk', 0, false, true, false, true, false, 0));
  for (let z = 0; z < GL.length; z++) jobs.push(() => getTile(GL[z], 0, true));
  for (let j = 0; j < jobs.length; j++) { jobs[j](); if (j % 6 === 5) { setLoad(0.62 + 0.3 * j / jobs.length); await nextFrame(); } }
  sprBudget = 0;
}
async function boot() {
  setGirl(isGirl()); applyLang(); setMuteBtn(); syncRotate(); showBest();
  const tips = T('tips'); let tipI = Math.floor(Math.random() * tips.length); $('ldTip').textContent = tips[tipI];
  const tipTimer = setInterval(() => { tipI = (tipI + 1) % tips.length; $('ldTip').textContent = T('tips')[tipI]; }, 2200);
  M.ensureDaily();
  resize(); requestAnimationFrame(loaderLoop);
  setLoad(0.08, 'ld_fonts');
  try { await Promise.race([Promise.all(['500', '700', '800'].map(w => document.fonts.load(w + ' 20px "Baloo Bhaijaan 2"', 'عبود Abood'))), sleep(3000)]); } catch (e) {}
  setLoad(0.35, 'ld_sound');
  try { await initAudio(); } catch (e) {}
  setLoad(0.6, 'ld_art');
  try { await prebake(); } catch (e) { sprBudget = 0; }
  setLoad(0.96, 'ld_cache'); registerSW(); await sleep(120);
  setLoad(1, 'ready'); await sleep(280);
  clearInterval(tipTimer); ldRun = false; $('loader').classList.add('done'); setTimeout(() => { $('loader').hidden = true; }, 500);
  $('mute').hidden = false;
  if (!(race && (st === 'play' || st === 'over'))) { // a race that started while the game was still loading keeps going
    startM = M.AREAS[M.startArea()].at; reset(); st = 'menu'; t = 0;
    if (hasStoredLang()) showMenu(); else $('langPick').hidden = false;
  }
  if (!running) { running = true; requestAnimationFrame(loop); }
}

// test / tooling hook
window.__abood = {
  get say() { return dad.sayT > 0 ? dad.say : ''; },
  get state() { return { genAhead: Math.round(genX - worldX), obs: obs.length, items: items.length, gaps: gaps.length, paceT, assist: +assist.toFixed(2), mercyT, st, dist, lead, zone: zoneNow, qLevel, res: RES, bakeRes, tiles: TILES.size, sprites: SPR.size, build: BUILD }; },
  // goto(run metres, route metres?): jump within a run; with a second number, also move along the route
  goto: (d, r) => { if (r != null) startM = r - d; worldX = d * 40; dist = d; routeM = startM + d; zoneNow = zoneAt(routeM); genX = worldX + 500; gaps = []; obs = []; items = []; plats = []; lead = 0.6;
    nextStop = stopAfter(routeM); prevStopAt = routeM; },
  route: r => { startM = r - dist; routeM = r; },
  set: o => { if (o.sweets != null) candies = o.sweets; if (o.lead != null) lead = o.lead; if (o.hits != null) closeCalls = o.hits; if (o.inv != null) kid.inv = o.inv; },
  spawn: (kind, ahead = 320) => { if (OB[kind]) addObs(worldX + ahead, kind); }, // put an obstacle in front of Abood
  get grace() { return +graceT.toFixed(2); },
  // the course ahead, to check that both players in a race get the same one
  get course() { return { obs: obs.map(o => o.kind + '@' + Math.round(o.x0)), gaps: gaps.map(g => Math.round(g.x0)), plats: plats.map(p => Math.round(p.x)), items: items.filter(i => i.kind !== 'candy').map(i => i.kind + '@' + Math.round(i.x)) }; },
  ghost: (m = 3, air = false) => { if (!race) return; const t0 = performance.now() - 400; Object.assign(race.opp, { here: true, run: true, out: false, gone: false, lost: false, round: race.seed, buf: [0, 1].map(i => ({ t: t0 + i * 300, x: worldX + m * 40 + i * 4, y: air ? GROUND - 80 : GROUND, a: air, sc: false })) }); }, // put the friend's ghost m metres ahead
  raceTime: sec => { if (race) race.runT = sec; }, // testing: jump the race clock
  tick: (sec, dt = 1 / 30) => { for (let i = 0; i < Math.round(sec / dt); i++) update(dt); }, // testing: run the game without frames (a hidden tab gets none)
  dropNet: () => N.testDrop(), // testing: cut the race connection as if the network failed
  get race() { return race && { role: race.role, fs: race.fs, seed: race.seed, area: race.area, hold: race.hold, me: race.me, opp: Object.assign({}, race.opp) }; },
  quality: q => { qLevel = clamp(q, 0, QDPR.length - 1); resize(); },
  portrait: (size, pad = 1) => {
    const c = mk(size, size), g = c.getContext('2d'), bg = g.createLinearGradient(0, 0, 0, size);
    bg.addColorStop(0, '#7d3f6b'); bg.addColorStop(0.55, '#e2735b'); bg.addColorStop(1, '#f7c070'); g.fillStyle = bg; g.fillRect(0, 0, size, size);
    const s = size / 46 * pad; g.save(); g.translate(size * 0.5 - 2 * s, size * 0.58 + 50 * s); g.scale(s, s);
    person(g, 0, 0, 0.6, false, Object.assign(kidBase(), { s: 1, mouth: 'tongue', still: true, baked: true })); g.restore();
    return c.toDataURL('image/png');
  },
};

boot();
