import { STATS_KEY, SKINS_OFF_KEY, UNLOCKS } from './config.js';
import { loadJSON, saveJSON } from './storage.js';

// Lifetime stats: { kills, shells, deepest }, kept across runs
export const loadStats = () => ({ kills: 0, shells: 0, deepest: 0, ...loadJSON(STATS_KEY, {}) });
export const saveStats = (stats) => saveJSON(STATS_KEY, stats);

export const isUnlocked = (unlock, stats) => stats[unlock.stat] >= unlock.need;

// Skins the player turned off on the menu (a Set of skin keys)
export const loadSkinsOff = () => new Set(loadJSON(SKINS_OFF_KEY, []));
export const saveSkinsOff = (off) => saveJSON(SKINS_OFF_KEY, [...off]);

// Texture key for a weapon: its best unlocked skin that isn't switched off, or the default
export function skinFor(weapon, stats, off = loadSkinsOff()) {
  let key = weapon;
  for (const u of UNLOCKS) if (u.weapon === weapon && isUnlocked(u, stats) && !off.has(u.skin)) key = u.skin;
  return key;
}
