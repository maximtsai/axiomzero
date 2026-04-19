// flags.js — top-level feature flags, loaded before everything else.
// Edit these to toggle platform/behaviour switches without touching game code.

const FLAGS = {
    // Set true when deploying to CrazyGames to enable SDK init, mute sync, etc.
    USING_CRAZYGAMES_SDK: false,

    // Set true for standalone PC builds (.exe) or local electron shells.
    // When false, the game behaves as a web build (allowing mobile detection, etc.)
    IS_EXE: false,

    // Set true locally to enable the FPS overlay and verbose console logging.
    // Always leave false in production builds.
    DEBUG: true,

    // Set true to enable the Service Worker for dynamic asset caching.
    // On repeat visits, all previously loaded files are served from local cache
    // instead of the network — making load times significantly faster.
    // Leave false during active development to avoid stale-cache issues.
    USE_SERVICE_WORKER: false,
};
