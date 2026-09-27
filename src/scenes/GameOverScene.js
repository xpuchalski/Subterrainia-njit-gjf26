import * as Phaser from 'phaser';
import { loadScores } from '../scoring.js';
import { sfx } from '../audio.js';

export default class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOver');
  }

  create({ score, floor, rank }) {
    const best = loadScores()[0]?.score ?? score;
    const isNewHigh = rank === 0;
    const { width, height } = this.scale;
    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7);

    const style = { fontFamily: 'monospace', color: '#ffffff', align: 'center' };
    this.add.text(width / 2, height / 2 - 110, 'YOU DUG TOO DEEP', { ...style, fontSize: '42px', fontStyle: 'bold', color: '#ff6b6b' }).setOrigin(0.5);
    this.add.text(width / 2, height / 2 - 30, `Score: ${score}\nDeepest layer: ${floor}`, { ...style, fontSize: '22px', lineSpacing: 8 }).setOrigin(0.5);
    this.add.text(width / 2, height / 2 + 35, isNewHigh ? 'NEW HIGH SCORE!' : rank > 0 ? `#${rank + 1} on the leaderboard · Best: ${best}` : `Best: ${best}`, {
      ...style, fontSize: '20px', color: isNewHigh ? '#fff176' : '#aaaaaa',
    }).setOrigin(0.5);

    const button = this.add.text(width / 2, height / 2 + 100, '[ DIG AGAIN ]', {
      ...style, fontSize: '24px', backgroundColor: '#333333', padding: { x: 14, y: 8 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    button.on('pointerover', () => button.setColor('#fff176'));
    button.on('pointerout', () => button.setColor('#ffffff'));
    this.add.text(width / 2, height / 2 + 150, 'Enter / Space to restart · ESC / M for menu', { ...style, fontSize: '14px', color: '#888888' }).setOrigin(0.5);

    const restart = () => {
      sfx(this, 'click');
      this.scene.stop('UI');
      this.scene.start('Game');
    };
    const menu = () => {
      sfx(this, 'click');
      this.scene.stop('UI');
      this.scene.stop('Game');
      this.scene.start('Menu');
    };

    // Short delay so a panicked click at death doesn't instantly restart
    this.time.delayedCall(600, () => {
      button.on('pointerdown', restart);
      this.input.keyboard.once('keydown-ENTER', restart);
      this.input.keyboard.once('keydown-SPACE', restart);
      this.input.keyboard.once('keydown-M', menu);
      this.input.keyboard.once('keydown-ESCAPE', menu);
    });
  }
}
