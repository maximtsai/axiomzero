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

GAME_CONSTANTS.COLOR_BG = 0x05070a;
GAME_CONSTANTS.COLOR_FRIENDLY = 0x00f5ff;
GAME_CONSTANTS.COLOR_RESOURCE = 0xff9500;
GAME_CONSTANTS.COLOR_HOSTILE = 0xff2e63;
GAME_CONSTANTS.COLOR_STRAY = 0xffe600;
GAME_CONSTANTS.HEALTH_BAR_TINT = 0x1a1e2e;
GAME_CONSTANTS.COLOR_NEUTRAL = '#e2e8f0';

// ─── Tower ────────────────────────────────────────────────────────────────────

GAME_CONSTANTS.TOWER_BASE_HEALTH = 10;
GAME_CONSTANTS.TOWER_BASE_DAMAGE = 0;
GAME_CONSTANTS.TOWER_ATTACK_RANGE = 230;
GAME_CONSTANTS.TOWER_ATTACK_COOLDOWN = 1000;  // ms between auto-attacks


// ─── EXP ──────────────────────────────────────────────────────────────────────

GAME_CONSTANTS.EXP_FILL_RATE = 0.66;   // per second during combat
GAME_CONSTANTS.EXP_TO_INSIGHT = 100;  // EXP needed to award 1 INSIGHT

// ─── Enemy — Basic type (Phase 1) ─────────────────────────────────────────────

GAME_CONSTANTS.ENEMY_SPAWN_DISTANCE = 1000;  // px from center of screen
GAME_CONSTANTS.ENEMY_BASE_HEALTH = 6;
GAME_CONSTANTS.ENEMY_BASE_DAMAGE = 2;
GAME_CONSTANTS.ENEMY_BASE_SPEED = 30;    // px/sec
GAME_CONSTANTS.ENEMY_CONTACT_RADIUS = 30;    // px — deals damage & dies at tower
GAME_CONSTANTS.ENEMY_SCALE_RATE = 1.08;  // Multiplicative multiplier applied every interval
GAME_CONSTANTS.ENEMY_SCALE_INTERVAL = 6; // seconds between scaling jumps
GAME_CONSTANTS.PROTECTOR_AURA_RANGE = 195;
GAME_CONSTANTS.PROTECTOR_AURA_SQUARED = 38025; // 195 * 195


// ─── DATA drops ───────────────────────────────────────────────────────────────

GAME_CONSTANTS.DATA_PICKUP_RADIUS = 75;  // px — cursor auto-collects within this

// ─── Projectile ───────────────────────────────────────────────────────────────

GAME_CONSTANTS.PROJECTILE_SPEED = 600;  // 50% faster (px/sec)
GAME_CONSTANTS.ENEMY_PROJECTILE_SPEED = 400; // px/sec
GAME_CONSTANTS.PROJECTILE_HIT_RADIUS = 15;

// ─── Enemy Scaling ────────────────────────────────────────────────────────────

GAME_CONSTANTS.ENEMY_DAMAGE_SCALING_EFFICIENCY = 0.5;

// ─── Miniboss / Boss ──────────────────────────────────────────────────────────

GAME_CONSTANTS.MINIBOSS_SPAWN_PROGRESS = 0.5651; // wave percentage (0-1)

// ─── Upgrade Tree ──────────────────────────────────────────────────────────────

GAME_CONSTANTS.TREE_DRAG_MIN_X = 0;
GAME_CONSTANTS.TREE_DRAG_MAX_X = 0;
GAME_CONSTANTS.TREE_DRAG_MIN_Y = 0;
GAME_CONSTANTS.TREE_DRAG_MAX_Y = 500;

GAME_CONSTANTS.MINIBOSS_SPAWN_DISTANCE = 1000;  // px from center
GAME_CONSTANTS.MINIBOSS_SPAWN_ANGLE = 60;    // degrees — ±30° from horizontal

GAME_CONSTANTS.ENEMY_BULLET_HIT_RADIUS = 15;
GAME_CONSTANTS.ENEMY_BULLET_POOL_SIZE = 20;

// ─── Wave ─────────────────────────────────────────────────────────────────────

GAME_CONSTANTS.WAVE_DURATION = 50;  // seconds — progress bar fills over this period

// ─── Depth layers (flat ordering, no Containers) ──────────────────────────────

GAME_CONSTANTS.DEPTH_BG = -3;
GAME_CONSTANTS.DEPTH_GLOW = 50;
GAME_CONSTANTS.DEPTH_ENEMIES = 100;
GAME_CONSTANTS.DEPTH_TOWER = 200;
GAME_CONSTANTS.DEPTH_PROJECTILES = 300;
GAME_CONSTANTS.DEPTH_RESOURCES = 400;
GAME_CONSTANTS.DEPTH_HUD = 1000;
GAME_CONSTANTS.DEPTH_UPGRADE_TREE = 2000;
GAME_CONSTANTS.DEPTH_DEATH_OVERLAY = 3000;  // death flash — covers entire game
GAME_CONSTANTS.DEPTH_DEATH_TOWER = 3500;  // tower elevated above overlay during shake
GAME_CONSTANTS.DEPTH_TRANSITION = 5000;
GAME_CONSTANTS.DEPTH_ITERATION_OVER = 6000;
GAME_CONSTANTS.DEPTH_POPUPS = 10000;

// ─── Transitions ──────────────────────────────────────────────────────────────

GAME_CONSTANTS.TRANSITION_DURATION = 600;  // ms — camera slide duration


// ─── Audio Transitions ────────────────────────────────────────────────────────

GAME_CONSTANTS.AUDIO_TRANSITIONS = {
    BOSS: {
        assetKey: 'boss_music',
        fadeOutDuration: 1200,
        fadeOutEase: 'Linear',
        fadeInDelay: 800,
        fadeInDuration: 800,
        targetVolume: 1.0,
        restoreDelay: 300,
        restoreDuration: 600
    }
};

// ─── Save / persistence keys ──────────────────────────────────────────────────
// Consumed by js/util/gameState.js — kept here so renaming for a new project
// only requires editing this file.

const SAVE_KEY = 'axiomzero_save';
const OPTIONS_KEY = 'axiomzero_options';
const SAVE_VERSION = 2;

// ─── Default game state shape ─────────────────────────────────────────────────
// Consumed by js/util/gameState.js and gameInit.js.

const GAME_STATE_DEFAULTS = {
    // Tower
    towerMaxHealth: 10,
    towerDamage: 6,
    towerAttackRange: 230,
    towerHealthRegen: 0,   // Now driven by per-level healthDecay property

    // Resources
    data: 0,
    insight: 0,
    shard: 0,
    processor: 0,
    coin: 0,

    // EXP (0–100, awards INSIGHT at 100)
    exp: 0,

    // Wave / progression
    currentLevel: 1,
    currentWave: 1,

    // First-launch flag — drives AWAKEN-only tree state
    isFirstLaunch: true,

    // Purchased upgrade levels  { nodeId: level }
    upgrades: {},

    // Duo-Box system
    activeShards: {},      // { tierNum: 'shardId' } — which shard node is active per tier
    duoBoxPurchased: {},   // { tierNum: true } — has player purchased either node in this tier's duo-box?
    revealedNodes: {},     // { nodeId: true } — special events can reveal part of the tree
    levelsDefeated: 0,     // highest boss level defeated
    minibossLevelsDefeated: 0, // highest miniboss level defeated

    // Lifetime Stats
    stats: {
        totalKills: 0,
        totalDataCollected: 0,
        totalInsightEarned: 0,
        totalShardsCollected: 0,
        totalProcessorsCollected: 0,
        totalCoinsCollected: 0,
        totalWavesCompleted: 0,
        totalNodesPurchased: 0,
        longestWaveMs: 0,
        bossesDefeated: 0,
    },

    // Claimed Milestones
    claimed: {},
    tutorialsSeen: {},

    // Settings
    settings: {
        globalVolume: 1.0,
        globalMusicVol: 1.0,
        sfxMuted: false,
        musicMuted: false,
        chromaticAberration: true,
        showDamageNumbers: true,
        minimalParticles: false,
        bigFont: false
    }
};
