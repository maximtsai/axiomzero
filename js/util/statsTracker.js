/**
 * @fileoverview Statistics tracking for combat performance and build analytics.
 * This is a singleton that persists through the duration of an iteration. 
 */

const statsTracker = (function() {
    // Damage source taxonomy:
    // 'pulse', 'lightning', 'artillery', 'shockwave', 'laser' (includes burn), 'other'
    
    let currentRun = {
        damage: {
            pulse: 0,
            tower: 0,
            lightning: 0,
            artillery: 0,
            shockwave: 0,
            laser: 0,
            friendlyfire: 0,
            endgame: 0,
            other: 0
        },
        executions: 0
    };

    /** Clears statistics for a new iteration. */
    function reset() {
        currentRun.damage = {
            pulse: 0,
            tower: 0,
            lightning: 0,
            artillery: 0,
            shockwave: 0,
            laser: 0,
            friendlyfire: 0,
            endgame: 0,
            other: 0
        };
        currentRun.executions = 0;
    }

    /**
     * Records damage dealt from a specific source.
     * Overkill damage is prevented by the caller (Math.min with health).
     * @param {number} amount - Validated non-overkill damage.
     * @param {string} source - Original source name.
     */
    function recordDamage(amount, source) {
        if (amount <= 0 || source === 'notrecorded') return;

        // Map sources per design request
        const s = (source === 'burn') ? 'laser' : (source || 'other');
        const target = currentRun.damage.hasOwnProperty(s) ? s : 'other';

        currentRun.damage[target] += amount;
    }

    /** Records a Zero-Day Exploit execution. */
    function recordExecution() {
        currentRun.executions++;
    }

    /** Returns a clone of the current run stats. */
    function getStats() {
        return JSON.parse(JSON.stringify(currentRun));
    }

    return {
        reset,
        recordDamage,
        recordExecution,
        getStats
    };
})();
