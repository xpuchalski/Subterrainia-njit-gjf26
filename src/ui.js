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
