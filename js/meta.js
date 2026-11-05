// Progression: save data, in-game dirhams, the route across Dubai, shop, wardrobe, badges, missions and login rewards.
// Everything lives in localStorage on this device. Dirhams are an in-game currency only: there are no real payments.
const KEY = 'abood-save-v1';
const pad = n => String(n).padStart(2, '0');
export const today = () => { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
const dayNo = s => Math.round(new Date(s + 'T12:00:00').getTime() / 864e5);
const hash = s => { let h = 2166136261; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

// ---- the route ----
// A loop round Dubai in the real order. Leg 1 runs along the coast from Al Mamzar to JBR, leg 2 comes back inland
// from Expo City to Dubai Creek Harbour, next to where it started. Each leg is squeezed to about 30 km, keeping the
// parts roughly in proportion. After 60 km the loop starts again at Al Mamzar, and so on.
export const ROUTE_END = 60000;
export const AREAS = [
  { id: 'mamzar', at: 0 }, { id: 'creek', at: 3000 }, { id: 'downtown', at: 8000 },
  { id: 'jumeirah', at: 14000 }, { id: 'palm', at: 20000 }, { id: 'jbr', at: 25500 },
  { id: 'expo', at: 30000 }, { id: 'golf', at: 36000 }, { id: 'nadsheba', at: 42000 }, { id: 'khawaneej', at: 48000 }, { id: 'harbour', at: 54000 },
];
// landmarks on the way, about one every kilometre (metres from the start at Al Mamzar)
export const STOPS = [
  { id: 'mamzarpark', m: 800 }, { id: 'etisalat', m: 1800 }, { id: 'clocktower', m: 2600 },
  { id: 'spice', m: 3600 }, { id: 'gold', m: 4500 }, { id: 'abra', m: 5400 }, { id: 'antique', m: 6300 }, { id: 'library', m: 7100 }, { id: 'frame', m: 7700 },
  { id: 'museum', m: 8600 }, { id: 'towers', m: 9500 }, { id: 'mall', m: 10500 }, { id: 'fountain', m: 11400 }, { id: 'burj', m: 12300 }, { id: 'opera', m: 13200 },
  { id: 'mosque', m: 14700 }, { id: 'lamer', m: 15800 }, { id: 'kite', m: 16900 }, { id: 'arab', m: 18000 }, { id: 'madinat', m: 19100 },
  { id: 'monorail', m: 20700 }, { id: 'atlantis', m: 21600 }, { id: 'tunnel', m: 22400, len: 600 }, { id: 'royal', m: 23700 }, { id: 'slides', m: 24600 },
  { id: 'walk', m: 26200 }, { id: 'eye', m: 27300 }, { id: 'marina', m: 28500 },
  { id: 'wasl', m: 31000 }, { id: 'terra', m: 32500 }, { id: 'skygarden', m: 34000 }, { id: 'surreal', m: 35100 },
  { id: 'clubhouse', m: 37000 }, { id: 'island', m: 38500 }, { id: 'polo', m: 40200 },
  { id: 'nadpark', m: 43000 }, { id: 'meydan', m: 44800 }, { id: 'race', m: 46400 },
  { id: 'quranic', m: 49000 }, { id: 'glasshouse', m: 50300 }, { id: 'cave', m: 51600 }, { id: 'farms', m: 53000 },
  { id: 'flamingos', m: 55000 }, { id: 'harbourtowers', m: 56700 }, { id: 'creekbeach', m: 58000 }, { id: 'skyview', m: 59200 },
];
export const loopM = m => ((m % ROUTE_END) + ROUTE_END) % ROUTE_END; // position within the loop
export const areaAt = m => { m = loopM(m); let z = 0; for (let i = 1; i < AREAS.length; i++) if (m >= AREAS[i].at) z = i; return z; };
export const stopReward = s => 5 + Math.round(s.m / 1000) * 2; // a postcard pays more the further it is: 7 near Al Mamzar, 123 at the end of the loop

// ---- wardrobe ----
// Looks with no effect on the game are free. Only outfits with a perk cost dirhams (or a badge).
export const AVATARS = [
  { id: 'classic', price: 0 }, { id: 'glasses', price: 0 }, { id: 'shades', price: 0 }, { id: 'goggles', price: 0 },
];
export const ROBES = [
  { id: 'white', col: '#fbfaf4', shade: '#dcd8cb', price: 0 },
  { id: 'cream', col: '#f1e6cf', shade: '#d4c3a0', price: 0 },
  { id: 'grey', col: '#d9dbe0', shade: '#b0b5c0', price: 0 },
  { id: 'blue', col: '#cfe3f2', shade: '#a1c0da', price: 0 },
  { id: 'brown', col: '#9a7353', shade: '#775638', price: 0 },
  { id: 'navy', col: '#3d4b6e', shade: '#2c3753', price: 0 },
  { id: 'olive', col: '#8d8f5e', shade: '#6d7046', price: 0 },
  { id: 'maroon', col: '#7d2e36', shade: '#5f2128', price: 0 },
  { id: 'charcoal', col: '#55565c', shade: '#3e3f44', price: 0 },
  { id: 'gold', col: '#f4e3a8', shade: '#d4b96e', price: 0, badge: 'dist10000', perk: 'perk_gold', slow: 0.6 },
  // swimwear: rash guard and board shorts, with flip-flops
  { id: 'swim_blue', col: '#2b9bd6', shade: '#1f7cb0', price: 0, swim: { top: '#2b9bd6', trim: '#ffffff', shorts: '#1f4fa0', stripe: '#ffe066' } },
  { id: 'swim_orange', col: '#f28c28', shade: '#c96d14', price: 0, swim: { top: '#f28c28', trim: '#fffaf0', shorts: '#2c5d9e', stripe: '#fffaf0' } },
  { id: 'swim_green', col: '#33b679', shade: '#238d5b', price: 0, swim: { top: '#33b679', trim: '#fffaf0', shorts: '#1f7a74', stripe: '#f2c230' } },
  { id: 'swim_navy', col: '#26355c', shade: '#1b2645', price: 0, swim: { top: '#26355c', trim: '#7ee0b0', shorts: '#26355c', stripe: '#7ee0b0' } },
  { id: 'swim_life', col: '#e23b2a', shade: '#b52a1c', price: 2500, perk: 'perk_life', shield: 1, swim: { top: '#e23b2a', trim: '#f2c230', shorts: '#e23b2a', stripe: '#f2c230', cross: 1 } },
  // football kits named after five UAE clubs (colours only, no badges are drawn); each slows Baba by 20%
  { id: 'kit_purple', col: '#5b2a86', shade: '#43206a', price: 1500, perk: 'perk_kit', slow: 0.8, kit: { main: '#5b2a86', trim: '#ffffff', shorts: '#ffffff', sock: '#5b2a86', num: '#ffffff' } },
  { id: 'kit_yellow', col: '#f2c230', shade: '#c99a16', price: 1500, perk: 'perk_kit', slow: 0.8, kit: { main: '#f2c230', trim: '#1d1d1d', shorts: '#1d1d1d', sock: '#f2c230', num: '#1d1d1d', stripes: 1 } },
  { id: 'kit_red', col: '#c8202b', shade: '#9a1520', price: 1500, perk: 'perk_kit', slow: 0.8, kit: { main: '#c8202b', trim: '#1d1d1d', shorts: '#1d1d1d', sock: '#c8202b', num: '#ffffff', band: 1 } },
  { id: 'kit_blue', col: '#1f4fa0', shade: '#173b78', price: 1500, perk: 'perk_kit', slow: 0.8, kit: { main: '#1f4fa0', trim: '#ffffff', shorts: '#ffffff', sock: '#1f4fa0', num: '#ffffff' } },
  { id: 'kit_white', col: '#fbfaf4', shade: '#dcd8cb', price: 1500, perk: 'perk_kit', slow: 0.8, kit: { main: '#fbfaf4', trim: '#c8202b', shorts: '#fbfaf4', sock: '#fbfaf4', num: '#c8202b', band: 1 } },
];
export const HEADS = [
  { id: 'shemagh', price: 0 }, { id: 'ghutra', price: 0 }, { id: 'blackshemagh', price: 0 }, { id: 'tagiyah', price: 0 }, { id: 'cap', price: 0 }, { id: 'swimcap', price: 0 },
];
export const EXTRAS = [
  { id: 'none', price: 0 }, { id: 'bag', price: 0 }, { id: 'camera', price: 0 }, { id: 'falcon', price: 0 },
];
const LISTS = { avatar: AVATARS, robe: ROBES, head: HEADS, extra: EXTRAS };
// what the looks used to cost, so earlier purchases can be paid back now that they are free
const OLD_PRICE = { avatar: { glasses: 1200, shades: 1800 }, robe: { cream: 600, grey: 800, blue: 1100, brown: 1500 }, head: { ghutra: 700, blackshemagh: 1300, tagiyah: 1000 } };

export const BOOSTERS = [
  { id: 'vimto', price: 15 }, { id: 'magnet', price: 12 }, { id: 'headstart', price: 25 }, { id: 'shield', price: 20 }, { id: 'revive', price: 120 },
];
// power-up upgrades: each level makes the power-up last 15% longer (5 levels, 3,850 dirhams each in total)
export const UPGRADES = [{ id: 'vimto', base: 4 }, { id: 'magnet', base: 6 }, { id: 'scooter', base: 5 }, { id: 'phone', base: 2.8 }, { id: 'marbles', base: 4.5 }];
export const UP_PRICE = [100, 250, 500, 1000, 2000];
export const UP_MAX = UP_PRICE.length;

// one-off badges: `run` is checked against this run, `life` against lifetime progress
export const BADGES = [
  { id: 'first', reward: 5, life: s => s.runs >= 1 },
  { id: 'dist10000', reward: 250, run: r => r.dist >= 10000, unlock: 'robe:gold' },
  { id: 'shopper', reward: 7, life: s => s.bought >= 1 },
  { id: 'postcards', reward: 300, life: () => STOPS.every(x => S.route.stops[x.id]) },
  { id: 'journey', reward: 500, life: () => S.route.best >= ROUTE_END },
];
// tiered badges: bronze -> silver -> gold, each tier needs 10x the goal and pays 10x the dirhams
export const TIER_REWARD = [10, 100, 1000];
export const BADGE_CATS = [
  { id: 'dist', goals: [10, 100, 1000], stat: s => Math.floor((s.totalDist || 0) / 1000) },   // km in total
  { id: 'sweets', goals: [1000, 10000, 100000], stat: s => s.sweets },
  { id: 'close', goals: [50, 500, 5000], stat: s => s.close },
  { id: 'dodge', goals: [20, 200, 2000], stat: s => s.dodged },
  { id: 'smash', goals: [20, 200, 2000], stat: s => s.smash },
  { id: 'runs', goals: [10, 100, 1000], stat: s => s.runs },
  { id: 'areas', goals: [10, 100, 1000], stat: s => s.areas || 0 },
  { id: 'powers', goals: [50, 500, 5000], stat: s => s.powersTotal || 0 },
  { id: 'revive', goals: [1, 10, 100], stat: s => s.revivesUsed },
  { id: 'streak', goals: [7, 70, 700], stat: s => s.streak },
];
export const tierOf = id => (S.tiers || {})[id] || 0; // tiers earned: 0 none, 1 bronze, 2 silver, 3 gold

// ---- missions ----
// "run" kinds take the best value from a single run; the others add up events.
const RUNVAL = {
  runDist: r => Math.floor(r.dist), runSweets: r => r.sweets, runNoHit: r => Math.floor(r.noHit),
  runCombo: r => r.comboMax, runFocus: r => r.focusMax, runPowers: r => r.powers,
};
const EVENT = { sweets: 'sweets', close: 'close', dodge: 'dodge', power: 'power', smash: 'smash', runs: 'run', stops: 'stop' };
// three a day, picked from this pool by the date
const DAILY = [
  { kind: 'runDist', goals: [600, 1000, 1500], reward: g => Math.round(g * 0.02 + 20) },
  { kind: 'sweets', goals: [150, 300, 500], reward: g => Math.round(g * 0.06 + 20) },
  { kind: 'runSweets', goals: [80, 120], reward: g => Math.round(g * 0.2 + 15) },
  { kind: 'close', goals: [6, 12], reward: g => g * 2 + 20 },
  { kind: 'dodge', goals: [3, 6], reward: g => g * 4 + 20 },
  { kind: 'power', goals: [5, 10], reward: g => g * 2 + 20 },
  { kind: 'runs', goals: [3, 5], reward: g => g * 5 + 15 },
  { kind: 'runNoHit', goals: [400, 700], reward: g => Math.round(g * 0.04 + 15) },
  { kind: 'runCombo', goals: [18, 30], reward: g => g + 15 },
  { kind: 'stops', goals: [2, 4], reward: g => g * 8 + 15 },
  { kind: 'smash', goals: [3, 6], reward: g => g * 4 + 15 },
];
export const DAILY_BONUS = 50; // for finishing all three daily missions
// the mission ladder: endless sets of three that get harder; each full set raises the exchange multiplier
const LADDER = [
  { kind: 'runDist', goal: n => Math.min(9000, 400 + 200 * n) },
  { kind: 'sweets', goal: n => 100 + 60 * n },
  { kind: 'runSweets', goal: n => Math.min(600, 40 + 15 * n) },
  { kind: 'close', goal: n => 4 + 2 * n },
  { kind: 'dodge', goal: n => 2 + n },
  { kind: 'power', goal: n => 3 + 2 * n },
  { kind: 'runNoHit', goal: n => Math.min(5000, 250 + 120 * n) },
  { kind: 'runCombo', goal: n => Math.min(60, 10 + 2 * n) },
  { kind: 'runFocus', goal: n => Math.min(3, 1 + Math.floor(n / 4)) },
  { kind: 'runPowers', goal: n => Math.min(12, 2 + Math.floor(n / 2)) },
  { kind: 'stops', goal: n => 2 + n },
  { kind: 'smash', goal: n => 2 + n },
  { kind: 'runs', goal: n => 2 + Math.floor(n / 2) },
];
export const MULT_STEP = 0.1, MULT_MAX = 3;
export const ladderReward = lv => 40 + 20 * lv;
// sweets exchange after a run: 10 sweets = 1 dirham, plus 1 dirham per 250 m, times the mission multiplier
export const SWEETS_PER_AED = 10, M_PER_AED = 250;
export const LOGIN = [3, 4, 5, 6, 8, 10, 25];

const fresh = () => ({
  econ: 4, coins: 5, avatar: 'classic', robe: 'white', head: 'shemagh', extra: 'none',
  owned: { avatar: [], robe: [], head: [], extra: [] },
  boosters: { vimto: 0, magnet: 0, headstart: 0, shield: 0, revive: 0 }, up: {},
  stats: { recent: [], totalDist: 0, areas: 0, powersTotal: 0, stopsTotal: 0, runs: 0, sweets: 0, close: 0, dodged: 0, smash: 0, zones: [0], powers: [], revivesUsed: 0, bought: 0, best: 0, streak: 0 },
  route: { best: 0, stops: {}, start: 0 },
  badges: {}, tiers: {}, daily: null, ladder: null, login: { last: null, streak: 0 }, refund: 0,
});
let S = fresh();
let raw = null;
try {
  raw = localStorage.getItem(KEY);
  if (raw) { const d = JSON.parse(raw); if (!d || typeof d !== 'object') throw new Error('bad save'); if (d.econ === 2) { d.coins = Math.round((d.coins || 0) / 100); d.econ = 3; }
    if (d.econ !== 3 && d.econ !== 4) { const f = fresh(); if (d.login) f.login = d.login; Object.keys(d).forEach(k => delete d[k]); Object.assign(d, f); }
    S = Object.assign(fresh(), d);
    for (const k of ['stats', 'owned', 'boosters', 'route']) S[k] = Object.assign(fresh()[k], d[k] || {}); }
  else { const old = +localStorage.getItem('abood-best') || 0; S.stats.best = old; }
} catch (e) { // keep the unreadable save so progress can still be recovered by hand
  S = fresh(); try { if (raw) localStorage.setItem(KEY + '.bak', raw); } catch (e2) {}
}
(function migrate() {
  for (const k of Object.keys(S.badges || {})) if (!BADGES.some(b => b.id === k)) delete S.badges[k];
  S.tiers = S.tiers || {}; S.up = S.up || {}; S.badges = S.badges || {};
  if (!S.login || typeof S.login !== 'object') S.login = fresh().login;
  const refund = { char: { mozah: 300, saif: 250 }, robe: { pink: 100, purple: 120 }, head: { shayla_purple: 60, shayla_black: 60 } };
  for (const kind of Object.keys(refund)) for (const id of (S.owned[kind] || [])) if (refund[kind][id]) S.coins += refund[kind][id];
  delete S.owned.char; delete S.char;
  if (S.econ === 3) { // looks became free: pay back what they cost, and retire the old mission kinds
    let back = 0; for (const kind of Object.keys(OLD_PRICE)) for (const id of (S.owned[kind] || [])) back += OLD_PRICE[kind][id] || 0;
    S.coins += back; S.refund = back; S.daily = null; S.stats.zones = [0]; S.econ = 4;
  }
  for (const kind of Object.keys(LISTS)) {
    const list = LISTS[kind];
    S.owned[kind] = (S.owned[kind] || []).filter(id => list.some(x => x.id === id));
    for (const it of list) if (!it.price && !it.badge && !S.owned[kind].includes(it.id)) S.owned[kind].push(it.id);
    if (!S.owned[kind].includes(S[kind])) S[kind] = list[0].id;
  }
  S.route.start = Math.min(S.route.start || 0, AREAS.length - 1);
  save();
})();
export function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
export const data = () => S;
export const robeOf = () => ROBES.find(r => r.id === S.robe) || ROBES[0];
export function takeRefund() { const r = S.refund || 0; if (r) { S.refund = 0; save(); } return r; }

// ---- missions: daily three and the endless ladder ----
let doneQ = []; // missions finished since the game last asked, so it can cheer
function checkDone(m, set) { if (!m.done && m.progress >= m.goal) { m.done = true; doneQ.push({ kind: m.kind, goal: m.goal, set }); } }
export const takeDone = () => { const q = doneQ; doneQ = []; return q; };
export function ensureDaily() {
  const d = today();
  if (S.daily && S.daily.date === d && S.daily.v === 2) return S.daily;
  if (S.daily && S.daily.v === 2) { // a new day: pay what was finished but not claimed yet, so nothing is lost at midnight
    for (const m of S.daily.missions) if (!m.claimed && m.progress >= m.goal) { m.claimed = true; S.coins += m.reward; }
    if (!S.daily.bonus && S.daily.missions.every(x => x.claimed)) S.coins += DAILY_BONUS;
  }
  const h = hash(d), pool = DAILY.map((m, i) => i), picks = [];
  for (let k = 0; k < 3; k++) { const j = (h >>> (k * 5)) % pool.length; picks.push(pool.splice(j, 1)[0]); }
  S.daily = { v: 2, date: d, bonus: false, missions: picks.map((mi, k) => {
    const m = DAILY[mi], goal = m.goals[(h >>> (k * 3 + 16)) % m.goals.length];
    return { kind: m.kind, goal, reward: m.reward(goal), progress: 0, claimed: false, done: false, from: S.stats.runs + 1 };
  }) };
  save(); return S.daily;
}
const ladderMission = (def, lv) => ({ kind: def.kind, goal: def.goal(lv), progress: 0, done: false, from: S.stats.runs + 1 });
function ladderSet(lv) {
  const h = hash('L' + lv), pool = LADDER.map((m, i) => i), picks = [];
  for (let k = 0; k < 3; k++) picks.push(pool.splice((h >>> (k * 6)) % pool.length, 1)[0]);
  return picks.map(i => ladderMission(LADDER[i], lv));
}
export function ensureLadder() { if (!S.ladder) { S.ladder = { lv: 1, skips: 0, missions: ladderSet(1) }; save(); } return S.ladder; }
export const mult = () => Math.min(MULT_MAX, Math.round((1 + MULT_STEP * (ensureLadder().lv - 1)) * 10) / 10);
export const nextMult = () => Math.min(MULT_MAX, Math.round((mult() + MULT_STEP) * 10) / 10);
export const skipPrice = () => 25 + 10 * ensureLadder().lv;
export function skipLadder(i) {
  const L = ensureLadder(), m = L.missions[i]; if (!m || m.done) return false;
  const p = skipPrice(); if (S.coins < p) return false; S.coins -= p;
  const used = L.missions.map(x => x.kind), opts = LADDER.filter(x => !used.includes(x.kind)); L.skips = (L.skips || 0) + 1;
  L.missions[i] = ladderMission(opts[hash('S' + L.lv + ':' + L.skips) % opts.length], L.lv); save(); return true;
}
// a full set raises the level when the run ends, so a new set never finishes itself mid-run
function ladderUp() {
  const L = ensureLadder(); if (!L.missions.every(m => m.done)) return null;
  const reward = ladderReward(L.lv); S.coins += reward; L.lv++; L.missions = ladderSet(L.lv);
  return { lv: L.lv, reward, mult: mult() };
}
const allMissions = () => [[ensureDaily().missions, 'daily'], [ensureLadder().missions, 'ladder']];
export function claimMission(i) {
  const D = ensureDaily(), m = D.missions[i]; if (!m || m.claimed || m.progress < m.goal) return 0;
  m.claimed = true; S.coins += m.reward; let got = m.reward;
  if (!D.bonus && D.missions.every(x => x.claimed)) { D.bonus = true; S.coins += DAILY_BONUS; got += DAILY_BONUS; }
  save(); return got;
}
export const missionsReady = () => ensureDaily().missions.filter(m => !m.claimed && m.progress >= m.goal).length;
// called about once a second during a run, and when it ends
export function runTick(run) {
  for (const [list, set] of allMissions()) for (const m of list) {
    const f = RUNVAL[m.kind]; if (!f || S.stats.runs < (m.from || 0)) continue;
    m.progress = Math.max(m.progress, f(run) || 0); checkDone(m, set);
  }
  if (run.route > S.route.best) S.route.best = Math.floor(run.route);
}

// ---- login reward ----
export function loginStatus() {
  const d = today(), last = S.login.last;
  if (last === d) return { canClaim: false, streak: S.login.streak };
  const streak = last && dayNo(d) - dayNo(last) === 1 ? S.login.streak + 1 : 1;
  return { canClaim: true, streak, reward: LOGIN[Math.min(streak, LOGIN.length) - 1] };
}
export function claimLogin() {
  const st = loginStatus(); if (!st.canClaim) return 0;
  S.login = { last: today(), streak: st.streak }; S.stats.streak = Math.max(S.stats.streak, st.streak); S.coins += st.reward; save(); return st.reward;
}

// ---- events from the game ----
export function track(ev, n = 1) {
  ensureDaily(); const s = S.stats;
  if (ev === 'sweets') s.sweets += n;
  else if (ev === 'close') s.close += 1;
  else if (ev === 'dodge') s.dodged += 1;
  else if (ev === 'smash') s.smash += 1;
  else if (ev === 'power') { s.powersTotal = (s.powersTotal || 0) + 1; if (!s.powers.includes(n)) s.powers.push(n); n = 1; }
  else if (ev === 'zone') { s.areas = (s.areas || 0) + 1; if (!s.zones.includes(n)) s.zones.push(n); return; }
  else if (ev === 'run') s.runs += 1;
  else if (ev === 'revive') { s.revivesUsed += 1; return; }
  else if (ev === 'stop') s.stopsTotal = (s.stopsTotal || 0) + 1;
  for (const [list, set] of allMissions()) for (const m of list) if (EVENT[m.kind] === ev && s.runs >= (m.from || 0)) { m.progress += n; checkDone(m, set); }
}
// passing a landmark: the first time ever it becomes a postcard and pays dirhams
export function reachStop(id) {
  const s = STOPS.find(x => x.id === id); if (!s) return 0;
  track('stop'); if (S.route.stops[id]) return 0;
  S.route.stops[id] = today(); const r = stopReward(s); S.coins += r; save(); return r;
}
export const postcards = () => STOPS.filter(x => S.route.stops[x.id]).length;
export const areaOpen = i => i === 0 || S.route.best >= AREAS[i].at;
export function setStart(i) { if (!areaOpen(i)) return false; S.route.start = i; save(); return true; }
export const startArea = () => areaOpen(S.route.start) ? S.route.start : 0;

function unlock(code) { const [kind, id] = code.split(':'); if (!S.owned[kind].includes(id)) S.owned[kind].push(id); }
export function checkBadges(run) {
  const got = [];
  for (const b of BADGES) {
    if (S.badges[b.id]) continue;
    if ((b.run && run && b.run(run)) || (b.life && b.life(S.stats))) { S.badges[b.id] = today(); S.coins += b.reward; if (b.unlock) unlock(b.unlock); got.push(b); }
  }
  S.tiers = S.tiers || {};
  for (const c of BADGE_CATS) {
    let k = S.tiers[c.id] || 0;
    while (k < 3 && c.stat(S.stats) >= c.goals[k]) { S.coins += TIER_REWARD[k]; got.push({ id: c.id, cat: true, tier: k, reward: TIER_REWARD[k] }); k++; }
    S.tiers[c.id] = k;
  }
  if (got.length) save();
  return got;
}
// the after-run exchange; the multiplier is fixed the first time a run is settled
export function exchangeOf(run) {
  const mu = run.mult || mult(), s = Math.floor(run.sweets / SWEETS_PER_AED), d = Math.floor(run.dist / M_PER_AED);
  return { sweets: run.sweets, dist: Math.floor(run.dist), s, d, mult: mu, total: Math.floor(Math.round((s + d) * mu * 100) / 100) };
}
// Called when a run ends (and again if the player revives and ends later): pays only what has not been paid yet.
export function endRun(run) {
  runTick(run);
  // remember recent run distances so the game can pace itself to this player
  const rec = S.stats.recent || (S.stats.recent = []);
  if (!run.logged) { rec.push(Math.floor(run.dist)); run.logged = true; if (rec.length > 8) rec.shift(); } else rec[rec.length - 1] = Math.max(rec[rec.length - 1], Math.floor(run.dist));
  S.stats.totalDist = (S.stats.totalDist || 0) + Math.max(0, Math.floor(run.dist - (run.distLogged || 0))); run.distLogged = Math.floor(run.dist);
  run.mult = run.mult || mult();
  const ex = exchangeOf(run), pay = Math.max(0, ex.total - (run.paid || 0));
  run.paid = (run.paid || 0) + pay; S.coins += pay;
  const nb = Math.floor(run.dist) > S.stats.best; if (nb) S.stats.best = Math.floor(run.dist);
  const levelUp = ladderUp();
  const badges = checkBadges(run);
  save();
  return { earned: pay, ex, newBest: nb, badges, levelUp };
}

// ---- shop and wardrobe ----
export function buy(kind, id) {
  const list = LISTS[kind] || BOOSTERS;
  const it = list.find(x => x.id === id); if (!it || it.badge) return false;
  if (kind !== 'booster' && S.owned[kind].includes(id)) return false;
  if (S.coins < it.price) return false;
  S.coins -= it.price; S.stats.bought += 1;
  if (kind === 'booster') S.boosters[id] = (S.boosters[id] || 0) + 1; else S.owned[kind].push(id);
  checkBadges(null); save(); return true;
}
export function equip(kind, id) {
  if (!S.owned[kind].includes(id)) return false;
  S[kind] = id;
  save(); return true;
}
export const upLevel = id => S.up[id] || 0;
export const powerTime = id => { const u = UPGRADES.find(x => x.id === id); return u ? Math.round(u.base * (1 + 0.15 * upLevel(id)) * 10) / 10 : 0; };
export function buyUpgrade(id) {
  const k = upLevel(id); if (k >= UP_MAX || S.coins < UP_PRICE[k]) return false;
  S.coins -= UP_PRICE[k]; S.up[id] = k + 1; S.stats.bought += 1; checkBadges(null); save(); return true;
}
export const REVIVE_PRICE = 120;
// pay for something on the spot (used for a paid second chance on the game-over screen)
export function spend(n) { if (S.coins < n) return false; S.coins -= n; save(); return true; }
export function useBooster(id) { if ((S.boosters[id] || 0) <= 0) return false; S.boosters[id]--; save(); return true; }
export const bestDist = () => S.stats.best;
// distance where this player usually ends a run: a little past the median of recent runs
export function paceTarget() {
  const r = (S.stats.recent || []).slice().sort((a, b) => a - b);
  if (r.length < 2) return 500;
  return Math.max(500, Math.round(r[r.length >> 1] * 1.15));
}
