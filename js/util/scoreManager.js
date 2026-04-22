// js/util/scoreManager.js
// Optimized local high score tracking for endless/farming levels.
// Grabs final stats from enemyManager only at the end of a session.

const scoreManager = (() => {
    let isFarming = false;
    let currentLevel = 1;

    /**
     * Initialize listeners for starting and stopping farming sessions.
     */
    function init() {
        messageBus.subscribe('waveModeFarmingStarted', () => {
            isFarming = true;
            currentLevel = gameState.currentLevel || 1;
        });

        // Finalize when combat ends — PHASE_WAVE_COMPLETE is the guaranteed exit
        // for ALL paths (tower death, END ITERATION, and RETRY all pass through it).
        // Using PHASE_UPGRADE instead would miss the END ITERATION → RETRY path.
        messageBus.subscribe('phaseChanged', (phase) => {
            if (phase === GAME_CONSTANTS.PHASE_WAVE_COMPLETE && isFarming) {
                _finalizeSession();
            }
        });

        // towerDied fires before PHASE_WAVE_COMPLETE during the death sequence,
        // so we finalize here too — the isFarming guard prevents double-finalization.
        messageBus.subscribe('towerDied', () => {
            if (isFarming) {
                _finalizeSession();
            }
        });
        
        // Ensure localBestScores object exists in gameState
        if (typeof gameState !== 'undefined' && !gameState.localBestScores) {
            gameState.localBestScores = {};
        }
    }

    /**
     * Fetch final results from enemyManager and persist if it's a new personal best.
     */
    function _finalizeSession() {
        if (!isFarming) return;
        isFarming = false;

        if (typeof enemyManager === 'undefined') return;

        // Efficiently grab final numbers from enemyManager instead of counting every kill event
        const timeSurvived = enemyManager.getRoundTimeElapsed();
        const finalKills = enemyManager.getSessionKills();

        _persistBest(currentLevel, timeSurvived, finalKills);
    }

    /**
     * Persist a score if it's better than the current best (primary metric: time).
     */
    function _persistBest(levelId, time, kills) {
        if (typeof gameState === 'undefined') return;
        if (!gameState.localBestScores) gameState.localBestScores = {};

        const existing = gameState.localBestScores[levelId] || { bestTime: 0, kills: 0 };
        
        if (time > existing.bestTime) {
            gameState.localBestScores[levelId] = {
                bestTime: time,
                kills: kills,
                date: Date.now()
            };
            
            if (typeof saveGame === 'function') {
                saveGame();
            }
        }
    }

    /**
     * Retrieve the best score for a level.
     */
    function getBestScore(levelId) {
        if (typeof gameState === 'undefined' || !gameState.localBestScores) return null;
        return gameState.localBestScores[levelId] || null;
    }

    /**
     * Format seconds into MM:SS format.
     */
    function formatTime(seconds) {
        return helper.formatTime(seconds);
    }

    return {
        init,
        getBestScore,
        formatTime
    };
})();
