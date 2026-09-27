import * as Phaser from 'phaser';
import { volume, setVolume } from './audio.js';

// Small UI helpers shared by the menu / overlay scenes
export const TEXT = { fontFamily: 'monospace', color: '#ffffff', align: 'center' };

// Pulse an object's alpha forever (the "press to start" style prompts)
export function blink(scene, target, minAlpha = 0.3, ms = 700) {
  scene.tweens.add({ targets: target, alpha: minAlpha, duration: ms, yoyo: true, repeat: -1 });
  return target;
}

// Clickable text button with a hover highlight
export function textButton(scene, x, y, label, onClick) {
  const b = scene.add.text(x, y, label, {
    ...TEXT, fontSize: '24px', backgroundColor: '#333333', padding: { x: 16, y: 8 },
  }).setOrigin(0.5).setInteractive({ useHandCursor: true });
  b.on('pointerover', () => b.setColor('#fff176'));
  b.on('pointerout', () => b.setColor('#ffffff'));
  if (onClick) b.on('pointerdown', onClick);
  return b;
}

// Leave a run (from an overlay scene) and go back to the main menu
export function quitToMenu(scene) {
  scene.scene.stop('UI');
  scene.scene.stop('Game');
  scene.scene.start('Menu');
}

// Horizontal slider for a 0-1 value: click or drag the bar. onChange(v) fires as it moves.
export function slider(scene, x, y, label, value, onChange, width = 160) {
  const left = x - width / 2;
  scene.add.text(left - 12, y, label, { ...TEXT, fontSize: '14px', color: '#dddddd' }).setOrigin(1, 0.5);
  scene.add.rectangle(x, y, width, 6, 0x555555);
  const fill = scene.add.rectangle(left, y, 0, 6, 0xd4a017).setOrigin(0, 0.5);
  const knob = scene.add.circle(left, y, 8, 0xffffff);
  const pct = scene.add.text(left + width + 12, y, '', { ...TEXT, fontSize: '13px', color: '#aaaaaa' }).setOrigin(0, 0.5);
  const show = (v) => {
    fill.width = width * v;
    knob.x = left + width * v;
    pct.setText(`${Math.round(v * 100)}%`);
  };
  show(value);

  // A taller invisible strip makes the thin bar easy to grab
  const hit = scene.add.rectangle(x, y, width + 16, 24, 0xffffff, 0).setInteractive({ useHandCursor: true, draggable: true });
  const set = (px) => {
    const v = Phaser.Math.Clamp((px - left) / width, 0, 1);
    show(v);
    onChange(v);
  };
  hit.on('pointerdown', (p) => set(p.x));
  hit.on('drag', (p) => set(p.x));
}

// Music + sound effect volume sliders, stacked
export function volumeSliders(scene, x, y) {
  slider(scene, x, y, 'Music', volume.music, (v) => setVolume(scene, 'music', v));
  slider(scene, x, y + 26, 'Sound', volume.sfx, (v) => setVolume(scene, 'sfx', v));
}
