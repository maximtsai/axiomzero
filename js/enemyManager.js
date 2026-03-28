// enemyManager.js — Enemy spawning, pooling, movement, damage, and death.
// Phase 1: BasicEnemy type only (red-violet square).
//
// Enemy behaviour and visual feedback live in the Enemy subclasses
// (js/enemies/enemy.js, js/enemies/basic_enemy.js).
// This manager owns the object pool, spawn timer, wave scaling, and
// the public API consumed by projectileManager, waveManager, etc.

const enemyManager = (() => {
    const POOL_SIZE = 80;
    const MINIBOSS_POOL_SIZE = 2;

    let pools = {};         // key: type, value: ObjectPool
    let activeEnemies = []; // currently alive Enemy references (includes minibosses)
    let spatialGrid = {};   // Fast spatial hash grid (Map of cellKey -> { enemies: [], active: boolean })
    let specialEnemies = []; // Bosses and Minibosses not in grid
    const CELL_SIZE = 150;  // Spatial grid bin size 
    const GRID_PADDING = 60; // Max enemy radius for safe neighbor checks
    let activeProtectors = []; // persistent list of protectors for aura checks
    let typeCounts = {};    // tracks number of active enemies per type (for spawn limits)
    let spawnTimer = 0;
    let spawning = false;
    let frozen = false;     // true during death sequence — movement paused, spawning stopped
    let paused = false;     // true when options menu opens
    let combatTime = 4;    // seconds since wave start — drives scaling
    let roundTimeElapsed = 0; // Total time in wave, including boss/miniboss fights
    let spawnSpeedMultiplier = 1;  // 5x for first 3 seconds of wave, then 1x

    // Miniboss tracking
    let minibossSpawned = false;  // has a miniboss spawned this wave?
    let minibossAlive = false;    // is the current miniboss still alive?
    let lastWaveProgress = 0;     // current progress 0-1
    let recentSpawnAngles = new Float32Array(6); // tracks the last 6 spawn angles (in radians)
    let recentSpawnIndex = 0;
    let recentSpawnCount = 0;

    // Boss tracking
    let bossSpawned = false;
    let bossAlive = false;

    // Fast enemy pack tracking
    let fastPackActive = false;
    let fastPackCount = 0;
    let fastPackOriginalAngle = 0;
    let fastPackLastOffsetSign = 1;
    let fastPackCooldown = 0;

    // Trojan Access tracking
    let nextSpawnIsBomb = false;
    let spawnCountSinceLastBomb = 0;

    // Boss 3 specifically
    let boss3ShareTimer = 1.0;

    // Spawn Rules configuration
    const ENEMY_SPAWN_RULES = {
        basic: {},
        fast: { minCombatTime: 9 },
        logic_stray: { minCombatTime: 9 },
        swarmer: { minCombatTime: 6, avoidRecentAngles: 0.45, maxAttempts: 6 },
        sniper: { minCombatTime: 6 },
        shooter: {},
        bomb: {},
        heavy: {},
        protector: {
            minCombatTime: 6,
            maxActive: 2,
            avoidActiveTypes: ['protector'],
            minSeparation: 0.4,
            maxAttempts: 3
        }
    };


    // ── init ─────────────────────────────────────────────────────────────────

    function init() {
        _buildPools();
        messageBus.subscribe('phaseChanged', _onPhaseChanged);
        messageBus.subscribe('freezeEnemies', freeze);
        messageBus.subscribe('unfreezeEnemies', unfreeze);
        messageBus.subscribe('gamePaused', () => { paused = true; });
        messageBus.subscribe('gameResumed', () => { paused = false; });
        messageBus.subscribe('waveProgressChanged', _onWaveProgress);
        messageBus.subscribe('towerDied', _onTowerDied);
    }

    function _buildPools() {
        // Shared reset function for all enemies
        const resetFn = (e) => { e.deactivate(); };

        pools.basic = new ObjectPool(() => new BasicEnemy(), resetFn, POOL_SIZE).preAllocate(POOL_SIZE);
        pools.shooter = new ObjectPool(() => new ShooterEnemy(), resetFn, POOL_SIZE).preAllocate(20);
        pools.heavy = new ObjectPool(() => new HeavyEnemy(), resetFn, POOL_SIZE).preAllocate(20);
        pools.fast = new ObjectPool(() => new FastEnemy(), resetFn, POOL_SIZE).preAllocate(20);
        pools.sniper = new ObjectPool(() => new SniperEnemy(), resetFn, POOL_SIZE).preAllocate(20);
        pools.logic_stray = new ObjectPool(() => new LogicStrayEnemy(), resetFn, POOL_SIZE).preAllocate(20);
        pools.protector = new ObjectPool(() => new ProtectorEnemy(), resetFn, POOL_SIZE).preAllocate(5);
        pools.bomb = new ObjectPool(() => new BombEnemy(), resetFn, POOL_SIZE).preAllocate(5);
        pools.swarmer = new ObjectPool(() => new SwarmerEnemy(), resetFn, POOL_SIZE * 2).preAllocate(POOL_SIZE);
        pools.shell = new ObjectPool(() => new ShellEnemy(), resetFn, POOL_SIZE).preAllocate(15);
        pools.miniboss_4 = new ObjectPool(() => new Miniboss4(), resetFn, 1).preAllocate(1);
        pools.boss3 = new ObjectPool(() => new Boss3(), resetFn, 8).preAllocate(8);
    }

    // ── spawning ─────────────────────────────────────────────────────────────

    function _startSpawning() {
        spawning = true;
        frozen = false;
        spawnTimer = -950;
        combatTime = 4;
        roundTimeElapsed = 0;
        GAME_VARS.roundTimeElapsed = roundTimeElapsed;
        GAME_VARS.scaleFactor = Math.pow(GAME_CONSTANTS.ENEMY_SCALE_RATE, Math.floor(roundTimeElapsed / GAME_CONSTANTS.ENEMY_SCALE_INTERVAL));
        minibossSpawned = false;
        minibossAlive = false;
        bossSpawned = false;
        nextSpawnIsBomb = false;
        spawnCountSinceLastBomb = 0;
        bossAlive = false;
        lastWaveProgress = 0;
        recentSpawnIndex = 0;
        recentSpawnCount = 0;
        fastPackActive = false;
        fastPackCount = 0;
        fastPackCooldown = 0;
    }

    function _stopSpawning() {
        spawning = false;
    }

    /** Instantly halt all enemy movement and spawning (death sequence). */
    function freeze() {
        frozen = true;
        spawning = false;
    }

    /** Resume normal update behaviour (called when death sequence ends). */
    function unfreeze() {
        frozen = false;
    }

    function clearAllEnemies() {
        for (let i = activeEnemies.length - 1; i >= 0; i--) {
            const e = activeEnemies[i];
            if (e) {
                e.deactivate();
                _releaseToPool(e);
            }
        }
        activeEnemies.length = 0;
        activeProtectors.length = 0;
        specialEnemies.length = 0;
        // Zero-garbage clear of the spatial grid
        for (let key in spatialGrid) {
            spatialGrid[key].length = 0;
        }
        for (let key in typeCounts) typeCounts[key] = 0;
    }

    function killAllNonBossEnemies() {
        for (let i = activeEnemies.length - 1; i >= 0; i--) {
            const e = activeEnemies[i];
            if (e && e.model.alive && !e.model.isBoss) {
                // Inflict lethal damage using selfDamage to ensure it dies and triggers drops
                e.takeDamage(e.model.maxHealth * 10);
                if (e.model.alive) {
                    _killEnemy(e);
                }
            }
        }
    }

    function _spawnOne() {
        const config = getCurrentLevelConfig(lastWaveProgress);

        let chosenType = 'basic';
        if (config.enemyProbabilities) {
            let r = Math.random();
            for (const type in config.enemyProbabilities) {
                if (r < config.enemyProbabilities[type]) {
                    chosenType = type;
                    break;
                }
                r -= config.enemyProbabilities[type];
            }
        }

        // Trojan Access conversion logic
        const trojanLevel = (gameState.upgrades && gameState.upgrades.trojan_access) || 0;
        if (trojanLevel > 0) {
            // Roll for next spawn to be a bomb if cooldown is over
            if (!nextSpawnIsBomb && spawnCountSinceLastBomb >= 3) {
                if (Math.random() < 0.1) {
                    nextSpawnIsBomb = true;
                }
            }

            // If we have a pending bomb conversion, check if this is a basic enemy
            if (nextSpawnIsBomb && (chosenType === 'basic')) {
                chosenType = 'bomb';
                nextSpawnIsBomb = false;
                spawnCountSinceLastBomb = 0;
            } else {
                // Only increment cooldown/count if it wasn't converted or wasn't a basic enemy
                spawnCountSinceLastBomb++;
            }
        }

        const rules = ENEMY_SPAWN_RULES[chosenType] || {};

        // Check time constraints
        if (rules.minCombatTime && combatTime < rules.minCombatTime) {
            chosenType = 'basic';
        }

        // Apply fast pack overrides and cooldowns
        if (fastPackCooldown > 0 && chosenType === 'fast') {
            chosenType = 'basic';
        } else if (fastPackActive) {
            if (chosenType === 'basic') {
                const randVal = Math.random();
                if (randVal < 0.6) {
                    chosenType = 'fast';
                } else {
                    // Pack broken by bad luck
                    fastPackActive = false;
                    if (fastPackCount > 1) fastPackCooldown = 4;
                }
            } else if (chosenType !== 'fast') {
                // Pack broken by a non-basic spawn rolling naturally
                fastPackActive = false;
                if (fastPackCount > 1) fastPackCooldown = 4;
            }
        }

        // Check max active limits
        if (chosenType !== 'basic' && rules.maxActive) {
            const activeCount = typeCounts[chosenType] || 0;
            if (activeCount >= rules.maxActive) {
                if (Math.random() < 0.8) chosenType = 'basic';
            } else if (activeCount >= rules.maxActive - 1) {
                if (Math.random() < 0.4) chosenType = 'basic';
            }
        }

        let numToSpawn = 1;
        if (chosenType === 'swarmer' && config.swarmerGroupSize) {
            numToSpawn = Phaser.Math.Between(config.swarmerGroupSize.min, config.swarmerGroupSize.max);
        }

        let angle;
        if (chosenType === 'protector') {
            const rules = ENEMY_SPAWN_RULES['protector'];
            angle = findValidAngle(() => Math.random() * Math.PI * 2, rules);
            if (angle === null) {
                chosenType = 'basic';
                angle = findValidAngle(() => Math.random() * Math.PI * 2, ENEMY_SPAWN_RULES['basic']);
            }
        } else if (chosenType === 'swarmer') {
            angle = findValidAngle(() => Math.random() * Math.PI * 2, ENEMY_SPAWN_RULES['swarmer']);
        } else if (chosenType === 'fast' && fastPackActive) {
            // Pick an angle 0.15 to 0.35 radians away from original
            const offsetMag = Phaser.Math.Between(15, 35) / 100;
            // Third member (count is currently 2, will be 3) spawns opposite to second
            const sign = -fastPackLastOffsetSign;
            const offset = offsetMag * sign;
            fastPackLastOffsetSign = sign;

            angle = fastPackOriginalAngle + offset;
            angle = Phaser.Math.Angle.Wrap(angle);
        } else {
            angle = findValidAngle(() => Math.random() * Math.PI * 2, ENEMY_SPAWN_RULES[chosenType] || {});
        }

        // Track pack state for 'fast'
        if (chosenType === 'fast') {
            if (!fastPackActive) {
                fastPackActive = true;
                fastPackCount = 1;
                fastPackOriginalAngle = angle;
                fastPackLastOffsetSign = Math.random() < 0.5 ? 1 : -1;
            } else {
                fastPackCount++;
                if (fastPackCount >= 3) {
                    fastPackActive = false;
                    fastPackCooldown = 5; // Enforce cooldown
                }
            }
        }

        // Determine base spawn position — random angle, ENEMY_SPAWN_DISTANCE from center
        const distance = GAME_CONSTANTS.ENEMY_SPAWN_DISTANCE;
        const baseX = GAME_CONSTANTS.halfWidth + Math.cos(angle) * distance;
        const baseY = GAME_CONSTANTS.halfHeight + Math.sin(angle) * distance;


        // Scaling factor (calculated once per frame in _update) multiplied by level specific scalar
        const currentScale = (GAME_VARS.scaleFactor || 1) * (config.levelScalingModifier || 1);

        for (let i = 0; i < numToSpawn; i++) {
            let e = null;
            if (chosenType === 'swarmer') {
                e = pools.swarmer.get();
            } else if (chosenType === 'shooter') {
                e = pools.shooter.get();
            } else if (chosenType === 'heavy') {
                e = pools.heavy.get();
            } else if (chosenType === 'fast') {
                e = pools.fast.get();
            } else if (chosenType === 'sniper') {
                e = pools.sniper.get();
            } else if (chosenType === 'logic_stray') {
                e = pools.logic_stray.get();
            } else if (chosenType === 'bomb') {
                e = pools.bomb.get();
            } else if (chosenType === 'shell') {
                e = pools.shell.get();
            } else if (chosenType === 'protector') {
                e = pools.protector.get();
            }

            if (!e) e = pools.basic.get(); // fallback to basic if target pool is exhausted
            if (!e) continue;           // safety net: all fallback pools exhausted

            let sx = baseX;
            let sy = baseY;

            if (numToSpawn > 1) {
                // If 6 or fewer swarmers, form layers of up to 2. Otherwise up to 4.
                const maxPerLayer = numToSpawn <= 6 ? 2 : 4;
                const layer = Math.floor(i / maxPerLayer);
                const indexInLayer = i % maxPerLayer;
                const layerSize = Math.min(maxPerLayer, numToSpawn - (layer * maxPerLayer));

                // Spread them along the arc for this specific layer (further widened)
                const angleStep = 0.16; // ~10.3 degrees
                let angleOffset = (indexInLayer - (layerSize - 1) / 2) * angleStep;

                // Offset every second layer to break up straight lines
                if (layer % 2 === 1) {
                    angleOffset += 0.09;
                }

                const finalAngle = angle + angleOffset;

                // Push each subsequent layer further away from the tower (increased to 65)
                const layerDistance = layer * 65;

                // Minor random distance staggering within the layer (further increased)
                const distanceVariation = Phaser.Math.Between(-22, 22);

                // Recalculate coordinate using base distance + layer push back + random stagger
                const finalDist = distance + layerDistance + distanceVariation;

                sx = GAME_CONSTANTS.halfWidth + Math.cos(finalAngle) * finalDist;
                sy = GAME_CONSTANTS.halfHeight + Math.sin(finalAngle) * finalDist;

                // Minor jitter (further increased)
                sx += Phaser.Math.Between(-16, 16);
                sy += Phaser.Math.Between(-16, 16);
            }

            // Activate (sets stats and resets visuals inside Enemy subclass)
            e.activate(sx, sy, currentScale);

            // Maintain type counts and protector lists
            typeCounts[e.model.type] = (typeCounts[e.model.type] || 0) + 1;
            if (e.model.type === 'protector') activeProtectors.push(e);

            // Aim at tower center
            e.aimAt(GAME_CONSTANTS.halfWidth, GAME_CONSTANTS.halfHeight);

            activeEnemies.push(e);
        }
    }

    function _resolveEnemyClass(className) {
        // Explicit mapping of string identifiers to class constructors.
        // This is safer than window[className] as it avoids global namespace pollution
        // and provides a clear list of supported boss types.
        const registry = {
            'Miniboss1': typeof Miniboss1 !== 'undefined' ? Miniboss1 : null,
            'Miniboss2': typeof Miniboss2 !== 'undefined' ? Miniboss2 : null,
            'Miniboss3': typeof Miniboss3 !== 'undefined' ? Miniboss3 : null,
            'Miniboss4': typeof Miniboss4 !== 'undefined' ? Miniboss4 : null,
            'Boss1': typeof Boss1 !== 'undefined' ? Boss1 : null,
            'Boss2': typeof Boss2 !== 'undefined' ? Boss2 : null,
            'Boss3': typeof Boss3 !== 'undefined' ? Boss3 : null,
            'Boss5': typeof Boss5 !== 'undefined' ? Boss5 : null
        };
        return registry[className];
    }

    function _getValidBossSpawnAngle(bossInstance) {
        // Force a consistent spawn angle from the top (90 degrees / 1.5 PI)
        return Math.PI * 1.5;
    }

    function _spawnMiniboss() {
        if (minibossSpawned) return;

        const config = getCurrentLevelConfig(lastWaveProgress);

        // Check if miniboss for this level has already been defeated
        const currentLevel = gameState.currentLevel || 1;
        if ((gameState.minibossLevelsDefeated || 0) >= currentLevel) {
            debugLog(`Miniboss for level ${currentLevel} already defeated. Skipping spawn.`);
            minibossSpawned = true; // prevent re-attempts this wave
            return;
        }

        let mbClass = _resolveEnemyClass(config.miniboss);
        let mb = null;
        if (!mbClass) {
            console.warn(`[EnemyManager] Miniboss class '${config.miniboss}' not found. Defaulting to Miniboss1.`);
            mbClass = Miniboss1;
            mb = new mbClass(config.levelScalingModifier || 1);
        } else {
            mb = new mbClass(1);
        }

        if (!mb) return;

        minibossSpawned = true;
        minibossAlive = true;

        const distance = GAME_CONSTANTS.MINIBOSS_SPAWN_DISTANCE;
        const angle = _getValidBossSpawnAngle();
        const sx = GAME_CONSTANTS.halfWidth + Math.cos(angle) * distance;
        const sy = GAME_CONSTANTS.halfHeight + Math.sin(angle) * distance;

        // Visual warning before spawning
        const warningImg = PhaserScene.add.image(sx, sy, 'enemies', 'warning.png');
        audio.play('miniboss_warning');
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
                warningImg.destroy();
            }
        });

        mb.activate(sx, sy);

        // Spawn 2 fast enemies for Miniboss 2
        if (config.miniboss === 'Miniboss2') {
            const offsets = [-0.25, 0.25];
            const currentScale = (GAME_VARS.scaleFactor || 1) * (config.levelScalingModifier || 1);

            offsets.forEach(offset => {
                const fe = pools.fast.get() || pools.basic.get();
                if (fe) {
                    const fa = angle + offset;
                    // Middle enemies (offsets +/- 0.25) start 20px closer
                    const extraDist = (Math.abs(offset) < 0.3) ? -20 : 0;
                    const finalDist = distance + extraDist;

                    const fsx = GAME_CONSTANTS.halfWidth + Math.cos(fa) * finalDist;
                    const fsy = GAME_CONSTANTS.halfHeight + Math.sin(fa) * finalDist;

                    fe.activate(fsx, fsy, currentScale, { initialSpeedMult: 6, rampDuration: 1.5 });
                    typeCounts[fe.model.type] = (typeCounts[fe.model.type] || 0) + 1;
                    fe.aimAt(GAME_CONSTANTS.halfWidth, GAME_CONSTANTS.halfHeight);
                    activeEnemies.push(fe);
                }
            });
        }

        typeCounts[mb.model.type] = (typeCounts[mb.model.type] || 0) + 1;

        mb.aimAt(GAME_CONSTANTS.halfWidth, GAME_CONSTANTS.halfHeight);
        activeEnemies.push(mb);

        messageBus.publish('minibossSpawned');
        debugLog('Miniboss spawned at angle ' + (angle * 180 / Math.PI).toFixed(1) + '°');
    }

    function _spawnBoss() {
        if (bossSpawned) return;

        const config = getCurrentLevelConfig(lastWaveProgress);
        let Class = _resolveEnemyClass(config.mainBoss);
        if (!Class) {
            console.warn(`[EnemyManager] Boss class '${config.mainBoss}' not found. Defaulting to Boss1.`);
            Class = Boss1;
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
            b.activate(item.x, item.y, GAME_VARS.scaleFactor || 1, finalConfig);
            b.aimAt(GAME_CONSTANTS.halfWidth, GAME_CONSTANTS.halfHeight);

            activeEnemies.push(b);
            spawnedUnits.push(b);
            typeCounts[b.model.type] = (typeCounts[b.model.type] || 0) + 1;
        });

        if (Class.postSpawn) Class.postSpawn(spawnedUnits);

        messageBus.publish('bossSpawned');
        debugLog('Boss spawned at angle ' + (angle * 180 / Math.PI).toFixed(1) + '°');
    }



    function _releaseToPool(e) {
        if (e.model.isBoss || e.model.isMiniboss) return; // Bosses are not pooled

        if (pools[e.model.type]) {
            pools[e.model.type].release(e);
        } else {
            // Fallback for types not explicitly in pools (shouldn't happen with current logic)
            pools.basic.release(e);
        }
    }

    function findValidAngle(generatorFn, rules) {
        let attempts = 0;
        const maxAttempts = rules.maxAttempts || 1;
        let angle;
        let valid = false;

        while (!valid && attempts < maxAttempts) {
            angle = generatorFn();
            valid = true;

            if (rules.avoidRecentAngles) {
                for (let i = 0; i < recentSpawnCount; i++) {
                    const diff = Phaser.Math.Angle.ShortestBetween(
                        Phaser.Math.RadToDeg(angle),
                        Phaser.Math.RadToDeg(recentSpawnAngles[i])
                    );
                    if (Math.abs(diff) < Phaser.Math.RadToDeg(rules.avoidRecentAngles)) {
                        valid = false;
                        break;
                    }
                }
            }

            if (valid && rules.avoidActiveTypes && rules.minSeparation) {
                for (let t = 0; t < rules.avoidActiveTypes.length; t++) {
                    const typeToAvoid = rules.avoidActiveTypes[t];
                    const minSep2 = rules.minSeparation * rules.minSeparation;

                    for (let i = 0; i < activeEnemies.length; i++) {
                        const target = activeEnemies[i];
                        if (!target.model.alive || target.model.type !== typeToAvoid) continue;

                        const targetAngle = Math.atan2(target.model.y - GAME_CONSTANTS.halfHeight, target.model.x - GAME_CONSTANTS.halfWidth);
                        const diff = Phaser.Math.Angle.ShortestBetween(
                            Phaser.Math.RadToDeg(angle),
                            Phaser.Math.RadToDeg(targetAngle)
                        );
                        if (Math.abs(diff) < Phaser.Math.RadToDeg(rules.minSeparation)) {
                            valid = false;
                            break;
                        }
                    }
                    if (!valid) break;
                }
            }

            attempts++;
        }

        if (valid) {
            recentSpawnAngles[recentSpawnIndex] = angle;
            recentSpawnIndex = (recentSpawnIndex + 1) % 6;
            recentSpawnCount = Math.min(recentSpawnCount + 1, 6);
            return angle;
        }

        return null;
    }

    /** 
     * Converts a (cx, cy) grid coordinate to a unique integer key for spatial hashing. 
     * Offset by 5000 to handle potential negative coordinates up to -750,000px reliably.
     */
    function _getGridKey(cx, cy) {
        return (cx + 5000) * 10000 + (cy + 5000);
    }

    function _onTowerDied() {
        for (let i = 0; i < activeEnemies.length; i++) {
            const e = activeEnemies[i];
            if (e.model.isBoss || e.model.isMiniboss) {
                e.model.invincible = true;
            }
        }
    }

    // ── public queries ───────────────────────────────────────────────────────

    function getNearestEnemy(x, y, range) {
        let best = null;
        let bestEffectiveDist = range;

        // 1. Check special large enemies
        for (let i = 0; i < specialEnemies.length; i++) {
            const e = specialEnemies[i];
            const maxDR = bestEffectiveDist + (e.model.size || 0);
            const dx = e.model.x - x;
            const dy = e.model.y - y;
            const d2 = dx * dx + dy * dy;

            if (d2 < maxDR * maxDR) {
                const dist = Math.sqrt(d2);
                const effectiveDist = dist - (e.model.size || 0);
                if (effectiveDist < bestEffectiveDist) {
                    bestEffectiveDist = effectiveDist;
                    best = e;
                }
            }
        }

        // 2. Check spatial grid (padded to account for max enemy radius)
        const minCellX = Math.floor((x - range - GRID_PADDING) / CELL_SIZE);
        const maxCellX = Math.floor((x + range + GRID_PADDING) / CELL_SIZE);
        const minCellY = Math.floor((y - range - GRID_PADDING) / CELL_SIZE);
        const maxCellY = Math.floor((y + range + GRID_PADDING) / CELL_SIZE);

        for (let cx = minCellX; cx <= maxCellX; cx++) {
            for (let cy = minCellY; cy <= maxCellY; cy++) {
                const arr = spatialGrid[_getGridKey(cx, cy)];
                if (arr) {
                    for (let i = 0; i < arr.length; i++) {
                        const e = arr[i];
                        const maxDR = bestEffectiveDist + (e.model.size || 0);
                        const dx = e.model.x - x;
                        const dy = e.model.y - y;
                        const d2 = dx * dx + dy * dy;

                        if (d2 < maxDR * maxDR) {
                            const dist = Math.sqrt(d2);
                            const effectiveDist = dist - (e.model.size || 0);
                            if (effectiveDist < bestEffectiveDist) {
                                bestEffectiveDist = effectiveDist;
                                best = e;
                            }
                        }
                    }
                }
            }
        }
        return best;
    }

    function getEnemyCount() {
        return activeEnemies.length;
    }

    /** Returns all active enemy objects (read-only iteration by projectileManager). */
    function getActiveEnemies() {
        return activeEnemies;
    }

    /** Returns all active, fully-spawned protectors for aura checks. */
    function getActiveProtectors() {
        return activeProtectors;
    }

    function getEnemiesInSquareRange(cx, cy, halfSize, out) {
        const result = out || [];
        result.length = 0;

        for (let i = 0; i < specialEnemies.length; i++) {
            const e = specialEnemies[i];
            const reach = halfSize + (e.model.size || 0);
            if (Math.abs(e.model.x - cx) <= reach && Math.abs(e.model.y - cy) <= reach) {
                result.push(e);
            }
        }

        const minCellX = Math.floor((cx - halfSize - GRID_PADDING) / CELL_SIZE);
        const maxCellX = Math.floor((cx + halfSize + GRID_PADDING) / CELL_SIZE);
        const minCellY = Math.floor((cy - halfSize - GRID_PADDING) / CELL_SIZE);
        const maxCellY = Math.floor((cy + halfSize + GRID_PADDING) / CELL_SIZE);

        for (let x = minCellX; x <= maxCellX; x++) {
            for (let y = minCellY; y <= maxCellY; y++) {
                const arr = spatialGrid[_getGridKey(x, y)];
                if (arr) {
                    for (let i = 0; i < arr.length; i++) {
                        const e = arr[i];
                        const reach = halfSize + (e.model.size || 0);
                        if (Math.abs(e.model.x - cx) <= reach && Math.abs(e.model.y - cy) <= reach) {
                            result.push(e);
                        }
                    }
                }
            }
        }
        return result;
    }

    function getEnemiesInDiamondRange(cx, cy, radius, ignoreEnemy = null, out) {
        const result = out || [];
        result.length = 0;

        for (let i = 0; i < specialEnemies.length; i++) {
            const e = specialEnemies[i];
            if (e === ignoreEnemy) continue;
            const dx = Math.abs(e.model.x - cx);
            const dy = Math.abs(e.model.y - cy);
            if (dx + dy <= radius + (e.model.size || 0)) {
                result.push(e);
            }
        }

        const minCellX = Math.floor((cx - radius - GRID_PADDING) / CELL_SIZE);
        const maxCellX = Math.floor((cx + radius + GRID_PADDING) / CELL_SIZE);
        const minCellY = Math.floor((cy - radius - GRID_PADDING) / CELL_SIZE);
        const maxCellY = Math.floor((cy + radius + GRID_PADDING) / CELL_SIZE);

        for (let x = minCellX; x <= maxCellX; x++) {
            for (let y = minCellY; y <= maxCellY; y++) {
                const arr = spatialGrid[_getGridKey(x, y)];
                if (arr) {
                    for (let i = 0; i < arr.length; i++) {
                        const e = arr[i];
                        if (e === ignoreEnemy) continue;
                        const dx = Math.abs(e.model.x - cx);
                        const dy = Math.abs(e.model.y - cy);
                        if (dx + dy <= radius + (e.model.size || 0)) {
                            result.push(e);
                        }
                    }
                }
            }
        }
        return result;
    }

    // ── damage ───────────────────────────────────────────────────────────────

    function damageEnemy(enemy, amount) {
        if (!enemy || !enemy.model.alive) return;

        let died = enemy.takeDamage(amount);
        let isExecuted = false;

        const zeroDayLevel = (gameState.upgrades && (gameState.upgrades['zero_day_exploit'] || gameState.upgrades.zero_day_exploit)) || 0;
        if (!died && zeroDayLevel > 0 && !enemy.model.isBoss && !enemy.model.isMiniboss && enemy.model.health <= enemy.model.maxHealth * 0.15) {
            // Execution condition met: enemy survived but is now at or below 15% HP.
            // Force lethal damage without a second hit-flash (using model directly)
            enemy.model.takeDamage(enemy.model.health + 1000);
            died = true;
            isExecuted = true;
        }

        // Use the final calculated damage from the enemy class (handles rounding/protector reduction)
        const finalAmount = Math.floor(enemy.model.lastDamageAmount !== undefined ? enemy.model.lastDamageAmount : amount);
        const isProtected = enemy.model.lastDamageWasProtected || false;

        // Color is HOSTILE (pink) normally. Purple for execution.
        let textColor = isProtected ? '#d4c6c9' : helper.colorToHexString(GAME_CONSTANTS.COLOR_HOSTILE);
        if (isExecuted) textColor = '#bf24ff';

        if (gameState.settings.showDamageNumbers) {
            let displayText = isExecuted ? ' EXECUTED ' : finalAmount.toString();

            // ISOLATION visual wrap
            if (enemy.model.wasIsolatedHit) {
                displayText = `»${displayText}«`;
                enemy.model.wasIsolatedHit = false; // Reset after use
            }

            floatingText.show(enemy.model.x, enemy.model.y - 14, '\n ' + displayText + ' \n ', {
                fontFamily: 'VCR',
                fontSize: isExecuted ? 24 : 28,
                color: textColor,
                stroke: isExecuted ? '#1a0033' : '#330000',
                strokeThickness: isExecuted ? 3 : 2,
                depth: GAME_CONSTANTS.DEPTH_PROJECTILES,
                duration: isExecuted ? 1200 : 1000,
                scaleX: isExecuted ? 0.92 : 1,
            });
        }

        if (died && !enemy.model.isGhosting) {
            // Handle multi-part bosses (Phalanx/Boss3)
            if (enemy.model.type === 'boss3') {
                const pieces = activeEnemies.filter(e => e.model.type === 'boss3' && e.model.alive);
                if (pieces.length > 1) {
                    enemy.onDeath(false); // Staged death
                    _killEnemy(enemy, true);
                    return;
                }
            }

            // Standard death
            enemy.onDeath(true); // Final/Core death
            if (enemy.model.isBoss) bossAlive = false;

            if (enemy.model.type === 'protector') {
                enemy.model.isGhosting = true;
                if (enemy.view && enemy.view.img) enemy.view.img.setAlpha(0.6);
                PhaserScene.time.delayedCall(10, () => _killEnemy(enemy));
            } else {
                _killEnemy(enemy);
            }
        }
    }

    function _killEnemy(enemy, skipBossEffects = false) {
        if (typeof customEmitters !== 'undefined') {
            if (enemy.model.type === 'shell') {
                const vx = enemy.model.vx || 0;
                const vy = enemy.model.vy || 0;
                const dist = Math.sqrt(vx * vx + vy * vy) || 1;
                const offX = (vx / dist) * 10;
                const offY = (vy / dist) * 10;
                customEmitters.playShellDeath(enemy.model.x + offX, enemy.model.y + offY, enemy.view.img ? enemy.view.img.depth : GAME_CONSTANTS.DEPTH_ENEMIES);
                if (typeof audio !== 'undefined') audio.play('small_destruction', 0.85);
            } else if (customEmitters.createEnemyDeathAnim) {
                const boss5Duration = (enemy.model && enemy.model.bossId === 'boss5') ? 1800 : 0;
                customEmitters.createEnemyDeathAnim(enemy, (enemy.model.isBoss || enemy.model.isMiniboss), boss5Duration);
            }
        }

        const ex = enemy.model.x;
        const ey = enemy.model.y;
        const wasMiniboss = enemy.model.isMiniboss;
        const wasBoss = enemy.model.isBoss;

        enemy.deactivate();

        // Swap-and-pop removal from active array
        const idx = activeEnemies.indexOf(enemy);
        if (idx !== -1) {
            activeEnemies[idx] = activeEnemies[activeEnemies.length - 1];
            activeEnemies.pop();
            _releaseToPool(enemy);
        }

        // Maintain type counts and protector lists
        typeCounts[enemy.model.type] = Math.max(0, (typeCounts[enemy.model.type] || 1) - 1);
        if (enemy.model.type === 'protector') {
            const pIdx = activeProtectors.indexOf(enemy);
            if (pIdx !== -1) {
                activeProtectors[pIdx] = activeProtectors[activeProtectors.length - 1];
                activeProtectors.pop();
            }
        }

        if (wasMiniboss) {
            minibossAlive = false;
            if (enemy.view.img) {
                customEmitters.minibossExplosion(enemy.view.img);
            }

            // Update highest miniboss level defeated
            const currentLevel = gameState.currentLevel || 1;
            if (currentLevel > (gameState.minibossLevelsDefeated || 0)) {
                gameState.minibossLevelsDefeated = currentLevel;
                debugLog('New miniboss record: level ' + currentLevel);
            }

            messageBus.publish('minibossDefeated', ex, ey);
            debugLog('Miniboss defeated');
        } else if (wasBoss && !skipBossEffects) {
            bossAlive = false;
            if (typeof audio !== 'undefined') audio.play('on_death_boss', 0.9);
            const bossDepth = (enemy.view && enemy.view.img) ? enemy.view.img.depth : (GAME_CONSTANTS.DEPTH_ENEMIES || 150);

            if (enemy.model && enemy.model.bossId === 'boss5') {
                // ── Boss5 enhanced death sequence ──────────────────────────────
                const DEATH_DURATION = 1800;

                // 3 small, jittered explosion_pulse effects
                const pulseDelays = [50, 250, 450];
                pulseDelays.forEach(delay => {
                    PhaserScene.time.delayedCall(delay, () => {
                        const angle = Math.random() * Math.PI * 2;
                        const dist = Phaser.Math.Between(300, 360);
                        const jx = ex + Math.cos(angle) * dist;
                        const jy = ey + Math.sin(angle) * dist;
                        if (typeof customEmitters !== 'undefined' && customEmitters.playExplosionPulse) {
                            customEmitters.playExplosionPulse(jx, jy, bossDepth + 9999, 1.0);
                        }
                    });
                });

                // Fewer initial rays with longer duration
                if (typeof customEmitters !== 'undefined' && customEmitters.createBossExplosionRays) {
                    customEmitters.createBossExplosionRays(ex, ey, bossDepth, {
                        count: 3,
                        rayDuration: DEATH_DURATION,
                        pulseScale: 2
                    });
                }

                // Add 3 more individual rays over 60% of the duration
                const raySpacing = Math.round((DEATH_DURATION * 0.6) / 3);
                for (let i = 0; i < 3; i++) {
                    const delay = raySpacing * (i + 1);
                    PhaserScene.time.delayedCall(delay, () => {
                        if (typeof customEmitters !== 'undefined' && customEmitters.createBossExplosionRays) {
                            customEmitters.createBossExplosionRays(ex, ey, bossDepth, {
                                count: 1,
                                rayDuration: DEATH_DURATION - delay,
                                skipPulse: true
                            });
                        }
                    });
                }

                // Option B: offset explosion clusters with synced durations
                const offsets = [{ x: -90, y: -55 }, { x: 95, y: 50 }, { x: -50, y: 85 }];
                offsets.forEach((offset, idx) => {
                    const delay = 300 + idx * 350;
                    PhaserScene.time.delayedCall(delay, () => {
                        if (typeof customEmitters !== 'undefined' && customEmitters.createBossExplosionRays) {
                            customEmitters.createBossExplosionRays(ex + offset.x, ey + offset.y, bossDepth, {
                                count: 2,
                                rayDuration: DEATH_DURATION - delay,
                                skipPulse: true
                            });
                        }
                        if (typeof cameraManager !== 'undefined') {
                            cameraManager.shake(200, 0.012);
                        }
                    });
                });

                // Second explosion pulse when body disappears — 2.5x bigger
                PhaserScene.time.delayedCall(DEATH_DURATION, () => {
                    if (typeof customEmitters !== 'undefined' && customEmitters.playExplosionPulse) {
                        customEmitters.playExplosionPulse(ex, ey, bossDepth, 4.75, 'explosion_pulse_slow', {
                            targetScale: 6,
                            duration: 300,
                            ease: 'Quart.easeOut',
                            soundKey: '8_bit_explosion'
                        });
                    }
                    if (typeof cameraManager !== 'undefined') {
                        cameraManager.shake(1500, 0.04);
                    }
                });
            } else {
                // Standard boss death
                const bossId = (enemy.model && enemy.model.bossId) ? enemy.model.bossId : '';
                const config = {};
                if (bossId === 'boss1') config.soundKey = '8_bit_explosion';

                if (typeof customEmitters !== 'undefined' && customEmitters.createBossExplosionRays) {
                    customEmitters.createBossExplosionRays(ex, ey, bossDepth, config);
                }
            }

            messageBus.publish('bossDefeated', ex, ey);
            debugLog('Boss defeated');
        } else {
            if (enemy.model.type === 'logic_stray') {
                resourceManager.spawnProcessorDrop(ex, ey);
            } else if (enemy.model.type === 'bomb') {
                const ups = gameState.upgrades || {};
                const payloadLv = ups.volatile_payload || 0;
                // Intentionally slightly fudged numbers compared to description
                const explosionRange = 175 * (1 + 0.16 * payloadLv);
                const explosionDamage = enemy.model.maxHealth * 1.25;
                const bx = ex;
                const by = ey;

                PhaserScene.time.delayedCall(220, () => {
                    if (typeof customEmitters !== 'undefined' && customEmitters.createBombExplosion) {
                        customEmitters.createBombExplosion(bx, by, explosionRange * explosionRange, explosionDamage);
                    }

                    const targets = getEnemiesInDiamondRange(bx, by, explosionRange);
                    for (let i = 0; i < targets.length; i++) {
                        damageEnemy(targets[i], explosionDamage);
                    }
                });
            }
            messageBus.publish('enemyKilled', ex, ey, enemy.model.baseResourceDrop);
        }
    }

    // ── per-frame update ─────────────────────────────────────────────────────

    function _update(delta) {
        if (!spawning || frozen || paused) return;

        const dt = delta / 1000;

        // Update timers
        if (!minibossAlive && !bossAlive) {
            combatTime += dt;
        }
        if (!minibossAlive) {
            roundTimeElapsed += dt;
        }
        GAME_VARS.roundTimeElapsed = roundTimeElapsed;

        // Update wave scale factor
        GAME_VARS.scaleFactor = Math.pow(GAME_CONSTANTS.ENEMY_SCALE_RATE, Math.floor(roundTimeElapsed / GAME_CONSTANTS.ENEMY_SCALE_INTERVAL));

        // Update spawn speed multiplier: 27x for 5s, then linearly decay to 1x over 1.25s
        let firstThreshold = 5.05;
        // Special case: if basic_pulse isn't researched, increase threshold to 5.75
        if (!(gameState.upgrades && gameState.upgrades.basic_pulse >= 1)) {
            firstThreshold = 5.15;
        }
        const secondThreshold = 1.25;
        if (combatTime < firstThreshold) {
            spawnSpeedMultiplier = 27;
        } else if (combatTime < firstThreshold + secondThreshold) {
            // Linear interpolation from 27 to 1
            const progress = (combatTime - firstThreshold) / secondThreshold;
            spawnSpeedMultiplier = 27 - 26 * progress;
        } else {
            spawnSpeedMultiplier = 1;
        }

        // Decrement fast pack cooldown
        if (fastPackCooldown > 0) {
            fastPackCooldown -= dt;
            if (fastPackCooldown < 0) fastPackCooldown = 0;
        }

        // Boss 3 (Phalanx) HP sharing synchronization (orchestrated at manager level)
        if (bossAlive && !frozen) {
            const shards = activeEnemies.filter(e => e.model.type === 'boss3' && e.model.alive);
            if (shards.length > 0) {
                boss3ShareTimer -= dt;
                if (boss3ShareTimer <= 0) {
                    boss3ShareTimer = 1.0;
                    shards.forEach(p => p.model.calculateSiphon());
                    shards.forEach(p => p.model.applySiphon());
                }
            }
        }

        // Spawn timer
        spawnTimer += delta;
        const config = getCurrentLevelConfig();
        const trueSpawnInterval = config.spawnInterval / spawnSpeedMultiplier;
        if (spawnTimer >= trueSpawnInterval) {
            spawnTimer -= trueSpawnInterval;
            _spawnOne();
        }

        // Move enemies & populate spatial grid
        // Zero-garbage clear: just set length=0 on existing arrays
        for (let key in spatialGrid) {
            spatialGrid[key].length = 0;
        }
        specialEnemies.length = 0;

        const tPos = tower.getPosition();
        const contactR = GAME_CONSTANTS.ENEMY_CONTACT_RADIUS;
        const contactR2 = contactR * contactR;

        // Note: we iterate forward or backward, it doesn't matter for grid build
        for (let i = activeEnemies.length - 1; i >= 0; i--) {
            const e = activeEnemies[i];
            if (!e || !e.model.alive) continue;

            e.update(dt * spawnSpeedMultiplier);

            // Refactor 2: Generalized post-update hook for custom boss behaviors
            if (e.model.hasPostUpdate) {
                e.model.postUpdate(dt);
            }

            // Populate grid
            if (e.model.isBoss || e.model.isMiniboss) {
                specialEnemies.push(e);
            } else {
                const cx = Math.floor(e.model.x / CELL_SIZE);
                const cy = Math.floor(e.model.y / CELL_SIZE);
                const key = _getGridKey(cx, cy);

                // Keep the array reference to avoid re-allocating
                let cell = spatialGrid[key];
                if (!cell) {
                    cell = [];
                    spatialGrid[key] = cell;
                }
                cell.push(e);
            }

            // Tower contact check — minibosses do NOT die on contact currently
            if (!e.model.isMiniboss) {
                const dx = e.model.x - tPos.x;
                const dy = e.model.y - tPos.y;
                const distSq = dx * dx + dy * dy;

                // Attack range based exactly on size for melee units
                const contactR = 10 + (e.model.size || 15) * 1.105;
                const contactR2 = contactR * contactR;

                if (distSq < contactR2) {
                    e.model.isAttacking = true;

                    if (e.model.attackTimer <= 0 && e.model.damage > 0) {
                        tower.takeDamage(e.model.damage, e.model.x, e.model.y);
                        e.model.attackTimer = e.model.attackCooldown;

                        // Apply self-damage only when it hits
                        if (e.takeDamage(e.model.selfDamage)) {
                            // Only kill if the self-damage was lethal
                            _killEnemy(e);
                        }

                        // Shell specific shake effect
                        if (e.model.type === 'shell' && typeof cameraManager !== 'undefined') {
                            cameraManager.shake(120, 0.006);
                        }
                    }

                    // tower.takeDamage may trigger die→WAVE_COMPLETE→clearAllEnemies
                    // which empties activeEnemies mid-loop, so bail out
                    if (activeEnemies.length === 0) break;
                } else {
                    e.model.isAttacking = false;
                }
            }
        }
    }

    // ── event handlers ───────────────────────────────────────────────────────

    function _onPhaseChanged(phase) {
        if (phase === GAME_CONSTANTS.PHASE_COMBAT) {
            _startSpawning();
        } else {
            _stopSpawning();
            if (phase === GAME_CONSTANTS.PHASE_WAVE_COMPLETE || phase === GAME_CONSTANTS.PHASE_UPGRADE) {
                clearAllEnemies();
            }
        }
    }

    function _onWaveProgress(progress) {
        lastWaveProgress = progress;
        if (progress >= GAME_CONSTANTS.MINIBOSS_SPAWN_PROGRESS && !minibossSpawned && spawning) {
            _spawnMiniboss();
        }
        if (progress >= 1.0 && !bossSpawned && spawning) {
            _spawnBoss();
        }
    }

    function getEnemiesByType(type) {
        return activeEnemies.filter(e => e.model.type === type && e.model.alive);
    }

    function spawnAt(type, x, y, config = {}) {
        const p = pools[type];
        if (!p) return null;
        const e = p.get();
        if (!e) return null;

        const scale = config.scale || (GAME_VARS.scaleFactor || 1);
        e.activate(x, y, scale, config);

        typeCounts[e.model.type] = (typeCounts[e.model.type] || 0) + 1;
        if (e.model.type === 'protector') activeProtectors.push(e);

        e.aimAt(GAME_CONSTANTS.halfWidth, GAME_CONSTANTS.halfHeight);
        activeEnemies.push(e);
        return e;
    }

    updateManager.addFunction(_update);

    return { init, freeze, unfreeze, clearAllEnemies, killAllNonBossEnemies, spawnAt, getNearestEnemy, getEnemyCount, getActiveEnemies, getActiveProtectors, getEnemiesInSquareRange, getEnemiesByType, damageEnemy, getCombatTime: () => combatTime, getRoundTimeElapsed: () => roundTimeElapsed };
})();
