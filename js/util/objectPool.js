'use strict';

/**
 * @fileoverview Generic object pool for reusing expensive-to-create objects.
 * Optimized with double-release protection, peak tracking, and pre-allocation.
 * 
 * DESIGN PATTERN: Eager Reset
 * This pool calls the `reset` function on RELEASE. This ensures objects are 
 * "cleaned" (hidden, deactivated, etc.) the moment they are no longer in use,
 * preventing "ghosting" artifacts in game development.
 * 
 * @module objectPool
 */
class ObjectPool {
    /**
     * @param {Function} factory - Creates a new object when pool is empty.
     * @param {Function} reset   - Resets a recycled object (called on release and pre-allocation).
     * @param {number}   [maxSize=50] - Max idle objects to keep pooled.
     */
    constructor(factory, reset, maxSize) {
        this.factory = factory;
        this.reset = reset;
        this.maxSize = maxSize || 50;
        this.pool = [];
        this.activeCount = 0;
        this.peakActive = 0;
    }

    /** Pre-allocate objects for the pool. Useful during initialization/loading. */
    preAllocate(count) {
        const toAdd = Math.min(count, this.maxSize - this.pool.length);
        for (let i = 0; i < toAdd; i++) {
            const obj = this.factory();
            obj.___isPooled = true;
            if (this.reset) this.reset(obj); // Ensure pre-allocated objects are "clean"
            this.pool.push(obj);
        }
        return this;
    }

    /** Get an object from the pool. */
    get() {
        let obj;
        if (this.pool.length > 0) {
            obj = this.pool.pop();
            obj.___isPooled = false;
        } else {
            obj = this.factory();
            obj.___isPooled = false;
            // Optionally reset brand new objects if you want guaranteed clean state immediately
            if (this.reset) this.reset(obj);
        }

        this.activeCount++;
        if (this.activeCount > this.peakActive) {
            this.peakActive = this.activeCount;
        }
        return obj;
    }

    /** Return an object to the pool for reuse. Calls `reset` immediately. */
    release(obj) {
        if (!obj) return;

        // Double-release protection
        if (obj.___isPooled) {
            console.warn('[ObjectPool] Attempted to release object already in pool.', obj);
            return;
        }

        // VISUAL SAFETY: Reset the object immediately upon release
        if (this.reset) this.reset(obj);

        if (this.pool.length < this.maxSize) {
            obj.___isPooled = true;
            this.pool.push(obj);
        } else {
            // Pool is full, allow GC to collect the object
            obj.___isPooled = false;
        }

        this.activeCount = Math.max(0, this.activeCount - 1);
    }

    /** Empty the pool and reset active count. */
    clear() {
        this.pool = [];
        this.activeCount = 0;
        this.peakActive = 0;
    }

    /** @returns {number} Number of idle objects in the pool. */
    getPoolSize() {
        return this.pool.length;
    }

    /** @returns {number} Number of objects currently in use. */
    getActiveCount() {
        return this.activeCount;
    }

    /** @returns {number} High-water mark for peak active objects. */
    getPeakActive() {
        return this.peakActive;
    }
}
