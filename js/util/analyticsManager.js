/**
 * analyticsManager.js - Handles communication with Google Analytics (GA4).
 * Provides a safe wrapper for tracking game events and ensures the game doesn't 
 * break if analytics are blocked by the browser.
 */
const analyticsManager = (() => {
    // Automatically disable tracking on localhost to prevent skewed data
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const IS_ENABLED = !isLocal;

    /**
     * Sends an event to Google Analytics.
     */
    function trackEvent(eventName, params = {}) {
        if (!IS_ENABLED) return;

        if (typeof gtag !== 'undefined') {
            try {
                gtag('event', eventName, params);
            } catch (e) {
                // Silently fail to avoid breaking gameplay
            }
        }
    }

    // ── Internal Subscriptions ───────────────────────────────────────────

    function init() {
        if (typeof messageBus !== 'undefined') {
            // Track every upgrade purchased
            messageBus.subscribe('upgradePurchased', (data) => {
                if (data && data.id) {
                    trackNodePurchase(data.id, data.level, data.costType, data.cost);
                }
            });

            // Track boss and miniboss deaths
            messageBus.subscribe('enemyKilled', (data) => {
                if (data && (data.isBoss || data.isMiniboss)) {
                    trackBossDefeat(data.id, gameState.wave, data.isMiniboss ? 'miniboss' : 'boss');
                }
            });

            // Track wave completion
            messageBus.subscribe('waveCompleted', () => {
                const totalIterations = (gameState.stats && gameState.stats.totalIterationsEnded) || 0;
                const dataEarned = (typeof resourceManager !== 'undefined') ? resourceManager.getSessionData() : 0;
                
                // Collect active duo nodes (shards)
                const duoNodes = Object.values(gameState.activeShards || {});
                
                trackWaveComplete(gameState.wave, totalIterations, dataEarned, duoNodes);
            });

        }
    }

    /**
     * Tracks a node purchase in the upgrade tree.
     * @param {string} nodeId - The ID of the node purchased.
     * @param {number} level - The level purchased.
     * @param {string} costType - 'data', 'shard', or 'insight'.
     * @param {number} cost - The resource amount spent.
     */
    function trackNodePurchase(nodeId, level, costType, cost) {
        trackEvent('node_purchase', {
            node_id: nodeId,
            level: level,
            cost_type: costType,
            cost: cost
        });
    }

    /**
     * Tracks when a wave is completed.
     * @param {number} waveNumber - The wave index just finished.
     * @param {number} totalIterations - Lifetime iterations ended.
     * @param {number} dataEarned - DATA collected this run.
     * @param {Array} duoNodes - Array of active duo node IDs.
     */
    function trackWaveComplete(waveNumber, totalIterations, dataEarned, duoNodes) {
        trackEvent('iteration_complete', {
            level: waveNumber,
            lifetime_iterations: totalIterations,
            data_earned: dataEarned,
            active_duo_nodes: duoNodes
        });
    }

    /**
     * Tracks the defeat of a boss or miniboss.
     * @param {string} enemyId - The ID of the boss.
     * @param {number} wave - The current wave.
     * @param {string} type - 'boss' or 'miniboss'
     */
    function trackBossDefeat(enemyId, wave, type = 'boss') {
        trackEvent('boss_defeated', {
            enemy_id: enemyId,
            wave: wave,
            enemy_type: type
        });
    }

    /**
     * Tracks when the tower dies.
     * @param {number} wave - The wave reached.
     * @param {number} lifetimeData - Total data collected this run.
     */
    function trackGameOver(wave, lifetimeData) {
        trackEvent('game_over', {
            wave_reached: wave,
            total_data: lifetimeData
        });
    }

    return {
        init,
        trackEvent,
        trackNodePurchase,
        trackWaveComplete,
        trackBossDefeat,
        trackGameOver
    };
})();

// Automatically initialize the manager when loaded
analyticsManager.init();
