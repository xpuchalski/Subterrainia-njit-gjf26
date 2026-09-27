import { SPEED_BRACKETS, DEPTH_MULT_PER_FLOOR, SCORES_KEY, SCORES_KEPT } from './config.js';
import { loadJSON, saveJSON } from './storage.js';

export function speedMultiplier(seconds) {
  return SPEED_BRACKETS.find((b) => seconds < b.under).mult;
}

// floor is 1-based; floorIndex = floor - 1 so floor 1 = x1.0
export function depthMultiplier(floor) {
  return 1 + DEPTH_MULT_PER_FLOOR * (floor - 1);
}

export function floorScore(points, seconds, floor) {
  return Math.round(points * speedMultiplier(seconds) * depthMultiplier(floor));
}

// Leaderboard of past runs: [{ score, floor, date }], best first
export function loadScores() {
  const list = loadJSON(SCORES_KEY, []);
  return Array.isArray(list) ? list : [];
}

// Saves a finished run; returns its 0-based rank, or -1 if it didn't make the list
export function recordScore(score, floor) {
  const entry = { score, floor, date: new Date().toISOString().slice(0, 10) };
  const list = [...loadScores(), entry].sort((a, b) => b.score - a.score).slice(0, SCORES_KEPT);
  saveJSON(SCORES_KEY, list);
  return list.indexOf(entry);
}

export function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
