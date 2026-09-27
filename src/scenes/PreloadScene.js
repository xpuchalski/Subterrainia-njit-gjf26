import * as Phaser from 'phaser';
import { TILE, ENEMY, PLAYER_ART, SFX } from '../config.js';
import { TEXT, blink } from '../ui.js';

// Loads all game assets and shows a progress bar.
export default class PreloadScene extends Phaser.Scene {
  constructor() {
    super('Preload');
  }

  preload() {
    const { width, height } = this.scale;
    const bar = this.add.rectangle(width / 2 - 150, height / 2, 0, 16, 0xffffff).setOrigin(0, 0.5);
    this.add.rectangle(width / 2, height / 2, 304, 20).setStrokeStyle(2, 0xffffff);
    this.load.on('progress', (p) => (bar.width = 300 * p));

    // Real assets live in public/assets (images in sprites/, music in music/, sound effects in sfx/). A texture with the same key as a placeholder below replaces it.
    this.load.image('player_art', 'assets/sprites/player_body.png');
    this.load.image('arm_extended', 'assets/sprites/arm_extended.png');
    this.load.image('arm_bent', 'assets/sprites/arm_bent.png');
    this.load.image('portrait', 'assets/sprites/portrait.png');
    this.load.text('start_box', 'assets/start_box.txt'); // story shown at the start of a run
    this.load.audio('music_menu', 'assets/music/Menu-Theme.mp3');
    this.load.audio('music_game', 'assets/music/Game-Theme.mp3');
    this.load.audio('music_boss', 'assets/music/boss_theme.mp3');
    for (const [name, def] of Object.entries(SFX)) this.load.audio(`sfx_${name}`, `assets/sfx/${def.file}`);
    for (const prefix of ['enemy_', 'enemy_thrower_']) {
      for (const { name } of ENEMY.rig.parts) this.load.image(`${prefix}${name}`, `assets/sprites/${prefix}${name}.png`);
    }
    for (const tier of ['common', 'uncommon', 'rare']) this.load.image(`fossil_${tier}_art`, `assets/sprites/fossil_${tier}.png`);
  }

  create() {
    this.buildPlayerTextures();
    this.buildFossilTextures();
    this.makePlaceholderTextures();

    // Browsers block audio until the first click/key press. If it's still blocked, ask for a
    // click here so the menu theme can start as soon as the menu appears.
    if (!this.sound.locked) {
      this.scene.start('Menu');
      return;
    }
    this.children.removeAll(true); // clear the loading bar
    const { width, height } = this.scale;
    blink(this, this.add.text(width / 2, height / 2, 'Click anywhere to begin', { ...TEXT, fontSize: '24px', color: '#dddddd' }).setOrigin(0.5));
    let started = false;
    const go = () => {
      if (started) return;
      started = true;
      this.scene.start('Menu');
    };
    this.input.once('pointerdown', go);
    this.input.keyboard.once('keydown', go);
  }

  // Pixels of a loaded image cropped to its non-transparent area: { w, h, px (RGBA array) }
  trimmed(key) {
    const src = this.textures.get(key).getSourceImage();
    const canvas = document.createElement('canvas');
    canvas.width = src.width;
    canvas.height = src.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(src, 0, 0);
    const all = ctx.getImageData(0, 0, src.width, src.height).data;
    let minX = src.width, minY = src.height, maxX = -1, maxY = -1;
    for (let y = 0; y < src.height; y++) {
      for (let x = 0; x < src.width; x++) {
        if (all[(y * src.width + x) * 4 + 3] === 0) continue;
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      }
    }
    const w = maxX - minX + 1;
    const h = maxY - minY + 1;
    return { w, h, px: ctx.getImageData(minX, minY, w, h).data };
  }

  // fossil_<tier> = the fossil art trimmed to its pixels (so it centers and rests on tiles properly)
  buildFossilTextures() {
    for (const tier of ['common', 'uncommon', 'rare']) {
      if (!this.textures.exists(`fossil_${tier}_art`)) continue; // falls back to the placeholder circles
      const { w, h, px } = this.trimmed(`fossil_${tier}_art`);
      const tex = this.textures.createCanvas(`fossil_${tier}`, w, h);
      tex.context.putImageData(new ImageData(new Uint8ClampedArray(px), w, h), 0, 0);
      tex.refresh();
    }
  }

  // Builds every player pose from the one body image, at load time:
  //   player          standing, cropped to the character (so flipping mirrors her in place)
  //   player_crouch   legs squashed
  //   player_inhale / player_exhale   upper body 1px up / down (idle breathing)
  //   player_walk0-3  legs slanted forward/back, passing foot lifted (walk cycle)
  buildPlayerTextures() {
    if (!this.textures.exists('player_art')) return; // falls back to the placeholder boxes
    const { w, h, px } = this.trimmed('player_art');
    const alphaAt = (x, y) => px[(y * w + x) * 4 + 3];

    const waist = Math.round(h * PLAYER_ART.waist);
    const legs = h - waist;

    // Copies each source pixel to where `map(x, y)` says ([] = drop it, several = duplicate it).
    // Every frame gets `pad` empty columns on each side so walking feet aren't clipped;
    // Player.shoulder() reads it back from customData.
    const pad = PLAYER_ART.walkStride;
    const outW = w + pad * 2;
    const pose = (key, outH, map) => {
      const tex = this.textures.createCanvas(key, outW, outH);
      tex.customData.padX = pad;
      const out = tex.context.createImageData(outW, outH);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (!alphaAt(x, y)) continue;
          for (const [mx, ty] of map(x, y)) {
            const tx = mx + pad;
            if (tx < 0 || tx >= outW || ty < 0 || ty >= outH) continue;
            const i = (y * w + x) * 4;
            const o = (ty * outW + tx) * 4;
            for (let c = 0; c < 4; c++) out.data[o + c] = px[i + c];
          }
        }
      }
      tex.context.putImageData(out, 0, 0);
      tex.refresh();
    };

    pose('player', h, (x, y) => [[x, y]]);

    const crouchLegs = Math.max(1, Math.round(legs * PLAYER_ART.crouchLegScale));
    pose('player_crouch', waist + crouchLegs, (x, y) =>
      y < waist ? [[x, y]] : [[x, waist + Math.floor(((y - waist) * crouchLegs) / legs)]]);

    // Breathing: repeat / drop the row just above the waist so everything above it moves 1px
    pose('player_inhale', h + 1, (x, y) =>
      y < waist - 1 ? [[x, y]] : y === waist - 1 ? [[x, y], [x, y + 1]] : [[x, y + 1]]);
    pose('player_exhale', h - 1, (x, y) =>
      y < waist - 1 ? [[x, y]] : y === waist - 1 ? [] : [[x, y - 1]]);

    // Walk: split the legs at the gap between the feet, then shear each leg (more toward the foot)
    let split = Math.round(w / 2);
    let bestGap = -1;
    for (let x = Math.floor(w * 0.3); x <= Math.ceil(w * 0.7); x++) {
      let gap = 0;
      for (let y = waist + Math.floor(legs / 2); y < h; y++) if (!alphaAt(x, y)) gap++;
      if (gap > bestGap) { bestGap = gap; split = x; }
    }
    const stride = PLAYER_ART.walkStride;
    const frames = [
      { shift: [-stride, stride], lift: null }, // back leg behind, front leg ahead
      { shift: [0, 0], lift: 0 }, //               back leg passing (foot up)
      { shift: [stride, -stride], lift: null }, // legs swapped
      { shift: [0, 0], lift: 1 }, //               front leg passing
    ];
    frames.forEach(({ shift, lift }, i) => {
      pose(`player_walk${i}`, h, (x, y) => {
        if (y < waist) return [[x, y]];
        const leg = x < split ? 0 : 1;
        const t = (y - waist) / (legs - 1); // 0 at the hips, 1 at the feet
        const dy = lift === leg && t > 0.55 ? -1 : 0;
        return [[x + Math.round(shift[leg] * t), y + dy]];
      });
    });
  }

  // Generated shapes so the game runs before any art exists.
  // Each is skipped if a real asset with that key was loaded.
  makePlaceholderTextures() {
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    const make = (key, w, h, draw) => {
      if (this.textures.exists(key)) return;
      g.clear();
      draw(g);
      g.generateTexture(key, w, h);
    };

    // Plain hitbox-sized rectangles (the player boxes are only used if player.png is missing)
    const box = (key, w, h, fill, line) =>
      make(key, w, h, (gr) => {
        gr.fillStyle(fill).fillRect(0, 0, w, h);
        gr.lineStyle(2, line).strokeRect(1, 1, w - 2, h - 2);
      });
    box('player', 18, 38, 0x4fc3f7, 0x0d47a1);
    box('player_crouch', 18, 24, 0x4fc3f7, 0x0d47a1);
    make('arm_extended', 4, 12, (gr) => gr.fillStyle(0x0d47a1).fillRect(0, 0, 4, 12));
    make('arm_bent', 6, 8, (gr) => gr.fillStyle(0x0d47a1).fillRect(0, 0, 4, 8).fillRect(0, 5, 6, 3));
    // Enemy fallbacks (only if the part PNGs are missing): a box torso on the rig canvas, empty limbs
    const hb = ENEMY.rig.hitbox;
    for (const [prefix, fill] of [['enemy_', 0x5c6170], ['enemy_thrower_', 0x685478]]) {
      make(`${prefix}torso`, 64, 64, (gr) => gr.fillStyle(fill).fillRect(hb.x, hb.y, hb.w, hb.h));
      for (const { name } of ENEMY.rig.parts) if (name !== 'torso') make(`${prefix}${name}`, 64, 64, () => {});
    }

    // Weapons: drawn pointing right, pivot at the left (hand) end
    // Pickaxe: a handle and a blocky curved head (tips step back toward the hand)
    // Unlockable skins (see UNLOCKS in config.js) only change the colors: pickaxe(key, head, handle).
    const pickaxe = (key, head, handle) =>
      make(key, 36, 24, (gr) => {
        gr.fillStyle(handle).fillRect(0, 11, 30, 3); // handle
        gr.fillStyle(head)
          .fillRect(30, 7, 5, 10) // center
          .fillRect(28, 3, 4, 4).fillRect(26, 0, 3, 3) // upper arm + tip
          .fillRect(28, 17, 4, 4).fillRect(26, 21, 3, 3); // lower arm + tip
      });
    pickaxe('pickaxe', 0x3d3d44, 0x6b3f1f);
    pickaxe('pickaxe_coral', 0xff7f50, 0x6b3f1f);
    pickaxe('pickaxe_red', 0xc62828, 0x6b3f1f);
    pickaxe('pickaxe_gold', 0xffc83d, 0x6b3f1f);
    pickaxe('pickaxe_blue', 0x42a5f5, 0x6b3f1f);
    pickaxe('pickaxe_bw', 0x111111, 0xf5f5f5); // black head, white handle
    pickaxe('pickaxe_mint', 0x98ffcc, 0x6b3f1f);

    const shotgun = (key, wood, steel) =>
      make(key, 42, 10, (gr) => {
        gr.fillStyle(wood).fillRect(0, 3, 14, 6); // stock
        gr.fillStyle(steel).fillRect(12, 2, 30, 3); // barrel
        gr.fillStyle(0x3d3d44).fillRect(14, 5, 22, 3); // magazine tube
        gr.fillStyle(wood).fillRect(24, 5, 8, 4); // pump
      });
    shotgun('shotgun', 0x6b3f1f, 0x2e2e33);
    shotgun('shotgun_gold', 0xd4a017, 0x2e2e33);
    shotgun('shotgun_pink', 0xff69b4, 0xebe5e0);
    shotgun('shotgun_red', 0x51212b, 0x2e2e33);
    make('pellet', 4, 4, (gr) => gr.fillStyle(0xffe082).fillRect(0, 0, 4, 4));
    make('flash', 16, 16, (gr) => gr.fillStyle(0xfff3b0).fillCircle(8, 8, 8));

    // Terrain tileset: [0] soft, [1] hard (darker), [2] wall. White so the tint is the color; no borders.
    make('tiles', TILE * 3, TILE, (gr) => {
      gr.fillStyle(0xffffff).fillRect(0, 0, TILE, TILE);
      gr.fillStyle(0xb0b0b0).fillRect(TILE, 0, TILE, TILE); // hard rock: same tint, just darker
      gr.fillStyle(0x707070).fillRect(TILE * 2, 0, TILE, TILE);
    });

    // Fossil fallbacks (only used if the fossil PNGs are missing): circles, color + size = tier
    const circle = (key, d, color) => make(key, d, d, (gr) => gr.fillStyle(color).fillCircle(d / 2, d / 2, d / 2));
    circle('fossil_common', 16, 0xffd54f);
    circle('fossil_uncommon', 18, 0xffffff);
    circle('fossil_rare', 22, 0xff5c8a);
    // The mint-orb easter egg: mint green with brown specks
    make('fossil_orb', 16, 16, (gr) => {
      gr.fillStyle(0x98ffcc).fillCircle(8, 8, 8);
      gr.fillStyle(0x6b3f1f).fillRect(4, 5, 2, 2).fillRect(10, 4, 2, 2).fillRect(7, 10, 2, 2).fillRect(11, 10, 1, 1).fillRect(4, 11, 1, 1);
    });
    make('clod', 10, 10, (gr) => gr.fillStyle(0x8d6e63).fillCircle(5, 5, 5));

    // FX / HUD
    make('px', 4, 4, (gr) => gr.fillStyle(0xffffff).fillRect(0, 0, 4, 4));
    make('shell', 8, 16, (gr) => {
      gr.fillStyle(0xff4d6d).fillRect(0, 0, 8, 11);
      gr.fillStyle(0xd4a017).fillRect(0, 11, 8, 5);
    });
    make('heart', 14, 12, (gr) => {
      gr.fillStyle(0xff4d6d).fillCircle(4, 4, 4).fillCircle(10, 4, 4).fillTriangle(0, 5, 14, 5, 7, 12);
    });

    g.destroy();
  }
}
