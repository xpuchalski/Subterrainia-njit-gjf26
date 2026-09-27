import * as Phaser from 'phaser';
import { sfx } from '../audio.js';
import { TEXT, textButton, quitToMenu } from '../ui.js';

// Pause menu over the (paused) game: resume, or quit to the main menu
export default class PauseScene extends Phaser.Scene {
  constructor() {
    super('Pause');
  }

  create() {
    const { width, height } = this.scale;
    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.6);
    this.add.text(width / 2, height / 2 - 90, 'PAUSED', { ...TEXT, fontSize: '42px', fontStyle: 'bold' }).setOrigin(0.5);

    const resume = () => {
      sfx(this, 'click');
      this.scene.stop();
      this.scene.get('Game').resumeFromOverlay();
    };
    const toMenu = () => {
      sfx(this, 'click');
      quitToMenu(this);
    };

    textButton(this, width / 2, height / 2, '[ RESUME ]', resume);
    textButton(this, width / 2, height / 2 + 64, '[ MAIN MENU ]', toMenu);
    this.add.text(width / 2, height / 2 + 120, 'Esc / P to resume', { ...TEXT, fontSize: '14px', color: '#888888' }).setOrigin(0.5);

    this.input.keyboard.once('keydown-ESC', resume);
    this.input.keyboard.once('keydown-P', resume);
  }
}
