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
        { id: 'kill_100', name: t('milestones', 'kill_100.name'), description: t('milestones', 'kill_100.desc'), statKey: 'kills', target: 100, reward: { type: 'data', amount: 50 } },
        { id: 'kill_500', name: t('milestones', 'kill_500.name'), description: t('milestones', 'kill_500.desc'), statKey: 'kills', target: 500, reward: { type: 'data', amount: 200 } },
        { id: 'kill_2000', name: t('milestones', 'kill_2000.name'), description: t('milestones', 'kill_2000.desc'), statKey: 'kills', target: 2000, reward: { type: 'insight', amount: 2 } },
        { id: 'data_1000', name: t('milestones', 'data_1000.name'), description: t('milestones', 'data_1000.desc'), statKey: 'dataColl', target: 1000, reward: { type: 'data', amount: 100 } },
        { id: 'data_10000', name: t('milestones', 'data_10000.name'), description: t('milestones', 'data_10000.desc'), statKey: 'dataColl', target: 10000, reward: { type: 'insight', amount: 3 } },
        { id: 'waves_10', name: t('milestones', 'waves_10.name'), description: t('milestones', 'waves_10.desc'), statKey: 'waveComp', target: 10, reward: { type: 'data', amount: 75 } },
        { id: 'waves_50', name: t('milestones', 'waves_50.name'), description: t('milestones', 'waves_50.desc'), statKey: 'waveComp', target: 50, reward: { type: 'insight', amount: 2 } },
        { id: 'nodes_5', name: t('milestones', 'nodes_5.name'), description: t('milestones', 'nodes_5.desc'), statKey: 'nodePurch', target: 5, reward: { type: 'data', amount: 50 } },
        { id: 'nodes_15', name: t('milestones', 'nodes_15.name'), description: t('milestones', 'nodes_15.desc'), statKey: 'nodePurch', target: 15, reward: { type: 'insight', amount: 1 } },
        { id: 'bossSquare', name: t('milestones', 'bossSquare.name'), description: t('milestones', 'bossSquare.desc'), statKey: 'bossDef', target: 1, reward: { type: 'data', amount: 300 } },
    ];

    // ── Wave timing ──────────────────────────────────────────────────────
    let waveStartTime = 0;

    // ── Init ─────────────────────────────────────────────────────────────

    function init() {
        messageBus.subscribe('enemyKilled', _onEnemyKilled);
        messageBus.subscribe('waveComplete', _onWaveCompleted);
        messageBus.subscribe('upgradePurchased', _onUpgradePurchased);
        messageBus.subscribe('bossDefeated', _onBossDefeated);
        messageBus.subscribe('phaseChanged', _onPhaseChanged);
        messageBus.subscribe('currencyChanged', _onCurrencyChanged);
    }

    // ── Event handlers ───────────────────────────────────────────────────

    function _onEnemyKilled() {
        gameState.stats.kills++;
    }

    function _onWaveCompleted() {
        gameState.stats.waveComp++;
        const elapsed = Date.now() - waveStartTime;
        if (elapsed > gameState.stats.longWave) {
            gameState.stats.longWave = elapsed;
        }
    }

    function _onUpgradePurchased() {
        gameState.stats.nodePurch++;
    }

    function _onBossDefeated() {
        gameState.stats.bossDef++;
    }
    
    function _onCurrencyChanged(type, current, delta) {
        if (type === 'data' && delta < 0) {
            gameState.stats.dataSpent += Math.abs(delta);
        }
    }

    function _onPhaseChanged(phase) {
        if (phase === GAME_CONSTANTS.PHASE_COMBAT) {
            waveStartTime = Date.now();
        }

        // Add session stats when an iteration ends (WAVE_COMPLETE or GAME_OVER)
        if (phase === GAME_CONSTANTS.PHASE_WAVE_COMPLETE || phase === GAME_CONSTANTS.PHASE_GAME_OVER) {
            if (phase === GAME_CONSTANTS.PHASE_WAVE_COMPLETE) {
                gameState.stats.iterEnd++;
            }
            gameState.stats.dataColl += resourceManager.getSessionData();
            gameState.stats.insightEarn += resourceManager.getSessionInsight();
            gameState.stats.shardColl += resourceManager.getSessionShards();
            gameState.stats.totalProcColl += resourceManager.getSessionProcessors();
            gameState.stats.coinColl += resourceManager.getSessionCoins();

            // Aggregate combat performance from statsTracker
            const sessionStats = statsTracker.getStats();
            gameState.stats.execs += (sessionStats.executions || 0);

            let sessionDamage = 0;
            if (sessionStats.damage) {
                for (const key in sessionStats.damage) {
                    sessionDamage += (sessionStats.damage[key] || 0);
                }
            }
            gameState.stats.dmgDealt += sessionDamage;
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
