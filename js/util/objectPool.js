'use strict';

class ObjectPool {
    constructor(factory, reset, maxSize) {
        this.factory = factory;
        this.reset = reset;
        this.maxSize = maxSize || 50;
        this.pool = [];
        this.activeCount = 0;
    }

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

    release(obj) {
        if (this.pool.length < this.maxSize) {
            this.pool.push(obj);
        }
        this.activeCount--;
    }

    clear() {
        this.pool = [];
        this.activeCount = 0;
    }

    getPoolSize() {
        return this.pool.length;
    }

    getActiveCount() {
        return this.activeCount;
    }
}
