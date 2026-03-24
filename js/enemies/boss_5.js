// js/enemies/boss_5.js — Phase 5 boss (MVC).
// Behaves identically to Boss 1 but is 50% larger and has 5x health.
// On defeat, triggers the shared boss death sequence (kill-all and drop vacuum).

class Boss5Model extends BossModel {
    constructor(levelScalingModifier = 1) {
        super(levelScalingModifier);
        this.initialSpeedMult = 7.0;
        this.rampDuration = 1.5;
        this.size = 273; // 195 * 1.4
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

        PhaserScene.time.delayedCall(1000, () => {
            messageBus.publish('AnnounceText', t('ui', 'boss_5_name'));
        });
    }
}
