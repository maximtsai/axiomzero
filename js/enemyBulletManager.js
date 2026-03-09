// enemyBulletManager.js — Object-pooled bullet system for enemy projectiles.
// Minibosses and bosses fire bullets at the tower; per-frame collision check.

const enemyBulletManager = (() => {
    let pool = [];
    let activeBullets = [];
    let paused = false;

    // ── init ─────────────────────────────────────────────────────────────────

    function init() {
        pool = new ObjectPool(
            () => {
                const img = PhaserScene.add.image(0, 0, 'enemies', 'bullet.png');
                img.setDepth(GAME_CONSTANTS.DEPTH_ENEMIES + 3);
                img.setScale(1);
                img.setVisible(false);
                img.setActive(false);
                return {
                    img: img,
                    alive: false,
                    x: 0, y: 0,
                    vx: 0, vy: 0,
                    damage: 0,
                    life: 0,
                };
            },
            (b) => {
                b.alive = false;
                b.img.setVisible(false);
                b.img.setActive(false);
            },
            GAME_CONSTANTS.ENEMY_BULLET_POOL_SIZE
        ).preAllocate(20);
        messageBus.subscribe('phaseChanged', _onPhaseChanged);
        messageBus.subscribe('gamePaused', () => { paused = true; });
        messageBus.subscribe('gameResumed', () => { paused = false; });
    }

    // ── public API ───────────────────────────────────────────────────────────

    function fire(fromX, fromY, toX, toY, dmg, frameName = 'bullet.png', speedOverride = null) {
        if (!pool) return;
        const b = pool.get();
        if (!b) return;

        const dx = toX - fromX;
        const dy = toY - fromY;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const speed = speedOverride !== null ? speedOverride : GAME_CONSTANTS.PROJECTILE_SPEED; // same speed as tower projectiles by default

        b.vx = (dx / dist) * speed;
        b.vy = (dy / dist) * speed;
        b.x = fromX;
        b.y = fromY;
        b.damage = dmg;
        b.alive = true;
        b.life = 5000; // auto-expire after 5s

        b.img.setFrame(frameName);
        b.img.setPosition(fromX, fromY);
        b.img.setRotation(Math.atan2(dy, dx));
        b.img.setVisible(true);
        b.img.setActive(true);

        activeBullets.push(b);
    }


    function clearAll() {
        for (let i = activeBullets.length - 1; i >= 0; i--) {
            pool.release(activeBullets[i]);
        }
        activeBullets.length = 0;
    }

    // ── internals ────────────────────────────────────────────────────────────

    function _deactivate(b) {
        pool.release(b);
    }

    // ── per-frame update ─────────────────────────────────────────────────────

    function _update(delta) {
        if (activeBullets.length === 0 || paused) return;

        const dt = delta / 1000;
        const tPos = tower.getPosition();
        const hitR2 = GAME_CONSTANTS.ENEMY_BULLET_HIT_RADIUS * GAME_CONSTANTS.ENEMY_BULLET_HIT_RADIUS;

        for (let i = activeBullets.length - 1; i >= 0; i--) {
            const b = activeBullets[i];

            // Handle dead/expired bullets
            if (!b.alive || b.life <= 0) {
                _deactivate(b);
                activeBullets[i] = activeBullets[activeBullets.length - 1];
                activeBullets.pop();
                continue;
            }

            // Move
            b.x += b.vx * dt;
            b.y += b.vy * dt;
            b.img.setPosition(b.x, b.y);

            // Lifetime
            b.life -= delta;

            // Collision with tower
            const dx = b.x - tPos.x;
            const dy = b.y - tPos.y;
            if (dx * dx + dy * dy < hitR2) {
                tower.takeDamage(b.damage, b.x, b.y);
                _deactivate(b);
                activeBullets[i] = activeBullets[activeBullets.length - 1];
                activeBullets.pop();
            }
        }
    }

    function _onPhaseChanged(phase) {
        if (phase !== GAME_CONSTANTS.PHASE_COMBAT) {
            clearAll();
        }
    }

    updateManager.addFunction(_update);

    return { init, fire, clearAll };
})();
