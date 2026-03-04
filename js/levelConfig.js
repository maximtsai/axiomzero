// js/levelConfig.js — Configuration for all levels in the game.
// Maps a level number to its specific spawn data and multipliers.

const LEVEL_CONFIG = {
    1: {
        spawnInterval: 900, // ms between regular spawns (base)
        enemyProbabilities: {
            basic: 0.75,
            shooter: 0.25
        },
        miniboss: 'Miniboss1', // String identifier for the miniboss type
        mainBoss: null,        // Not yet implemented
        dataDropMultiplier: 1, // Multiplies the base DATA drop value or chance
        levelScalingModifier: 1 // Scales up *base* stats of enemies before wave scaling applies
    }
};

/**
 * Helper to get the config for the current level.
 * Fallbacks to level 1 (or the highest defined level).
 */
function getCurrentLevelConfig() {
    let level = gameState.currentLevel || 1;
    if (!LEVEL_CONFIG[level]) {
        // Fallback to max defined level if we go boundless
        const maxLevel = Math.max(...Object.keys(LEVEL_CONFIG).map(Number));
        level = maxLevel;
    }
    return LEVEL_CONFIG[level];
}
