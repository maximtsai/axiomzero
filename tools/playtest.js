/**
 * @fileoverview Dev-only playtest helper. NOT loaded by index.html and never shipped
 * (build_prod.js only bundles scripts listed in index.html).
 *
 * Inject into a running page (preview pane or devtools console):
 *   await new Promise(r => { const s = document.createElement('script'); s.src = '/tools/playtest.js?' + Date.now(); s.onload = r; document.head.appendChild(s); });
 *
 * Then use the global `AZT`:
 *   AZT.state()                      → compact snapshot of phase, resources, tower, enemies
 *   AZT.loadPreset('takeover')       → back up the current save, write a preset save, reload
 *   AZT.loadSave({ ...partial })     → same, with a custom partial gameState
 *   AZT.restore()                    → put the backed-up save back, reload
 *   AZT.waitForBoot()                → resolves once the game reaches its first phase
 *   AZT.grant({ data: 5000 })        → add currency live (goes through resourceManager)
 *   AZT.combat() / AZT.upgrades()    → phase transition via transitionManager (with camera slide)
 *   AZT.takeover.*                   → takeover / infiltration tools (tools/playtest-takeover.js)
 *   AZT.clickAt(x, y)                → real DOM mouse click at game coords (1600x900)
 *   AZT.clickText('ABORT') / AZT.clickFrame('close_button_')  → click a visible text / sprite
 *   AZT.findTexts(match) / AZT.screenTexts(minDepth)           → query what's on screen
 *   AZT.spawn('heavy', 5)            → spawn enemies around the tower (combat phase)
 *   AZT.spawnMiniboss() / AZT.spawnBoss()
 *   AZT.god(true)                    → keep the tower at full health
 *   AZT.speed(3)                     → game time scale
 *   AZT.unlockPath('financial_breach') → upgrades map with the node and all its ancestors
 *   AZT.nodes(filter?)               → list node ids (optionally filtered by substring)
 */
(() => {
    const BACKUP_KEY = SAVE_KEY + '__playtest_backup';
    const NO_SAVE = '__none__';

    // ── Save manipulation ────────────────────────────────────────────────────

    function _backupOnce() {
        // Only the first load in a playtest session takes a backup, so repeated preset
        // loads don't overwrite the user's real save with an earlier preset.
        if (localStorage.getItem(BACKUP_KEY) !== null) return false;
        localStorage.setItem(BACKUP_KEY, localStorage.getItem(SAVE_KEY) ?? NO_SAVE);
        return true;
    }

    function _defaults() {
        return JSON.parse(JSON.stringify(GAME_STATE_DEFAULTS));
    }

    function _deepMerge(target, src) {
        for (const k in src) {
            const v = src[k];
            if (v && typeof v === 'object' && !Array.isArray(v) && target[k] && typeof target[k] === 'object') {
                _deepMerge(target[k], v);
            } else {
                target[k] = v;
            }
        }
        return target;
    }

    /** Write a save built from defaults + `partial` and reload. Keeps the user's settings (volume etc.). */
    function loadSave(partial, { reload = true } = {}) {
        const tookBackup = _backupOnce();
        const data = _deepMerge(_defaults(), { settings: gameState.settings });
        _deepMerge(data, partial || {});
        localStorage.setItem(SAVE_KEY, JSON.stringify({ version: SAVE_VERSION, data }));
        // Prevent the running game from overwriting our save on unload.
        window.saveGame = () => {};
        if (reload) location.reload();
        return { tookBackup, keys: Object.keys(partial || {}) };
    }

    /** Restore the save that existed before the first playtest load, then reload. */
    function restore({ reload = true } = {}) {
        const backup = localStorage.getItem(BACKUP_KEY);
        if (backup === null) return 'no backup found (nothing was changed by playtest)';
        if (backup === NO_SAVE) localStorage.removeItem(SAVE_KEY);
        else localStorage.setItem(SAVE_KEY, backup);
        localStorage.removeItem(BACKUP_KEY);
        window.saveGame = () => {};
        if (reload) location.reload();
        return 'restored';
    }

    function hasBackup() {
        return localStorage.getItem(BACKUP_KEY) !== null;
    }

    // ── Upgrade-tree helpers ─────────────────────────────────────────────────

    const _defById = () => Object.fromEntries(NODE_DEFS.map(d => [d.id, d]));

    /** Upgrades map containing `ids` (at `level`, capped at maxLevel) plus every ancestor at level 1. */
    function unlockPath(ids, level = 1) {
        const defs = _defById();
        const out = {};
        const visit = (id, lvl) => {
            const d = defs[id];
            if (!d) throw new Error(`unknown node id '${id}'`);
            out[id] = Math.max(out[id] || 0, Math.min(lvl, d.maxLevel || 1));
            (d.parents || []).forEach(p => { if (!out[p]) visit(p, 1); });
        };
        [].concat(ids).forEach(id => visit(id, level));
        return out;
    }

    /** Every node at max level. */
    function allMaxed() {
        return Object.fromEntries(NODE_DEFS.map(d => [d.id, d.maxLevel || 1]));
    }

    function nodes(filter = '') {
        return NODE_DEFS.filter(d => d.id.includes(filter)).map(d => `${d.id} (max ${d.maxLevel || 1}, parents: ${(d.parents || []).join(',') || '-'})`);
    }

    // ── Presets ──────────────────────────────────────────────────────────────

    const RICH = { data: 50000, insight: 50, shard: 20, processor: 50, coin: 500 };

    const PRESETS = {
        // Brand-new player: only the AWAKEN node is available.
        fresh: () => ({}),
        // Tower awakened, a little DATA, level 1.
        early: () => ({ isFirstLaunch: false, data: 300, upgrades: unlockPath('awaken') }),
        // A few bosses down, deep pockets, core combat nodes owned.
        midgame: () => ({
            isFirstLaunch: false, ...RICH, currentLevel: 3, levelsDefeated: 2, minibossLevelsDefeated: 2,
            // Lower part of the tree (first 4 grid rows), skipping shard-cost duo-box choices.
            upgrades: unlockPath(NODE_DEFS.filter(d => d.treeY >= gridY(4) && d.costType !== 'shard').map(d => d.id)),
        }),
        // Financial Breach owned → TAKEOVER button visible in the upgrade phase.
        takeover: () => ({ isFirstLaunch: false, ...RICH, levelsDefeated: 3, upgrades: unlockPath('financial_breach') }),
        // Everything maxed — for checking late-game visuals and performance.
        maxed: () => ({ isFirstLaunch: false, ...RICH, currentLevel: 5, levelsDefeated: 5, minibossLevelsDefeated: 5, upgrades: allMaxed() }),
    };

    function loadPreset(name, overrides = {}) {
        if (!PRESETS[name]) throw new Error(`unknown preset '${name}'. Available: ${Object.keys(PRESETS).join(', ')}`);
        const partial = _deepMerge(PRESETS[name](), overrides);
        if (name === 'fresh') {
            _backupOnce();
            localStorage.removeItem(SAVE_KEY);
            window.saveGame = () => {};
            location.reload();
            return { preset: name };
        }
        return { preset: name, ...loadSave(partial) };
    }

    // ── Live controls ────────────────────────────────────────────────────────

    function waitForBoot(timeoutMs = 20000) {
        const start = Date.now();
        return new Promise((resolve, reject) => {
            (function poll() {
                const phase = typeof gameStateMachine !== 'undefined' && gameStateMachine.getPhase();
                if (window.AXIOM_BOOTSTRAP_COMPLETE && phase) return window.AZT.ready.then(() => resolve(state()), reject);
                if (Date.now() - start > timeoutMs) return reject(new Error('game did not boot within ' + timeoutMs + 'ms'));
                setTimeout(poll, 250);
            })();
        });
    }

    const wait = (ms) => new Promise(r => setTimeout(r, ms));

    function grant(res) {
        const map = { data: 'addData', insight: 'addInsight', shard: 'addShard', processor: 'addProcessor', coin: 'addCoin' };
        for (const k in res) {
            if (!map[k]) throw new Error(`unknown resource '${k}'`);
            resourceManager[map[k]](res[k]);
        }
        return state().resources;
    }

    function combat() {
        transitionManager.transitionTo(GAME_CONSTANTS.PHASE_COMBAT);
        return wait(GAME_CONSTANTS.TRANSITION_DURATION + 400).then(() => gameStateMachine.getPhase());
    }

    function upgrades() {
        transitionManager.transitionTo(GAME_CONSTANTS.PHASE_UPGRADE);
        return wait(GAME_CONSTANTS.TRANSITION_DURATION + 400).then(() => gameStateMachine.getPhase());
    }

    // ── Real input ───────────────────────────────────────────────────────────
    // Dispatches DOM mouse events on the canvas at game coordinates, so a click
    // travels the same path as a player's: Phaser input (zones, interactive
    // objects) → mouseManager → messageBus → buttonManager (Button class).

    function toClient(x, y) {
        const r = PhaserScene.game.canvas.getBoundingClientRect();
        return {
            clientX: r.left + x * (r.width / PhaserScene.scale.width),
            clientY: r.top + y * (r.height / PhaserScene.scale.height),
        };
    }

    function _mouse(type, x, y) {
        const { clientX, clientY } = toClient(x, y);
        PhaserScene.game.canvas.dispatchEvent(new MouseEvent(type, {
            clientX, clientY, bubbles: true, cancelable: true, view: window,
            button: 0, buttons: type === 'mousedown' ? 1 : 0,
        }));
    }

    /** Hover, press and release at game coordinates (1600x900 space). */
    async function clickAt(x, y) {
        _mouse('mousemove', x, y);
        await wait(50);
        _mouse('mousedown', x, y);
        await wait(80);
        _mouse('mouseup', x, y);
        await wait(80);
        return `clicked (${Math.round(x)}, ${Math.round(y)})`;
    }

    /** Press and hold at game coordinates for `ms` (hold-to-confirm buttons). */
    async function holdAt(x, y, ms = 900) {
        _mouse('mousemove', x, y);
        await wait(50);
        _mouse('mousedown', x, y);
        await wait(ms);
        _mouse('mouseup', x, y);
        await wait(80);
        return `held (${Math.round(x)}, ${Math.round(y)}) for ${ms}ms`;
    }

    async function hoverAt(x, y) {
        _mouse('mousemove', x, y);
        await wait(50);
        return `hovered (${Math.round(x)}, ${Math.round(y)})`;
    }

    // ── Display-list queries ─────────────────────────────────────────────────

    function _allObjects() {
        const out = [];
        const walk = (list) => { for (const o of list) { out.push(o); if (o.list) walk(o.list); } };
        walk(PhaserScene.children.list);
        return out;
    }

    function _isShown(o) {
        for (let p = o; p; p = p.parentContainer) {
            if (!p.active || !p.visible || p.alpha <= 0.01) return false;
        }
        return true;
    }

    function _depth(o) {
        let d = o.depth || 0;
        for (let p = o.parentContainer; p; p = p.parentContainer) d = Math.max(d, p.depth || 0);
        return d;
    }

    function _describe(o) {
        // Plain data only, so results stay JSON-serializable when returned from javascript_tool.
        const b = o.getBounds();
        return { x: Math.round(b.centerX), y: Math.round(b.centerY), w: Math.round(b.width), h: Math.round(b.height), depth: _depth(o) };
    }

    const _matches = (s, match) => (match instanceof RegExp ? match.test(s) : s.toLowerCase().includes(String(match).toLowerCase()));

    /** Visible text objects whose content matches (substring, case-insensitive, or RegExp). Topmost first. */
    function findTexts(match, { minDepth = -Infinity } = {}) {
        return _allObjects()
            .filter(o => o.type === 'Text' && _isShown(o) && _matches(o.text, match))
            .map(o => ({ text: o.text, ..._describe(o) }))
            .filter(t => t.depth >= minDepth)
            .sort((a, b) => b.depth - a.depth);
    }

    /** Visible images/sprites showing an atlas frame (exact name, prefix match, or RegExp). Topmost first. */
    function findFrames(match, { minDepth = -Infinity } = {}) {
        const test = (name) => (match instanceof RegExp ? match.test(name) : name === match || name.startsWith(match));
        return _allObjects()
            .filter(o => o.frame && o.frame.name && _isShown(o) && test(String(o.frame.name)))
            .map(o => ({ frame: o.frame.name, ..._describe(o) }))
            .filter(t => t.depth >= minDepth)
            .sort((a, b) => b.depth - a.depth);
    }

    /** Click the topmost visible text matching `match`. Throws if none is on screen. */
    async function clickText(match, opts) {
        const hit = findTexts(match, opts)[0];
        if (!hit) throw new Error(`clickText: no visible text matching ${match}`);
        await clickAt(hit.x, hit.y);
        return `clicked "${hit.text}" at (${hit.x}, ${hit.y})`;
    }

    /** Press and hold the topmost visible text matching `match`. */
    async function holdText(match, ms = 900, opts) {
        const hit = findTexts(match, opts)[0];
        if (!hit) throw new Error(`holdText: no visible text matching ${match}`);
        await holdAt(hit.x, hit.y, ms);
        return `held "${hit.text}" for ${ms}ms`;
    }

    async function clickFrame(match, opts) {
        const hit = findFrames(match, opts)[0];
        if (!hit) throw new Error(`clickFrame: no visible frame matching ${match}`);
        await clickAt(hit.x, hit.y);
        return `clicked [${hit.frame}] at (${hit.x}, ${hit.y})`;
    }

    /** All visible text above `minDepth`, top-to-bottom then left-to-right — a cheap text "screenshot". */
    function screenTexts(minDepth = -Infinity) {
        return findTexts(/[\s\S]/, { minDepth })
            .sort((a, b) => (a.y - b.y) || (a.x - b.x))
            .map(t => t.text.replace(/\n/g, ' ⏎ '));
    }

    function spawn(type, count = 1, radius = 350) {
        const pos = tower.getPosition();
        let ok = 0;
        for (let i = 0; i < count; i++) {
            const a = (i / count) * Math.PI * 2;
            if (enemyManager.spawnAt(type, pos.x + Math.cos(a) * radius, pos.y + Math.sin(a) * radius)) ok++;
        }
        return `${ok}/${count} '${type}' spawned`;
    }

    function spawnMiniboss(forceType = null) {
        bossManager.spawnMiniboss(waveManager.getProgress(), true, 1, forceType);
        return 'miniboss spawned';
    }

    function spawnBoss() {
        bossManager.spawnBoss(waveManager.getProgress());
        return 'boss spawned';
    }

    let _godFn = null;
    function god(on = true) {
        if (on && !_godFn) {
            _godFn = () => { if (tower.isAlive() && tower.getHealth() < tower.getMaxHealth()) tower.setHealth(tower.getMaxHealth()); };
            updateManager.addFunction(_godFn);
        } else if (!on && _godFn) {
            if (updateManager.removeFunction) updateManager.removeFunction(_godFn);
            _godFn = null;
        }
        return `god mode ${on ? 'on' : 'off'}`;
    }

    function speed(scale = 1) {
        timeManager.applyTimeScale(scale);
        return `time scale ${scale}`;
    }

    function state() {
        const owned = Object.entries(gameState.upgrades || {}).filter(([, v]) => v > 0);
        return {
            phase: gameStateMachine.getPhase(),
            level: gameState.currentLevel,
            levelsDefeated: gameState.levelsDefeated,
            resources: {
                data: gameState.data, insight: gameState.insight, shard: gameState.shard,
                processor: gameState.processor, coin: gameState.coin,
            },
            upgradesOwned: owned.length,
            tower: typeof tower !== 'undefined' && tower.isAlive
                ? { alive: tower.isAlive(), hp: Math.round(tower.getHealth()), maxHp: Math.round(tower.getMaxHealth()) }
                : null,
            enemies: typeof enemyManager !== 'undefined' ? enemyManager.getEnemyCount() : null,
            bossAlive: typeof bossManager !== 'undefined' ? bossManager.isBossAlive() : null,
            takeover: gameState.takeoverState ? { active: !!gameState.takeoverState.activeAttack } : null,
            playtestBackup: hasBackup(),
        };
    }

    window.AZT = {
        state, loadSave, loadPreset, restore, hasBackup, waitForBoot, wait,
        grant, combat, upgrades, spawn, spawnMiniboss, spawnBoss, god, speed,
        unlockPath, allMaxed, nodes, presets: Object.keys(PRESETS),
        toClient, clickAt, holdAt, hoverAt, findTexts, findFrames, clickText, holdText, clickFrame, screenTexts,
    };

    // ── Extensions ───────────────────────────────────────────────────────────
    // Mechanic-specific helpers live in their own files and attach to AZT
    // (e.g. AZT.takeover). waitForBoot() also waits for these to load.
    const EXTENSIONS = ['/tools/playtest-takeover.js'];
    const _loadScript = (src) => new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = src + '?' + Date.now();
        s.onload = resolve;
        s.onerror = () => reject(new Error('failed to load ' + src));
        document.head.appendChild(s);
    });
    window.AZT.ready = Promise.all(EXTENSIONS.map(_loadScript))
        .then(() => console.log('[playtest] AZT ready:', Object.keys(window.AZT).join(', ')));
})();
