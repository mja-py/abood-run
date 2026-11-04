// Progression: save data, in-game dirhams, shop, wardrobe, badges, daily missions and login rewards.
// Everything lives in localStorage on this device. Dirhams are an in-game currency only: there are no real payments.
const KEY = 'abood-save-v1';
const pad = n => String(n).padStart(2, '0');
export const today = () => { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
const dayNo = s => Math.round(new Date(s + 'T12:00:00').getTime() / 864e5);
const hash = s => { let h = 2166136261; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

// One character, Abood. The avatar changes his look; Baba always calls him by his name.
export const AVATARS = [
  { id: 'classic', price: 0 },
  { id: 'glasses', price: 1200 },
  { id: 'shades', price: 1800 },
];
export const ROBES = [
  { id: 'white', col: '#fbfaf4', shade: '#dcd8cb', price: 0 },
  { id: 'cream', col: '#f1e6cf', shade: '#d4c3a0', price: 600 },
  { id: 'grey', col: '#d9dbe0', shade: '#b0b5c0', price: 800 },
  { id: 'blue', col: '#cfe3f2', shade: '#a1c0da', price: 1100 },
  { id: 'brown', col: '#9a7353', shade: '#775638', price: 1500 },
  { id: 'gold', col: '#f4e3a8', shade: '#d4b96e', price: 0, badge: 'dist10000', perk: 'perk_gold', slow: 0.6 },
  // football kits named after five UAE clubs (colours only, no badges are drawn); each slows Baba by 20%
  { id: 'kit_purple', col: '#5b2a86', shade: '#43206a', price: 1500, perk: 'perk_kit', slow: 0.8, kit: { main: '#5b2a86', trim: '#ffffff', shorts: '#ffffff', sock: '#5b2a86', num: '#ffffff' } },
  { id: 'kit_yellow', col: '#f2c230', shade: '#c99a16', price: 1500, perk: 'perk_kit', slow: 0.8, kit: { main: '#f2c230', trim: '#1d1d1d', shorts: '#1d1d1d', sock: '#f2c230', num: '#1d1d1d', stripes: 1 } },
  { id: 'kit_red', col: '#c8202b', shade: '#9a1520', price: 1500, perk: 'perk_kit', slow: 0.8, kit: { main: '#c8202b', trim: '#1d1d1d', shorts: '#1d1d1d', sock: '#c8202b', num: '#ffffff', band: 1 } },
  { id: 'kit_blue', col: '#1f4fa0', shade: '#173b78', price: 1500, perk: 'perk_kit', slow: 0.8, kit: { main: '#1f4fa0', trim: '#ffffff', shorts: '#ffffff', sock: '#1f4fa0', num: '#ffffff' } },
  { id: 'kit_white', col: '#fbfaf4', shade: '#dcd8cb', price: 1500, perk: 'perk_kit', slow: 0.8, kit: { main: '#fbfaf4', trim: '#c8202b', shorts: '#fbfaf4', sock: '#fbfaf4', num: '#c8202b', band: 1 } },
];
export const HEADS = [
  { id: 'shemagh', price: 0 },
  { id: 'ghutra', price: 700 },
  { id: 'blackshemagh', price: 1300 },
  { id: 'tagiyah', price: 1000 },
];
export const BOOSTERS = [
  { id: 'vimto', price: 15 }, { id: 'magnet', price: 12 }, { id: 'headstart', price: 25 }, { id: 'shield', price: 20 }, { id: 'revive', price: 120 },
];
// one-off badges: `run` is checked against this run, `life` against lifetime stats
export const BADGES = [
  { id: 'first', reward: 5, life: s => s.runs >= 1 },
  { id: 'dist10000', reward: 250, run: r => r.dist >= 10000, unlock: 'robe:gold' },
  { id: 'shopper', reward: 7, life: s => s.bought >= 1 },
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
const MISSIONS = [
  { kind: 'runDist', goals: [400, 700, 1000], reward: g => Math.round(g * 0.03 + 15) },
  { kind: 'daySweets', goals: [80, 150, 250], reward: g => Math.round(g * 0.1 + 15) },
  { kind: 'dayClose', goals: [5, 10], reward: g => g * 2 + 15 },
  { kind: 'dayDodge', goals: [3, 6], reward: g => g * 4 + 15 },
  { kind: 'dayPower', goals: [4, 8], reward: g => Math.round(g * 2.5 + 15) },
  { kind: 'dayRuns', goals: [3, 5], reward: g => g * 5 + 10 },
  { kind: 'runZone', goals: [2, 3], reward: g => g * 12 + 10 },
];
export const DAILY_BONUS = 30; // for finishing all three missions in a day
export const LOGIN = [3, 4, 5, 6, 8, 10, 25];

const fresh = () => ({
  econ: 3, coins: 5, avatar: 'classic', robe: 'white', head: 'shemagh',
  owned: { avatar: ['classic'], robe: ['white'], head: ['shemagh'] },
  boosters: { vimto: 0, magnet: 0, headstart: 0, shield: 0, revive: 0 },
  stats: { recent: [], totalDist: 0, areas: 0, powersTotal: 0, runs: 0, sweets: 0, close: 0, dodged: 0, smash: 0, zones: [0], powers: [], revivesUsed: 0, bought: 0, best: 0, streak: 0 },
  badges: {}, tiers: {}, daily: null, login: { last: null, streak: 0 },
});
let S = fresh();
try {
  const raw = localStorage.getItem(KEY);
  if (raw) { const d = JSON.parse(raw); if (d.econ === 2) { d.coins = Math.round((d.coins || 0) / 100); d.econ = 3; }
    if (d.econ !== 3) { const f = fresh(); if (d.login) f.login = d.login; Object.keys(d).forEach(k => delete d[k]); Object.assign(d, f); } S = Object.assign(fresh(), d); S.stats = Object.assign(fresh().stats, d.stats || {}); S.owned = Object.assign(fresh().owned, d.owned || {}); S.boosters = Object.assign(fresh().boosters, d.boosters || {}); }
  else { const old = +localStorage.getItem('abood-best') || 0; S.stats.best = old; }
} catch (e) {}
(function migrate() {
  for (const k of Object.keys(S.badges || {})) if (!BADGES.some(b => b.id === k)) delete S.badges[k];
  S.tiers = S.tiers || {};
  const refund = { char: { mozah: 300, saif: 250 }, robe: { pink: 100, purple: 120 }, head: { shayla_purple: 60, shayla_black: 60 } };
  for (const kind of Object.keys(refund)) for (const id of (S.owned[kind] || [])) if (refund[kind][id]) S.coins += refund[kind][id];
  delete S.owned.char; delete S.char;
  S.owned.avatar = S.owned.avatar || ['classic']; if (!AVATARS.some(a => a.id === S.avatar)) S.avatar = 'classic';
  S.owned.robe = S.owned.robe.filter(id => ROBES.some(r => r.id === id)); if (!ROBES.some(r => r.id === S.robe)) S.robe = 'white';
  S.owned.head = S.owned.head.filter(id => HEADS.some(h => h.id === id)); if (!HEADS.some(h => h.id === S.head)) S.head = 'shemagh';
  if (!S.owned.robe.includes('white')) S.owned.robe.unshift('white'); if (!S.owned.head.includes('shemagh')) S.owned.head.unshift('shemagh');
})();
export const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };
export const data = () => S;
export const avatarOf = () => AVATARS.find(a => a.id === S.avatar) || AVATARS[0];
export const robeOf = () => ROBES.find(r => r.id === S.robe) || ROBES[0];
export const headOf = () => HEADS.find(h => h.id === S.head) || HEADS[0];

// ---- daily missions ----
export function ensureDaily() {
  const d = today();
  if (S.daily && S.daily.date === d) return S.daily;
  const h = hash(d), pool = MISSIONS.map((m, i) => i), picks = [];
  for (let k = 0; k < 3; k++) { const j = (h >>> (k * 5)) % pool.length; picks.push(pool.splice(j, 1)[0]); }
  S.daily = { date: d, day: { sweets: 0, close: 0, dodge: 0, power: 0, runs: 0 }, missions: picks.map((mi, k) => {
    const m = MISSIONS[mi], goal = m.goals[(h >>> (k * 3 + 16)) % m.goals.length]; return { kind: m.kind, goal, reward: m.reward(goal), progress: 0, claimed: false };
  }) };
  save(); return S.daily;
}
function bumpMissions(run) {
  const D = ensureDaily();
  for (const m of D.missions) {
    if (m.kind === 'runDist' && run) m.progress = Math.max(m.progress, Math.floor(run.dist));
    if (m.kind === 'runZone' && run) m.progress = Math.max(m.progress, run.zoneMax);
    if (m.kind === 'daySweets') m.progress = D.day.sweets;
    if (m.kind === 'dayClose') m.progress = D.day.close;
    if (m.kind === 'dayDodge') m.progress = D.day.dodge;
    if (m.kind === 'dayPower') m.progress = D.day.power;
    if (m.kind === 'dayRuns') m.progress = D.day.runs;
  }
}
export function claimMission(i) {
  const m = ensureDaily().missions[i]; if (!m || m.claimed || m.progress < m.goal) return 0;
  m.claimed = true; S.coins += m.reward; let got = m.reward;
  const D = ensureDaily(); if (!D.bonus && D.missions.every(x => x.claimed)) { D.bonus = true; S.coins += DAILY_BONUS; got += DAILY_BONUS; }
  save(); return got;
}
export const missionsReady = () => ensureDaily().missions.filter(m => !m.claimed && m.progress >= m.goal).length;

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
  const D = ensureDaily(), s = S.stats;
  if (ev === 'sweets') { s.sweets += n; D.day.sweets += n; }
  else if (ev === 'close') { s.close += 1; D.day.close += 1; }
  else if (ev === 'dodge') { s.dodged += 1; D.day.dodge += 1; }
  else if (ev === 'smash') s.smash += 1;
  else if (ev === 'power') { D.day.power += 1; s.powersTotal = (s.powersTotal || 0) + 1; if (!s.powers.includes(n)) s.powers.push(n); }
  else if (ev === 'zone') { s.areas = (s.areas || 0) + 1; if (!s.zones.includes(n)) s.zones.push(n); }
  else if (ev === 'run') { s.runs += 1; D.day.runs += 1; }
  else if (ev === 'revive') s.revivesUsed += 1;
  bumpMissions(null);
}
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
// Called when a run ends (and again if the player revives and ends later): pays only what has not been paid yet.
export function endRun(run) {
  bumpMissions(run);
  // remember recent run distances so the game can pace itself to this player
  const rec = S.stats.recent || (S.stats.recent = []);
  if (!run.logged) { rec.push(Math.floor(run.dist)); run.logged = true; if (rec.length > 8) rec.shift(); } else rec[rec.length - 1] = Math.max(rec[rec.length - 1], Math.floor(run.dist));
  S.stats.totalDist = (S.stats.totalDist || 0) + Math.max(0, Math.floor(run.dist - (run.distLogged || 0))); run.distLogged = Math.floor(run.dist);
  const pay = Math.max(0, Math.floor(run.dist / 1000) + Math.floor(run.sweets / 200) - (run.paid || 0)); // small change: missions are the real income
  run.paid = (run.paid || 0) + pay; S.coins += pay;
  const nb = Math.floor(run.dist) > S.stats.best; if (nb) S.stats.best = Math.floor(run.dist);
  const badges = checkBadges(run);
  save();
  return { earned: pay, newBest: nb, badges };
}

// ---- shop and wardrobe ----
export function buy(kind, id) {
  const list = kind === 'avatar' ? AVATARS : kind === 'robe' ? ROBES : kind === 'head' ? HEADS : BOOSTERS;
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
