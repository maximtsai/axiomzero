// projectileManager.js — Object-pooled projectile system.
// Tower fires small cyan dots toward enemies; per-frame collision check.

const projectileManager = (() => {
    const POOL_SIZE = 40;
    let shootSoundIndex = 0;

    let pool = [];
    let activeProjectiles = [];
    let paused = false;

    let hitAnimPool = null;
    const _queryResults = [];
    let hitRadiusRatio = 1;
    let searchRadius = 0;
    let invProjectileSpeed = 1;

    // ── init ─────────────────────────────────────────────────────────────────

    function init() {
        pool = new ObjectPool(
            () => {
                const img = PhaserScene.add.image(0, 0, 'pixels', 'blue_pixel.png');
                img.setDepth(150); // Below tower (200) but above enemies (100)
                img.setScale(12, 5);
                img.setVisible(false);
                img.setActive(false);
                img.setTint(GAME_CONSTANTS.COLOR_FRIENDLY);
                img.setBlendMode(Phaser.BlendModes.ADD);
                return {
                    img: img,
                    alive: false,
                    x: 0, y: 0,
                    vx: 0, vy: 0,
                    damage: 0,
                    life: 0,
                };
            },
            (p) => {
                p.alive = false;
                p.img.setVisible(false);
                p.img.setActive(false);
            },
            POOL_SIZE
        ).preAllocate(POOL_SIZE);

        hitAnimPool = new ObjectPool(
            () => {
                const spr = PhaserScene.add.sprite(0, 0, 'attacks', 'hit_circle1.png');
                spr.setDepth(151); // Slightly above projectiles
                spr.setBlendMode(Phaser.BlendModes.ADD);
                spr.setVisible(false);
                spr.setActive(false);
                spr.on('animationcomplete', function (anim) {
                    if (anim.key === 'hit_circle') {
                        hitAnimPool.release(spr);
                    }
                });
                return spr;
            },
            (spr) => {
                spr.setVisible(false);
                spr.setActive(false);
            },
            40 // Size matching projectile pool size
        ).preAllocate(20);

        messageBus.subscribe('phaseChanged', _onPhaseChanged);
        messageBus.subscribe('gamePaused', () => { paused = true; });
        messageBus.subscribe('gameResumed', () => { paused = false; });

        // Cache constants for collision and movement math
        hitRadiusRatio = GAME_CONSTANTS.PROJECTILE_HIT_RADIUS / 12;
        searchRadius = 60 * Math.max(0, hitRadiusRatio - 1);
        invProjectileSpeed = 1 / (GAME_CONSTANTS.PROJECTILE_SPEED || 1);
    }

    // ── public API ───────────────────────────────────────────────────────────

    function fire(fromX, fromY, toX, toY, dmg) {
        if (!pool) return;
        const p = pool.get();
        if (!p) return;

        const dx = toX - fromX;
        const dy = toY - fromY;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const speed = GAME_CONSTANTS.PROJECTILE_SPEED;

        p.vx = (dx / dist) * speed;
        p.vy = (dy / dist) * speed;
        const leadTime = 0.02;
        p.x = fromX + p.vx * leadTime;
        p.y = fromY + p.vy * leadTime;
        p.damage = dmg;
        p.alive = true;
        p.life = 3000; // auto-expire after 3s

        p.img.setPosition(p.x, p.y);
        p.img.setRotation(Math.atan2(dy, dx));
        p.img.setVisible(true);
        p.img.setActive(true);

        activeProjectiles.push(p);

        if (typeof audio !== 'undefined') {
            const key = (shootSoundIndex === 0) ? 'basic_shoot' : 'basic_shoot2';
            shootSoundIndex = (shootSoundIndex + 1) % 2;
            const s = audio.play(key, 0.85);
            if (s) s.detune = (Math.random() * 200 - 100);
        }
    }

    function clearAll() {
        for (let i = activeProjectiles.length - 1; i >= 0; i--) {
            pool.release(activeProjectiles[i]);
        }
        activeProjectiles.length = 0;
    }

    // ── internals ────────────────────────────────────────────────────────────

    function _deactivate(p) {
        pool.release(p);
    }

    // ── per-frame update ─────────────────────────────────────────────────────

    function _update(delta) {
        if (activeProjectiles.length === 0 || paused) return;

        const dt = delta / 1000;

        for (let i = activeProjectiles.length - 1; i >= 0; i--) {
            const p = activeProjectiles[i];

            // Handle dead/expired projectiles
            if (!p.alive || p.life <= 0) {
                _deactivate(p);
                activeProjectiles[i] = activeProjectiles[activeProjectiles.length - 1];
                activeProjectiles.pop();
                continue;
            }

            // Move
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.img.setPosition(p.x, p.y);

            // Lifetime
            p.life -= delta;

            // Collision with enemies via fast spatial hash
            let hit = false;
            _queryResults.length = 0; // Zero-garbage clear
            enemyManager.getEnemiesInSquareRange(p.x, p.y, searchRadius, _queryResults);

            for (let j = 0; j < _queryResults.length; j++) {
                const e = _queryResults[j];
                if (!e.model.alive) continue;

                if (e.checkCollision(p.x, p.y, hitRadiusRatio, 0, 15)) {
                    // Spark burst pointing from enemy toward tower
                    const tPos = tower.getPosition();
                    const hitAngle = Math.atan2(tPos.y - e.model.y, tPos.x - e.model.x) * GAME_CONSTANTS.DEG_TO_RADIAL - 180;
                    customEmitters.basicStrikeManual(p.x, p.y, hitAngle);

                    // Apply knockback in projectile direction
                    const projDirX = p.vx * invProjectileSpeed;
                    const projDirY = p.vy * invProjectileSpeed;
                    e.applyKnockback(projDirX, projDirY, 4);

                    if (hitAnimPool) {
                        const hitSpr = hitAnimPool.get();
                        hitSpr.setPosition(p.x, p.y);
                        hitSpr.setActive(true);
                        hitSpr.setVisible(true);
                        hitSpr.setRotation(Math.random() * Math.PI);
                        hitSpr.play('hit_circle');
                    }

                    enemyManager.damageEnemy(e, p.damage, 'tower');
                    hit = true;
                    break;
                }
            }
            if (hit) {
                _deactivate(p);
                activeProjectiles[i] = activeProjectiles[activeProjectiles.length - 1];
                activeProjectiles.pop();
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
