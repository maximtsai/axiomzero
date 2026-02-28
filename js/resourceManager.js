// resourceManager.js — Currency state and DATA drop objects.
// DATA drops spawn at enemy death positions, drift downward,
// and are collected when the cursor passes within pickup radius.

const resourceManager = (() => {
    const DROP_POOL_SIZE = 1200;

    let dropPool = [];
    let activeDrops = [];
    let dropTexKey = null;
    let totalDropsSpawned = 0;

    // Session tracking — reset each combat session for the summary screen
    let sessionData = 0;
    let sessionInsight = 0;

    // ── init ─────────────────────────────────────────────────────────────────

    function init() {
        _generateTexture();
        _buildPool();
        messageBus.subscribe('enemyKilled', _onEnemyKilled);
        messageBus.subscribe('phaseChanged', _onPhaseChanged);
        updateManager.addFunction(_update);
    }

    function _generateTexture() {
        // Small diamond shape for DATA drops
        const size = 10;
        const gfx = PhaserScene.add.graphics();
        gfx.fillStyle(GAME_CONSTANTS.COLOR_FRIENDLY, 1);
        gfx.fillPoints([
            { x: size / 2, y: 0 },
            { x: size,     y: size / 2 },
            { x: size / 2, y: size },
            { x: 0,        y: size / 2 },
        ], true);
        gfx.generateTexture('data_drop', size, size);
        gfx.destroy();
        dropTexKey = 'data_drop';
    }

    function _buildPool() {
        for (let i = 0; i < DROP_POOL_SIZE; i++) {
            const img = PhaserScene.add.image(0, 0, dropTexKey);
            img.setDepth(GAME_CONSTANTS.DEPTH_RESOURCES);
            img.setVisible(false);
            img.setActive(false);
            dropPool.push({
                img: img,
                alive: false,
                x: 0, y: 0,
                life: 0,
                maxLife: 0,
            });
        }
    }

    // ── public API ───────────────────────────────────────────────────────────

    function spawnDataDrop(x, y) {
        const d = _getFromPool();
        if (!d) return;

        totalDropsSpawned++;

        d.x = x;
        d.y = y;
        d.alive = true;
        d.life = GAME_CONSTANTS.DATA_DECAY_TIME;
        d.maxLife = GAME_CONSTANTS.DATA_DECAY_TIME;
        d.img.setPosition(x, y);
        
        // Visibility logic based on total drops spawned
        let visible = true;
        if (totalDropsSpawned > 600) {
            // After 600: 2 of every 3 drops invisible
            visible = (totalDropsSpawned % 3) === 1;
        } else if (totalDropsSpawned > 300) {
            // After 300: every 3rd drop invisible
            visible = (totalDropsSpawned % 3) !== 0;
        }
        
        d.img.setAlpha(visible ? 1 : 0);
        d.img.setVisible(visible);
        d.img.setActive(true);
        activeDrops.push(d);
    }

    function addData(amount) {
        gameState.data = (gameState.data || 0) + amount;
        sessionData += amount;
        messageBus.publish('currencyChanged', 'data', gameState.data);
    }

    function addInsight(amount) {
        gameState.insight = (gameState.insight || 0) + amount;
        sessionInsight += amount;
        messageBus.publish('currencyChanged', 'insight', gameState.insight);
    }

    function getData()    { return gameState.data    || 0; }
    function getInsight() { return gameState.insight  || 0; }
    function getSessionData()    { return sessionData; }
    function getSessionInsight() { return sessionInsight; }

    function resetSession() {
        sessionData = 0;
        sessionInsight = 0;
        totalDropsSpawned = 0;
    }

    function clearDrops() {
        for (let i = activeDrops.length - 1; i >= 0; i--) {
            _deactivate(activeDrops[i]);
        }
        activeDrops.length = 0;
    }

    // ── internals ────────────────────────────────────────────────────────────

    function _getFromPool() {
        for (let i = 0; i < dropPool.length; i++) {
            if (!dropPool[i].alive) return dropPool[i];
        }
        return null;
    }

    function _deactivate(d) {
        d.alive = false;
        d.img.setVisible(false);
        d.img.setActive(false);
    }

    // ── per-frame ────────────────────────────────────────────────────────────

    function _update(delta) {
        if (activeDrops.length === 0) return;

        const dt = delta / 1000;
        const cx = GAME_VARS.mouseposx;
        const cy = GAME_VARS.mouseposy;
        const pickupR2 = GAME_CONSTANTS.DATA_PICKUP_RADIUS * GAME_CONSTANTS.DATA_PICKUP_RADIUS;

        for (let i = activeDrops.length - 1; i >= 0; i--) {
            const d = activeDrops[i];
            if (!d.alive) { activeDrops.splice(i, 1); continue; }

            // Slow downward drift
            d.y += GAME_CONSTANTS.DATA_DRIFT_SPEED * dt;
            d.img.setPosition(d.x, d.y);

            // Decay
            d.life -= delta;
            const alpha = Math.max(0, d.life / d.maxLife);
            d.img.setAlpha(alpha);
            if (d.life <= 0) {
                _deactivate(d);
                activeDrops.splice(i, 1);
                continue;
            }

            // Cursor pickup
            const dx = d.x - cx;
            const dy = d.y - cy;
            if (dx * dx + dy * dy < pickupR2) {
                _collectDrop(d);
                activeDrops.splice(i, 1);
            }
        }
    }

    function _collectDrop(d) {
        // Quick tween toward cursor then destroy
        PhaserScene.tweens.add({
            targets: d.img,
            x: GAME_VARS.mouseposx,
            y: GAME_VARS.mouseposy,
            alpha: 0,
            duration: 150,
            ease: 'Cubic.easeIn',
            onComplete: () => { _deactivate(d); },
        });
        d.alive = false; // mark dead immediately to prevent double-collect
        addData(1);
    }

    // ── event handlers ───────────────────────────────────────────────────────

    function _onEnemyKilled(x, y) {
        if (Math.random() < GAME_CONSTANTS.DATA_DROP_CHANCE) {
            spawnDataDrop(x, y);
        }
    }

    function _onPhaseChanged(phase) {
        if (phase === 'WAVE_ACTIVE') {
            resetSession();
        } else if (phase === 'WAVE_COMPLETE' || phase === 'UPGRADE_PHASE') {
            clearDrops();
        }
    }

    return {
        init, spawnDataDrop, addData, addInsight,
        getData, getInsight,
        getSessionData, getSessionInsight, resetSession,
        clearDrops,
    };
})();
