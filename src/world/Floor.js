import * as Phaser from 'phaser';
import {
  TILE, FLOOR_COLS, FLOOR_ROWS, ENTRY_ROWS, SURFACE_MIN_ROW, SURFACE_MAX_ROW,
  PITS_PER_FLOOR, PLATFORMS_PER_FLOOR, POCKETS_PER_FLOOR, TILE_HP, EARLY_CAVES,
  STONE_CHANCE_BASE, STONE_CHANCE_PER_FLOOR, STONE_CHANCE_MAX,
  FOSSIL_TIERS, FOSSIL_WEIGHTS_BASE, FOSSIL_WEIGHTS_PER_FLOOR, FOSSIL_WEIGHT_MIN_COMMON,
  SURFACE_FOSSILS, BURIED_FOSSILS, BURIED_FOSSIL_ALPHA, FOSSIL_ART_SCALE, ENEMY,
  TERRAIN_COLOR, SKELETON_ATTEMPTS, SKELETON_CHANCE, SKELETON_LENGTH, SKELETON_UNCOMMON_BONES,
} from '../config.js';
import Enemy from '../objects/Enemy.js';
import { sfx } from '../audio.js';

// Tile indices in the generated 'tiles' texture
const AIR = -1;
const DIRT = 0;
const STONE = 1;
const WALL = 2;

const WALL_TINT = 0x9a9a9a;

const key = (tx, ty) => `${tx},${ty}`;

// One procedurally generated layer: a destructible tile layer plus its fossils and
// enemies. Lives at world y = this.y; two can coexist during the fall between layers.
export default class Floor {
  constructor(scene, floorNum, y, entryX) {
    this.scene = scene;
    this.floorNum = floorNum;
    this.y = y;
    this.rng = new Phaser.Math.RandomDataGenerator([`${Date.now()}-${floorNum}-${Math.random()}`]);
    this.entryCol = Phaser.Math.Clamp(Math.floor(entryX / TILE), 1, FLOOR_COLS - 2);

    this.fossils = [];
    this.buriedAt = new Map(); // "tx,ty" of solid tile -> fossil
    this.restingOn = new Map(); // "tx,ty" of support tile -> surface fossil sitting on it
    this.enemies = [];
    this.colliders = [];

    const grid = this.generateGrid();
    this.buildLayer(grid);
    this.placeFossils(grid);
    if (floorNum >= ENEMY.firstFloor) this.placeEnemies(grid);
    if (floorNum === 1) this.placeSign();
  }

  get bottom() {
    return this.y + FLOOR_ROWS * TILE;
  }

  // ---------------------------------------------------------------- generation

  generateGrid() {
    const rng = this.rng;
    const grid = Array.from({ length: FLOOR_ROWS }, () => new Array(FLOOR_COLS).fill(AIR));

    // Surface heightmap: gentle random walk
    const surface = [];
    let h = rng.between(SURFACE_MIN_ROW, SURFACE_MAX_ROW);
    for (let c = 0; c < FLOOR_COLS; c++) {
      if (rng.frac() < 0.35) h = Phaser.Math.Clamp(h + rng.pick([-1, 1]), SURFACE_MIN_ROW, SURFACE_MAX_ROW);
      surface[c] = h;
    }

    // Early layers are more open: 1 on layer 1, fading to 0 by EARLY_CAVES.fadeLayers
    const early = Math.max(0, 1 - (this.floorNum - 1) / EARLY_CAVES.fadeLayers);

    const pits = rng.between(...PITS_PER_FLOOR) + Math.round(EARLY_CAVES.extraPits * early);
    for (let p = 0; p < pits; p++) {
      const c0 = rng.between(4, FLOOR_COLS - 8);
      const w = rng.between(2, 4 + Math.round(EARLY_CAVES.extraPitWidth * early));
      const depth = rng.between(2, 3);
      for (let c = c0; c < c0 + w; c++) surface[c] = Math.min(surface[c] + depth, FLOOR_ROWS - 6);
    }

    // Solid ground mass down to the (diggable) bottom
    for (let c = 0; c < FLOOR_COLS; c++) {
      for (let r = surface[c]; r < FLOOR_ROWS; r++) grid[r][c] = DIRT;
    }

    // Hard-rock blobs, more common deeper
    const floorIndex = this.floorNum - 1;
    const stoneChance = Math.min(STONE_CHANCE_MAX, STONE_CHANCE_BASE + STONE_CHANCE_PER_FLOOR * floorIndex);
    const blobs = Math.round(stoneChance * 45 * ((FLOOR_COLS * FLOOR_ROWS) / (40 * 24)));
    for (let b = 0; b < blobs; b++) {
      const c = rng.between(1, FLOOR_COLS - 2);
      const r = rng.between(surface[c] + 1, FLOOR_ROWS - 1);
      const rad = rng.between(1, 2);
      for (let dr = -rad; dr <= rad; dr++) {
        for (let dc = -rad; dc <= rad; dc++) {
          const rr = r + dr;
          const cc = c + dc;
          if (rr < 0 || rr >= FLOOR_ROWS || cc < 1 || cc >= FLOOR_COLS - 1) continue;
          if (grid[rr][cc] === DIRT && rr > surface[cc] && rng.frac() < 0.7) grid[rr][cc] = STONE;
        }
      }
    }

    // Air pockets inside the ground (never touching the bottom rows); early layers add big caves
    const bigCaves = Math.round(EARLY_CAVES.bigCaves * early);
    const pockets = rng.between(...POCKETS_PER_FLOOR) + bigCaves;
    for (let k = 0; k < pockets; k++) {
      const big = k < bigCaves;
      const pw = big ? rng.between(...EARLY_CAVES.width) : rng.between(3, 8);
      const ph = big ? rng.between(...EARLY_CAVES.height) : rng.between(2, 4);
      const pc = rng.between(2, FLOOR_COLS - 3 - pw);
      let top = 0;
      for (let c = pc; c < pc + pw; c++) top = Math.max(top, surface[c]);
      const minRow = top + 2;
      const maxRow = FLOOR_ROWS - 4 - ph;
      if (minRow > maxRow) continue;
      const pr = rng.between(minRow, maxRow);
      for (let r = pr; r < pr + ph; r++) for (let c = pc; c < pc + pw; c++) grid[r][c] = AIR;
    }

    // Floating platforms in the air above the ground
    const platforms = rng.between(...PLATFORMS_PER_FLOOR);
    for (let k = 0; k < platforms; k++) {
      const len = rng.between(3, 6);
      const c0 = rng.between(2, FLOOR_COLS - 2 - len);
      let groundTop = FLOOR_ROWS;
      for (let c = c0; c < c0 + len; c++) groundTop = Math.min(groundTop, surface[c]);
      const minRow = ENTRY_ROWS + 1;
      const maxRow = groundTop - 3;
      if (minRow > maxRow) continue;
      const r = rng.between(minRow, maxRow);
      let clear = true;
      for (let rr = r - 2; rr <= r + 2 && clear; rr++) {
        for (let c = c0 - 1; c <= c0 + len && clear; c++) if (grid[rr]?.[c] !== AIR) clear = false;
      }
      if (!clear) continue;
      for (let c = c0; c < c0 + len; c++) grid[r][c] = DIRT;
    }

    // Unbreakable side walls
    for (let r = 0; r < FLOOR_ROWS; r++) {
      grid[r][0] = WALL;
      grid[r][FLOOR_COLS - 1] = WALL;
    }

    this.surface = surface;
    return grid;
  }

  buildLayer(grid) {
    const map = this.scene.make.tilemap({ tileWidth: TILE, tileHeight: TILE, width: FLOOR_COLS, height: FLOOR_ROWS });
    const tileset = map.addTilesetImage('tiles', 'tiles', TILE, TILE, 0, 0, 0);
    const layer = map.createBlankLayer(`floor-${this.floorNum}`, tileset, 0, this.y);
    layer.setDepth(0);

    this.hp = new Array(FLOOR_COLS * FLOOR_ROWS).fill(0);
    this.maxHp = new Array(FLOOR_COLS * FLOOR_ROWS).fill(0);
    for (let r = 0; r < FLOOR_ROWS; r++) {
      for (let c = 0; c < FLOOR_COLS; c++) {
        const t = grid[r][c];
        if (t === AIR) continue;
        const tile = layer.putTileAt(t, c, r);
        tile.tint = t === WALL ? WALL_TINT : TERRAIN_COLOR;
        if (t !== WALL) this.setTileHp(c, r, t === STONE ? TILE_HP.stone : TILE_HP.dirt);
      }
    }
    layer.setCollision([DIRT, STONE, WALL]);

    this.map = map;
    this.layer = layer;
  }

  setTileHp(tx, ty, hp) {
    const i = ty * FLOOR_COLS + tx;
    this.hp[i] = hp;
    this.maxHp[i] = hp;
  }

  pickTier() {
    const i = this.floorNum - 1;
    const w = {};
    for (const t of Object.keys(FOSSIL_WEIGHTS_BASE)) w[t] = FOSSIL_WEIGHTS_BASE[t] + FOSSIL_WEIGHTS_PER_FLOOR[t] * i;
    w.common = Math.max(FOSSIL_WEIGHT_MIN_COMMON, w.common);
    const total = w.common + w.uncommon + w.rare;
    let roll = this.rng.frac() * total;
    for (const t of ['rare', 'uncommon', 'common']) {
      if ((roll -= w[t]) < 0) return t;
    }
    return 'common';
  }

  placeFossils(grid) {
    const rng = this.rng;
    const isSolid = (c, r) => grid[r]?.[c] === DIRT || grid[r]?.[c] === STONE;

    // Surface fossils: air tile with solid ground directly below
    const surfaceSpots = [];
    for (let r = ENTRY_ROWS; r < FLOOR_ROWS - 1; r++) {
      for (let c = 1; c < FLOOR_COLS - 1; c++) {
        if (grid[r][c] === AIR && isSolid(c, r + 1)) surfaceSpots.push([c, r]);
      }
    }
    rng.shuffle(surfaceSpots);
    const nSurface = rng.between(...SURFACE_FOSSILS);
    const used = new Set();
    for (const [c, r] of surfaceSpots) {
      if (this.fossils.length >= nSurface) break;
      if (used.has(c) || used.has(c - 1) || used.has(c + 1)) continue; // spread them out
      used.add(c);
      this.addFossil(c, r, false);
    }

    this.placeSkeletons(isSolid);

    // Buried fossils: occupy a solid tile below the surface
    const buriedSpots = [];
    for (let c = 1; c < FLOOR_COLS - 1; c++) {
      for (let r = this.surface[c] + 1; r < FLOOR_ROWS - 1; r++) {
        if (isSolid(c, r) && !this.restingOn.has(key(c, r)) && !this.buriedAt.has(key(c, r))) buriedSpots.push([c, r]);
      }
    }
    rng.shuffle(buriedSpots);
    const nBuried = rng.between(...BURIED_FOSSILS);
    for (let i = 0; i < nBuried && i < buriedSpots.length; i++) {
      const [c, r] = buriedSpots[i];
      this.addFossil(c, r, true);
    }

    for (const f of this.fossils) this.refreshExposure(f);
  }

  // Buried skeletons: a rare skull at the head, then a wiggly trail of lesser bones behind it
  placeSkeletons(isSolid) {
    const rng = this.rng;
    for (let n = 0; n < SKELETON_ATTEMPTS; n++) {
      if (rng.frac() >= SKELETON_CHANCE) continue;
      const len = rng.between(...SKELETON_LENGTH);
      for (let tries = 0; tries < 30; tries++) {
        const dir = rng.pick([-1, 1]);
        let c = rng.between(2, FLOOR_COLS - 3);
        let r = rng.between(this.surface[c] + 2, FLOOR_ROWS - 3);
        const cells = [[c, r]];
        for (let i = 0; i < len; i++) {
          c += dir;
          if (rng.frac() < 0.3) r += rng.pick([-1, 1]);
          cells.push([c, r]);
        }
        const ok = cells.every(
          ([cc, rr]) => cc >= 1 && cc < FLOOR_COLS - 1 && rr > this.surface[cc] && rr < FLOOR_ROWS - 1 &&
            isSolid(cc, rr) && !this.buriedAt.has(key(cc, rr))
        );
        if (!ok) continue;
        cells.forEach(([cc, rr], i) => {
          const tier = i === 0 ? 'rare' : i <= SKELETON_UNCOMMON_BONES ? 'uncommon' : 'common';
          // The skull art faces left, so flip it when the spine trails off to the left
          this.addFossil(cc, rr, true, tier, i === 0 ? dir < 0 : undefined);
        });
        break;
      }
    }
  }

  addFossil(tx, ty, buried, tier = this.pickTier(), flip = this.rng.frac() < 0.5) {
    const { hits, points } = FOSSIL_TIERS[tier];
    // Buried: centered in its tile. Surface: resting on the ground below. Flipped randomly unless told.
    const sprite = this.scene.add.image(0, 0, `fossil_${tier}`).setDepth(2).setFlipX(flip);
    const art = this.scene.textures.get(`fossil_${tier}`).getSourceImage();
    if (art.width > 24) sprite.setScale(FOSSIL_ART_SCALE); // real art, not the small placeholder circles
    const bottom = this.y + (ty + 1) * TILE;
    sprite.setPosition(tx * TILE + TILE / 2, buried ? bottom - TILE / 2 : bottom - sprite.displayHeight / 2);
    const f = { tx, ty, tier, buried, sprite, alive: true, hp: hits, points };
    this.fossils.push(f);
    if (buried) {
      // The fossil adds its hits on top of the tile it's embedded in
      this.setTileHp(tx, ty, this.hp[ty * FLOOR_COLS + tx] + hits);
      this.buriedAt.set(key(tx, ty), f);
    } else {
      this.restingOn.set(key(tx, ty + 1), f);
    }
  }

  // Buried fossils show faintly until dug next to
  refreshExposure(f) {
    if (!f.buried || !f.alive) return;
    const open = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !this.isSolidTile(f.tx + dx, f.ty + dy));
    f.sprite.setAlpha(open ? 1 : BURIED_FOSSIL_ALPHA);
  }

  placeEnemies(grid) {
    const rng = this.rng;
    const floorIndex = this.floorNum - ENEMY.firstFloor;
    const count = Math.min(ENEMY.countMax, ENEMY.countBase + Math.floor(floorIndex / 2) * ENEMY.countPerTwoFloors);

    // Enemies are bigger than a tile, so they need an open 3x3 spot on solid ground
    const open = (c, r) => grid[r]?.[c] === AIR;
    const spots = [];
    for (let c = 2; c < FLOOR_COLS - 2; c++) {
      if (Math.abs(c - this.entryCol) < ENEMY.spawnSafeCols) continue;
      for (let r = ENTRY_ROWS + 1; r < FLOOR_ROWS - 1; r++) {
        // 3 tiles wide and 3 tall (they're ~1.5 x 2.1 tiles)
        let fits = true;
        for (let dr = 0; dr < 3 && fits; dr++) for (let dc = -1; dc <= 1 && fits; dc++) fits = open(c + dc, r - dr);
        if (fits && grid[r + 1][c] !== AIR) spots.push([c, r]);
      }
    }
    rng.shuffle(spots);

    const usedCols = [];
    for (const [c, r] of spots) {
      if (this.enemies.length >= count) break;
      if (usedCols.some((u) => Math.abs(u - c) < 4)) continue;
      usedCols.push(c);
      const kind = this.floorNum >= ENEMY.spitterFromFloor && rng.frac() < ENEMY.spitterChance ? 'spitter' : 'melee';
      const enemy = new Enemy(this.scene, c * TILE + TILE / 2, this.y + (r + 1) * TILE - ENEMY.height / 2, kind, this);
      this.enemies.push(enemy);
      this.scene.enemies.add(enemy);
    }
  }

  // The warning sign near where the player drops in on layer 1. It rests on a surface tile
  // and crumbles if that tile is dug out.
  placeSign() {
    const scene = this.scene;
    const c = Phaser.Math.Clamp(this.entryCol + 3, 2, FLOOR_COLS - 6);
    const r = this.surface[c];
    const x = c * TILE + TILE / 2;
    const ground = this.y + r * TILE;
    const text = scene.add.text(0, -52, "DON'T DIG\nSTRAIGHT DOWN", {
      fontFamily: 'monospace', fontSize: '12px', fontStyle: 'bold', color: '#c62828', align: 'center',
    }).setOrigin(0.5);
    const board = scene.add.rectangle(0, -52, text.width + 14, text.height + 10, 0xefe6cf).setStrokeStyle(2, 0x6b3f1f);
    const post = scene.add.rectangle(0, -16, 4, 32, 0x6b3f1f);
    this.sign = { obj: scene.add.container(x, ground, [post, board, text]).setDepth(1), key: key(c, r) };
  }

  // ---------------------------------------------------------------- terrain queries / damage

  isSolidTile(tx, ty) {
    if (tx < 0 || tx >= FLOOR_COLS || ty < 0 || ty >= FLOOR_ROWS) return tx < 0 || tx >= FLOOR_COLS;
    const t = this.layer.getTileAt(tx, ty);
    return !!t && t.index !== AIR;
  }

  containsY(worldY) {
    return worldY >= this.y && worldY < this.bottom;
  }

  worldToTile(wx, wy) {
    return { tx: Math.floor(wx / TILE), ty: Math.floor((wy - this.y) / TILE) };
  }

  damageTile(tx, ty, dmg) {
    const tile = this.layer.getTileAt(tx, ty);
    if (!tile) return;
    const x = tx * TILE + TILE / 2;
    const y = this.y + ty * TILE + TILE / 2;
    if (tile.index === WALL) {
      sfx(this.scene, 'pickaxeHit');
      this.scene.fx.sparks(x, y);
      return;
    }
    const i = ty * FLOOR_COLS + tx;
    this.hp[i] -= dmg;
    this.scene.fx.dust(x, y, TERRAIN_COLOR);
    if (this.hp[i] <= 0) {
      sfx(this.scene, 'blockBreak');
      this.breakTile(tx, ty);
      return;
    }
    tile.alpha = 0.45 + 0.55 * (this.hp[i] / this.maxHp[i]);
    const buried = this.buriedAt.get(key(tx, ty));
    if (buried) this.bump(buried);
    sfx(this.scene, 'pickaxeHit');
  }

  breakTile(tx, ty) {
    this.layer.removeTileAt(tx, ty);
    this.hp[ty * FLOOR_COLS + tx] = 0;

    // A fossil inside this tile, or sitting on top of it, pops out for points
    const k = key(tx, ty);
    const buried = this.buriedAt.get(k);
    if (buried) this.collect(buried);
    if (this.sign?.key === k && this.sign.obj.active) {
      this.scene.fx.dust(this.sign.obj.x, this.sign.obj.y - 30, 0xefe6cf, 14);
      this.sign.obj.destroy();
    }
    const resting = this.restingOn.get(k);
    if (resting) {
      this.collect(resting);
      this.restingOn.delete(k);
    }

    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const f = this.buriedAt.get(key(tx + dx, ty + dy));
      if (f) this.refreshExposure(f);
    }
  }

  // Pickaxe slash hitting a fossil sitting on the ground
  hitSurfaceFossil(f, dmg) {
    if (!f.alive) return;
    f.hp -= dmg;
    this.scene.fx.dust(f.sprite.x, f.sprite.y, 0xeeeeee, 4);
    if (f.hp <= 0) this.collect(f);
    else this.bump(f);
  }

  // Hit feedback on a fossil that isn't free yet
  bump(f) {
    this.scene.tweens.add({ targets: f.sprite, scale: f.sprite.scale * 1.3, duration: 60, yoyo: true });
  }

  collect(f) {
    if (!f.alive) return;
    f.alive = false;
    if (f.buried) this.buriedAt.delete(key(f.tx, f.ty));
    this.scene.fx.sparkle(f.sprite.x, f.sprite.y);
    this.scene.addPoints(f.points, f.sprite.x, f.sprite.y - 16, '#fff176');
    if (f.tier === 'common') this.scene.updateStats((s) => s.shells++); // common fossils are the shells
    this.scene.tweens.add({
      targets: f.sprite, y: f.sprite.y - 30, alpha: 0, scale: f.sprite.scale * 1.6, duration: 300, onComplete: () => f.sprite.destroy(),
    });
  }

  // ---------------------------------------------------------------- lifecycle

  // Move everything on this floor up by dy (keeps world coordinates small)
  shift(dy) {
    this.y -= dy;
    this.layer.y -= dy;
    for (const f of this.fossils) if (f.sprite.active) f.sprite.y -= dy;
    if (this.sign?.obj.active) this.sign.obj.y -= dy;
    for (const e of this.enemies) if (e.active) shiftBody(e, dy);
  }

  destroy() {
    for (const c of this.colliders) c.destroy();
    for (const e of this.enemies) if (e.active) e.destroy();
    for (const f of this.fossils) if (f.sprite.active) f.sprite.destroy();
    if (this.sign?.obj.active) this.sign.obj.destroy();
    this.layer.destroy();
    this.map.destroy();
    this.fossils = [];
    this.enemies = [];
  }
}

// Shift an arcade-physics sprite vertically without losing its velocity
export function shiftBody(obj, dy) {
  const vx = obj.body.velocity.x;
  const vy = obj.body.velocity.y;
  obj.body.reset(obj.x, obj.y - dy);
  obj.body.setVelocity(vx, vy);
}
