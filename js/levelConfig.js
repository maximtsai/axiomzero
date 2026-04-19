// js/levelConfig.js — Configuration for all levels in the game.
// Maps a level number to its specific spawn data and multipliers.

const LEVEL_CONFIG = {
    1: {
        spawnInterval: 1100, // ms between regular spawns (base)
        lateSpawnInterval: 750,
        initialWeights: {
            basic: 1,
            fast: 0,
            shooter: 0,
            swarmer: 0.05,
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
            cache: 0.003,
            protector: 0.0
        },
        swarmerGroupSize: { min: 2, max: 5 },
        miniboss: 'Miniboss1', // String identifier for the miniboss type

        mainBoss: 'BossCircle',        // Identifier for the main boss
        dataDropMultiplier: 1, // Multiplies the base DATA drop value or chance
        levelScalingModifier: 1, // Scales up *base* stats of enemies before wave scaling applies
    },
    2: {
        spawnInterval: 600, // ms between regular spawns (base)
        lateSpawnInterval: 600,
        spawnPauseDuration: 1500,
        initialWeights: {
            basic: 1,
            fast: 0,
            shooter: 0.12,
            swarmer: 0.1,
            sniper: 0,
            heavy: 0,
            logic_stray: 0,
            cache: 0,
            protector: 0
        },
        lateWeights: {
            shooter: 0,
            swarmer: 0.05,
            heavy: 0,
            fast: 0.175,
            sniper: 0,
            cache: 0.005,
            protector: 0.0
        },
        swarmerGroupSize: { min: 3, max: 5 },
        miniboss: 'Miniboss2', // String identifier for the miniboss type

        mainBoss: 'Boss2',        // Identifier for the main boss
        dataDropMultiplier: 1.3, // Multiplies the base DATA drop value or chance
        levelScalingModifier: 1.5, // Scales up *base* stats of enemies before wave scaling applies
    },
    3: {
        spawnInterval: 550, // ms between regular spawns (base)
        lateSpawnInterval: 190,
        spawnPauseDuration: 4000,
        initialWeights: {
            basic: 1,
            fast: 0.04,
            shooter: 0.2,
            swarmer: 0.13,
            sniper: 0,
            logic_stray: 0,
            cache: 0.008,
            protector: 0
        },
        lateWeights: {
            shooter: 0,
            swarmer: 0.1,
            heavy: 0.1,
            fast: 0.05,
            sniper: 0,
            cache: 0.01,
            protector: 0.0
        },
        swarmerGroupSize: { min: 3, max: 6 },
        miniboss: 'Miniboss3',

        mainBoss: 'Boss3',
        dataDropMultiplier: 1.6,
        levelScalingModifier: 2.1,
    },
    4: {
        spawnInterval: 550, // ms between regular spawns (base)
        lateSpawnInterval: 600,
        initialWeights: {
            basic: 1,
            exploder: 0,
            fast: 0,
            shooter: 0,
            swarmer: 0.06,
            sniper: 0,
            heavy: 0.1,
            logic_stray: 0,
            cache: 0.02,
            protector: 0.05
        },
        lateWeights: {
            shooter: 0.1,
            swarmer: 0.12,
            exploder: 0,
            heavy: 0.25,
            fast: 0,
            sniper: 0.1,
            cache: 0.02,
            protector: 0.12
        },
        swarmerGroupSize: { min: 4, max: 8 },
        miniboss: 'Miniboss4',

        mainBoss: 'Boss5',
        dataDropMultiplier: 2,
        levelScalingModifier: 3,
    },
    5: {
        spawnInterval: 550,
        initialWeights: {
            basic: 1,
            exploder: 0,
            fast: 0,
            shooter: 0,
            swarmer: 0.06,
            sniper: 0,
            heavy: 0.1,
            logic_stray: 0,
            cache: 0.05,
            protector: 0.05
        },
        lateWeights: {
            shooter: 0.1,
            swarmer: 0.12,
            exploder: 0,
            heavy: 0.25,
            fast: 0,
            sniper: 0.1,
            cache: 0.025,
            protector: 0.12
        },
        swarmerGroupSize: { min: 4, max: 8 },
        miniboss: 'Miniboss4',

        mainBoss: 'Boss5',
        dataDropMultiplier: 2.5,
        levelScalingModifier: 4.2,
    }
};


/**
 * Helper to get the config for the current level.
 * @param {number} progress - Current wave progress (0 to 1). If > MINIBOSS_SPAWN_PROGRESS + 0.01, lateWeights are used.
 * @param {number} subWaveIndex - Optional index to pick a specific sub-wave composition.
 */
function getCurrentLevelConfig(progress = 0, subWaveIndex = -1) {
    let level = gameState.currentLevel || 1;
    if (!LEVEL_CONFIG[level]) {
        level = getMaxConfiguredLevel();
    }
    const config = LEVEL_CONFIG[level];

    // If progress is not passed, try to fetch it from the wave manager
    if (progress === 0 && typeof waveManager !== 'undefined' && waveManager.getProgress) {
        progress = waveManager.getProgress();
    }

    const minibossBeaten = (gameState.minibossLevelsDefeated || 0) >= level;
    const levelBeaten = (gameState.levelsDefeated || 0) >= level;
    const isLatePhase = progress > (GAME_CONSTANTS.MINIBOSS_SPAWN_PROGRESS || 0.5) + 0.005;

    // Force late state if we are in endless farming mode (level already beaten in past iteration)
    const useLateState = isLatePhase || minibossBeaten || levelBeaten;

    // Swap probabilities based on sub-wave index, miniboss progress, or past victory
    if (subWaveIndex >= 0 && config._subProbs && config._subProbs.length > 0) {
        const sIdx = subWaveIndex % config._subProbs.length;
        config.enemyProbabilities = config._subProbs[sIdx];
    } else {
        config.enemyProbabilities = (useLateState && config._probs2) ? config._probs2 : config._probs1;
    }

    // Tempo logic: Use lateSpawnInterval if we are in Farming Mode OR if lateWeights are active (useLateState)
    const isLateTempo = useLateState || progress > 0.095;
    if (isLateTempo && config.lateSpawnInterval !== undefined) {
        config.spawnInterval = config.lateSpawnInterval;
    } else {
        config.spawnInterval = config._initialSpawnInterval || config.spawnInterval;
    }

    return config;
}

// ── Normalize Probabilities ──────────────────────────────────────────────
// This runs once at load-time to ensure all weight sets sum to 1.0.
(function _normalizeAllLevels() {
    for (const levelID in LEVEL_CONFIG) {
        const config = LEVEL_CONFIG[levelID];

        // Store the original spawnInterval to allow switching back
        config._initialSpawnInterval = config.spawnInterval;

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

        // 3. Sub-waves (Normalize each defined sub-wave)
        if (config.subWaves && config.subWaves.length > 0) {
            config._subProbs = config.subWaves.map(sw => {
                // Merge sub-wave weights over initial weights, but ONLY if initial weight > 0
                const combined = { ...w1 };
                for (const key in sw) {
                    if (w1[key] > 0) {
                        combined[key] = sw[key];
                    }
                }
                return _normalize(combined);
            });
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

