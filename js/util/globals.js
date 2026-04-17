/**
 * @fileoverview Generic engine configuration and runtime state.
 * Defines: GAME_CONSTANTS, GAME_VARS, gameOptions, globalObjects, debugLog.
 *
 * Contains ONLY engine-level constants reusable across any Phaser project.
 * Game-specific constants (phase names, colors, tuning values, depth layers)
 * belong in js/gameConfig.js, which extends GAME_CONSTANTS after this file loads.
 *
 * Must be loaded before all other util scripts.
 * @module globals
 */
const GAME_CONSTANTS = {
    // Math
    DEG_TO_RADIAL: 57.296,
    HALF_PI: 1.5708,

    // Loading/Retry
    RETRY_DELAY_BASE: 500,
    MAX_RETRIES: 3,
    WATCHDOG_INTERVAL: 5000,
    SLOW_WARNING_THRESHOLD: 15000,  // ms of silence before showing slow-load warning
    TIMEOUT_THRESHOLD: 25000,       // ms of silence before showing run-anyway button
    INITIAL_PRELOAD_STALL: 20000,

    // Game Dimensions
    WIDTH: 1600,
    HEIGHT: 900,

    // Version
    VERSION: "v.1.0",

    // Loading Visuals
    LOADING_BAR_WIDTH: 250,
    LOADING_BAR_HEIGHT: 4,

    // Timing
    RESIZE_DELAY: 100,
    INTRO_FLASH_DURATION: 500,
};

// Derived dimension shortcuts (computed after declaration to allow self-reference)
GAME_CONSTANTS.halfWidth = GAME_CONSTANTS.WIDTH / 2;
GAME_CONSTANTS.halfHeight = GAME_CONSTANTS.HEIGHT / 2;
GAME_CONSTANTS.quarterWidth = GAME_CONSTANTS.WIDTH / 4;

// ─── Runtime state ────────────────────────────────────────────────────────────

const GAME_VARS = {
    timeScale: 1,
    mouseposx: 0,
    mouseposy: 0,
    mousedown: false,
    mouseJustDowned: false,
    mouseJustUpped: false,
    wasTouch: false,
    gameScale: 1,
    lastmousedown: { x: 0, y: 0 },
    scaleFactor: 1,
    roundTimeElapsed: 0,
};

// ─── User options (persisted to localStorage) ─────────────────────────────────

// OPTIONS_KEY must be defined in gameConfig.js

const GAME_OPTIONS_DEFAULTS = {
    language: 'en',
    sfxVolume: 1,
    musicVolume: 1,
};

const gameOptions = (function () {
    try {
        const raw = localStorage.getItem(OPTIONS_KEY);
        if (raw) return Object.assign({}, GAME_OPTIONS_DEFAULTS, JSON.parse(raw));
    } catch (e) { /* ignore corrupt data */ }
    return Object.assign({}, GAME_OPTIONS_DEFAULTS);
})();

/** Persist current gameOptions to localStorage. */
function saveGameOptions() {
    try {
        localStorage.setItem(OPTIONS_KEY, JSON.stringify(gameOptions));
    } catch (e) {
        console.error('saveGameOptions failed:', e);
    }
}

// ─── Shared object registry ───────────────────────────────────────────────────

const globalObjects = {};

// ─── Debug (defined here for early availability before other util scripts) ────

/** Log to console only when FLAGS.DEBUG is true. */
function debugLog(...args) {
    if (!FLAGS.DEBUG) return;
    console.log('[DEBUG]', ...args);
}
