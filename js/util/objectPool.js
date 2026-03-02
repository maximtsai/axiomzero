'use strict';

/**
 * @fileoverview Generic object pool for reusing expensive-to-create objects.
 * @module objectPool
 *
 * Usage:
 *   const pool = new ObjectPool(factoryFn, resetFn, maxSize);
 *   const obj = pool.get();   // creates or reuses
 *   pool.release(obj);        // returns to pool
 */
class ObjectPool {
    /**
     * @param {Function} factory - Creates a new object when pool is empty.
     * @param {Function} reset   - Resets a recycled object before reuse.
     * @param {number}   [maxSize=50] - Max idle objects to keep pooled.
     */
    constructor(factory, reset, maxSize) {
        this.factory = factory;
        this.reset = reset;
        this.maxSize = maxSize || 50;
        this.pool = [];
        this.activeCount = 0;
    }

    /** Get an object from the pool (recycles if available, else creates new). */
    get() {
        if (this.pool.length > 0) {
            const obj = this.pool.pop();
            this.reset(obj);
            this.activeCount++;
            return obj;
        }

        const obj = this.factory();
        this.activeCount++;
        return obj;
    }

    /** Return an object to the pool for reuse. */
    release(obj) {
        if (this.pool.length < this.maxSize) {
            this.pool.push(obj);
        }
        this.activeCount--;
    }

    /** Empty the pool and reset active count. */
    clear() {
        this.pool = [];
        this.activeCount = 0;
    }

    /** @returns {number} Number of idle objects in the pool. */
    getPoolSize() {
        return this.pool.length;
    }

    /** @returns {number} Number of objects currently in use. */
    getActiveCount() {
        return this.activeCount;
    }
}
