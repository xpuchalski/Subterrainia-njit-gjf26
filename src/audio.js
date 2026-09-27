import * as Phaser from 'phaser';
import { MUSIC_VOLUME, SFX_VOLUME, SFX, SETTINGS_KEY } from './config.js';
import { loadJSON, saveJSON } from './storage.js';

const MUSIC = ['music_menu', 'music_game', 'music_boss'];

// Player volume settings (0-1), saved across sessions
export const volume = { music: MUSIC_VOLUME, sfx: SFX_VOLUME, ...loadJSON(SETTINGS_KEY, {}) };

// Change a volume ('music' | 'sfx'), save it, and apply it to sounds that are already playing
export function setVolume(scene, which, v) {
  volume[which] = v;
  saveJSON(SETTINGS_KEY, volume);
  for (const s of scene.sound.sounds) {
    if (which === 'music' && MUSIC.includes(s.key)) s.setVolume(v);
    if (which === 'sfx' && s.key.startsWith('sfx_')) s.setVolume(v * (SFX[s.key.slice(4)]?.volume ?? 1));
  }
}

// Loop one music track, stopping the others. Calling it for the track that's already
// playing does nothing, so the game theme carries on across restarts and overlays.
// Browsers block audio until the first click/key press; until then the track waits.
export function playMusic(scene, key) {
  const sound = scene.sound;
  if (!scene.cache.audio.exists(key)) return; // file missing: stay silent
  const start = () => {
    for (const other of MUSIC) if (other !== key) sound.stopByKey(other);
    const track = sound.get(key) ?? sound.add(key, { loop: true, volume: volume.music });
    if (!track.isPlaying) track.play();
  };
  if (sound.locked) sound.once(Phaser.Sound.Events.UNLOCKED, start);
  else start();
}

// Audio key + config for an SFX entry, or null if it isn't defined/loaded (then it's just silent)
function sfxDef(scene, name) {
  const def = SFX[name];
  const key = `sfx_${name}`;
  return def && scene.cache.audio.exists(key) ? { key, def, volume: volume.sfx * (def.volume ?? 1) } : null;
}

// One-shot sound effect by SFX key (config.js). Slight random pitch keeps repeats from sounding
// robotic; the same sound twice within 40ms plays once.
const lastPlayed = {};
export function sfx(scene, name, { detune = 80 } = {}) {
  const s = sfxDef(scene, name);
  const now = performance.now();
  if (!s || now - (lastPlayed[name] ?? 0) < 40) return;
  lastPlayed[name] = now;
  scene.sound.play(s.key, { volume: s.volume, seek: s.def.seek ?? 0, detune: Phaser.Math.Between(-detune, detune) });
}

// A looping sound (e.g. footsteps) that can be started, stopped and sped up
export function loopSfx(scene, name) {
  const s = sfxDef(scene, name);
  return s ? scene.sound.add(s.key, { loop: true, volume: s.volume }) : null;
}
