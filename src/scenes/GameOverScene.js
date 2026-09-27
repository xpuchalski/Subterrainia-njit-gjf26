import * as Phaser from 'phaser';
import { loadScores } from '../scoring.js';
import { sfx } from '../audio.js';
import { TEXT, textButton, quitToMenu } from '../ui.js';

export default class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOver');
  }

  create({ score, floor, rank }) {
    const best = loadScores()[0]?.score ?? score;
    const isNewHigh = rank === 0;
    const { width, height } = this.scale;
    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7);

    this.add.text(width / 2, height / 2 - 110, 'YOU DUG TOO DEEP', { ...TEXT, fontSize: '42px', fontStyle: 'bold', color: '#ff6b6b' }).setOrigin(0.5);
    this.add.text(width / 2, height / 2 - 30, `Score: ${score}\nDeepest layer: ${floor}`, { ...TEXT, fontSize: '22px', lineSpacing: 8 }).setOrigin(0.5);
    this.add.text(width / 2, height / 2 + 35, isNewHigh ? 'NEW HIGH SCORE!' : rank > 0 ? `#${rank + 1} on the leaderboard · Best: ${best}` : `Best: ${best}`, {
      ...TEXT, fontSize: '20px', color: isNewHigh ? '#fff176' : '#aaaaaa',
    }).setOrigin(0.5);

    const button = textButton(this, width / 2, height / 2 + 100, '[ DIG AGAIN ]');
    this.add.text(width / 2, height / 2 + 150, 'Enter / Space to restart · ESC / M for menu', { ...TEXT, fontSize: '14px', color: '#888888' }).setOrigin(0.5);

    const restart = () => {
      sfx(this, 'click');
      this.scene.stop('UI');
      this.scene.start('Game');
    };
    const menu = () => {
      sfx(this, 'click');
      quitToMenu(this);
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
