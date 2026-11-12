// Usage: node exp.mjs [races per pairing] [unused] ['{"name":{cfg overrides}}'] ['pro-casual,casual-casual'] > out.json; node show.js out.json
// Runs many races per (pairing, config) on worker threads and prints a summary table as JSON.
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import os from 'node:os';
import { race } from './race-sim.mjs';
if (!isMainThread) {
  const { jobs } = workerData; const out = [];
  for (const j of jobs) { const r = race(j); out.push({ k: j.k, win: r.win, ta: r.ta, tb: r.tb, ch: r.changes, g: r.gaps, A: r.A, B: r.B }); }
  parentPort.postMessage(out);
} else {
  const N = +process.argv[2] || 400, cfgName = process.argv[3] || 'all';
  const CFGS = JSON.parse(process.argv[4] || 'null') || { now: {}, noLuck: { luckOff: true }, flat: { flat: true } }; // overrides on top of DEFAULT_CFG (the shipped game)
  const PAIRS = (process.argv[5] || 'pro-pro,casual-casual,pro-good,good-casual,pro-casual,casual-kid,pro-kid').split(',').map(s => s.split('-'));
  const jobs = [];
  for (const [cn, cfg] of Object.entries(CFGS)) for (const [a, b] of PAIRS) for (let s = 1; s <= N; s++) {
    const swap = s % 2 === 0; // alternate who is player A
    jobs.push({ k: cn + '|' + a + '-' + b + '|' + (swap ? 1 : 0), seed: 1000 + s, a: swap ? b : a, b: swap ? a : b, cfg });
  }
  const nW = Math.max(1, os.cpus().length - 1), chunks = Array.from({ length: nW }, () => []);
  jobs.forEach((j, i) => chunks[i % nW].push(j));
  const res = (await Promise.all(chunks.map(c => new Promise((ok, bad) => { const w = new Worker(new URL(import.meta.url), { workerData: { jobs: c } }); w.on('message', ok); w.on('error', bad); })))).flat();
  const agg = {};
  for (const r of res) {
    const [cn, pair, sw] = r.k.split('|'); const key = cn + '|' + pair; const a = agg[key] || (agg[key] = { n: 0, bw: 0, ties: 0, margin: 0, close1: 0, ch: 0, cb15n: 0, cb15w: 0, cb30n: 0, cb30w: 0, lead400w: 0, lead400n: 0, tB: 0, tW: 0, mbS: 0, mbH: 0, got: {}, shield: 0, obsH: 0, falls: 0 });
    const flip = sw === '1'; // 'better' player is the first named in the pair
    const tBet = flip ? r.tb : r.ta, tWor = flip ? r.ta : r.tb; const S = flip ? r.B : r.A, Sw = flip ? r.A : r.B;
    a.n++; const w = Math.abs(tBet - tWor) < 0.05 ? 0 : tBet < tWor ? 1 : -1; if (w === 1) a.bw++; if (w === 0) a.ties++;
    a.margin += Math.abs(tBet - tWor); if (Math.abs(tBet - tWor) < 1) a.close1++; a.ch += r.ch; a.tB += tBet; a.tW += tWor;
    // comebacks: whoever is behind at 400 m (gap from the first-named player's side)
    let g = r.g[400]; if (g != null) { if (flip) g = -g; const behindIsBetter = g < 0, gap = Math.abs(g); const behindWon = behindIsBetter ? w === 1 : w === -1;
      if (gap >= 15) { a.cb15n++; if (behindWon) a.cb15w++; } if (gap >= 30) { a.cb30n++; if (behindWon) a.cb30w++; } }
    for (const s of [r.A, r.B]) { a.mbS += s.mbSent; for (const [k, v] of Object.entries(s.tierGot)) a.got[k] = (a.got[k] || 0) + v; a.shield += s.shieldSaves; a.obsH += s.obsHits; a.falls += s.falls; }
    a.mbH += r.A.mbHits + r.B.mbHits;
  }
  const rows = [];
  for (const [key, a] of Object.entries(agg)) {
    const [cn, pair] = key.split('|'); const p1 = a.bw / a.n;
    // best of 3 from independent rounds (ties replayed)
    const p = a.bw / Math.max(1, a.n - a.ties), match = p * p * (3 - 2 * p);
    rows.push({ cfg: cn, pair, n: a.n, betterWins: +(100 * p1).toFixed(1), match: +(100 * match).toFixed(1), tBetter: +(a.tB / a.n).toFixed(1), tWorse: +(a.tW / a.n).toFixed(1), margin: +(a.margin / a.n).toFixed(2), under1s: +(100 * a.close1 / a.n).toFixed(1), leadChanges: +(a.ch / a.n).toFixed(2),
      comeback15: a.cb15n ? +(100 * a.cb15w / a.cb15n).toFixed(1) + '% of ' + a.cb15n : '-', comeback30: a.cb30n ? +(100 * a.cb30w / a.cb30n).toFixed(1) + '% of ' + a.cb30n : '-',
      mbPerRace: +(a.mbS / a.n).toFixed(2), mbHitPct: a.mbS ? +(100 * a.mbH / a.mbS).toFixed(1) : 0, shieldSaves: +(a.shield / a.n).toFixed(2), obsHits: +(a.obsH / a.n / 2).toFixed(2), falls: +(a.falls / a.n / 2).toFixed(2), got: a.got });
  }
  console.log(JSON.stringify(rows));
}
