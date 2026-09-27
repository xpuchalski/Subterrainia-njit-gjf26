import * as Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, GRAVITY, DEBUG_PHYSICS, BACKGROUND_COLOR } from './config.js';
import PreloadScene from './scenes/PreloadScene.js';
import MenuScene from './scenes/MenuScene.js';
import GameScene from './scenes/GameScene.js';
import UIScene from './scenes/UIScene.js';
import GameOverScene from './scenes/GameOverScene.js';

const config = {
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: BACKGROUND_COLOR, // shows through every scene; cameras stay transparent
  pixelArt: true, // crisp scaling; set false for smooth art
  disableContextMenu: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: GRAVITY },
      debug: DEBUG_PHYSICS,
    },
  },
  scene: [PreloadScene, MenuScene, GameScene, UIScene, GameOverScene],
};

const game = new Phaser.Game(config);

// Handy for poking at the game from the browser console during development
if (import.meta.env.DEV) window.game = game;

export default game;
