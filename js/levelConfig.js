// js/levelConfig.js — Configuration for all levels in the game.
// Maps a level number to its specific spawn data and multipliers.

const LEVEL_CONFIG = {
    1: {
        spawnInterval: 900, // ms between regular spawns (base)
        initialWeights: {
            basic: 0.2,
            fast: 0.3,
            sniper: 0.15,
            swarmer: 0.2,
            logic_stray: 0.15
        },
        lateWeights: {
            shooter: 0.2,
            swarmer: 0.1,
            heavy: 0.25,
            fast: 0.3,
            sniper: 0.15
        },
        swarmerGroupSize: { min: 6, max: 12 },
        miniboss: 'Miniboss1', // String identifier for the miniboss type
        resourceMult: 1,

        mainBoss: null,        // Not yet implemented
        dataDropMultiplier: 1, // Multiplies the base DATA drop value or chance
        levelScalingModifier: 1 // Scales up *base* stats of enemies before wave scaling applies
    }
};

/**
 * Helper to get the config for the current level.
 * @param {number} progress - Current wave progress (0 to 1). If > 0.51, lateWeights are used.
 */
function getCurrentLevelConfig(progress = 0) {
    let level = gameState.currentLevel || 1;
    if (!LEVEL_CONFIG[level]) {
        const maxLevel = Math.max(...Object.keys(LEVEL_CONFIG).map(Number));
        level = maxLevel;
    }
    const config = LEVEL_CONFIG[level];

    // Swap the public probabilities based on wave progress
    config.enemyProbabilities = (progress > 0.51 && config._probs2) ? config._probs2 : config._probs1;

    return config;
}

// ── Normalize Probabilities ──────────────────────────────────────────────
// This runs once at load-time to ensure all weight sets sum to 1.0.
(function _normalizeAllLevels() {
    for (const levelID in LEVEL_CONFIG) {
        const config = LEVEL_CONFIG[levelID];

        // 1. Initial State (Calculated from initialWeights)
        const w1 = config.initialWeights || { basic: 1 };
        config._probs1 = _normalize(w1);

        // 2. Late State (Merge lateWeights over initialWeights, then normalize)
        if (config.lateWeights) {
            const w2 = { ...w1, ...config.lateWeights };
            config._probs2 = _normalize(w2);
        } else {
            config._probs2 = config._probs1;
        }
    }

    function _normalize(weights) {
        let total = 0;
        const result = {};
        for (const key in weights) { total += weights[key] || 0; }

        if (total > 0) {
            for (const key in weights) { result[key] = (weights[key] || 0) / total; }
        } else {
            result.basic = 1;
        }
        return result;
    }
})();
