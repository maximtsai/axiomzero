// Node sandbox for running individual game scripts outside the browser.
// Loads a classic script (e.g. js/takeoverTargets.js) into an isolated vm context
// with a controllable clock, seeded Math.random, and lightweight stubs for the
// game systems it talks to. Used by tests/ and tools/takeover-sim.js.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

/** Small, fast, seedable PRNG (mulberry32). */
function seededRandom(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/**
 * @param {object} [opts]
 * @param {number} [opts.seed=1]          Math.random seed
 * @param {number} [opts.now]             starting value of Date.now()
 * @param {object} [opts.resources]       starting { data, insight, shard, processor, coin }
 * @param {object} [opts.gameState]       initial gameState fields (merged over {})
 * @param {number} [opts.hackingSpeed=1]  value returned by upgradeDispatcher.getHackingSpeedMultiplier()
 */
function createSandbox(opts = {}) {
    const clock = { now: opts.now ?? 1_700_000_000_000, advance(ms) { this.now += ms; return this.now; } };
    const resources = { data: 0, insight: 0, shard: 0, processor: 0, coin: 0, ...(opts.resources || {}) };
    const saves = [];
    const published = [];

    const gameState = JSON.parse(JSON.stringify(opts.gameState || {}));

    const resourceManager = {
        canAfford: (type, amt) => (resources[type] || 0) >= amt,
        spend: (type, amt) => {
            if ((resources[type] || 0) < amt) return false;
            resources[type] -= amt;
            return true;
        },
        addData: (n) => { resources.data += n; },
        addInsight: (n) => { resources.insight += n; },
        addShard: (n) => { resources.shard += n; },
        addProcessor: (n) => { resources.processor += n; },
        addCoin: (n) => { resources.coin += n; },
        getData: () => resources.data,
        getInsight: () => resources.insight,
        getShards: () => resources.shard,
        getProcessors: () => resources.processor,
        getCoins: () => resources.coin,
    };

    const sandbox = {
        console,
        gameState,
        resourceManager,
        upgradeDispatcher: {
            getLevel: () => 0,
            getHackingSpeedMultiplier: () => opts.hackingSpeed ?? 1,
        },
        messageBus: {
            publish: (topic, ...args) => published.push({ topic, args }),
            subscribe: () => ({ unsubscribe() {} }),
        },
        tower: { getPosition: () => ({ x: 800, y: 450 }) },
        GAME_CONSTANTS: { halfWidth: 800, halfHeight: 450, WIDTH: 1600, HEIGHT: 900 },
        saveGame: () => { saves.push(JSON.parse(JSON.stringify(gameState))); },
        t: (ns, key) => `${ns}.${key}`,
        __clock: clock,
        __rand: seededRandom(opts.seed ?? 1),
    };

    const context = vm.createContext(sandbox);
    vm.runInContext('Date.now = () => __clock.now; Math.random = () => __rand();', context);

    return {
        context,
        clock,
        resources,
        saves,
        published,
        gameState,
        /** Run a repo-relative script file inside the sandbox. */
        load(relPath) {
            const file = path.join(ROOT, relPath);
            vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
            return this;
        },
        /** Read a global (including top-level const/let) from the sandbox. */
        get(name) {
            return vm.runInContext(name, context);
        },
        /** Evaluate an expression inside the sandbox. */
        eval(code) {
            return vm.runInContext(code, context);
        },
    };
}

module.exports = { createSandbox, seededRandom, ROOT };
