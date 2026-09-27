import * as Phaser from 'phaser';
import { MUSIC_VOLUME, SFX_VOLUME, SFX } from './config.js';

const MUSIC = ['music_menu', 'music_game'];

// Loop one music track, stopping the others. Calling it for the track that's already
// playing does nothing, so the game theme carries on across restarts and overlays.
// Browsers block audio until the first click/key press; until then the track waits.
export function playMusic(scene, key) {
  const sound = scene.sound;
  if (!scene.cache.audio.exists(key)) return; // file missing: stay silent
  const start = () => {
    for (const other of MUSIC) if (other !== key) sound.stopByKey(other);
    const track = sound.get(key) ?? sound.add(key, { loop: true, volume: MUSIC_VOLUME });
    if (!track.isPlaying) track.play();
  };
  if (sound.locked) sound.once(Phaser.Sound.Events.UNLOCKED, start);
  else start();
}

// One-shot sound effect by SFX key (config.js). Missing files are silent. Slight random pitch
// keeps repeats from sounding robotic; the same sound twice within 40ms plays once.
const lastPlayed = {};
export function sfx(scene, name, { detune = 80 } = {}) {
  const def = SFX[name];
  const key = `sfx_${name}`;
  if (!def || !scene.cache.audio.exists(key)) return;
  const now = performance.now();
  if (now - (lastPlayed[name] ?? 0) < 40) return;
  lastPlayed[name] = now;
  scene.sound.play(key, {
    volume: SFX_VOLUME * (def.volume ?? 1),
    seek: def.seek ?? 0,
    detune: Phaser.Math.Between(-detune, detune),
  });
}

// A looping sound (e.g. footsteps) that can be started, stopped and sped up
export function loopSfx(scene, name) {
  const def = SFX[name];
  const key = `sfx_${name}`;
  if (!def || !scene.cache.audio.exists(key)) return null;
  return scene.sound.add(key, { loop: true, volume: SFX_VOLUME * (def.volume ?? 1) });
}
