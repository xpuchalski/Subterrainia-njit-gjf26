import * as Phaser from 'phaser';
import { PLAYER, SHOTGUN } from '../config.js';
import { formatTime } from '../scoring.js';
import { sfx } from '../audio.js';
import { TEXT, blink } from '../ui.js';

const FONT = { ...TEXT, align: 'left', fontSize: '18px', stroke: '#000000', strokeThickness: 3 };

// HUD drawn on top of GameScene; unaffected by the game camera.
export default class UIScene extends Phaser.Scene {
  constructor() {
    super('UI');
  }

  create() {
    const { width, height } = this.scale;
    const game = this.scene.get('Game');
    this.gameScene = game; // the HUD reads its state directly each frame

    // Health
    this.hearts = [];
    for (let i = 0; i < PLAYER.maxHp; i++) {
      this.hearts.push(this.add.image(20 + i * 18, 20, 'heart'));
    }

    // Score / layer / time
    this.scoreText = this.add.text(12, 34, '', FONT);
    this.floorText = this.add.text(12, 58, '', { ...FONT, fontSize: '15px' });
    this.timeText = this.add.text(12, 78, '', { ...FONT, fontSize: '15px' });

    // Weapons
    this.pickLabel = this.add.text(12, height - 58, '[1] PICKAXE', { ...FONT, fontSize: '15px' });
    this.gunLabel = this.add.text(12, height - 34, '[2] SHOTGUN', { ...FONT, fontSize: '15px' });
    this.shellIcons = [];
    for (let i = 0; i < SHOTGUN.tubeSize; i++) {
      this.shellIcons.push(this.add.image(136 + i * 12, height - 25, 'shell'));
    }
    this.reloadText = this.add.text(136 + SHOTGUN.tubeSize * 12 + 4, height - 34, 'RELOADING', {
      ...FONT, fontSize: '13px', color: '#ffcc80',
    });

    this.add.text(width - 12, height - 12,
      'A/D · move | Space/W · jump | S/Shift · crouch | Click · use | R · reload | 1/2/scroll wheel · swap | Esc · pause',
      { ...FONT, fontSize: '11px', color: '#dddddd', strokeThickness: 2 }
    ).setOrigin(1, 1).setAlpha(0.7);

    this.buildResultsPanel(width, height);

    // Results screen: the game scene pauses itself; a click here resumes it
    const onResults = (r) => this.showResults(r);
    const onUnlock = (label) => this.showBanner(`UNLOCKED: ${label}!`);
    const onBanner = (text, color) => this.showBanner(text, color);
    game.events.on('banner', onBanner);
    game.events.on('floor-results', onResults);
    game.events.on('unlock', onUnlock);
    this.events.once('shutdown', () => {
      game.events.off('floor-results', onResults);
      game.events.off('unlock', onUnlock);
      game.events.off('banner', onBanner);
    });
    // Click / Space / Enter advances whichever overlay is open
    const advance = () => {
      if (!this.textBox.visible && !this.results.visible) return;
      sfx(this, 'click');
      if (this.textBox.visible) this.nextTextPage();
      else {
        this.results.setVisible(false);
        game.resumeFromOverlay();
      }
    };
    this.input.on('pointerdown', advance);
    this.input.keyboard.on('keydown-SPACE', advance);
    this.input.keyboard.on('keydown-ENTER', advance);

    // Story dump at the start of a run (public/assets/start_box.txt)
    this.buildTextBox(width, height);
    if (game.floorNum === 1 && game.state === 'entering') {
      this.showTextBox(this.cache.text.get('start_box'), () => game.resumeFromOverlay());
      if (this.textBox.visible) game.scene.pause();
    }
  }

  buildTextBox(width, height) {
    this.textBoxBg = this.add.rectangle(0, 0, 600, 200, 0x000000, 0.85).setStrokeStyle(2, 0xffffff, 0.6);
    this.textBoxBody = this.add.text(0, 0, '', {
      ...FONT, fontSize: '16px', lineSpacing: 6, align: 'left', wordWrap: { width: 560, useAdvancedWrap: true },
    }).setOrigin(0.5);
    this.textBoxHint = this.add.text(0, 0, '', { ...FONT, fontSize: '13px', color: '#aaaaaa' }).setOrigin(0.5);
    this.textBox = this.add.container(width / 2, height / 2, [this.textBoxBg, this.textBoxBody, this.textBoxHint]);
    this.textBox.setVisible(false);
  }

  // Shows `text` in a box, one page at a time. A line containing only --- starts a new page.
  // Calls onDone after the last page is dismissed. Empty/missing text shows nothing.
  showTextBox(text, onDone) {
    const pages = (text ?? '').replace(/\r/g, '').split(/^\s*---\s*$/m).map((p) => p.trim()).filter(Boolean);
    if (!pages.length) return;
    this.textPages = pages;
    this.textPage = -1;
    this.onTextDone = onDone;
    this.textBox.setVisible(true);
    this.nextTextPage();
  }

  nextTextPage() {
    this.textPage++;
    if (this.textPage >= this.textPages.length) {
      this.textBox.setVisible(false);
      this.onTextDone?.();
      return;
    }
    this.textBoxBody.setText(this.textPages[this.textPage]);
    // Size the box to the page, capped to the screen
    const h = Math.min(this.scale.height - 40, this.textBoxBody.height + 70);
    this.textBoxBg.setSize(600, h);
    this.textBoxBody.setY(-12);
    const last = this.textPage === this.textPages.length - 1;
    const more = this.textPages.length > 1 ? `(${this.textPage + 1}/${this.textPages.length}) ` : '';
    this.textBoxHint.setText(`${more}Click to ${last ? 'start' : 'continue'}`).setY(h / 2 - 18);
  }

  buildResultsPanel(width, height) {
    const bg = this.add.rectangle(0, 0, 360, 340, 0x000000, 0.8).setStrokeStyle(2, 0xffffff, 0.6);
    this.resultsTitle = this.add.text(0, -132, '', { ...FONT, fontSize: '22px', fontStyle: 'bold' }).setOrigin(0.5);
    this.resultsBody = this.add.text(-150, -100, '', { ...FONT, fontSize: '16px', lineSpacing: 6 });
    const hint = blink(this, this.add.text(0, 140, 'Click to continue', { ...FONT, fontSize: '14px', color: '#aaaaaa' }).setOrigin(0.5), 0.3, 600);
    this.results = this.add.container(width / 2, height / 2 - 10, [bg, this.resultsTitle, this.resultsBody, hint]);
    this.results.setVisible(false);
  }

  // Center-screen announcement (unlocks, boss). Banners stack if several show at once.
  showBanner(text, color = '#ffc83d') {
    const { width } = this.scale;
    const y = 90 + (this.unlockBanners = (this.unlockBanners ?? 0) + 1) * 34;
    const t = this.add.text(width / 2, y, text, {
      ...FONT, fontSize: '22px', fontStyle: 'bold', color, strokeThickness: 5,
    }).setOrigin(0.5).setAlpha(0);
    this.tweens.chain({
      targets: t,
      tweens: [{ alpha: 1, y: y - 10, duration: 250 }, { alpha: 0, duration: 500, delay: 2200 }],
      onComplete: () => {
        t.destroy();
        this.unlockBanners--;
      },
    });
  }

  showResults(r) {
    this.resultsTitle.setText(`LAYER ${r.floor} CLEARED`);
    this.resultsBody.setText([
      `Points           ${r.points}`,
      `Time             ${formatTime(r.seconds)}`,
      `Speed mult       x${r.speedMult.toFixed(2)}`,
      `Depth mult       x${r.depthMult.toFixed(2)}`,
      `Layer score      ${r.floorScore}`,
      '',
      `TOTAL            ${r.total}`,
    ]);
    this.results.setVisible(true);
  }

  update() {
    const g = this.gameScene;
    const { hp } = g.player;
    const { shells, reloading } = g.weapons;
    const gun = g.weapons.current === 'shotgun';

    this.hearts.forEach((h, i) => h.setAlpha(i < hp ? 1 : 0.2));
    this.scoreText.setText(`SCORE ${g.totalScore}`);
    this.floorText.setText(`Layer ${g.floorNum}`);
    this.timeText.setText(`Time ${formatTime(g.floorTime)}`);
    this.pickLabel.setColor(gun ? '#777777' : '#ffffff');
    this.gunLabel.setColor(gun ? '#ffffff' : '#777777');
    this.shellIcons.forEach((s, i) => s.setAlpha(i < shells ? (gun ? 1 : 0.5) : 0.12));
    this.reloadText.setVisible(reloading);
  }
}
