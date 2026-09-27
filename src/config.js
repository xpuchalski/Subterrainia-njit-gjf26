// All tuning numbers live here. Tweak freely.

// --- Display / physics ---
export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 540;
export const GRAVITY = 900;
export const MAX_FALL_SPEED = 900;
export const DEBUG_PHYSICS = false; // true = draw arcade physics bodies
export const CAMERA_ZOOM = 2.0; // >1 = everything looks bigger (UI is unaffected)

// --- Floors / terrain ---
export const TILE = 32;
export const FLOOR_COLS = 80; // includes the two unbreakable side-wall columns
export const FLOOR_ROWS = 48;
export const FLOOR_GAP = 480; // empty shaft (px) the player falls through between layers
export const ENTRY_ROWS = 4; // open air at the top of every floor
export const SURFACE_MIN_ROW = 9;
export const SURFACE_MAX_ROW = 13;
export const PITS_PER_FLOOR = [2, 4];
export const PLATFORMS_PER_FLOOR = [8, 12];
export const POCKETS_PER_FLOOR = [8, 14];
export const TILE_HP = { dirt: 1, stone: 3 }; // pickaxe hits
export const STONE_CHANCE_BASE = 0.1;
export const STONE_CHANCE_PER_FLOOR = 0.03;
export const STONE_CHANCE_MAX = 0.35;

// --- Player ---
export const PLAYER = {
  speed: 260,
  accel: 1800, // px/s² toward top speed (~0.15s to full speed)
  decel: 2400, // px/s² when stopping or turning
  crouchSpeedMult: 0.5,
  jumpVelocity: -520,
  jumpWindupMs: 60, // she crouches this long before leaving the ground (0 = instant jump)
  recoilX: 280, // pushback when your pickaxe slash connects with an enemy
  recoilY: -120,
  recoilImmuneMs: 350, // no contact damage for this long after a connecting slash
  coyoteMs: 100,
  jumpBufferMs: 100,
  maxHp: 5,
  invulnMs: 1000,
  knockbackX: 220,
  knockbackY: -260,
};

// Player art: public/assets/sprites/player_body.png (no arm) + arm_extended.png (pickaxe) / arm_bent.png (shotgun).
// Arms are drawn hanging down with the shoulder at the top center. The body is cropped automatically;
// the crouch frame is built from it by squashing the legs until a drawn one exists.
export const PLAYER_ART = {
  // Draw scale for the player, her arms and weapons (hitbox scales too). Pixel art stays even when
  // scale x CAMERA_ZOOM is a whole number (e.g. 4/3 x 1.5 = 2, or 1 x 2 = 2).
  scale: 4 / 3,
  shoulder: { x: 3, y: 17 }, // pixel on the (cropped) body where the arm attaches, facing right
  armScale: 1.3, // arms draw this much bigger than the body (1 = same pixel size)
  // Arm textures hang down. shoulder = pivot pixel, hand = where the weapon grip goes,
  // twistDeg = extra clockwise rotation of the whole arm (when facing right)
  arms: {
    arm_extended: { shoulder: { x: 2, y: 0.5 }, hand: { x: 1.5, y: 11 }, twistDeg: 0 },
    arm_bent: { shoulder: { x: 2, y: 0.5 }, hand: { x: 5.5, y: 6 }, twistDeg: 90 },
  },
  waist: 0.48, // fraction of the character's height where the legs start
  crouchLegScale: 0.4, // crouched legs are this fraction of their standing height
  walkStride: 2, // px each foot moves forward/back in the walk cycle
  walkFps: 9, // walk frames per second at full speed (slower when walking slower)
  breathMs: 2400, // one full idle breath (normal -> in -> normal -> out)
};

// --- Weapons ---
export const PICKAXE = {
  cooldownMs: 360,
  swingMs: 170, // the pickaxe sweeps through the slash arc over this time
  reach: 76, // px from player center, for terrain (diagonal aims)
  extraTiles: 1, // straight up/down/sideways: tiles past the adjacent one the swing can reach
  tileDamage: 1,
  // The slash arc that comes out of each swing
  slashRadius: 72,
  slashArcDeg: 65, // half-angle
  slashFadeMs: 120, // slash lingers this long after the sweep ends
  enemyDamage: 2,
  enemyKnockbackX: 320,
  fossilDamage: 1,
};

export const SHOTGUN = {
  pellets: 9,
  spreadDeg: 25, // full cone
  pelletSpeed: 900,
  pelletLifeMs: 300,
  pelletDamage: 1,
  pumpDelayMs: 600,
  tubeSize: 6,
  reloadPerShellMs: 450,
  moveMult: 0.85,
  jumpHeightMult: 0.85,
  recoil: 200, // px/s pushback opposite the aim when firing
  recoilMs: 120, // movement input is ignored this long so the push is felt
  shakeMs: 90,
  shakeIntensity: 0.006,
  // Slam fire: keep holding fire to dump the tube faster with a wider cone
  slamDelayMs: 220,
  slamSpreadMult: 1.7,
};

// --- Fossils ---
// hits = extra pickaxe hits the fossil takes to break out (buried fossils add this to the tile's HP)
export const FOSSIL_TIERS = {
  common: { hits: 1, points: 10 },
  uncommon: { hits: 2, points: 50 },
  rare: { hits: 4, points: 250 },
  orb: { hits: 1, points: 0 }, // the mint-orb easter egg (placed by hand, never rolled)
};
export const FOSSIL_WEIGHTS_BASE = { common: 70, uncommon: 25, rare: 5 };
export const FOSSIL_WEIGHTS_PER_FLOOR = { common: -4, uncommon: 2, rare: 1.5 }; // added per floorIndex
export const FOSSIL_WEIGHT_MIN_COMMON = 25;
export const SURFACE_FOSSILS = [8, 12];
export const BURIED_FOSSILS = [12, 18];
export const BURIED_FOSSIL_ALPHA = 0.3;
export const FOSSIL_ART_SCALE = 4 / 3; // same pixel size as the player
// Buried skeletons: a rare 'skull' at the head followed by a trail of lesser bones
export const SKELETON_ATTEMPTS = 2; // tries per layer
export const SKELETON_CHANCE = 0.6; // chance each try spawns one
export const SKELETON_LENGTH = [4, 7]; // bones behind the skull
export const SKELETON_UNCOMMON_BONES = 2; // the first N bones behind the skull are uncommon, the rest common

// --- Enemies ---
export const ENEMY = {
  firstFloor: 2, // no enemies on floor 1
  countBase: 5,
  countPerTwoFloors: 1,
  countMax: 13,
  baseHp: 5,
  hpScalePerFloor: 0.35, // hp = baseHp x (1 + this x (layer - 1)): layer 5 = 12, layer 10 = ~21, layer 15 = ~30
  patrolSpeed: 60,
  chaseSpeed: 125,
  // Wider than a 1-tile gap so they can't drop down the player's shaft (world px = art px x artScale)
  width: 38 * (4 / 3), // hitbox width (height comes from the art)
  artScale: 4 / 3, // same pixel size as the player
  // Body parts: public/assets/sprites/enemy_<part>.png (thrower: enemy_thrower_<part>.png), all drawn
  // in place on the same 64x64 canvas. Positions below are canvas pixels, facing right.
  rig: {
    hitbox: { x: 13, y: 13, w: 38, h: 30 }, // torso + legs, centered on the canvas
    feetY: 43,
    // draw order back-to-front, and the joint each part rotates around
    parts: [
      { name: 'R_arm', joint: [29, 18] }, // back arm
      { name: 'R_leg', joint: [25, 33] }, // back leg
      { name: 'L_leg', joint: [34, 32] }, // front leg
      { name: 'torso', joint: [32, 32] },
      { name: 'L_arm', joint: [40, 28] }, // front arm
    ],
    walkCyclesPerPx: 1 / 48, // one full step cycle per 48px travelled
    legSwingDeg: 22,
    armSwingDeg: 14,
    breathMs: 1600,
  },
  noticeRange: 350,
  loseRange: 400,
  jumpVelocity: -440, // clears a 3-tile wall
  contactDamage: 1,
  knockbackX: 200,
  knockbackY: -150,
  stunMs: 250,
  spawnSafeCols: 6, // don't spawn this close (in columns) to the player's entry x
  // Ranged variant ("spitter") shows up from this floor number on
  spitterFromFloor: 5,
  spitterChance: 0.35,
  spitterRange: 640,
  spitterCooldownMs: 1500,
  clodSpeed: 440,
  spitterHopVelocity: -300, // throwers hop as they throw
  // Points per kill; count toward the layer score like fossils (so they get the speed/depth multipliers)
  killPoints: { melee: 25, spitter: 40 },
  // Rare boss version of either kind. At most one per layer; it gets a cleared arena on the surface.
  boss: {
    chance: 1 / 150, // per enemy spawned
    guaranteedEvery: 8, // layers 8, 16, 24... always have one
    scale: 5, // x the normal size (hitbox too)
    hpMult: 10,
    killBonus: 15000, // added straight to the total score (not multiplied)
    zoom: 1.5, // camera zooms out to this while a boss is alive on the layer
    contactDamage: 2,
    jumpVelocity: -500, // clears a 4-tile wall
    chargeBreaks: 40, // blocks a charge can smash (ground row ahead up to above its head); set a number to cap it
    knockbackMult: 0.15, // barely budges when hit
    telegraphMs: 500, // flashes this long before each attack
    attackRange: 620, // starts an attack when the player is this close (and roughly level)
    cooldownMs: 1600,
    chargeSpeed: 430, // melee boss: charge
    chargeMs: 900,
    boulderSpeed: 380, // thrower boss: rips up a block and throws a boulder
    boulderScale: 3,
    boulderDamage: 2,
    boulderBreaks: 2, // tiles destroyed where each boulder lands
    boulderCount: 3, // thrown together, each on a different arc
    boulderArcDeg: 18, // angle between the arcs
  },
};

// --- Scoring ---
// Speed multiplier: first bracket whose `under` (seconds) the floor time beats
export const SPEED_BRACKETS = [
  { under: 45, mult: 2.0 },
  { under: 75, mult: 1.5 },
  { under: 120, mult: 1.0 },
  { under: Infinity, mult: 0.75 },
];
export const DEPTH_MULT_PER_FLOOR = 0.25;
export const HEAL_EVERY_POINTS = 15000; // +1 HP (up to max) each time the total score passes a multiple of this

// Colors (same on every layer; BACKGROUND_COLOR is the game's clear color)
export const TERRAIN_COLOR = 0x8d6e63;
export const BACKGROUND_COLOR = 0x1d1f2b;

// --- Audio ---
// Default volumes; the player's slider settings (title screen / pause menu) are saved over these
export const MUSIC_VOLUME = 0.5;
export const SFX_VOLUME = 0.7;
export const SETTINGS_KEY = 'dont-dig-straight-down.settings';
// Sound effects in public/assets/sfx. seek = seconds of silent lead-in to skip; volume is relative.
export const SFX = {
  blockBreak: { file: 'block-break.mp3', volume: 0.25 },
  click: { file: 'click-button.mp3', volume: 0.2, seek: 0.28 },
  enemyDeath: { file: 'enemy-death.mp3', volume: 0.7, seek: 0.22 },
  footsteps: { file: 'footsteps.mp3', volume: 7 }, // looped while walking
  pickaxeHit: { file: 'pickaxe-hit.mp3', volume: 0.8 },
  playerHurt: { file: 'player-hurt.mp3', volume: 0.9 },
  shotgunPump: { file: 'shotgun-pump.mp3', volume: 0.5 },
  shotgunShoot: { file: 'shotgun-shoot.mp3', volume: 0.7 },
};
export const PUMP_AFTER_SHOT_MS = 180; // the pump sound follows each shot

// Early layers get extra big caves and wider/more surface gaps, fading out by `fadeLayers`
export const EARLY_CAVES = {
  fadeLayers: 6,
  bigCaves: 5, // on layer 1; scales down to 0
  width: [8, 16],
  height: [4, 7],
  extraPits: 2, // on layer 1
  extraPitWidth: 3, // on layer 1
};

// Permanent unlocks (progress is cumulative across runs). One skin per weapon is equipped at a
// time (picked on the title screen); earning a new one equips it right away, even mid-run.
export const STATS_KEY = 'dont-dig-straight-down.stats';
export const EQUIPPED_KEY = 'dont-dig-straight-down.equipped';
export const UNLOCKS = [
  { stat: 'kills', need: 100, weapon: 'shotgun', skin: 'shotgun_gold', label: 'Gold shotgun' },
  { stat: 'bosses', need: 10, weapon: 'shotgun', skin: 'shotgun_pink', label: 'Pink shotgun' },
  { needs: { kills: 10, bosses: 1 }, weapon: 'shotgun', skin: 'shotgun_red', label: 'Red shotgun' }, // several stats: all required
  { stat: 'shells', need: 100, weapon: 'pickaxe', skin: 'pickaxe_coral', label: 'Coral pickaxe' },
  { stat: 'deepest', need: 15, weapon: 'pickaxe', skin: 'pickaxe_red', label: 'Red pickaxe' },
  { stat: 'deepest', need: 25, weapon: 'pickaxe', skin: 'pickaxe_gold', label: 'Gold pickaxe' },
  { stat: 'playMs', need: 60 * 60 * 1000, weapon: 'pickaxe', skin: 'pickaxe_blue', label: 'Blue pickaxe' },
  { stat: 'mintOrb', need: 1, weapon: 'pickaxe', skin: 'pickaxe_mint', label: 'Mint pickaxe' },
  { stat: 'konami', need: 1, weapon: 'pickaxe', skin: 'pickaxe_bw', label: 'B&W pickaxe' }, // title screen: up up down down left right left right B A
];
// What each skin does. Pickaxe: damage / speed (swing rate) / range multipliers, points = multiplier
// on all points earned. Shotgun: pellets / shells / damage / recoil multipliers, pelletCount = exact
// pellets per shot (overrides pellets), fullMag = one click dumps the tube.
export const SKIN_STATS = {
  pickaxe_red: { damage: 1.5 },
  pickaxe_mint: { range: 1.4 },
  pickaxe_gold: { speed: 1.6 },
  pickaxe_coral: { points: 5 },
  pickaxe_blue: { points: 2, damage: 1.2, speed: 1.2, range: 1.15 },
  pickaxe_bw: { points: 10, damage: 5, speed: 5, range: 3 },
  shotgun_gold: { pellets: 3 },
  shotgun_pink: { shells: 2, fullMag: true },
  shotgun_red: { pelletCount: 1, recoil: 5, damage: 20 }, // one slug
};
export const FULL_MAG_DELAY_MS = 90; // time between shots when a full-mag burst dumps the tube
// Easter egg: a mint orb buried somewhere on this layer; digging it out unlocks the mint pickaxe
export const MINT_ORB_LAYER = 10;

export const SCORES_KEY = 'dont-dig-straight-down.scores';
export const SCORES_KEPT = 10;
