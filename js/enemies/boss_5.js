// js/enemies/boss_5.js — Phase 5 boss (MVC).
// Behaves identically to Boss 1 but is 50% larger and has 5x health.
// On defeat, triggers the shared boss death sequence (kill-all and drop vacuum).

class Boss5Model extends BossModel {
    constructor(levelScalingModifier = 1) {
        super(levelScalingModifier);
        this.initialSpeedMult = 7.0;
        this.rampDuration = 1.5;
        this.size = 273; // 195 * 1.4
        this.bossId = 'boss5';
        this.staggering = false;
        this.staggerPhaseComplete = false;
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
        const baseDepth = GAME_CONSTANTS.DEPTH_ENEMIES - 1;
        super(Enemy.TEX_KEY, 'boss_5.png', 'boss5_hp.png', baseDepth);

        // Scaled pink pulse effect (1.4x larger than current Boss 5)
        const startSize = 553;
        this.pulse = PhaserScene.add.nineslice(0, 0, Enemy.TEX_KEY, 'pink_pulse.png', startSize, startSize, 65, 65, 65, 65);
        this.pulse.setDepth(baseDepth - 1);
        this.pulse.setVisible(false);
        this.pulse.setAlpha(0);

        this.pulse2 = PhaserScene.add.nineslice(0, 0, Enemy.TEX_KEY, 'pink_pulse.png', startSize, startSize, 65, 65, 65, 65);
        this.pulse2.setDepth(baseDepth - 1);
        this.pulse2.setVisible(false);
        this.pulse2.setAlpha(0);

        this.pulse3 = PhaserScene.add.nineslice(0, 0, Enemy.TEX_KEY, 'pink_pulse.png', startSize, startSize, 65, 65, 65, 65);
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
            triggerOne(this.pulse, 1050); // 750 * 1.4
            PhaserScene.time.delayedCall(100, () => {
                triggerOne(this.pulse2, 945); // 675 * 1.4
            });
            PhaserScene.time.delayedCall(200, () => {
                triggerOne(this.pulse3, 840); // 600 * 1.4
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
        if (this.pulse) this.pulse.setPosition(x, y);
        if (this.pulse2) this.pulse2.setPosition(x, y);
        if (this.pulse3) this.pulse3.setPosition(x, y);
    }

    deactivate() {
        super.deactivate();
        if (this.pulseTimer) {
            this.pulseTimer.remove();
            this.pulseTimer = null;
        }
        if (this.pulse) {
            this.pulse.setVisible(false);
            PhaserScene.tweens.killTweensOf(this.pulse);
        }
        if (this.pulse2) {
            this.pulse2.setVisible(false);
            PhaserScene.tweens.killTweensOf(this.pulse2);
        }
        if (this.pulse3) {
            this.pulse3.setVisible(false);
            PhaserScene.tweens.killTweensOf(this.pulse3);
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
        // Base boss health for Boss 5 is 900 (5x Boss 1's 180)
        const bossHealth = 1000;

        super.activate(x, y, {
            maxHealth: bossHealth,
            damage: GAME_CONSTANTS.ENEMY_BASE_DAMAGE * 4,
            selfDamage: 0,
            speed: GAME_CONSTANTS.ENEMY_BASE_SPEED * 0.66,
            initialSpeedMult: this.model.initialSpeedMult,
            rampDuration: this.model.rampDuration,
            size: this.model.size
        });

        this.model.staggering = false;
        this.model.staggerPhaseComplete = false;

        PhaserScene.time.delayedCall(1000, () => {
            messageBus.publish('AnnounceText', t('ui', 'boss_5_name'));
        });
    }

    // ── Option C: Pre-death stagger ──────────────────────────────────────────

    takeDamage(amount) {
        // Block all damage during stagger phase
        if (this.model.staggering) return false;

        const died = super.takeDamage(amount);

        if (died && !this.model.staggerPhaseComplete) {
            // Intercept death — enter stagger instead
            this.model.health = 1;
            this.model.alive = true;
            this.model.staggering = true;
            this.model.invincible = true;
            this._startStagger();
            return false;
        }

        return died;
    }

    _startStagger() {
        const v = this.view;
        const m = this.model;

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
                    targets.forEach(t => t.setTintFill(0xffffff));
                } else {
                    targets.forEach(t => t.clearTint());
                    if (Math.random() < 0.35) {
                        targets.forEach(t => t.setTint(0xff2d78));
                    }
                }
            },
            repeat: 18
        });

        // After 1.5s stagger, actually die
        PhaserScene.time.delayedCall(1500, () => {
            if (flickerInterval) flickerInterval.remove();
            targets.forEach(t => t.clearTint());

            m.staggering = false;
            m.invincible = false;
            m.staggerPhaseComplete = true;

            // Force lethal damage to trigger the real death sequence
            if (typeof enemyManager !== 'undefined') {
                enemyManager.damageEnemy(this, 9999);
            }
        });
    }
}
