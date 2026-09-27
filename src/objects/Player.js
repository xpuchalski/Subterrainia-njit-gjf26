import * as Phaser from 'phaser';
import { PLAYER, MAX_FALL_SPEED, PLAYER_ART } from '../config.js';
import { sfx, loopSfx } from '../audio.js';

// Hitbox sizes. The sprite can be taller (her hat pokes out above the hitbox);
// it's anchored so her feet sit on the bottom of the hitbox.
// Sizes are in art pixels; they're multiplied by PLAYER_ART.scale like the sprite.
const STAND = { key: 'player', w: 18, h: 38 };
const CROUCH = { key: 'player_crouch', w: 18, h: 22 }; // x4/3 still fits a 1-tile tunnel

export default class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, STAND.key);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setScale(PLAYER_ART.scale);
    this.setPose(STAND.key, STAND);
    this.setCollideWorldBounds(true);
    this.setMaxVelocity(1000, MAX_FALL_SPEED);
    this.setDepth(5);

    this.keys = scene.input.keyboard.addKeys({
      a: 'A', d: 'D', w: 'W', s: 'S', space: 'SPACE', shift: 'SHIFT',
    }); // (the arrow keys attack; see Weapons)

    this.hp = PLAYER.maxHp;
    this.alive = true;
    this.crouching = false;
    this.moveMult = 1; // set by the held weapon
    this.jumpMult = 1; // jump *height* multiplier
    this.invulnUntil = 0;
    this.contactImmuneUntil = 0; // brief immunity to contact damage after a connecting slash
    this.knockUntil = 0;
    this.lastGroundedAt = 0;
    this.jumpPressedAt = -Infinity;
    this.windupUntil = 0; // >0 while crouching down right before a jump
    this.walkPhase = 0; // advances with distance walked; picks the walk frame
    // Footstep loop: plays while walking, pitched/sped with walking speed; paused with the game
    this.steps = loopSfx(scene, 'footsteps');
    const pauseSteps = () => this.steps?.pause();
    scene.events.on('pause', pauseSteps);
    scene.events.once('shutdown', () => {
      scene.events.off('pause', pauseSteps); // scene events outlive restarts
      this.steps?.destroy();
    });
  }

  update(time, delta) {
    if (!this.alive) {
      this.setVelocityX(0);
      this.animate(time, delta, false);
      return;
    }
    const k = this.keys;

    // Crouch (can't stand up under a ceiling); left alone during the jump windup
    const crouchHeld = k.shift.isDown || k.s.isDown;
    if (!this.windupUntil) {
      if (crouchHeld && !this.crouching) this.setCrouch(true);
      else if (!crouchHeld && this.crouching && this.canStand()) this.setCrouch(false);
    }

    const left = k.a.isDown;
    const right = k.d.isDown;
    const jumpJustDown =
      Phaser.Input.Keyboard.JustDown(k.space) ||
      Phaser.Input.Keyboard.JustDown(k.w);
    const jumpHeld = k.space.isDown || k.w.isDown;

    // Horizontal: accelerate toward the target speed (skipped briefly while being knocked back)
    if (time >= this.knockUntil) {
      const speed = PLAYER.speed * this.moveMult * (this.crouching ? PLAYER.crouchSpeedMult : 1);
      const target = left === right ? 0 : left ? -speed : speed;
      const vx = this.body.velocity.x;
      // Use the faster rate when stopping or reversing so turns stay snappy
      const rate = target === 0 || Math.sign(target) !== Math.sign(vx) ? PLAYER.decel : PLAYER.accel;
      const step = (rate * delta) / 1000;
      this.setVelocityX(vx < target ? Math.min(vx + step, target) : Math.max(vx - step, target));
    }

    // Jump with coyote time + buffering
    const onGround = this.body.blocked.down || this.body.touching.down;
    if (onGround) this.lastGroundedAt = time;
    if (jumpJustDown) this.jumpPressedAt = time;

    const canJump = time - this.lastGroundedAt <= PLAYER.coyoteMs;
    const wantsJump = time - this.jumpPressedAt <= PLAYER.jumpBufferMs;
    if (this.windupUntil && time >= this.windupUntil) {
      // Windup over: leave the ground (animate() switches back to standing)
      this.windupUntil = 0;
      this.launch();
    } else if (!this.windupUntil && canJump && wantsJump) {
      this.lastGroundedAt = -Infinity;
      this.jumpPressedAt = -Infinity;
      if (PLAYER.jumpWindupMs > 0 && !this.crouching) {
        this.windupUntil = time + PLAYER.jumpWindupMs; // animate() shows the crouch frame
      } else {
        this.launch();
      }
    }

    // Variable jump height: release early for a short hop
    if (!jumpHeld && this.body.velocity.y < 0) {
      this.setVelocityY(this.body.velocity.y * 0.85);
    }

    this.animate(time, delta, onGround);
  }

  // Choose the frame to show. Only crouching changes the hitbox; the jump windup,
  // breathing and walking are purely visual.
  animate(time, delta, onGround) {
    let key = STAND.key;
    const vx = Math.abs(this.body.velocity.x);
    if (this.crouching || this.windupUntil) {
      key = CROUCH.key;
    } else if (this.alive && onGround && vx > 20) {
      this.walkPhase += (delta / 1000) * PLAYER_ART.walkFps * Math.min(1, vx / PLAYER.speed);
      key = `player_walk${Math.floor(this.walkPhase) % 4}`;
    } else if (this.alive && onGround) {
      this.walkPhase = 0;
      const beat = Math.floor(((time % PLAYER_ART.breathMs) / PLAYER_ART.breathMs) * 4);
      key = ['player', 'player_inhale', 'player', 'player_exhale'][beat];
    }
    if (!this.scene.textures.exists(key)) key = this.crouching ? CROUCH.key : STAND.key; // placeholder art
    if (key !== this.texture.key) this.setPose(key, this.crouching ? CROUCH : STAND);

    // Footsteps while moving on the ground (walking or crouch-walking)
    const walking = this.alive && onGround && vx > 20 && !this.windupUntil;
    if (this.steps) {
      if (walking) {
        this.steps.setRate(Phaser.Math.Clamp(vx / PLAYER.speed, 0.6, 1.1));
        if (this.steps.isPaused) this.steps.resume();
        else if (!this.steps.isPlaying) this.steps.play();
      } else if (this.steps.isPlaying) {
        this.steps.pause();
      }
    }
  }

  launch() {
    // v = sqrt(2gh), so scaling height by m scales velocity by sqrt(m)
    this.setVelocityY(PLAYER.jumpVelocity * Math.sqrt(this.jumpMult));
  }

  setCrouch(on) {
    this.crouching = on;
    const s = on ? CROUCH : STAND;
    this.setPose(s.key, s);
  }

  // Swap the sprite and hitbox size, keeping the feet planted
  setPose(key, box) {
    // Measure from the sprite, not the body: the body only syncs once per physics step, so a
    // second pose change in the same frame (e.g. stand up, then a breathing frame) would read
    // the new height with the old position and push her into the floor.
    const feet = this.y + this.displayHeight / 2;
    this.setTexture(key);
    this.body.setSize(box.w, box.h, false);
    this.body.setOffset((this.width - box.w) / 2, this.height - box.h); // offsets are in unscaled pixels
    this.y = feet - this.displayHeight / 2;
  }

  // World position of the shoulder the held arm hangs from. Every pose keeps the upper body
  // intact (breathing moves it as a whole), so it's the same distance from the sprite's top.
  shoulder() {
    const s = PLAYER_ART.shoulder;
    const k = PLAYER_ART.scale;
    const sx = s.x + 0.5 + (this.texture.customData.padX ?? 0); // generated frames have side padding
    const lx = this.flipX ? this.width - sx : sx;
    return { x: this.x - this.displayWidth / 2 + lx * k, y: this.y - this.displayHeight / 2 + (s.y + 0.5) * k };
  }

  canStand() {
    const headY = this.body.bottom - STAND.h * PLAYER_ART.scale + 2;
    return !this.scene.isSolidAt(this.body.left + 1, headY) && !this.scene.isSolidAt(this.body.right - 1, headY);
  }

  // Set velocity and ignore movement input for `ms` so the push is felt
  knock(vx, vy, ms) {
    this.setVelocity(vx, vy);
    this.knockUntil = Math.max(this.knockUntil, this.scene.time.now + ms);
  }

  awayFrom(x) {
    return Math.sign(this.x - x) || 1;
  }

  // Pushed away from an enemy your slash just hit, so it can't body-check you mid-swing
  recoil(fromX) {
    this.knock(this.awayFrom(fromX) * PLAYER.recoilX, Math.min(this.body.velocity.y, PLAYER.recoilY), 150);
    this.contactImmuneUntil = this.scene.time.now + PLAYER.recoilImmuneMs;
  }

  // Brief external push added to current velocity (shotgun recoil). Only lifts you, never slams you down.
  shove(vx, vy, ms) {
    const v = this.body.velocity;
    this.knock(v.x + vx, vy < 0 ? Math.min(v.y, v.y + vy) : v.y, ms);
  }

  // Returns true if the hit landed. contact = body-touch damage from an enemy.
  takeDamage(amount, fromX, contact = false) {
    const now = this.scene.time.now;
    if (!this.alive || now < this.invulnUntil) return false;
    if (contact && now < this.contactImmuneUntil) return false;

    this.hp = Math.max(0, this.hp - amount);
    this.invulnUntil = now + PLAYER.invulnMs;
    this.knock(this.awayFrom(fromX) * PLAYER.knockbackX, PLAYER.knockbackY, 200);

    this.scene.tweens.add({
      targets: this, alpha: 0.25, duration: 80, yoyo: true, repeat: Math.floor(PLAYER.invulnMs / 160) - 1,
      onComplete: () => this.setAlpha(1),
    });
    this.scene.cameras.main.shake(120, 0.008);
    sfx(this.scene, 'playerHurt');

    if (this.hp <= 0) {
      this.alive = false;
      this.setTint(0x777777);
      this.scene.events.emit('player-died');
    }
    return true;
  }
}
