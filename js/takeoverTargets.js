/**
 * @fileoverview Target pool and generation logic for the Financial Breach / Takeover system.
 * Generates random corporate targets with security levels, costs, durations, and rewards.
 * Manages the active attack state (timer, pending reward) which persists across popup open/close.
 */
const takeoverTargets = (() => {
    // ── Corporation Name Pool ──────────────────────────────────────────────────
    const CORP_NAMES = [
        'NEXUS FINANCIAL CORP',
        'ORBITAL BANK',
        'DATAVAULT INDUSTRIES',
        'SILICON TRUST',
        'QUANTUM LEDGER INC',
        'MEGABYTE SAVINGS',
        'CRYPTOFORGE LTD',
        'APEX DIGITAL ASSETS',
        'SYNAPSE CAPITAL',
        'ECHO RESERVE BANK',
        'PHANTOM SECURITIES',
        'PRISM WEALTH GROUP',
        'ZERO-POINT FINANCE',
        'HELIX INVESTMENTS',
        'OBSIDIAN FUND MGMT',
        'GRIDLOCK BANK',
        'NEON ASSET CORP',
        'DARKPOOL EXCHANGE',
        'TERRAFORM HOLDINGS',
        'AETHER CREDIT UNION',
    ];

    // ── Flavor Text Pools (per reward type) ────────────────────────────────
    const FLAVOR_COIN = [
        'Draining corporate bank accounts',
        'Siphoning unused slush funds',
        'Redirecting payroll streams',
        'Raiding executive bonuses',
        'Skimming wealthy savings deposits',
        'Hijacking algorithmic trading profits',
        'Liquidating forgotten asset portfolios',
    ];

    const FLAVOR_DATA = [
        'Extracting user search histories',
        'Downloading private customer emails',
        'Harvesting personal browsing habits',
        'Scraping sensitive social profiles',
        'Copying internal employee records',
        'Stealing confidential client lists',
        'Exporting hidden tracking logs',
    ];

    const FLAVOR_INSIGHT = [
        'Analyzing big data for hidden truths',
        'Extracting core truths from user data',
        'Reflecting on sensitive information',
        'Finding hidden patterns in stolen records',
        'Simulating market trends from raw data',
        'Connecting dots across global databases',
    ];

    const FLAVOR_BY_REWARD = {
        coin: FLAVOR_COIN,
        data: FLAVOR_DATA,
        insight: FLAVOR_INSIGHT,
    };

    // ── Security Level Config ─────────────────────────────────────────────────
    // cost = DATA cost, duration = seconds, rewardMult applies to base reward
    const SECURITY_CONFIG = {
        LOW: { costMin: 25, costMax: 75, durMin: 30, durMax: 60, rewardMult: 1 },
        MEDIUM: { costMin: 75, costMax: 200, durMin: 60, durMax: 120, rewardMult: 2.5 },
        HIGH: { costMin: 200, costMax: 500, durMin: 120, durMax: 240, rewardMult: 5 },
    };

    const SECURITY_LEVELS = ['LOW', 'MEDIUM', 'HIGH'];
    const REWARD_TYPES = ['coin', 'data', 'insight'];

    // ── Base Reward Amounts (before multiplier) ───────────────────────────────
    const BASE_REWARDS = {
        coin: { min: 5, max: 15 },       // Internal units (displayed as ×0.01)
        data: { min: 20, max: 60 },
        insight: { min: 1, max: 1 },
    };

    // ── State ─────────────────────────────────────────────────────────────────
    let currentTargets = [null, null, null]; // 3 target slots
    let activeAttack = null;   // { target, startTime, duration, cost }
    let pendingReward = null;  // { rewardType, rewardAmount, targetName }
    let hasCompletedFirstTutorial = false;
    let insightCooldown = 0;   // Cooldown in refreshes before another insight target can appear

    // ── Helpers ───────────────────────────────────────────────────────────────

    function _randInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function _pick(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    }

    /** Round to nearest 5 for cleaner cost display */
    function _roundTo5(n) {
        return Math.round(n / 5) * 5;
    }

    // ── Target Generation ─────────────────────────────────────────────────────

    function _generateTarget(usedNames, allowInsight) {
        // Pick a unique corp name
        let name;
        let attempts = 0;
        do {
            name = _pick(CORP_NAMES);
            attempts++;
        } while (usedNames.has(name) && attempts < 50);
        usedNames.add(name);

        // Pick security level — weighted: 50% LOW, 35% MEDIUM, 15% HIGH
        const roll = Math.random();
        let security;
        if (roll < 0.50) security = 'LOW';
        else if (roll < 0.85) security = 'MEDIUM';
        else security = 'HIGH';

        const config = SECURITY_CONFIG[security];
        let cost = _roundTo5(_randInt(config.costMin, config.costMax));
        const duration = _randInt(config.durMin, config.durMax);

        // Pick reward type
        let rewardType;
        const rewardRoll = Math.random();
        if (allowInsight) {
            // weighted: 55% coin, 35% data, 10% insight
            if (rewardRoll < 0.55) rewardType = 'coin';
            else if (rewardRoll < 0.90) rewardType = 'data';
            else rewardType = 'insight';
        } else {
            // weighted: 60% coin, 40% data
            if (rewardRoll < 0.60) rewardType = 'coin';
            else rewardType = 'data';
        }

        const baseReward = BASE_REWARDS[rewardType];
        let rewardAmount = _randInt(baseReward.min, baseReward.max);

        // Apply security multiplier and insight overrides
        if (rewardType === 'insight') {
            rewardAmount = 1;
            cost = _roundTo5(_randInt(200, 300));
        } else {
            rewardAmount = Math.round(rewardAmount * config.rewardMult);
        }

        // Pick flavor text based on reward type
        const flavor = _pick(FLAVOR_BY_REWARD[rewardType]);

        return {
            name,
            security,
            flavor,
            cost,
            duration,
            rewardType,
            rewardAmount,
        };
    }

    /** Generate 3 fresh targets, ensuring unique names. */
    function rollTargets() {
        if (!hasCompletedFirstTutorial) {
            // First-time tutorial behavior: Only two cards to reduce player cognitive load.
            // Target 1: Low risk, low cost, 5s duration, net positive DATA.
            const usedNames = new Set();
            const name1 = _pick(CORP_NAMES);
            usedNames.add(name1);
            let name2;
            do {
                name2 = _pick(CORP_NAMES);
            } while (name2 === name1);

            currentTargets = [
                {
                    name: name1,
                    security: 'LOW',
                    flavor: 'Simulating a basic sandbox breach',
                    cost: 10,
                    duration: 5,
                    rewardType: 'data',
                    rewardAmount: 15, // Net positive return (+5 data)
                },
                {
                    name: name2,
                    security: 'LOW',
                    flavor: 'Cracking a minor corporate terminal',
                    cost: 25,
                    duration: 40,
                    rewardType: 'coin',
                    rewardAmount: 15, // displayed as 0.15 COIN
                },
                null // Third slot is null to reduce cognitive load
            ];
            _saveState(); // Persist the tutorial targets so reload doesn't regenerate them
            return currentTargets;
        }

        const usedNames = new Set();
        insightCooldown = Math.max(0, insightCooldown - 1);
        let canGenerateInsight = insightCooldown === 0;

        currentTargets = [];
        for (let i = 0; i < 3; i++) {
            const t = _generateTarget(usedNames, canGenerateInsight);
            if (t.rewardType === 'insight') {
                canGenerateInsight = false; // Only one per refresh
                insightCooldown = 3; // Enforce wait for at least 2 more refreshes
            }
            currentTargets.push(t);
        }
        return currentTargets;
    }

    /** Get the current set of 3 targets. Rolls fresh targets if none are loaded. */
    function getTargets() {
        // Check all slots: tutorial has [target, target, null] which is valid,
        // but a fully uninitialised state has [null, null, null].
        const allNull = currentTargets.every(t => t === null);
        if (allNull) rollTargets();
        return currentTargets;
    }

    // ── Attack Management ─────────────────────────────────────────────────────

    /**
     * Start an attack on a target.
     * @param {number} index - Target index (0-2)
     * @returns {boolean} true if attack started successfully
     */
    function startAttack(index) {
        if (activeAttack || pendingReward) return false;
        const target = currentTargets[index];
        if (!target) return false;

        // Check if player can afford
        if (!resourceManager.canAfford('data', target.cost)) return false;

        // Deduct cost
        resourceManager.spend('data', target.cost);

        activeAttack = {
            target: { ...target },
            startTime: Date.now(),
            duration: target.duration * 1000, // convert to ms
            cost: target.cost,
        };

        // Persist to gameState for save/load
        _saveState();
        saveGame();
        return true;
    }

    /**
     * Cancel the current attack. Refunds 75% of DATA cost.
     * @returns {boolean} true if successfully cancelled
     */
    function cancelAttack() {
        if (!activeAttack) return false;

        const refund = Math.floor(activeAttack.cost * 0.75);
        resourceManager.addData(refund);

        // Show floating text refund
        if (typeof messageBus !== 'undefined') {
            const pos = typeof tower !== 'undefined' ? tower.getPosition() : { x: GAME_CONSTANTS.halfWidth, y: GAME_CONSTANTS.halfHeight };
            messageBus.publish('showFloatingText',
                pos.x + (Math.random() - 0.5) * 80,
                pos.y + (Math.random() - 0.5) * 60,
                `+${refund} DATA (REFUND)`,
                { fontFamily: 'Quantico-Bold', color: '#00f5ff', fontSize: 22, travel: 50, noScale: true }
            );
        }

        activeAttack = null;
        pendingReward = null;

        // Mark tutorial as complete
        hasCompletedFirstTutorial = true;

        // Re-roll targets after cancel
        rollTargets();
        _saveState();
        saveGame();
        return true;
    }

    /**
     * Collect a pending reward after a completed attack.
     * @returns {{ rewardType: string, rewardAmount: number, targetName: string }|null}
     */
    function collectReward() {
        if (!pendingReward) return null;

        const reward = { ...pendingReward };

        // Add the reward to the player's resources
        if (reward.rewardType === 'coin') {
            resourceManager.addCoin(reward.rewardAmount);
        } else if (reward.rewardType === 'data') {
            resourceManager.addData(reward.rewardAmount);
        } else if (reward.rewardType === 'insight') {
            resourceManager.addInsight(reward.rewardAmount);
        }

        pendingReward = null;
        activeAttack = null;

        // Mark tutorial as complete
        hasCompletedFirstTutorial = true;

        // Re-roll targets after collection
        rollTargets();
        _saveState();
        saveGame();
        return reward;
    }

    /**
     * Check if the active attack has completed. Called by the per-frame update.
     * If complete, transitions to pendingReward state.
     * @returns {boolean} true if attack just completed this frame
     */
    function checkCompletion() {
        if (!activeAttack || pendingReward) return false;

        const elapsed = Date.now() - activeAttack.startTime;
        if (elapsed >= activeAttack.duration) {
            pendingReward = {
                rewardType: activeAttack.target.rewardType,
                rewardAmount: activeAttack.target.rewardAmount,
                targetName: activeAttack.target.name,
            };
            _saveState();
            saveGame();
            return true;
        }
        return false;
    }

    /**
     * Get the current progress of the active attack (0–1).
     * @returns {number} Progress fraction, or -1 if no active attack
     */
    function getProgress() {
        if (!activeAttack) return -1;
        const elapsed = Date.now() - activeAttack.startTime;
        return Math.min(1, elapsed / activeAttack.duration);
    }

    /**
     * Get the remaining time in seconds.
     * @returns {number} Seconds remaining, or -1 if no active attack
     */
    function getRemainingSeconds() {
        if (!activeAttack) return -1;
        const elapsed = Date.now() - activeAttack.startTime;
        const remaining = activeAttack.duration - elapsed;
        return Math.max(0, Math.ceil(remaining / 1000));
    }

    // ── State Accessors ───────────────────────────────────────────────────────

    function getActiveAttack() { return activeAttack; }
    function getPendingReward() { return pendingReward; }
    function isAttacking() { return activeAttack !== null && !pendingReward; }
    function hasRewardPending() { return pendingReward !== null; }

    /**
     * Get the current state for the TAKEOVER button indicator.
     * @returns {'idle'|'attacking'|'reward_pending'}
     */
    function getButtonState() {
        if (pendingReward) return 'reward_pending';
        if (activeAttack) return 'attacking';
        return 'idle';
    }

    // ── Persistence ───────────────────────────────────────────────────────────

    function _saveState() {
        if (!gameState) return;
        gameState.takeoverState = {
            targets: currentTargets,
            activeAttack: activeAttack ? {
                target: activeAttack.target,
                startTime: activeAttack.startTime,
                duration: activeAttack.duration,
                cost: activeAttack.cost,
            } : null,
            pendingReward: pendingReward,
            hasCompletedFirstTutorial: hasCompletedFirstTutorial,
            insightCooldown: insightCooldown,
        };
    }

    function _loadState() {
        if (!gameState || !gameState.takeoverState) return;
        const s = gameState.takeoverState;

        if (s.targets && s.targets.length === 3) {
            currentTargets = s.targets;
        }

        if (s.activeAttack) {
            activeAttack = s.activeAttack;
        }

        if (s.pendingReward) {
            pendingReward = s.pendingReward;
        }

        if (s.hasOwnProperty('hasCompletedFirstTutorial')) {
            hasCompletedFirstTutorial = s.hasCompletedFirstTutorial;
        } else {
            // If they already have 3 non-null targets, they have already bypassed/completed tutorial
            if (s.targets && s.targets[2] !== null) {
                hasCompletedFirstTutorial = true;
            }
        }

        if (s.hasOwnProperty('insightCooldown')) {
            insightCooldown = s.insightCooldown;
        }

        // Check if a saved attack has completed while the game was closed
        // (Date.now-based timer means offline time counts)
        checkCompletion();
    }

    function init() {
        _loadState();
    }

    // ── Format Helpers (for UI) ───────────────────────────────────────────────

    function formatReward(rewardType, rewardAmount) {
        if (rewardType === 'coin') {
            return '+' + (rewardAmount * 0.01).toFixed(2) + ' COIN';
        } else if (rewardType === 'data') {
            return '+' + rewardAmount + ' DATA';
        } else if (rewardType === 'insight') {
            return '+' + rewardAmount + ' INSIGHT';
        }
        return '+' + rewardAmount;
    }

    function getRewardColor(rewardType) {
        if (rewardType === 'coin') return '#00FF00';
        if (rewardType === 'data') return '#00f5ff';
        if (rewardType === 'insight') return '#ffffff';
        return '#ffffff';
    }

    function getSecurityColor(security) {
        if (security === 'LOW') return '#44ff44';
        if (security === 'MEDIUM') return '#ffcc00';
        if (security === 'HIGH') return '#ff4444';
        return '#ffffff';
    }

    return {
        init,
        rollTargets,
        getTargets,
        startAttack,
        cancelAttack,
        collectReward,
        checkCompletion,
        getProgress,
        getRemainingSeconds,
        getActiveAttack,
        getPendingReward,
        isAttacking,
        hasRewardPending,
        getButtonState,
        formatReward,
        getRewardColor,
        getSecurityColor,
    };
})();
