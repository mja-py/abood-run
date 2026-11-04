// Run, Abood! — اركض يا عبود
// Canvas endless runner. Characters and scenery are drawn in code, then baked into cached
// sprite frames and background tiles so phones only blit images each frame.
import { T, getLang, applyLang, setLang, onLang, hasStoredLang, FLAG } from './i18n.js?v=__BUILD__';
import * as M from './meta.js?v=__BUILD__';

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
if (window.ResizeObserver) new ResizeObserver(() => { clearTimeout(rzT); rzT = setTimeout(resize, 60); }).observe(cv);

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
const pcb = mk(6, 6);
{ const p = pcb.getContext('2d'); p.fillStyle = '#26232a'; p.fillRect(0, 0, 6, 6); p.fillStyle = '#f4f1ea'; p.fillRect(0, 0, 2, 2); p.fillRect(3, 3, 2, 2); }
const SHEMAGH_B = ctx.createPattern(pcb, 'repeat');
let PITG = null;

// ---------- zones ----------
const ZLEN = 450; // metres per neighbourhood
const ZONES = [
  { en: 'Jumeirah', ar: 'جميرا', obs: ['crab', 'cooler', 'ball', 'castle', 'cone', 'escooter'], plat: 'plank' },
  { en: 'Downtown Dubai', ar: 'وسط مدينة دبي', obs: ['escooter', 'cone', 'dbag', 'dbike', 'flower', 'box'], plat: ['#1f7a74', '#e8f1f2'] },
  { en: 'Al Mamzar Park', ar: 'حديقة الممزر', obs: ['basket', 'ball', 'crab', 'cooler', 'cat', 'castle'], plat: 'pergola' },
  { en: 'Sharjah Old Souq', ar: 'سوق الشارقة القديم', obs: ['sack', 'carpet', 'dallah', 'cat', 'box', 'wood'], plat: ['#a8322d', '#f6e3b4'] },
];
const zoneOfM = m => Math.floor(Math.max(0, m) / ZLEN) % ZONES.length;

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
let st = 'boot', t = 0, stT = 0, worldX = 0, speed = 320, lead = 0.6, dist = 0, candies = 0, candyCount = 0, boost = 0, shake = 0, camZ = 1;
let combo = 0, comboT = 0, closeCalls = 0, zoneNow = 0, banner = null;
let gaps = [], plats = [], obs = [], items = [], parts = [], sandals = [], birds = [], sandMotes = [], genX = 0, holding = false;
const kid = { y: GROUND, vy: 0, on: true, jumps: 0, coyote: 0, buf: 0, inv: 0, stumble: 0, ph: 0, sx: 1, sy: 1, spin: 0, scoot: 0, mag: 0, say: '', sayT: 0, next: 5 };
const dad = { y: GROUND, vy: 0, on: true, ph: 0, slow: 0, freeze: 0, say: '', sayT: 0, next: 1.5, wx: 0, anger: 0, windup: 0, cd: 8, has: true, regrab: 0 };
let best = 0; try { best = +localStorage.getItem('abood-best') || 0; } catch (e) {}
try { muted = localStorage.getItem('abood-muted') === '1'; } catch (e) {}

function reset() {
  t = 0; worldX = 0; lead = 0.6; dist = 0; candies = 0; candyCount = 0; boost = 0; shake = 0; camZ = 1; combo = 0; comboT = 0; closeCalls = 0; zoneNow = 0; banner = null;
  gaps = []; plats = []; obs = []; items = []; parts = []; sandals = []; genX = 900;
  Object.assign(kid, { y: GROUND, vy: 0, on: true, jumps: 0, coyote: 0, buf: 0, inv: 0, stumble: 0, sx: 1, sy: 1, spin: 0, scoot: 0, mag: 0, shield: 0, say: '', sayT: 0, next: 6 });
  Object.assign(dad, { y: GROUND, vy: 0, on: true, slow: 0, freeze: 0, say: T('s_come'), sayT: 2, next: 3, anger: 0, windup: 0, cd: 9, has: true, regrab: 0 });
}

// ---------- level generation ----------
const OB = { box: { w: 34, h: 32 }, bin: { w: 30, h: 46 }, cat: { w: 34, h: 30 }, cone: { w: 24, h: 36 }, goat: { w: 44, h: 38, vx: -45 }, ball: { w: 22, h: 22, bounce: 1, vx: -60 },
  sack: { w: 30, h: 36 }, carpet: { w: 58, h: 20 }, crab: { w: 30, h: 18, side: 1 }, cooler: { w: 40, h: 30 }, rock: { w: 42, h: 28 }, bush: { w: 38, h: 30 }, lizard: { w: 46, h: 14, vx: -110 },
  bike: { w: 44, h: 30 }, gas: { w: 22, h: 36 }, dbag: { w: 32, h: 30 }, dbike: { w: 54, h: 46, vx: -170 }, crate: { w: 32, h: 40 }, chairs: { w: 30, h: 46 },
  castle: { w: 40, h: 28 }, escooter: { w: 40, h: 38 }, basket: { w: 32, h: 24 }, flower: { w: 30, h: 32 }, dallah: { w: 28, h: 34 }, wood: { w: 44, h: 20 }, buggy: { w: 58, h: 38, vx: -150 } };
function addObs(x, k) { obs.push({ x, x0: x, kind: k, w: OB[k].w, h: OB[k].h, hit: false, hx: 0, hy: 0, rot: 0, ph: 0, lift: 0, clear: 999, passed: false, seed: Math.random() * 6 }); }
function candyArc(x0, x1, yBase, h) { const n = Math.max(3, Math.round((x1 - x0) / 36)); for (let i = 0; i < n; i++) { const f = i / (n - 1); items.push({ x: x0 + (x1 - x0) * f, y: yBase - Math.sin(f * Math.PI) * h, kind: 'candy', c: i }); } }
function power() { const r = Math.random(); return r < 0.24 ? 'vimto' : r < 0.46 ? 'marbles' : r < 0.62 ? 'phone' : r < 0.82 ? 'magnet' : 'scooter'; }
function gen() {
  while (genX < worldX + W + 400) {
    const z = ZONES[zoneOfM(genX / 40)], r = Math.random(), hard = Math.min(1, dist / 1500);
    if (r < 0.34) {
      const k = pick(z.obs); addObs(genX, k);
      if (Math.random() < 0.5) candyArc(genX - 50, genX + OB[k].w + 50, GROUND - 50, 62);
      if (Math.random() < 0.2 + hard * 0.35) { addObs(genX + rnd(200, 250), pick(z.obs)); genX += 240; }
      genX += rnd(270, 450);
    } else if (r < 0.52) {
      const w = rnd(90, 118 + hard * 50); gaps.push({ x0: genX, x1: genX + w });
      candyArc(genX - 30, genX + w + 30, GROUND - 60, 72); genX += w + rnd(250, 340);
    } else if (r < 0.72) {
      const w = rnd(170, 260), y = GROUND - rnd(85, 120); plats.push({ x: genX, y, w, z: zoneOfM(genX / 40) });
      if (Math.random() < 0.4) { const gw = Math.min(w - 40, rnd(90, 140)); gaps.push({ x0: genX + 20, x1: genX + 20 + gw }); }
      if (Math.random() < 0.4) items.push({ x: genX + w / 2, y: y - 34, kind: power() });
      else for (let x = genX + 24; x < genX + w - 10; x += 34) items.push({ x, y: y - 26, kind: 'candy', c: x });
      genX += w + rnd(230, 320);
    } else if (r < 0.88) {
      const jar = Math.random() < 0.18;
      for (let i = 0; i < 6; i++) items.push({ x: genX + i * 34, y: GROUND - 26 - (i === 5 && jar ? 30 : 0), kind: i === 5 && jar ? 'jar' : 'candy', c: i }); genX += rnd(280, 360);
    } else {
      items.push({ x: genX, y: GROUND - 74, kind: power() }); genX += rnd(260, 340);
    }
  }
  const cut = worldX - ABX - 200;
  compact(gaps, g => g.x1 > cut); compact(plats, p => p.x + p.w > cut); compact(obs, o => o.x + o.hx + 80 > cut && o.hy < 300); compact(items, i => i.x > cut && !i.got);
}
const overGap = (x, m = 5) => { for (const g of gaps) if (x > g.x0 + m && x < g.x1 - m) return true; return false; };

// ---------- input ----------
function press() {
  unlockAudio();
  if (!$('langPick').hidden || !$('sheet').hidden || !$('loginPop').hidden) return;
  if (st === 'menu') { start(); return; }
  if (st === 'over') { if (stT > 0.9) start(); return; }
  if (st === 'pause') { setPause(false); return; }
  if (st === 'play') { kid.buf = 0.13; holding = true; }
}
function release() { holding = false; }
const isUI = e => e.target && e.target.closest && e.target.closest('button, a, .panel, #toast, #sheet, #loginPop');
addEventListener('keydown', e => {
  if (['Space', 'ArrowUp', 'KeyW'].includes(e.code)) { e.preventDefault(); if (!e.repeat && !(st !== 'play' && e.target.closest && e.target.closest('button'))) press(); }
  if (e.code === 'KeyP' || e.code === 'Escape') { if (st === 'play') setPause(true); else if (st === 'pause') setPause(false); }
});
addEventListener('keyup', e => { if (['Space', 'ArrowUp', 'KeyW'].includes(e.code)) release(); });
addEventListener('pointerdown', e => { unlockAudio(); if (st === 'boot' || isUI(e)) return; press(); });
addEventListener('pointerup', release); addEventListener('pointercancel', release);
addEventListener('touchend', unlockAudio, { passive: true });
addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { if (st === 'play') setPause(true); }
  else if (st === 'play') wakeOn();
});

$('startBtn').onclick = () => { unlockAudio(); start(); };
$('againBtn').onclick = () => { unlockAudio(); start(); };
$('sheetClose').onclick = () => closeSheet();
document.querySelectorAll('[data-sheet]').forEach(b => b.onclick = () => openSheet(b.dataset.sheet));
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('.lang [data-lang]');
  if (b && b.dataset.lang !== getLang()) setLang(b.dataset.lang);
  const pk = e.target.closest && e.target.closest('[data-pick]');
  if (pk) { setLang(pk.dataset.pick); $('langPick').hidden = true; showMenu(); }
});
$('flagAr').innerHTML = FLAG.ar; $('flagEn').innerHTML = FLAG.en;
function showMenu() { $('menu').hidden = false; renderMenu(); maybeToast(); maybeLogin(); }
function setMuteBtn() { $('mute').textContent = muted ? '✕' : '♪'; $('mute').setAttribute('aria-pressed', muted ? 'true' : 'false'); }
$('mute').onclick = () => { unlockAudio(); muted = !muted; if (master) master.gain.value = muted ? 0 : 1; try { localStorage.setItem('abood-muted', muted ? '1' : '0'); } catch (e) {} setMuteBtn(); $('mute').blur(); };
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

function showBest() { const b = M.bestDist(); $('menuBest').hidden = b <= 0; if (b > 0) $('menuBest').textContent = T('best', b); }
const selBoost = new Set();
let run = null, runBadges = [], runEarned = 0, badgeTimer = 0;
function start() {
  reset(); st = 'play';
  run = { dist: 0, sweets: 0, close: 0, zoneMax: 0, paid: 0 }; runBadges = []; runEarned = 0; M.track('run');
  for (const id of selBoost) if (M.useBooster(id)) {
    if (id === 'vimto') boost = 6; if (id === 'magnet') kid.mag = 10; if (id === 'shield') kid.shield = 1;
    if (id === 'headstart') { kid.scoot = 6; lead = 0.85; }
  }
  selBoost.clear(); renderMenu(); stT = 0; $('menu').hidden = true; $('over').hidden = true; $('toast').hidden = true; $('hud').hidden = false; $('pauseBtn').hidden = false; $('pauseBtn').textContent = 'II';
  if (actx) nextNote = actx.currentTime + 0.05; step = 0; showBanner(0); wakeOn(); hudCache.fill(null);
  document.activeElement && document.activeElement.blur && document.activeElement.blur();
}
let lastOver = null;
function fillOver() {
  if (!lastOver) return; const { why, m, nb } = lastOver;
  $('overQuote').textContent = T(why === 'fell' ? 's_fell' : 's_got');
  $('overTitle').textContent = T(why === 'fell' ? 'fellT' : 'caughtT');
  $('overMsg').textContent = nb ? T('newBest') : T('beat', M.bestDist());
  $('sDist').textContent = m; $('sBest').textContent = M.bestDist(); $('sCandy').textContent = candies; $('sClose').textContent = closeCalls; $('sEarned').textContent = '+' + runEarned;
  $('avNameOver').textContent = kname();
  const strip = $('overBadges'); strip.innerHTML = '';
  if (!runBadges.length) strip.innerHTML = '<span class="hint">' + T('o_none') + '</span>';
  for (const b of runBadges) { const el = document.createElement('span'); el.className = 'badge-chip'; const cnv = mk(56, 56); drawMedal(cnv.getContext('2d'), b.id, true, 56); el.appendChild(cnv); el.append(T('bg_' + b.id) + ' · ' + T('bg_reward', b.reward)); strip.appendChild(el); }
  const rv = M.data().boosters.revive || 0; $('reviveBtn').hidden = false;
  $('reviveBtn').textContent = !run || !run.freeRevive ? T('o_reviveFree') : rv > 0 ? T('o_revive', rv) : T('o_reviveBuy', M.REVIVE_PRICE);
  syncCoins();
}
function settleRun() {
  if (!run) return null;
  run.dist = dist; run.sweets = candies; run.close = closeCalls;
  const res = M.endRun(run); runEarned += res.earned; for (const b of res.badges) runBadges.push(b); return res;
}
function gameOver(why) {
  if (st !== 'play') return; st = 'over'; stT = 0; sfx.lose(); buzz([60, 40, 120]); wakeOff();
  const res = settleRun(), m = Math.floor(dist);
  dad.say = T(why === 'fell' ? 's_fell' : 's_got'); dad.sayT = 99; kid.say = T('s_sorry'); kid.sayT = 99;
  lastOver = { why, m, nb: res && res.newBest }; fillOver(); showBest();
  $('hud').hidden = true; $('pauseBtn').hidden = true; $('powers').textContent = ''; lastHud = '';
  const showOver = () => { if (st === 'over') { $('over').hidden = false; maybeToast(); } };
  setTimeout(() => {
    // Ads hook: set window.aboodAfterRun = async ({ distance, sweets }) => { ...show an ad... }.
    // The results card appears when it finishes (or straight away if it is not set or fails).
    const hook = window.aboodAfterRun;
    if (typeof hook === 'function') Promise.resolve().then(() => hook({ distance: m, sweets: candies })).catch(() => {}).finally(showOver); else showOver();
  }, 1100);
}
function revive() {
  if (st !== 'over') return;
  // the first second chance in every run is free; after that use a bought one, or pay on the spot
  if (run && !run.freeRevive) run.freeRevive = true;
  else if (!M.useBooster('revive') && !M.spend(M.REVIVE_PRICE)) { note(T('notEnough')); return; }
  M.track('revive'); for (const b of M.checkBadges(null)) runBadges.push(b);
  st = 'play'; stT = 0; $('over').hidden = true; $('hud').hidden = false; $('pauseBtn').hidden = false; hudCache.fill(null);
  lead = 0.6; kid.y = GROUND; kid.vy = 0; kid.on = true; kid.inv = 2.5; kid.stumble = 0; kid.sayT = 0; dad.sayT = 0; dad.windup = 0; dad.cd = 6;
  compact(gaps, g => g.x1 < worldX - 60 || g.x0 > worldX + 500); compact(obs, o => o.x < worldX - 60 || o.x > worldX + 500); sandals.length = 0;
  floatText(T('f_revive'), worldX, kid.y - 80, '#9ff0ff'); wakeOn();
}
$('reviveBtn').onclick = () => { unlockAudio(); revive(); };
$('overMenuBtn').onclick = () => { st = 'menu'; $('over').hidden = true; reset(); worldX = 0; showMenu(); };
onLang(() => { if (st === 'over' && lastOver) { dad.say = T(lastOver.why === 'fell' ? 's_fell' : 's_got'); kid.say = T('s_sorry'); } else { dad.sayT = 0; kid.sayT = 0; } fillOver(); showBest(); renderMenu(); if (!$('sheet').hidden) openSheet(sheetKind); hudCache.fill(null); lastHud = ''; });
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
    worldX += 240 * dt; dist = worldX / 40; kid.ph += dt * 9; dad.ph += dt * 10; gen(); gaps.length = 0; obs.length = 0; items.length = 0; plats.length = 0;
    dad.sayT -= dt; kid.sayT -= dt; if (dad.sayT < -1.2) shout(pick(T('s_shouts')), 2); if (kid.sayT < -3 && dad.sayT < 0) kidSay(pick(T('s_taunts')), 1.6);
    zoneNow = zoneOfM(dist); return;
  }
  if (st === 'over') { updParts(dt); kid.ph += dt * 16; return; }
  if (st !== 'play') return;

  const base = 320 + Math.min(230, dist * 0.2);
  speed = base * Math.max(boost > 0 ? 1.3 : 1, kid.scoot > 0 ? 1.42 : 1) * (kid.stumble > 0 ? 0.65 : 1);
  worldX += speed * dt; dist = worldX / 40;
  const z = zoneOfM(dist); if (z !== zoneNow) { zoneNow = z; showBanner(z); sfx.zone(); lead = Math.min(1, lead + 0.05); M.track('zone', z); }
  if (run) run.zoneMax = Math.max(run.zoneMax, Math.min(3, Math.floor(dist / ZLEN)));
  badgeTimer -= dt; if (badgeTimer <= 0 && run) { badgeTimer = 1; for (const b of M.checkBadges({ dist, close: closeCalls })) { runBadges.push(b); floatText(T('f_badge', T('bg_' + b.id)), worldX + 60, 140, '#ffe066'); sfx.zone(); } }

  let dl = -(0.04 + Math.min(0.05, dist * 0.00005));
  if (dad.freeze > 0) dl = 0.12; else if (dad.slow > 0) dl = 0.065;
  if (boost > 0) dl += 0.09; if (kid.scoot > 0) dl += 0.1;
  lead = clamp(lead + dl * dt, 0, 1);

  boost = Math.max(0, boost - dt); dad.slow = Math.max(0, dad.slow - dt); dad.freeze = Math.max(0, dad.freeze - dt);
  kid.scoot = Math.max(0, kid.scoot - dt); kid.mag = Math.max(0, kid.mag - dt);
  kid.inv = Math.max(0, kid.inv - dt); kid.stumble = Math.max(0, kid.stumble - dt); shake = Math.max(0, shake - dt);
  camZ += (1 - camZ) * Math.min(1, dt * 5); comboT -= dt; if (comboT < 0) combo = 0;

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
  if (kid.y > H + 40) { gameOver('fell'); return; }

  // obstacles
  for (const o of obs) {
    const d = OB[o.kind];
    if (o.hit) { o.hx += o.hvx * dt; o.hy += o.hvy * dt; o.hvy += 1600 * dt; o.rot += dt * o.spin; continue; }
    if (d.vx) { const nx = o.x + d.vx * dt; if (!overGap(nx, 0) && !overGap(nx + o.w, 0)) o.x = nx; o.ph += dt * (o.kind === 'lizard' ? 22 : o.kind === 'dbike' || o.kind === 'buggy' ? 16 : 10); }
    if (d.side) { o.x = o.x0 + Math.sin(t * 2.4 + o.seed) * 26; o.ph += dt * 8; }
    o.lift = d.bounce ? Math.abs(Math.sin(t * 4.2 + o.seed)) * 46 : 0;
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
  if (lead <= 0) { lead = 0; gameOver('caught'); return; }

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
  if (dist > 100 && dad.cd <= 0 && dad.has && dad.freeze <= 0 && dad.slow <= 0 && dad.windup <= 0 && dad.on) { dad.windup = 0.85; shout(pick(T('s_throw')), 1.2); }
  if (dad.windup > 0) { dad.windup -= dt; if (dad.windup <= 0) { sandals.push({ sx: dadScreenX() + 16, y: GROUND - 10, age: 0, rot: 0, hit: false, passed: false }); dad.has = false; dad.regrab = 1.6; dad.cd = rnd(6.5, 10.5) - Math.min(3.5, dist / 500); sfx.whoosh(); } }
  if (!dad.has) { dad.regrab -= dt; if (dad.regrab <= 0) dad.has = true; }
  // kid chatter
  kid.sayT -= dt; kid.next -= dt;
  if (kid.next <= 0) { if (lead > 0.7) { kidSay(pick(T('s_taunts'))); dad.anger = Math.min(1, dad.anger + 0.25); } else if (lead < 0.22) kidSay(pick(T('s_scared'))); kid.next = rnd(4, 7); }

  updParts(dt); gen(); hud();
}
function land() { kid.vy = 0; kid.on = true; if (kid.jumps) puff(worldX, kid.y, 4, '#e7cfa3', 70); kid.jumps = 0; }
function knock(o, vx, vy) { o.hit = true; o.hvx = vx; o.hvy = vy; o.spin = rnd(6, 12); puff(o.x + o.w / 2, GROUND - o.h / 2, 10, '#c9a36b', 120); }
function hitKid(x, y, after) {
  if (kid.shield > 0) { kid.shield = 0; kid.inv = 1.2; after && after(); floatText(T('f_shield'), worldX, kid.y - 70, '#9fd8ff'); sfx.smash(); return; }
  kid.stumble = 0.6; kid.inv = 1.2; lead -= 0.17; shake = 0.3; sfx.hit(); buzz(50); after && after();
  puff(x, y, 6, '#ffffff', 100); parts.push({ x: worldX, y: kid.y - 64, vx: 0, vy: 0, life: 0.6, max: 0.6, stars: 1 });
  shout(pick(T('s_hit')));
}
function closeCall(x, y) { closeCalls++; M.track('close'); lead = Math.min(1, lead + 0.02); sfx.close(); floatText(T('f_close'), x, y, '#9ff0ff'); }
function grab(it) {
  if (it.kind === 'candy' || it.kind === 'jar') {
    combo = comboT > 0 ? combo + 1 : 1; comboT = 0.7; const mult = Math.min(5, 1 + Math.floor(combo / 6));
    const gain = (it.kind === 'jar' ? 15 : 1) * mult; candies += gain; candyCount += gain; M.track('sweets', gain); sfx.candy(mult); puff(it.x, it.y, 4, '#ffd34d', 60);
    parts.push({ x: it.x, y: it.y, vx: -speed * 0.2, vy: 0, life: 0.35, max: 0.35, ring: 1 });
    if (it.kind === 'jar') floatText(T('f_jar', gain), it.x, it.y - 20);
    else if (combo % 6 === 0) floatText(T('f_combo', mult), it.x, it.y - 22, '#ffb3e6');
    if (candyCount >= 10) { candyCount -= 10; lead = Math.min(1, lead + 0.06); }
    bump('candyBox'); return;
  }
  sfx.power(); puff(it.x, it.y, 16, '#fff6c2', 150); camZ = 1.05; buzz(25); M.track('power', it.kind);
  if (it.kind === 'vimto') { boost = 4; floatText(T('f_vimto'), it.x, it.y - 24); kidSay(T('s_yay'), 1.2); }
  if (it.kind === 'marbles') { dad.slow = 4.5; dad.windup = 0; shout(T('s_slip'), 2); for (let i = 0; i < 8; i++) parts.push({ x: it.x, y: GROUND - 4, vx: -rnd(250, 420), vy: -rnd(0, 120), life: 1.3, max: 1.3, col: pick(['#3fa7d6', '#f25f5c', '#7bd389', '#ffe066']), r: 3.5, marble: 1 }); floatText(T('f_slip'), it.x, it.y - 24); }
  if (it.kind === 'phone') { dad.freeze = 2.8; dad.windup = 0; shout(T('s_phone'), 2.8); floatText(T('f_phone'), it.x, it.y - 24); }
  if (it.kind === 'magnet') { kid.mag = 6; floatText(T('f_magnet'), it.x, it.y - 24); }
  if (it.kind === 'scooter') { kid.scoot = 5; floatText(T('f_scooter'), it.x, it.y - 24); kidSay(T('s_scoot'), 1.4); }
}
function bump(id) { const el = $(id); el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }
function updParts(dt) {
  for (const p of parts) { p.x += p.vx * dt; p.y += p.vy * dt; if (!p.text && !p.marble && !p.steam && !p.ring && !p.stars) p.vy += 200 * dt; if (p.marble && p.y > GROUND - 4) { p.y = GROUND - 4; p.vy *= -0.4; } p.life -= dt; }
  compact(parts, p => p.life > 0);
}
function updAmbient(dt) {
  const z = zoneOfM(dist);
  if (z === 4 && birds.length < 1 && Math.random() < dt * 0.15) birds.push({ x: W + 40, y: rnd(60, 130), vx: -rnd(30, 60), ph: 0, falcon: true });
  if (birds.length < 4 && Math.random() < dt * 0.25 && z !== 4) {
    const n = z === 0 || z === 2 ? 3 : pick([2, 3, 5]); const y = rnd(40, 150), dir = Math.random() < 0.5 ? -1 : 1;
    for (let i = 0; i < n; i++) birds.push({ x: dir > 0 ? -30 - i * 24 : W + 30 + i * 24, y: y + rnd(-14, 14), vx: dir * rnd(50, 80), ph: Math.random() * 6, gull: z === 0 || z === 2 });
  }
  for (const b of birds) { b.x += (b.vx - (st === 'play' ? speed : 240) * 0.1) * dt; b.ph += dt * 10; }
  compact(birds, b => b.x > -80 && b.x < W + 80);
  if (z === 4 && !REDUCED && sandMotes.length < 60 * FX) sandMotes.push({ x: W + rnd(0, 40), y: rnd(120, GROUND + 40), v: rnd(260, 520), l: rnd(12, 40) });
  for (const m of sandMotes) m.x -= m.v * dt; compact(sandMotes, m => m.x > -50);
}

// HUD: write to the DOM only when a value changes
const hudCache = [null, null, null, null];
let lastHud = '';
function hud() {
  const d = Math.floor(dist), lf = Math.round(lead * 200) / 200, dg = lead < 0.25;
  if (hudCache[0] !== d) { hudCache[0] = d; $('mDist').textContent = d; }
  if (hudCache[1] !== candies) { hudCache[1] = candies; $('mCandy').textContent = candies; }
  if (hudCache[2] !== lf) { hudCache[2] = lf; $('leadFill').style.transform = 'scaleX(' + lf + ')'; }
  if (hudCache[3] !== dg) { hudCache[3] = dg; $('bar').classList.toggle('danger', dg); }
  const chips = []; const ch = (k, v, m) => chips.push([T(k) + ' ' + v.toFixed(1) + T('sec'), v / m]);
  if (boost > 0) ch('c_vimto', boost, 4); if (kid.scoot > 0) ch('c_scooter', kid.scoot, 5); if (kid.mag > 0) ch('c_magnet', kid.mag, 6);
  if (dad.slow > 0) ch('c_slip', dad.slow, 4.5); if (dad.freeze > 0) ch('c_phone', dad.freeze, 2.8);
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
  c.save(); c.translate(-1, -20); limb(c, o.kick ? kick * 0.9 : still ? 0.05 : air ? 0.75 : -sw * 0.85, 19, 4.4, skinD, sandalFoot); c.restore();
  c.save(); c.translate(1, -20); limb(c, o.kick ? -kick * 0.9 : still ? -0.05 : air ? -0.55 : sw * 0.85, 19, 4.4, skin, sandalFoot); c.restore();
  let ba = still ? 0.1 : air ? -2.3 : sw * 0.9;
  if (o.arm === 'flail') ba = 2.4 + Math.sin(A * 3 + 1) * 1.1; if (o.arm === 'grip') ba = -1.1; if (o.arm === 'hold') ba = 0.35; if (o.arm === 'o') ba = -2.6 + Math.sin(A * 3) * 0.4;
  c.save(); c.translate(-1, -40); limb(c, ba, 15, 6, robeD, hand(skinD), 1); c.restore();
  // kandura: soft side shading, hem shadow, folds, collar and tassel (furakha)
  const fl = Math.sin(ph * 2) * 2 * (still ? 0 : 1), b = o.belly || 0;
  const rg = c.createLinearGradient(-14, 0, 13 + b, 0); rg.addColorStop(0, robeD); rg.addColorStop(0.5, robe); rg.addColorStop(1, robe);
  const robePath = () => { c.beginPath(); c.moveTo(-8, -44); c.quadraticCurveTo(0, -47, 8, -44);
    c.quadraticCurveTo(10 + b * 0.6, -36, 10 + b, -28); c.quadraticCurveTo(13 + b, -18, 12, -10);
    c.lineTo(-13 - fl, -9); c.quadraticCurveTo(-12, -24, -9, -34); c.closePath(); };
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
    c.fillStyle = INK; c.beginPath(); c.arc(8, -52.3, 1.65, 0, TAU); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(8.6, -53.1, 0.6, 0, TAU); c.fill(); }
  else { c.beginPath(); c.arc(7, -52, 1.5, 0, TAU); c.fill(); c.fillStyle = 'rgba(255,255,255,.85)'; c.beginPath(); c.arc(7.5, -52.6, 0.45, 0, TAU); c.fill(); }
  if (o.glasses) {
    c.save(); c.strokeStyle = INK; c.lineWidth = 1.2;
    if (o.glasses === 'shades') { c.fillStyle = '#1d1f24'; c.beginPath(); c.ellipse(7.8, -52.4, 3.6, 2.9, 0, 0, TAU); c.fill(); c.stroke(); c.fillStyle = 'rgba(255,255,255,.45)'; c.beginPath(); c.ellipse(8.8, -53.4, 1.2, 0.7, -0.4, 0, TAU); c.fill(); }
    else { c.fillStyle = 'rgba(200,230,255,.25)'; c.beginPath(); c.arc(7.8, -52.4, 3.4, 0, TAU); c.fill(); c.stroke(); }
    c.beginPath(); c.moveTo(4.4, -52.8); c.lineTo(-1, -53.6); c.moveTo(11.2, -52.6); c.lineTo(12, -52.4); c.stroke(); c.restore();
  }
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
  // headwear: shayla, tagiyah cap, or shemagh/ghutra with agal
  const wv = Math.sin(ph * 1.3) * 3 * (o.flap || 1), w2 = Math.cos(ph * 1.1) * 3 * (o.flap || 1), tipY = -45 + wv * 1.6 + (o.droop || 0);
  if (o.head === 'shayla') { // headscarf wrapped around the face and falling over the shoulders
    const shp = () => { c.beginPath(); c.moveTo(9.6, -57); c.quadraticCurveTo(9, -65.5, 0, -65.5); c.quadraticCurveTo(-11.5, -64.5, -12.5, -52);
      c.quadraticCurveTo(-15 - wv * 0.5, -42, -17 - wv * 0.8, -35); c.quadraticCurveTo(-4, -33.5, 9, -38.5); c.quadraticCurveTo(7.5, -43, 5.8, -45.2);
      c.quadraticCurveTo(2, -46.5, 0.6, -50); c.quadraticCurveTo(1.6, -55.5, 9.6, -57); c.closePath(); };
    shp(); c.fillStyle = o.shaylaCol || '#e8789f'; c.fill();
    c.save(); c.clip(); c.fillStyle = 'rgba(0,0,0,.16)'; c.fillRect(-20, -52, 14, 22); c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(-6, -63); c.quadraticCurveTo(2, -65, 8, -60); c.stroke();
    c.strokeStyle = 'rgba(0,0,0,.18)'; c.lineWidth = 1; c.beginPath(); c.moveTo(-9, -50); c.quadraticCurveTo(-8, -42, -12, -36); c.moveTo(-3, -48); c.quadraticCurveTo(-2, -41, -5, -35); c.stroke(); c.restore();
    shp(); c.strokeStyle = INK; c.lineWidth = 1.6; c.stroke();
  } else if (o.head === 'tagiyah') { // white crochet cap, short dark hair at the back
    c.fillStyle = '#2a1a14'; c.beginPath(); c.arc(2, -52, 9.3, Math.PI * 0.62, Math.PI * 1.15); c.lineTo(2, -52); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(-7.6, -55.6); c.quadraticCurveTo(-7, -64.5, 2.4, -64.6); c.quadraticCurveTo(11, -64.2, 10.8, -56); c.quadraticCurveTo(2, -58, -7.6, -55.6); c.closePath();
    c.fillStyle = '#fbfaf4'; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.5; c.stroke();
    c.fillStyle = 'rgba(150,140,120,.6)'; for (let k = 0; k < 7; k++) for (let m = 0; m < 2; m++) { c.beginPath(); c.arc(-5 + k * 2.4, -61.2 + m * 2.6, 0.55, 0, TAU); c.fill(); }
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
function lookOf(robeId, headId, avatarId) {
  const r = M.ROBES.find(x => x.id === robeId) || M.ROBES[0], h = M.HEADS.find(x => x.id === headId) || M.HEADS[0];
  const o = Object.assign({ s: 1, robe: r.col, robeD: r.shade, flap: 1.2, hs: 1.16, bigEyes: 1, agalTilt: -0.08, glasses: avatarId === 'classic' ? null : avatarId }, SKIN);
  if (h.id === 'tagiyah') o.head = 'tagiyah';
  else { o.head = 'scarf'; o.scarf = h.id === 'shemagh' ? SHEMAGH : h.id === 'blackshemagh' ? SHEMAGH_B : '#f4f3ee'; o.fringe = h.id === 'ghutra' ? '#e3e0d6' : '#fff1e8'; }
  return o;
}
const kidBase = () => { const d = M.data(); return lookOf(d.robe, d.head, d.avatar); };
const lookKey = () => { const d = M.data(); return d.avatar + d.robe + d.head; };
const kname = () => T('ch_abood');
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
  if (e) blitSprite(c, e, x, y, rot, 1, 1, 1, alpha === 1 && blinkNow(0) && M.data().avatar !== 'shades' ? SKIN.skin : null);
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
  else if (k === 'sack') { c.fillStyle = '#b98a55'; c.beginPath(); c.moveTo(-w / 2 + 2, 0); c.quadraticCurveTo(-w / 2 - 3, -h * 0.6, -w / 2 + 3, -h + 6); c.lineTo(w / 2 - 3, -h + 6); c.quadraticCurveTo(w / 2 + 3, -h * 0.6, w / 2 - 2, 0); c.closePath(); c.fill(); c.stroke();
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
  else if (k === 'rock') { c.fillStyle = '#a88866'; c.beginPath(); c.moveTo(-w / 2, 0); c.lineTo(-w / 2 + 5, -h + 10); c.lineTo(-6, -h); c.lineTo(10, -h + 4); c.lineTo(w / 2, -8); c.lineTo(w / 2 - 3, 0); c.closePath(); c.fill(); c.stroke();
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
  else if (k === 'dbike') { const wr = o.ph; c.fillStyle = '#1b1b1f'; for (const wx of [-18, 18]) { c.beginPath(); c.arc(wx, -9, 9, 0, TAU); c.fill(); c.fillStyle = '#b9bcc6'; c.beginPath(); c.arc(wx, -9, 3.5, 0, TAU); c.fill(); c.fillStyle = '#1b1b1f'; }
    c.fillStyle = '#d94a3a'; c.beginPath(); c.moveTo(-22, -16); c.lineTo(-10, -26); c.lineTo(14, -24); c.lineTo(20, -14); c.lineTo(-18, -12); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#e23b4a'; c.beginPath(); c.roundRect(6, -46, 22, 20, 3); c.fill(); c.stroke(); c.fillStyle = '#fffaf0'; c.fillRect(9, -38, 16, 3);
    c.fillStyle = '#2c5d9e'; c.beginPath(); c.roundRect(-8, -40, 12, 16, 4); c.fill(); c.stroke(); c.fillStyle = '#1d1f24'; c.beginPath(); c.arc(-4, -45, 6, 0, TAU); c.fill(); c.stroke(); c.fillStyle = '#8fd3ff'; c.fillRect(-10, -47, 5, 3);
    c.strokeStyle = INK; c.lineWidth = 2; c.beginPath(); c.moveTo(-10, -36); c.lineTo(-18, -28); c.lineTo(-22, -30); c.stroke(); c.fillStyle = 'rgba(200,200,200,.5)'; c.beginPath(); c.arc(30 + Math.sin(wr * 2) * 2, -10, 4, 0, TAU); c.fill(); }
  else if (k === 'crate') { for (let r = 0; r < 2; r++) { const y0 = -20 - r * 20; c.fillStyle = r ? '#2b6cb0' : '#d9462b'; c.fillRect(-w / 2, y0, w, 20); c.strokeRect(-w / 2, y0, w, 20);
      c.fillStyle = 'rgba(0,0,0,.25)'; for (let k2 = 0; k2 < 3; k2++) c.fillRect(-w / 2 + 4 + k2 * 10, y0 + 10, 6, 6); c.fillStyle = '#e3b23c'; for (let k2 = 0; k2 < 4; k2++) { c.beginPath(); c.arc(-w / 2 + 4 + k2 * 8, y0 + 3, 2.4, 0, TAU); c.fill(); } } }
  else if (k === 'chairs') { c.fillStyle = '#f4f4f2'; c.strokeStyle = SOFT; c.lineWidth = 1.2; c.fillRect(-w / 2 + 2, -h, 7, h - 14); c.strokeRect(-w / 2 + 2, -h, 7, h - 14);
    for (let k2 = 0; k2 < 4; k2++) { c.fillRect(-w / 2 + 2, -20 - k2 * 3, w - 2, 3); c.strokeRect(-w / 2 + 2, -20 - k2 * 3, w - 2, 3); }
    c.fillRect(-w / 2 + 3, -12, 3, 12); c.fillRect(w / 2 - 4, -12, 3, 12); c.strokeRect(-w / 2 + 3, -12, 3, 12); c.strokeRect(w / 2 - 4, -12, 3, 12); }
  else if (k === 'castle') { c.fillStyle = '#e3c48a'; c.fillRect(-w / 2, -14, w, 14); c.strokeRect(-w / 2, -14, w, 14);
    for (const tx of [-w / 2, -6, w / 2 - 12]) { c.fillRect(tx, -h, 12, h - 12); c.strokeRect(tx, -h, 12, h - 12); c.fillRect(tx, -h - 3, 3, 3); c.fillRect(tx + 9, -h - 3, 3, 3); }
    c.strokeStyle = INK; c.beginPath(); c.moveTo(0, -h); c.lineTo(0, -h - 12); c.stroke(); c.fillStyle = '#e23b4a'; c.beginPath(); c.moveTo(0, -h - 12); c.lineTo(8, -h - 9); c.lineTo(0, -h - 6); c.fill(); c.fillStyle = '#f08fb4'; c.beginPath(); c.arc(-10, -6, 2, 0, TAU); c.arc(8, -5, 2, 0, TAU); c.fill(); }
  else if (k === 'escooter') { c.fillStyle = '#1d1f24'; c.beginPath(); c.roundRect(-16, -8, 30, 5, 2.5); c.fill(); c.strokeStyle = '#2c7bd1'; c.lineWidth = 3; c.beginPath(); c.moveTo(12, -6); c.lineTo(15, -h); c.moveTo(9, -h); c.lineTo(21, -h); c.stroke();
    c.fillStyle = '#1b1b1f'; for (const wx of [-14, 14]) { c.beginPath(); c.arc(wx, -4, 4.5, 0, TAU); c.fill(); } c.fillStyle = '#7ee0b0'; c.fillRect(13, -h + 6, 4, 4); }
  else if (k === 'basket') { c.fillStyle = '#b5803e'; c.beginPath(); c.moveTo(-w / 2, -16); c.lineTo(w / 2, -16); c.lineTo(w / 2 - 3, 0); c.lineTo(-w / 2 + 3, 0); c.closePath(); c.fill(); c.stroke();
    c.strokeStyle = '#8a5a26'; c.lineWidth = 1; c.beginPath(); for (let y = -12; y < 0; y += 4) { c.moveTo(-w / 2 + 2, y); c.lineTo(w / 2 - 2, y); } c.stroke();
    c.fillStyle = '#e23b4a'; c.fillRect(-w / 2 + 2, -19, w - 4, 4); c.fillStyle = '#fff'; for (let x = -w / 2 + 2; x < w / 2 - 2; x += 6) c.fillRect(x, -19, 3, 4);
    c.strokeStyle = INK; c.lineWidth = 2.2; c.beginPath(); c.arc(0, -16, 10, Math.PI, 0); c.stroke(); }
  else if (k === 'flower') { c.fillStyle = '#c9a777'; c.beginPath(); c.moveTo(-w / 2, -16); c.lineTo(w / 2, -16); c.lineTo(w / 2 - 4, 0); c.lineTo(-w / 2 + 4, 0); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#3f7d3a'; c.beginPath(); c.arc(-7, -20, 8, 0, TAU); c.arc(7, -21, 8, 0, TAU); c.arc(0, -27, 8, 0, TAU); c.fill(); c.fillStyle = '#e0479e'; c.beginPath(); c.arc(-6, -24, 2.6, 0, TAU); c.arc(6, -28, 2.6, 0, TAU); c.arc(2, -19, 2.6, 0, TAU); c.fill(); }
  else if (k === 'dallah') { dallahShape(c, 0, 0, 1); }
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
function acUnit(c, x, y) {
  c.fillStyle = '#ecebe5'; c.strokeStyle = SOFT; c.lineWidth = 1.1; c.fillRect(x, y, 20, 13); c.strokeRect(x, y, 20, 13);
  c.beginPath(); for (let k = 3; k < 18; k += 3) { c.moveTo(x + k, y + 3); c.lineTo(x + k, y + 10); } c.stroke();
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
// generic 4x4 / sedan, no badges
function car(c, x, col, suv) {
  const y = GROUND, h = suv ? 34 : 26, L = suv ? 76 : 72;
  c.fillStyle = col; c.strokeStyle = INK; c.lineWidth = 1.6; c.beginPath();
  if (suv) { c.moveTo(x, y - 10); c.lineTo(x, y - 24); c.lineTo(x + 10, y - 26); c.lineTo(x + 16, y - h); c.lineTo(x + 60, y - h); c.lineTo(x + 66, y - 24); c.lineTo(x + L, y - 22); c.lineTo(x + L, y - 10); }
  else { c.moveTo(x, y - 10); c.lineTo(x + 2, y - 18); c.lineTo(x + 18, y - 20); c.lineTo(x + 26, y - h); c.lineTo(x + 52, y - h); c.lineTo(x + 60, y - 19); c.lineTo(x + L, y - 16); c.lineTo(x + L, y - 10); }
  c.closePath(); c.fill(); c.stroke();
  c.fillStyle = '#26384a'; c.beginPath();
  if (suv) { c.moveTo(x + 18, y - h + 3); c.lineTo(x + 58, y - h + 3); c.lineTo(x + 62, y - 25); c.lineTo(x + 14, y - 25); }
  else { c.moveTo(x + 27, y - h + 3); c.lineTo(x + 51, y - h + 3); c.lineTo(x + 57, y - 19); c.lineTo(x + 21, y - 19); }
  c.closePath(); c.fill();
  c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 2; c.beginPath(); c.moveTo(x + (suv ? 22 : 30), y - h + 5); c.lineTo(x + (suv ? 28 : 36), y - (suv ? 26 : 20)); c.stroke();
  c.strokeStyle = col; c.lineWidth = 2.5; c.beginPath(); c.moveTo(x + (suv ? 38 : 39), y - h + 3); c.lineTo(x + (suv ? 38 : 39), y - (suv ? 25 : 19)); c.stroke();
  if (suv) { c.strokeStyle = '#3b3b46'; c.lineWidth = 2; c.beginPath(); c.moveTo(x + 20, y - h - 3); c.lineTo(x + 56, y - h - 3); c.stroke(); }
  c.fillStyle = '#ffe9a8'; c.fillRect(x + L - 5, y - 20, 4, 4); c.fillStyle = '#e04848'; c.fillRect(x + 1, y - 20, 3, 4);
  for (const wx of [x + 16, x + L - 16]) { c.fillStyle = '#1b1b1f'; c.beginPath(); c.arc(wx, y - 8, 8, 0, TAU); c.fill(); c.fillStyle = '#b9bcc6'; c.beginPath(); c.arc(wx, y - 8, 3.5, 0, TAU); c.fill(); }
}
const CARS = ['#f4f4f2', '#1d1f24', '#b9bcc6', '#7a1f2b', '#e9e2d0'];

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

// ---- zone 0: the modern fareej (walled villas) ----
const VILLA = ['#f4ede1', '#ece0c8', '#f7f3ea', '#e5d2b0'], GATE = ['#2c5d9e', '#6b4a2c', '#1f7a74', '#4b4b53'];
function villaTile(c, i) {
  const r = sr(i * 1.9 + 2), r2 = sr(i * 2.7 + 5), wall = VILLA[Math.floor(r2 * 4)], trim = '#c9a777', lit = night();
  if (r > 0.86) { // neighbourhood mosque
    c.fillStyle = '#f7f4ec'; c.strokeStyle = SOFT; c.lineWidth = 1.4;
    c.fillRect(30, GROUND - 110, 170, 110); c.strokeRect(30, GROUND - 110, 170, 110);
    const dg = c.createLinearGradient(80, 0, 150, 0); dg.addColorStop(0, '#e8f1ec'); dg.addColorStop(1, '#b9d2c4'); c.fillStyle = dg;
    c.beginPath(); c.moveTo(78, GROUND - 110); c.quadraticCurveTo(80, GROUND - 168, 115, GROUND - 172); c.quadraticCurveTo(150, GROUND - 168, 152, GROUND - 110); c.closePath(); c.fill(); c.stroke();
    c.strokeStyle = '#c9a777'; c.lineWidth = 2; c.beginPath(); c.moveTo(115, GROUND - 172); c.lineTo(115, GROUND - 186); c.stroke(); c.fillStyle = '#c9a777'; c.beginPath(); c.arc(116, GROUND - 190, 4, 0.6, Math.PI * 1.7); c.fill();
    c.fillStyle = '#f7f4ec'; c.strokeStyle = SOFT; c.lineWidth = 1.4; c.fillRect(206, GROUND - 196, 16, 196); c.strokeRect(206, GROUND - 196, 16, 196);
    c.fillRect(202, GROUND - 150, 24, 6); c.strokeRect(202, GROUND - 150, 24, 6); c.fillStyle = '#b9d2c4'; c.beginPath(); c.moveTo(206, GROUND - 196); c.lineTo(214, GROUND - 212); c.lineTo(222, GROUND - 196); c.fill(); c.stroke();
    for (let k = 0; k < 4; k++) archWin(c, 44 + k * 40, GROUND - 96, 18, 30, lit);
    if (lit) addLight(214, GROUND - 160, 34);
  } else {
    const vx = 30, vw = 190, ub = GROUND - 154;
    c.fillStyle = wall; c.strokeStyle = SOFT; c.lineWidth = 1.4;
    c.fillRect(vx, GROUND - 116, vw, 116); c.strokeRect(vx, GROUND - 116, vw, 116);
    c.fillRect(vx + 22, ub, vw - 44, 40); c.strokeRect(vx + 22, ub, vw - 44, 40);
    c.fillStyle = trim; c.fillRect(vx - 4, GROUND - 120, vw + 8, 5); c.fillRect(vx + 18, ub - 5, vw - 36, 5);
    c.fillStyle = 'rgba(80,50,30,.14)'; c.fillRect(vx, GROUND - 115, vw, 4); c.fillRect(vx + 22, ub, vw - 44, 3);
    for (let k = 0; k < 3; k++) archWin(c, vx + 44 + k * 40, ub + 7, 16, 26, lit && sr(i + k) > 0.3);
    for (let k = 0; k < 4; k++) archWin(c, vx + 16 + k * 46, GROUND - 106, 20, 32, lit && sr(i * 3 + k) > 0.4);
    c.strokeStyle = '#8c7a5e'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(vx + 20, GROUND - 82); c.lineTo(vx + vw - 20, GROUND - 82); for (let k = vx + 20; k <= vx + vw - 20; k += 8) { c.moveTo(k, GROUND - 82); c.lineTo(k, GROUND - 74); } c.stroke();
    acUnit(c, vx + vw - 30, ub + 12);
    if (sr(i + 9) > 0.5) { c.fillStyle = '#e8e8ec'; c.strokeStyle = SOFT; c.lineWidth = 1; c.beginPath(); c.ellipse(vx + 40, ub - 12, 8, 4.5, -0.6, 0, TAU); c.fill(); c.stroke(); }
  }
  // boundary wall with pillars, lamps and a gate
  c.fillStyle = '#eadcc2'; c.strokeStyle = SOFT; c.lineWidth = 1.4; c.fillRect(0, GROUND - 46, 252, 46); c.strokeRect(0, GROUND - 46, 252, 46);
  c.fillStyle = '#cdb48c'; c.fillRect(-2, GROUND - 50, 256, 6);
  c.fillStyle = 'rgba(110,70,40,.07)'; for (let k = 0; k < 30; k++) c.fillRect(sr(i * 3 + k) * 250, GROUND - 44 + sr(i * 5 + k) * 40, 3, 1.5);
  for (const px of [0, 62, 190, 242]) { c.fillStyle = '#ddc8a3'; c.fillRect(px, GROUND - 58, 10, 58); c.strokeRect(px, GROUND - 58, 10, 58); c.fillStyle = '#c9a777'; c.fillRect(px - 2, GROUND - 62, 14, 5);
    c.fillStyle = lit ? '#ffe39a' : '#f0e6c8'; c.fillRect(px + 2, GROUND - 72, 6, 9); if (lit) addLight(px + 5, GROUND - 68, 24); }
  const gx = 96, gw = 60, gc = GATE[Math.floor(sr(i + 4) * 4)];
  c.fillStyle = gc; c.strokeStyle = INK; c.lineWidth = 1.6; c.beginPath(); c.moveTo(gx, GROUND); c.lineTo(gx, GROUND - 52); c.quadraticCurveTo(gx + gw / 2, GROUND - 70, gx + gw, GROUND - 52); c.lineTo(gx + gw, GROUND); c.closePath(); c.fill(); c.stroke();
  c.strokeStyle = 'rgba(255,240,200,.5)'; c.lineWidth = 1.2; c.beginPath(); for (let k = gx + 6; k < gx + gw; k += 6) { c.moveTo(k, GROUND - 2); c.lineTo(k, GROUND - 50); } c.moveTo(gx + gw / 2, GROUND); c.lineTo(gx + gw / 2, GROUND - 62); c.stroke();
  c.fillStyle = '#e3b23c'; c.beginPath(); c.arc(gx + gw / 2 - 4, GROUND - 26, 1.8, 0, TAU); c.arc(gx + gw / 2 + 4, GROUND - 26, 1.8, 0, TAU); c.fill();
  c.fillStyle = '#2c5d9e'; c.fillRect(70, GROUND - 40, 16, 9); label(c, String(10 + Math.floor(sr(i + 6) * 89)), 78, GROUND - 35.5, 6, '#fff');
  if (r <= 0.86 && r > 0.78) waterTanker(c, 160);
  else if (r <= 0.86 && r2 > 0.3) car(c, 168, CARS[Math.floor(sr(i + 7) * CARS.length)], sr(i + 8) > 0.35);
}
function waterTanker(c, x) {
  const y = GROUND; c.strokeStyle = INK; c.lineWidth = 1.6;
  c.fillStyle = '#f4f4f2'; c.beginPath(); c.roundRect(x, y - 44, 64, 30, 12); c.fill(); c.stroke();
  c.fillStyle = '#2c7bd1'; c.fillRect(x + 2, y - 32, 60, 5); label(c, T('water'), x + 32, y - 39, 7, '#2c7bd1');
  c.fillStyle = '#e8e2d0'; c.beginPath(); c.roundRect(x + 64, y - 40, 26, 30, 4); c.fill(); c.stroke(); c.fillStyle = '#26384a'; c.fillRect(x + 72, y - 36, 14, 10);
  c.fillStyle = '#3b3b46'; c.fillRect(x, y - 14, 90, 5);
  for (const wx of [x + 14, x + 44, x + 78]) { c.fillStyle = '#1b1b1f'; c.beginPath(); c.arc(wx, y - 7, 7, 0, TAU); c.fill(); c.fillStyle = '#b9bcc6'; c.beginPath(); c.arc(wx, y - 7, 3, 0, TAU); c.fill(); }
}
function fareejNearTile(c, i) {
  const r = sr(i * 5.3 + 1);
  if (r > 0.5) lamp(c, 40);
  if (r < 0.65) { c.fillStyle = '#4f8a3a'; for (let k = 0; k < 6; k++) { c.beginPath(); c.arc(98 + k * 18, GROUND - 12 + Math.sin(k * 2 + i) * 3, 12, 0, TAU); c.fill(); }
    c.fillStyle = '#6aa64f'; for (let k = 0; k < 6; k++) { c.beginPath(); c.arc(95 + k * 18, GROUND - 16 + Math.sin(k * 2 + i) * 3, 6, 0, TAU); c.fill(); }
    c.fillStyle = '#e0479e'; for (let k = 0; k < 14; k++) { c.beginPath(); c.arc(90 + sr(i + k) * 104, GROUND - 24 + sr(k * 3 + i) * 14, 2.6, 0, TAU); c.fill(); } }
}

// ---- zone 1: baqala street ----
const SHOPS = [['baqala', '#2e8b57'], ['cafe', '#c8202b'], ['karak', '#e07b1a'], ['salon', '#2c5d9e'], ['laundry', '#7a3f8e'], ['pharmacy', '#1f9e8f'], ['resto', '#b5652e']];
const BLDG = ['#efe3cf', '#e4d6bd', '#f3ece0', '#d9c9ab'];
function shopTile(c, i) {
  const r = sr(i * 2.3 + 1), [k, col] = SHOPS[Math.floor(r * SHOPS.length)], floors = 1 + Math.floor(sr(i + 3) * 2), lit = night();
  const top = GROUND - 70 - floors * 44, bw = 196;
  c.fillStyle = BLDG[Math.floor(sr(i + 5) * 4)]; c.strokeStyle = SOFT; c.lineWidth = 1.4; c.fillRect(2, top, bw, GROUND - top); c.strokeRect(2, top, bw, GROUND - top);
  c.fillStyle = '#c9b48c'; c.fillRect(0, top - 5, bw + 4, 6);
  c.fillStyle = '#f4f4f2'; c.strokeStyle = SOFT; c.beginPath(); c.roundRect(150, top - 22, 30, 17, 6); c.fill(); c.stroke(); c.fillStyle = '#9aa0aa'; c.fillRect(156, top - 6, 3, 6); c.fillRect(171, top - 6, 3, 6);
  for (let f = 0; f < floors; f++) for (let w = 0; w < 4; w++) {
    const wx = 16 + w * 46, wy = top + 10 + f * 44; rectWin(c, wx, wy, 24, 24, lit && sr(i * 7 + f * 4 + w) > 0.35);
    if (sr(i * 3 + f + w) > 0.55) acUnit(c, wx + 2, wy + 27);
  }
  // shop front
  c.fillStyle = col; c.strokeStyle = INK; c.lineWidth = 1.6; c.fillRect(6, GROUND - 72, bw - 8, 20); c.strokeRect(6, GROUND - 72, bw - 8, 20);
  label(c, T('sign_' + k), bw / 2 + 2, GROUND - 62, 13, '#fffaf0');
  if (k === 'pharmacy') { c.fillStyle = '#7ee08a'; c.fillRect(14, GROUND - 68, 12, 4); c.fillRect(18, GROUND - 72 + 0, 4, 12); }
  c.fillStyle = lit ? '#ffe7a8' : '#2a3a4c'; c.fillRect(8, GROUND - 52, bw - 12, 50);
  if (lit) addLight(bw / 2, GROUND - 30, 70);
  const shelf = ['#e8573b', '#ffb400', '#33b679', '#4a90e2', '#ffffff'];
  for (let s = 0; s < 3; s++) for (let p = 0; p < 12; p++) { c.fillStyle = shelf[(p + s + i) % 5]; c.globalAlpha = lit ? 0.9 : 0.6; c.fillRect(14 + p * 8 + (s % 2) * 3, GROUND - 46 + s * 13, 5, 8); }
  c.globalAlpha = 1;
  c.fillStyle = 'rgba(255,255,255,.18)'; c.beginPath(); c.moveTo(40, GROUND - 52); c.lineTo(60, GROUND - 52); c.lineTo(30, GROUND - 2); c.lineTo(10, GROUND - 2); c.fill();
  c.strokeStyle = '#9aa0aa'; c.lineWidth = 2; c.strokeRect(120, GROUND - 52, 40, 50); c.beginPath(); c.moveTo(140, GROUND - 52); c.lineTo(140, GROUND - 2); c.stroke();
  for (let s = 0; s < 12; s++) { c.fillStyle = s % 2 ? '#fffaf0' : col; c.beginPath(); c.moveTo(6 + s * 16, GROUND - 52); c.lineTo(22 + s * 16, GROUND - 52); c.lineTo(22 + s * 16, GROUND - 46); c.arc(14 + s * 16, GROUND - 46, 8, 0, Math.PI); c.closePath(); c.fill(); }
  if (k === 'cafe' || k === 'karak' || k === 'resto') { // plastic chairs and a table outside
    c.fillStyle = '#f4f4f2'; c.strokeStyle = SOFT; c.lineWidth = 1.2;
    c.fillRect(70, GROUND - 22, 30, 4); c.strokeRect(70, GROUND - 22, 30, 4); c.fillRect(83, GROUND - 18, 4, 18);
    for (const cx of [56, 104]) { c.fillStyle = sr(i + cx) > 0.5 ? '#f4f4f2' : '#d94a3a'; c.fillRect(cx, GROUND - 14, 14, 3); c.fillRect(cx + (cx < 80 ? 0 : 11), GROUND - 28, 3, 14); c.fillRect(cx + 1, GROUND - 11, 2, 11); c.fillRect(cx + 11, GROUND - 11, 2, 11); }
    if (k === 'karak') { c.fillStyle = '#fffaf0'; c.fillRect(76, GROUND - 28, 5, 6); c.fillRect(89, GROUND - 28, 5, 6); c.fillStyle = '#c98b5a'; c.fillRect(76, GROUND - 28, 5, 2); c.fillRect(89, GROUND - 28, 5, 2); }
  }
}
function carRowTile(c, i) { const suv = sr(i + 2) > 0.45; car(c, 20, CARS[Math.floor(sr(i * 1.3) * CARS.length)], suv); }

// ---- zone 2: family beach ----
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

// ---- zone 3: waterfront park ----
function ferris(c) {
  const x = ((900 - worldX * 0.05) % 1600 + 1600) % 1600 - 200, cy = GROUND - 170, R = 74;
  if (x < -120 || x > W + 120) return;
  const A = c.globalAlpha; c.globalAlpha = A * 0.8;
  c.strokeStyle = '#5c4870'; c.lineWidth = 4; c.beginPath(); c.moveTo(x - 40, GROUND - 60); c.lineTo(x, cy); c.lineTo(x + 40, GROUND - 60); c.stroke();
  c.lineWidth = 3; c.beginPath(); c.arc(x, cy, R, 0, TAU); c.stroke(); c.lineWidth = 1.2; c.beginPath();
  const rot = t * 0.12; for (let k = 0; k < 16; k++) { const a = rot + k * TAU / 16; c.moveTo(x, cy); c.lineTo(x + Math.cos(a) * R, cy + Math.sin(a) * R); } c.stroke();
  for (let k = 0; k < 16; k++) { const a = rot + k * TAU / 16, px = x + Math.cos(a) * R, py = cy + Math.sin(a) * R;
    c.fillStyle = SK.n > 0.3 ? ['#ffe066', '#ff7eb6', '#7ee0b0', '#8fd3ff'][k % 4] : ['#e23b4a', '#f2c230', '#2b6cb0', '#1f7a74'][k % 4];
    c.beginPath(); c.roundRect(px - 4, py, 8, 8, 2); c.fill(); }
  c.globalAlpha = A;
}
function fountains(c) {
  const off = worldX * 0.22, tw = 560;
  for (let i = Math.floor(off / tw) - 1; i <= Math.floor((off + W) / tw) + 1; i++) {
    if (sr(i * 3.3) < 0.3) continue; const x = i * tw - off + 200, base = GROUND - 30;
    const hue = (t * 40 + i * 70) % 360, n = SK.n;
    for (let k = -3; k <= 3; k++) {
      const hgt = (60 + Math.sin(t * 2 + k) * 14) * (1 - Math.abs(k) * 0.12), spread = k * 16;
      c.strokeStyle = n > 0.3 ? `hsla(${hue + k * 20},90%,70%,.75)` : 'rgba(235,248,255,.8)'; c.lineWidth = 3 - Math.abs(k) * 0.3;
      c.beginPath(); c.moveTo(x + k * 3, base); c.quadraticCurveTo(x + spread * 0.5, base - hgt * 1.8, x + spread * 1.6, base); c.stroke();
    }
    c.fillStyle = 'rgba(235,248,255,.5)'; c.beginPath(); c.ellipse(x, base, 40, 4, 0, 0, TAU); c.fill();
    if (n > 0.3) lights.push([x, base - 40, 90]);
  }
}
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

// ---- zone 4: desert camp (kashta) ----
function duneLine(c, par, base, amp, f, col, alpha) {
  const A = c.globalAlpha; c.globalAlpha = A * alpha; c.fillStyle = col; const off = worldX * par, stepX = COARSE ? 14 : 10;
  const pts = []; for (let x = 0; x <= W + stepX; x += stepX) { const X = x + off; pts.push(x, base - Math.sin(X * f) * amp - Math.sin(X * f * 2.7 + 1) * amp * 0.4 - Math.abs(Math.sin(X * f * 0.5)) * amp * 0.6); }
  c.beginPath(); c.moveTo(0, GROUND + 2); for (let k = 0; k < pts.length; k += 2) c.lineTo(pts[k], pts[k + 1]); c.lineTo(W + stepX, GROUND + 2); c.closePath(); c.fill();
  c.strokeStyle = 'rgba(255,236,200,.55)'; c.lineWidth = 2; c.beginPath(); c.moveTo(pts[0], pts[1]); for (let k = 2; k < pts.length; k += 2) c.lineTo(pts[k], pts[k + 1]); c.stroke();
  c.globalAlpha = A; return pts;
}
function dunesWith4x4(c) {
  const pts = duneLine(c, 0.2, GROUND - 34, 22, 0.006, '#d58c4a', 0.85), stepX = COARSE ? 14 : 10;
  for (let k = 0; k < 2; k++) {
    const x = ((k * 520 + t * 38 - worldX * 0.2) % (W + 300) + W + 300) % (W + 300) - 150, j = clamp(Math.round(x / stepX) * 2, 0, pts.length - 4);
    const y = pts[j + 1], ang = Math.atan2(pts[j + 3] - pts[j + 1], stepX);
    c.save(); c.translate(x, y + 2); c.rotate(ang); c.scale(0.42, 0.42); c.translate(-38, -GROUND); car(c, 0, k ? '#f4f4f2' : '#1d1f24', true); c.restore();
    c.fillStyle = 'rgba(240,210,160,.5)'; c.beginPath(); c.arc(x - 20, y - 2, 6, 0, TAU); c.arc(x - 28, y - 4, 4, 0, TAU); c.fill();
  }
}
function tentTile(c) { // black goat-hair tent with sadu bands and an open majlis front
  c.strokeStyle = '#6b4a2c'; c.lineWidth = 3; c.beginPath(); c.moveTo(30, GROUND); c.lineTo(30, GROUND - 58); c.moveTo(200, GROUND); c.lineTo(200, GROUND - 58); c.moveTo(115, GROUND - 58); c.lineTo(115, GROUND - 82); c.stroke();
  c.fillStyle = '#2a2320'; c.strokeStyle = INK; c.lineWidth = 1.6; c.beginPath(); c.moveTo(16, GROUND - 52); c.quadraticCurveTo(60, GROUND - 74, 115, GROUND - 84); c.quadraticCurveTo(170, GROUND - 74, 214, GROUND - 52); c.lineTo(214, GROUND - 44); c.lineTo(16, GROUND - 44); c.closePath(); c.fill(); c.stroke();
  sadu(c, 16, GROUND - 52, 198, 8);
  c.fillStyle = '#3a2f2a'; c.fillRect(22, GROUND - 44, 186, 44);
  c.fillStyle = '#8c2a26'; c.fillRect(30, GROUND - 14, 170, 14); c.fillStyle = '#b5352f'; for (let k = 0; k < 6; k++) { c.beginPath(); c.roundRect(36 + k * 27, GROUND - 26, 22, 14, 4); c.fill(); }
  sadu(c, 30, GROUND - 4, 170, 4);
  c.strokeStyle = '#d9a96f'; c.lineWidth = 1; c.beginPath(); c.moveTo(16, GROUND - 44); c.lineTo(4, GROUND); c.moveTo(214, GROUND - 44); c.lineTo(226, GROUND); c.stroke();
}
function campLive(c, i, x) {
  const fx = x + 262, fy = GROUND;
  c.strokeStyle = '#5b3a24'; c.lineWidth = 4; c.beginPath(); c.moveTo(fx - 14, fy - 2); c.lineTo(fx + 14, fy - 8); c.moveTo(fx + 14, fy - 2); c.lineTo(fx - 14, fy - 8); c.stroke();
  for (let k = 0; k < 3; k++) { const fl = Math.sin(t * 14 + k * 2) * 3, h = 16 + Math.sin(t * 9 + k) * 4 - k * 3;
    c.fillStyle = ['#ff7a1a', '#ffb43a', '#ffe48a'][k]; c.beginPath(); c.moveTo(fx - 10 + k * 3, fy - 6); c.quadraticCurveTo(fx - 6 + fl, fy - 6 - h, fx + fl * 0.5, fy - 8 - h - 4); c.quadraticCurveTo(fx + 6 + fl, fy - 6 - h * 0.6, fx + 10 - k * 3, fy - 6); c.closePath(); c.fill(); }
  addLight(fx, fy - 18, 110);
  dallahShape(c, fx + 22, fy, 0.7);
  c.strokeStyle = '#6b4a2c'; c.lineWidth = 2; c.beginPath(); c.moveTo(x + 330, GROUND); c.lineTo(x + 330, GROUND - 34); c.moveTo(x + 322, GROUND - 34); c.lineTo(x + 338, GROUND - 34); c.stroke();
  falcon(c, x + 332, GROUND - 36, false);
  if (sr(i * 3.3 + 7) < 0.6) camel(c, x + 390 + ((t * 18) % 340) * 0.2, GROUND, t * 4 + i, 0.9);
}
function camel(c, x, y, ph, s) {
  c.save(); c.translate(x, y); c.scale(s, s); c.fillStyle = '#b07a43';
  for (let k = 0; k < 4; k++) { const a = Math.sin(ph + (k % 2 ? Math.PI : 0) + (k > 1 ? 0.6 : 0)) * 0.35; c.save(); c.translate(-18 + k * 12, -34); c.rotate(a); c.fillRect(-2, 0, 4, 34); c.restore(); }
  c.beginPath(); c.ellipse(0, -40, 26, 12, 0, 0, TAU); c.fill(); c.beginPath(); c.arc(-4, -50, 11, Math.PI, 0); c.fill();
  c.beginPath(); c.moveTo(22, -44); c.quadraticCurveTo(34, -48, 32, -66 + Math.sin(ph) * 1.5); c.lineTo(40, -68); c.lineTo(40, -62); c.lineTo(36, -60); c.quadraticCurveTo(38, -44, 24, -34); c.closePath(); c.fill();
  sadu(c, -14, -56, 22, 6);
  c.restore();
}
function falcon(c, x, y, flying, ph = 0) {
  c.save(); c.translate(x, y); c.fillStyle = '#7a5a3a'; c.strokeStyle = INK; c.lineWidth = 1.2;
  if (flying) { const f = Math.sin(ph) * 8; c.beginPath(); c.moveTo(-18, -f); c.quadraticCurveTo(-6, -4, 0, 0); c.quadraticCurveTo(6, -4, 18, -f); c.quadraticCurveTo(6, 2, 0, 3); c.quadraticCurveTo(-6, 2, -18, -f); c.fill(); c.stroke(); c.beginPath(); c.arc(6, -1, 3, 0, TAU); c.fill(); }
  else { c.beginPath(); c.ellipse(0, -8, 5.5, 9, 0.15, 0, TAU); c.fill(); c.stroke(); c.fillStyle = '#c8a46a'; c.beginPath(); c.arc(2, -17, 4, 0, TAU); c.fill(); c.stroke();
    c.fillStyle = '#8c2a26'; c.beginPath(); c.arc(2, -18.5, 4, Math.PI, 0); c.fill(); c.fillStyle = '#e3b23c'; c.beginPath(); c.moveTo(5.5, -17); c.lineTo(8, -16); c.lineTo(5.5, -15.5); c.fill(); }
  c.restore();
}
function nearDunes(c) {
  const off = worldX * 0.8, stepX = COARSE ? 14 : 10; c.fillStyle = '#e6b273';
  c.beginPath(); c.moveTo(0, GROUND + 2); for (let x = 0; x <= W + stepX; x += stepX) { const X = x + off; c.lineTo(x, GROUND - 6 - Math.max(0, Math.sin(X * 0.008)) * 18); } c.lineTo(W + stepX, GROUND + 2); c.fill();
  const toff = worldX * 0.8; c.strokeStyle = '#8f9a45'; c.lineWidth = 2; c.lineCap = 'round'; c.beginPath();
  for (let i = Math.floor(toff / 90) - 1; i <= Math.floor((toff + W) / 90) + 1; i++) { if (sr(i * 2.2) < 0.5) continue; const x = i * 90 - toff;
    for (let k = 0; k < 5; k++) { c.moveTo(x + k * 3, GROUND); c.lineTo(x + k * 3 - 4 + k * 2 + Math.sin(t * 3 + i) * 2, GROUND - 12 - k % 2 * 5); } }
  c.stroke();
}
function dallahShape(c, x, y, s) { // Arabic coffee pot
  c.save(); c.translate(x, y); c.scale(s, s); c.fillStyle = '#d9a640'; c.strokeStyle = INK; c.lineWidth = 1.6 / s * 0.8;
  c.beginPath(); c.moveTo(-10, 0); c.quadraticCurveTo(-14, -12, -6, -18); c.lineTo(-5, -26); c.quadraticCurveTo(0, -30, 5, -26); c.lineTo(6, -18); c.quadraticCurveTo(14, -12, 10, 0); c.closePath(); c.fill(); c.stroke();
  c.beginPath(); c.moveTo(6, -16); c.quadraticCurveTo(18, -22, 20, -32); c.lineTo(17, -31); c.quadraticCurveTo(14, -22, 6, -20); c.fill(); c.stroke();
  c.beginPath(); c.moveTo(-6, -22); c.quadraticCurveTo(-16, -20, -12, -8); c.stroke();
  c.beginPath(); c.moveTo(-3, -28); c.lineTo(0, -35); c.lineTo(3, -28); c.fill(); c.stroke();
  c.fillStyle = 'rgba(255,240,190,.6)'; c.fillRect(-7, -14, 3, 10); c.restore();
}

// ---- landmarks stay near the same spot for the whole area, drifting slowly ----
function landmarkX(z, base, par) { const cur = Math.floor(Math.max(0, dist) / ZLEN), start = (zoneOfM(dist) === z ? cur : cur + 1) * ZLEN; return base - (dist - start) * 40 * par; }
function sailHotel(c) { // stylised sail-shaped hotel on its island (Jumeirah)
  const x = landmarkX(0, W * 0.74, 0.05), y = GROUND - 76, h = 150; if (x < -80 || x > W + 80) return;
  c.save(); c.translate(x, y);
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
  c.restore(); if (SK.n > 0.3) lights.push([x, y - h * 0.5, 100]);
}
function tallTower(c) { // stylised supertall with set-backs and a spire (Downtown)
  const x = landmarkX(1, W * 0.64, 0.04), base = GROUND - 40; if (x < -60 || x > W + 60) return;
  const tiers = [[46, 60], [40, 46], [34, 40], [28, 34], [22, 30], [16, 26], [11, 22], [7, 18]];
  const g = c.createLinearGradient(x - 24, 0, x + 24, 0); g.addColorStop(0, '#a9bcd6'); g.addColorStop(0.5, '#d9e3ef'); g.addColorStop(1, '#6f83a6');
  c.fillStyle = g; c.strokeStyle = 'rgba(60,70,100,.5)'; c.lineWidth = 1; let y = base;
  for (const [w, h] of tiers) { c.fillRect(x - w / 2, y - h, w, h); c.strokeRect(x - w / 2, y - h, w, h); y -= h; }
  c.fillRect(x - 1.5, y - 48, 3, 48);
  if (SK.n > 0.3) { c.fillStyle = `rgba(255,230,160,${SK.n})`; for (let yy = base - 8; yy > y; yy -= 9) c.fillRect(x - 1, yy, 2, 3); c.fillStyle = '#ff4d4d'; c.beginPath(); c.arc(x, y - 48, 2.2, 0, TAU); c.fill(); }
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
// ---- Sharjah old souq: coral-stone arcades, wooden mashrabiya, palm-frond roof, wind towers ----
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
  villa: { id: 'v', par: .42, tw: 262, box: [-4, GROUND - 216, 268, 218], v: () => (night() ? 1 : 0) + getLang(), draw: villaTile,
    live: (c, i, x) => { if (sr(i + 0.71) > 0.35) palm(c, x + 256, GROUND - 40, 80 + sr(i) * 30, i); } },
  fNear: { id: 'f', par: .72, tw: 300, box: [26, GROUND - 142, 200, 144], v: () => SK.n > 0.3 ? 1 : 0, draw: fareejNearTile },
  shops: { id: 's', par: .42, tw: 200, box: [-2, GROUND - 184, 204, 186], v: () => (night() ? 1 : 0) + getLang(), draw: shopTile },
  cars: { id: 'c', par: .8, tw: 190, box: [16, GROUND - 40, 84, 42], has: i => sr(i * 1.7) > 0.4, draw: carRowTile },
  beach: { id: 'b', par: .42, tw: 300, box: [-4, GROUND - 154, 300, 156], v: () => (night() ? 1 : 0) + getLang(), draw: beachTile },
  park: { id: 'p', par: .42, tw: 260, box: [10, GROUND - 142, 240, 144], v: () => SK.n > 0.3 ? 1 : 0, draw: parkTile },
  beds: { id: 'e', par: .75, tw: 240, box: [18, GROUND - 26, 144, 28], has: i => sr(i * 2.9) > 0.35, draw: flowerbedTile },
  downtown: { id: 'd', par: .42, tw: 214, box: [-2, GROUND - 120, 212, 122], v: () => night() ? 1 : 0, draw: downtownTile, live: downtownLive },
  houses: { id: 'h', par: .25, tw: 170, box: [-2, GROUND - 190, 156, 192], draw: oldHouseTile },
  souq: { id: 'q', par: .42, tw: 131, box: [-4, GROUND - 152, 140, 154], draw: souqTile, live: souqLive },
  tent: { id: 't', par: .42, tw: 440, box: [0, GROUND - 90, 230, 92], has: i => sr(i * 1.3) > 0.3, draw: tentTile, live: (c, i, x) => { if (sr(i * 1.3) > 0.3) campLive(c, i, x); } },
};
const withAlpha = (a, fn) => c => { const A = c.globalAlpha; c.globalAlpha = A * a; fn(c); c.globalAlpha = A; };
const LAYERS = [
  { far: c => { withAlpha(0.3, c2 => tiled(c2, TL.dxb))(c); kites(c); }, midfar: c => { sea(c, false); sailHotel(c); }, mid: c => tiled(c, TL.beach) },
  { far: c => { withAlpha(0.42, c2 => tiled(c2, TL.dxb))(c); tallTower(c); }, midfar: metro, mid: c => tiled(c, TL.downtown), near: c => tiled(c, TL.fNear) },
  { far: withAlpha(0.38, c => tiled(c, TL.shj)), midfar: mamzarSea, mid: c => tiled(c, TL.park), near: c => tiled(c, TL.beds) },
  { far: withAlpha(0.42, c => tiled(c, TL.shj)), midfar: withAlpha(0.85, c => tiled(c, TL.houses)), mid: c => tiled(c, TL.souq) },
];
function layer(name, A, B, blend) {
  const la = LAYERS[A][name], lb = LAYERS[B][name];
  if (la && blend < 1) { ctx.globalAlpha = 1 - blend; la(ctx); }
  if (lb && blend > 0) { ctx.globalAlpha = blend; lb(ctx); }
  ctx.globalAlpha = 1;
}

// ---------- ground: one seamless period per area, baked once ----------
const GP = [120, 120, 80, 70];
function groundTile(c, z) {
  const P = GP[z], HB = H + 20;
  if (z === 0) { c.fillStyle = '#e8cf9a'; c.fillRect(0, GROUND, P, 8); c.fillStyle = '#c2553f'; c.fillRect(0, GROUND + 8, P, HB - GROUND - 8);
    c.fillStyle = '#f4f4f2'; c.fillRect(0, GROUND + 10, P, 2); c.fillRect(0, GROUND + 34, P, 1.6); c.fillRect(0, GROUND + 58, P, 1.6);
    c.fillStyle = 'rgba(255,255,255,.55)'; c.fillRect(20, GROUND + 20, 14, 2); c.fillRect(20, GROUND + 44, 14, 2); }
  else if (z === 1) { c.fillStyle = '#c9c3b8'; c.fillRect(0, GROUND, P, HB - GROUND); c.strokeStyle = 'rgba(70,60,50,.25)'; c.lineWidth = 1.2; c.beginPath();
    for (let x = 0; x <= P; x += 40) { c.moveTo(x, GROUND + 8); c.lineTo(x, GROUND + 40); } c.moveTo(0, GROUND + 40); c.lineTo(P, GROUND + 40); c.stroke();
    c.fillStyle = '#4a4a50'; c.fillRect(0, GROUND + 42, P, HB - GROUND - 42); c.fillStyle = '#f2f2f2'; for (let x = 10; x < P; x += 60) c.fillRect(x, GROUND + 58, 30, 3);
    for (let x = 0; x < P; x += 40) { c.fillStyle = '#1d1d1d'; c.fillRect(x, GROUND, 20, 8); c.fillStyle = '#f4f4f4'; c.fillRect(x + 20, GROUND, 20, 8); } }
  else if (z === 2) { c.fillStyle = '#4f8a3a'; c.fillRect(0, GROUND, P, 7); c.fillStyle = '#d8b9a8'; c.fillRect(0, GROUND + 7, P, HB - GROUND - 7);
    c.strokeStyle = 'rgba(110,70,60,.3)'; c.lineWidth = 1.2; c.beginPath();
    for (let row = 0; row < 4; row++) { const yy = GROUND + 7 + row * 18; c.moveTo(0, yy); c.lineTo(P, yy); for (let x = (row % 2) * 20; x <= P; x += 40) { c.moveTo(x, yy); c.lineTo(x, yy + 18); } } c.stroke();
    c.fillStyle = '#6aa64f'; for (let x = 2; x < P; x += 6) c.fillRect(x, GROUND - 2, 2, 4); }
  else { c.fillStyle = '#bf9a6c'; c.fillRect(0, GROUND, P, HB - GROUND); c.strokeStyle = 'rgba(80,50,25,.35)'; c.lineWidth = 1.5; c.beginPath();
    for (let row = 0; row < 3; row++) { const yy = GROUND + 8 + row * 22; c.moveTo(0, yy); c.lineTo(P, yy); for (let x = -(row % 2) * 35; x <= P; x += 70) { c.moveTo(x, yy); c.lineTo(x, yy + 22); } }
    c.stroke(); c.fillStyle = '#9c7a52'; c.fillRect(0, GROUND, P, 8); }
  for (let k = 0; k < P * 0.45; k++) { c.fillStyle = k % 3 ? 'rgba(90,60,30,.12)' : 'rgba(255,255,255,.18)'; c.fillRect(sr(z * 31 + k) * P, GROUND + 10 + sr(z * 17 + k * 1.3) * 76, 1.6, 1.6); }
  c.fillStyle = 'rgba(0,0,0,.16)'; c.fillRect(0, GROUND + 8, P, 2);
}
const GL = GP.map((P, z) => ({ id: 'g' + z, box: [0, GROUND, P, H + 20 - GROUND], draw: c => groundTile(c, z) }));
function groundSeg(c, z, x0, x1) {
  if (x1 <= x0) return; const P = GP[z], e = getTile(GL[z], 0, true);
  c.save(); c.beginPath(); c.rect(x0, GROUND, x1 - x0, H - GROUND + 20); c.clip();
  for (let x = -(worldX % P) - P; x < x1; x += P) if (x + P > x0) c.drawImage(e.c, x, GROUND, P, H + 20 - GROUND);
  c.restore();
}
function ground(c) {
  const zc = zoneOfM(dist), bound = (Math.floor(Math.max(0, dist) / ZLEN) + 1) * ZLEN * 40, bx = bound - worldX + ABX;
  groundSeg(c, zc, -20, Math.min(W + 20, bx)); if (bx < W + 20) groundSeg(c, (zc + 1) % ZONES.length, Math.max(-20, bx), W + 20);
  if (!PITG) { PITG = c.createLinearGradient(0, GROUND, 0, H); PITG.addColorStop(0, '#3a2418'); PITG.addColorStop(1, '#120a06'); }
  for (const g of gaps) { const x0 = g.x0 - worldX + ABX, x1 = g.x1 - worldX + ABX; if (x1 < 0 || x0 > W) continue;
    c.fillStyle = PITG; c.fillRect(x0, GROUND, x1 - x0, H - GROUND + 20); c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(x0, GROUND, 6, H - GROUND + 20); c.fillRect(x1 - 6, GROUND, 6, H - GROUND + 20);
    c.strokeStyle = INK; c.lineWidth = 2; c.beginPath(); c.moveTo(x0, GROUND); c.lineTo(x0, H + 20); c.moveTo(x1, GROUND); c.lineTo(x1, H + 20); c.stroke(); }
}
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
  for (let k = 0; k < p.w; k += 16) { c.fillStyle = (k / 16) % 2 ? b : a; c.fillRect(x + k, p.y, Math.min(16, p.w - k), 12); }
  c.strokeStyle = INK; c.lineWidth = 1.4;
  for (let k = 0; k < p.w - 8; k += 16) { c.fillStyle = (k / 16) % 2 ? b : a; c.beginPath(); c.arc(x + k + 8, p.y + 12, 8, 0, Math.PI); c.fill(); c.stroke(); }
  c.lineWidth = 2; c.strokeRect(x, p.y, p.w, 12);
}
function foreground(c, z) {
  const off = worldX * 1.35, tw = 620;
  c.fillStyle = 'rgba(30,18,12,.82)'; c.strokeStyle = 'rgba(30,18,12,.82)';
  for (let i = Math.floor(off / tw) - 1; i <= Math.floor((off + W) / tw) + 1; i++) { const r = sr(i * 9.7 + z); if (r < 0.45) continue; const x = i * tw - off + r * 200;
    if (z === 0 || z === 3) { c.beginPath(); c.arc(x, H + 6, 34, 0, TAU); c.arc(x + 36, H + 12, 28, 0, TAU); c.fill(); }
    else if (z === 1) { c.fillRect(x, H - 36, 10, 36); c.beginPath(); c.arc(x + 5, H - 36, 5, 0, TAU); c.fill(); c.fillRect(x + 90, H - 36, 10, 36); c.beginPath(); c.arc(x + 95, H - 36, 5, 0, TAU); c.fill(); }
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
  if (!banner) return; const bt = banner.t, z = ZONES[banner.z], L = getLang(), big = z[L], small = T('area', banner.z + 1);
  const e = bt < 0.5 ? 1 - Math.pow(1 - bt / 0.5, 3) : bt > 2.8 ? 1 - (bt - 2.8) / 0.6 : 1; const y = -offY * 0.3 + 60 + (e - 1) * 90;
  c.save(); c.globalAlpha = clamp(e, 0, 1); c.translate(W / 2, y + 46); c.rotate(Math.sin(bt * 3) * 0.02);
  c.font = '800 28px ' + FONT; const w1 = c.measureText(big).width; c.font = '800 18px ' + FONT; const w = Math.max(w1, c.measureText(small).width) + 50;
  c.fillStyle = '#f3dfb8'; c.strokeStyle = INK; c.lineWidth = 3; c.beginPath(); c.roundRect(-w / 2, -34, w, 66, 14); c.fill(); c.stroke();
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillStyle = '#c8202b'; c.font = '800 17px ' + FONT; c.fillText(small, 0, -15);
  c.fillStyle = INK; c.font = '800 28px ' + FONT; c.fillText(big, 0, 12); c.restore();
}
function star(c, x, y, r) { c.beginPath(); for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2, rr = i % 2 ? r * 0.45 : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } c.closePath(); c.fill(); c.stroke(); }

function render() {
  lights.length = 0; tileBudget = 2; sprBudget = 6;
  SK = skyAt((0.14 + dist / 1700) % 1);
  const zf = Math.max(0, dist) / ZLEN, A = zoneOfM(dist), B = (A + 1) % ZONES.length, fr = zf - Math.floor(zf), blend = fr > 0.93 ? (fr - 0.93) / 0.07 : 0;
  ctx.setTransform(RES, 0, 0, RES, 0, offY * RES);
  if (shake > 0 && !REDUCED) ctx.translate(rnd(-3, 3) * shake * 3, rnd(-3, 3) * shake * 3);
  if (camZ > 1.001) { const cx = ABX, cy = GROUND - 60; ctx.translate(cx, cy); ctx.scale(camZ, camZ); ctx.translate(-cx, -cy); }
  sky(ctx); clouds(ctx);
  layer('far', A, B, blend); haze(ctx, GROUND - 230, 0.38); drawBirds(ctx); layer('midfar', A, B, blend); haze(ctx, GROUND - 120, 0.22); layer('mid', A, B, blend); layer('near', A, B, blend);
  if (SK.n > 0.02) { ctx.fillStyle = `rgba(12,16,48,${SK.n * 0.42})`; ctx.fillRect(-20, -offY - 20, W + 40, GROUND + offY + 22); }
  ground(ctx);
  if (SK.n > 0.02) { ctx.fillStyle = `rgba(12,16,48,${SK.n * 0.28})`; ctx.fillRect(-20, GROUND, W + 40, H - GROUND + 20); }
  drawLights(ctx);
  ctx.textBaseline = 'alphabetic';
  for (const p of plats) platform(ctx, p);
  for (const it of items) if (!it.got) { const x = it.x - worldX + ABX; if (x > -30 && x < W + 30) drawItem(ctx, it.kind, x, it.y, it.c || it.x * 0.01, it.mag); }
  for (const o of obs) { const x = o.x - worldX + ABX; if (x > -120 && x < W + 80) drawObstacle(ctx, o, x); }
  for (const s of sandals) { ctx.save(); ctx.translate(s.sx, s.y); ctx.rotate(s.rot); ctx.translate(0, -7); sandalShape(ctx); ctx.restore(); }
  const fx = dadScreenX();
  ctx.fillStyle = 'rgba(0,0,0,.18)';
  if (st !== 'over') { ctx.beginPath(); ctx.ellipse(fx, GROUND + 2, 20 * (1 - Math.min(0.6, (GROUND - dad.y) / 300)), 4, 0, 0, TAU); ctx.fill(); }
  if (kid.y <= GROUND + 2 && st !== 'over') { ctx.beginPath(); ctx.ellipse(ABX, GROUND + 2, 13 * (1 - Math.min(0.6, (GROUND - kid.y) / 300)), 3, 0, 0, TAU); ctx.fill(); }
  if (st === 'over') {
    const dx = ABX - 40; ctx.beginPath(); ctx.ellipse(dx, GROUND + 2, 22, 4, 0, 0, TAU); ctx.fill();
    drawDad(ctx, dx, GROUND, true); drawKid(ctx, dx + 9, GROUND - 34 + Math.sin(t * 8) * 1.5, kid.ph, false, 1, { kick: 1, mouth: 'o', arm: 'o', rot: 0.12, sweat: 1 });
  } else {
    drawDad(ctx, fx, dad.y);
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
  if (st === 'play' && (boost > 0 || kid.scoot > 0) && !REDUCED) { ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 2; ctx.beginPath(); for (let i = 0; i < 10; i++) { const y = 40 + sr(i * 3.3) * 280, x = ((sr(i) * W - t * 1400) % W + W) % W; ctx.moveTo(x, y); ctx.lineTo(x + 40 + sr(i) * 60, y); } ctx.stroke(); }
  if (sandMotes.length && zoneOfM(dist) === 4) { ctx.strokeStyle = 'rgba(255,225,170,.45)'; ctx.lineWidth = 1.5; ctx.beginPath(); for (const m of sandMotes) { ctx.moveTo(m.x, m.y); ctx.lineTo(m.x + m.l, m.y + 1); } ctx.stroke(); }
  if (qLevel < 3) foreground(ctx, zoneOfM(dist));
  const dsx = st === 'over' ? ABX - 40 : fx;
  if (dad.sayT > 0) bubble(ctx, Math.max(60, dsx + 10), (st === 'over' ? GROUND : dad.y) - 104, dad.say);
  if (kid.sayT > 0 && st !== 'over') bubble(ctx, ABX + 18, kid.y - 74, kid.say, true);
  if (kid.sayT > 0 && st === 'over' && stT > 0.5) bubble(ctx, ABX + 30, GROUND - 100, kid.say, true);
  if (st === 'play' && lead < 0.25) { const a = (0.25 - lead) * 2 * (0.6 + 0.4 * Math.sin(t * 10)); const g = ctx.createLinearGradient(0, 0, W * 0.3, 0);
    g.addColorStop(0, 'rgba(200,32,43,' + a + ')'); g.addColorStop(1, 'rgba(200,32,43,0)'); ctx.fillStyle = g; ctx.fillRect(-10, -offY, W * 0.3, H + offY); }
  drawBanner(ctx);
  if (st === 'pause') { ctx.fillStyle = 'rgba(20,15,35,.55)'; ctx.fillRect(-20, -offY - 20, W + 40, H + offY + 40); ctx.fillStyle = '#fffaf0'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.font = '800 34px ' + FONT; ctx.fillText(T('paused'), W / 2, 170); ctx.font = '600 16px ' + FONT; ctx.fillText(T('pausedHint'), W / 2, 202); }
}

// ---------- menus: avatar, dirhams, boosters, sheets ----------
function syncCoins() { const v = T('coins', M.data().coins); document.querySelectorAll('.coinVal').forEach(e => { e.textContent = v; }); }
let noteT = 0;
function note(msg) { const n = $('note'); n.textContent = msg; n.hidden = false; clearTimeout(noteT); noteT = setTimeout(() => { n.hidden = true; }, 1800); }
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
const BCOL = { first: '#4a90e2', dist500: '#9aa3b2', dist1000: '#e3b23c', dist2000: '#e3b23c', zone1: '#2b6cb0', zone2: '#1f9e8f', zone3: '#a8322d', sweets100: '#ff5a5f', sweets1000: '#d94a7a',
  close10: '#7a3f8e', sandal10: '#8a4b25', smash10: '#e23b4a', powers: '#33b679', streak7: '#2c5d9e', shopper: '#f28c28', revived: '#1f7a74' };
function drawMedal(c, id, on, size) {
  c.setTransform(size / 40, 0, 0, size / 40, 0, 0); c.clearRect(0, 0, 40, 40); c.lineJoin = 'round';
  c.fillStyle = on ? '#c8202b' : '#b9b3a5'; c.beginPath(); c.moveTo(10, 1); c.lineTo(18, 1); c.lineTo(22, 14); c.lineTo(15, 14); c.closePath(); c.fill();
  c.fillStyle = on ? '#1f7a74' : '#a9a397'; c.beginPath(); c.moveTo(22, 1); c.lineTo(30, 1); c.lineTo(25, 14); c.lineTo(18, 14); c.closePath(); c.fill();
  c.fillStyle = on ? BCOL[id] || '#e3b23c' : '#cfc9ba'; c.strokeStyle = INK; c.lineWidth = 1.6; c.beginPath(); c.arc(20, 25, 13, 0, TAU); c.fill(); c.stroke();
  c.strokeStyle = on ? 'rgba(255,255,255,.55)' : 'rgba(255,255,255,.4)'; c.lineWidth = 1.2; c.beginPath(); c.arc(20, 25, 10, 0, TAU); c.stroke();
  c.fillStyle = '#fffaf0'; c.strokeStyle = INK; c.lineWidth = 1; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = '800 8px ' + FONT;
  const txt = { dist500: '500', dist1000: '1K', dist2000: '2K', streak7: '7', zone1: '2', zone2: '3', zone3: '4' }[id];
  if (txt) { c.fillText(txt, 20, 25.5); }
  else if (id === 'sweets100' || id === 'sweets1000') { c.save(); c.translate(20, 25); c.scale(0.7, 0.7); drawItem(c, 'candy', 0, 0, 1, true); c.restore(); }
  else if (id === 'sandal10') { c.save(); c.translate(20, 26); c.rotate(1.1); c.translate(0, -7); c.scale(0.9, 0.9); sandalShape(c); c.restore(); }
  else if (id === 'smash10' || id === 'powers' || id === 'first' || id === 'shopper' || id === 'close10' || id === 'revived') {
    c.save(); c.translate(20, 25); c.fillStyle = '#fffaf0';
    if (id === 'first') { c.fillRect(-5, -7, 2, 14); c.beginPath(); c.moveTo(-3, -7); c.lineTo(7, -4); c.lineTo(-3, -1); c.fill(); }
    else if (id === 'close10') { c.beginPath(); c.moveTo(2, -8); c.lineTo(-5, 1); c.lineTo(0, 1); c.lineTo(-2, 8); c.lineTo(5, -1); c.lineTo(0, -1); c.closePath(); c.fill(); }
    else if (id === 'revived') { c.beginPath(); c.moveTo(0, 7); c.bezierCurveTo(-10, 0, -6, -8, 0, -3); c.bezierCurveTo(6, -8, 10, 0, 0, 7); c.fill(); }
    else if (id === 'shopper') { c.beginPath(); c.arc(0, 0, 6, 0, TAU); c.fill(); c.fillStyle = BCOL.shopper; c.font = '800 7px ' + FONT; c.fillText(getLang() === 'ar' ? 'د' : 'D', 0, 0.5); }
    else { star(c, 0, 0, 7); }
    c.restore(); }
}
function drawBoosterIcon(c, id, size) {
  c.setTransform(size / 40, 0, 0, size / 40, 0, 0); c.clearRect(0, 0, 40, 40);
  if (id === 'vimto') drawItem(c, 'vimto', 20, 22, 0, true);
  else if (id === 'magnet') drawItem(c, 'magnet', 20, 20, 0, true);
  else if (id === 'headstart') drawItem(c, 'scooter', 20, 18, 0, true);
  else if (id === 'shield') { c.fillStyle = '#8fd3ff'; c.strokeStyle = INK; c.lineWidth = 1.8; c.beginPath(); c.moveTo(20, 6); c.lineTo(32, 11); c.quadraticCurveTo(32, 28, 20, 35); c.quadraticCurveTo(8, 28, 8, 11); c.closePath(); c.fill(); c.stroke(); c.fillStyle = '#fff'; c.fillRect(18, 13, 4, 14); c.fillRect(13, 18, 14, 4); }
  else if (id === 'revive') { c.fillStyle = '#e23b4a'; c.strokeStyle = INK; c.lineWidth = 1.8; c.beginPath(); c.moveTo(20, 33); c.bezierCurveTo(2, 20, 8, 5, 20, 13); c.bezierCurveTo(32, 5, 38, 20, 20, 33); c.fill(); c.stroke(); c.fillStyle = 'rgba(255,255,255,.6)'; c.beginPath(); c.arc(14, 15, 3, 0, TAU); c.fill(); }
}
function renderMenu() {
  syncCoins(); $('avName').textContent = kname();
  const hk = document.querySelector('.chase span:last-child'); if (hk) hk.textContent = kname();
  const D = M.data(), row = $('boostRow'); row.innerHTML = '';
  const ids = ['vimto', 'magnet', 'headstart', 'shield'].filter(id => (D.boosters[id] || 0) > 0);
  if (!ids.length) row.appendChild(el('span', 'hint', T('noBoosters')));
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
  sheetKind = kind; const body = $('sheetBody'); body.innerHTML = ''; $('sheet').hidden = false; syncCoins();
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
function buyOrEquip(kind, id, price) {
  const D = M.data();
  if (!D.owned[kind].includes(id)) { if (!M.buy(kind, id)) { note(T('notEnough')); return; } note(T('bought')); }
  M.equip(kind, id); openSheet('wardrobe');
}
function sheetWardrobe(body) {
  const D = M.data();
  const section = (title, list, kind, lookFor, label) => {
    body.appendChild(el('p', 'sec-title', T(title))); const g = el('div', 'cards');
    for (const it of list) {
      const owned = D.owned[kind].includes(it.id), on = D[kind] === it.id, locked = it.badge && !owned;
      g.appendChild(card(cnv => drawAvatar(cnv, lookFor(it.id), 0.6, 'grin', true), T(label + it.id), locked ? T('badgeOnly') : null,
        { text: on ? T('wearing') : owned ? T('wear') : locked ? T('bg_locked') : T('buy', it.price), cls: owned ? 'sec' : '', disabled: on || locked, onClick: () => buyOrEquip(kind, it.id) }, on, locked));
    }
    body.appendChild(g);
  };
  section('w_avatar', M.AVATARS, 'avatar', id => lookOf(D.robe, D.head, id), 'av_');
  section('w_robes', M.ROBES, 'robe', id => lookOf(id, D.head, D.avatar), 'r_');
  section('w_heads', M.HEADS, 'head', id => lookOf(D.robe, id, D.avatar), 'h_');
}
function sheetShop(body) {
  body.appendChild(el('p', 'hint', T('shopNote'))); const g = el('div', 'cards'); const D = M.data();
  for (const b of M.BOOSTERS) g.appendChild(card(cnv => drawBoosterIcon(cnv.getContext('2d'), b.id, 192), T('bo_' + b.id), T('bo_' + b.id + '_d') + ' · ' + T('have', D.boosters[b.id] || 0),
    { text: T('buy', b.price), onClick: () => { if (M.buy('booster', b.id)) { note(T('bought')); openSheet('shop'); } else note(T('notEnough')); } }));
  body.appendChild(g);
}
function sheetBadges(body) {
  const D = M.data(), n = M.BADGES.filter(b => D.badges[b.id]).length;
  body.appendChild(el('p', 'sec-title', T('bg_count', n, M.BADGES.length))); const g = el('div', 'cards');
  for (const b of M.BADGES) { const on = !!D.badges[b.id];
    g.appendChild(card(cnv => drawMedal(cnv.getContext('2d'), b.id, on, 192), T('bg_' + b.id), T('bg_' + b.id + '_d') + ' · ' + (on ? T('bg_reward', b.reward) + ' ✓' : T('bg_reward', b.reward)), null, false, !on)); }
  body.appendChild(g);
}
function loginRow(wrap) {
  const st2 = M.loginStatus(), cur = st2.canClaim ? st2.streak : M.data().login.streak; wrap.innerHTML = '';
  M.LOGIN.forEach((r, k) => { const d = el('div', (k + 1 < cur || (!st2.canClaim && k + 1 <= cur)) ? 'done' : (st2.canClaim && k + 1 === Math.min(cur, 7)) ? 'today' : ''); d.appendChild(el('span', null, T('lg_day', k + 1))); d.appendChild(el('b', null, String(r))); wrap.appendChild(d); });
}
function sheetMissions(body) {
  const st2 = M.loginStatus();
  body.appendChild(el('p', 'sec-title', T('lg_title'))); const days = el('div', 'login-days'); loginRow(days); body.appendChild(days);
  if (st2.canClaim) { const b = el('button', 'btn', T('lg_claim', st2.reward)); b.type = 'button'; b.onclick = () => { const got = M.claimLogin(); note(T('coins', '+' + got)); openSheet('missions'); }; body.appendChild(b); }
  else body.appendChild(el('p', 'hint', T('lg_done')));
  body.appendChild(el('p', 'sec-title', T('ms_title'))); body.appendChild(el('p', 'hint', T('ms_note')));
  const bon = el('p', 'label', (M.ensureDaily().bonus ? '✓ ' : '') + T('ms_bonus', M.DAILY_BONUS)); body.appendChild(bon);
  M.ensureDaily().missions.forEach((m, i) => {
    const row = el('div', 'mission'); const txt = el('div'); txt.appendChild(el('b', null, T('ms_' + m.kind, m.goal))); txt.appendChild(el('div', 'hint', T('bg_reward', m.reward))); row.appendChild(txt);
    const b = el('button', null, m.claimed ? T('claimed') : T('claim')); b.type = 'button'; b.disabled = m.claimed || m.progress < m.goal;
    b.onclick = () => { const got = M.claimMission(i); if (got) note(T('coins', '+' + got)); openSheet('missions'); }; row.appendChild(b);
    const pr = el('div', 'prog'); const fill = el('i'); fill.style.width = Math.min(100, m.progress / m.goal * 100) + '%'; pr.appendChild(fill); row.appendChild(pr);
    body.appendChild(row);
  });
}
function sheetHelp(body) {
  body.appendChild(el('p', null, T('hint')));
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
function drawIcons() {}

// ---------- frame loop + automatic quality ----------
let last = 0, fAcc = 0, fN = 0, slowWins = 0, running = false;
function perf(raw) {
  if (st !== 'play' || raw > 0.1) return;
  fAcc += raw; fN++;
  if (fN >= 90) { const avg = fAcc / fN; fAcc = 0; fN = 0;
    if (avg > 1 / 42) { if (++slowWins >= 2 && qLevel < QDPR.length - 1) { qLevel++; slowWins = 0; resize(); } } else slowWins = 0; }
}
function loop(now) {
  const raw = last ? (now - last) / 1000 : 0.016; last = now;
  perf(raw); update(clamp(raw, 0, 0.033)); render();
  if (!$('menu').hidden) drawAvatar($('avMenu'), kidBase(), t * 8, kid.sayT > 0 ? 'tongue' : 'grin', false);
  else if (!$('over').hidden) drawAvatar($('avOver'), kidBase(), t * 3, 'o', true);
  requestAnimationFrame(loop);
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
  applyLang(); setMuteBtn(); syncRotate(); showBest();
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
  reset(); st = 'menu'; t = 0; $('mute').hidden = false;
  if (hasStoredLang()) showMenu(); else $('langPick').hidden = false;
  if (!running) { running = true; requestAnimationFrame(loop); }
}

// test / tooling hook
window.__abood = {
  get say() { return dad.sayT > 0 ? dad.say : ''; },
  get state() { return { st, dist, lead, zone: zoneNow, qLevel, res: RES, bakeRes, tiles: TILES.size, sprites: SPR.size, build: BUILD }; },
  goto: d => { worldX = d * 40; dist = d; zoneNow = zoneOfM(d); genX = worldX + 500; gaps = []; obs = []; items = []; plats = []; lead = 0.6; },
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
