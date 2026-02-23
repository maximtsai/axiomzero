// Game Globals - Centralized configuration values
const GAME_CONSTANTS = {
    // Loading/Retry
    RETRY_DELAY_BASE: 500,
    MAX_RETRIES: 3,
    STALL_THRESHOLD: 20000,
    WATCHDOG_INTERVAL: 5000,
    TIMEOUT_THRESHOLD: 30000,
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
    INTRO_FLASH_DURATION: 500
};

// Derived dimension shortcuts (computed after declaration to allow self-reference)
GAME_CONSTANTS.halfWidth  = GAME_CONSTANTS.WIDTH  / 2;
GAME_CONSTANTS.halfHeight = GAME_CONSTANTS.HEIGHT / 2;

// ─── Runtime state ────────────────────────────────────────────────────────────

var GAME_VARS = {
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

// ─── Shared object registry ───────────────────────────────────────────────────

const globalObjects = {};
