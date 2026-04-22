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
    let manualDelay = 0;
    let spawning = false;
    let frozen = false;     // true during death sequence — movement paused, spawning stopped
    let paused = false;     // true when options menu opens
    let combatTime = 4;    // seconds since wave start — drives scaling
    let roundTimeElapsed = 0; // Total time in wave, including boss/miniboss fights
    let spawnSpeedMultiplier = 1;  // 5x for first 3 seconds of wave, then 1x
    let lastScaleLevel = 0;        // tracks current difficulty tier for spawn pauses
    let subWaveIndex = 0;          // rotates through sub-waves if defined in config

    // Miniboss state now managed by bossManager
    let lastWaveProgress = 0;     // current progress 0-1
    let recentSpawnAngles = new Float32Array(6); // tracks the last 6 spawn angles (in radians)
    let recentSpawnIndex = 0;
    let recentSpawnCount = 0;
    let waveIsFarming = false;

    // Boss state now managed by bossManager

    // Fast enemy pack tracking
    let fastPackActive = false;
    let fastPackCount = 0;
    let fastPackOriginalAngle = 0;
    let fastPackLastOffsetSign = 1;
    let fastPackCooldown = 0;

    // Trojan Access tracking
    let nextSpawnIsExploder = false;
    let spawnCountSinceLastExploder = 0;
    let sessionKills = 0; // Kills in the current iteration/wave

    // Boss 3 specifically
    // boss3ShareTimer now managed by bossManager

    let testEnemyCount = 0;

    // Spawn Rules configuration
    const ENEMY_SPAWN_RULES = {
        basic: {},
        fast: { minCombatTime: 8 },
        logic_stray: { minCombatTime: 9 },
        swarmer: { minCombatTime: 6, avoidRecentAngles: 0.45, maxAttempts: 6 },
        sniper: { minCombatTime: 6 },
        shooter: {},
        exploder: {},
        heavy: {},
        cache: { minCombatTime: 8, maxActive: 1 },
        protector: {
            minCombatTime: 7,
            maxActive: 2,
            avoidActiveTypes: ['protector'],
            minSeparation: 0.4,
            maxAttempts: 3
        }
    };


    // ── init ─────────────────────────────────────────────────────────────────

    function init() {
        bossManager.init(this);
        spatialGridUtils.init();
        _buildPools();
        messageBus.subscribe('phaseChanged', _onPhaseChanged);
        messageBus.subscribe('waveProgressChanged', _onWaveProgress);
        messageBus.subscribe('freezeEnemies', freeze);
        messageBus.subscribe('unfreezeEnemies', unfreeze);
        messageBus.subscribe('gamePaused', () => { paused = true; });
        messageBus.subscribe('gameResumed', () => { paused = false; });
        messageBus.subscribe('towerDied', _onTowerDied);
        messageBus.subscribe('addEnemySpawnDelay', (amount) => {
            if (amount > 0) manualDelay += amount;
        });
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
        pools.exploder = new ObjectPool(() => new ExploderEnemy(), resetFn, POOL_SIZE).preAllocate(5);
        pools.swarmer = new ObjectPool(() => new SwarmerEnemy(), resetFn, POOL_SIZE * 2).preAllocate(POOL_SIZE);
        pools.shell = new ObjectPool(() => new ShellEnemy(), resetFn, POOL_SIZE).preAllocate(15);
        pools.cache = new ObjectPool(() => new CacheEnemy(), resetFn, 4).preAllocate(2);
        pools.miniboss_4 = new ObjectPool(() => new Miniboss4(), resetFn, 1).preAllocate(1);
        pools.boss3 = new ObjectPool(() => new Boss3(), resetFn, 8).preAllocate(8);
        pools.test = new ObjectPool(() => new TestEnemy(), resetFn, 20).preAllocate(10);
    }

    // ── spawning ─────────────────────────────────────────────────────────────

    function _startSpawning() {
        spawning = true;
        frozen = false;
        waveIsFarming = (gameState.levelsDefeated || 0) >= (gameState.currentLevel || 1);
        spawnTimer = -950;
        manualDelay = 0;
        combatTime = 4;
        roundTimeElapsed = 0;
        lastScaleLevel = 0;
        GAME_VARS.roundTimeElapsed = roundTimeElapsed;
        GAME_VARS.scaleFactor = Math.pow(GAME_CONSTANTS.ENEMY_SCALE_RATE, Math.floor(roundTimeElapsed / GAME_CONSTANTS.ENEMY_SCALE_INTERVAL));
        bossManager.reset();
        lastWaveProgress = 0;
        recentSpawnIndex = 0;
        recentSpawnCount = 0;
        sessionKills = 0;
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
        bossManager.reset();
        testEnemyCount = 0;
        spatialGridUtils.clear();
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
        const config = getCurrentLevelConfig(lastWaveProgress, subWaveIndex);

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
            // Roll for next spawn to be an exploder if cooldown is over
            if (!nextSpawnIsExploder && spawnCountSinceLastExploder >= 3) {
                if (Math.random() < 0.1) {
                    nextSpawnIsExploder = true;
                }
            }

            // If we have a pending exploder conversion, check if this is a basic enemy
            if (nextSpawnIsExploder && (chosenType === 'basic')) {
                chosenType = 'exploder';
                nextSpawnIsExploder = false;
                spawnCountSinceLastExploder = 0;
            } else {
                // Only increment cooldown/count if it wasn't converted or wasn't a basic enemy
                spawnCountSinceLastExploder++;
            }
        }

        const rules = ENEMY_SPAWN_RULES[chosenType] || {};

        // Check time constraints
        if (rules.minCombatTime && combatTime < rules.minCombatTime) {
            chosenType = 'basic';
        }

        // Global unlock check for Data Chests (Cache enemies)
        if (chosenType === 'cache' && !((gameState.upgrades || {}).data_chest_unlock)) {
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
            } else if (chosenType === 'exploder') {
                e = pools.exploder.get();
            } else if (chosenType === 'shell') {
                e = pools.shell.get();
            } else if (chosenType === 'protector') {
                e = pools.protector.get();
            } else if (chosenType === 'cache') {
                e = pools.cache.get();
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

    // Boss and Miniboss spawning logic moved to bossManager.js



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



    function _onTowerDied() {
        bossManager.onTowerDied(activeEnemies);
    }

    // ── public queries ───────────────────────────────────────────────────────

    function getNearestEnemy(x, y, range) {
        return spatialGridUtils.getNearestEnemy(x, y, range);
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
        return spatialGridUtils.getEnemiesInSquareRange(cx, cy, halfSize, out);
    }

    function getEnemiesInDiamondRange(cx, cy, radius, ignoreEnemy = null, out) {
        return spatialGridUtils.getEnemiesInDiamondRange(cx, cy, radius, ignoreEnemy, out);
    }

    function getEnemiesInRange(cx, cy, radius, out) {
        return spatialGridUtils.getEnemiesInRange(cx, cy, radius, out);
    }

    // ── damage ───────────────────────────────────────────────────────────────

    function damageEnemy(enemy, amount, source = 'other') {
        if (!enemy || !enemy.model.alive) return;

        const result = enemy.takeDamage(amount);
        let died = result.died;

        // Use the actual damage applied to health for statistics
        statsTracker.recordDamage(result.actualApplied, source);

        // Track lifetime max damage in one hit
        if (result.actualApplied > gameState.stats.maxDamageInOneHit) {
            gameState.stats.maxDamageInOneHit = result.actualApplied;
        }
        
        // Publish event for achievements (only for high damage to reduce event overhead)
        if (result.actualApplied >= 100) {
            messageBus.publish('100DamageDealt', result.actualApplied, source);
        }

        let isExecuted = false;

        const zeroDayLevel = (gameState.upgrades && (gameState.upgrades['zero_day_exploit'] || gameState.upgrades.zero_day_exploit)) || 0;
        if (!died && zeroDayLevel > 0 && !enemy.model.isBoss && !enemy.model.isMiniboss && enemy.model.health <= enemy.model.maxHealth * 0.15) {
            // Execution condition met: enemy survived but is now at or below 15% HP.
            // Force lethal damage without a second hit-flash (using model directly)
            enemy.model.takeDamage(enemy.model.health + 1000);
            died = true;
            isExecuted = true;
            statsTracker.recordExecution();
        }

        // Use the final calculated damage from the enemy class (handles rounding/protector reduction)
        const finalAmount = Math.floor(enemy.model.lastDamageAmount !== undefined ? enemy.model.lastDamageAmount : amount);
        const isProtected = enemy.model.lastDamageWasProtected || false;

        // Color is HOSTILE (pink) normally. Purple for execution.
        let textColor = isProtected ? '#d4c6c9' : helper.colorToHexString(GAME_CONSTANTS.COLOR_HOSTILE);
        if (isExecuted) textColor = '#bf24ff';

        // Unconditionally capture and reset visual override flags so they don't bleed
        const wasIsolated = enemy.model.wasIsolatedHit;
        const wasResonance = enemy.model.wasResonanceHit;
        enemy.model.wasIsolatedHit = false;
        enemy.model.wasResonanceHit = false;

        if (gameState.settings.showDamageNumbers) {
            let displayText = isExecuted ? ' EXECUTE ' : finalAmount.toString();

            // ISOLATION visual wrap
            if (wasIsolated) {
                displayText = `›${displayText}‹`;
            }
            if (wasResonance) {
                displayText = `★${displayText}★`;
            }

            let baseFontSize = 40;
            if (!isExecuted) {
                // Square root scaling: damage 10 is the 40px baseline.
                // Clamp between 25px and 115px to avoid tiny or screen-filling numbers.
                baseFontSize = 22 + Math.floor(Math.sqrt(finalAmount) * 4);
                if (wasResonance) baseFontSize += 8;
                baseFontSize = Math.min(115, baseFontSize);
            } else {
                baseFontSize = 36;
            }

            floatingText.show(enemy.model.x, enemy.model.y - 14, '\n ' + displayText + ' \n ', {
                fontFamily: 'MunroSmall',
                fontSize: baseFontSize,
                color: textColor,
                stroke: isExecuted ? '#1a0033' : '#330000',
                strokeThickness: isExecuted ? 3 : 2,
                depth: isExecuted ? GAME_CONSTANTS.DEPTH_HUD - 10 : GAME_CONSTANTS.DEPTH_RESOURCES + 50,
                duration: isExecuted ? 1200 : 1000,
                scaleX: isExecuted ? 0.92 : 1,
            });
        }

        if (died && !enemy.model.isGhosting) {
            // Handle multi-part bosses (Phalanx/Boss3)
            if (enemy.model.type === 'boss3') {
                const pieces = activeEnemies.filter(e => e.model.type === 'boss3' && e.model.alive);
                if (pieces.length > 1) {
                    _killEnemy(enemy, true, wasResonance);
                    return;
                }
            }

            if (enemy.model.type === 'protector') {
                enemy.model.isGhosting = true;
                if (enemy.view && enemy.view.img) enemy.view.img.setAlpha(0.6);
                PhaserScene.time.delayedCall(10, () => _killEnemy(enemy, false, wasResonance));
            } else {
                _killEnemy(enemy, false, wasResonance);
            }
        }
    }

    function _killEnemy(enemy, skipBossEffects = false, wasResonance = false) {
        // Trigger unit-specific death logic (resources, explosions, sounds)
        // Shards/Staged deaths pass skipBossEffects=true, so they get onDeath(false)
        enemy.onDeath(!skipBossEffects);

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

        // Removal from active array
        const idx = activeEnemies.indexOf(enemy);
        if (idx !== -1) {
            activeEnemies[idx] = activeEnemies[activeEnemies.length - 1];
            activeEnemies.pop();
            _releaseToPool(enemy);

            if (enemy.model.type === 'test') {
                testEnemyCount = Math.max(0, testEnemyCount - 1);
                if (testEnemyCount <= 0 && typeof GAME_VARS !== 'undefined' && GAME_VARS.testingDefenses) {
                    const bombArmed = (typeof pulseAttack !== 'undefined' && pulseAttack.getModel().bombArmed);
                    if (!bombArmed) {
                        GAME_VARS.testingDefenses = false;
                        messageBus.publish('testingDefensesEnded');
                    }
                }
            }
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
            bossManager.onEnemyDeath(enemy, ex, ey, wasMiniboss, wasBoss, skipBossEffects);
            if (enemy.view && enemy.view.img) {
                customEmitters.minibossExplosion(enemy.view.img);
            }
            if (typeof zoomShake !== 'undefined') {
                zoomShake(1.025);
            }
        } else if (wasBoss && !skipBossEffects) {
            bossManager.onEnemyDeath(enemy, ex, ey, wasMiniboss, wasBoss, skipBossEffects);

            // Brief but intense screenshake for boss death
            if (typeof cameraManager !== 'undefined') {
                cameraManager.shake(300, 0.018);
            }
            if (typeof zoomShake !== 'undefined') {
                zoomShake(1.025);
            }

            // Cinematic time slow on boss death (90% reduction)
            timeManager.applyTimeScale(0.1);
            timeManager.tweenTimeScale(1, 200);

            const bossDepth = (enemy.view && enemy.view.img) ? enemy.view.img.depth : (GAME_CONSTANTS.DEPTH_ENEMIES || 150);

            // Standard boss death
            const bossId = (enemy.model && enemy.model.bossId) ? enemy.model.bossId : '';
            const config = {};
            if (bossId === 'boss1') config.soundKey = '8_bit_explosion';

            // Standard rays for all bosses (including Boss 5 if it calls super.onDeath)
            if (typeof customEmitters !== 'undefined' && customEmitters.createBossExplosionRays) {
                customEmitters.createBossExplosionRays(ex, ey, bossDepth, config);
            }
        } else {
            messageBus.publish('enemyKilled', ex, ey, enemy.model.baseResourceDrop, enemy.model.type, wasResonance);
            if (enemy.model.type !== 'test') sessionKills++;
        }
    }

    // ── per-frame update ─────────────────────────────────────────────────────

    function _update(delta) {
        if ((!spawning && !(typeof GAME_VARS !== 'undefined' && GAME_VARS.testingDefenses)) || frozen || paused) return;

        const dt = delta / 1000;

        if (spawning) {
            // Update timers
            if (!bossManager.isMinibossAlive() && !bossManager.isBossAlive()) {
                combatTime += dt;
            }
            if (!bossManager.isMinibossAlive() || waveIsFarming) {
                roundTimeElapsed += dt;
            }
            GAME_VARS.roundTimeElapsed = roundTimeElapsed;

            // Update wave scale factor
            const currentScaleLevel = Math.floor(roundTimeElapsed / GAME_CONSTANTS.ENEMY_SCALE_INTERVAL);
            if (currentScaleLevel > lastScaleLevel) {
                lastScaleLevel = currentScaleLevel;
                subWaveIndex++;

                // Only pause every other scale interval (~12s)
                if (currentScaleLevel % 1 === 0) {
                    const config = getCurrentLevelConfig();
                    const pauseDur = (config.spawnPauseDuration !== undefined) ? config.spawnPauseDuration : 3000;
                    messageBus.publish('addEnemySpawnDelay', pauseDur);
                }
            }
            GAME_VARS.scaleFactor = Math.pow(GAME_CONSTANTS.ENEMY_SCALE_RATE, currentScaleLevel);

            // Update spawn speed multiplier: 27x for 5s, then linearly decay to 1x over 1.25s
            let firstThreshold = 5.05;
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

            // specialized boss behavior logic moved to bossManager.update()
            bossManager.update(dt, activeEnemies);

            // Spawn timer
            if (manualDelay > 0) {
                manualDelay -= delta;
            } else {
                spawnTimer += delta;
                const config = getCurrentLevelConfig();
                let trueSpawnInterval = config.spawnInterval / spawnSpeedMultiplier;

                if (bossManager.isBossAlive()) {
                    trueSpawnInterval += 150;
                }
                if (bossManager.isMinibossAlive()) {
                    trueSpawnInterval += 125;
                }

                // Early game slowdown: if only 1 node (AWAKEN) or fewer researched
                const researchedCount = Object.keys(gameState.upgrades || {}).length;
                if (researchedCount <= 1) {
                    trueSpawnInterval *= 1.75;
                }

                // Farming mode speedup (cumulative 0.9x each minute)
                if (waveIsFarming && !(typeof GAME_VARS !== 'undefined' && GAME_VARS.testingDefenses)) {
                    trueSpawnInterval *= Math.pow(0.9, 1 + Math.floor(roundTimeElapsed / 60));
                }

                if (spawnTimer >= trueSpawnInterval) {
                    spawnTimer -= trueSpawnInterval;
                    // No more spawns after boss victory in normal mode
                    if (!waveIsFarming && bossManager.isBossSpawned() && !bossManager.isBossAlive()) {
                        // Do nothing
                    } else {
                        _spawnOne();
                    }
                }
            }

            // Farming miniboss spawn: first at 30s, then every 60s after
            if (waveIsFarming && spawning && roundTimeElapsed >= 30 && !(typeof GAME_VARS !== 'undefined' && GAME_VARS.testingDefenses)) {
                const n = Math.floor((roundTimeElapsed - 30) / 60) + 1;
                if (n > bossManager.getFarmingMinibossCount()) {
                    const p = Math.pow(2.2, n - 1);

                    const isMB3 = Math.random() < 0.15;
                    const type = isMB3 ? 'Miniboss3' : 'Miniboss1';

                    const config = getCurrentLevelConfig();
                    const baseH = (GAME_CONSTANTS.ENEMY_BASE_HEALTH * (config.levelScalingModifier || 1)) * 10;
                    const baseD = (GAME_CONSTANTS.ENEMY_BASE_DAMAGE * (config.levelScalingModifier || 1)) * 5;

                    let targetH = baseH * p;
                    let targetD = baseD * p;
                    let data = 10;

                    if (isMB3) {
                        targetH *= 3;
                        data = 30;
                    }

                    bossManager.spawnMiniboss(lastWaveProgress, true, p, type, {
                        health: targetH,
                        damage: targetD,
                        data: data,
                        multiplier: p
                    });
                }
            }
        }

        // Force multiplier to 1.0 during Sandbox Mode to prevent "rush" speed on test enemies
        if (typeof GAME_VARS !== 'undefined' && GAME_VARS.testingDefenses) {
            spawnSpeedMultiplier = 1.0;
        }

        spatialGridUtils.resetForFrame();

        const tPos = tower.getPosition();
        if (!tPos) return;

        // PASS 1: Update positions and populate spatial grid
        let i = 0;
        while (i < activeEnemies.length) {
            const e = activeEnemies[i];
            if (!e || !e.model.alive) {
                i++;
                continue;
            }

            const prevLen = activeEnemies.length;
            e.update(dt * spawnSpeedMultiplier);

            if (e.model.alive) {
                if (e.model.hasPostUpdate) {
                    e.model.postUpdate(dt);
                }
                spatialGridUtils.insert(e);
            }

            // Cleanup if enemy died during update (e.g. from DOT)
            if (activeEnemies.length < prevLen && activeEnemies[i] !== e) {
                continue;
            }
            i++;
        }

        // PASS 2: Tower contact and collision checks
        i = 0;
        while (i < activeEnemies.length) {
            const e = activeEnemies[i];
            if (!e || !e.model.alive) {
                i++;
                continue;
            }

            const prevLen = activeEnemies.length;

            if (!e.model.isMiniboss) {
                const dx = e.model.x - tPos.x;
                const dy = e.model.y - tPos.y;
                const distSq = dx * dx + dy * dy;

                const attackDistR2 = e.model.contactR2 || 2025;

                if (distSq < attackDistR2) {
                    e.model.isAttacking = true;

                    if (e.model.attackTimer <= 0 && e.model.damage > 0) {
                        const playerSurvived = tower.takeDamage(e.model.damage, e.model.x, e.model.y);
                        e.model.attackTimer = e.model.attackCooldown;

                        if (playerSurvived && e.takeDamage(e.model.selfDamage).died) {
                            _killEnemy(e);
                        }
                    }
                    if (activeEnemies.length === 0) break;
                } else {
                    e.model.isAttacking = false;
                }
            }

            if (activeEnemies.length < prevLen && activeEnemies[i] !== e) {
                continue;
            }
            i++;
        }
    }



    // ── event handlers ───────────────────────────────────────────────────────

    function _onPhaseChanged(phase) {
        if (phase === GAME_CONSTANTS.PHASE_COMBAT) {
            subWaveIndex = 0;
            _startSpawning();
        } else {
            _stopSpawning();
            if (phase === GAME_CONSTANTS.PHASE_WAVE_COMPLETE || phase === GAME_CONSTANTS.PHASE_UPGRADE) {
                if (typeof GAME_VARS !== 'undefined' && GAME_VARS.testingDefenses) {
                    GAME_VARS.testingDefenses = false;
                    stopTestingDefenses();
                }
                clearAllEnemies();
            }
        }
    }

    function _onWaveProgress(progress) {
        lastWaveProgress = progress;
        const currentLevel = gameState.currentLevel || 1;
        const levelBeaten = (gameState.levelsDefeated || 0) >= currentLevel;
        const minibossBeaten = (gameState.minibossLevelsDefeated || 0) >= currentLevel;

        if (progress >= GAME_CONSTANTS.MINIBOSS_SPAWN_PROGRESS && !bossManager.isMinibossSpawned() && spawning && !minibossBeaten) {
            bossManager.spawnMiniboss(lastWaveProgress);
        }
        if (progress >= 1.0 && !bossManager.isBossSpawned() && spawning && !levelBeaten) {
            bossManager.spawnBoss(lastWaveProgress);
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

    function startTestingDefenses() {
        if (testEnemyCount >= 45) return;

        const isInitiating = (typeof GAME_VARS !== 'undefined' && !GAME_VARS.testingDefenses);

        const lastBeaten = gameState.levelsDefeated || 0;
        const maxLevelUnlocked = lastBeaten + 1;
        const count = 4 + maxLevelUnlocked;

        // Reset combatTime to ensure spawnSpeedMultiplier stays at 1.0 during the test
        combatTime = 0;

        let scaleFactor = 1;
        if (typeof LEVEL_CONFIG !== 'undefined' && LEVEL_CONFIG[maxLevelUnlocked]) {
            scaleFactor = LEVEL_CONFIG[maxLevelUnlocked].levelScalingModifier || 1;
        }

        testEnemyCount += count;
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const distance = 550 + Math.random() * (120 + maxLevelUnlocked * 15);
            const x = GAME_CONSTANTS.halfWidth + Math.cos(angle) * distance;
            const y = GAME_CONSTANTS.halfHeight + Math.sin(angle) * distance;

            spawnAt('test', x, y, { scale: scaleFactor });
        }

        if (isInitiating) {
            messageBus.publish('testingDefensesStarted');
        }
    }

    function stopTestingDefenses() {
        testEnemyCount = 0;
        for (let i = activeEnemies.length - 1; i >= 0; i--) {
            const e = activeEnemies[i];
            if (e && e.model.type === 'test') {
                e.deactivate();
                activeEnemies[i] = activeEnemies[activeEnemies.length - 1];
                activeEnemies.pop();
                _releaseToPool(e);
            }
        }
        messageBus.publish('testingDefensesEnded');
    }

    function registerEnemy(e) {
        activeEnemies.push(e);
        typeCounts[e.model.type] = (typeCounts[e.model.type] || 0) + 1;
        if (e.model.type === 'protector') activeProtectors.push(e);
    }

    updateManager.addFunction(_update);

    return {
        init,
        freeze,
        unfreeze,
        clearAllEnemies,
        killAllNonBossEnemies,
        spawnAt,
        registerEnemy,
        getNearestEnemy,
        getEnemyCount,
        getActiveEnemies,
        getActiveProtectors,
        getEnemiesInRange,
        getEnemiesInDiamondRange,
        getEnemiesInSquareRange,
        getEnemiesByType,
        damageEnemy,
        getCombatTime: () => combatTime,
        getRoundTimeElapsed: () => roundTimeElapsed,
        getScaleFactor: () => GAME_VARS.scaleFactor || 1,
        getCurrentLevelConfig,
        startTestingDefenses,
        stopTestingDefenses,
        getSessionKills: () => sessionKills,
        isBossAlive: () => bossManager.isBossAlive(),
        isBossSpawned: () => bossManager.isBossSpawned(),
        isMinibossAlive: () => bossManager.isMinibossAlive()
    };
})();
