/**
 * @fileoverview Axiom Zero game-specific configuration.
 * Extends GAME_CONSTANTS (defined in js/util/globals.js) with all
 * values that are specific to this game and should NOT be in util/.
 *
 * Must be loaded after js/util/globals.js.
 */

// ─── Phase names ──────────────────────────────────────────────────────────────

GAME_CONSTANTS.PHASE_UPGRADE = 'UPGRADE_PHASE';
GAME_CONSTANTS.PHASE_COMBAT = 'COMBAT_PHASE';
GAME_CONSTANTS.PHASE_WAVE_COMPLETE = 'WAVE_COMPLETE';
GAME_CONSTANTS.PHASE_GAME_OVER = 'GAME_OVER';

// ─── Colors (GDD §4) ──────────────────────────────────────────────────────────

GAME_CONSTANTS.COLOR_BG = 0x05080f;
GAME_CONSTANTS.COLOR_FRIENDLY = 0x00f5ff;
GAME_CONSTANTS.COLOR_RESOURCE = 0xff9500;
GAME_CONSTANTS.COLOR_HOSTILE = 0xff2d78;
GAME_CONSTANTS.COLOR_STRAY = 0xffe600;
GAME_CONSTANTS.HEALTH_BAR_TINT = 0x333333;

// ─── Tower ────────────────────────────────────────────────────────────────────

GAME_CONSTANTS.TOWER_BASE_HEALTH = 20;
GAME_CONSTANTS.TOWER_BASE_DAMAGE = 5;
GAME_CONSTANTS.TOWER_ATTACK_RANGE = 250;
GAME_CONSTANTS.TOWER_ATTACK_COOLDOWN = 1000;  // ms between auto-attacks
GAME_CONSTANTS.TOWER_BASE_REGEN = -0.4;   // HP/sec (negative = drain)

// ─── EXP ──────────────────────────────────────────────────────────────────────

GAME_CONSTANTS.EXP_FILL_RATE = 0.5;   // per second during combat
GAME_CONSTANTS.EXP_TO_INSIGHT = 100;  // EXP needed to award 1 INSIGHT

// ─── Enemy — Basic type (Phase 1) ─────────────────────────────────────────────

GAME_CONSTANTS.ENEMY_SPAWN_DISTANCE = 1000;  // px from center of screen
GAME_CONSTANTS.ENEMY_BASE_HEALTH = 5;
GAME_CONSTANTS.ENEMY_BASE_DAMAGE = 2;
GAME_CONSTANTS.ENEMY_BASE_SPEED = 30;    // px/sec
GAME_CONSTANTS.ENEMY_CONTACT_RADIUS = 30;    // px — deals damage & dies at tower
GAME_CONSTANTS.ENEMY_SPAWN_INTERVAL = 900;   // ms between spawns
GAME_CONSTANTS.ENEMY_SCALE_RATE = 0.02;  // health/damage multiplier increase per second

// ─── DATA drops ───────────────────────────────────────────────────────────────

GAME_CONSTANTS.DATA_DROP_CHANCE = 0.6;
GAME_CONSTANTS.DATA_PICKUP_RADIUS = 100;  // px — cursor auto-collects within this

// ─── Projectile ───────────────────────────────────────────────────────────────

GAME_CONSTANTS.PROJECTILE_SPEED = 400;  // px/sec
GAME_CONSTANTS.PROJECTILE_HIT_RADIUS = 15;

// ─── Miniboss / Boss ──────────────────────────────────────────────────────────

GAME_CONSTANTS.MINIBOSS_SPAWN_DISTANCE = 1000;  // px from center
GAME_CONSTANTS.MINIBOSS_SPAWN_ANGLE = 60;    // degrees — ±30° from horizontal

GAME_CONSTANTS.ENEMY_BULLET_HIT_RADIUS = 15;
GAME_CONSTANTS.ENEMY_BULLET_POOL_SIZE = 20;

// ─── Wave ─────────────────────────────────────────────────────────────────────

GAME_CONSTANTS.WAVE_DURATION = 50;  // seconds — progress bar fills over this period

// ─── Depth layers (flat ordering, no Containers) ──────────────────────────────

GAME_CONSTANTS.DEPTH_BG = 0;
GAME_CONSTANTS.DEPTH_GLOW = 50;
GAME_CONSTANTS.DEPTH_ENEMIES = 100;
GAME_CONSTANTS.DEPTH_TOWER = 200;
GAME_CONSTANTS.DEPTH_PROJECTILES = 300;
GAME_CONSTANTS.DEPTH_RESOURCES = 400;
GAME_CONSTANTS.DEPTH_HUD = 1000;
GAME_CONSTANTS.DEPTH_NEURAL_TREE = 2000;
GAME_CONSTANTS.DEPTH_DEATH_OVERLAY = 3000;  // death flash — covers entire game
GAME_CONSTANTS.DEPTH_DEATH_TOWER = 3500;  // tower elevated above overlay during shake
GAME_CONSTANTS.DEPTH_TRANSITION = 5000;
GAME_CONSTANTS.DEPTH_ITERATION_OVER = 6000;
GAME_CONSTANTS.DEPTH_POPUPS = 10000;

// ─── Transitions ──────────────────────────────────────────────────────────────

GAME_CONSTANTS.TRANSITION_DURATION = 600;  // ms — camera slide duration
GAME_CONSTANTS.COMBAT_INTRO_TEXT = 'SYSTEM ANOMALY DETECTED';

// ─── Save / persistence keys ──────────────────────────────────────────────────
// Consumed by js/util/gameState.js — kept here so renaming for a new project
// only requires editing this file.

const SAVE_KEY = 'axiomzero_save';
const SAVE_VERSION = 1;

// ─── Default game state shape ─────────────────────────────────────────────────
// Consumed by js/util/gameState.js and gameInit.js.

const GAME_STATE_DEFAULTS = {
    // Tower
    towerMaxHealth: 20,
    towerDamage: 6,
    towerAttackRange: 200,
    towerHealthRegen: -0.4,   // HP/sec (negative = drain)

    // Resources
    data: 0,
    insight: 0,

    // EXP (0–100, awards INSIGHT at 100)
    exp: 0,

    // Wave / progression
    currentWave: 1,
    currentTier: 1,

    // First-launch flag — drives AWAKEN-only tree state
    isFirstLaunch: true,

    // Purchased upgrade levels  { nodeId: level }
    upgrades: {},
};
