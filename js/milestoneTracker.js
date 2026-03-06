/**
 * @fileoverview Axiom Zero milestone tracking and achievement system.
 * Subscribes to messageBus events and increments counters automatically.
 * Milestones can be claimed once their target is met.
 * Stats and claimed state persist via gameState.
 *
 * This file is game-specific and intentionally lives in js/ (not js/util/).
 * @module milestoneTracker
 *
 * Usage:
 *   milestoneTracker.init();
 *   milestoneTracker.getStat('totalKills');       // → number
 *   milestoneTracker.getMilestones();              // → [{id, name, ...}]
 *   milestoneTracker.claim('kill_500');             // → reward object or null
 */
const milestoneTracker = (() => {

    // ── Milestone definitions ────────────────────────────────────────────
    // Each milestone: { id, name, description, statKey, target, reward: {type, amount} }
    const milestones = [
        { id: 'kill_100', name: 'First Hundred', description: 'Kill 100 enemies', statKey: 'totalKills', target: 100, reward: { type: 'data', amount: 50 } },
        { id: 'kill_500', name: 'Exterminator', description: 'Kill 500 enemies', statKey: 'totalKills', target: 500, reward: { type: 'data', amount: 200 } },
        { id: 'kill_2000', name: 'Annihilator', description: 'Kill 2000 enemies', statKey: 'totalKills', target: 2000, reward: { type: 'insight', amount: 2 } },
        { id: 'data_1000', name: 'Data Hoarder', description: 'Collect 1,000 DATA total', statKey: 'totalDataCollected', target: 1000, reward: { type: 'data', amount: 100 } },
        { id: 'data_10000', name: 'Data Vault', description: 'Collect 10,000 DATA total', statKey: 'totalDataCollected', target: 10000, reward: { type: 'insight', amount: 3 } },
        { id: 'waves_10', name: 'Veteran', description: 'Complete 10 waves', statKey: 'totalWavesCompleted', target: 10, reward: { type: 'data', amount: 75 } },
        { id: 'waves_50', name: 'Seasoned', description: 'Complete 50 waves', statKey: 'totalWavesCompleted', target: 50, reward: { type: 'insight', amount: 2 } },
        { id: 'nodes_5', name: 'Branching Out', description: 'Purchase 5 nodes', statKey: 'totalNodesPurchased', target: 5, reward: { type: 'data', amount: 50 } },
        { id: 'nodes_15', name: 'Neural Network', description: 'Purchase 15 nodes', statKey: 'totalNodesPurchased', target: 15, reward: { type: 'insight', amount: 1 } },
        { id: 'boss_1', name: 'System Override', description: 'Defeat a boss', statKey: 'bossesDefeated', target: 1, reward: { type: 'data', amount: 300 } },
    ];

    // ── Wave timing ──────────────────────────────────────────────────────
    let waveStartTime = 0;

    // ── Init ─────────────────────────────────────────────────────────────

    function init() {
        messageBus.subscribe('enemyKilled', _onEnemyKilled);
        messageBus.subscribe('currencyChanged', _onCurrencyChanged);
        messageBus.subscribe('waveCompleted', _onWaveCompleted);
        messageBus.subscribe('upgradePurchased', _onUpgradePurchased);
        messageBus.subscribe('bossDefeated', _onBossDefeated);
        messageBus.subscribe('phaseChanged', _onPhaseChanged);
    }

    // ── Event handlers ───────────────────────────────────────────────────

    function _onEnemyKilled() {
        gameState.stats.totalKills++;
    }

    function _onCurrencyChanged(type, amount, delta) {
        if (type === 'data' && delta > 0) {
            gameState.stats.totalDataCollected += delta;
        }
        if (type === 'insight' && delta > 0) {
            gameState.stats.totalInsightEarned += delta;
        }
    }

    function _onWaveCompleted() {
        gameState.stats.totalWavesCompleted++;
        const elapsed = Date.now() - waveStartTime;
        if (elapsed > gameState.stats.longestWaveMs) {
            gameState.stats.longestWaveMs = elapsed;
        }
    }

    function _onUpgradePurchased() {
        gameState.stats.totalNodesPurchased++;
    }

    function _onBossDefeated() {
        gameState.stats.bossesDefeated++;
    }

    function _onPhaseChanged(phase) {
        if (phase === GAME_CONSTANTS.PHASE_COMBAT) {
            waveStartTime = Date.now();
        }

        // Save game data when Deploy is clicked (enters COMBAT), 
        // or when End Iteration happens (enters WAVE_COMPLETE or GAME_OVER)
        if (phase === GAME_CONSTANTS.PHASE_COMBAT ||
            phase === GAME_CONSTANTS.PHASE_WAVE_COMPLETE ||
            phase === GAME_CONSTANTS.PHASE_GAME_OVER ||
            phase === GAME_CONSTANTS.PHASE_UPGRADE) {
            saveGame();
        }
    }

    // ── Public API ───────────────────────────────────────────────────────

    /** @returns {number} Value of a tracked stat, or 0 if unknown key. */
    function getStat(key) {
        return gameState.stats[key] || 0;
    }

    /** Manually increment a stat (for stats not auto-tracked). */
    function incrementStat(key, amount = 1) {
        if (gameState.stats[key] !== undefined) {
            gameState.stats[key] += amount;
        }
    }

    /** @returns {Array} All milestone definitions with current progress attached. */
    function getMilestones() {
        return milestones.map(m => ({
            ...m,
            current: gameState.stats[m.statKey] || 0,
            isComplete: (gameState.stats[m.statKey] || 0) >= m.target,
            claimed: !!gameState.claimed[m.id],
        }));
    }

    /**
     * Claim a completed milestone.
     * @param {string} milestoneId
     * @returns {{ type: string, amount: number } | null} The reward, or null if not claimable.
     */
    function claim(milestoneId) {
        const m = milestones.find(ms => ms.id === milestoneId);
        if (!m || gameState.claimed[m.id]) return null;
        if ((gameState.stats[m.statKey] || 0) < m.target) return null;

        gameState.claimed[m.id] = true;
        return m.reward;
    }

    return { init, getStat, incrementStat, getMilestones, claim };
})();
