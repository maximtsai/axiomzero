// enemyManager.js — Enemy spawning, pooling, movement, damage, and death.
// Phase 1: Basic enemy type only (red-violet square).

const enemyManager = (() => {
    const POOL_SIZE = 80;

    let pool = [];          // pre-allocated enemy objects
    let activeEnemies = []; // currently alive references
    let spawnTimer = 0;
    let spawning = false;
    let waveElapsed = 0;    // seconds since wave start — drives scaling

    // cached enemy texture (generated once)
    let enemyTexKey = null;

    // ── init ─────────────────────────────────────────────────────────────────

    function init() {
        _generateTextures();
        _buildPool();
        messageBus.subscribe('phaseChanged', _onPhaseChanged);
    }

    /** Draw the Basic enemy shape into a render texture so we can reuse it. */
    function _generateTextures() {
        const size = 24;
        const gfx = PhaserScene.add.graphics();
        gfx.fillStyle(GAME_CONSTANTS.COLOR_HOSTILE, 1);
        gfx.fillRect(0, 0, size, size);
        gfx.generateTexture('enemy_basic', size, size);
        gfx.destroy();
        enemyTexKey = 'enemy_basic';
    }

    function _buildPool() {
        for (let i = 0; i < POOL_SIZE; i++) {
            const img = PhaserScene.add.image(0, 0, enemyTexKey);
            img.setDepth(GAME_CONSTANTS.DEPTH_ENEMIES);
            img.setVisible(false);
            img.setActive(false);
            pool.push({
                img: img,
                alive: false,
                health: 0,
                maxHealth: 0,
                damage: 0,
                speed: 0,
                vx: 0,
                vy: 0,
                x: 0,
                y: 0,
            });
        }
    }

    // ── spawning ─────────────────────────────────────────────────────────────

    function startSpawning() {
        spawning = true;
        spawnTimer = 0;
        waveElapsed = 0;
    }

    function stopSpawning() {
        spawning = false;
    }

    function clearAllEnemies() {
        for (let i = activeEnemies.length - 1; i >= 0; i--) {
            _deactivate(activeEnemies[i]);
        }
        activeEnemies.length = 0;
    }

    function _spawnOne() {
        const e = _getFromPool();
        if (!e) return; // pool exhausted

        // Determine spawn position — random edge, 60px outside
        const edge = Math.floor(Math.random() * 4); // 0=top,1=right,2=bottom,3=left
        const margin = GAME_CONSTANTS.ENEMY_SPAWN_MARGIN;
        let sx, sy;
        switch (edge) {
            case 0: sx = Math.random() * GAME_CONSTANTS.WIDTH; sy = -margin; break;
            case 1: sx = GAME_CONSTANTS.WIDTH + margin; sy = Math.random() * GAME_CONSTANTS.HEIGHT; break;
            case 2: sx = Math.random() * GAME_CONSTANTS.WIDTH; sy = GAME_CONSTANTS.HEIGHT + margin; break;
            case 3: sx = -margin; sy = Math.random() * GAME_CONSTANTS.HEIGHT; break;
        }

        // Scaling factor
        const scale = 1 + waveElapsed * GAME_CONSTANTS.ENEMY_SCALE_RATE;

        e.maxHealth = GAME_CONSTANTS.ENEMY_BASE_HEALTH * scale;
        e.health    = e.maxHealth;
        e.damage    = GAME_CONSTANTS.ENEMY_BASE_DAMAGE * scale;
        e.speed     = GAME_CONSTANTS.ENEMY_BASE_SPEED;

        // Direction toward tower center
        const tx = GAME_CONSTANTS.halfWidth;
        const ty = GAME_CONSTANTS.halfHeight;
        const dx = tx - sx;
        const dy = ty - sy;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        e.vx = (dx / dist) * e.speed;
        e.vy = (dy / dist) * e.speed;

        e.x = sx;
        e.y = sy;
        e.alive = true;
        e.img.setPosition(sx, sy);
        e.img.setVisible(true);
        e.img.setActive(true);
        e.img.setAlpha(1);
        e.img.setTint(GAME_CONSTANTS.COLOR_HOSTILE);
        e.img.setScale(1);

        activeEnemies.push(e);
    }

    function _getFromPool() {
        for (let i = 0; i < pool.length; i++) {
            if (!pool[i].alive) return pool[i];
        }
        return null;
    }

    function _deactivate(e) {
        e.alive = false;
        e.img.setVisible(false);
        e.img.setActive(false);
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
        enemy.health -= amount;

        // Visual degradation — shift tint toward white proportional to damage taken
        const ratio = Math.max(0, enemy.health / enemy.maxHealth);
        const hostileR = (GAME_CONSTANTS.COLOR_HOSTILE >> 16) & 0xff;
        const hostileG = (GAME_CONSTANTS.COLOR_HOSTILE >> 8)  & 0xff;
        const hostileB =  GAME_CONSTANTS.COLOR_HOSTILE        & 0xff;
        const r = Math.round(hostileR + (255 - hostileR) * (1 - ratio));
        const g = Math.round(hostileG + (255 - hostileG) * (1 - ratio));
        const b = Math.round(hostileB + (255 - hostileB) * (1 - ratio));
        enemy.img.setTint((r << 16) | (g << 8) | b);

        // Flicker alpha briefly
        if (enemy.img && enemy.img.scene) {
            PhaserScene.tweens.add({
                targets: enemy.img,
                alpha: { from: 0.5, to: 1 },
                duration: 80,
                ease: 'Linear',
            });
        }

        if (enemy.health <= 0) {
            _killEnemy(enemy);
        }
    }

    function _killEnemy(enemy) {
        const ex = enemy.x;
        const ey = enemy.y;
        _deactivate(enemy);
        // Remove from active list
        const idx = activeEnemies.indexOf(enemy);
        if (idx !== -1) activeEnemies.splice(idx, 1);
        messageBus.publish('enemyKilled', ex, ey);
    }

    // ── per-frame update ─────────────────────────────────────────────────────

    function _update(delta) {
        if (!spawning && activeEnemies.length === 0) return;

        const dt = delta / 1000;

        if (spawning) {
            waveElapsed += dt;

            // Spawn timer
            spawnTimer += delta;
            if (spawnTimer >= GAME_CONSTANTS.ENEMY_SPAWN_INTERVAL) {
                spawnTimer -= GAME_CONSTANTS.ENEMY_SPAWN_INTERVAL;
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

            e.x += e.vx * dt;
            e.y += e.vy * dt;
            e.img.setPosition(e.x, e.y);

            // Tower contact check
            const dx = e.x - tPos.x;
            const dy = e.y - tPos.y;
            if (dx * dx + dy * dy < contactR2) {
                tower.takeDamage(e.damage);
                // tower.takeDamage may trigger die→WAVE_COMPLETE→clearAllEnemies
                // which empties activeEnemies mid-loop, so bail out
                if (activeEnemies.length === 0) break;
                _deactivate(e);
                activeEnemies.splice(i, 1);
            }
        }
    }

    // ── event handlers ───────────────────────────────────────────────────────

    function _onPhaseChanged(phase) {
        if (phase === 'WAVE_ACTIVE') {
            startSpawning();
        } else {
            stopSpawning();
            if (phase === 'WAVE_COMPLETE' || phase === 'UPGRADE_PHASE') {
                clearAllEnemies();
            }
        }
    }

    updateManager.addFunction(_update);

    return { init, startSpawning, stopSpawning, clearAllEnemies, getNearestEnemy, getEnemyCount, getActiveEnemies, damageEnemy };
})();
