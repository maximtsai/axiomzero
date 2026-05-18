// js/enemies/boss_5.js — Phase 5 boss (MVC).
// Behaves identically to Boss 1 but is 50% larger and has 5x health.
// On defeat, triggers the shared boss death sequence (kill-all and drop vacuum).

class Boss5Model extends BossModel {
    constructor(levelScalingModifier = 1) {
        super(levelScalingModifier);
        this.initialSpeedMult = 7.0;
        this.rampDuration = 1.5;
        this.size = 275; // 195 * 1.4 + 5
        this.bossId = 'boss5';
        this.staggering = false;
        this.staggerPhaseComplete = false;
        this.slamTimer = 0;
        this.isSlamming = false;
        this.slamDamage = 0;
    }

    getSpawnDistanceOffset() {
        return 150;
    }

    getSpawnAngle() {
        const halfCone = (4 / 2) * (Math.PI / 180); // 2 degrees either way
        const side = Math.random() < 0.5 ? 0 : Math.PI;
        const offset = (Math.random() * 2 - 1) * halfCone;
        return side + offset;
    }
}

class Boss5View extends EnemyView {
    constructor() {
        const baseDepth = GAME_CONSTANTS.DEPTH_ENEMIES - 2;
        super('bosses', 'boss_5.png', 'boss5_hp.png', baseDepth);

        // Scaled pink pulse effect (1.4x larger than current Boss 5)
        const startSize = 553;
        this.pulse = helper.createNineSlice(0, 0, 'bosses', 'pink_pulse.png', startSize, startSize, 65, 65, 65, 65);
        this.pulse.setDepth(baseDepth - 1);
        this.pulse.setVisible(false);
        this.pulse.setAlpha(0);

        this.pulse2 = helper.createNineSlice(0, 0, 'bosses', 'pink_pulse.png', startSize, startSize, 65, 65, 65, 65);
        this.pulse2.setDepth(baseDepth - 1);
        this.pulse2.setVisible(false);
        this.pulse2.setAlpha(0);

        this.pulse3 = helper.createNineSlice(0, 0, 'bosses', 'pink_pulse.png', startSize, startSize, 65, 65, 65, 65);
        this.pulse3.setDepth(baseDepth - 1);
        this.pulse3.setVisible(false);
        this.pulse3.setAlpha(0);

        this.pulseTimer = null;
    }

    activate(x, y, rotation, cannotRotate) {
        super.activate(x, y, rotation, cannotRotate);

        if (this.pulse) {
            this.pulse.setPosition(x, y);
            this.pulse.setVisible(true);
            this.pulse.setAlpha(0);
            this.pulse.setRotation(rotation);

            this.pulse2.setPosition(x, y);
            this.pulse2.setVisible(true);
            this.pulse2.setAlpha(0);
            this.pulse2.setRotation(rotation);

            this.pulse3.setPosition(x, y);
            this.pulse3.setVisible(true);
            this.pulse3.setAlpha(0);
            this.pulse3.setRotation(rotation);

            this._startPulseEffect();
        }
    }

    _startPulseEffect() {
        const playPulse = () => {
            if (!this.pulse || !this.pulse.scene) return;

            const triggerOne = (p, finalSize) => {
                if (!p || !p.scene) return;
                p.width = 567; // 405 * 1.4
                p.height = 567;
                p.setAlpha(1);

                PhaserScene.tweens.add({
                    targets: p,
                    width: finalSize,
                    height: finalSize,
                    duration: 1300,
                    ease: 'Quart.easeOut'
                });

                PhaserScene.tweens.add({
                    targets: p,
                    alpha: 0,
                    duration: 1300,
                    ease: 'Quad.easeOut'
                });
            };

            // Scaled pulse final sizes
            triggerOne(this.pulse, 915);
            PhaserScene.time.delayedCall(90, () => {
                triggerOne(this.pulse2, 825);
            });
            PhaserScene.time.delayedCall(180, () => {
                triggerOne(this.pulse3, 735);
            });

            if (typeof cameraManager !== 'undefined') {
                cameraManager.shake(120, 0.006); // Slightly more shake for the bigger entity
            }
            if (typeof audio !== 'undefined') {
                audio.play('drum_beat', 0.95);
            }
        };

        playPulse();

        if (this.pulseTimer) this.pulseTimer.remove();
        this.pulseTimer = PhaserScene.time.addEvent({
            delay: 2400,
            callback: playPulse,
            callbackScope: this,
            loop: true
        });
    }

    syncPosition(x, y) {
        super.syncPosition(x, y);
        if (this.img) {
            const rot = this.img.rotation;
            if (this.pulse) { this.pulse.setPosition(this.img.x, this.img.y); this.pulse.setRotation(rot); }
            if (this.pulse2) { this.pulse2.setPosition(this.img.x, this.img.y); this.pulse2.setRotation(rot); }
            if (this.pulse3) { this.pulse3.setPosition(this.img.x, this.img.y); this.pulse3.setRotation(rot); }
        }
    }

    deactivate() {
        super.deactivate();
        if (this.pulseTimer) {
            this.pulseTimer.remove();
            this.pulseTimer = null;
        }
        if (this.pulse) {
            PhaserScene.tweens.killTweensOf(this.pulse);
            this.pulse.destroy();
            this.pulse = null;
        }
        if (this.pulse2) {
            PhaserScene.tweens.killTweensOf(this.pulse2);
            this.pulse2.destroy();
            this.pulse2 = null;
        }
        if (this.pulse3) {
            PhaserScene.tweens.killTweensOf(this.pulse3);
            this.pulse3.destroy();
            this.pulse3 = null;
        }
        if (this.img) {
            this.img.destroy();
            this.img = null;
        }
        if (this.hpImg) {
            this.hpImg.destroy();
            this.hpImg = null;
        }
        if (this.enemyGlow) {
            this.enemyGlow.destroy();
            this.enemyGlow = null;
        }
    }
}

class Boss5 extends Boss {
    constructor(levelScalingModifier = 1) {
        super(levelScalingModifier);
        this.model = new Boss5Model(levelScalingModifier);
        this.view = new Boss5View();
    }

    activate(x, y, scaleFactor = 1.0) {
        // Base boss health for Boss 5 is 1500 (modified per request)
        const bossHealth = 1500;

        super.activate(x, y, {
            maxHealth: bossHealth,
            damage: 0, // 0 contact damage
            selfDamage: 0,
            speed: GAME_CONSTANTS.ENEMY_BASE_SPEED * 0.66,
            initialSpeedMult: this.model.initialSpeedMult,
            rampDuration: this.model.rampDuration,
            size: this.model.size
        });

        this.model.staggering = false;
        this.model.staggerPhaseComplete = false;
        this.model.slamTimer = 0;
        this.model.isSlamming = false;
        this.model.slamDamage = 15;

        PhaserScene.time.delayedCall(1000, () => {
            messageBus.publish('BossAnnounceText', { msg1: t('ui', 'boss_prefix'), msg2: t('ui', 'boss_5_name') });
        });
    }

    deactivate() {
        super.deactivate();
        this._stopSlamAnimation();
    }

    update(dt) {
        const m = this.model;
        if (!m.alive) return;

        // Process model updates (burn ticks, stun timers, hitstop, speed ramp)
        const tickAmt = m.update(dt);
        if (tickAmt > 0 && typeof enemyManager !== 'undefined') {
            enemyManager.damageEnemy(this, tickAmt, 'burn');
        }

        this.view.updateHPCrop(m.getHealthPct());
        this.view.update(dt, m);

        if (m.isSlamming) {
            // Sync all body, glow, and pulse elements to the tweened body position
            this.view.syncPosition(this.view.img.x, this.view.img.y);
            this.view.setRotation(m.baseRotation);
            return;
        }

        // Sync position and face the tower only when not slamming
        this.view.syncPosition(m.x, m.y);
        this.view.setRotation(m.baseRotation);

        if (m.slamTimer > 0) {
            m.slamTimer -= dt * 1000;
        }

        const tPos = tower.getPosition();
        if (!tPos) return;

        const dx = tPos.x - m.x;
        const dy = tPos.y - m.y;
        const distSq = dx * dx + dy * dy;

        const contactR2 = m.contactR2;

        if (distSq <= contactR2) {
            m.isAttacking = true;
            m.vx = 0;
            m.vy = 0;

            if (m.slamTimer <= 0 && !m.staggering) {
                this._performSlam(dx, dy);
            }
        } else {
            m.isAttacking = false;
            if (!m.stunned && !m.staggering) {
                m.aimAt(tPos.x, tPos.y);
            }
        }
    }

    _performSlam(dx, dy) {
        const m = this.model;
        const v = this.view;
        if (!m.alive || m.staggering) return;

        m.isSlamming = true;
        const angle = Math.atan2(dy, dx);

        // Wind-up: pull back 36 pixels over 750ms
        const backDist = 36;
        const backX = -Math.cos(angle) * backDist;
        const backY = -Math.sin(angle) * backDist;

        v.syncPosition(m.x, m.y);

        PhaserScene.tweens.add({
            targets: [v.img, v.hpImg],
            x: m.x + backX,
            y: m.y + backY,
            duration: 750,
            ease: 'Cubic.easeOut',
            onComplete: () => {
                if (!m.alive || m.staggering) {
                    m.isSlamming = false;
                    return;
                }

                // Slam forward: lunge duration 150ms
                PhaserScene.tweens.add({
                    targets: [v.img, v.hpImg],
                    x: m.x,
                    y: m.y,
                    duration: 150,
                    ease: 'Quart.easeIn',
                    onComplete: () => {
                        if (!m.alive || m.staggering) {
                            m.isSlamming = false;
                            return;
                        }

                        // Deal damage
                        tower.takeDamage(m.slamDamage, m.x, m.y);

                        if (typeof cameraManager !== 'undefined') {
                            cameraManager.shake(400, 0.03);
                        }

                        // Hit stop: pause at peak lunge for 200ms before bounce back
                        PhaserScene.time.delayedCall(200, () => {
                            if (!m.alive || m.staggering) {
                                m.isSlamming = false;
                                return;
                            }

                            // Bounce back: bounce distance 8 pixels over 250ms
                            const bounceDist = 8;
                            const bx = -Math.cos(angle) * bounceDist;
                            const by = -Math.sin(angle) * bounceDist;

                            PhaserScene.tweens.add({
                                targets: [v.img, v.hpImg],
                                x: m.x + bx,
                                y: m.y + by,
                                duration: 250,
                                ease: 'Cubic.easeOut',
                                onComplete: () => {
                                    if (!m.alive || m.staggering) {
                                        m.isSlamming = false;
                                        return;
                                    }
                                    m.isSlamming = false;
                                    m.slamTimer = 3000; // 3s cooldown
                                }
                            });
                        });
                    }
                });
            }
        });
    }

    _stopSlamAnimation() {
        const v = this.view;
        if (typeof PhaserScene !== 'undefined' && v) {
            PhaserScene.tweens.killTweensOf([v.img, v.hpImg]);
        }
    }

    checkCollision(px, py, radiusRatio = 1.0, extraRadius = 0, sizeFallback = 15) {
        const baseR = (this.model.size !== undefined ? this.model.size : sizeFallback);
        const reach = baseR * radiusRatio + extraRadius;
        return (Math.abs(px - this.model.x) <= reach && Math.abs(py - this.model.y) <= reach);
    }

    // ── Option C: Pre-death stagger ──────────────────────────────────────────

    takeDamage(amount) {
        // Block all damage during stagger phase
        if (this.model.staggering) return { died: false, actualApplied: 0 };

        const result = super.takeDamage(amount);
        if (!result) return { died: false, actualApplied: 0 };

        if (result.died && !this.model.staggerPhaseComplete) {
            // Intercept death — enter stagger instead
            this.model.health = 1;
            this.model.alive = true;
            this.model.staggering = true;
            this.model.invincible = true;
            this._startStagger();
            return { died: false, actualApplied: result.actualApplied };
        }

        return result;
    }

    _startStagger() {
        const v = this.view;
        const m = this.model;

        this._stopSlamAnimation();
        m.isSlamming = false;

        // Stop pulse effects immediately
        if (v.pulseTimer) {
            v.pulseTimer.remove();
            v.pulseTimer = null;
        }
        [v.pulse, v.pulse2, v.pulse3].forEach(p => {
            if (p) { PhaserScene.tweens.killTweensOf(p); p.setVisible(false); }
        });

        // Freeze the boss in place
        m.vx = 0;
        m.vy = 0;
        m.stunned = true;

        // Show empty HP bar
        v.updateHPCrop(0);

        // Sustained camera rumble
        if (typeof cameraManager !== 'undefined') {
            cameraManager.shake(1500, 0.004);
        }

        // Rapid white/pink flicker
        const targets = [v.img, v.hpImg].filter(s => s && s.scene);
        let flickerCount = 0;
        const flickerInterval = PhaserScene.time.addEvent({
            delay: 80,
            callback: () => {
                flickerCount++;
                if (flickerCount % 2 === 1) {
                    targets.forEach(t => helper.setTintFill(t, 0xffffff));
                } else {
                    targets.forEach(t => helper.clearTint(t));
                    if (Math.random() < 0.35) {
                        targets.forEach(t => helper.setTint(t, 0xff2d78));
                    }
                }
            },
            repeat: 18
        });

        // After 1.5s stagger, actually die
        PhaserScene.time.delayedCall(1500, () => {
            if (flickerInterval) flickerInterval.remove();
            targets.forEach(t => helper.clearTint(t));

            m.staggering = false;
            m.invincible = false;
            m.staggerPhaseComplete = true;

            // Force lethal damage to trigger the real death sequence
            if (typeof enemyManager !== 'undefined') {
                enemyManager.damageEnemy(this, 9999, 'notrecorded');
            }
        });
    }

    onDeath(isFinal = true) {
        if (!isFinal) return;

        const ex = this.model.x;
        const ey = this.model.y;
        const bossDepth = (this.view && this.view.img) ? this.view.img.depth : (GAME_CONSTANTS.DEPTH_ENEMIES || 150);

        // ── Boss5 enhanced death sequence ──────────────────────────────
        const DEATH_DURATION = 1800;

        if (typeof audio !== 'undefined') audio.play('on_death_boss', 0.9);

        // 3 small, jittered explosion_pulse effects
        const pulseDelays = [50, 250, 450];
        pulseDelays.forEach(delay => {
            PhaserScene.time.delayedCall(delay, () => {
                const angle = Math.random() * Math.PI * 2;
                const dist = Phaser.Math.Between(30, 60);
                const jx = ex + Math.cos(angle) * dist;
                const jy = ey + Math.sin(angle) * dist;
                if (typeof customEmitters !== 'undefined' && customEmitters.playExplosionPulse) {
                    customEmitters.playExplosionPulse(jx, jy, bossDepth + 1, 1.0);
                }
            });
        });

        if (typeof customEmitters !== 'undefined' && customEmitters.createBossExplosionRays) {
            customEmitters.createBossExplosionRays(ex, ey, bossDepth, {
                count: 3,
                rayDuration: DEATH_DURATION,
                pulseScale: 2
            });
        }

        // Add 3 more individual rays over 60% of the duration
        const raySpacing = Math.round((DEATH_DURATION * 0.6) / 3);
        for (let i = 0; i < 3; i++) {
            const delay = raySpacing * (i + 1);
            PhaserScene.time.delayedCall(delay, () => {
                if (typeof customEmitters !== 'undefined' && customEmitters.createBossExplosionRays) {
                    customEmitters.createBossExplosionRays(ex, ey, bossDepth, {
                        count: 1,
                        rayDuration: DEATH_DURATION - delay,
                        skipPulse: true
                    });
                }
            });
        }

        // Clusters
        const offsets = [{ x: -90, y: -55 }, { x: 95, y: 50 }, { x: -50, y: 85 }];
        offsets.forEach((offset, idx) => {
            const delay = 300 + idx * 350;
            PhaserScene.time.delayedCall(delay, () => {
                if (typeof customEmitters !== 'undefined' && customEmitters.createBossExplosionRays) {
                    customEmitters.createBossExplosionRays(ex + offset.x, ey + offset.y, bossDepth, {
                        count: 2,
                        rayDuration: DEATH_DURATION - delay,
                        skipPulse: true
                    });
                }
                if (typeof cameraManager !== 'undefined') {
                    cameraManager.shake(200, 0.012);
                }
            });
        });

        PhaserScene.time.delayedCall(DEATH_DURATION, () => {
            if (typeof customEmitters !== 'undefined' && customEmitters.playExplosionPulse) {
                customEmitters.playExplosionPulse(ex, ey, bossDepth, 4.75, 'explosion_pulse_slow', {
                    targetScale: 6,
                    duration: 300,
                    ease: 'Quart.easeOut',
                    soundKey: '8_bit_explosion'
                });
            }
            if (typeof cameraManager !== 'undefined') {
                cameraManager.shake(1500, 0.04);
            }
        });

        // Final cinematic sequence before total purge
        if (typeof cinematicManager !== 'undefined') {
            PhaserScene.time.delayedCall(DEATH_DURATION + 100, () => {
                cinematicManager.playSystemScanInterruption().then(() => {
                    if (typeof enemyManager !== 'undefined' && enemyManager.killAllNonBossEnemies) {
                        enemyManager.killAllNonBossEnemies();
                        if (typeof cameraManager !== 'undefined') cameraManager.shake(1500, 0.045);
                    }
                });
            });
        } else {
            // Fallback for enemy clear
            if (typeof enemyManager !== 'undefined' && enemyManager.killAllNonBossEnemies) {
                PhaserScene.time.delayedCall(150, () => {
                    enemyManager.killAllNonBossEnemies();
                });
            }
        }

        messageBus.publish('bossDefeated', ex, ey);
    }
}
