import { STATS_KEY, SKINS_OFF_KEY, UNLOCKS } from './config.js';

// Lifetime stats: { kills, shells, deepest }, kept in localStorage across runs
export function loadStats() {
  const base = { kills: 0, shells: 0, deepest: 0 };
  try {
    return { ...base, ...JSON.parse(localStorage.getItem(STATS_KEY) || '{}') };
  } catch {
    return base;
  }
}

export function saveStats(stats) {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch {
    // storage unavailable (private mode etc.) — progress just won't persist
  }
}

export const isUnlocked = (unlock, stats) => stats[unlock.stat] >= unlock.need;

// Skins the player turned off on the menu (a Set of skin keys)
export function loadSkinsOff() {
  try {
    return new Set(JSON.parse(localStorage.getItem(SKINS_OFF_KEY) || '[]'));
  } catch {
    return new Set();
  }
}

export function saveSkinsOff(off) {
  try {
    localStorage.setItem(SKINS_OFF_KEY, JSON.stringify([...off]));
  } catch {
    // storage unavailable — the toggle just won't persist
  }
}

// Texture key for a weapon: its best unlocked skin that isn't switched off, or the default
export function skinFor(weapon, stats, off = loadSkinsOff()) {
  let key = weapon;
  for (const u of UNLOCKS) if (u.weapon === weapon && isUnlocked(u, stats) && !off.has(u.skin)) key = u.skin;
  return key;
}
