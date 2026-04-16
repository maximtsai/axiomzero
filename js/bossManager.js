// bossManager.js — Logic for spawning and tracking Bosses and Minibosses.
// Manages boss-specific states and layout-based spawning for complex bosses (e.g. Boss 3 Phalanx).

const bossManager = (() => {
    let _enemyManager = null; // Injection of enemyManager for pool and registration access

    // State tracking
    let minibossSpawned = false;  // has a miniboss spawned this wave?
    let farmingMinibossCount = 0; // how many 30s farming minibosses spawned?
    let minibossAlive = false;    // is the current miniboss still alive?
    let bossSpawned = false;
    let bossAlive = false;
    let boss3ShareTimer = 1.0;    // countdown for Phalanx HP sharing
    let boss3Shards = [];         // Track shards to avoid daily activeEnemies.filter call

    function init(manager) {
        _enemyManager = manager;
    }

    function reset() {
        minibossSpawned = false;
        farmingMinibossCount = 0;
        minibossAlive = false;
        bossSpawned = false;
        bossAlive = false;
        boss3ShareTimer = 1.0;
        boss3Shards = [];
    }

    // ── spawning ─────────────────────────────────────────────────────────────

    function spawnMiniboss(lastWaveProgress, isFarmingSpawn = false, multiplier = 1, forceType = null, farmingOverrides = null) {
        if (!isFarmingSpawn && minibossSpawned) return;

        const config = _enemyManager.getCurrentLevelConfig(lastWaveProgress);

        // Allow forcing a specific class (like Miniboss1 for farming mode)
        const mbType = forceType || config.miniboss;

        // Check if miniboss for this level has already been defeated (unless it's an explicit farming spawn)
        const currentLevel = gameState.currentLevel || 1;
        if (!isFarmingSpawn && (gameState.minibossLevelsDefeated || 0) >= currentLevel) {
            debugLog(`Miniboss for level ${currentLevel} already defeated. Skipping spawn.`);
            minibossSpawned = true; // prevent re-attempts this wave
            return;
        }

        let mbClass = _resolveEnemyClass(mbType);
        let mb = null;
        if (!mbClass) {
            console.warn(`[BossManager] Miniboss class '${config.miniboss}' not found. Defaulting to Miniboss1.`);
            mbClass = Miniboss1;
            mb = new mbClass(config.levelScalingModifier || 1);
        } else {
            mb = new mbClass(1);
        }

        if (!mb) return;

        if (isFarmingSpawn) {
            farmingMinibossCount++;
            if (mb.model) {
                mb.model.isFarmingMiniboss = true;
                mb.model.baseResourceDrop = 10;
                mb.model.multiplier = multiplier;
            }
        } else {
            minibossSpawned = true;
        }

        minibossAlive = true;

        const distance = GAME_CONSTANTS.MINIBOSS_SPAWN_DISTANCE;
        const angle = _getValidBossSpawnAngle();
        const sx = GAME_CONSTANTS.halfWidth + Math.cos(angle) * distance;
        const sy = GAME_CONSTANTS.halfHeight + Math.sin(angle) * distance;

        // Visual warning before spawning
        const warningImg = PhaserScene.add.image(sx, sy, 'enemies', 'warning.png');
        PhaserScene.time.delayedCall(350, () => {
            if (minibossAlive || isFarmingSpawn) audio.play('miniboss_warning');
        });
        warningImg.setDepth(GAME_CONSTANTS.DEPTH_ENEMIES - 1);
        warningImg.setOrigin(0, 0.5);
        warningImg.setScale(1.2, 1);
        warningImg.setRotation(Math.atan2(GAME_CONSTANTS.halfHeight - sy, GAME_CONSTANTS.halfWidth - sx));
        warningImg.setAlpha(0);

        PhaserScene.tweens.add({
            targets: warningImg,
            alpha: 1,
            duration: 750,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: 1,
            onComplete: () => {
                if (warningImg.active) warningImg.destroy();
            }
        });

        mb.activate(sx, sy);

        if (isFarmingSpawn && farmingOverrides) {
            const m = mb.model;
            if (farmingOverrides.health) {
                m.maxHealth = farmingOverrides.health;
                m.health = m.maxHealth;
            }
            if (farmingOverrides.damage) {
                m.damage = farmingOverrides.damage;
            }
            if (farmingOverrides.data) {
                m.baseResourceDrop = farmingOverrides.data;
            }
            // Ensure multiplier is set for ranged/slam stats
            if (farmingOverrides.multiplier) {
                m.multiplier = farmingOverrides.multiplier;
            }
        }

        // Spawn 2 fast enemies for Miniboss 2
        if (!isFarmingSpawn && config.miniboss === 'Miniboss2') {
            const offsets = [-0.25, 0.25];
            const currentScale = (_enemyManager.getScaleFactor() || 1) * (config.levelScalingModifier || 1);

            offsets.forEach(offset => {
                const fa = angle + offset;
                // Middle enemies (offsets +/- 0.25) start 20px closer
                const extraDist = (Math.abs(offset) < 0.3) ? -20 : 0;
                const finalDist = distance + extraDist;

                const fsx = GAME_CONSTANTS.halfWidth + Math.cos(fa) * finalDist;
                const fsy = GAME_CONSTANTS.halfHeight + Math.sin(fa) * finalDist;

                // Try to get a fast enemy from pool via enemyManager
                const fe = _enemyManager.spawnAt('fast', fsx, fsy, {
                    scale: currentScale,
                    initialSpeedMult: 6,
                    rampDuration: 1.5
                });
            });
        }

        mb.aimAt(GAME_CONSTANTS.halfWidth, GAME_CONSTANTS.halfHeight);
        _enemyManager.registerEnemy(mb);

        messageBus.publish('minibossSpawned');
        const variantStr = isFarmingSpawn ? 'Farming' : 'Standard';
        console.log(`[BossManager] Spawning ${variantStr} Miniboss: ${mb.model.type} (HP: ${Math.floor(mb.model.health)})`);
        debugLog('Miniboss spawned at angle ' + (angle * 180 / Math.PI).toFixed(1) + '°');
    }

    function spawnBoss(lastWaveProgress) {
        if (bossSpawned) return;

        const config = _enemyManager.getCurrentLevelConfig(lastWaveProgress);
        let Class = _resolveEnemyClass(config.mainBoss);
        if (!Class) {
            console.warn(`[BossManager] Boss class '${config.mainBoss}' not found. Defaulting to BossSquare.`);
            Class = BossSquare;
        }

        bossSpawned = true;
        bossAlive = true;

        // Temporary instance to check for class-specific distance offsets/angles
        const tempB = new Class(1);
        const distanceOffset = (tempB.model && tempB.model.getSpawnDistanceOffset) ? tempB.model.getSpawnDistanceOffset() : 0;
        const distance = GAME_CONSTANTS.ENEMY_SPAWN_DISTANCE + distanceOffset;
        const angle = _getValidBossSpawnAngle(tempB);
        const sx = GAME_CONSTANTS.halfWidth + Math.cos(angle) * distance;
        const sy = GAME_CONSTANTS.halfHeight + Math.sin(angle) * distance;

        if (config.mainBoss === 'Boss3') {
            const layout = Class.getSpawnLayout(sx, sy, angle, distance);
            layout.forEach(item => {
                let wx = item.x;
                let wy = item.y;

                // Move the Top 2 and Bottom 2 indicators (the diagonals) 250px closer
                // We identify them by checking that they aren't the purely horizontal shards (West=180, East=0)
                if (Math.abs(Math.cos(item.angle)) < 0.9) {
                    const dx = item.x - GAME_CONSTANTS.halfWidth;
                    const dy = item.y - GAME_CONSTANTS.halfHeight;
                    const d = Math.sqrt(dx * dx + dy * dy) || 1;
                    const newD = Math.max(0, d - 250);
                    wx = GAME_CONSTANTS.halfWidth + (dx / d) * newD;
                    wy = GAME_CONSTANTS.halfHeight + (dy / d) * newD;
                }

                const w = PhaserScene.add.image(wx, wy, 'enemies', 'warning.png');
                w.setDepth(GAME_CONSTANTS.DEPTH_ENEMIES - 1);
                w.setOrigin(0, 0.5);
                w.setScale(1.2);
                w.setRotation(Math.atan2(GAME_CONSTANTS.halfHeight - wy, GAME_CONSTANTS.halfWidth - wx));
                w.setAlpha(0);
                PhaserScene.tweens.add({
                    targets: w,
                    alpha: 1,
                    duration: 750,
                    ease: 'Sine.easeInOut',
                    yoyo: true,
                    repeat: 1,
                    onComplete: () => { w.destroy(); }
                });
            });
        } else {
            // Visual warning before spawning (single unit)
            const warningImg = PhaserScene.add.image(sx, sy, 'enemies', 'warning_big.png');
            warningImg.setDepth(GAME_CONSTANTS.DEPTH_ENEMIES - 1);
            warningImg.setOrigin(0, 0.5);

            const isBoss5 = config.mainBoss === 'Boss5';
            const isBoss3 = config.mainBoss === 'Boss3';
            let wScale = isBoss5 ? 1.4 : 1.0;
            wScale = isBoss3 ? 0.75 : 1.0;
            warningImg.setScale(1.5 * wScale, 1.4 * wScale);
            warningImg.setRotation(Math.atan2(GAME_CONSTANTS.halfHeight - sy, GAME_CONSTANTS.halfWidth - sx));
            warningImg.setAlpha(0);

            PhaserScene.tweens.add({
                targets: warningImg,
                alpha: 1,
                duration: 750,
                ease: 'Sine.easeInOut',
                yoyo: true,
                repeat: 1,
                onComplete: () => {
                    warningImg.destroy();
                }
            });
        }

        const layout = Class.getSpawnLayout(sx, sy, angle, distance);
        const spawnedUnits = [];

        layout.forEach(item => {
            const b = new Class(config.levelScalingModifier || 1);
            const finalConfig = { ...config, ...item.config };
            const scale = _enemyManager.getScaleFactor() || 1;
            b.activate(item.x, item.y, scale, finalConfig);
            b.aimAt(GAME_CONSTANTS.halfWidth, GAME_CONSTANTS.halfHeight);

            _enemyManager.registerEnemy(b);
            spawnedUnits.push(b);
            if (config.mainBoss === 'Boss3') boss3Shards.push(b);
        });

        if (Class.postSpawn) Class.postSpawn(spawnedUnits);

        messageBus.publish('bossSpawned');
        debugLog('Boss spawned at angle ' + (angle * 180 / Math.PI).toFixed(1) + '°');
    }

    // ── death ────────────────────────────────────────────────────────────────

    function onEnemyDeath(enemy, ex, ey, wasMiniboss, wasBoss, skipBossEffects) {
        if (wasMiniboss) {
            // Check if any other minibosses are still alive (for farming mode particularly)
            const remaining = _enemyManager.getActiveEnemies().filter(e => e.model.isMiniboss && e !== enemy && e.model.alive);
            if (remaining.length === 0) {
                minibossAlive = false;

                // Update highest miniboss level defeated
                const currentLevel = gameState.currentLevel || 1;
                if (currentLevel > (gameState.minibossLevelsDefeated || 0)) {
                    gameState.minibossLevelsDefeated = currentLevel;
                    debugLog('New miniboss record: level ' + currentLevel);
                }

                messageBus.publish('minibossDefeated', ex, ey, enemy.model.isFarmingMiniboss);
                debugLog('Miniboss defeated');
            }
        } else if (wasBoss && !skipBossEffects) {
            // Support for multi-sharded bosses like Boss 3
            if (enemy.model.type === 'boss3') {
                const bIdx = boss3Shards.indexOf(enemy);
                if (bIdx !== -1) {
                    boss3Shards.splice(bIdx, 1);
                }
            }

            const remaining = _enemyManager.getActiveEnemies().filter(e => e.model.isBoss && e !== enemy && e.model.alive);
            if (remaining.length === 0) {
                bossAlive = false;
                boss3Shards = [];
                messageBus.publish('bossDefeated', ex, ey);
                debugLog('Boss defeated');
            }
        }
    }

    function onTowerDied(activeEnemies) {
        for (let i = 0; i < activeEnemies.length; i++) {
            const e = activeEnemies[i];
            if (e.model.isBoss || e.model.isMiniboss) {
                e.model.invincible = true;
            }
        }
    }

    // ── per-frame update ─────────────────────────────────────────────────────

    function update(dt, activeEnemies) {
        // Boss 3 (Phalanx) HP sharing logic
        if (bossAlive && boss3Shards.length > 0) {
            boss3ShareTimer -= dt;
            if (boss3ShareTimer <= 0) {
                boss3ShareTimer = 3.0;
                boss3Shards.forEach(p => p.model.calculateSiphon());
                boss3Shards.forEach(p => {
                    const healAmount = p.model.applySiphon();
                    if (healAmount >= 7) {
                        _triggerHealVisuals(p, healAmount);
                    }
                });
            }
        }
    }

    function _triggerHealVisuals(p, healAmount) {
        PhaserScene.time.delayedCall(600, () => {
            if (p && p.model && p.model.alive && p.view) {
                // 1. Floating Text
                if (typeof floatingText !== 'undefined') {
                    let healFontSize = 20 + Math.floor(Math.sqrt(healAmount) * 4);
                    floatingText.show(p.model.x, p.model.y - 10, "+" + Math.floor(healAmount), {
                        fontFamily: 'MunroSmall',
                        fontSize: healFontSize + 8,
                        color: '#00ff66',
                        stroke: '#330000',
                        strokeThickness: 2,
                        depth: GAME_CONSTANTS.DEPTH_ENEMIES + 99
                    });
                }
                // 2. Health Bar 'Pump'
                if (p.view.hpImg && p.view.hpImg.scene) {
                    PhaserScene.tweens.add({
                        targets: p.view.hpImg,
                        scaleX: 1.12,
                        scaleY: 1.12,
                        yoyo: true,
                        duration: 180,
                        ease: 'Sine.easeInOut'
                    });
                }
                // 3. Base Sprite 'Pump'
                if (p.view.img && p.view.img.scene) {
                    PhaserScene.tweens.add({
                        targets: p.view.img,
                        scaleX: 1.06,
                        scaleY: 1.06,
                        yoyo: true,
                        duration: 180,
                        ease: 'Sine.easeInOut'
                    });
                }
            }
        });
    }

    // ── internal helpers ─────────────────────────────────────────────────────

    function _resolveEnemyClass(className) {
        const registry = {
            'Miniboss1': typeof Miniboss1 !== 'undefined' ? Miniboss1 : null,
            'Miniboss2': typeof Miniboss2 !== 'undefined' ? Miniboss2 : null,
            'Miniboss3': typeof Miniboss3 !== 'undefined' ? Miniboss3 : null,
            'Miniboss4': typeof Miniboss4 !== 'undefined' ? Miniboss4 : null,
            'BossSquare': typeof BossSquare !== 'undefined' ? BossSquare : null,
            'BossCircle': typeof BossCircle !== 'undefined' ? BossCircle : null,
            'Boss2': typeof Boss2 !== 'undefined' ? Boss2 : null,
            'Boss3': typeof Boss3 !== 'undefined' ? Boss3 : null,
            'Boss5': typeof Boss5 !== 'undefined' ? Boss5 : null
        };
        return registry[className];
    }

    function _getValidBossSpawnAngle(bossInstance) {
        if (bossInstance && bossInstance.model && (bossInstance.model.getSpawnAngle || bossInstance.model.__proto__.getSpawnAngle)) {
            return bossInstance.model.getSpawnAngle();
        }
        // Default: Spawn from West or East sides with 30-degree leeway
        const side = Math.random() < 0.5 ? 0 : Math.PI;
        const leeway = 30 * (Math.PI / 180);
        const offset = (Math.random() * 2 - 1) * leeway;
        return Phaser.Math.Angle.Wrap(side + offset);
    }

    return {
        init,
        reset,
        spawnMiniboss,
        spawnBoss,
        onEnemyDeath,
        onTowerDied,
        update,
        isBossSpawned: () => bossSpawned,
        isBossAlive: () => bossAlive,
        isMinibossSpawned: () => minibossSpawned,
        isMinibossAlive: () => minibossAlive,
        getFarmingMinibossCount: () => farmingMinibossCount
    };
})();
