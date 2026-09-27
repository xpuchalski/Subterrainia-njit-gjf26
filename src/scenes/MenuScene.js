import * as Phaser from 'phaser';
import { UNLOCKS } from '../config.js';
import { loadScores } from '../scoring.js';
import { loadStats, saveStats, isUnlocked, loadEquipped, saveEquipped, skinFor } from '../unlocks.js';
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

    // Earned skins only (locked ones stay secret). One per weapon: click to equip it (or the plain weapon).
    const stats = loadStats();
    const earned = UNLOCKS.filter((u) => isUnlocked(u, stats));
    if (earned.length) {
      const equipped = loadEquipped();
      this.add.text(cx, 300, 'EQUIPPED  (click to choose)', { ...TEXT, fontSize: '18px', fontStyle: 'bold', color: '#d4a017' }).setOrigin(0.5);
      [['shotgun', 'Shotgun', cx - 130], ['pickaxe', 'Pickaxe', cx + 130]].forEach(([weapon, plain, x]) => {
        const options = [{ skin: weapon, label: plain }, ...earned.filter((u) => u.weapon === weapon)];
        const rows = options.map((o, i) =>
          this.add.text(x, 322 + i * 20, '', { ...TEXT, fontSize: '14px' }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true }));
        const render = () => {
          const current = skinFor(weapon, stats, equipped);
          options.forEach((o, i) => {
            const on = o.skin === current;
            rows[i].setText(on ? `> ${o.label} <` : o.label).setColor(on ? '#ffc83d' : '#888888');
          });
        };
        options.forEach((o, i) => rows[i].on('pointerdown', () => {
          equipped[weapon] = o.skin === weapon ? null : o.skin;
          saveEquipped(equipped);
          sfx(this, 'click');
          render();
        }));
        render();
      });
    }

    const prompt = this.add.text(cx, height - 40, 'Press SPACE or click here to start', {
      ...TEXT, fontSize: '20px', color: '#aaaaaa',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    blink(this, prompt, 0.2);

    // Secret: up up down down left right left right B A unlocks (and equips) the B&W pickaxe
    const code = ['UP', 'UP', 'DOWN', 'DOWN', 'LEFT', 'RIGHT', 'LEFT', 'RIGHT', 'B', 'A'].map((k) => Phaser.Input.Keyboard.KeyCodes[k]);
    let progress = 0;
    this.input.keyboard.on('keydown', (e) => {
      progress = e.keyCode === code[progress] ? progress + 1 : e.keyCode === code[0] ? 1 : 0;
      if (progress < code.length) return;
      progress = 0;
      if (stats.konami) return;
      stats.konami = 1;
      saveStats(stats);
      const equipped = loadEquipped();
      equipped.pickaxe = 'pickaxe_bw';
      saveEquipped(equipped);
      sfx(this, 'click');
      const t = this.add.text(cx, 290, 'UNLOCKED: B&W pickaxe!', { ...TEXT, fontSize: '22px', fontStyle: 'bold', color: '#ffffff', stroke: '#000000', strokeThickness: 4 }).setOrigin(0.5);
      this.tweens.add({ targets: t, alpha: 0, delay: 1200, duration: 400, onComplete: () => this.scene.restart() });
    });

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
