// Game Globals - Centralized configuration values
const GAME_CONSTANTS = {
    // Loading/Retry
    RETRY_DELAY_BASE: 500,
    MAX_RETRIES: 3,
    WATCHDOG_INTERVAL: 5000,
    SLOW_WARNING_THRESHOLD: 15000,  // ms of silence before showing slow-load warning
    TIMEOUT_THRESHOLD: 25000,       // ms of silence before showing run-anyway button
    INITIAL_PRELOAD_STALL: 20000,

    // Game Dimensions
    WIDTH: 1280,
    HEIGHT: 720,

    // Version
    VERSION: "v.1.0",

    // Loading Visuals
    LOADING_BAR_WIDTH: 200,
    LOADING_BAR_HEIGHT: 3,

    // Timing
    RESIZE_DELAY: 100,
    INTRO_FLASH_DURATION: 500,

    // ─── Phase 1 gameplay constants ──────────────────────────────────────────

    // Colors (GDD §4)
    COLOR_BG:        0x05080f,
    COLOR_FRIENDLY:  0x00f5ff,
    COLOR_RESOURCE:  0xff9500,
    COLOR_HOSTILE:   0xff2d78,
    COLOR_STRAY:     0xffe600,

    // Tower
    TOWER_BASE_HEALTH:      20,
    TOWER_BASE_DAMAGE:      6,
    TOWER_ATTACK_RANGE:     350,
    TOWER_ATTACK_COOLDOWN:  1000,   // ms between auto-attacks
    TOWER_BASE_REGEN:       -0.4,     // HP/sec (negative = drain)

    // EXP
    EXP_FILL_RATE:    0.2,    // per second during combat
    EXP_TO_INSIGHT:   100,  // EXP needed to award 1 INSIGHT

    // Enemy — Basic type (Phase 1 only)
    ENEMY_SPAWN_MARGIN:    60,    // px outside screen edge
    ENEMY_BASE_HEALTH:     10,
    ENEMY_BASE_DAMAGE:     2,
    ENEMY_BASE_SPEED:      60,    // px/sec
    ENEMY_CONTACT_RADIUS:  30,    // px — deals damage & dies when this close to tower
    ENEMY_SPAWN_INTERVAL:  1500,  // ms between spawns
    ENEMY_SCALE_RATE:      0.02,  // health/damage multiplier increase per second

    // DATA drops
    DATA_DROP_CHANCE:   0.6,
    DATA_PICKUP_RADIUS: 100,   // px — cursor auto-collects within this
    DATA_DECAY_TIME:    12000, // ms before uncollected drop fades away
    DATA_DRIFT_SPEED:   8,    // px/sec downward drift

    // Projectile
    PROJECTILE_SPEED:      400,  // px/sec
    PROJECTILE_HIT_RADIUS: 15,

    // Transition
    TRANSITION_DURATION: 800,  // ms for slide animation

    // Depth layers (flat ordering, no Containers)
    DEPTH_BG:             0,
    DEPTH_GLOW:           50,
    DEPTH_ENEMIES:        100,
    DEPTH_TOWER:          200,
    DEPTH_PROJECTILES:    300,
    DEPTH_RESOURCES:      400,
    DEPTH_HUD:            1000,
    DEPTH_NEURAL_TREE:    2000,
    DEPTH_DEATH_OVERLAY:  3000,  // death flash — covers entire game
    DEPTH_DEATH_TOWER:    3500,  // tower elevated above death overlay during shake
    DEPTH_TRANSITION:     5000,
    DEPTH_ITERATION_OVER: 6000,
    DEPTH_POPUPS:         10000,
};

// Derived dimension shortcuts (computed after declaration to allow self-reference)
GAME_CONSTANTS.halfWidth  = GAME_CONSTANTS.WIDTH  / 2;
GAME_CONSTANTS.halfHeight = GAME_CONSTANTS.HEIGHT / 2;

// ─── Runtime state ────────────────────────────────────────────────────────────

const GAME_VARS = {
    timeScale:       1,
    mouseposx:       0,
    mouseposy:       0,
    mousedown:       false,
    mouseJustDowned: false,
    mouseJustUpped:  false,
    wasTouch:        false,
    canvasXOffset:   0,
    canvasYOffset:   0,
    gameScale:       1,
    lastmousedown:   { x: 0, y: 0 },
};

// ─── User options (persisted to localStorage) ─────────────────────────────────

const OPTIONS_KEY = 'axiomzero_options';

const GAME_OPTIONS_DEFAULTS = {
    language:     'en',
    sfxVolume:    1,
    musicVolume:  1,
};

const gameOptions = (function () {
    try {
        const raw = localStorage.getItem(OPTIONS_KEY);
        if (raw) return Object.assign({}, GAME_OPTIONS_DEFAULTS, JSON.parse(raw));
    } catch (e) { /* ignore corrupt data */ }
    return Object.assign({}, GAME_OPTIONS_DEFAULTS);
})();

function saveGameOptions() {
    try {
        localStorage.setItem(OPTIONS_KEY, JSON.stringify(gameOptions));
    } catch (e) {
        console.error('saveGameOptions failed:', e);
    }
}

// ─── Shared object registry ───────────────────────────────────────────────────

const globalObjects = {};

// ─── Debug (defined here for early availability before utilities.js loads) ────

function debugLog(...args) {
    if (!FLAGS.DEBUG) return;
    console.log('[DEBUG]', ...args);
}
