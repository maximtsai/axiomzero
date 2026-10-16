// Save/load tests for js/util/gameState.js: old saves gain new default fields,
// unreadable saves are kept, and imports respect device settings.
// Run: npm test   (or: node --test tests/gameState.test.js)

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');

/** Load globals + gameConfig + gameState into a fresh context with an in-memory localStorage. */
function setup(initialStore = {}) {
    const store = { ...initialStore };
    const localStorage = {
        getItem: (k) => (k in store ? store[k] : null),
        setItem: (k, v) => { store[k] = String(v); },
        removeItem: (k) => { delete store[k]; },
    };
    const ctx = {
        console: { ...console, error: () => {} },
        localStorage,
        FLAGS: { DEBUG: false },
        debugLog: () => {},
        window: {},
        document: {},
        navigator: { userAgent: '' },
    };
    vm.createContext(ctx);
    for (const f of ['js/util/globals.js', 'js/gameConfig.js', 'js/util/gameState.js']) {
        vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
    }
    const api = vm.runInContext('({ gameState, initGameState, saveGame, saveSettings, loadGame, clearSave, SAVE_KEY, SAVE_VERSION })', ctx);
    return { ...api, store };
}

/** Plain copy (vm objects have a foreign prototype, which deepEqual rejects). */
const plain = (o) => JSON.parse(JSON.stringify(o));

describe('loading old saves', () => {
    it('fills nested fields the save predates from defaults', () => {
        const old = {
            version: 2,
            data: {
                data: 123,
                settings: { globalVolume: 0.3 },        // predates showDamageNumbers etc.
                stats: { kills: 40 },                   // predates dmgDealt, execs...
                tutorialsSeen: { first_breach: true },  // predates nothing, but must keep bomb default
            },
        };
        const { gameState, initGameState } = setup({ axiomzero_save: JSON.stringify(old) });
        initGameState();

        assert.equal(gameState.data, 123);
        assert.equal(gameState.settings.globalVolume, 0.3);
        assert.equal(gameState.settings.showDamageNumbers, true);
        assert.equal(gameState.stats.kills, 40);
        assert.equal(gameState.stats.dmgDealt, 0);
        assert.equal(gameState.stats.execs, 0);
        assert.deepEqual(plain(gameState.tutorialsSeen), { bomb: false, first_breach: true });
    });

    it('repairs numeric stats that were saved as null (NaN)', () => {
        const save = { version: 2, data: { stats: { kills: 5, dmgDealt: null, maxDmg: null } } };
        const { gameState, initGameState } = setup({ axiomzero_save: JSON.stringify(save) });
        initGameState();

        assert.equal(gameState.stats.kills, 5);
        assert.equal(gameState.stats.dmgDealt, 0);
        assert.equal(gameState.stats.maxDmg, 0);
    });

    it('keeps saved map entries and values that differ from defaults', () => {
        const save = { version: 2, data: { upgrades: { awaken: 1, focus: 3 }, settings: { chromaticAberration: false }, takeoverState: { totalBreaches: 2 } } };
        const { gameState, initGameState } = setup({ axiomzero_save: JSON.stringify(save) });
        initGameState();

        assert.deepEqual(plain(gameState.upgrades), { awaken: 1, focus: 3 });
        assert.equal(gameState.settings.chromaticAberration, false);
        assert.deepEqual(plain(gameState.takeoverState), { totalBreaches: 2 });
    });

    it('round-trips through saveGame', () => {
        const a = setup();
        a.initGameState();
        a.gameState.data = 999;
        a.gameState.upgrades.focus = 2;
        a.saveGame();

        const b = setup(a.store);
        b.initGameState();
        assert.equal(b.gameState.data, 999);
        assert.equal(b.gameState.upgrades.focus, 2);
    });
});

describe('unreadable saves', () => {
    it('keeps a copy instead of letting a fresh game overwrite it', () => {
        const { gameState, initGameState, store } = setup({ axiomzero_save: '{"version":2,"data":{"data":5' });
        initGameState();

        assert.equal(gameState.data, 0, 'starts fresh');
        assert.equal(store.axiomzero_save_unreadable, '{"version":2,"data":{"data":5');
    });

    it('does not back up a save that loaded fine', () => {
        const { initGameState, store } = setup({ axiomzero_save: JSON.stringify({ version: 2, data: { data: 1 } }) });
        initGameState();
        assert.equal(store.axiomzero_save_unreadable, undefined);
    });
});

describe('saveSettings', () => {
    it('writes settings without saving progress made since the last full save', () => {
        const { gameState, initGameState, saveGame, saveSettings, store } = setup();
        initGameState();
        gameState.data = 100;
        saveGame();                       // phase-change save

        gameState.data = 5;               // spent in the tree, not saved yet
        gameState.upgrades.focus = 1;
        gameState.settings.globalVolume = 0.2;
        saveSettings();                   // moved a slider

        const reloaded = setup(store);
        reloaded.initGameState();
        assert.equal(reloaded.gameState.data, 100, 'progress rolls back to the last full save');
        assert.equal(reloaded.gameState.upgrades.focus, undefined);
        assert.equal(reloaded.gameState.settings.globalVolume, 0.2, 'the setting sticks');
    });

    it('with no save yet, stores settings and still loads as a fresh game', () => {
        const a = setup();
        a.initGameState();
        a.gameState.data = 77;
        a.gameState.settings.bigFont = true;
        a.saveSettings();

        const b = setup(a.store);
        b.initGameState();
        assert.equal(b.gameState.data, 0);
        assert.equal(b.gameState.settings.bigFont, true);
        assert.equal(b.gameState.isFirstLaunch, true);
    });
});

describe('clearSave', () => {
    it('removes the local save and returns a promise', async () => {
        const { clearSave, store } = setup({ axiomzero_save: '{}' });
        const p = clearSave();
        assert.equal(typeof p.then, 'function');
        await p;
        assert.equal(store.axiomzero_save, undefined);
    });
});
