import * as Phaser from 'phaser';
import { PICKAXE, SHOTGUN, PLAYER_ART, PUMP_AFTER_SHOT_MS, FULL_MAG_DELAY_MS } from '../config.js';
import { skinFor, skinStats } from '../unlocks.js';
import { sfx } from '../audio.js';

const WEAPONS = ['pickaxe', 'shotgun'];
// Grip point on each weapon texture (pickaxe: middle of the handle)
const ORIGINS = { pickaxe: [15 / 36, 0.5], shotgun: [0.25, 0.5] };
// Weapon angle relative to the aim, counter-clockwise when facing right (the pickaxe is held upright)
const TWIST = { pickaxe: Math.PI / 2, shotgun: 0 };
const ARMS = { pickaxe: 'arm_extended', shotgun: 'arm_bent' };

// Handles the held weapon: aiming, switching, pickaxe swings and the shotgun.
export default class Weapons {
  constructor(scene, player) {
    this.scene = scene;
    this.player = player;
    this.current = 'pickaxe';
    const k = PLAYER_ART.scale;
    this.sprite = scene.add.image(player.x, player.y, 'pickaxe').setOrigin(...ORIGINS.pickaxe).setDepth(6).setScale(k);
    this.skins = {};
    this.refreshSkins(scene.stats);
    this.arm = scene.add.image(player.x, player.y, ARMS.pickaxe).setDepth(7).setScale(k * PLAYER_ART.armScale); // over the grip
    this.setArm(ARMS.pickaxe);
    this.aimAngle = 0;

    // Pickaxe
    this.swingOffset = 0;
    this.nextSwingAt = 0;
    this.swingTween = null;

    // Shotgun
    this.shells = this.tubeSize; // (set by refreshSkins)
    this.burst = false; // full-mag skin: keep firing until the tube is empty
    this.nextShotAt = 0;
    this.lastShotAt = 0;
    this.slamActive = false;
    this.reloadEvent = null;
    this.waitForRelease = false; // set after unpausing so the dismiss click doesn't swing
    this.pellets = scene.physics.add.group({ allowGravity: false });

    const kb = scene.input.keyboard;
    kb.on('keydown-ONE', () => this.switchTo('pickaxe'));
    kb.on('keydown-TWO', () => this.switchTo('shotgun'));
    kb.on('keydown-R', () => this.startReload());
    scene.input.on('wheel', (pointer, over, dx, dy) => {
      if (dy !== 0) this.cycle();
    });
    scene.input.on('pointerdown', (pointer) => {
      if (pointer.leftButtonDown()) this.onPress(scene.time.now);
    });
    scene.input.on('pointerup', () => (this.slamActive = false));
  }

  // Equipped skin per weapon and what it does (called again when something unlocks mid-run)
  refreshSkins(stats) {
    for (const w of WEAPONS) this.skins[w] = skinFor(w, stats);
    this.sprite.setTexture(this.skins[this.current]);
    this.pick = skinStats(this.skins.pickaxe); // damage / speed / range / points
    this.gun = skinStats(this.skins.shotgun); // pellets / shells / fullMag
    this.tubeSize = SHOTGUN.tubeSize * this.gun.shells;
    if (this.shells > this.tubeSize) this.shells = this.tubeSize;
  }

  get reloading() {
    return !!this.reloadEvent;
  }

  cycle() {
    const i = WEAPONS.indexOf(this.current);
    this.switchTo(WEAPONS[(i + 1) % WEAPONS.length]);
  }

  switchTo(name) {
    if (name === this.current || !this.player.alive) return;
    this.cancelReload();
    this.swingTween?.stop();
    this.slashGfx?.destroy();
    this.swingOffset = 0;
    this.slamActive = false;
    this.burst = false;
    this.current = name;
    this.sprite.setTexture(this.skins[name]).setOrigin(...ORIGINS[name]);
    this.setArm(ARMS[name]);
    const gun = name === 'shotgun';
    this.player.moveMult = gun ? SHOTGUN.moveMult : 1;
    this.player.jumpMult = gun ? SHOTGUN.jumpHeightMult : 1;
  }

  setArm(key) {
    this.arm.setTexture(key);
    this.armDef = PLAYER_ART.arms[key];
  }

  // Pose the arm for aim angle `rot` around shoulder `p` (aim, slash and muzzle are all measured
  // from the shoulder); returns the world position of the hand.
  // Facing left is the mirror image of facing right: flip the texture and negate the twist.
  poseArm(p, rot, left) {
    const { shoulder, hand, twistDeg } = this.armDef;
    const w = this.arm.width;
    const twist = Phaser.Math.DegToRad(twistDeg) * (left ? -1 : 1);
    const armRot = rot - Math.PI / 2 + twist; // the texture hangs down (+90°)
    // flipX mirrors the texture inside its frame, so mirror the pivot's x too
    const sx = left ? w - shoulder.x : shoulder.x;
    this.arm.setOrigin(sx / w, shoulder.y / this.arm.height).setPosition(p.x, p.y).setRotation(armRot).setFlipX(left);

    // Shoulder -> hand in texture pixels (mirrored if flipped), rotated with the arm, scaled
    const armK = PLAYER_ART.scale * PLAYER_ART.armScale;
    const vx = (hand.x - shoulder.x) * (left ? -1 : 1) * armK;
    const vy = (hand.y - shoulder.y) * armK;
    const c = Math.cos(armRot);
    const s = Math.sin(armRot);
    return { x: p.x + vx * c - vy * s, y: p.y + vx * s + vy * c };
  }

  update(time) {
    const scene = this.scene;
    const pointer = scene.input.activePointer;
    const aim = scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const player = this.player;

    // Face the cursor first (that decides which side the shoulder is on), then aim from the shoulder
    const left = aim.x < player.x;
    player.setFlipX(left);
    const p = this.player.shoulder();
    this.aimAngle = Math.atan2(aim.y - p.y, aim.x - p.x);

    const rot = this.aimAngle + (left ? -this.swingOffset : this.swingOffset);
    if (player.alive) {
      this.arm.setTint(0xffffff);
      const h = this.poseArm(p, rot, left);
      const twist = TWIST[this.current] * (left ? 1 : -1);
      this.sprite.setPosition(h.x, h.y).setRotation(rot + twist).setFlipY(left);
    } else {
      this.poseArm(p, Math.PI / 2, left); // hangs limp
      this.arm.setTint(0x777777);
    }
    this.sprite.setVisible(player.alive);
    this.arm.setAlpha(player.alpha); // blink with the body while invulnerable
    this.sprite.setAlpha(player.alpha);

    if (this.waitForRelease && !pointer.isDown) this.waitForRelease = false;
    if (this.player.alive && pointer.leftButtonDown() && !this.waitForRelease) {
      if (this.current === 'pickaxe' && time >= this.nextSwingAt) this.swing(time); // click or hold to dig
      if (this.current === 'shotgun' && this.slamActive && !this.burst && time >= this.lastShotAt + SHOTGUN.slamDelayMs) {
        this.fire(time, true);
      }
    }
    // Full-mag burst keeps going on its own until the tube is empty
    if (this.burst) {
      if (this.shells <= 0 || this.current !== 'shotgun' || !this.player.alive) this.burst = false;
      else if (time >= this.lastShotAt + FULL_MAG_DELAY_MS) this.fire(time, false);
    }

    // Pellet lifetime + terrain stops them
    for (const pellet of [...this.pellets.getChildren()]) {
      if (this.scene.isSolidAt(pellet.x, pellet.y)) {
        this.scene.fx.sparks(pellet.x, pellet.y);
        pellet.destroy();
      } else if (time >= pellet.dieAt) {
        pellet.destroy();
      }
    }
  }

  // Fresh click. The pickaxe is handled by the hold check in update(); this is the shotgun trigger.
  onPress(time) {
    if (!this.player.alive || this.current !== 'shotgun') return;
    if (this.shells === 0) {
      this.startReload(); // dry click
      return;
    }
    if (time >= this.nextShotAt) {
      this.fire(time, false);
      if (this.gun.fullMag) this.burst = true;
      else this.slamActive = true;
    }
  }

  // ------------------------------------------------------------ pickaxe

  swing(time) {
    const mod = this.pick;
    this.nextSwingAt = time + PICKAXE.cooldownMs / mod.speed;
    const radius = PICKAXE.slashRadius * mod.range;
    const { x, y } = this.player.shoulder();
    const angle = this.aimAngle;
    this.animateSwing();

    const inSlash = (px, py) => {
      const d = Phaser.Math.Distance.Between(x, y, px, py);
      if (d > radius) return false;
      if (d < 14) return true;
      const diff = Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(py - y, px - x) - angle));
      return diff <= Phaser.Math.DegToRad(PICKAXE.slashArcDeg);
    };

    // Enemies: test the point of their hitbox closest to the player, plus their center
    let hitFromX = null;
    for (const e of [...this.scene.enemies.getChildren()]) {
      if (!e.active) continue;
      const b = e.body;
      const cx = Phaser.Math.Clamp(x, b.left, b.right);
      const cy = Phaser.Math.Clamp(y, b.top, b.bottom);
      if (inSlash(cx, cy) || inSlash(e.x, e.y)) {
        e.hit(PICKAXE.enemyDamage * mod.damage, x, PICKAXE.enemyKnockbackX);
        hitFromX ??= e.x;
      }
    }
    if (hitFromX !== null) this.player.recoil(hitFromX);
    let connected = hitFromX !== null;

    // Fossils lying on the ground
    for (const floor of this.scene.floors) {
      for (const f of floor.fossils) {
        if (f.alive && !f.buried && inSlash(f.sprite.x, f.sprite.y)) {
          floor.hitSurfaceFossil(f, PICKAXE.fossilDamage);
          connected = true;
        }
      }
    }
    if (connected) sfx(this.scene, 'pickaxeHit'); // terrain hits play their own sound

    this.scene.pickaxeTerrain(angle, {
      damage: Math.round(PICKAXE.tileDamage * mod.damage),
      reach: PICKAXE.reach * mod.range,
      extraTiles: PICKAXE.extraTiles + (mod.range >= 1.3 ? 1 : 0),
    });
  }

  // The pickaxe sweeps across the slash arc, and the slash is drawn trailing right behind it
  animateSwing() {
    const arc = Phaser.Math.DegToRad(PICKAXE.slashArcDeg);
    const R = PICKAXE.slashRadius * this.pick.range;
    const swingMs = PICKAXE.swingMs / this.pick.speed;
    const cooldownMs = PICKAXE.cooldownMs / this.pick.speed;
    const scene = this.scene;
    const aim = this.aimAngle;
    const left = Math.abs(aim) > Math.PI / 2;

    this.swingTween?.stop();
    this.slashGfx?.destroy();
    const g = scene.add.graphics().setDepth(7);
    this.slashGfx = g;

    const draw = () => {
      const p = this.player.shoulder();
      g.setPosition(p.x, p.y).setRotation(aim).setScale(1, left ? -1 : 1);
      g.clear();
      const end = this.swingOffset;
      if (end <= -arc + 0.01) return;
      g.fillStyle(0xffffff, 0.9);
      g.beginPath();
      g.arc(0, 0, R, -arc, end, false);
      g.arc(10, 0, R - 22, end, -arc, true);
      g.closePath();
      g.fillPath();
    };

    this.swingOffset = -arc;
    this.swingTween = scene.tweens.add({
      targets: this, swingOffset: arc, duration: swingMs, ease: 'Sine.easeOut',
      onUpdate: draw,
      onComplete: () => {
        draw();
        scene.tweens.add({ targets: g, alpha: 0, duration: PICKAXE.slashFadeMs, onComplete: () => g.destroy() });
        // Ease the pickaxe back to rest over the rest of the cooldown
        this.swingTween = scene.tweens.add({
          targets: this, swingOffset: 0, duration: cooldownMs - swingMs, ease: 'Quad.easeInOut',
        });
      },
    });
  }

  // ------------------------------------------------------------ shotgun

  fire(time, slam) {
    if (this.shells <= 0) return;
    this.cancelReload(); // firing interrupts a reload (we know shells >= 1 here)
    this.shells--;
    this.lastShotAt = time;
    this.nextShotAt = time + SHOTGUN.pumpDelayMs;

    const angle = this.aimAngle;
    // Muzzle = hand + the part of the gun in front of the grip
    const hand = this.poseArm(this.player.shoulder(), angle, this.player.flipX);
    const barrel = this.sprite.displayWidth * (1 - this.sprite.originX);
    const muzzleX = hand.x + Math.cos(angle) * barrel;
    const muzzleY = hand.y + Math.sin(angle) * barrel;
    const spread = Phaser.Math.DegToRad(SHOTGUN.spreadDeg * (slam ? SHOTGUN.slamSpreadMult : 1));

    // Muzzle jammed into terrain: the blast is absorbed
    const blocked = this.scene.isSolidAt(muzzleX, muzzleY);
    if (blocked) this.scene.fx.sparks(muzzleX, muzzleY);
    const pellets = Math.round(SHOTGUN.pellets * this.gun.pellets);
    for (let i = 0; i < pellets && !blocked; i++) {
      const t = pellets === 1 ? 0.5 : i / (pellets - 1);
      const a = angle + (t - 0.5) * spread + Phaser.Math.FloatBetween(-0.04, 0.04);
      const speed = SHOTGUN.pelletSpeed * Phaser.Math.FloatBetween(0.9, 1.1);
      const pellet = this.pellets.create(muzzleX, muzzleY, 'pellet');
      pellet.setDepth(7);
      pellet.setVelocity(Math.cos(a) * speed, Math.sin(a) * speed);
      pellet.dieAt = time + SHOTGUN.pelletLifeMs;
    }

    const flash = this.scene.add.image(muzzleX, muzzleY, 'flash').setDepth(7).setBlendMode(Phaser.BlendModes.ADD);
    this.scene.tweens.add({ targets: flash, alpha: 0, scale: 1.8, duration: 90, onComplete: () => flash.destroy() });
    this.scene.cameras.main.shake(SHOTGUN.shakeMs, SHOTGUN.shakeIntensity);
    sfx(this.scene, 'shotgunShoot');
    if (this.shells > 0) this.scene.time.delayedCall(PUMP_AFTER_SHOT_MS, () => sfx(this.scene, 'shotgunPump'));
    this.player.shove(-Math.cos(angle) * SHOTGUN.recoil, -Math.sin(angle) * SHOTGUN.recoil, SHOTGUN.recoilMs);
  }

  startReload() {
    if (this.current !== 'shotgun' || this.reloading || this.shells >= this.tubeSize || !this.player.alive) return;
    this.slamActive = false;
    this.reloadEvent = this.scene.time.addEvent({
      delay: SHOTGUN.reloadPerShellMs,
      loop: true,
      callback: () => {
        this.shells++;
        if (this.shells >= this.tubeSize) {
          this.cancelReload();
          sfx(this.scene, 'shotgunPump'); // chamber a round once the tube is full
        }
      },
    });
  }

  cancelReload() {
    this.reloadEvent?.remove();
    this.reloadEvent = null;
  }
}
