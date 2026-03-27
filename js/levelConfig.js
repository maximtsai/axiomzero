// js/levelConfig.js — Configuration for all levels in the game.
// Maps a level number to its specific spawn data and multipliers.

const LEVEL_CONFIG = {
    1: {
        spawnInterval: 900, // ms between regular spawns (base)
        initialWeights: {
            basic: 1,
            fast: 0,
            shooter: 0,
            swarmer: 0.06,
            sniper: 0,
            heavy: 0,
            logic_stray: 0,
            protector: 0
        },
        lateWeights: {
            shooter: 0.1,
            swarmer: 0.12,
            heavy: 0,
            fast: 0,
            sniper: 0,
            protector: 0.0
        },
        swarmerGroupSize: { min: 2, max: 5 },
        miniboss: 'Miniboss1', // String identifier for the miniboss type

        mainBoss: 'Boss1',        // Identifier for the main boss
        dataDropMultiplier: 1, // Multiplies the base DATA drop value or chance
        levelScalingModifier: 1, // Scales up *base* stats of enemies before wave scaling applies
        healthDecay: -0.3 // HP/sec (negative = drain)
    },
    2: {
        spawnInterval: 750, // ms between regular spawns (base)
        initialWeights: {
            basic: 1,
            fast: 0,
            shooter: 0.12,
            swarmer: 0.1,
            sniper: 0,
            heavy: 0,
            logic_stray: 0,
            protector: 0
        },
        lateWeights: {
            shooter: 0,
            swarmer: 0.05,
            heavy: 0,
            fast: 0.3,
            sniper: 0,
            protector: 0.0
        },
        swarmerGroupSize: { min: 3, max: 5 },
        miniboss: 'Miniboss2', // String identifier for the miniboss type

        mainBoss: 'Boss2',        // Identifier for the main boss
        dataDropMultiplier: 1.5, // Multiplies the base DATA drop value or chance
        levelScalingModifier: 1.6, // Scales up *base* stats of enemies before wave scaling applies
        healthDecay: -0.4
    },
    3: {
        spawnInterval: 700,
        initialWeights: {
            basic: 1,
            fast: 0.04,
            shooter: 0.2,
            swarmer: 0.13,
            sniper: 0,
            logic_stray: 0,
            protector: 0
        },
        lateWeights: {
            shooter: 0.12,
            swarmer: 0.08,
            heavy: 0.15,
            fast: 0,
            sniper: 0,
            protector: 0.0
        },
        swarmerGroupSize: { min: 3, max: 6 },
        miniboss: 'Miniboss3',

        mainBoss: 'Boss1',
        dataDropMultiplier: 2,
        levelScalingModifier: 2.2,
        healthDecay: -0.5
    },
    4: {
        spawnInterval: 700,
        initialWeights: {
            basic: 1,
            bomb: 0,
            fast: 0,
            shooter: 0,
            swarmer: 0.06,
            sniper: 0,
            heavy: 0.1,
            logic_stray: 0,
            protector: 0.05
        },
        lateWeights: {
            shooter: 0.1,
            swarmer: 0.12,
            bomb: 0,
            heavy: 0.25,
            fast: 0,
            sniper: 0.1,
            protector: 0.12
        },
        swarmerGroupSize: { min: 4, max: 8 },
        miniboss: 'Miniboss4',

        mainBoss: 'Boss5',
        dataDropMultiplier: 3.2,
        levelScalingModifier: 3.2,
        healthDecay: -0.6
    },
    5: {
        spawnInterval: 650,
        initialWeights: {
            basic: 1,
            bomb: 0,
            fast: 0,
            shooter: 0,
            swarmer: 0.06,
            sniper: 0,
            heavy: 0.1,
            logic_stray: 0,
            protector: 0.05
        },
        lateWeights: {
            shooter: 0.1,
            swarmer: 0.12,
            bomb: 0,
            heavy: 0.25,
            fast: 0,
            sniper: 0.1,
            protector: 0.12
        },
        swarmerGroupSize: { min: 4, max: 8 },
        miniboss: 'Miniboss4',

        mainBoss: 'Boss5',
        dataDropMultiplier: 4.2,
        levelScalingModifier: 4.2,
        healthDecay: -0.8
    }
};


/**
 * Helper to get the config for the current level.
 * @param {number} progress - Current wave progress (0 to 1). If > MINIBOSS_SPAWN_PROGRESS + 0.01, lateWeights are used.
 */
function getCurrentLevelConfig(progress = 0) {
    let level = gameState.currentLevel || 1;
    if (!LEVEL_CONFIG[level]) {
        level = getMaxConfiguredLevel();
    }
    const config = LEVEL_CONFIG[level];

    const minibossBeaten = (gameState.minibossLevelsDefeated || 0) >= level;
    const isLatePhase = progress > GAME_CONSTANTS.MINIBOSS_SPAWN_PROGRESS + 0.01;

    // Swap the public probabilities based on wave progress or past victory
    config.enemyProbabilities = ((isLatePhase || minibossBeaten) && config._probs2) ? config._probs2 : config._probs1;

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

function getMaxConfiguredLevel() {
    return Math.max(...Object.keys(LEVEL_CONFIG).map(Number));
}

