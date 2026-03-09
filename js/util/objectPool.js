'use strict';

/**
 * @fileoverview Generic object pool for reusing expensive-to-create objects.
 * Optimized with WeakSet/WeakMap guards, peak tracking, and lifecycle hooks.
 * 
 * DESIGN PATTERN: Eager Reset
 * This pool calls the `reset` function on RELEASE. This ensures objects are 
 * "cleaned" (hidden, deactivated, etc.) the moment they are no longer in use.
 * 
 * @module objectPool
 */
class ObjectPool {
    /**
     * @param {Function} factory    - Creates a new object.
     * @param {Function} reset      - Cleans object on release.
     * @param {Object|number} [optionsOrSize] - maxSize or an options object.
     */
    constructor(factory, reset, optionsOrSize) {
        if (typeof factory !== 'function') throw new TypeError('factory must be a function');
        if (typeof reset !== 'function') throw new TypeError('reset must be a function');

        this.factory = factory;
        this.reset = reset;

        // --- Configuration & Compatibility ---
        if (typeof optionsOrSize === 'number') {
            this.maxSize = optionsOrSize;
            this.onAcquire = null;
            this.destroy = null;
        } else {
            this.maxSize = optionsOrSize?.maxSize ?? 50;
            this.onAcquire = optionsOrSize?.onAcquire ?? null;
            this.destroy = optionsOrSize?.destroy ?? null;
        }

        this.pool = [];          // idle objects
        this._inPool = new WeakSet(); // double-release guard
        this._active = new Set();    // checked-out objects (enables releaseAll + accurate count)
        this._owner = new WeakMap(); // wrong-pool detection

        this.stats = { created: 0, reused: 0, discarded: 0 };
        this.peakActive = 0;
    }

    /** Pre-allocate objects for the pool. Useful during initialization/loading. */
    preAllocate(count) {
        const toAdd = Math.min(count, this.maxSize - this.pool.length);
        for (let i = 0; i < toAdd; i++) {
            const obj = this.factory();
            this.stats.created++;
            this.reset(obj);
            this._inPool.add(obj);
            this._owner.set(obj, this);
            this.pool.push(obj);
        }
        return this;
    }

    /** Get an object from the pool. */
    get() {
        let obj;
        if (this.pool.length > 0) {
            obj = this.pool.pop();
            this._inPool.delete(obj);
            this.stats.reused++;
        } else {
            obj = this.factory();
            this._owner.set(obj, this);
            this.stats.created++;
        }

        this._active.add(obj);
        if (this._active.size > this.peakActive) this.peakActive = this._active.size;

        // Per-use initialization hook
        if (this.onAcquire) this.onAcquire(obj);

        return obj;
    }

    /** Return an object to the pool for reuse. Calls `reset` immediately. */
    release(obj) {
        if (!obj) return;

        if (this._owner.get(obj) !== this) {
            console.warn('[ObjectPool] Object does not belong to this pool.', obj);
            return;
        }
        if (this._inPool.has(obj)) {
            console.warn('[ObjectPool] Double-release detected.', obj);
            return;
        }

        this.reset(obj);
        this._active.delete(obj);

        if (this.pool.length < this.maxSize) {
            this._inPool.add(obj);
            this.pool.push(obj);
        } else {
            this.stats.discarded++;
            if (this.destroy) this.destroy(obj);
        }
    }

    /** Releases all currently active objects back to the pool. */
    releaseAll() {
        // Create a copy to safely iterate while items are being modified in the set
        const active = Array.from(this._active);
        for (const obj of active) this.release(obj);
    }

    /** Empty the pool and reset trackers. */
    clear() {
        for (const obj of this.pool) {
            this._inPool.delete(obj);
            if (this.destroy) this.destroy(obj);
        }
        this.pool.length = 0;
        this._active.clear();
        this.peakActive = 0;
    }

    // --- Modern Getters ---
    get activeCount() { return this._active.size; }
    get poolSize() { return this.pool.length; }

    // --- Legacy Compatibility Methods ---
    getPoolSize() { return this.pool.length; }
    getActiveCount() { return this._active.size; }
    getPeakActive() { return this.peakActive; }
}
