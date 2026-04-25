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
    let collectFXPool = null;
    let activeCollectFX = [];
    let collectFXCooldownTimer = 0;
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
    let sessionSniffedData = 0;

    let isPacketSniffingActive = false;
    let sniffTimer = 0;
    let currentPhase = '';

    // ── init ─────────────────────────────────────────────────────────────────

    function init() {
        dropPool = new ObjectPool(
            () => {
                const img = PhaserScene.add.image(0, 0, 'player', 'resrc_data_big.png');
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
                    collectLockTime: 0
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
                    collectLockTime: 0
                };
            },
            _resetDrop,
            100
        ).preAllocate(100);

        collectFXPool = new ObjectPool(
            () => {
                const slice = PhaserScene.add.nineslice(0, 0, 'player', 'data_collect.png', 28, 28, 8, 8, 8, 8);
                slice.setRotation(Phaser.Math.DegToRad(45));
                slice.setDepth(GAME_CONSTANTS.DEPTH_HUD + 10);
                slice.setScrollFactor(0);
                slice.setVisible(false);
                slice.setActive(false);
                return slice;
            },
            (s) => { s.setVisible(false); s.setActive(false); },
            8
        ).preAllocate(8);

        messageBus.subscribe('enemyKilled', _onEnemyKilled);
        messageBus.subscribe('phaseChanged', _onPhaseChanged);
        messageBus.subscribe('minibossDefeated', _onMinibossDefeated);
        messageBus.subscribe('triggerResourceVacuum', _vacuumAllDrops);
        messageBus.subscribe('upgradePurchased', ({ id }) => {
            if (id === 'magnet') _recalcPickupRadius();
        });
        messageBus.subscribe('gamePaused', () => { paused = true; });
        messageBus.subscribe('gameResumed', () => { paused = false; });
        messageBus.subscribe('pulseData', _onPulseData);
        _recalcPickupRadius();

        // Initial check for packet sniffing if already purchased (on load)
        const ups = gameState.upgrades || {};
        isPacketSniffingActive = (ups.packet_sniffing || 0) > 0;

        updateManager.addFunction(_update);
    }

    function _resetDrop(d) {
        if (d.spawnTween) { d.spawnTween.stop(); d.spawnTween = null; }
        d.alive = false;
        d.flying = false;
        d.readyToCollect = false;
        d.inertia = -0.11;
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

    function spawnDataDrop(x, y, distance, angle) {
        if (!dropPool) return;
        const d = dropPool.get();
        if (!d) return;

        _setupDrop(d, x, y, distance, angle);
    }

    function spawnShardDrop(x, y) {
        shardIsFlying = true;
        const img = PhaserScene.add.image(x, y, 'player', 'resrc_shard_big.png');
        img.setScale(1.0);
        img.setDepth(GAME_CONSTANTS.DEPTH_RESOURCES + 1);

        // Add backing sprite
        const backing = PhaserScene.add.image(x, y, 'player', 'resrc_shard_backing.png');
        backing.setDepth(GAME_CONSTANTS.DEPTH_RESOURCES);
        backing.setScale(1.0);

        const d = {
            img: img,
            alive: true,
            flying: false,
            readyToCollect: false,
            isLocked: true, // Shard cannot be picked up or move towards player while locked
            x: x,
            y: y,
            dx: 0,
            dy: 0,
            inertia: -0.05,
            type: 'shard',
            spawnTween: null,
            backing: backing,
        };

        // Unlock shard after 1.65 seconds
        PhaserScene.time.delayedCall(1650, () => {
            if (d) d.isLocked = false;
        });

        // Pulse effect 1 second after drop
        PhaserScene.time.delayedCall(1600, () => {
            if (!d.alive || !d.img || !d.img.active) return;
            const px = d.img.x;
            const py = d.img.y;
            const pulse = PhaserScene.add.image(px, py, 'player', 'shard_pulse.png');
            pulse.setDepth(d.img.depth - 1);
            pulse.setScale(0.4);
            pulse.setAlpha(1.15);

            PhaserScene.tweens.add({
                targets: pulse,
                scale: 1.0,
                duration: 500,
                ease: 'Quart.easeOut'
            });

            PhaserScene.tweens.add({
                targets: pulse,
                alpha: 0,
                duration: 500,
                ease: 'Quad.easeIn',
                onComplete: () => pulse.destroy()
            });
        });

        const angle = Math.random() * Math.PI * 2;
        const dist = 1;
        const margin = 40 + Math.random() * 12;
        const cx = Math.max(margin, Math.min(GAME_CONSTANTS.WIDTH - margin, x));
        const cy = Math.max(margin, Math.min(GAME_CONSTANTS.HEIGHT - margin, y));
        const endX = cx + Math.cos(angle) * dist;
        const endY = cy + Math.sin(angle) * dist;

        d.spawnTween = PhaserScene.tweens.add({
            targets: d.img,
            x: endX,
            y: endY,
            duration: 1500,
            ease: 'Cubic.easeOut',
            completeDelay: 1000,
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

    function _setupDrop(d, x, y, distance, angle) {
        totalDropsSpawned++;

        d.x = x;
        d.y = y;
        d.dx = 0;
        d.dy = 0;
        d.alive = true;
        d.flying = false;
        d.readyToCollect = false;
        d.inertia = -0.11;

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

        const dropAngle = (angle !== undefined && angle !== null) ? angle : Math.random() * Math.PI * 2;
        const dist = (distance !== undefined && distance !== null) ? distance : 3 + Math.random() * 38;

        const awayDx = x - GAME_CONSTANTS.halfWidth;
        const awayDy = y - GAME_CONSTANTS.halfHeight;
        const awayLen = Math.sqrt(awayDx * awayDx + awayDy * awayDy) || 1;

        const distAwayX = Math.cos(dropAngle) * dist + (awayDx / awayLen) * 5;
        const distAwayY = Math.sin(dropAngle) * dist + (awayDy / awayLen) * 5;

        // If distance is provided (event-based), spawn exactly at (x, y).
        // Otherwise (enemy drop), use the default 0.6 offset to burst outward.
        const spawnOffsetMult = (distance !== undefined && distance !== null) ? 0 : 0.6;
        d.img.setPosition(x + spawnOffsetMult * distAwayX, y + spawnOffsetMult * distAwayY);

        const margin = 40 + Math.random() * 12;
        const cx = Math.max(margin, Math.min(GAME_CONSTANTS.WIDTH - margin, x));
        const cy = Math.max(margin, Math.min(GAME_CONSTANTS.HEIGHT - margin, y));

        let endX = cx + distAwayX;
        let endY = cy + distAwayY;


        const spawnDuration = 275 + dist * 6;
        d.collectLockTime = PhaserScene.time.now + 160 + (spawnDuration * 0.07);

        d.spawnTween = PhaserScene.tweens.add({
            targets: d.img,
            x: endX,
            y: endY,
            duration: spawnDuration,
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
        // Validation: Ensure amount is a valid number
        if (typeof amount !== 'number' || isNaN(amount)) return;


        gameState.data = Math.max(0, (gameState.data || 0) + amount);

        // SECURITY: Only track session stats during relevant phases to avoid inflating 
        // combat results with upgrade-phase refunds
        if (amount > 0 && currentPhase === GAME_CONSTANTS.PHASE_COMBAT) {
            sessionData += amount;
        }

        messageBus.publish('currencyChanged', 'data', gameState.data, amount);
    }

    function addInsight(amount) {
        gameState.insight = Math.max(0, (gameState.insight || 0) + amount);
        sessionInsight += Math.max(0, amount);
        messageBus.publish('currencyChanged', 'insight', gameState.insight, amount);
    }

    function addShard(amount) {
        if (amount > 0) shardIsFlying = false;
        gameState.shard = Math.max(0, (gameState.shard || 0) + amount);
        sessionShards += Math.max(0, amount);
        messageBus.publish('currencyChanged', 'shard', gameState.shard, amount);

        if (amount > 0) {
            if (typeof audio !== 'undefined') audio.play('levelup', 0.64);
            floatingText.show(GAME_VARS.mouseposx, GAME_VARS.mouseposy - 25, t('popup', 'shard_acquired'), {
                fontFamily: 'JetBrainsMono_Bold',
                fontSize: 36,
                color: '#ff5555',
                color2: '#ffaa00',
                depth: GAME_CONSTANTS.DEPTH_UI + 100,
                duration: 1700,
            });
        }
    }

    function addProcessor(amount) {
        gameState.processor = Math.max(0, (gameState.processor || 0) + amount);
        sessionProcessors += Math.max(0, amount);
        messageBus.publish('currencyChanged', 'processor', gameState.processor, amount);
    }

    function addCoin(amount) {
        gameState.coin = Math.max(0, (gameState.coin || 0) + amount);
        sessionCoins += Math.max(0, amount);
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
    function getSessionSniffedData() { return sessionSniffedData; }

    function resetSession() {
        sessionData = 0;
        sessionInsight = 0;
        sessionShards = 0;
        sessionProcessors = 0;
        sessionCoins = 0;
        sessionSniffedData = 0;
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
        const mult = 1 + (0.25 * magnetLv);
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
            if (d.backing) {
                d.backing.destroy();
                d.backing = null;
            }
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
            d.collectLockTime = 0;
            d.x = d.img.x;
            d.y = d.img.y;
            d.flying = true;
            d.inertia = Math.random() * 0.45 - 0.4;

            flyingDrops.push(d);
            activeDrops.splice(i, 1);
        }

        // // Also boost any drops already flying
        // for (let i = 0; i < flyingDrops.length; i++) {
        //     flyingDrops[i].inertia = 1;
        // }
    }

    // ── per-frame ────────────────────────────────────────────────────────────

    let frameCounter = 0;
    function _update(delta) {
        if (paused) return;

        if (collectFXCooldownTimer > 0) {
            collectFXCooldownTimer -= delta;
        }

        // Update active collection effects to follow cursor
        if (activeCollectFX.length > 0) {
            for (let i = 0; i < activeCollectFX.length; i++) {
                activeCollectFX[i].setPosition(GAME_VARS.mouseposx, GAME_VARS.mouseposy);
            }
        }

        // ── Packet Sniffing Logic ──
        if (isPacketSniffingActive && currentPhase === GAME_CONSTANTS.PHASE_COMBAT) {
            sniffTimer += delta;
            if (sniffTimer >= 2000) {
                addData(1);
                sessionSniffedData += 1;
                sniffTimer -= 2000;
            }
        }

        if (activeDrops.length === 0 && flyingDrops.length === 0) return;

        frameCounter++;
        const dt = delta / 1000;
        const cx = GAME_VARS.mouseposx;
        const cy = GAME_VARS.mouseposy;
        const pickupR2 = currentPickupRadius2;

        // Check if cursor entered pickup radius → start flying
        for (let i = activeDrops.length - 1; i >= 0; i--) {
            const d = activeDrops[i];

            // SECURITY: Never pick up drops during their initial spawn/slide grace period
            if (!d.alive || d.isLocked || PhaserScene.time.now < d.collectLockTime) {
                if (!d.alive) {
                    activeDrops[i] = activeDrops[activeDrops.length - 1];
                    activeDrops.pop();
                }
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

        // ── Flying drops: move toward current cursor position each frame ──
        const flyStep = FLY_SPEED * dt;

        for (let i = flyingDrops.length - 1; i >= 0; i--) {
            const d = flyingDrops[i];

            if (d.readyToCollect) {
                _deactivate(d);
                if (d.type === 'processor') addProcessor(1);
                else if (d.type === 'shard') addShard(1);
                else {
                    addData(1);
                    _playCollectFX(cx, cy);
                }

                flyingDrops[i] = flyingDrops[flyingDrops.length - 1];
                flyingDrops.pop();
                continue;
            }

            const dx = cx - d.x;
            const dy = cy - d.y;

            // Collect check — Manhattan distance, no sqrt needed
            // More inertia = bigger collection radius, added to base distance
            const collectionRadius = FLY_COLLECT_DIST + (25 * Math.max(0, d.inertia));
            if (Math.abs(dx) + Math.abs(dy) <= collectionRadius) {
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
                if (d.inertia < 0) {
                    d.inertia *= 0.95;
                }
                d.inertia = Math.min(1, d.inertia + 0.75 * dt);
            }
            const oldImgXPos = d.img.x;
            const oldImgYPos = d.img.y;
            if (d.backing) {
                d.backing.setPosition(oldImgXPos * 0.5 + d.x * 0.5, oldImgYPos * 0.5 + d.y * 0.5);
            }
            d.img.setPosition(d.x, d.y);
        }
    }

    // ── event handlers ───────────────────────────────────────────────────────

    let dropAccumulator = 0;

    function _onEnemyKilled({ x, y, drop: baseResourceDrop, type: enemyType }) {
        const config = getCurrentLevelConfig();
        let dataDropMult = config.dataDropMultiplier || 1;

        // Cache enemies (Loot Goblins) are x1.5 as sensitive to the level's drop multiplier bonus
        // i.e. a +50% level bonus becomes a +75% bonus for the cache enemy.
        if (enemyType === 'cache' && dataDropMult > 1) {
            const bonus = dataDropMult - 1;
            dataDropMult = 1 + (bonus * 1.5);
        }

        const compressionLv = (gameState.upgrades || {}).data_compression || 0;
        let compressionMult = 1;
        if (compressionLv > 0 && Math.random() < (0.25 * compressionLv)) {
            compressionMult = 2;
        }

        let timeMult = 1;
        if ((gameState.upgrades || {}).peak_traffic > 0) {
            if (waveManager.getWaveElapsedTime() >= 20) {
                timeMult = 1.5;
            }
        }

        const totalDrop = baseResourceDrop * dataDropMult * compressionMult * timeMult;

        // Add to the fractional drop accumulator
        dropAccumulator += totalDrop;

        // Spawn drops for any whole numbers gained
        while (dropAccumulator >= 1) {
            let dist = null;
            if (enemyType === 'cache') {
                // Quadruple the default distance (3+38=41 -> 12+152=164)
                dist = 10 + Math.random() * 155;
            }
            spawnDataDrop(x, y, dist);
            dropAccumulator -= 1;
        }

        // The remaining fraction is naturally preserved for future death checks
    }

    function _onMinibossDefeated(x, y, isFarmingMiniboss) {
        if (isFarmingMiniboss) return;
        spawnShardDrop(x, y);
    }

    function _onPulseData() {
        activeDrops.forEach(d => {
            if (d.type !== 'data' || d.flying) return;

            const px = d.img.x;
            const py = d.img.y;
            const delay = (px / GAME_CONSTANTS.WIDTH) * 450 + (py / GAME_CONSTANTS.HEIGHT) * 300;

            const shock = PhaserScene.add.image(px, py, 'player', 'shockwave.png');
            shock.setDepth(d.img.depth - 1);
            shock.setScale(0.02);
            shock.setAlpha(1);

            PhaserScene.tweens.add({
                targets: shock,
                scale: 0.35,
                duration: 1300,
                delay: delay,
                ease: 'Quart.easeOut'
            });

            PhaserScene.tweens.add({
                targets: shock,
                alpha: 0,
                duration: 1300,
                delay: delay,
                ease: 'Linear',
                completeDelay: 500,
                onComplete: () => {
                    shock.destroy();
                }
            });
        });
    }

    function _onPhaseChanged(phase) {
        currentPhase = phase;
        if (phase === GAME_CONSTANTS.PHASE_COMBAT) {
            resetSession();
            sniffTimer = 0; // Reset timer at start of combat
        } else if (phase === GAME_CONSTANTS.PHASE_WAVE_COMPLETE || phase === GAME_CONSTANTS.PHASE_UPGRADE
            || phase === GAME_CONSTANTS.PHASE_GAME_OVER) {
            clearDrops();  // flying drops are cashed out inside clearDrops()
        }
    }

    function canAfford(type, amount) {
        if (type === 'shard') return getShards() >= amount;
        if (type === 'insight') return getInsight() >= amount;
        if (type === 'processor') return getProcessors() >= amount;
        if (type === 'coin') return getCoins() >= amount;
        return getData() >= amount;
    }

    function spend(type, amount) {
        if (!canAfford(type, amount)) return false;
        if (type === 'shard') addShard(-amount);
        else if (type === 'insight') addInsight(-amount);
        else if (type === 'processor') addProcessor(-amount);
        else if (type === 'coin') addCoin(-amount);
        else addData(-amount);
        return true;
    }

    function _playCollectFX(x, y) {
        if (collectFXCooldownTimer > 0 || !collectFXPool) return;
        collectFXCooldownTimer = 100; // 0.1s in ms

        const fx = collectFXPool.get();
        if (!fx) return;

        fx.setPosition(x, y);
        fx.width = 28;
        fx.height = 28;
        fx.setAlpha(1.3);
        fx.setVisible(true);
        fx.setActive(true);
        activeCollectFX.push(fx);

        const finalSize = 90 + (activeCollectFX.length - 1) * 12;
        const finalDuration = 420 + (activeCollectFX.length - 1) * 25;
        PhaserScene.tweens.add({
            targets: fx,
            width: finalSize,
            height: finalSize,
            duration: finalDuration,
            ease: 'Quart.easeOut'
        });

        PhaserScene.tweens.add({
            targets: fx,
            alpha: 0,
            ease: 'Cubic.easeOut',
            duration: finalDuration,
            onComplete: () => {
                const idx = activeCollectFX.indexOf(fx);
                if (idx !== -1) activeCollectFX.splice(idx, 1);
                collectFXPool.release(fx);
            }
        });
    }

    return {
        init, spawnDataDrop, spawnShardDrop, spawnProcessorDrop, addData, addInsight, addShard, addProcessor, addCoin,
        getData, getInsight, getShards, getProcessors, getCoins,
        canAfford, spend, // Added for cleaner spending logic
        getSessionData, getSessionInsight, getSessionShards, getSessionProcessors, getSessionCoins, getSessionSniffedData,
        resetSession, clearDrops, recalcPickupRadius: _recalcPickupRadius,
        setPacketSniffing: (active) => { isPacketSniffingActive = active; }
    };
})();
