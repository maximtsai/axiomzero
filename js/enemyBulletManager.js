// enemyBulletManager.js — Object-pooled bullet system for enemy projectiles.
// Minibosses and bosses fire bullets at the tower; per-frame collision check.

const enemyBulletManager = (() => {
    let pool = [];
    let activeBullets = [];

    // ── init ─────────────────────────────────────────────────────────────────

    function init() {
        _buildPool();
        messageBus.subscribe('phaseChanged', _onPhaseChanged);
    }

    function _buildPool() {
        const size = GAME_CONSTANTS.ENEMY_BULLET_POOL_SIZE;
        for (let i = 0; i < size; i++) {
            const img = PhaserScene.add.image(0, 0, 'enemies', 'bullet.png');
            img.setDepth(GAME_CONSTANTS.DEPTH_ENEMIES + 3);
            img.setScale(1);
            img.setVisible(false);
            img.setActive(false);
            img.setTint(GAME_CONSTANTS.COLOR_HOSTILE);
            pool.push({
                img: img,
                alive: false,
                x: 0, y: 0,
                vx: 0, vy: 0,
                damage: 0,
                life: 0,
            });
        }
    }

    // ── public API ───────────────────────────────────────────────────────────

    function fire(fromX, fromY, toX, toY, dmg) {
        const b = _getFromPool();
        if (!b) return;

        const dx = toX - fromX;
        const dy = toY - fromY;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const speed = GAME_CONSTANTS.PROJECTILE_SPEED; // same speed as tower projectiles

        b.vx = (dx / dist) * speed;
        b.vy = (dy / dist) * speed;
        b.x = fromX;
        b.y = fromY;
        b.damage = dmg;
        b.alive = true;
        b.life = 5000; // auto-expire after 5s

        b.img.setPosition(fromX, fromY);
        b.img.setRotation(Math.atan2(dy, dx));
        b.img.setVisible(true);
        b.img.setActive(true);

        activeBullets.push(b);
    }

    function clearAll() {
        for (let i = activeBullets.length - 1; i >= 0; i--) {
            _deactivate(activeBullets[i]);
        }
        activeBullets.length = 0;
    }

    // ── internals ────────────────────────────────────────────────────────────

    function _getFromPool() {
        for (let i = 0; i < pool.length; i++) {
            if (!pool[i].alive) return pool[i];
        }
        return null;
    }

    function _deactivate(b) {
        b.alive = false;
        b.img.setVisible(false);
        b.img.setActive(false);
    }

    // ── per-frame update ─────────────────────────────────────────────────────

    function _update(delta) {
        if (activeBullets.length === 0) return;

        const dt = delta / 1000;
        const tPos = tower.getPosition();
        const hitR2 = GAME_CONSTANTS.ENEMY_BULLET_HIT_RADIUS * GAME_CONSTANTS.ENEMY_BULLET_HIT_RADIUS;

        for (let i = activeBullets.length - 1; i >= 0; i--) {
            const b = activeBullets[i];
            if (!b.alive) { activeBullets.splice(i, 1); continue; }

            // Move
            b.x += b.vx * dt;
            b.y += b.vy * dt;
            b.img.setPosition(b.x, b.y);

            // Lifetime
            b.life -= delta;
            if (b.life <= 0) {
                _deactivate(b);
                activeBullets.splice(i, 1);
                continue;
            }

            // Collision with tower
            const dx = b.x - tPos.x;
            const dy = b.y - tPos.y;
            if (dx * dx + dy * dy < hitR2) {
                tower.takeDamage(b.damage);
                _deactivate(b);
                activeBullets.splice(i, 1);
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
