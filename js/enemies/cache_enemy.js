// js/enemies/cache_enemy.js — The "Loot Goblin" high-value data cache.

class CacheEnemyModel extends EnemyModel {
    constructor() {
        super();
        this.size = GAME_CONSTANTS.ENEMY_SIZE_CACHE;
        this.type = 'cache';
        this.baseResourceDrop = 12;
        this.jitterTimer = 0;
        this.jitterPeriod = 0.5;
        this.orbitAngle = 0;
        this.isEnraged = false;
        this.particleTimer = 0;
        this.hasTeleported = false;
        this.isGlitching = false;
        this.flightAngle = 0;
    }
}

class CacheEnemyView extends EnemyView {
    constructor() {
        super(Enemy.TEX_KEY, 'invis.png', 'invis.png', GAME_CONSTANTS.DEPTH_ENEMIES);
        this.coreParts = [];
        this.baseRot = 0;
    }

    createVisuals() {
        if (!PhaserScene) return;

        this.glow = PhaserScene.add.image(0, 0, 'white_pixel');
        this.glow.setTint(0x0066ff);
        this.glow.setAlpha(0.4);
        this.glow.setScale(38);
        this.glow.setDepth(this.img.depth);
        this.coreParts.push(this.glow);

        this.outerRing = PhaserScene.add.image(0, 0, 'white_pixel');
        this.outerRing.setTint(0x00ccff);
        this.outerRing.setScale(22);
        this.outerRing.setAlpha(0.9);
        this.outerRing.setDepth(this.img.depth);
        this.coreParts.push(this.outerRing);

        this.innerCore = PhaserScene.add.image(0, 0, 'white_pixel');
        this.innerCore.setTint(0xe0f7ff);
        this.innerCore.setScale(12);
        this.innerCore.setDepth(this.img.depth);
        this.coreParts.push(this.innerCore);

        this.pulseTween = PhaserScene.tweens.add({
            targets: [this.glow, this.outerRing, this.innerCore],
            scaleX: '+=6',
            scaleY: '+=6',
            alpha: '-=0.15',
            duration: 600,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
    }

    updateVisuals(x, y, isEnraged, isGlitching) {
        if (this.coreParts.length === 0) return;

        this.baseRot += isEnraged ? 0.08 : 0.035;

        let renderX = x;
        let renderY = y;

        if (isGlitching) {
            const angle = Math.random() * Math.PI * 2;
            const dist = Math.random() * 8; // Max 8px offset
            renderX += Math.cos(angle) * dist;
            renderY += Math.sin(angle) * dist;
        }

        this.glow.setPosition(renderX, renderY);
        this.outerRing.setPosition(renderX, renderY);
        this.innerCore.setPosition(renderX, renderY);

        this.outerRing.setRotation(this.baseRot);
        this.innerCore.setRotation(-this.baseRot * 1.5);
    }

    playTeleportIndicator(x, y) {
        if (!PhaserScene) return;

        const burst = PhaserScene.add.nineslice(x, y, Enemy.TEX_KEY, 'pink_pulse.png', 75, 75, 32, 32, 32, 32);
        burst.setTintFill(0xffffff);
        burst.setDepth(this.img.depth + 2);

        PhaserScene.tweens.add({
            targets: burst,
            width: 330,
            height: 330,
            alpha: 0,
            duration: 480,
            ease: 'Quad.easeOut',
            onComplete: () => burst.destroy()
        });

        if (typeof audio !== 'undefined') {
            audio.play('pew', 0.95);
        }
    }

    playHitFlash() {
        if (!this.coreParts || this.coreParts.length === 0) return;
        this.coreParts.forEach(p => p.setTintFill(0xffffff));
    }

    clearHitFlash() {
        if (!this.coreParts || this.coreParts.length === 0) return;
        this.glow.setTint(0x0066ff);
        this.outerRing.setTint(0x00ccff);
        this.innerCore.setTint(0xe0f7ff);
    }

    destroy() {
        if (this.pulseTween) this.pulseTween.stop();
        this.coreParts.forEach(p => p.destroy());
        this.coreParts = [];
        super.destroy();
    }
}

class CacheEnemy extends Enemy {
    constructor() {
        super();
        this.model = new CacheEnemyModel();
        this.view = new CacheEnemyView();
    }

    activate(x, y, scaleFactor) {
        const m = this.model;
        m.isEnraged = false;
        m.hasTeleported = false;
        m.isGlitching = false;
        m.orbitAngle = 0;
        m.jitterTimer = 0;

        super.activate(x, y, {
            maxHealth: GAME_CONSTANTS.ENEMY_BASE_HEALTH * scaleFactor * 3.5,
            speed: GAME_CONSTANTS.ENEMY_BASE_SPEED * 1.5,
            initialSpeedMult: 6.0,
            rampDuration: 1,
            damage: 0,
            selfDamage: 0,
            size: GAME_CONSTANTS.ENEMY_SIZE_CACHE,
            baseResourceDrop: 12
        });

        if (this.view.coreParts.length === 0) {
            this.view.createVisuals();
        }

        console.log(`[CacheEnemy] SPAWNED at ${Math.floor(x)}, ${Math.floor(y)}`);
        this.view.coreParts.forEach(p => p.setVisible(true));
    }

    update(dt) {
        const m = this.model;
        if (!m.alive) return;

        if (!m.isEnraged && m.health < m.maxHealth) {
            m.isEnraged = true;
            m.speed = GAME_CONSTANTS.ENEMY_BASE_SPEED * 2.5;
            m.jitterPeriod = 0.25;
        }

        if (m.isGlitching) {
            m.vx = 0;
            m.vy = 0;
        } else {
            m.vx = Math.cos(m.flightAngle) * m.speed;
            m.vy = Math.sin(m.flightAngle) * m.speed;
        }

        m.orbitAngle += dt * (m.isEnraged ? 8 : 3);

        this.view.updateVisuals(m.x, m.y, m.isEnraged, m.isGlitching);

        m.particleTimer += dt;
        if (m.particleTimer >= 0.08) {
            m.particleTimer = 0;
            customEmitters.cacheTrail(m.x, m.y);
        }

        super.update(dt);

        const distSq = (m.x - GAME_CONSTANTS.halfWidth) ** 2 + (m.y - GAME_CONSTANTS.halfHeight) ** 2;

        if (distSq > 1250 ** 2) {
            console.log(`[CacheEnemy] DESPAWNED (too far: ${Math.sqrt(distSq).toFixed(1)})`);
            this.deactivate();
        }
    }

    aimAt(tx, ty) {
        const m = this.model;
        if (m.isGlitching) {
            m.vx = 0;
            m.vy = 0;
            return;
        }

        const dx = tx - m.x;
        const dy = ty - m.y;
        const baseAngle = Math.atan2(dy, dx);

        const deviation = 0.4 * (Math.random() < 0.5 ? 1 : -1);
        m.flightAngle = baseAngle + deviation;

        m.vx = Math.cos(m.flightAngle) * m.speed;
        m.vy = Math.sin(m.flightAngle) * m.speed;
    }

    takeDamage(amount) {
        const result = super.takeDamage(amount);

        const m = this.model;
        if (m.alive && result && result.actualApplied > 0) {

            if (typeof resourceManager !== 'undefined') {
                resourceManager.spawnDataDrop(m.x, m.y);
                resourceManager.spawnDataDrop(m.x, m.y);
            }

            if (!m.hasTeleported) {
                m.hasTeleported = true;
                m.isGlitching = true;

                if (this.view.coreParts && this.view.coreParts.length > 0) {
                    PhaserScene.tweens.add({
                        targets: this.view.coreParts,
                        alpha: 0.33,
                        duration: 60,
                        yoyo: true,
                        repeat: 5,
                        onComplete: () => {
                            if (!m.alive) return;
                            m.isGlitching = false;

                            const skipDist = 200;
                            const dirX = Math.cos(m.flightAngle);
                            const dirY = Math.sin(m.flightAngle);

                            m.x += dirX * skipDist;
                            m.y += dirY * skipDist;

                            // Prevent ghosting: snap visuals to new position before pulsing
                            this.view.updateVisuals(m.x, m.y, m.isEnraged, m.isGlitching);
                            this.view.playTeleportIndicator(m.x, m.y);
                        }
                    });
                }
            } else if (!m.isGlitching && this.view.coreParts && this.view.coreParts.length > 0) {
                PhaserScene.tweens.add({
                    targets: this.view.coreParts,
                    alpha: 0.1,
                    duration: 50,
                    yoyo: true
                });
            }
        }

        return result;
    }

    deactivate() {
        this.view.coreParts.forEach(p => p.setVisible(false));
        super.deactivate();
    }
}
