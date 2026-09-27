import { STATS_KEY, EQUIPPED_KEY, UNLOCKS, SKIN_STATS } from './config.js';
import { loadJSON, saveJSON } from './storage.js';

// Lifetime stats, kept across runs
export const loadStats = () => ({ kills: 0, shells: 0, deepest: 0, bosses: 0, playMs: 0, mintOrb: 0, konami: 0, ...loadJSON(STATS_KEY, {}) });
export const saveStats = (stats) => saveJSON(STATS_KEY, stats);

export const isUnlocked = (unlock, stats) => stats[unlock.stat] >= unlock.need;

// The equipped skin per weapon: { pickaxe: skinKey | null, shotgun: ... } (null = plain weapon).
// A weapon with no saved choice uses its most recently listed earned skin.
export const loadEquipped = () => loadJSON(EQUIPPED_KEY, {});
export const saveEquipped = (equipped) => saveJSON(EQUIPPED_KEY, equipped);

// Texture key for a weapon: the equipped skin if it's earned, else the plain weapon
export function skinFor(weapon, stats, equipped = loadEquipped()) {
  const earned = UNLOCKS.filter((u) => u.weapon === weapon && isUnlocked(u, stats));
  const choice = equipped[weapon];
  if (choice === undefined) return earned.at(-1)?.skin ?? weapon;
  return earned.some((u) => u.skin === choice) ? choice : weapon;
}

// Stat modifiers for a skin (1 / false when it has none)
export function skinStats(skin) {
  return { damage: 1, speed: 1, range: 1, points: 1, pellets: 1, shells: 1, fullMag: false, ...SKIN_STATS[skin] };
}
