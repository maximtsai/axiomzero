// resourceManager.js — Currency state and DATA drop objects.
// DATA drops spawn at enemy death positions, drift to a resting spot,
// then "fly" toward the cursor when within pickup radius.
// When close enough (Manhattan ≤ FLY_COLLECT_DIST), they are collected.

const resourceManager = (() => {
    const DROP_POOL_SIZE = 1200;
    const FLY_SPEED = 800;  // px/sec while flying toward cursor
    const FLY_COLLECT_DIST = 20;   // Manhattan distance (px) — no sqrt needed

    let dropPool = [];
    let activeDrops = [];   // resting drops waiting for cursor proximity
    let flyingDrops = [];   // drops currently flying toward cursor
    let processorPool = []; // Pool for processor resources
    let paused = false;     // true when options menu is open
    let shardIsFlying = false; // Guard to ensure miniboss shards are always collected

    let totalDropsSpawned = 0;
    let currentPickupRadius2 = 0;

    // Session tracking — reset each combat session for the summary screen
    let sessionData = 0;
    let sessionInsight = 0;
    let sessionShards = 0;
    let sessionProcessors = 0;
    let sessionCoins = 0;

    // ── init ─────────────────────────────────────────────────────────────────

    function init() {
        dropPool = new ObjectPool(
            () => {
                const img = PhaserScene.add.image(0, 0, 'player', 'resrc_data.png');
                img.setScale(0.75);
                img.setDepth(GAME_CONSTANTS.DEPTH_RESOURCES);
                img.setVisible(false);
                img.setActive(false);
                return {
                    img: img,
                    alive: false,
                    flying: false,
                    readyToCollect: false,
                    x: 0, y: 0,
                    type: 'data',
                    spawnTween: null,
                };
            },
            _resetDrop,
            DROP_POOL_SIZE
        ).preAllocate(DROP_POOL_SIZE);

        processorPool = new ObjectPool(
            () => {
                const img = PhaserScene.add.image(0, 0, 'player', 'resrc_processor.png');
                img.setScale(0.85);
                img.setDepth(GAME_CONSTANTS.DEPTH_RESOURCES);
                img.setVisible(false);
                img.setActive(false);
                return {
                    img: img,
                    alive: false,
                    flying: false,
                    readyToCollect: false,
                    x: 0, y: 0,
                    type: 'processor',
                    spawnTween: null,
                };
            },
            _resetDrop,
            100
        ).preAllocate(100);

        messageBus.subscribe('enemyKilled', _onEnemyKilled);
        messageBus.subscribe('phaseChanged', _onPhaseChanged);
        messageBus.subscribe('minibossDefeated', _onMinibossDefeated);
        messageBus.subscribe('triggerResourceVacuum', _vacuumAllDrops);
        messageBus.subscribe('upgradePurchased', (id) => {
            if (id === 'magnet') _recalcPickupRadius();
        });
        messageBus.subscribe('gamePaused', () => { paused = true; });
        messageBus.subscribe('gameResumed', () => { paused = false; });
        _recalcPickupRadius();
        updateManager.addFunction(_update);
    }

    function _resetDrop(d) {
        if (d.spawnTween) { d.spawnTween.stop(); d.spawnTween = null; }
        d.alive = false;
        d.flying = false;
        d.readyToCollect = false;
        d.inertia = -0.08;
        d.img.setVisible(false);
        d.img.setActive(false);
    }


    // ── public API ───────────────────────────────────────────────────────────

    function spawnProcessorDrop(x, y) {
        if (!processorPool) return;
        const d = processorPool.get();
        if (!d) return;
        _setupDrop(d, x, y);
    }

    function spawnDataDrop(x, y) {
        if (!dropPool) return;
        const d = dropPool.get();
        if (!d) return;

        _setupDrop(d, x, y);
    }

    function spawnShardDrop(x, y) {
        shardIsFlying = true;
        const img = PhaserScene.add.image(x, y, 'player', 'resrc_shard.png');
        img.setScale(1.0);
        img.setDepth(GAME_CONSTANTS.DEPTH_RESOURCES);

        const d = {
            img: img,
            alive: true,
            flying: false,
            readyToCollect: false,
            x: x,
            y: y,
            dx: 0,
            dy: 0,
            inertia: -0.05,
            type: 'shard',
            spawnTween: null,
        };

        const angle = Math.random() * Math.PI * 2;
        const dist = 50 + Math.random() * 30;
        const endX = x + Math.cos(angle) * dist;
        const endY = y + Math.sin(angle) * dist;

        d.spawnTween = PhaserScene.tweens.add({
            targets: d.img,
            x: endX,
            y: endY,
            duration: 1000,
            ease: 'Cubic.easeOut',
            onComplete: () => {
                d.x = d.img.x;
                d.y = d.img.y;
                d.spawnTween = null;
                d.flying = true;

                // Automatically move to flying list
                const idx = activeDrops.indexOf(d);
                if (idx !== -1) {
                    activeDrops.splice(idx, 1);
                    flyingDrops.push(d);
                }
            }
        });

        activeDrops.push(d);
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
        d.inertia = -0.08;

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
        if (amount > 0) shardIsFlying = false;
        gameState.shard = (gameState.shard || 0) + amount;
        sessionShards += amount;
        messageBus.publish('currencyChanged', 'shard', gameState.shard, amount);

        if (amount > 0) {
            floatingText.show(GAME_VARS.mouseposx, GAME_VARS.mouseposy - 25, '+1 SHARD ACQUIRED', {
                fontFamily: 'JetBrainsMono_Bold',
                fontSize: 22,
                color: '#ff5555',
                depth: GAME_CONSTANTS.DEPTH_UI + 100,
            });
        }
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
        shardIsFlying = false;
    }

    /**
     * Silently removes all resting drops from the scene.
     * Flying drops are collected (added to currency) before being removed,
     * so resources in transit are never lost on phase change or death.
     */
    function clearDrops() {
        // Cash out any flying resources before clearing
        _collectAllFlying();

        if (shardIsFlying) {
            addShard(1);
            shardIsFlying = false;
        }

        for (let i = activeDrops.length - 1; i >= 0; i--) {
            _deactivate(activeDrops[i]);
        }
        activeDrops.length = 0;
    }

    function _recalcPickupRadius() {
        const ups = gameState.upgrades || {};
        const magnetLv = ups.magnet || 0;
        const base = GAME_CONSTANTS.DATA_PICKUP_RADIUS;
        const mult = 1 + (0.4 * magnetLv);
        let finalR = base * mult;

        // Mobile bonus: +20px range (unscaled)
        if (helper.isMobileDevice()) {
            finalR += 20;
        }

        currentPickupRadius2 = finalR * finalR;
    }

    function _deactivate(d) {
        _resetDrop(d); // Hide visual and stop tweens immediately
        if (d.type === 'processor') processorPool.release(d);
        else if (d.type === 'shard') {
            d.img.destroy();
        }
        else dropPool.release(d);
    }

    /** Instantly collect all flying drops and credit their value. */
    function _collectAllFlying() {
        for (let i = 0; i < flyingDrops.length; i++) {
            const d = flyingDrops[i];
            _deactivate(d);
            if (d.type === 'processor') addProcessor(1);
            else if (d.type === 'shard') addShard(1);
            else addData(1);
        }
        flyingDrops.length = 0;
    }

    /** Forces all currently resting drops and incoming spawn drops to immediately fly to cursor at high speed. */
    function _vacuumAllDrops() {
        for (let i = activeDrops.length - 1; i >= 0; i--) {
            const d = activeDrops[i];

            if (d.spawnTween) { d.spawnTween.stop(); d.spawnTween = null; }
            d.x = d.img.x;
            d.y = d.img.y;
            d.flying = true;
            d.inertia = 0;

            flyingDrops.push(d);
        }
        activeDrops.length = 0;

        // // Also boost any drops already flying
        // for (let i = 0; i < flyingDrops.length; i++) {
        //     flyingDrops[i].inertia = 1;
        // }
    }

    // ── per-frame ────────────────────────────────────────────────────────────

    let frameCounter = 0;
    function _update(delta) {
        if ((activeDrops.length === 0 && flyingDrops.length === 0) || paused) return;

        frameCounter++;
        const dt = delta / 1000;
        const cx = GAME_VARS.mouseposx;
        const cy = GAME_VARS.mouseposy;
        const pickupR2 = currentPickupRadius2;

        // ── Resting drops: check if cursor entered pickup radius → start flying ──
        // Optimized: only check distance once every 4 frames to reduce overhead
        if (frameCounter % 4 === 0) {
            for (let i = activeDrops.length - 1; i >= 0; i--) {
                const d = activeDrops[i];
                if (!d.alive) {
                    activeDrops[i] = activeDrops[activeDrops.length - 1];
                    activeDrops.pop();
                    continue;
                }

                const dx = d.x - cx;
                const dy = d.y - cy;
                if (dx * dx + dy * dy < pickupR2) {
                    // Stop any spawn tween — we'll drive position manually from here
                    if (d.spawnTween) { d.spawnTween.stop(); d.spawnTween = null; }

                    // Sync logical position from sprite in case spawn tween was mid-flight
                    d.x = d.img.x;
                    d.y = d.img.y;
                    d.flying = true;

                    flyingDrops.push(d);
                    activeDrops[i] = activeDrops[activeDrops.length - 1];
                    activeDrops.pop();
                }
            }
        }

        // ── Flying drops: move toward current cursor position each frame ──
        const flyStep = FLY_SPEED * dt;

        for (let i = flyingDrops.length - 1; i >= 0; i--) {
            const d = flyingDrops[i];

            if (d.readyToCollect) {
                _deactivate(d);
                if (d.type === 'processor') addProcessor(1);
                else if (d.type === 'shard') addShard(1);
                else addData(1);

                flyingDrops[i] = flyingDrops[flyingDrops.length - 1];
                flyingDrops.pop();
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

            const predictDx = dx - d.dx * 1.5;
            const predictDy = dy - d.dy * 1.5;

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
        spawnShardDrop(x, y);
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
        init, spawnDataDrop, spawnShardDrop, spawnProcessorDrop, addData, addInsight, addShard, addProcessor, addCoin,
        getData, getInsight, getShards, getProcessors, getCoins,
        getSessionData, getSessionInsight, getSessionShards, getSessionProcessors, getSessionCoins,
        resetSession, clearDrops, recalcPickupRadius: _recalcPickupRadius,
    };
})();
