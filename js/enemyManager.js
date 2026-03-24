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
    let activeProtectors = []; // persistent list of protectors for aura checks
    let typeCounts = {};    // tracks number of active enemies per type (for spawn limits)
    let spawnTimer = 0;
    let spawning = false;
    let frozen = false;     // true during death sequence — movement paused, spawning stopped
    let paused = false;     // true when options menu opens
    let combatTime = 4;    // seconds since wave start — drives scaling
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
    }

    // ── spawning ─────────────────────────────────────────────────────────────

    function _startSpawning() {
        spawning = true;
        frozen = false;
        spawnTimer = -950;
        combatTime = 4;
        GAME_VARS.scaleFactor = Math.pow(GAME_CONSTANTS.ENEMY_SCALE_RATE, Math.floor(combatTime / GAME_CONSTANTS.ENEMY_SCALE_INTERVAL));
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
        for (let key in typeCounts) typeCounts[key] = 0;
    }

    function killAllNonBossEnemies() {
        for (let i = activeEnemies.length - 1; i >= 0; i--) {
            const e = activeEnemies[i];
            if (e && e.alive && !e.isBoss) {
                // Inflict lethal damage using selfDamage to ensure it dies and triggers drops
                e.takeDamage(e.maxHealth * 10);
                if (e.alive) {
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
            typeCounts[e.type] = (typeCounts[e.type] || 0) + 1;
            if (e.type === 'protector') activeProtectors.push(e);

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
            'Boss1': typeof Boss1 !== 'undefined' ? Boss1 : null,
            'Boss5': typeof Boss5 !== 'undefined' ? Boss5 : null
        };
        return registry[className];
    }

    function _getValidBossSpawnAngle() {
        const rules5 = { avoidActiveTypes: ['protector'], minSeparation: 0.5, maxAttempts: 5 };
        let angle = findValidAngle(Miniboss.getSpawnAngle, rules5);
        if (angle !== null) return angle;

        const rules3 = { avoidActiveTypes: ['protector'], minSeparation: 0.3, maxAttempts: 5 };
        angle = findValidAngle(Miniboss.getSpawnAngle, rules3);
        if (angle !== null) return angle;

        return Miniboss.getSpawnAngle();
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

                    fe.activate(fsx, fsy, currentScale, { initialSpeedMult: 6, rampDuration: 1.1 });
                    typeCounts[fe.type] = (typeCounts[fe.type] || 0) + 1;
                    fe.aimAt(GAME_CONSTANTS.halfWidth, GAME_CONSTANTS.halfHeight);
                    activeEnemies.push(fe);
                }
            });
        }

        typeCounts[mb.type] = (typeCounts[mb.type] || 0) + 1;

        mb.aimAt(GAME_CONSTANTS.halfWidth, GAME_CONSTANTS.halfHeight);
        activeEnemies.push(mb);

        messageBus.publish('minibossSpawned');
        debugLog('Miniboss spawned at angle ' + (angle * 180 / Math.PI).toFixed(1) + '°');
    }

    function _spawnBoss() {
        if (bossSpawned) return;

        const config = getCurrentLevelConfig(lastWaveProgress);
        let bossClass = _resolveEnemyClass(config.mainBoss);
        let b = null;
        if (!bossClass) {
            console.warn(`[EnemyManager] Boss class '${config.mainBoss}' not found. Defaulting to Boss1.`);
            bossClass = Boss1;
            b = new bossClass(config.levelScalingModifier || 1);
        } else {
            b = new bossClass(1);
        }

        if (!b) return;

        bossSpawned = true;
        bossAlive = true;

        const distance = GAME_CONSTANTS.ENEMY_SPAWN_DISTANCE;
        const angle = _getValidBossSpawnAngle();
        const sx = GAME_CONSTANTS.halfWidth + Math.cos(angle) * distance;
        const sy = GAME_CONSTANTS.halfHeight + Math.sin(angle) * distance;

        // Visual warning before spawning
        const warningImg = PhaserScene.add.image(sx, sy, 'enemies', 'warning_big.png');
        warningImg.setDepth(GAME_CONSTANTS.DEPTH_ENEMIES - 1);
        warningImg.setOrigin(0, 0.5);
        warningImg.setScale(1.5, 1.4);
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

        // Use standard scale factor or custom logic if needed
        b.activate(sx, sy, GAME_VARS.scaleFactor || 1);

        typeCounts[b.type] = (typeCounts[b.type] || 0) + 1;

        b.aimAt(GAME_CONSTANTS.halfWidth, GAME_CONSTANTS.halfHeight);
        activeEnemies.push(b);

        messageBus.publish('bossSpawned');
        debugLog('Boss spawned at angle ' + (angle * 180 / Math.PI).toFixed(1) + '°');
    }

    function _releaseToPool(e) {
        if (e.isBoss || e.isMiniboss) return; // Bosses are not pooled

        if (pools[e.type]) {
            pools[e.type].release(e);
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
                        if (!target.alive || target.type !== typeToAvoid) continue;

                        const targetAngle = Math.atan2(target.y - GAME_CONSTANTS.halfHeight, target.x - GAME_CONSTANTS.halfWidth);
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

    function _onTowerDied() {
        for (let i = 0; i < activeEnemies.length; i++) {
            const e = activeEnemies[i];
            if (e.isBoss || e.isMiniboss) {
                e.invincible = true;
            }
        }
    }

    // ── public queries ───────────────────────────────────────────────────────

    function getNearestEnemy(x, y, range) {
        let best = null;
        let bestEffectiveDist = range;

        for (let i = 0; i < activeEnemies.length; i++) {
            const e = activeEnemies[i];
            if (!e.alive) continue;

            const dx = e.x - x;
            const dy = e.y - y;
            const d2 = dx * dx + dy * dy;

            // Pre-check squared distance before sqrt
            const maxDR = bestEffectiveDist + (e.size || 0);
            if (d2 < maxDR * maxDR) {
                const dist = Math.sqrt(d2);
                const effectiveDist = dist - (e.size || 0);

                if (effectiveDist < bestEffectiveDist) {
                    bestEffectiveDist = effectiveDist;
                    best = e;
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

    /**
     * Get all alive enemies whose hitbox overlaps a square AOE.
     * Uses simple abs-based box overlap — no sqrt.
     * @param {number} cx        Center X of the AOE square
     * @param {number} cy        Center Y of the AOE square
     * @param {number} halfSize  Half-width of the AOE square
     * @param {Array}  [out]     Optional reusable array to avoid GC
     * @returns {Array} Enemies in range
     */
    function getEnemiesInSquareRange(cx, cy, halfSize, out) {
        const result = out || [];
        result.length = 0;
        for (let i = 0; i < activeEnemies.length; i++) {
            const e = activeEnemies[i];
            if (!e.alive) continue;
            const reach = halfSize + e.size;
            if (Math.abs(e.x - cx) <= reach && Math.abs(e.y - cy) <= reach) {
                result.push(e);
            }
        }
        return result;
    }

    /**
     * Get all active enemies within a diamond shape (Manhattan distance).
     * @param {number} cx        Center X of the AOE
     * @param {number} cy        Center Y of the AOE
     * @param {number} radius    Radius (Manhattan distance)
     * @param {number} [ignoreEnemy=null] Optional enemy to ignore.
     * @param {Array}  [out]     Optional reusable array to avoid GC
     * @returns {Array} Enemies in range
     */
    function getEnemiesInDiamondRange(cx, cy, radius, ignoreEnemy = null, out) {
        const result = out || [];
        result.length = 0;
        for (let i = 0; i < activeEnemies.length; i++) {
            const e = activeEnemies[i];
            if (!e.alive || e === ignoreEnemy) continue;

            const dx = Math.abs(e.x - cx);
            const dy = Math.abs(e.y - cy);

            // Manhattan distance defines a diamond
            if (dx + dy <= radius + (e.size || 0)) {
                result.push(e);
            }
        }
        return result;
    }

    // ── damage ───────────────────────────────────────────────────────────────

    function damageEnemy(enemy, amount) {
        if (!enemy || !enemy.alive) return;

        let died = enemy.takeDamage(amount);
        let isExecuted = false;

        const zeroDayLevel = (gameState.upgrades && (gameState.upgrades['zero_day_exploit'] || gameState.upgrades.zero_day_exploit)) || 0;
        if (!died && zeroDayLevel > 0 && !enemy.isBoss && !enemy.isMiniboss && enemy.health <= enemy.maxHealth * 0.15) {
            // Execution condition met: enemy survived but is now at or below 15% HP.
            // Force lethal damage without a second hit-flash (using model directly)
            enemy.model.takeDamage(enemy.health + 1000);
            died = true;
            isExecuted = true;
        }

        // Use the final calculated damage from the enemy class (handles rounding/protector reduction)
        const finalAmount = Math.floor(enemy.lastDamageAmount !== undefined ? enemy.lastDamageAmount : amount);
        const isProtected = enemy.lastDamageWasProtected || false;

        // Color is HOSTILE (pink) normally. Purple for execution.
        let textColor = isProtected ? '#d4c6c9' : helper.colorToHexString(GAME_CONSTANTS.COLOR_HOSTILE);
        if (isExecuted) textColor = '#bf24ff';

        if (gameState.settings.showDamageNumbers) {
            const displayText = isExecuted ? ' EXECUTED ' : finalAmount.toString();
            floatingText.show(enemy.x, enemy.y - 14, '\n ' + displayText + ' \n ', {
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
        if (died && !enemy.isGhosting) {
            if (enemy.type === 'protector') {
                enemy.isGhosting = true;
                // Fade out to signify its "dying" state while aura remains
                if (enemy.view && enemy.view.img) enemy.view.img.setAlpha(0.6);
                PhaserScene.time.delayedCall(10, () => {
                    _killEnemy(enemy);
                });
            } else {
                _killEnemy(enemy);
            }
        }
    }

    function _killEnemy(enemy) {
        if (typeof customEmitters !== 'undefined' && customEmitters.createEnemyDeathAnim) {
            customEmitters.createEnemyDeathAnim(enemy, (enemy.isBoss || enemy.isMiniboss));
        }

        const ex = enemy.x;
        const ey = enemy.y;
        const wasMiniboss = enemy.isMiniboss;
        const wasBoss = enemy.isBoss;

        enemy.deactivate();

        // Swap-and-pop removal from active array
        const idx = activeEnemies.indexOf(enemy);
        if (idx !== -1) {
            activeEnemies[idx] = activeEnemies[activeEnemies.length - 1];
            activeEnemies.pop();
            _releaseToPool(enemy);
        }

        // Maintain type counts and protector lists
        typeCounts[enemy.type] = Math.max(0, (typeCounts[enemy.type] || 1) - 1);
        if (enemy.type === 'protector') {
            const pIdx = activeProtectors.indexOf(enemy);
            if (pIdx !== -1) {
                activeProtectors[pIdx] = activeProtectors[activeProtectors.length - 1];
                activeProtectors.pop();
            }
        }

        if (wasMiniboss) {
            minibossAlive = false;
            if (enemy.img) {
                customEmitters.minibossExplosion(enemy.img);
            }

            // Update highest miniboss level defeated
            const currentLevel = gameState.currentLevel || 1;
            if (currentLevel > (gameState.minibossLevelsDefeated || 0)) {
                gameState.minibossLevelsDefeated = currentLevel;
                debugLog('New miniboss record: level ' + currentLevel);
            }

            messageBus.publish('minibossDefeated', ex, ey);
            debugLog('Miniboss defeated');
        } else if (wasBoss) {
            bossAlive = false;
            if (typeof audio !== 'undefined') audio.play('on_death_boss', 0.9);
            if (typeof customEmitters !== 'undefined' && customEmitters.createBossExplosionRays) {
                customEmitters.createBossExplosionRays(ex, ey, (enemy.view && enemy.view.img) ? enemy.view.img.depth : (GAME_CONSTANTS.DEPTH_ENEMIES || 150));
            }
            messageBus.publish('bossDefeated', ex, ey);
            debugLog('Boss defeated');
        } else {
            if (enemy.type === 'logic_stray') {
                resourceManager.spawnProcessorDrop(ex, ey);
            } else if (enemy.type === 'bomb') {
                const ups = gameState.upgrades || {};
                const payloadLv = ups.volatile_payload || 0;
                // Intentionally slightly fudged numbers compared to description
                const explosionRange = 175 * (1 + 0.16 * payloadLv);
                const explosionDamage = enemy.maxHealth * 1.25;
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
            messageBus.publish('enemyKilled', ex, ey, enemy.baseResourceDrop);
        }
    }

    // ── per-frame update ─────────────────────────────────────────────────────

    function _update(delta) {
        if (!spawning || frozen || paused) return;

        const dt = delta / 1000;

        // Pause combatTime (scaling) while major enemies are alive
        if (!minibossAlive && !bossAlive) {
            combatTime += dt;
        }

        // Update wave scale factor
        GAME_VARS.scaleFactor = Math.pow(GAME_CONSTANTS.ENEMY_SCALE_RATE, Math.floor(combatTime / GAME_CONSTANTS.ENEMY_SCALE_INTERVAL));

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

        // Spawn timer
        spawnTimer += delta;
        const config = getCurrentLevelConfig();
        const trueSpawnInterval = config.spawnInterval / spawnSpeedMultiplier;
        if (spawnTimer >= trueSpawnInterval) {
            spawnTimer -= trueSpawnInterval;
            _spawnOne();
        }

        // Move enemies & check tower contact
        const tPos = tower.getPosition();
        const contactR = GAME_CONSTANTS.ENEMY_CONTACT_RADIUS;
        const contactR2 = contactR * contactR;

        for (let i = activeEnemies.length - 1; i >= 0; i--) {
            const e = activeEnemies[i];
            if (!e || !e.alive) continue;

            e.update(dt * spawnSpeedMultiplier);

            // Tower contact check — minibosses do NOT die on contact currently
            if (!e.isMiniboss) {
                const dx = e.x - tPos.x;
                const dy = e.y - tPos.y;
                const distSq = dx * dx + dy * dy;

                // Attack range based exactly on size for melee units
                const contactR = 12 + (e.size || 15) * 1.06;
                const contactR2 = contactR * contactR;

                if (distSq < contactR2) {
                    e.isAttacking = true;

                    if (e.attackTimer <= 0 && e.damage > 0) {
                        tower.takeDamage(e.damage, e.x, e.y);
                        e.attackTimer = e.attackCooldown;

                        // Apply self-damage only when it hits
                        if (e.takeDamage(e.selfDamage)) {
                            // Only kill if the self-damage was lethal
                            _killEnemy(e);
                        }
                    }

                    // tower.takeDamage may trigger die→WAVE_COMPLETE→clearAllEnemies
                    // which empties activeEnemies mid-loop, so bail out
                    if (activeEnemies.length === 0) break;
                } else {
                    e.isAttacking = false;
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

    updateManager.addFunction(_update);

    return { init, freeze, unfreeze, clearAllEnemies, killAllNonBossEnemies, getNearestEnemy, getEnemyCount, getActiveEnemies, getActiveProtectors, getEnemiesInSquareRange, damageEnemy, getCombatTime: () => combatTime };
})();
