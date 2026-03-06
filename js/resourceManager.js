// resourceManager.js — Currency state and DATA drop objects.
// DATA drops spawn at enemy death positions, drift to a resting spot,
// then "fly" toward the cursor when within pickup radius.
// When close enough (Manhattan ≤ FLY_COLLECT_DIST), they are collected.

const resourceManager = (() => {
    const DROP_POOL_SIZE = 1200;
    const FLY_SPEED = 320;  // px/sec while flying toward cursor
    const FLY_COLLECT_DIST = 14;   // Manhattan distance (px) — no sqrt needed

    let dropPool = [];
    let activeDrops = [];   // resting drops waiting for cursor proximity
    let flyingDrops = [];   // drops currently flying toward cursor
    let processorPool = []; // Pool for processor resources

    let totalDropsSpawned = 0;

    // Session tracking — reset each combat session for the summary screen
    let sessionData = 0;
    let sessionInsight = 0;
    let sessionShards = 0;
    let sessionProcessors = 0;
    let sessionCoins = 0;

    // ── init ─────────────────────────────────────────────────────────────────

    function init() {
        _buildPool();
        _buildProcessorPool();
        messageBus.subscribe('enemyKilled', _onEnemyKilled);
        messageBus.subscribe('phaseChanged', _onPhaseChanged);
        messageBus.subscribe('minibossDefeated', _onMinibossDefeated);
        updateManager.addFunction(_update);
    }

    function _buildPool() {
        for (let i = 0; i < DROP_POOL_SIZE; i++) {
            const img = PhaserScene.add.image(0, 0, 'player', 'resrc_data.png');
            img.setScale(0.75);
            img.setDepth(GAME_CONSTANTS.DEPTH_RESOURCES);
            img.setVisible(false);
            img.setActive(false);
            dropPool.push({
                img: img,
                alive: false,
                flying: false,
                readyToCollect: false,
                x: 0, y: 0,
                type: 'data',
                spawnTween: null,
            });
        }
    }

    function _buildProcessorPool() {
        const PROCESSOR_POOL_SIZE = 100;
        for (let i = 0; i < PROCESSOR_POOL_SIZE; i++) {
            const img = PhaserScene.add.image(0, 0, 'player', 'resrc_processor.png');
            img.setScale(0.85);
            img.setDepth(GAME_CONSTANTS.DEPTH_RESOURCES);
            img.setVisible(false);
            img.setActive(false);
            processorPool.push({
                img: img,
                alive: false,
                flying: false,
                readyToCollect: false,
                x: 0, y: 0,
                type: 'processor',
                spawnTween: null,
            });
        }
    }

    // ── public API ───────────────────────────────────────────────────────────

    function spawnProcessorDrop(x, y) {
        const d = _getProcessorFromPool();
        if (!d) return;
        _setupDrop(d, x, y);
    }

    function spawnDataDrop(x, y) {
        const d = _getFromPool();
        if (!d) return;

        _setupDrop(d, x, y);
    }

    function _setupDrop(d, x, y) {
        totalDropsSpawned++;

        d.x = x;
        d.y = y;
        d.dx = 0;
        d.dy = 0;
        d.alive = true;
        d.flying = false;
        d.readyToCollect = false;
        d.inertia = -0.1;

        // Visibility logic
        let visible = true;
        if (d.type === 'data') {
            if (totalDropsSpawned > 600) {
                visible = (totalDropsSpawned % 3) === 1;
            } else if (totalDropsSpawned > 300) {
                visible = (totalDropsSpawned % 3) !== 0;
            }
        }

        d.img.setAlpha(visible ? 1 : 0);
        d.img.setVisible(visible);
        d.img.setActive(true);

        const angle = Math.random() * Math.PI * 2;
        const dist = 3 + Math.random() * 38;

        const awayDx = x - GAME_CONSTANTS.halfWidth;
        const awayDy = y - GAME_CONSTANTS.halfHeight;
        const awayLen = Math.sqrt(awayDx * awayDx + awayDy * awayDy) || 1;

        const distAwayX = Math.cos(angle) * dist + (awayDx / awayLen) * 5;
        const distAwayY = Math.sin(angle) * dist + (awayDy / awayLen) * 5;
        let endX = x + distAwayX;
        let endY = y + distAwayY;

        d.img.setPosition(x + 0.6 * distAwayX, y + 0.6 * distAwayY);


        endX = Math.max(-1, Math.min(GAME_CONSTANTS.WIDTH + 1, endX));
        endY = Math.max(-1, Math.min(GAME_CONSTANTS.HEIGHT + 1, endY));



        d.spawnTween = PhaserScene.tweens.add({
            targets: d.img,
            x: endX,
            y: endY,
            duration: 220 + dist * 12,
            ease: 'Cubic.easeOut',
            onComplete: () => {
                d.x = d.img.x;
                d.y = d.img.y;
                d.spawnTween = null;
            }
        });

        activeDrops.push(d);
    }

    function addData(amount) {
        gameState.data = (gameState.data || 0) + amount;
        sessionData += amount;
        messageBus.publish('currencyChanged', 'data', gameState.data, amount);
    }

    function addInsight(amount) {
        gameState.insight = (gameState.insight || 0) + amount;
        sessionInsight += amount;
        messageBus.publish('currencyChanged', 'insight', gameState.insight, amount);
    }

    function addShard(amount) {
        gameState.shard = (gameState.shard || 0) + amount;
        sessionShards += amount;
        messageBus.publish('currencyChanged', 'shard', gameState.shard, amount);
    }

    function addProcessor(amount) {
        gameState.processor = (gameState.processor || 0) + amount;
        sessionProcessors += amount;
        messageBus.publish('currencyChanged', 'processor', gameState.processor, amount);
    }

    function addCoin(amount) {
        gameState.coin = (gameState.coin || 0) + amount;
        sessionCoins += amount;
        messageBus.publish('currencyChanged', 'coin', gameState.coin, amount);
    }

    function getData() { return gameState.data || 0; }
    function getInsight() { return gameState.insight || 0; }
    function getShards() { return gameState.shard || 0; }
    function getProcessors() { return gameState.processor || 0; }
    function getCoins() { return gameState.coin || 0; }
    function getSessionData() { return sessionData; }
    function getSessionInsight() { return sessionInsight; }
    function getSessionShards() { return sessionShards; }
    function getSessionProcessors() { return sessionProcessors; }
    function getSessionCoins() { return sessionCoins; }

    function resetSession() {
        sessionData = 0;
        sessionInsight = 0;
        sessionShards = 0;
        sessionProcessors = 0;
        sessionCoins = 0;
        totalDropsSpawned = 0;
    }

    /**
     * Silently removes all resting drops from the scene.
     * Flying drops are collected (added to currency) before being removed,
     * so resources in transit are never lost on phase change or death.
     */
    function clearDrops() {
        // Cash out any flying resources before clearing
        _collectAllFlying();

        for (let i = activeDrops.length - 1; i >= 0; i--) {
            _deactivate(activeDrops[i]);
        }
        activeDrops.length = 0;
    }

    // ── internals ────────────────────────────────────────────────────────────

    function _getFromPool() {
        for (let i = 0; i < dropPool.length; i++) {
            if (!dropPool[i].alive) {
                dropPool[i].type = 'data';
                return dropPool[i];
            }
        }
        return null;
    }

    function _getProcessorFromPool() {
        for (let i = 0; i < processorPool.length; i++) {
            if (!processorPool[i].alive) return processorPool[i];
        }
        return null;
    }

    function _deactivate(d) {
        if (d.spawnTween) { d.spawnTween.stop(); d.spawnTween = null; }
        d.alive = false;
        d.flying = false;
        d.readyToCollect = false;
        d.inertia = -0.1;
        d.img.setVisible(false);
        d.img.setActive(false);
    }

    /** Instantly collect all flying drops and credit their value. */
    function _collectAllFlying() {
        for (let i = 0; i < flyingDrops.length; i++) {
            const d = flyingDrops[i];
            _deactivate(d);
            if (d.type === 'processor') addProcessor(1);
            else addData(1);
        }
        flyingDrops.length = 0;
    }

    // ── per-frame ────────────────────────────────────────────────────────────

    function _update(delta) {
        if (activeDrops.length === 0 && flyingDrops.length === 0) return;

        const dt = delta / 1000;
        const cx = GAME_VARS.mouseposx;
        const cy = GAME_VARS.mouseposy;
        const pickupR2 = GAME_CONSTANTS.DATA_PICKUP_RADIUS * GAME_CONSTANTS.DATA_PICKUP_RADIUS;

        // ── Resting drops: check if cursor entered pickup radius → start flying ──
        for (let i = activeDrops.length - 1; i >= 0; i--) {
            const d = activeDrops[i];
            if (!d.alive) { activeDrops.splice(i, 1); continue; }

            const dx = d.x - cx;
            const dy = d.y - cy;
            if (dx * dx + dy * dy < pickupR2) {
                // Stop any spawn tween — we'll drive position manually from here
                if (d.spawnTween) { d.spawnTween.stop(); d.spawnTween = null; }

                // Sync logical position from sprite in case spawn tween was mid-flight
                d.x = d.img.x;
                d.y = d.img.y;
                d.flying = true;

                activeDrops.splice(i, 1);
                flyingDrops.push(d);
            }
        }

        // ── Flying drops: move toward current cursor position each frame ──
        const flyStep = FLY_SPEED * dt;

        for (let i = flyingDrops.length - 1; i >= 0; i--) {
            const d = flyingDrops[i];

            if (d.readyToCollect) {
                _deactivate(d);
                if (d.type === 'processor') addProcessor(1);
                else addData(1);

                // Play random pop sound on collection
                const popNum = Math.floor(Math.random() * 3) + 1;
                audio.play('pop' + popNum, 0.45 + Math.random() * 0.1);

                flyingDrops.splice(i, 1);
                continue;
            }

            const dx = cx - d.x;
            const dy = cy - d.y;

            // Collect check — Manhattan distance, no sqrt needed
            if (Math.abs(dx) + Math.abs(dy) <= FLY_COLLECT_DIST * d.inertia) {
                d.readyToCollect = true;
            }

            // Move: normalize with sqrt (small array, fine here) then step
            const len = Math.sqrt(dx * dx + dy * dy);
            const move = Math.min(flyStep * d.inertia, len);  // don't overshoot cursor

            const predictDx = dx - d.dx * 2;
            const predictDy = dy - d.dy * 2;

            const moveAmtX = (predictDx / len) * move;
            const moveAmtY = (predictDy / len) * move;
            d.dx += moveAmtX;
            d.dy += moveAmtY;
            d.x += moveAmtX + d.dx;
            d.y += moveAmtY + d.dy;
            d.dx *= 0.95 - 0.05 * d.inertia;
            d.dy *= 0.95 - 0.05 * d.inertia;

            if (d.inertia < 1) {
                d.inertia = Math.min(1, d.inertia + 0.75 * dt);
            }
            d.img.setPosition(d.x, d.y);
        }
    }

    // ── event handlers ───────────────────────────────────────────────────────

    let dropAccumulator = 0;

    function _onEnemyKilled(x, y, baseResourceDrop) {
        const config = getCurrentLevelConfig();
        const levelMult = config.resourceMult || 1;
        const totalDrop = baseResourceDrop * levelMult;

        // Add to the fractional drop accumulator
        dropAccumulator += totalDrop;

        // Spawn drops for any whole numbers gained
        while (dropAccumulator >= 1) {
            spawnDataDrop(x, y);
            dropAccumulator -= 1;
        }

        // The remaining fraction is naturally preserved for future death checks
    }

    function _onMinibossDefeated(x, y) {
        addShard(1);
    }

    function _onPhaseChanged(phase) {
        if (phase === GAME_CONSTANTS.PHASE_COMBAT) {
            resetSession();
        } else if (phase === GAME_CONSTANTS.PHASE_WAVE_COMPLETE || phase === GAME_CONSTANTS.PHASE_UPGRADE
            || phase === GAME_CONSTANTS.PHASE_GAME_OVER) {
            clearDrops();  // flying drops are cashed out inside clearDrops()
        }
    }

    return {
        init, spawnDataDrop, spawnProcessorDrop, addData, addInsight, addShard, addProcessor, addCoin,
        getData, getInsight, getShards, getProcessors, getCoins,
        getSessionData, getSessionInsight, getSessionShards, getSessionProcessors, getSessionCoins,
        resetSession, clearDrops,
    };
})();
