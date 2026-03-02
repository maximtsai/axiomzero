/**
 * @fileoverview Reusable cooldown timer for attacks, abilities, and timed mechanics.
 * @module cooldownManager
 *
 * Usage:
 *   const cd = new Cooldown(1000);  // 1 second cooldown
 *   cd.start();
 *   // in update loop:
 *   cd.tick(delta);
 *   if (cd.isReady()) { fire(); cd.start(); }
 */
class Cooldown {
    /**
     * @param {number} durationMs - Cooldown period in milliseconds.
     */
    constructor(durationMs) {
        this.duration = durationMs;
        this.elapsed = durationMs; // start ready
    }

    /** Begin (or restart) the cooldown timer. */
    start() {
        this.elapsed = 0;
    }

    /**
     * Advance the timer. Call once per frame.
     * @param {number} delta - Frame delta in ms.
     */
    tick(delta) {
        if (this.elapsed < this.duration) {
            this.elapsed += delta;
        }
    }

    /** @returns {boolean} True when the cooldown has fully elapsed. */
    isReady() {
        return this.elapsed >= this.duration;
    }

    /**
     * Progress ratio from 0 (just started) to 1 (ready).
     * @returns {number}
     */
    getProgress() {
        if (this.duration <= 0) return 1;
        return Math.min(1, this.elapsed / this.duration);
    }

    /** Force the cooldown to be immediately ready. */
    reset() {
        this.elapsed = this.duration;
    }

    /**
     * Change the cooldown duration (e.g. after an upgrade).
     * Does not reset the current timer.
     * @param {number} ms
     */
    setDuration(ms) {
        this.duration = ms;
    }

    /** @returns {number} Remaining time in ms (0 if ready). */
    getRemaining() {
        return Math.max(0, this.duration - this.elapsed);
    }
}
