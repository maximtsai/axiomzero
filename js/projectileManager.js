// projectileManager.js — Object-pooled projectile system.
// Tower fires small cyan dots toward enemies; per-frame collision check.

const projectileManager = (() => {
    const POOL_SIZE = 40;

    let pool = [];
    let activeProjectiles = [];

    // ── init ─────────────────────────────────────────────────────────────────

    function init() {
        _buildPool();
        messageBus.subscribe('phaseChanged', _onPhaseChanged);
    }

    function _buildPool() {
        for (let i = 0; i < POOL_SIZE; i++) {
            const img = PhaserScene.add.image(0, 0, 'pixels', 'blue_pixel.png');
            img.setDepth(GAME_CONSTANTS.DEPTH_PROJECTILES);
            img.setScale(3);
            img.setVisible(false);
            img.setActive(false);
            img.setTint(GAME_CONSTANTS.COLOR_FRIENDLY);
            pool.push({
                img: img,
                alive: false,
                x: 0, y: 0,
                vx: 0, vy: 0,
                damage: 0,
                life: 0,     // ms remaining
            });
        }
    }

    // ── public API ───────────────────────────────────────────────────────────

    function fire(fromX, fromY, toX, toY, dmg) {
        const p = _getFromPool();
        if (!p) return;

        const dx = toX - fromX;
        const dy = toY - fromY;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const speed = GAME_CONSTANTS.PROJECTILE_SPEED;

        p.vx = (dx / dist) * speed;
        p.vy = (dy / dist) * speed;
        p.x = fromX;
        p.y = fromY;
        p.damage = dmg;
        p.alive = true;
        p.life = 3000; // auto-expire after 3s

        p.img.setPosition(fromX, fromY);
        p.img.setVisible(true);
        p.img.setActive(true);

        activeProjectiles.push(p);
    }

    function clearAll() {
        for (let i = activeProjectiles.length - 1; i >= 0; i--) {
            _deactivate(activeProjectiles[i]);
        }
        activeProjectiles.length = 0;
    }

    // ── internals ────────────────────────────────────────────────────────────

    function _getFromPool() {
        for (let i = 0; i < pool.length; i++) {
            if (!pool[i].alive) return pool[i];
        }
        return null;
    }

    function _deactivate(p) {
        p.alive = false;
        p.img.setVisible(false);
        p.img.setActive(false);
    }

    // ── per-frame update ─────────────────────────────────────────────────────

    function _update(delta) {
        if (activeProjectiles.length === 0) return;

        const dt = delta / 1000;
        const hitR2 = GAME_CONSTANTS.PROJECTILE_HIT_RADIUS * GAME_CONSTANTS.PROJECTILE_HIT_RADIUS;
        const enemies = enemyManager.getActiveEnemies();

        for (let i = activeProjectiles.length - 1; i >= 0; i--) {
            const p = activeProjectiles[i];
            if (!p.alive) { activeProjectiles.splice(i, 1); continue; }

            // Move
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.img.setPosition(p.x, p.y);

            // Lifetime
            p.life -= delta;
            if (p.life <= 0) {
                _deactivate(p);
                activeProjectiles.splice(i, 1);
                continue;
            }

            // Collision with enemies
            let hit = false;
            for (let j = 0; j < enemies.length; j++) {
                const e = enemies[j];
                if (!e.alive) continue;
                const dx = p.x - e.x;
                const dy = p.y - e.y;
                if (dx * dx + dy * dy < hitR2) {
                    // Spark burst pointing from enemy toward tower
                    const tPos = tower.getPosition();
                    const hitAngle = Math.atan2(tPos.y - e.y, tPos.x - e.x) * GAME_CONSTANTS.DEG_TO_RADIAL - 180;
                    customEmitters.basicStrike(e.x, e.y, hitAngle);
                    enemyManager.damageEnemy(e, p.damage);
                    hit = true;
                    break;
                }
            }
            if (hit) {
                _deactivate(p);
                activeProjectiles.splice(i, 1);
            }
        }
    }

    function _onPhaseChanged(phase) {
        if (phase !== 'WAVE_ACTIVE') {
            clearAll();
        }
    }

    updateManager.addFunction(_update);

    return { init, fire, clearAll };
})();
