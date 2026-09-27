import * as Phaser from 'phaser';
import { ENEMY } from '../config.js';
import { sfx } from '../audio.js';

const RIG = ENEMY.rig;
const BOSS = ENEMY.boss;
const CANVAS = 64; // every part texture is this square canvas, parts drawn in place

// Subterranean. kind: 'melee' (chaser) or 'spitter' (the "thrower": keeps distance, lobs dirt clods).
// Wider than one tile so it can't fall down 1-wide shafts.
//
// The physics sprite itself is invisible; what you see is a set of body-part images (see ENEMY.rig)
// posed around it every frame, so limbs can swing independently.
//
// boss = true: ENEMY.boss.scale x bigger with way more HP, and a telegraphed attack (flash, then
// a charge for melee, or rip up a block and throw a terrain-breaking boulder for throwers).
export default class Enemy extends Phaser.Physics.Arcade.Sprite {
  // feetY = world y of the ground the enemy stands on
  constructor(scene, x, feetY, kind, floor, boss = false) {
    const k = ENEMY.artScale * (boss ? BOSS.scale : 1);
    super(scene, x, feetY - (RIG.feetY - CANVAS / 2) * k, 'enemy_torso');
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.k = k;
    this.kind = kind;
    this.floor = floor;
    this.boss = boss;
    this.contactDamage = boss ? BOSS.contactDamage : ENEMY.contactDamage;
    const floorNum = floor.floorNum;
    this.maxHp = ENEMY.baseHp * (1 + ENEMY.hpScalePerFloor * (floorNum - 1)) * (boss ? BOSS.hpMult : 1);
    this.hp = this.maxHp;
    this.attack = null; // boss: null | 'windup' | 'charge'
    this.attackAt = 0;
    this.nextAttackAt = 0;
    this.speedScale = Math.min(1.4, 1 + 0.03 * (floorNum - 1));
    this.dir = Math.random() < 0.5 ? -1 : 1;
    this.state = 'patrol';
    this.stunUntil = 0;
    this.nextShotAt = 0;
    this.turnedAt = -Infinity;

    this.setScale(k).setVisible(false);
    const hb = RIG.hitbox;
    this.body.setSize(hb.w, hb.h, false);
    this.body.setOffset(hb.x, hb.y);

    // Body parts, back to front
    const prefix = kind === 'spitter' ? 'enemy_thrower_' : 'enemy_';
    this.parts = RIG.parts.map(({ name, joint }, i) => ({
      name,
      joint,
      img: scene.add.image(x, this.y, `${prefix}${name}`).setScale(k).setDepth(3 + i * 0.01),
    }));
    this.walkPhase = Math.random(); // so a group doesn't march in lockstep
    this.throwUntil = 0;
    this.hpBar = boss ? scene.add.graphics().setDepth(20) : null;

    // Pose after physics has moved the body this frame
    this.syncParts = () => this.poseParts(scene.time.now);
    scene.events.on('postupdate', this.syncParts);
  }

  preDestroy() {
    this.scene?.events.off('postupdate', this.syncParts);
    for (const p of this.parts) p.img.destroy();
    this.hpBar?.destroy();
    super.preDestroy?.();
  }

  // Place each part at its joint and swing it: walk cycle while moving, a slow breath when still
  poseParts(time) {
    if (!this.active) return;
    const k = this.k;
    const flip = this.dir < 0;
    const s = flip ? -1 : 1;
    const vx = Math.abs(this.body.velocity.x);
    const moving = this.body.blocked.down && vx > 5;

    if (moving) this.walkPhase += (vx * RIG.walkCyclesPerPx * this.scene.game.loop.delta) / 1000;
    const cycle = Math.sin(this.walkPhase * Math.PI * 2);
    const leg = moving ? cycle * RIG.legSwingDeg : 0;
    const arm = moving ? -cycle * RIG.armSwingDeg : 0;
    const bob = moving
      ? Math.round(Math.abs(cycle)) * -1 // up 1px mid-stride
      : Math.round((Math.sin((time / RIG.breathMs) * Math.PI * 2) + 1) / 2); // breathing: down 0-1px
    const throwing = time < this.throwUntil;

    const angles = {
      R_leg: leg,
      L_leg: -leg,
      R_arm: arm,
      L_arm: throwing ? -70 : -arm, // front arm swings up to throw
      torso: 0,
    };

    for (const { name, joint, img } of this.parts) {
      const [jx, jy] = joint;
      const lift = name === 'torso' || name.endsWith('arm') ? bob : 0; // legs stay planted
      // flipX mirrors the texture inside its frame, so mirror the pivot and the offset too
      img
        .setFlipX(flip)
        .setOrigin((flip ? CANVAS - jx : jx) / CANVAS, jy / CANVAS)
        .setPosition(this.x + (jx - CANVAS / 2) * k * s, this.y + (jy - CANVAS / 2 + lift) * k)
        .setAngle(angles[name] * s);
    }

    if (this.boss) {
      // Telegraph: blink white while winding up an attack
      if (this.attack === 'windup') this.setFlash(Math.floor(time / 90) % 2 === 0);
      const w = this.body.width;
      const b = this.hpBar.clear();
      b.fillStyle(0x000000, 0.7).fillRect(this.body.left, this.body.top - 16, w, 7);
      b.fillStyle(0xe53935).fillRect(this.body.left + 1, this.body.top - 15, (w - 2) * Math.max(0, this.hp / this.maxHp), 5);
    }
  }

  setFlash(on) {
    for (const { img } of this.parts) {
      if (on) img.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
      else img.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
    }
  }

  update(time, player) {
    if (!this.active) return;
    const body = this.body;
    const onGround = body.blocked.down;

    // Fell out of its floor (e.g. through a hole the player dug) — gone
    if (this.y > this.floor.bottom + 200) {
      this.destroy();
      return;
    }
    if (time < this.stunUntil) return;

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy);
    if (this.boss && this.bossAttack(time, player, dx, dy)) return;

    if (this.state === 'patrol' && player.alive && dist < ENEMY.noticeRange && Math.abs(dy) < 140) {
      this.state = 'chase';
    } else if (this.state === 'chase' && (!player.alive || dist > ENEMY.loseRange)) {
      this.state = 'patrol';
    }

    let speed = 0;
    if (this.state === 'patrol') {
      // Turn at walls and ledges. If there's a ledge both ways, stand still instead of flipping
      // back and forth every frame; and don't turn again right after turning.
      const ledge = (d) => onGround && !this.scene.isSolidAt(this.x + d * (body.width / 2 + 2), this.body.bottom + 4);
      const canTurn = time - this.turnedAt > 300;
      speed = ENEMY.patrolSpeed;
      if (body.blocked.left || body.blocked.right || ledge(this.dir)) {
        const back = -this.dir;
        const backBlocked = (back < 0 ? body.blocked.left : body.blocked.right) || ledge(back);
        if (backBlocked) speed = 0;
        else if (canTurn) {
          this.dir = back;
          this.turnedAt = time;
        } else speed = 0;
      }
    } else if (this.kind === 'spitter') {
      // Hold a middle distance and lob clods
      const toward = Math.sign(dx) || 1;
      if (dist < 140) { this.dir = -toward; speed = ENEMY.patrolSpeed; }
      else if (dist > ENEMY.spitterRange * 0.8) { this.dir = toward; speed = ENEMY.patrolSpeed; }
      else { this.dir = toward; speed = 0; }
      if (!this.boss && time >= this.nextShotAt && dist < ENEMY.spitterRange) {
        this.nextShotAt = time + ENEMY.spitterCooldownMs;
        this.throwClod(player);
      }
    } else {
      if (Math.abs(dx) > 4) this.dir = Math.sign(dx);
      speed = ENEMY.chaseSpeed;
    }

    this.setVelocityX(this.dir * speed * this.speedScale);

    // Hop over walls while chasing
    const blockedAhead = (this.dir < 0 && body.blocked.left) || (this.dir > 0 && body.blocked.right);
    if (this.state === 'chase' && onGround && blockedAhead) this.setVelocityY(ENEMY.jumpVelocity);
  }

  // Boss attack loop. Returns true while it's busy (so normal movement is skipped).
  bossAttack(time, player, dx, dy) {
    if (this.attack === 'windup') {
      this.setVelocityX(0);
      if (time < this.attackAt) return true;
      this.setFlash(false);
      if (this.kind === 'spitter') {
        this.throwBoulder(player);
        this.endAttack(time);
        return true;
      }
      this.attack = 'charge';
      this.attackAt = time + BOSS.chargeMs;
    }
    if (this.attack === 'charge') {
      const b = this.body;
      const hitWall = (this.dir < 0 && b.blocked.left) || (this.dir > 0 && b.blocked.right);
      if (time >= this.attackAt || hitWall) {
        if (hitWall) this.scene.cameras.main.shake(150, 0.01);
        this.endAttack(time);
        return false;
      }
      this.setVelocityX(this.dir * BOSS.chargeSpeed);
      return true;
    }
    // Start one when the player is close and roughly level
    if (player.alive && this.state === 'chase' && time >= this.nextAttackAt &&
        Math.abs(dx) < BOSS.attackRange && Math.abs(dy) < this.body.height) {
      this.dir = Math.sign(dx) || this.dir;
      this.attack = 'windup';
      this.attackAt = time + BOSS.telegraphMs;
      return true;
    }
    return false;
  }

  endAttack(time) {
    this.attack = null;
    this.nextAttackAt = time + BOSS.cooldownMs;
  }

  // Thrower boss: tear a block out of the ground in front, then hurl it as a big boulder
  throwBoulder(player) {
    const scene = this.scene;
    const frontX = this.x + this.dir * (this.body.width / 2 - 10);
    const t = scene.solidTileAt(frontX, this.body.bottom + 4);
    if (t?.floor) t.floor.breakTile(t.tx, t.ty, false);
    scene.fx.dust(frontX, this.body.bottom, 0x8d6e63, 20);

    this.throwUntil = scene.time.now + 400;
    const boulder = scene.clods.create(frontX, this.body.top + this.body.height * 0.3, 'clod').setScale(BOSS.boulderScale).setDepth(4);
    boulder.big = true;
    boulder.damage = BOSS.boulderDamage;
    boulder.dieAt = scene.time.now + 5000;
    const angle = Math.atan2(player.y - boulder.y - 120, player.x - boulder.x);
    boulder.setVelocity(Math.cos(angle) * BOSS.boulderSpeed, Math.sin(angle) * BOSS.boulderSpeed);
  }

  throwClod(player) {
    this.throwUntil = this.scene.time.now + 250; // front arm swings up (see poseParts)
    const clod = this.scene.clods.create(this.x, this.y - 6, 'clod');
    clod.setDepth(4);
    clod.dieAt = this.scene.time.now + 3000;
    // Aim a bit above the player so gravity arcs it in
    const angle = Math.atan2(player.y - this.y - 60, player.x - this.x);
    clod.setVelocity(Math.cos(angle) * ENEMY.clodSpeed, Math.sin(angle) * ENEMY.clodSpeed);
  }

  hit(dmg, fromX, knockbackX = ENEMY.knockbackX) {
    if (!this.active) return;
    this.hp -= dmg;
    this.state = 'chase';
    const shove = this.boss ? BOSS.knockbackMult : 1;
    this.stunUntil = this.scene.time.now + ENEMY.stunMs * shove;
    const away = Math.sign(this.x - fromX) || 1;
    if (this.attack !== 'charge') this.setVelocity(away * knockbackX * shove, ENEMY.knockbackY * shove);

    // White flash on every part
    for (const { img } of this.parts) img.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    this.scene.time.delayedCall(80, () => {
      if (!this.active) return;
      for (const { img } of this.parts) img.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
    });

    if (this.hp <= 0) {
      const color = this.kind === 'spitter' ? 0x8a5a3c : 0x4a4048;
      this.scene.fx.dust(this.x, this.y, color, this.boss ? 60 : 18);
      if (this.boss) this.scene.cameras.main.shake(300, 0.015);
      sfx(this.scene, 'enemyDeath');
      this.scene.updateStats((s) => s.kills++);
      if (this.boss) this.scene.onBossKilled(this);
      else this.scene.addPoints(ENEMY.killPoints[this.kind], this.x, this.body.top - 8, '#ff8a65');
      this.destroy();
    }
  }
}
