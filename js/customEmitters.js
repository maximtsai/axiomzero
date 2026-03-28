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
            sprite.setScale(0.75);
            sprite.setAlpha(1);
            sprite.setRotation(0);
        },
        16
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

    const bombExplosionBrightPool = new ObjectPool(
        () => {
            const node = PhaserScene.add.nineslice(0, 0, 'player', 'player_attack.png', 10, 10, 38, 38, 38, 38);
            node.setActive(false);
            node.setVisible(false);
            return node;
        },
        (node) => {
            node.setActive(false);
            node.setVisible(false);
            node.setAlpha(1);
            node.setScale(1);
            node.setRotation(0);
            node.clearTint();
        },
        12
    );

    const bombExplosionRedPool = new ObjectPool(
        () => {
            const node = PhaserScene.add.nineslice(0, 0, 'player', 'player_attack_red.png', 10, 10, 38, 38, 38, 38);
            node.setActive(false);
            node.setVisible(false);
            return node;
        },
        (node) => {
            node.setActive(false);
            node.setVisible(false);
            node.setAlpha(1);
            node.setScale(1);
            node.setRotation(0);
            node.clearTint();
        },
        12
    );

    const malwareSiphonPool = new ObjectPool(
        () => {
            const sprite = PhaserScene.add.sprite(0, 0, 'player', 'heal.png');
            sprite.setActive(false);
            sprite.setVisible(false);
            return sprite;
        },
        (sprite) => {
            sprite.setActive(false);
            sprite.setVisible(false);
            sprite.setAlpha(1);
            sprite.setScale(1);
            sprite.setRotation(0);
            sprite.clearTint();
        },
        15
    );
 
    const shellDeathPool = new ObjectPool(
        () => {
            const spr = PhaserScene.add.sprite(0, 0, 'attacks', 'enemy_hit_circle1.png');
            spr.setDepth(GAME_CONSTANTS.DEPTH_ENEMIES + 4);
            spr.setVisible(false);
            spr.setActive(false);
            spr.on('animationcomplete', (anim) => {
                if (anim.key === 'enemy_hit_circle_slow') {
                    spr.setVisible(false);
                    spr.setActive(false);
                    shellDeathPool.release(spr);
                }
            });
            return spr;
        },
        (spr) => {
            spr.setVisible(false);
            spr.setActive(false);
            spr.setScale(2);
        },
        10
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
        speed: { min: 280, max: 490, ease: 'Cubic.easeOut' },
        lifespan: { min: 300, max: 600 },
        scale: { start: 30, end: 0 },
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

    function createEnemyDeathAnim(enemy, isSlow = false, durationOverride = 0) {
        if (!enemy || !enemy.view || !enemy.view.img) return;

        const spritesToAnimate = [enemy.view.img];
        if (enemy.view.hpImg) {
            enemy.view.hpImg.setScale(enemy.view.img.scaleX);
            enemy.view.hpImg.depth = enemy.view.img.depth + 1;
            spritesToAnimate.push(enemy.view.hpImg);
        }

        const targetScaleMultiplier = 1 + (90 / (90 + (enemy.model.size || 20)));
        const baseScaleX = enemy.view.img.scaleX;
        const baseScaleY = enemy.view.img.scaleY;
        const randRot = Math.random() * 0.3 - 0.15;

        const copies = spritesToAnimate.map(origSprite => {
            const copy = enemyDeathAnimPool.get();
            copy.setFrame(origSprite.frame.name);
            copy.setPosition(origSprite.x, origSprite.y);
            copy.setRotation(origSprite.rotation + randRot);
            copy.setDepth(origSprite.depth + 5);
            copy.setOrigin(origSprite.originX, origSprite.originY);

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
        if (enemy && enemy.model.isBoss) duration = 800;
        else if (enemy && enemy.model.type === 'bomb') duration = 250;
        if (durationOverride > 0) duration = durationOverride;

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
        copy.setOrigin(originalSprite.originX, originalSprite.originY);
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
                            const radius = 240 * effectScale;
                            const radiusSq = radius * radius;

                            // Use spatial hash to quickly get targets in the bounding box
                            const boxTargets = enemyManager.getEnemiesInSquareRange(x, y, radius);
                            for (let i = 0; i < boxTargets.length; i++) {
                                const e = boxTargets[i];
                                const dx = e.model.x - x;
                                const dy = e.model.y - y;
                                // Exact circle check
                                if (dx * dx + dy * dy <= radiusSq) {
                                    enemyManager.damageEnemy(e, 99, 'other');
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

    function createBossExplosionRays(x, y, baseDepth, config = {}) {
        const count = (config.count !== undefined) ? config.count : Phaser.Math.Between(5, 6);
        const rayDuration = config.rayDuration || 760;
        const skipPulse = config.skipPulse || false;
        const minGap = 0.4; // radians
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

            // 50% chance to use thin ray
            const rayFrame = Math.random() < 0.5 ? 'explosion_ray.png' : 'explosion_ray_thin.png';
            ray.setFrame(rayFrame);
            ray.setOrigin(0, 0.5);

            // Increased scales: start 0.75
            ray.setScale(1.5, 0.75);
            ray.setRotation(angle);
            ray.setDepth(baseDepth + 5);
            ray.setAlpha(0.5);
            ray.setVisible(true);
            ray.setActive(true);

            const tweenDuration = Math.round(rayDuration * 0.92);
            PhaserScene.tweens.add({
                targets: ray,
                scaleY: 1.6,
                duration: tweenDuration,
            });
            PhaserScene.tweens.add({
                targets: ray,
                scaleX: 1.8,
                duration: tweenDuration,
            });

            ray._duration = rayDuration;
            ray._elapsed = 0;
            ray._startRotation = ray.rotation;
            ray._targetRotationOffset = Phaser.Math.FloatBetween(-0.6, 0.6);

            // Randomize flicker timing ("2 to 3 times")
            ray._flickerCount = Phaser.Math.Between(2, 3);
            ray._flickerTimes = [];
            for (let j = 0; j < ray._flickerCount; j++) {
                ray._flickerTimes.push(125 + Math.random() * (rayDuration * 0.7));
            }
            ray._flickerTimes.sort((a, b) => a - b);

            activeExplosionRays.push(ray);
        }

        if (!skipPulse) {
            const pulseDelay = Math.min(700, Math.round(rayDuration * 0.92));
            const startScale = config.pulseScale || 1.4;
            const endScale = startScale * 1.1; // Grow by ~10%

            PhaserScene.time.delayedCall(pulseDelay, () => {
                const pulse = explosionPulsePool.get();
                pulse.setPosition(x, y);
                pulse.setDepth(baseDepth + 6);
                pulse.setScale(startScale);
                PhaserScene.tweens.add({
                    targets: pulse,
                    scale: endScale,
                    duration: 300,
                    ease: 'Cubic.easeOut',
                });
                pulse.setVisible(true);
                pulse.setActive(true);
                pulse.play('explosion_pulse');

                if (config.soundKey && typeof audio !== 'undefined') {
                    audio.play(config.soundKey, 0.9);
                }
            });
        }
    }

    function playExplosionPulse(x, y, baseDepth, scale, animKey = 'explosion_pulse', config = {}) {
        const pulse = explosionPulsePool.get();
        if (!pulse) return;
        pulse.setPosition(x, y);
        pulse.setDepth(baseDepth + 6);
        pulse.setScale(scale);
        pulse.setVisible(true);
        pulse.setActive(true);
        pulse.play(animKey);

        if (config.targetScale !== undefined) {
            PhaserScene.tweens.add({
                targets: pulse,
                scale: config.targetScale,
                duration: config.duration || 300,
                ease: config.ease || 'Linear'
            });
        }

        if (config.soundKey && typeof audio !== 'undefined') {
            audio.play(config.soundKey, 0.9);
        }
    }

    // ── Bomb Explosion ──────────────────────────────────────────────────────────
    function createBombExplosion(x, y, rangeSq, damage) {
        const size = Math.sqrt(rangeSq) * 1.5;
        const randRot = Math.random() < 0.5 ? -0.1 : 0.1;
        const finalRot = Math.PI / 4 + randRot;
        const bright = bombExplosionBrightPool.get();
        bright.setPosition(x, y);
        bright.setSize(size, size);
        bright.setOrigin(0.5, 0.5);
        bright.setDepth(GAME_CONSTANTS.DEPTH_TOWER + 1);
        bright.setBlendMode(Phaser.BlendModes.ADD);
        bright.setRotation(finalRot);
        bright.setAlpha(1);
        bright.setVisible(true);
        bright.setActive(true);

        const red = bombExplosionRedPool.get();
        red.setPosition(x, y);
        red.setSize(size + 3, size + 3);
        red.setOrigin(0.5, 0.5);
        red.setDepth(GAME_CONSTANTS.DEPTH_TOWER);
        red.setBlendMode(Phaser.BlendModes.ADD);
        red.setRotation(finalRot);
        red.setAlpha(0.8);
        red.setVisible(true);
        red.setActive(true);

        bright.setScale(1.1);
        red.setScale(1.15);

        PhaserScene.cameras.main.shake(150, 0.005);
        PhaserScene.tweens.add({
            targets: [bright, red],
            duration: 90,
            rotation: Math.PI / 4 + randRot * -0.7,
            ease: 'Cubic.easeOut',
            onComplete: () => {
                PhaserScene.tweens.add({
                    targets: [bright, red],
                    duration: 160,
                    rotation: Math.PI / 4,
                    ease: 'Back.easeOut',
                });
            }
        });
        PhaserScene.tweens.add({
            targets: [bright, red],
            scaleX: 1.0,
            scaleY: 1.0,
            delay: 50,
            alpha: 0,
            duration: 350,
            ease: 'Cubic.easeOut',
            onComplete: () => {
                bombExplosionBrightPool.release(bright);
                bombExplosionRedPool.release(red);
            }
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

    function malwareSiphonFX(x, y, tx, ty) {
        if (gameState.settings.minimalParticles) return;
        console.log("fx malware")
        const sprite = malwareSiphonPool.get();
        sprite.setPosition(x, y);
        sprite.setVisible(true);
        sprite.setActive(true);
        sprite.setAlpha(1);
        sprite.setScale(2);
        sprite.setDepth(1);
        sprite.setBlendMode(Phaser.BlendModes.ADD);
        PhaserScene.tweens.add({
            targets: sprite,
            alpha: 0,
            duration: 560,
        });
        const curveLeft = Math.random() < 0.5;
        let curveX = 'linear';
        let curveY = 'linear';
        if (curveLeft) {
            curveX = 'Cubic.easeOut';
            if (Math.random() < 0.5) {
                curveY = 'Quad.easeIn';
            }
        } else {
            curveY = 'Cubic.easeOut';
            if (Math.random() < 0.5) {
                curveX = 'Quad.easeIn';
            }
        }

        PhaserScene.tweens.add({
            targets: sprite,
            x: tx,
            duration: 580,
            ease: curveX,
        });
        PhaserScene.tweens.add({
            targets: sprite,
            y: ty,
            duration: 580,
            ease: curveY,
        });
        PhaserScene.tweens.add({
            targets: sprite,
            scale: 1,
            duration: 580,
            onComplete: () => {
                malwareSiphonPool.release(sprite);
            }
        });
    }

    function init() {
        explosionRayPool.preAllocate(16);
        explosionPulsePool.preAllocate(3);
        bombExplosionBrightPool.preAllocate(5);
        bombExplosionRedPool.preAllocate(5);
        malwareSiphonPool.preAllocate(8);
        shellDeathPool.preAllocate(5);
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
        createBossExplosionRays,
        playExplosionPulse,
        createBombExplosion,
        malwareSiphonFX,
        playShellDeath: (x, y, depth) => {
            const spr = shellDeathPool.get();
            if (!spr) return;
            spr.setPosition(x, y);
            spr.setDepth(depth + 2);
            spr.setVisible(true);
            spr.setActive(true);
            spr.setScale(2);
            spr.play('enemy_hit_circle_slow');
        }
    };
})();
