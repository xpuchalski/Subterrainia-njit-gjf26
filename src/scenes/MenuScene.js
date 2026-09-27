import * as Phaser from 'phaser';
import { UNLOCKS } from '../config.js';
import { loadScores } from '../scoring.js';
import { loadStats, isUnlocked, loadSkinsOff, saveSkinsOff } from '../unlocks.js';
import { playMusic, sfx } from '../audio.js';
import { TEXT, blink } from '../ui.js';

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create() {
    const { width, height } = this.scale;
    playMusic(this, 'music_menu');

    // Portrait on the left. It's a painted illustration, so use smooth filtering (the game default is pixel-art nearest).
    if (this.textures.exists('portrait')) {
      this.textures.get('portrait').setFilter(Phaser.Textures.FilterMode.LINEAR);
      // Bottom edge pushed below the screen so the unfinished feet are cropped off
      this.add.image(40, height + 45, 'portrait').setOrigin(0, 1);
    }
    const cx = 620; // everything else is centered in the space to the right of the portrait

    // Title
    this.add.text(cx, 40, 'Subterrainia', { ...TEXT, fontSize: '30px', fontStyle: 'bold', color: '#d4a017'}).setOrigin(0.5);

    // High scores
    const scores = loadScores();
    this.add.text(cx, 80, 'TOP SCORES', { ...TEXT, fontSize: '20px', fontStyle: 'bold', color: '#d4a017' }).setOrigin(0.5);
    const rows = scores.length
      ? scores.map((s, i) => `${String(i + 1).padStart(2)}. ${String(s.score).padStart(7)}   layer ${String(s.floor).padStart(2)}   ${s.date}`)
      : ['no runs yet'];
    this.add.text(cx, 102, rows.join('\n'), { ...TEXT, fontSize: '15px', lineSpacing: 5, color: '#dddddd' }).setOrigin(0.5, 0);

    // Earned unlocks only (locked ones stay secret). Click one to switch it on/off.
    const stats = loadStats();
    const earned = UNLOCKS.filter((u) => isUnlocked(u, stats));
    if (earned.length) {
      const off = loadSkinsOff();
      this.add.text(cx, 300, 'UNLOCKS  (click to toggle)', { ...TEXT, fontSize: '18px', fontStyle: 'bold', color: '#d4a017' }).setOrigin(0.5);
      earned.forEach((u, i) => {
        const row = this.add.text(cx, 326 + i * 24, '', { ...TEXT, fontSize: '15px' }).setOrigin(0.5, 0);
        const render = () => {
          const on = !off.has(u.skin);
          row.setText(`${on ? '[ON] ' : '[OFF]'} ${u.label}`).setColor(on ? '#ffc83d' : '#777777');
        };
        render();
        row.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
          if (off.has(u.skin)) off.delete(u.skin);
          else off.add(u.skin);
          saveSkinsOff(off);
          sfx(this, 'click');
          render();
        });
      });
    }

    const prompt = this.add.text(cx, height - 40, 'Press SPACE or click here to start', {
      ...TEXT, fontSize: '20px', color: '#aaaaaa',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    blink(this, prompt, 0.2);

    // Clicks elsewhere don't start the game, so the unlock toggles can be clicked
    const start = () => {
      sfx(this, 'click');
      this.scene.start('Game');
    };
    this.input.keyboard.once('keydown-SPACE', start);
    this.input.keyboard.once('keydown-ENTER', start);
    prompt.once('pointerdown', start);
  }
}
