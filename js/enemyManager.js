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
    let minibossPool = [];  // pre-allocated Miniboss instances
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
    let recentSpawnAngles = [];   // tracks the last 4 spawn angles (in radians)


    // ── init ─────────────────────────────────────────────────────────────────

    function init() {
        _buildPool();
        _buildMinibossPool();
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

    // ── spawning ─────────────────────────────────────────────────────────────

    function _startSpawning() {
        spawning = true;
        frozen = false;
        spawnTimer = -950;
        combatTime = 4;
        GAME_VARS.scaleFactor = Math.pow(GAME_CONSTANTS.ENEMY_SCALE_RATE, Math.floor(combatTime / GAME_CONSTANTS.ENEMY_SCALE_INTERVAL));
        minibossSpawned = false;
        minibossAlive = false;
        lastWaveProgress = 0;
        recentSpawnAngles = [];
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
            activeEnemies[i].deactivate();
        }
        activeEnemies.length = 0;
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

        // Special case: No fast enemies in the first few seconds
        if (chosenType === 'fast' && combatTime < 9) {
            chosenType = 'basic';
        }

        let numToSpawn = 1;
        if (chosenType === 'swarmer' && config.swarmerGroupSize) {
            numToSpawn = Phaser.Math.Between(config.swarmerGroupSize.min, config.swarmerGroupSize.max);
        }

        // Determine base spawn position — random angle, ENEMY_SPAWN_DISTANCE from center
        const distance = GAME_CONSTANTS.ENEMY_SPAWN_DISTANCE;
        const angle = _getValidSpawnAngle(chosenType);
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

    function _spawnMiniboss() {
        if (minibossSpawned) return;
        const mb = _getMinibossFromPool();
        if (!mb) return;

        minibossSpawned = true;
        minibossAlive = true;

        const distance = GAME_CONSTANTS.MINIBOSS_SPAWN_DISTANCE;
        const angle = Miniboss.getSpawnAngle();
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

    function _getMinibossFromPool() {
        for (let i = 0; i < minibossPool.length; i++) {
            if (!minibossPool[i].alive) return minibossPool[i];
        }
        return null;
    }

    function _getValidSpawnAngle(chosenType) {
        let angle = Math.random() * Math.PI * 2;

        // If it's a swarmer, try to find an angle far from the last 4 spawns
        if (chosenType === 'swarmer') {
            const minSeparation = 0.45; // ~26 degrees minimum distance
            let valid = false;
            let attempts = 0;

            while (!valid && attempts < 6) {
                valid = true;
                for (let i = 0; i < recentSpawnAngles.length; i++) {
                    const diff = Phaser.Math.Angle.ShortestBetween(
                        Phaser.Math.RadToDeg(angle),
                        Phaser.Math.RadToDeg(recentSpawnAngles[i])
                    );
                    if (Math.abs(diff) < Phaser.Math.RadToDeg(minSeparation)) {
                        valid = false;
                        break;
                    }
                }

                if (!valid) {
                    angle = Math.random() * Math.PI * 2;
                    attempts++;
                }
            }
        }

        recentSpawnAngles.push(angle);
        if (recentSpawnAngles.length > 4) {
            recentSpawnAngles.shift();
        }
        return angle;
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
        floatingText.show(enemy.x, enemy.y - 14, Math.round(amount).toString(), {
            fontFamily: 'VCR',
            fontSize: 28,
            color: helper.colorToHexString(GAME_CONSTANTS.COLOR_HOSTILE),
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
        enemy.deactivate();
        const idx = activeEnemies.indexOf(enemy);
        if (idx !== -1) activeEnemies.splice(idx, 1);

        if (wasMiniboss) {
            minibossAlive = false;
            messageBus.publish('minibossDefeated', ex, ey);
            debugLog('Miniboss defeated');
        } else {
            messageBus.publish('enemyKilled', ex, ey, enemy.baseResourceDrop);
        }
    }

    // ── per-frame update ─────────────────────────────────────────────────────

    function _update(delta) {
        if (frozen) return; // death sequence — all enemies paused
        if (!spawning && activeEnemies.length === 0) return;

        const dt = delta / 1000;

        if (spawning) {
            combatTime += dt;
            GAME_VARS.scaleFactor = Math.pow(GAME_CONSTANTS.ENEMY_SCALE_RATE, Math.floor(combatTime / GAME_CONSTANTS.ENEMY_SCALE_INTERVAL));

            // Update spawn speed multiplier: 5x for 0.8s, then linearly decay to 1x over 0.5s
            const firstThreshold = 5.1;
            const secondThreshold = 1.25;
            if (combatTime < firstThreshold) {
                spawnSpeedMultiplier = 27;
            } else if (combatTime < firstThreshold + secondThreshold) {
                // Linear interpolation from 5 to 1 over 0.8 seconds
                const progress = (combatTime - firstThreshold) / secondThreshold;
                spawnSpeedMultiplier = 27 - 26 * progress;
            } else {
                spawnSpeedMultiplier = 1;
            }

            // Spawn timer
            spawnTimer += delta;
            const config = getCurrentLevelConfig();
            const trueSpawnInterval = config.spawnInterval / spawnSpeedMultiplier;
            if (spawnTimer >= trueSpawnInterval) {
                spawnTimer -= trueSpawnInterval;
                _spawnOne();
            }
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
        if (progress >= 0.5 && !minibossSpawned && spawning) {
            _spawnMiniboss();
        }
    }

    updateManager.addFunction(_update);

    return { init, freeze, unfreeze, clearAllEnemies, getNearestEnemy, getEnemyCount, getActiveEnemies, getEnemiesInSquareRange, damageEnemy, getCombatTime: () => combatTime };
})();
