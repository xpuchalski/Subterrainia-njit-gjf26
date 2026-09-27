import * as Phaser from 'phaser';
import { ENEMY } from '../config.js';
import { sfx } from '../audio.js';

// Subterranean person. kind: 'melee' (chaser) or 'spitter' (keeps distance, lobs dirt clods).
// Wider than one tile so it can't fall down 1-wide shafts.
export default class Enemy extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, kind, floor) {
    super(scene, x, y, kind === 'spitter' ? 'enemy_spitter' : 'enemy');
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.kind = kind;
    this.floor = floor;
    const floorNum = floor.floorNum;
    this.maxHp = ENEMY.baseHp * (1 + ENEMY.hpScalePerFloor * (floorNum - 1));
    this.hp = this.maxHp;
    this.speedScale = Math.min(1.4, 1 + 0.03 * (floorNum - 1));
    this.dir = Math.random() < 0.5 ? -1 : 1;
    this.state = 'patrol';
    this.stunUntil = 0;
    this.nextShotAt = 0;

    // Drawn at artScale. Hitbox: ENEMY.width wide, as tall as the art (so feet sit exactly on the ground)
    const k = ENEMY.artScale;
    this.setScale(k);
    this.body.setSize(ENEMY.width / k, this.height, false);
    this.body.setOffset((this.width - ENEMY.width / k) / 2, 0);
    this.setDepth(3);
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

    if (this.state === 'patrol' && player.alive && dist < ENEMY.noticeRange && Math.abs(dy) < 140) {
      this.state = 'chase';
    } else if (this.state === 'chase' && (!player.alive || dist > ENEMY.loseRange)) {
      this.state = 'patrol';
    }

    let speed = 0;
    if (this.state === 'patrol') {
      if (body.blocked.left) this.dir = 1;
      else if (body.blocked.right) this.dir = -1;
      else if (onGround && !this.scene.isSolidAt(this.x + this.dir * (ENEMY.width / 2 + 2), this.body.bottom + 4)) this.dir *= -1; // ledge
      speed = ENEMY.patrolSpeed;
    } else if (this.kind === 'spitter') {
      // Hold a middle distance and lob clods
      const toward = Math.sign(dx) || 1;
      if (dist < 140) { this.dir = -toward; speed = ENEMY.patrolSpeed; }
      else if (dist > ENEMY.spitterRange * 0.8) { this.dir = toward; speed = ENEMY.patrolSpeed; }
      else { this.dir = toward; speed = 0; }
      if (time >= this.nextShotAt && dist < ENEMY.spitterRange) {
        this.nextShotAt = time + ENEMY.spitterCooldownMs;
        this.throwClod(player);
      }
    } else {
      if (Math.abs(dx) > 4) this.dir = Math.sign(dx);
      speed = ENEMY.chaseSpeed;
    }

    this.setVelocityX(this.dir * speed * this.speedScale);
    this.setFlipX(this.dir < 0);

    // Hop over walls while chasing
    const blockedAhead = (this.dir < 0 && body.blocked.left) || (this.dir > 0 && body.blocked.right);
    if (this.state === 'chase' && onGround && blockedAhead) this.setVelocityY(ENEMY.jumpVelocity);
  }

  throwClod(player) {
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
    this.stunUntil = this.scene.time.now + ENEMY.stunMs;
    const away = Math.sign(this.x - fromX) || 1;
    this.setVelocity(away * knockbackX, ENEMY.knockbackY);

    this.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    this.scene.time.delayedCall(80, () => {
      if (this.active) this.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
    });

    if (this.hp <= 0) {
      this.scene.fx.dust(this.x, this.y, this.kind === 'spitter' ? 0xb39ddb : 0xd4a373, 18);
      sfx(this.scene, 'enemyDeath');
      this.scene.updateStats((s) => s.kills++);
      this.scene.addPoints(ENEMY.killPoints[this.kind], this.x, this.y - ENEMY.height / 2 - 8, '#ff8a65');
      this.destroy();
    }
  }
}
