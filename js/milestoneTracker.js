/**
 * @fileoverview Axiom Zero milestone tracking and achievement system.
 * Subscribes to messageBus events and increments counters automatically.
 * Milestones can be claimed once their target is met.
 * Stats and claimed state persist via localStorage.
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
    const SAVE_KEY = 'axiomzero_milestones';

    // ── Tracked stats ────────────────────────────────────────────────────
    let stats = {
        totalKills: 0,
        totalDataCollected: 0,
        totalInsightEarned: 0,
        totalWavesCompleted: 0,
        totalNodesPurchased: 0,
        longestWaveMs: 0,  // longest single wave duration in ms
        bossesDefeated: 0,
    };

    // ── Milestone definitions ────────────────────────────────────────────
    // Each milestone: { id, name, description, statKey, target, reward: {type, amount}, claimed }
    const milestones = [
        { id: 'kill_100', name: 'First Hundred', description: 'Kill 100 enemies', statKey: 'totalKills', target: 100, reward: { type: 'data', amount: 50 }, claimed: false },
        { id: 'kill_500', name: 'Exterminator', description: 'Kill 500 enemies', statKey: 'totalKills', target: 500, reward: { type: 'data', amount: 200 }, claimed: false },
        { id: 'kill_2000', name: 'Annihilator', description: 'Kill 2000 enemies', statKey: 'totalKills', target: 2000, reward: { type: 'insight', amount: 2 }, claimed: false },
        { id: 'data_1000', name: 'Data Hoarder', description: 'Collect 1,000 DATA total', statKey: 'totalDataCollected', target: 1000, reward: { type: 'data', amount: 100 }, claimed: false },
        { id: 'data_10000', name: 'Data Vault', description: 'Collect 10,000 DATA total', statKey: 'totalDataCollected', target: 10000, reward: { type: 'insight', amount: 3 }, claimed: false },
        { id: 'waves_10', name: 'Veteran', description: 'Complete 10 waves', statKey: 'totalWavesCompleted', target: 10, reward: { type: 'data', amount: 75 }, claimed: false },
        { id: 'waves_50', name: 'Seasoned', description: 'Complete 50 waves', statKey: 'totalWavesCompleted', target: 50, reward: { type: 'insight', amount: 2 }, claimed: false },
        { id: 'nodes_5', name: 'Branching Out', description: 'Purchase 5 nodes', statKey: 'totalNodesPurchased', target: 5, reward: { type: 'data', amount: 50 }, claimed: false },
        { id: 'nodes_15', name: 'Neural Network', description: 'Purchase 15 nodes', statKey: 'totalNodesPurchased', target: 15, reward: { type: 'insight', amount: 1 }, claimed: false },
        { id: 'boss_1', name: 'System Override', description: 'Defeat a boss', statKey: 'bossesDefeated', target: 1, reward: { type: 'data', amount: 300 }, claimed: false },
    ];

    // ── Wave timing ──────────────────────────────────────────────────────
    let waveStartTime = 0;

    // ── Init ─────────────────────────────────────────────────────────────

    function init() {
        _load();

        messageBus.subscribe('enemyKilled', _onEnemyKilled);
        messageBus.subscribe('currencyChanged', _onCurrencyChanged);
        messageBus.subscribe('waveCompleted', _onWaveCompleted);
        messageBus.subscribe('upgradePurchased', _onUpgradePurchased);
        messageBus.subscribe('bossDefeated', _onBossDefeated);
        messageBus.subscribe('phaseChanged', _onPhaseChanged);
    }

    // ── Event handlers ───────────────────────────────────────────────────

    function _onEnemyKilled() {
        stats.totalKills++;
        _autoSave();
    }

    function _onCurrencyChanged(type, amount, delta) {
        if (type === 'data' && delta > 0) {
            stats.totalDataCollected += delta;
            _autoSave();
        }
        if (type === 'insight' && delta > 0) {
            stats.totalInsightEarned += delta;
            _autoSave();
        }
    }

    function _onWaveCompleted() {
        stats.totalWavesCompleted++;
        const elapsed = Date.now() - waveStartTime;
        if (elapsed > stats.longestWaveMs) {
            stats.longestWaveMs = elapsed;
        }
        _autoSave();
    }

    function _onUpgradePurchased() {
        stats.totalNodesPurchased++;
        _autoSave();
    }

    function _onBossDefeated() {
        stats.bossesDefeated++;
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
        return stats[key] || 0;
    }

    /** Manually increment a stat (for stats not auto-tracked). */
    function incrementStat(key, amount = 1) {
        if (stats[key] !== undefined) {
            stats[key] += amount;
            _autoSave();
        }
    }

    /** @returns {Array} All milestone definitions with current progress attached. */
    function getMilestones() {
        return milestones.map(m => ({
            ...m,
            current: stats[m.statKey] || 0,
            isComplete: (stats[m.statKey] || 0) >= m.target,
        }));
    }

    /**
     * Claim a completed milestone.
     * @param {string} milestoneId
     * @returns {{ type: string, amount: number } | null} The reward, or null if not claimable.
     */
    function claim(milestoneId) {
        const m = milestones.find(ms => ms.id === milestoneId);
        if (!m || m.claimed) return null;
        if ((stats[m.statKey] || 0) < m.target) return null;

        m.claimed = true;
        _save();
        return m.reward;
    }

    // ── Persistence ──────────────────────────────────────────────────────

    let saveTimer = 0;
    function _autoSave() {
        // Throttle saves to avoid excessive localStorage writes
        const now = Date.now();
        if (now - saveTimer < 2000) return;
        saveTimer = now;
        _save();
    }

    function _save() {
        try {
            const claimed = {};
            milestones.forEach(m => { if (m.claimed) claimed[m.id] = true; });
            localStorage.setItem(SAVE_KEY, JSON.stringify({ stats, claimed }));
        } catch (e) {
            console.error('milestoneTracker save failed:', e);
        }
    }

    function _load() {
        try {
            const raw = localStorage.getItem(SAVE_KEY);
            if (!raw) return;
            const data = JSON.parse(raw);
            if (data.stats) Object.assign(stats, data.stats);
            if (data.claimed) {
                milestones.forEach(m => {
                    if (data.claimed[m.id]) m.claimed = true;
                });
            }
        } catch (e) {
            console.error('milestoneTracker load failed:', e);
        }
    }

    return { init, getStat, incrementStat, getMilestones, claim };
})();
