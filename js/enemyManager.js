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

    let pool = [];          // pre-allocated BasicEnemy instances
    let shooterPool = [];   // pre-allocated ShooterEnemy instances
    let swarmerPool = [];   // pre-allocated SwarmerEnemy instances
    let heavyPool = [];     // pre-allocated HeavyEnemy instances
    let fastPool = [];      // pre-allocated FastEnemy instances
    let sniperPool = [];    // pre-allocated SniperEnemy instances
    let logicStrayPool = []; // pre-allocated LogicStrayEnemy instances
    let protectorPool = []; // pre-allocated ProtectorEnemy instances
    let minibossPool = [];  // pre-allocated Miniboss instances
    let bossPool = [];      // pre-allocated Boss1 instances
    let activeEnemies = []; // currently alive Enemy references (includes minibosses)
    let spawnTimer = 0;
    let spawning = false;
    let frozen = false;     // true during death sequence — movement paused, spawning stopped
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
    let fastPackCooldown = 0;

    // Spawn Rules configuration
    const ENEMY_SPAWN_RULES = {
        basic: {},
        fast: { minCombatTime: 9 },
        logic_stray: { minCombatTime: 9 },
        swarmer: { minCombatTime: 6, avoidRecentAngles: 0.45, maxAttempts: 6 },
        sniper: { minCombatTime: 6 },
        shooter: {},
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
        _buildPool();
        _buildMinibossPool();
        _buildBossPool();
        messageBus.subscribe('phaseChanged', _onPhaseChanged);
        messageBus.subscribe('freezeEnemies', freeze);
        messageBus.subscribe('unfreezeEnemies', unfreeze);
        messageBus.subscribe('waveProgressChanged', _onWaveProgress);
    }

    function _buildPool() {
        for (let i = 0; i < POOL_SIZE; i++) {
            pool.push(new BasicEnemy());
            shooterPool.push(new ShooterEnemy());
            heavyPool.push(new HeavyEnemy());
            fastPool.push(new FastEnemy());
            sniperPool.push(new SniperEnemy());
            logicStrayPool.push(new LogicStrayEnemy());
            protectorPool.push(new ProtectorEnemy());
        }
        for (let i = 0; i < POOL_SIZE * 2; i++) { // Double pool size since they spawn in clusters
            swarmerPool.push(new SwarmerEnemy());
        }
    }

    function _buildMinibossPool() {
        for (let i = 0; i < MINIBOSS_POOL_SIZE; i++) {
            minibossPool.push(new Miniboss1());
        }
    }

    function _buildBossPool() {
        // Only ever 1 boss at a time, but allocate 2 to be safe
        for (let i = 0; i < 2; i++) {
            bossPool.push(new Boss1());
        }
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
        for (let i = activeEnemies.length - 0; i >= 0; i--) {
            if (activeEnemies[i]) activeEnemies[i].deactivate();
        }
        activeEnemies.length = 0;
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
                if (Math.random() < 0.6) {
                    chosenType = 'fast';
                } else {
                    // Pack broken by bad luck
                    fastPackActive = false;
                    if (fastPackCount > 1) fastPackCooldown = 5;
                }
            } else if (chosenType !== 'fast') {
                // Pack broken by a non-basic spawn rolling naturally
                fastPackActive = false;
                if (fastPackCount > 1) fastPackCooldown = 5;
            }
        }

        // Check max active limits
        if (chosenType !== 'basic' && rules.maxActive) {
            const activeCount = activeEnemies.filter(e => e.alive && e.type === chosenType).length;
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
            // Pick an angle 0.2 to 0.5 radians away from original, varying polarity
            const offset = Phaser.Math.Between(20, 50) / 100 * (Math.random() < 0.5 ? 1 : -1);
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
                e = _getSwarmerFromPool();
            } else if (chosenType === 'shooter') {
                e = _getShooterFromPool();
            } else if (chosenType === 'heavy') {
                e = _getHeavyFromPool();
            } else if (chosenType === 'fast') {
                e = _getFastFromPool();
            } else if (chosenType === 'sniper') {
                e = _getSniperFromPool();
            } else if (chosenType === 'logic_stray') {
                e = _getLogicStrayFromPool();
            } else if (chosenType === 'protector') {
                e = _getProtectorFromPool();
            }

            if (!e) e = _getFromPool(); // fallback to basic if target pool is exhausted
            if (!e) continue;           // safety net: all fallback pools exhausted

            let sx = baseX;
            let sy = baseY;

            if (numToSpawn > 1) {
                // Swarmers form layers of up to 4 to avoid overly wide arcs
                const layer = Math.floor(i / 4);
                const indexInLayer = i % 4;
                const layerSize = Math.min(4, numToSpawn - (layer * 4));

                // Spread them along the arc for this specific layer
                const angleStep = 0.1; // ~5.7 degrees
                let angleOffset = (indexInLayer - (layerSize - 1) / 2) * angleStep;

                // Offset every second layer by 0.05 radians to break up straight lines
                if (layer % 2 === 1) {
                    angleOffset += 0.05;
                }

                const finalAngle = angle + angleOffset;

                // Push each subsequent layer further away from the tower
                const layerDistance = layer * 30;

                // Minor random distance staggering within the layer (increased by 33%)
                const distanceVariation = Phaser.Math.Between(-12, 12);

                // Recalculate coordinate using base distance + layer push back + random stagger
                const finalDist = distance + layerDistance + distanceVariation;

                sx = GAME_CONSTANTS.halfWidth + Math.cos(finalAngle) * finalDist;
                sy = GAME_CONSTANTS.halfHeight + Math.sin(finalAngle) * finalDist;

                // Minor jitter (increased by 33%)
                sx += Phaser.Math.Between(-8, 8);
                sy += Phaser.Math.Between(-8, 8);
            }

            // Activate (sets stats and resets visuals inside Enemy subclass)
            e.activate(sx, sy, currentScale);

            // Aim at tower center
            e.aimAt(GAME_CONSTANTS.halfWidth, GAME_CONSTANTS.halfHeight);

            activeEnemies.push(e);
        }
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
        const mb = _getMinibossFromPool();
        if (!mb) return;

        minibossSpawned = true;
        minibossAlive = true;

        const distance = GAME_CONSTANTS.MINIBOSS_SPAWN_DISTANCE;
        const angle = _getValidBossSpawnAngle();
        const sx = GAME_CONSTANTS.halfWidth + Math.cos(angle) * distance;
        const sy = GAME_CONSTANTS.halfHeight + Math.sin(angle) * distance;

        // Visual warning before spawning
        const warningImg = PhaserScene.add.image(sx, sy, 'enemies', 'warning.png');
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
        mb.aimAt(GAME_CONSTANTS.halfWidth, GAME_CONSTANTS.halfHeight);
        activeEnemies.push(mb);

        messageBus.publish('minibossSpawned');
        debugLog('Miniboss spawned at angle ' + (angle * 180 / Math.PI).toFixed(1) + '°');
    }

    function _spawnBoss() {
        if (bossSpawned) return;
        const b = _getBossFromPool();
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
        b.aimAt(GAME_CONSTANTS.halfWidth, GAME_CONSTANTS.halfHeight);
        activeEnemies.push(b);

        messageBus.publish('bossSpawned');
        debugLog('Boss spawned at angle ' + (angle * 180 / Math.PI).toFixed(1) + '°');
    }

    function _getFromPool() {
        for (let i = 0; i < pool.length; i++) {
            if (!pool[i].alive) return pool[i];
        }
        return null;
    }

    function _getShooterFromPool() {
        for (let i = 0; i < shooterPool.length; i++) {
            if (!shooterPool[i].alive) return shooterPool[i];
        }
        return null;
    }

    function _getSwarmerFromPool() {
        for (let i = 0; i < swarmerPool.length; i++) {
            if (!swarmerPool[i].alive) return swarmerPool[i];
        }
        return null;
    }

    function _getHeavyFromPool() {
        for (let i = 0; i < heavyPool.length; i++) {
            if (!heavyPool[i].alive) return heavyPool[i];
        }
        return null;
    }

    function _getFastFromPool() {
        for (let i = 0; i < fastPool.length; i++) {
            if (!fastPool[i].alive) return fastPool[i];
        }
        return null;
    }

    function _getSniperFromPool() {
        for (let i = 0; i < sniperPool.length; i++) {
            if (!sniperPool[i].alive) return sniperPool[i];
        }
        return null;
    }

    function _getLogicStrayFromPool() {
        for (let i = 0; i < logicStrayPool.length; i++) {
            if (!logicStrayPool[i].alive) return logicStrayPool[i];
        }
        return null;
    }

    function _getProtectorFromPool() {
        for (let i = 0; i < protectorPool.length; i++) {
            if (!protectorPool[i].alive) return protectorPool[i];
        }
        return null;
    }

    function _getMinibossFromPool() {
        for (let i = 0; i < minibossPool.length; i++) {
            if (!minibossPool[i].alive) return minibossPool[i];
        }
        return null;
    }

    function _getBossFromPool() {
        for (let i = 0; i < bossPool.length; i++) {
            if (!bossPool[i].alive) return bossPool[i];
        }
        return null;
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
                    const avoidTargets = activeEnemies.filter(e => e.alive && e.type === typeToAvoid);

                    for (let i = 0; i < avoidTargets.length; i++) {
                        const target = avoidTargets[i];
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

    // ── public queries ───────────────────────────────────────────────────────

    function getNearestEnemy(x, y, range) {
        let best = null;
        let bestDist = range * range;
        for (let i = 0; i < activeEnemies.length; i++) {
            const e = activeEnemies[i];
            if (!e.alive) continue;
            const dx = e.x - x;
            const dy = e.y - y;
            const d2 = dx * dx + dy * dy;
            if (d2 < bestDist) {
                bestDist = d2;
                best = e;
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
        const activeProts = [];
        for (let i = 0; i < activeEnemies.length; i++) {
            const e = activeEnemies[i];
            if (e.alive && e.type === 'protector' && e.auraActive) {
                activeProts.push(e);
            }
        }
        return activeProts;
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

    // ── damage ───────────────────────────────────────────────────────────────

    function damageEnemy(enemy, amount) {
        if (!enemy || !enemy.alive) return;

        const died = enemy.takeDamage(amount);

        // Use the final calculated damage from the enemy class (handles rounding/protector reduction)
        const finalAmount = enemy.lastDamageAmount !== undefined ? enemy.lastDamageAmount : Math.round(amount);
        const isProtected = enemy.lastDamageWasProtected || false;

        // Color is HOSTILE (pink) normally, or grey-red if protected
        const textColor = isProtected ? '#d4c6c9' : helper.colorToHexString(GAME_CONSTANTS.COLOR_HOSTILE);

        floatingText.show(enemy.x, enemy.y - 14, finalAmount.toString(), {
            fontFamily: 'VCR',
            fontSize: 28,
            color: textColor,
            depth: GAME_CONSTANTS.DEPTH_PROJECTILES,
            duration: 1000,
        });
        if (died) {
            _killEnemy(enemy);
        }
    }

    function _killEnemy(enemy) {
        const ex = enemy.x;
        const ey = enemy.y;
        const wasMiniboss = enemy.isMiniboss;
        const wasBoss = enemy.isBoss;

        enemy.deactivate();
        const idx = activeEnemies.indexOf(enemy);
        if (idx !== -1) activeEnemies.splice(idx, 1);

        if (wasMiniboss) {
            minibossAlive = false;
            if (enemy.img) {
                customEmitters.minibossExplosion(enemy.img);
            }
            messageBus.publish('minibossDefeated', ex, ey);
            debugLog('Miniboss defeated');
        } else if (wasBoss) {
            bossAlive = false;
            messageBus.publish('bossDefeated', ex, ey);
            debugLog('Boss defeated');
        } else {
            if (enemy.type === 'logic_stray') {
                resourceManager.spawnProcessorDrop(ex, ey);
            }
            messageBus.publish('enemyKilled', ex, ey, enemy.baseResourceDrop);
        }
    }

    // ── per-frame update ─────────────────────────────────────────────────────

    function _update(delta) {
        if (!spawning || frozen) return;

        const dt = delta / 1000;

        // Pause combatTime (scaling) while major enemies are alive
        if (!minibossAlive && !bossAlive) {
            combatTime += dt;
        }

        // Update wave scale factor
        GAME_VARS.scaleFactor = Math.pow(GAME_CONSTANTS.ENEMY_SCALE_RATE, Math.floor(combatTime / GAME_CONSTANTS.ENEMY_SCALE_INTERVAL));

        // Update spawn speed multiplier: 27x for 5s, then linearly decay to 1x over 1.25s
        const firstThreshold = 5;
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

            // Tower contact check — minibosses do NOT die on contact
            if (!e.isMiniboss) {
                const dx = e.x - tPos.x;
                const dy = e.y - tPos.y;
                // Attack range based on size (Basic size 12 * 2 = 24px)
                const contactR = (e.size || 12) * 2;
                if (dx * dx + dy * dy < contactR * contactR) {
                    tower.takeDamage(e.damage, e.x, e.y);

                    // Apply self-damage on contact
                    if (e.takeDamage(e.selfDamage)) {
                        // Only kill if the self-damage was lethal
                        _killEnemy(e);
                    }

                    // tower.takeDamage may trigger die→WAVE_COMPLETE→clearAllEnemies
                    // which empties activeEnemies mid-loop, so bail out
                    if (activeEnemies.length === 0) break;
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
