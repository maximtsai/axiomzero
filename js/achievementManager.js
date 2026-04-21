// js/achievementManager.js
// Silently tracks and unlocks achievements based on player statistics and events.
// Structured for future Steam integration.

const achievementManager = (() => {
    // Achievement IDs matching Steam requirements (unique strings)
    const ACHIEVEMENTS = {
        FIRST_ITERATION: 'FIRST_ITERATION', // End your first iteration
        HEAVY_HITTER: 'HEAVY_HITTER',       // Deal 100+ damage in one hit
        BOSS_SLAYER_1: 'BOSS_SLAYER_1',     // Defeat the first boss
        CENTURION: 'CENTURION'              // Kill 100 enemies total
    };

    function init() {
        if (typeof FLAGS === 'undefined' || !FLAGS.IS_EXE) {
            // Achievement tracking only enabled for PC/Executable builds
            return;
        }

        // Subscribe to relevant events
        messageBus.subscribe('phaseChanged', _onPhaseChanged);
        messageBus.subscribe('100DamageDealt', _onDamageDealt);
        messageBus.subscribe('bossDefeated', _onBossDefeated);
        messageBus.subscribe('enemyKilled', _onEnemyKilled);
        
        debugLog('Achievement Manager initialized');
    }

    /** Unlocks an achievement if not already unlocked. */
    function unlock(achievementId) {
        if (!gameState.achievements) {
            gameState.achievements = {};
        }

        if (gameState.achievements[achievementId]) {
            return; // Already unlocked
        }

        gameState.achievements[achievementId] = true;
        
        // Log internally (can be hooked to Steam API later)
        console.log(`%c ACHIEVEMENT UNLOCKED: ${achievementId} `, 'background: #222; color: #bada55; font-weight: bold;');
        
        // Persist the unlock immediately
        saveGame();
    }

    // ── Event Handlers ───────────────────────────────────────────────────

    function _onPhaseChanged(phase) {
        if (phase === GAME_CONSTANTS.PHASE_WAVE_COMPLETE) {
            // "Iteration Over" screen appeared
            if (gameState.stats.totalIterationsEnded >= 1) {
                unlock(ACHIEVEMENTS.FIRST_ITERATION);
            }
        }
    }

    function _onDamageDealt(amount) {
        if (amount >= 100) {
            unlock(ACHIEVEMENTS.HEAVY_HITTER);
        }
    }

    function _onBossDefeated() {
        // Milestone tracker and stats update before this usually, 
        // but we can check if bossesDefeated >= 1
        if (gameState.stats.bossesDefeated >= 1) {
            unlock(ACHIEVEMENTS.BOSS_SLAYER_1);
        }
    }

    function _onEnemyKilled() {
        if (gameState.stats.totalKills >= 100) {
            unlock(ACHIEVEMENTS.CENTURION);
        }
    }

    return {
        init,
        unlock,
        ACHIEVEMENTS
    };
})();
