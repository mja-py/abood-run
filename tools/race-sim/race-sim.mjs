// The defaults below match the game as shipped. Run: node tools/race-sim/exp.mjs 1000 (see README.md).
// Headless model of an Abood Run online sprint race, copied from js/game.js (race paths only):
// course generation (gen/addObs/box/power), kid physics, obstacles, holes (sprintFell), luck boxes (luckTier/luckRoll),
// marbles (marblesIn/raceMarbles), stumbles (hitKid). Two bots race on the same seeded course and swap positions over
// a simulated network. Bots plan jumps from what is on screen and press with human-like timing noise.
export const DEFAULT_CFG = {
  SPRINT_M: 600, SPRINT_HARD: 2000, RACE_STUMBLE: 1.1, RACE_SLIP: 0.5, MB_SPEED: 560, MB_WARN: 0.6, MB_GAP: 1,
  VIMTO: 4, SCOOTER: 5, FAR_MUL: 1.4, VIMTO_K: 1.3, SCOOT_K: 1.42, FELL_HOLD: 1.5,
  LUCK: {
    lead: [['shield', 60], ['vimto', 40]],
    close: [['vimto', 45], ['marbles', 40], ['shield', 15]],
    behind: [['scooter', 45], ['vimto', 30], ['marbles', 25]],
    far: [['scooter', 65], ['vimto', 25], ['marbles', 10]],
  },
  TIERS: [-6, 6, 25], // gap <= -6 lead, < 6 close, < 25 behind, else far
  AIM_SLACK: 3, // marbles only if the friend is at least this close behind you (o.d >= dist - 3)
  luckOff: false, // true: boxes give nothing (baseline)
  flat: false, // true: every tier uses the 'close' table (no rubber band)
  MB_N: 3, MB_SPACE: 0.2, MB_SLIP: 1.5, DRAFT: [4, 30, 0.08], // DRAFT: [from m, to m, max bonus]
};
const H = 400, GROUND = 330, W = 866, ABX = 360, DT = 1 / 60;
const ZONE_OBS = [
  ['basket', 'ball', 'crab', 'cooler', 'cat', 'castle'], ['sack', 'carpet', 'dallah', 'cat', 'mandoos', 'wood'],
  ['escooter', 'cone', 'dbag', 'dbike', 'flower', 'box'], ['crab', 'cooler', 'ball', 'castle', 'cone', 'escooter'],
  ['ring', 'cooler', 'ball', 'crab', 'flower', 'castle'], ['escooter', 'ball', 'ring', 'dbag', 'cone', 'cooler'],
  ['escooter', 'cone', 'dbag', 'flower', 'box', 'ball'], ['gbag', 'cart', 'ball', 'flower', 'cone', 'basket'],
  ['basket', 'ball', 'cat', 'flower', 'cooler', 'escooter'], ['goat', 'sack', 'rock', 'bush', 'dallah', 'basket'],
  ['escooter', 'ball', 'dbag', 'cone', 'flower', 'ring'],
];
const OB = { box: { w: 34, h: 32 }, bin: { w: 30, h: 46 }, cat: { w: 34, h: 30 }, cone: { w: 24, h: 36 }, goat: { w: 44, h: 38, vx: -45 }, ball: { w: 22, h: 22, bounce: 1, vx: -60 },
  sack: { w: 30, h: 36 }, carpet: { w: 58, h: 20 }, crab: { w: 30, h: 18, side: 1 }, cooler: { w: 40, h: 30 }, rock: { w: 42, h: 28 }, bush: { w: 38, h: 30 }, lizard: { w: 46, h: 14, vx: -110 },
  bike: { w: 44, h: 30 }, gas: { w: 22, h: 36 }, dbag: { w: 32, h: 30 }, dbike: { w: 60, h: 54, vx: -170 }, crate: { w: 32, h: 40 }, chairs: { w: 30, h: 46 },
  castle: { w: 40, h: 28 }, mandoos: { w: 36, h: 32 }, ring: { w: 30, h: 30, vx: -40 }, gbag: { w: 22, h: 40 }, cart: { w: 50, h: 40, vx: -120 }, escooter: { w: 40, h: 38 }, basket: { w: 32, h: 24 }, flower: { w: 30, h: 32 }, dallah: { w: 28, h: 34 }, wood: { w: 44, h: 20 }, buggy: { w: 58, h: 38, vx: -150 } };
const seeded = a => () => { a = (a + 0x6D2B79F5) | 0; let x = Math.imul(a ^ (a >>> 15), 1 | a); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
const runSpeed = d => 310 + Math.min(260, d * 0.05);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

export function makeRng(s) { return seeded(s); }

// ---------- one player's game ----------
function newPlayer(seed, zone, cfg, rng) {
  const P = { cfg, rng, crand: seeded(seed), zobs: ZONE_OBS[zone], genX: 900, worldX: 0, dist: 0, playT: 0, runT: 0,
    gaps: [], plats: [], obs: [], items: [], sandals: [], mbQ: [], boxes: new Set(), boost: 0,
    kid: { y: GROUND, vy: 0, on: true, jumps: 0, coyote: 0, buf: 0, inv: 0, stumble: 0, scoot: 0, shield: 0, held: 0 },
    holding: false, fin: null, stats: { hits: 0, obsHits: 0, mbHits: 0, mbDodged: 0, mbBlocked: 0, falls: 0, shieldSaves: 0, boxes: 0, boxSeen: 0, got: {}, tierGot: {}, mbSent: 0, smash: 0, lostHit: 0, lostFall: 0 },
    opp: { d: 0, run: true, out: false, tm: null }, out: [] };
  return P;
}
function addObs(P, x, k) { P.obs.push({ x, x0: x, kind: k, w: OB[k].w, h: OB[k].h, hit: false, lift: 0, seed: P.crand() * 6 }); }
function box(P, x, y) { P.crand(); P.items.push({ x, y, kind: 'luck' }); P.boxes.add(Math.round(x)); } // power() draws crand once, then 'luck'
function gen(P) {
  const crand = P.crand, crnd = (a, b) => a + crand() * (b - a), cpick = a => a[Math.floor(crand() * a.length)];
  while (P.genX < P.worldX + W + 400) {
    const z = P.zobs, r = crand(), gd = Math.max(0, (P.genX - 900) / 40) + P.cfg.SPRINT_HARD, hard = Math.min(1, gd / 8000), spread = Math.sqrt(runSpeed(gd) / 320);
    let genX = P.genX;
    if (r < 0.34) {
      const k = cpick(z); addObs(P, genX, k);
      if (crand() < 0.5) {} // candy arc
      if (crand() < 0.12 + hard * 0.38) { const dx = crnd(200, 250) * spread; addObs(P, genX + dx, cpick(z)); genX += dx; }
      genX += crnd(270, 450) * spread;
    } else if (r < 0.52) {
      const w = crnd(85, 110 + hard * 50); P.gaps.push({ x0: genX, x1: genX + w }); genX += w + crnd(250, 340);
    } else if (r < 0.72) {
      const w = crnd(170, 260), y = GROUND - crnd(85, 120); P.plats.push({ x: genX, y, w });
      if (crand() < 0.4) { const gw = Math.min(w - 40, crnd(90, 140)); P.gaps.push({ x0: genX + 20, x1: genX + 20 + gw }); }
      if (crand() < 0.4) box(P, genX + w / 2, y - 34);
      genX += w + crnd(230, 320);
    } else if (r < 0.88) {
      if (crand() < 0.1 * (1 - 0.8)) { box(P, genX + 100, GROUND - 74); P.genX = genX + 260; continue; }
      crand(); genX += crnd(280, 360);
    } else {
      box(P, genX, GROUND - 74); genX += crnd(260, 340);
    }
    P.genX = genX;
  }
  const cut = P.worldX - ABX - 200;
  P.gaps = P.gaps.filter(g => g.x1 > cut); P.plats = P.plats.filter(p => p.x + p.w > cut);
  P.obs = P.obs.filter(o => o.x + 80 > cut && !o.gone); P.items = P.items.filter(i => i.x > cut && !i.got);
}
const overGap = (P, x, m = 5) => { for (const g of P.gaps) if (x > g.x0 + m && x < g.x1 - m) return true; return false; };

function luckTier(P) {
  const c = P.cfg; if (c.flat) return 'close';
  const o = P.opp, gap = (o.out && o.tm != null ? c.SPRINT_M : o.d) - P.dist;
  return gap <= c.TIERS[0] ? 'lead' : gap < c.TIERS[1] ? 'close' : gap < c.TIERS[2] ? 'behind' : 'far';
}
function luckRoll(P) {
  const c = P.cfg, tier = luckTier(P), o = P.opp, k = P.kid;
  const aim = o.run && !o.out && o.d >= P.dist - c.AIM_SLACK;
  let pool = c.LUCK[tier].filter(([kk]) => (kk !== 'marbles' || aim) && (kk !== 'shield' || !k.shield));
  if (!pool.length) pool = [['vimto', 1]];
  let r = P.rng() * pool.reduce((a, p) => a + p[1], 0), kind = pool[0][0];
  for (const [kk, w] of pool) { if ((r -= w) < 0) { kind = kk; break; } }
  return { kind, tier, mul: tier === 'far' ? c.FAR_MUL : 1 };
}
function hitKid(P, src) {
  const k = P.kid, s = P.stats;
  if (k.shield > 0) { k.shield = 0; k.inv = 1.2; s.shieldSaves++; return 'shield'; }
  k.stumble = src === 'mb' && P.cfg.MB_SLIP ? P.cfg.MB_SLIP : P.cfg.RACE_STUMBLE; k.inv = 1.3; s.hits++; if (src === 'mb') s.mbHits++; else s.obsHits++; return 'hit';
}
function sprintFell(P) {
  let x1 = P.worldX; for (const g of P.gaps) if (g.x0 < P.worldX + 20 && g.x1 > P.worldX - 260) x1 = Math.max(x1, g.x1);
  P.worldX = x1 + 30; P.dist = P.worldX / 40;
  Object.assign(P.kid, { y: GROUND, vy: 0, on: true, jumps: 0, inv: 1.8, held: P.cfg.FELL_HOLD }); P.stats.falls++;
}
function grab(P, it, send) {
  const c = P.cfg; P.stats.boxes++;
  if (c.luckOff) return;
  const l = luckRoll(P), s = P.stats; s.got[l.kind] = (s.got[l.kind] || 0) + 1; s.tierGot[l.tier + ':' + l.kind] = (s.tierGot[l.tier + ':' + l.kind] || 0) + 1;
  if (l.kind === 'shield') P.kid.shield = 1;
  if (l.kind === 'marbles') { s.mbSent++; send({ t: 'mb', x: Math.round(it.x) }); return; }
  if (l.kind === 'vimto') P.boost = Math.max(P.boost, c.VIMTO * l.mul);
  if (l.kind === 'scooter') P.kid.scoot = Math.max(P.kid.scoot, c.SCOOTER * l.mul);
}
export function marblesIn(P) { const c = P.cfg; for (let i = 0; i < c.MB_N; i++) { const q = P.mbQ, prev = q.length ? q[q.length - 1] : -1; q.push(Math.max(c.MB_WARN + i * c.MB_SPACE, prev + (i ? c.MB_SPACE : 0.35))); (P.mbAnn || (P.mbAnn = [])).push(P.playT); } }

// one frame of update() for a race (sim=true: a bot's look-ahead, no side effects outside P)
function step(P, dt, press, send, sim) {
  const c = P.cfg, k = P.kid;
  P.playT += dt; P.runT += dt;
  let base = runSpeed(P.dist);
  if (c.DRAFT) { const g = P.opp.d - P.dist, [d0, d1, mx] = c.DRAFT; if (!P.opp.out && g > d0) base *= 1 + mx * clamp((g - d0) / (d1 - d0), 0, 1); }
  const speed = base * Math.max(P.boost > 0 ? c.VIMTO_K : 1, k.scoot > 0 ? c.SCOOT_K : 1) * (k.stumble > 0 ? c.RACE_SLIP : 1) * (k.held > 0 ? 0 : 1);
  const preX = P.worldX;
  P.worldX += speed * dt; P.dist = P.worldX / 40;
  if (P.dist >= c.SPRINT_M) { const over = (P.dist - c.SPRINT_M) / Math.max(1, speed / 40); P.fin = Math.max(0, P.runT - over); return 'fin'; }
  P.boost = Math.max(0, P.boost - dt); k.scoot = Math.max(0, k.scoot - dt); k.inv = Math.max(0, k.inv - dt); k.stumble = Math.max(0, k.stumble - dt); k.held = Math.max(0, k.held - dt);
  if (press === 'down') { k.buf = 0.13; P.holding = true; } else if (press === 'up') P.holding = false;
  k.buf -= dt; k.coyote -= dt;
  if (k.buf > 0) {
    if (k.on || k.coyote > 0) { k.vy = -760; k.on = false; k.jumps = 1; k.coyote = 0; k.buf = 0; }
    else if (k.jumps < 2) { k.vy = -650; k.jumps = 2; k.buf = 0; }
  }
  k.vy += 2300 * dt * (!P.holding && k.vy < 0 ? 2.2 : 1);
  const py = k.y; k.y += k.vy * dt; k.on = false;
  if (k.vy >= 0) {
    for (const p of P.plats) { if (P.worldX + 8 > p.x && P.worldX - 8 < p.x + p.w && py <= p.y + 1 && k.y >= p.y) { k.y = p.y; k.vy = 0; k.on = true; k.jumps = 0; break; } }
    if (!k.on && !overGap(P, P.worldX) && py <= GROUND + 1 && k.y >= GROUND) { k.y = GROUND; k.vy = 0; k.on = true; k.jumps = 0; }
  }
  if (k.on) k.coyote = 0.1;
  if (sim && k.y > GROUND + 12) return 'fall'; // a look-ahead only needs to know it is going down a hole
  if (k.y > H + 40) { const x0 = P.worldX; sprintFell(P); P.stats.lostFall += 0; return 'fell'; }
  let ev = null;
  for (const o of P.obs) {
    const d = OB[o.kind];
    if (o.hit) continue;
    if (d.vx) { const nx = o.x + d.vx * dt; if (!overGap(P, nx, 0) && !overGap(P, nx + o.w, 0)) o.x = nx; }
    if (d.side) o.x = o.x0 + Math.sin(P.playT * 2.4 + o.seed) * 26;
    o.lift = d.bounce ? Math.abs(Math.sin(P.playT * 4.2 + o.seed)) * 46 : 0;
    const top = GROUND - o.lift - o.h, bot = GROUND - o.lift;
    const ox = P.worldX + 9 > o.x + 4 && P.worldX - 9 < o.x + o.w - 4;
    if (ox && k.y > top + 4 && k.y - 54 < bot) {
      if (k.scoot > 0) { o.hit = true; if (!sim) P.stats.smash++; }
      else if (k.inv <= 0) { if (sim) return 'hit'; const r = hitKid(P, 'ob'); o.hit = true; ev = r; }
    }
  }
  for (const s of P.sandals) {
    if (s.hit) continue;
    s.sx += c.MB_SPEED * dt;
    if (Math.abs(s.sx - ABX) < 20 && k.y > GROUND - 14) { s.hit = true; if (k.scoot <= 0 && k.inv <= 0) { if (sim) return 'hit'; hitKid(P, 'mb'); } else if (!sim) P.stats.mbBlocked++; }
    if (!s.passed && s.sx > ABX + 16) { s.passed = true; if (!s.hit && !sim) P.stats.mbDodged++; }
  }
  P.sandals = P.sandals.filter(s => !s.hit && s.sx < W + 60);
  for (const it of P.items) {
    if (it.got) continue;
    const dx = it.x - P.worldX, dy = it.y - (k.y - 30);
    if (dx * dx + dy * dy < 32 * 32) { it.got = true; if (sim) { P.simGot = 1; continue; } grab(P, it, send); }
  }
  const q = P.mbQ;
  if (q.length) { for (let i = 0; i < q.length; i++) q[i] -= dt; while (q.length && q[0] <= 0) { q.shift(); if (P.mbAnn) P.mbAnn.shift(); P.sandals.push({ sx: -30, hit: false, passed: false }); } }
  if (!sim) gen(P);
  return ev;
}

// ---------- bot ----------
function cloneP(P) {
  return { cfg: P.cfg, rng: P.rng, worldX: P.worldX, dist: P.dist, playT: P.playT, runT: P.runT, boost: P.boost, holding: P.holding,
    kid: { ...P.kid }, gaps: P.gaps, plats: P.plats, obs: P.obs.filter(o => !o.hit && o.x > P.worldX - 80 && o.x < P.worldX + 900).map(o => ({ ...o })),
    items: P.items.filter(i => !i.got && i.x > P.worldX - 40 && i.x < P.worldX + 600).map(i => ({ ...i })), sandals: P.sandals.map(s => ({ ...s })), mbQ: P.mbQ.filter((_, i) => !P.mbAnn || P.playT - P.mbAnn[i] >= (P.react || 0)), stats: P.stats, opp: P.opp };
}
// look ahead: press at frame `at` (or never), hold for the whole jump; returns 'ok' / 'hit' / 'fall' and whether a box was taken
function look(P, at, frames, until = 0) {
  const S = cloneP(P); let landed = false, air = false;
  for (let f = 0; f < frames; f++) {
    const pr = f === at ? 'down' : null;
    if (at >= 0 && f > at && S.kid.vy >= 0 && S.holding) S.holding = false; // let go at the top
    const r = step(S, DT, pr, null, true);
    if (r === 'fin') return { r: 'ok', box: S.simGot, f };
    if (r === 'hit' || r === 'fall') return { r, box: S.simGot, f };
    if (at >= 0 && f >= at) { if (!S.kid.on) air = true; else if (air) { landed = true; if (f > at + 8 && f > until) return { r: 'ok', box: S.simGot, f }; } }
  }
  return { r: 'ok', box: S.simGot, f: frames };
}
export const SKILLS = {
  perfect: { sigma: 0, lapse: 0, late: 0, box: 1, react: 0 },
  pro: { sigma: 0.035, lapse: 0.01, late: 0.12, box: 0.95, react: 0.25 },
  good: { sigma: 0.06, lapse: 0.03, late: 0.16, box: 0.8, react: 0.3 },
  casual: { sigma: 0.09, lapse: 0.06, late: 0.2, box: 0.6, react: 0.35 },
  kid: { sigma: 0.13, lapse: 0.1, late: 0.25, box: 0.45, react: 0.45 },
};
function gauss(rng) { let u = 0, v = 0; while (!u) u = rng(); while (!v) v = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
function botThink(P, B) {
  // a press is already planned: wait for it
  if (B.pressAt != null) { B.pressAt--; if (B.pressAt <= 0) { B.pressAt = null; B.cool = 6; return 'down'; } return null; }
  if (B.cool > 0) { B.cool--; return null; }
  if (P.holding && P.kid.vy >= 0) return 'up';
  const k = P.kid;
  if (!k.on && k.jumps >= 2) return null;
  const HZ = 54; // ~0.9 s ahead
  const none = look(P, -1, HZ);
  const wantBox = !none.box && P.items.some(i => !i.got && i.x - P.worldX > 0 && i.x - P.worldX < 330) && P.rng() < B.s.box / 20; // tries for a box it can see now and then
  if (none.r === 'ok' && !wantBox) return null;
  if (!k.on && none.r === 'ok') return null; // in the air and fine: no double jump just for a box
  // find the frames where pressing works
  const good = []; const lim = none.r === 'ok' ? HZ : Math.max(1, none.f);
  for (let a = 0; a < lim; a++) { const L = look(P, a, 110, none.r === 'ok' ? 0 : none.f + 3); if (L.r === 'ok' && (none.r !== 'ok' || L.box)) good.push(a); }
  if (!good.length) { if (none.r !== 'ok' && k.on) { B.pressAt = 1; } return null; } // nothing works: jump anyway (a human would)
  // first window of good frames
  let a0 = good[0], a1 = a0; for (let i = 1; i < good.length && good[i] === a1 + 1; i++) a1 = good[i];
  if (none.r === 'ok' && a0 > 25) return null; // a box far ahead: decide later
  let target = (a0 + a1) / 2 + gauss(P.rng) * B.s.sigma * 60;
  if (none.r !== 'ok' && P.rng() < B.s.lapse) target = a1 + B.s.late * 60 * (0.5 + P.rng()); // a lapse: reacts late
  // after a surprise (marbles just appeared) the press can't be sooner than a reaction time
  B.pressAt = Math.max(1, Math.round(target));
  return null;
}

// ---------- a whole race ----------
export function race(opts) {
  const cfg = { ...DEFAULT_CFG, ...(opts.cfg || {}) };
  const rng = makeRng(opts.seed * 7 + 1);
  const seed = opts.seed, zone = opts.zone ?? (seed % 11);
  const A = newPlayer(seed, zone, cfg, makeRng(seed * 13 + 5)), Bp = newPlayer(seed, zone, cfg, makeRng(seed * 17 + 9));
  gen(A); gen(Bp);
  const lat = opts.lat ?? 0.06;
  const bots = [{ s: SKILLS[opts.a], pressAt: null, cool: 0 }, { s: SKILLS[opts.b], pressAt: null, cool: 0 }];
  const P = [A, Bp]; const wire = [[], []]; // messages in flight to player i
  let t = 0, sendT = [0, 0];
  const trace = []; let leader = 0, changes = 0; const gaps = {};
  const mk = i => m => { wire[1 - i].push({ at: t + lat + rng() * 0.03, m }); };
  const sends = [mk(0), mk(1)];
  while (t < 200) {
    t += DT;
    for (let i = 0; i < 2; i++) {
      const p = P[i];
      // deliver
      const box = wire[i]; for (let j = 0; j < box.length; j++) { const w = box[j]; if (w.at <= t) { box.splice(j--, 1); const m = w.m;
        if (m.t === 'p') p.opp.d = m.d; else if (m.t === 'mb') { const x = m.x; if (p.boxes.has(x) && !(p.mbX || (p.mbX = [])).includes(x) && t - (p.mbAt ?? -9) >= cfg.MB_GAP) { p.mbX.push(x); p.mbAt = t; marblesIn(p); } }
        else if (m.t === 'out') { p.opp.out = true; p.opp.tm = m.tm; } } }
      if (p.fin != null) continue;
      p.react = bots[i].s.react; const pr = botThink(p, bots[i]);
      const r = step(p, DT, pr, sends[i], false);
      if (r === 'fin') sends[i]({ t: 'out', tm: p.fin });
      sendT[i] -= DT; if (sendT[i] <= 0) { sendT[i] = 0.05; sends[i]({ t: 'p', d: Math.floor(p.dist) }); }
    }
    const ld = Math.sign(A.dist - Bp.dist); if (ld && Math.abs(A.dist - Bp.dist) > 3) { if (leader && ld !== leader) changes++; leader = ld; }
    if (opts.trace && Math.round(t * 60) % 30 === 0) trace.push([+t.toFixed(1), Math.round(A.dist), Math.round(Bp.dist)]);
    for (const m of [200, 300, 400, 500]) if (gaps[m] == null && Math.max(A.dist, Bp.dist) >= m) gaps[m] = A.dist - Bp.dist;
    if (A.fin != null && Bp.fin != null) break;
    if ((A.fin != null || Bp.fin != null) && t > 150) break;
  }
  const ta = A.fin ?? 999, tb = Bp.fin ?? 999;
  return { win: Math.abs(ta - tb) < 0.05 ? 0 : ta < tb ? 1 : -1, ta, tb, changes, A: A.stats, B: Bp.stats, gaps, trace };
}
