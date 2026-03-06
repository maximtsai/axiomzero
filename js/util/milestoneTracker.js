/**
 * @fileoverview Cumulative stat tracking and milestone system.
 * Subscribes to messageBus events and increments counters automatically.
 * Milestones can be claimed once their target is met.
 * Stats and claimed state persist via gameState.
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
        _autoSave();
    }

    function _onCurrencyChanged(type, amount, delta) {
        if (type === 'data' && delta > 0) {
            gameState.stats.totalDataCollected += delta;
            _autoSave();
        }
        if (type === 'insight' && delta > 0) {
            gameState.stats.totalInsightEarned += delta;
            _autoSave();
        }
        if (type === 'shard' && delta > 0) {
            gameState.stats.totalShardsCollected += delta;
            _autoSave();
        }
        if (type === 'processor' && delta > 0) {
            gameState.stats.totalProcessorsCollected += delta;
            _autoSave();
        }
        if (type === 'coin' && delta > 0) {
            gameState.stats.totalCoinsCollected += delta;
            _autoSave();
        }
    }

    function _onWaveCompleted() {
        gameState.stats.totalWavesCompleted++;
        const elapsed = Date.now() - waveStartTime;
        if (elapsed > gameState.stats.longestWaveMs) {
            gameState.stats.longestWaveMs = elapsed;
        }
        _autoSave();
    }

    function _onUpgradePurchased() {
        gameState.stats.totalNodesPurchased++;
        _autoSave();
    }

    function _onBossDefeated() {
        gameState.stats.bossesDefeated++;
        _autoSave();
    }

    function _onPhaseChanged(phase) {
        if (phase === GAME_CONSTANTS.PHASE_COMBAT) {
            waveStartTime = Date.now();
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
            _autoSave();
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
        saveGame();
        return m.reward;
    }

    // ── Persistence ──────────────────────────────────────────────────────

    let saveTimer = 0;
    function _autoSave() {
        // Throttle saves to avoid excessive localStorage writes
        const now = Date.now();
        if (now - saveTimer < 2000) return;
        saveTimer = now;
        saveGame();
    }

    return { init, getStat, incrementStat, getMilestones, claim };
})();
