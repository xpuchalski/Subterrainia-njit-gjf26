// Small juice helpers shared by the game scene and world objects.
export default class Fx {
  constructor(scene) {
    this.scene = scene;
    const burst = (cfg) => scene.add.particles(0, 0, 'px', { emitting: false, ...cfg }).setDepth(8);

    this.dustEmitter = burst({
      lifespan: 450, speed: { min: 40, max: 150 }, angle: { min: 200, max: 340 },
      gravityY: 500, scale: { start: 1.2, end: 0 },
    });
    this.sparkEmitter = burst({
      lifespan: 200, speed: { min: 80, max: 220 }, scale: { start: 0.6, end: 0 }, tint: 0xfff59d,
    });
    this.sparkleEmitter = burst({
      lifespan: 600, speed: { min: 20, max: 90 }, scale: { start: 1, end: 0 }, tint: 0xfff176, gravityY: -60,
    });
  }

  dust(x, y, tint = 0xcccccc, count = 8) {
    this.dustEmitter.setParticleTint(tint).explode(count, x, y);
  }

  sparks(x, y) {
    this.sparkEmitter.explode(6, x, y);
  }

  sparkle(x, y) {
    this.sparkleEmitter.explode(14, x, y);
  }

  floatText(x, y, text, color = '#ffffff') {
    const t = this.scene.add.text(x, y, text, {
      fontFamily: 'monospace', fontSize: '16px', fontStyle: 'bold', color, stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(20);
    this.scene.tweens.add({ targets: t, y: y - 40, alpha: 0, duration: 900, ease: 'Quad.easeOut', onComplete: () => t.destroy() });
  }
}
