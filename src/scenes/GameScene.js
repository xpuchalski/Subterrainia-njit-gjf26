import * as Phaser from 'phaser';
import { TILE, FLOOR_COLS, FLOOR_GAP, SHOTGUN, ENEMY, PICKAXE, CAMERA_ZOOM } from '../config.js';
import Floor, { shiftBody } from '../world/Floor.js';
import Player from '../objects/Player.js';
import Weapons from '../objects/Weapons.js';
import Enemy from '../objects/Enemy.js';
import Fx from '../fx.js';
import { playMusic } from '../audio.js';
import { speedMultiplier, depthMultiplier, floorScore, recordScore } from '../scoring.js';
import { UNLOCKS } from '../config.js';
import { loadStats, saveStats, isUnlocked } from '../unlocks.js';

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  create() {
    const worldW = FLOOR_COLS * TILE;
    // Only the side edges of the world are solid; vertically it's open for the endless descent
    this.physics.world.setBounds(0, -1e6, worldW, 2e6);
    this.physics.world.setBoundsCollision(true, true, false, false);

    const cam = this.cameras.main;
    cam.setBounds(0, -1e6, worldW, 2e6);
    cam.setZoom(CAMERA_ZOOM);

    playMusic(this, 'music_game');
    this.fx = new Fx(this);
    this.enemies = this.physics.add.group();
    this.clods = this.physics.add.group();

    // Run state
    this.floorNum = 1;
    this.totalScore = 0;
    this.layerPoints = 0;
    this.floorTime = 0; // runs only while 'playing', i.e. after landing on the layer
    this.state = 'entering'; // 'entering' (falling into a layer) | 'playing' | 'dead'
    this.floors = [];
    this.prevFloor = null;

    const entryX = 5 * TILE;
    this.player = new Player(this, entryX, TILE * 2);
    this.stats = loadStats(); // lifetime kills / shells / deepest layer, for unlocks
    this.weapons = new Weapons(this, this.player);
    this.current = this.createFloor(1, 0, entryX);

    cam.startFollow(this.player, true, 0.12, 0.12);

    // Combat overlaps
    this.physics.add.overlap(this.player, this.enemies, (player, enemy) => {
      player.takeDamage(ENEMY.contactDamage, enemy.x, true);
    });
    this.physics.add.overlap(this.player, this.clods, (player, clod) => {
      if (player.takeDamage(1, clod.x)) clod.destroy();
    });
    this.physics.add.overlap(this.weapons.pellets, this.enemies, (a, b) => {
      const [pellet, enemy] = a instanceof Enemy ? [b, a] : [a, b];
      if (!pellet.active) return;
      enemy.hit(SHOTGUN.pelletDamage, pellet.x - pellet.body.velocity.x);
      pellet.destroy();
    });

    // Scene event listeners survive restarts, so clear ours on shutdown
    this.events.once('player-died', () => this.onPlayerDied());
    this.events.once('shutdown', () => this.events.off('player-died'));

    this.input.keyboard.on('keydown-ESC', () => {
      this.scene.stop('UI');
      this.scene.start('Menu');
    });

    this.syncRegistry();
    this.scene.launch('UI');
  }

  createFloor(num, y, entryX) {
    const floor = new Floor(this, num, y, entryX);
    floor.colliders.push(
      this.physics.add.collider(this.player, floor.layer),
      this.physics.add.collider(this.enemies, floor.layer),
      this.physics.add.collider(this.clods, floor.layer, (clod) => clod.destroy())
    );
    this.floors.push(floor);
    return floor;
  }

  // ------------------------------------------------------------ terrain helpers

  floorAt(worldY) {
    return this.floors.find((f) => f.containsY(worldY)) ?? null;
  }

  // The solid tile at a world point as { floor, tx, ty }, or null if it's open.
  // Anything past the side edges counts as solid.
  solidTileAt(wx, wy) {
    if (wx < 0 || wx >= FLOOR_COLS * TILE) return { floor: null };
    const floor = this.floorAt(wy);
    if (!floor) return null;
    const { tx, ty } = floor.worldToTile(wx, wy);
    return floor.isSolidTile(tx, ty) ? { floor, tx, ty } : null;
  }

  isSolidAt(wx, wy) {
    return !!this.solidTileAt(wx, wy);
  }

  // Pickaxe vs terrain. Aiming roughly straight down/up/sideways hits every tile the
  // player's body spans on that side (so you can dig a hole you actually fit through),
  // reaching one tile further if the adjacent row is open. Diagonal aims hit the first
  // solid tile along the aim ray.
  pickaxeTerrain(angle) {
    const b = this.player.body;
    const deg = Phaser.Math.RadToDeg(angle);
    const hitFirstSolid = (points) => {
      const hit = new Set();
      for (const [wx, wy] of points) {
        const t = this.solidTileAt(wx, wy);
        if (!t?.floor) continue;
        const k = `${t.floor.floorNum}:${t.tx},${t.ty}`;
        if (hit.has(k)) continue;
        hit.add(k);
        t.floor.damageTile(t.tx, t.ty, PICKAXE.tileDamage);
      }
      return hit.size > 0;
    };

    // Sample points at distance d past the body edge on the aimed side
    let pointsAt = null;
    if (deg > 60 && deg < 120) pointsAt = (d) => [[b.left + 1, b.bottom + d], [b.right - 1, b.bottom + d]];
    else if (deg < -60 && deg > -120) pointsAt = (d) => [[b.left + 1, b.top - d], [b.right - 1, b.top - d]];
    else if (Math.abs(deg) < 30) pointsAt = (d) => [[b.right + d, b.top + 2], [b.right + d, b.bottom - 2]];
    else if (Math.abs(deg) > 150) pointsAt = (d) => [[b.left - d, b.top + 2], [b.left - d, b.bottom - 2]];
    if (pointsAt) {
      for (let extra = 0; extra <= PICKAXE.extraTiles; extra++) {
        if (hitFirstSolid(pointsAt(4 + extra * TILE))) return;
      }
    }

    // Ray from the body center; stop at the first solid tile
    for (let d = 6; d <= PICKAXE.reach; d += 6) {
      if (hitFirstSolid([[b.center.x + Math.cos(angle) * d, b.center.y + Math.sin(angle) * d]])) return;
    }
  }

  // ------------------------------------------------------------ main loop

  update(time, delta) {
    if (this.state === 'dead') return;

    this.player.update(time, delta);
    this.weapons.update(time);
    for (const e of [...this.enemies.getChildren()]) e.update(time, this.player);
    for (const c of [...this.clods.getChildren()]) if (time >= c.dieAt) c.destroy();

    if (this.state === 'playing' && this.player.alive) this.floorTime += delta / 1000;
    this.updateFloorFlow();
    this.syncRegistry();
  }

  // Change lifetime stats, save them, and announce any unlocks that just crossed their threshold
  updateStats(change) {
    const before = { ...this.stats };
    change(this.stats);
    saveStats(this.stats);
    const fresh = UNLOCKS.filter((u) => !isUnlocked(u, before) && isUnlocked(u, this.stats));
    if (!fresh.length) return;
    this.weapons.refreshSkins(this.stats);
    for (const u of fresh) this.events.emit('unlock', u.label);
  }

  // Fossils and kills both feed the layer's points (multiplied by speed/depth when it's cleared)
  addPoints(points, x, y, color) {
    this.layerPoints += points;
    this.fx.floatText(x, y, `+${points}`, color);
  }

  updateFloorFlow() {
    const p = this.player;
    const cam = this.cameras.main;

    if (this.state === 'playing' && p.alive && p.body.top > this.current.bottom) {
      this.beginDescent();
    }

    // Drop the old floor once it's fully off-screen
    if (this.prevFloor && this.prevFloor.bottom < cam.worldView.top - 16) {
      this.prevFloor.destroy();
      this.floors = this.floors.filter((f) => f !== this.prevFloor);
      this.prevFloor = null;
    }

    // Landed on the new layer: its timer starts now
    if (this.state === 'entering' && p.body.blocked.down && p.y > this.current.y) {
      this.state = 'playing';
      this.updateStats((s) => (s.deepest = Math.max(s.deepest, this.floorNum)));
    }

    // Once only one floor exists, move it (and everything on it) back to y = 0
    if (this.state === 'playing' && !this.prevFloor && this.current.y !== 0) {
      this.shiftWorld(this.current.y);
    }
  }

  beginDescent() {
    const seconds = this.floorTime;
    const results = {
      floor: this.floorNum,
      points: this.layerPoints,
      seconds,
      speedMult: speedMultiplier(seconds),
      depthMult: depthMultiplier(this.floorNum),
      floorScore: floorScore(this.layerPoints, seconds, this.floorNum),
    };
    this.totalScore += results.floorScore;
    results.total = this.totalScore;
    this.events.emit('floor-results', results);

    this.prevFloor = this.current;
    this.floorNum++;
    this.layerPoints = 0;
    this.floorTime = 0;
    this.current = this.createFloor(this.floorNum, this.prevFloor.bottom + FLOOR_GAP, this.player.x);
    this.state = 'entering';

    // Freeze the game on the results screen until the player clicks it away (UIScene resumes us)
    this.scene.pause();
  }

  // Called by UIScene when a pausing overlay (results screen, story box) is dismissed
  resumeFromOverlay() {
    this.weapons.waitForRelease = true;
    this.scene.resume();
  }

  shiftWorld(dy) {
    this.current.shift(dy);
    shiftBody(this.player, dy);
    this.weapons.pellets.clear(true, true);
    this.clods.clear(true, true);
    this.cameras.main.scrollY -= dy;
  }

  // ------------------------------------------------------------ death / HUD

  onPlayerDied() {
    this.weapons.cancelReload();
    this.time.delayedCall(900, () => {
      this.state = 'dead';
      this.physics.pause();
      const rank = recordScore(this.totalScore, this.floorNum);
      this.scene.launch('GameOver', { score: this.totalScore, floor: this.floorNum, rank });
      this.scene.pause();
    });
  }

  syncRegistry() {
    const r = this.registry;
    r.set('hp', this.player.hp);
    r.set('score', this.totalScore);
    r.set('floor', this.floorNum);
    r.set('floorTime', this.floorTime);
    r.set('weapon', this.weapons.current);
    r.set('shells', this.weapons.shells);
    r.set('reloading', this.weapons.reloading);
  }
}
