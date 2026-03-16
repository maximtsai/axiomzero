// customEmitters.js
// Named Phaser 3.60+ particle emitter effects.

const customEmitters = (() => {

    // ── Lazy emitter factory ──────────────────────────────────────────────────
    function _make(texture, config, depth) {
        let emitter = null;
        return function () {
            if (!emitter) {
                emitter = PhaserScene.add.particles(0, 0, texture, config);
                emitter.setDepth(depth);
            }
            return emitter;
        };
    }

    // ── Sprite pool for basicStrikeManual ─────────────────────────────────────
    const strikeSpritePool = new ObjectPool(
        () => {
            const sprite = PhaserScene.add.sprite(0, 0, 'pixels', 'blue_pixel.png');
            sprite.setActive(false);
            sprite.setVisible(false);
            return sprite;
        },
        (sprite) => {
            sprite.setActive(false);
            sprite.setVisible(false);
            sprite.setScale(1);
            sprite.setAlpha(1);
            sprite.setRotation(0);
            sprite.x = 0;
            sprite.y = 0;
        },
        75
    );

    let activeManualStrikes = [];
    let activeGhosts = [];
    let activeExplosionRays = [];

    // ── Explosion Rays (Boss Death) ──────────────────────────────────────────
    const explosionRayPool = new ObjectPool(
        () => {
            const sprite = PhaserScene.add.sprite(0, 0, 'enemies', 'explosion_ray.png');
            sprite.setActive(false);
            sprite.setVisible(false);
            return sprite;
        },
        (sprite) => {
            sprite.setActive(false);
            sprite.setVisible(false);
            sprite.setScale(1);
            sprite.setAlpha(1);
            sprite.setRotation(0);
        },
        5
    );

    const explosionPulsePool = new ObjectPool(
        () => {
            const sprite = PhaserScene.add.sprite(0, 0, 'attacks', 'explosion_pulse1.png');
            sprite.setActive(false);
            sprite.setVisible(false);
            sprite.on('animationcomplete', (anim) => {
                if (anim.key === 'explosion_pulse') {
                    sprite.setActive(false);
                    sprite.setVisible(false);
                    explosionPulsePool.release(sprite);
                }
            });
            return sprite;
        },
        (sprite) => {
            sprite.setActive(false);
            sprite.setVisible(false);
            sprite.setScale(1);
            sprite.setAlpha(1);
            sprite.setRotation(0);
        },
        5
    );

    // ── basicStrike ──────────────────────────────────────────────────────────
    const strikeParams = {
        frame: 'blue_pixel.png',
        speed: { min: 80, max: 230, ease: 'Cubic.easeOut' },
        lifespan: { min: 200, max: 400 },
        scaleX: { start: 12, end: 0, ease: 'Quad.easeIn' },
        scaleY: 2,
        alpha: 1,
        gravityY: 0,
        emitting: false,
        angle: { min: -180, max: 180 },
    }

    const _strike = _make('pixels', strikeParams, 152);

    function basicStrike(x, y, angle) {
        const count = Math.floor(Math.random() * 3) + 3;
        const e = _strike();
        const minAngle = angle - 60;
        const maxAngle = angle + 60;
        const newParams = Object.assign({}, strikeParams);
        newParams.angle = { min: minAngle, max: maxAngle };
        e.setConfig(newParams);
        e.explode(count, x, y);
    }

    // ── basicStrikeManual ─────────────────────────────────────────────────────
    function basicStrikeManual(x, y, angle) {
        const count = Math.floor(Math.random() * 2) + 2;
        const minAngle = angle - 50;
        const maxAngle = angle + 50;
        const depth = 152;

        for (let i = 0; i < count; i++) {
            const sprite = strikeSpritePool.get();
            sprite.setPosition(x, y);
            sprite.setDepth(depth);
            sprite.setVisible(true);
            sprite.setActive(true);

            const emitAngle = Phaser.Math.Between(minAngle, maxAngle);
            const radians = Phaser.Math.DegToRad(emitAngle);
            const lifespan = Phaser.Math.Between(150, 450);

            sprite.setRotation(radians);
            sprite.setOrigin(0, 0.5);
            sprite.setAlpha(1);

            const travelDist = (lifespan * 0.18 + 18) * (0.6 + Math.random() * 0.4);
            const startScale = travelDist * (0.22 + Math.random() * 0.1) + 2.5;
            sprite.setScale(startScale, 2);

            sprite._startX = x;
            sprite._startY = y;
            sprite._distX = Math.cos(radians) * travelDist;
            sprite._distY = Math.sin(radians) * travelDist;
            sprite._startScale = startScale;
            sprite._lifespan = lifespan;
            sprite._elapsed = 0;

            activeManualStrikes.push(sprite);
        }
    }

    // tower death 
    const towerDeathParams = {
        frame: 'white_pixel.png',
        speed: { min: 100, max: 200, ease: 'Cubic.easeOut' },
        lifespan: { min: 400, max: 1000 },
        scale: { start: 25, end: 5, ease: 'Quad.easeIn' },
        alpha: { start: 0.4, end: 0, ease: 'Quad.easeIn' },
        gravityY: 0,
        emitting: false,
    }

    const towerDeathShrapnelParams = {
        frame: 'white_pixel.png',
        speed: { min: 400, max: 700, ease: 'Cubic.easeOut' },
        lifespan: { min: 300, max: 600 },
        scale: { start: 10, end: 0 },
        alpha: { start: 0.8, end: 0 },
        rotate: { start: 0, end: 1080 },
        gravityY: 0,
        emitting: false,
    }

    const _towerDeath = _make('pixels', towerDeathParams, GAME_CONSTANTS.DEPTH_TOWER + 2);
    const _towerDeathShrapnel = _make('pixels', towerDeathShrapnelParams, GAME_CONSTANTS.DEPTH_TOWER + 3);

    function towerDeath(x, y) {
        const isMinimal = gameState.settings.minimalParticles;
        const count = isMinimal ? 6 : 8;
        const e = _towerDeath();
        e.explode(count, x, y);

        const shrapnelCount = isMinimal ? 4 : 8;
        const e2 = _towerDeathShrapnel();
        e2.explode(shrapnelCount, x, y);
    }

    // ── Logic Stray Ghost ──────────────────────────────────────────────────────────
    const logicStrayGhostPool = new ObjectPool(
        () => {
            const sprite = PhaserScene.add.sprite(0, 0, 'enemies', 'logic_stray.png');
            sprite.setActive(false);
            sprite.setVisible(false);
            return sprite;
        },
        (sprite) => {
            sprite.setActive(false);
            sprite.setVisible(false);
            sprite.setAlpha(0.4);
            sprite.setTint(0xffffff);
        },
        30
    );

    function logicStrayGhost(x, y, rotation, scale) {
        const sprite = logicStrayGhostPool.get();
        sprite.setPosition(x, y);
        sprite.setRotation(rotation);
        sprite.setScale(scale * 0.95);
        sprite.setDepth(GAME_CONSTANTS.DEPTH_ENEMIES - 1);
        sprite.setVisible(true);
        sprite.setActive(true);
        sprite.setAlpha(0.4);

        sprite._duration = 3000;
        sprite._elapsed = 0;
        activeGhosts.push(sprite);
    }

    // ── Enemy Death Animation ──────────────────────────────────────────────────
    const enemyDeathAnimPool = new ObjectPool(
        () => {
            const sprite = PhaserScene.add.image(0, 0, 'enemies', 'basic.png'); // Default frame, changed on use
            sprite.setActive(false);
            sprite.setVisible(false);
            return sprite;
        },
        (sprite) => {
            sprite.setActive(false);
            sprite.setVisible(false);
            sprite.clearTint();
        },
        30
    );

    function createEnemyDeathAnim(enemy, isSlow = false) {
        if (!enemy || !enemy.view || !enemy.view.img) return;

        const spritesToAnimate = [enemy.view.img];
        if (enemy.view.hpImg) {
            enemy.view.hpImg.setScale(enemy.view.img.scaleX);
            enemy.view.hpImg.depth = enemy.view.img.depth + 1;
            spritesToAnimate.push(enemy.view.hpImg);
        }

        const targetScaleMultiplier = 1 + (90 / (90 + (enemy.size || 20)));
        const baseScaleX = enemy.view.img.scaleX;
        const baseScaleY = enemy.view.img.scaleY;

        const copies = spritesToAnimate.map(origSprite => {
            const copy = enemyDeathAnimPool.get();
            copy.setFrame(origSprite.frame.name);
            copy.setPosition(origSprite.x, origSprite.y);
            copy.setRotation(origSprite.rotation);
            copy.setDepth(origSprite.depth + 5);

            const signX = origSprite.scaleX < 0 ? -1 : 1;
            const signY = origSprite.scaleY < 0 ? -1 : 1;
            const absScaleX = Math.abs(origSprite.scaleX);
            const absScaleY = Math.abs(origSprite.scaleY);

            copy.setScale(absScaleX * targetScaleMultiplier * signX, absScaleY * targetScaleMultiplier * signY);

            copy.setTintFill(0xffffff);
            copy.setVisible(true);
            copy.setActive(true);
            return copy;
        });

        let duration = isSlow ? 420 : 90;
        if (enemy && enemy.isBoss) duration = 800;

        PhaserScene.tweens.add({
            targets: copies,
            scaleX: baseScaleX,
            scaleY: baseScaleY,
            duration: duration,
            ease: 'Quad.easeOut',
            onComplete: () => {
                copies.forEach(c => {
                    c.clearTint();
                    PhaserScene.time.delayedCall(50, () => {
                        enemyDeathAnimPool.release(c);
                    });
                });
            }
        });
    }

    // ── Miniboss Explosion ───────────────────────────────────────────────────
    function minibossExplosion(originalSprite, effectScale = 1.0) {
        const x = originalSprite.x;
        const y = originalSprite.y;
        const rotation = originalSprite.rotation;
        const scaleX = originalSprite.scaleX;
        const scaleY = originalSprite.scaleY;
        const depth = originalSprite.depth;
        const texture = originalSprite.texture.key;
        const frame = originalSprite.frame.name;

        const copy = PhaserScene.add.image(x, y, texture, frame);
        copy.setRotation(rotation);
        copy.setScale(scaleX, scaleY);
        copy.setDepth(depth);
        copy.clearTint();

        PhaserScene.tweens.add({
            targets: copy,
            duration: 150,
            repeat: 2,
            yoyo: true,
            onStart: () => { if (copy.active) copy.setTintFill(0xffffff); },
            onYoyo: () => { if (copy.active) copy.clearTint(); },
            onRepeat: () => { if (copy.active) copy.setTintFill(0xffffff); },
            onComplete: () => {
                copy.destroy();
            }
        });

        const warning = PhaserScene.add.sprite(x, y, 'enemies', 'warning_area.png');
        warning.setDepth(depth + 1);
        warning.setAlpha(0);
        warning.setScale(0.8 * effectScale);

        PhaserScene.tweens.add({
            targets: warning,
            alpha: 0.8,
            scale: 1.0 * effectScale,
            duration: 900,
            ease: 'Quad.easeOut',
            onComplete: () => {
                if (copy.active) copy.destroy();

                warning.setFrame('explosion_white.png');
                warning.setAlpha(1);

                PhaserScene.time.delayedCall(50, () => {
                    warning.setTint(0x000000);

                    PhaserScene.time.delayedCall(50, () => {
                        warning.clearTint();
                        warning.setScale(4 * effectScale);
                        if (PhaserScene.anims.exists('explosion_anim')) {
                            warning.play('explosion_anim');
                        } else {
                            warning.setFrame('explosion_flash.png');
                        }

                        PhaserScene.cameras.main.shake(250, 0.015);
                        if (typeof audio !== 'undefined') audio.play('explosion_death', 0.82);
                        if (typeof enemyManager !== 'undefined') {
                            const enemies = enemyManager.getActiveEnemies();
                            const radius = 240 * effectScale;
                            const radiusSq = radius * radius;
                            for (let i = enemies.length - 1; i >= 0; i--) {
                                const e = enemies[i];
                                if (e && e.alive) {
                                    const dx = e.x - x;
                                    const dy = e.y - y;
                                    if (dx * dx + dy * dy <= radiusSq) {
                                        enemyManager.damageEnemy(e, 99);
                                    }
                                }
                            }
                        }

                        PhaserScene.tweens.add({
                            targets: warning,
                            alpha: 0,
                            duration: 2000,
                            ease: 'Linear',
                            onComplete: () => {
                                warning.destroy();
                            }
                        });
                    });
                });
            }
        });
    }

    function createBossExplosionRays(x, y, baseDepth) {
        const count = Phaser.Math.Between(4, 5);
        const minGap = 0.5; // radians
        const placedAngles = [];

        for (let i = 0; i < count; i++) {
            const ray = explosionRayPool.get();
            if (!ray) continue;

            let angle = 0;
            // Try up to 10 times to find a suitable angle
            for (let attempt = 0; attempt <= 10; attempt++) {
                angle = Math.random() * Math.PI * 2;
                let tooClose = false;
                for (const existingAngle of placedAngles) {
                    let diff = Math.abs(angle - existingAngle) % (Math.PI * 2);
                    if (diff > Math.PI) diff = Math.PI * 2 - diff;
                    if (diff < minGap) {
                        tooClose = true;
                        break;
                    }
                }
                if (!tooClose || attempt === 10) break;
            }
            placedAngles.push(angle);

            ray.setPosition(x, y);
            ray.setOrigin(0, 0.5);
            ray.setScale(2);
            ray.setRotation(angle);
            ray.setDepth(baseDepth + 5);
            ray.setAlpha(0.5);
            ray.setVisible(true);
            ray.setActive(true);

            ray._duration = 760;
            ray._elapsed = 0;
            ray._startRotation = ray.rotation;
            ray._targetRotationOffset = Phaser.Math.FloatBetween(-0.6, 0.6);

            // Randomize flicker timing ("2 to 3 times")
            ray._flickerCount = Phaser.Math.Between(2, 3);
            ray._flickerTimes = [];
            for (let j = 0; j < ray._flickerCount; j++) {
                // Flicker between 75ms and 650ms (leaving time to finish at 1)
                ray._flickerTimes.push(125 + Math.random() * 525);
            }
            ray._flickerTimes.sort((a, b) => a - b);

            activeExplosionRays.push(ray);
        }

        PhaserScene.time.delayedCall(600, () => {
            const pulse = explosionPulsePool.get();
            pulse.setPosition(x, y);
            pulse.setDepth(baseDepth + 6);
            pulse.setScale(1.4);
            PhaserScene.tweens.add({
                targets: pulse,
                scale: 1.55,
                duration: 300,
                ease: 'Cubic.easeOut',
            });
            pulse.setVisible(true);
            pulse.setActive(true);
            pulse.play('explosion_pulse');
        });
    }

    function _update(delta) {
        if (activeManualStrikes.length > 0) {
            for (let i = activeManualStrikes.length - 1; i >= 0; i--) {
                const p = activeManualStrikes[i];
                p._elapsed += delta;
                const progress = Math.min(1, p._elapsed / p._lifespan);

                const moveProgress = 1 - Math.pow(1 - progress, 3);
                p.x = p._startX + p._distX * moveProgress;
                p.y = p._startY + p._distY * moveProgress;

                const scaleProgress = progress * progress;
                p.setScale(p._startScale * (1 - scaleProgress), 2);

                if (progress >= 1) {
                    p.setActive(false);
                    p.setVisible(false);
                    strikeSpritePool.release(p);
                    activeManualStrikes[i] = activeManualStrikes[activeManualStrikes.length - 1];
                    activeManualStrikes.pop();
                }
            }
        }

        if (activeGhosts.length > 0) {
            for (let i = activeGhosts.length - 1; i >= 0; i--) {
                const g = activeGhosts[i];
                g._elapsed += delta;
                const progress = Math.min(1, g._elapsed / g._duration);
                g.setAlpha(0.4 * (1 - progress));

                if (progress >= 1) {
                    g.setActive(false);
                    g.setVisible(false);
                    logicStrayGhostPool.release(g);
                    activeGhosts[i] = activeGhosts[activeGhosts.length - 1];
                    activeGhosts.pop();
                }
            }
        }

        if (activeExplosionRays.length > 0) {
            for (let i = activeExplosionRays.length - 1; i >= 0; i--) {
                const ray = activeExplosionRays[i];
                ray._elapsed += delta;
                const progress = Math.min(1, ray._elapsed / ray._duration);

                // Rotation linear tween
                ray.rotation = ray._startRotation + (ray._targetRotationOffset * progress);

                // Alpha logic
                if (ray._elapsed <= 75) {
                    // 0-75ms: tween 0.75 to 1
                    const alphaProgress = ray._elapsed / 75;
                    ray.setAlpha(0.5 + (0.5 * alphaProgress));
                } else {
                    // 75-300ms: brief flickering to 0.6
                    let targetAlpha = 1;
                    for (const fTime of ray._flickerTimes) {
                        if (ray._elapsed >= fTime && ray._elapsed <= fTime + 40) {
                            targetAlpha = 0.6;
                            break;
                        }
                    }
                    ray.setAlpha(targetAlpha);
                }

                if (progress >= 1) {
                    ray.setActive(false);
                    ray.setVisible(false);
                    explosionRayPool.release(ray);
                    activeExplosionRays[i] = activeExplosionRays[activeExplosionRays.length - 1];
                    activeExplosionRays.pop();
                }
            }
        }
    }

    function init() {
        explosionRayPool.preAllocate(5);
        explosionPulsePool.preAllocate(1);
    }

    updateManager.addFunction(_update);

    return {
        init,
        basicStrike,
        basicStrikeManual,
        towerDeath,
        logicStrayGhost,
        createEnemyDeathAnim,
        minibossExplosion,
        createBossExplosionRays
    };
})();
