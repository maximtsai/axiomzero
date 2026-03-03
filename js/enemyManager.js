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

    let pool = [];          // pre-allocated Enemy instances
    let minibossPool = [];  // pre-allocated Miniboss instances
    let activeEnemies = []; // currently alive Enemy references (includes minibosses)
    let spawnTimer = 0;
    let spawning = false;
    let frozen = false;     // true during death sequence — movement paused, spawning stopped
    let waveElapsed = 0;    // seconds since wave start — drives scaling
    let spawnSpeedMultiplier = 1;  // 5x for first 3 seconds of wave, then 1x

    // Miniboss tracking
    let minibossSpawned = false;  // has a miniboss spawned this wave?
    let minibossAlive = false;    // is the current miniboss still alive?

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
        spawnTimer = -550;
        waveElapsed = 0;
        minibossSpawned = false;
        minibossAlive = false;
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
        const e = _getFromPool();
        if (!e) return; // pool exhausted

        // Determine spawn position — random angle, ENEMY_SPAWN_DISTANCE from center
        const distance = GAME_CONSTANTS.ENEMY_SPAWN_DISTANCE;
        const angle = Math.random() * Math.PI * 2;
        const sx = GAME_CONSTANTS.halfWidth + Math.cos(angle) * distance;
        const sy = GAME_CONSTANTS.halfHeight + Math.sin(angle) * distance;

        // Scaling factor
        const scaleFactor = 1 + waveElapsed * GAME_CONSTANTS.ENEMY_SCALE_RATE;

        // Activate (sets stats and resets visuals inside BasicEnemy)
        e.activate(sx, sy, scaleFactor);

        // Aim at tower center
        e.aimAt(GAME_CONSTANTS.halfWidth, GAME_CONSTANTS.halfHeight);

        activeEnemies.push(e);
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

    function _getMinibossFromPool() {
        for (let i = 0; i < minibossPool.length; i++) {
            if (!minibossPool[i].alive) return minibossPool[i];
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
            messageBus.publish('enemyKilled', ex, ey);
        }
    }

    // ── per-frame update ─────────────────────────────────────────────────────

    function _update(delta) {
        if (frozen) return; // death sequence — all enemies paused
        if (!spawning && activeEnemies.length === 0) return;

        const dt = delta / 1000;

        if (spawning) {
            waveElapsed += dt;

            // Update spawn speed multiplier: 5x for 0.8s, then linearly decay to 1x over 0.5s
            const firstThreshold = 1;
            const secondThreshold = 0.85;
            if (waveElapsed < firstThreshold) {
                spawnSpeedMultiplier = 27;
            } else if (waveElapsed < firstThreshold + secondThreshold) {
                // Linear interpolation from 5 to 1 over 0.8 seconds
                const progress = (waveElapsed - firstThreshold) / secondThreshold;
                spawnSpeedMultiplier = 27 - 26 * progress;
            } else {
                spawnSpeedMultiplier = 1;
            }

            // Spawn timer
            spawnTimer += delta;
            const trueSpawnInterval = GAME_CONSTANTS.ENEMY_SPAWN_INTERVAL / spawnSpeedMultiplier
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
                if (dx * dx + dy * dy < contactR2) {
                    tower.takeDamage(e.damage);
                    // tower.takeDamage may trigger die→WAVE_COMPLETE→clearAllEnemies
                    // which empties activeEnemies mid-loop, so bail out
                    if (activeEnemies.length === 0) break;
                    e.deactivate();
                    activeEnemies.splice(i, 1);
                }
            }
        }
    }

    // ── event handlers ───────────────────────────────────────────────────────

    function _onPhaseChanged(phase) {
        if (phase === 'WAVE_ACTIVE') {
            _startSpawning();
        } else {
            _stopSpawning();
            if (phase === 'WAVE_COMPLETE' || phase === 'UPGRADE_PHASE') {
                clearAllEnemies();
            }
        }
    }

    function _onWaveProgress(progress) {
        if (progress >= 0.5 && !minibossSpawned && spawning) {
            _spawnMiniboss();
        }
    }

    updateManager.addFunction(_update);

    return { init, freeze, unfreeze, clearAllEnemies, getNearestEnemy, getEnemyCount, getActiveEnemies, damageEnemy };
})();
