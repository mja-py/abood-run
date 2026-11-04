// Progression: save data, in-game dirhams, shop, wardrobe, badges, daily missions and login rewards.
// Everything lives in localStorage on this device. Dirhams are an in-game currency only: there are no real payments.
const KEY = 'abood-save-v1';
const pad = n => String(n).padStart(2, '0');
export const today = () => { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
const dayNo = s => Math.round(new Date(s + 'T12:00:00').getTime() / 864e5);
const hash = s => { let h = 2166136261; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

export const CHARS = [
  { id: 'abood', girl: false, skin: '#c98b5a', skinD: '#a8704a', skinL: '#e0a978', price: 0 },
  { id: 'mozah', girl: true, skin: '#d6a070', skinD: '#b47e50', skinL: '#ecbd90', price: 300 },
  { id: 'saif', girl: false, skin: '#9c6a43', skinD: '#7d5232', skinL: '#b98558', price: 250 },
];
export const ROBES = [
  { id: 'white', col: '#fbfaf4', shade: '#dcd8cb', price: 0 },
  { id: 'cream', col: '#f1e6cf', shade: '#d4c3a0', price: 60 },
  { id: 'grey', col: '#d9dbe0', shade: '#b0b5c0', price: 80 },
  { id: 'blue', col: '#cfe3f2', shade: '#a1c0da', price: 100 },
  { id: 'brown', col: '#9a7353', shade: '#775638', price: 120 },
  { id: 'pink', col: '#f6c9d8', shade: '#d9a0b3', price: 100, girl: true },
  { id: 'purple', col: '#cdb6e8', shade: '#a68cc8', price: 120, girl: true },
  { id: 'gold', col: '#f4e3a8', shade: '#d4b96e', price: 0, badge: 'dist2000' },
];
export const HEADS = [
  { id: 'shemagh', price: 0, boy: true },
  { id: 'ghutra', price: 60, boy: true },
  { id: 'blackshemagh', price: 90, boy: true },
  { id: 'tagiyah', price: 50, boy: true },
  { id: 'shayla_pink', price: 0, girl: true, col: '#e8789f' },
  { id: 'shayla_purple', price: 60, girl: true, col: '#8a5cc2' },
  { id: 'shayla_black', price: 60, girl: true, col: '#25222b' },
];
export const BOOSTERS = [
  { id: 'vimto', price: 50 }, { id: 'magnet', price: 40 }, { id: 'headstart', price: 80 }, { id: 'shield', price: 60 }, { id: 'revive', price: 120 },
];
// badges: `run` is checked against this run, `life` against lifetime stats
export const BADGES = [
  { id: 'first', reward: 20, life: s => s.runs >= 1 },
  { id: 'dist500', reward: 50, run: r => r.dist >= 500 },
  { id: 'dist1000', reward: 100, run: r => r.dist >= 1000 },
  { id: 'dist2000', reward: 200, run: r => r.dist >= 2000, unlock: 'robe:gold' },
  { id: 'zone1', reward: 40, life: s => s.zones.includes(1) },
  { id: 'zone2', reward: 60, life: s => s.zones.includes(2) },
  { id: 'zone3', reward: 80, life: s => s.zones.includes(3) },
  { id: 'sweets100', reward: 50, life: s => s.sweets >= 100 },
  { id: 'sweets1000', reward: 150, life: s => s.sweets >= 1000 },
  { id: 'close10', reward: 80, run: r => r.close >= 10 },
  { id: 'sandal10', reward: 60, life: s => s.dodged >= 10 },
  { id: 'smash10', reward: 60, life: s => s.smash >= 10 },
  { id: 'powers', reward: 80, life: s => s.powers.length >= 5 },
  { id: 'streak7', reward: 150, life: s => s.streak >= 7 },
  { id: 'shopper', reward: 30, life: s => s.bought >= 1 },
  { id: 'revived', reward: 30, life: s => s.revivesUsed >= 1 },
];
const MISSIONS = [
  { kind: 'runDist', goals: [400, 700, 1000], reward: g => Math.round(g / 10 + 30) },
  { kind: 'daySweets', goals: [80, 150, 250], reward: g => Math.round(g / 3 + 30) },
  { kind: 'dayClose', goals: [5, 10], reward: g => g * 8 + 20 },
  { kind: 'dayDodge', goals: [3, 6], reward: g => g * 12 + 20 },
  { kind: 'dayPower', goals: [4, 8], reward: g => g * 8 + 20 },
  { kind: 'dayRuns', goals: [3, 5], reward: g => g * 12 },
  { kind: 'runZone', goals: [2, 3], reward: g => g * 40 + 20 },
];
export const LOGIN = [20, 30, 40, 50, 60, 80, 150];

const fresh = () => ({
  coins: 100, char: 'abood', robe: 'white', head: 'shemagh',
  owned: { char: ['abood'], robe: ['white'], head: ['shemagh', 'shayla_pink'] },
  boosters: { vimto: 0, magnet: 0, headstart: 0, shield: 0, revive: 1 },
  stats: { runs: 0, sweets: 0, close: 0, dodged: 0, smash: 0, zones: [0], powers: [], revivesUsed: 0, bought: 0, best: 0, streak: 0 },
  badges: {}, daily: null, login: { last: null, streak: 0 },
});
let S = fresh();
try {
  const raw = localStorage.getItem(KEY);
  if (raw) { const d = JSON.parse(raw); S = Object.assign(fresh(), d); S.stats = Object.assign(fresh().stats, d.stats || {}); S.owned = Object.assign(fresh().owned, d.owned || {}); S.boosters = Object.assign(fresh().boosters, d.boosters || {}); }
  else { const old = +localStorage.getItem('abood-best') || 0; S.stats.best = old; }
} catch (e) {}
export const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };
export const data = () => S;
export const charOf = () => CHARS.find(c => c.id === S.char) || CHARS[0];
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
  m.claimed = true; S.coins += m.reward; save(); return m.reward;
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
  else if (ev === 'power') { D.day.power += 1; if (!s.powers.includes(n)) s.powers.push(n); }
  else if (ev === 'zone') { if (!s.zones.includes(n)) s.zones.push(n); }
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
  return got;
}
// Called when a run ends (and again if the player revives and ends later): pays only what has not been paid yet.
export function endRun(run) {
  bumpMissions(run);
  const pay = Math.max(0, Math.floor(run.dist / 25) + Math.floor(run.sweets / 4) - (run.paid || 0));
  run.paid = (run.paid || 0) + pay; S.coins += pay;
  const nb = Math.floor(run.dist) > S.stats.best; if (nb) S.stats.best = Math.floor(run.dist);
  const badges = checkBadges(run);
  save();
  return { earned: pay, newBest: nb, badges };
}

// ---- shop and wardrobe ----
export function buy(kind, id) {
  const list = kind === 'char' ? CHARS : kind === 'robe' ? ROBES : kind === 'head' ? HEADS : BOOSTERS;
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
  if (kind === 'char') { // keep the outfit valid for the chosen character
    const girl = charOf().girl, h = headOf();
    if (girl && !h.girl) S.head = 'shayla_pink';
    if (!girl && h.girl) S.head = 'shemagh';
    const r = robeOf(); if (!girl && r.girl) S.robe = 'white';
  }
  save(); return true;
}
export function useBooster(id) { if ((S.boosters[id] || 0) <= 0) return false; S.boosters[id]--; save(); return true; }
export const bestDist = () => S.stats.best;
