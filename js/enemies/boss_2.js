// js/enemies/boss_2.js — Phase 2 boss (MVC).
// Spawns when wave progress reaches 100% on Level 2.
// Moves 2.5x as fast as a basic enemy and has a similar starting speed boost to Boss 1.
// 200 base health.

class Boss2Model extends BossModel {
    constructor(levelScalingModifier = 1) {
        super(levelScalingModifier);
        this.initialSpeedMult = 7.0; // Same burst of speed as Boss 1
        this.rampDuration = 1.4;
        this.size = 145; // Reasonable size for Boss 2
        this.bossId = 'boss2';
    }
}

class Boss2View extends EnemyView {
    constructor() {
        // Lower base depth to DEPTH_ENEMIES - 2 (98) so turret at +1 (99) 
        // stays strictly below normal enemies at DEPTH_ENEMIES (100).
        const baseDepth = GAME_CONSTANTS.DEPTH_ENEMIES - 2;
        super(Enemy.TEX_KEY, 'boss_2.png', 'boss2_hp.png', baseDepth);

        // Add turret visual at center
        this.turret = PhaserScene.add.image(0, 0, Enemy.TEX_KEY, 'boss_2_turret.png');
        this.turret.setDepth(baseDepth + 1);
        this.turret.setVisible(false);
        this.turret.setActive(false);

        // Optional pink pulse nineslice effect identical to Boss 1 (if standard for bosses)
        this.pulse = PhaserScene.add.nineslice(0, 0, Enemy.TEX_KEY, 'pink_pulse.png', 331, 331, 65, 65, 65, 65);
        this.pulse.setDepth(baseDepth - 1);
        this.pulse.setVisible(false);
        this.pulse.setAlpha(0);

        this.pulse2 = PhaserScene.add.nineslice(0, 0, Enemy.TEX_KEY, 'pink_pulse.png', 331, 331, 65, 65, 65, 65);
        this.pulse2.setDepth(baseDepth - 1);
        this.pulse2.setVisible(false);
        this.pulse2.setAlpha(0);

        this.pulseTimer = null;
    }

    activate(x, y, rotation, cannotRotate) {
        super.activate(x, y, rotation, cannotRotate);

        if (this.turret) {
            this.turret.setPosition(x, y);
            this.turret.setRotation(rotation);
            this.turret.setVisible(true);
            this.turret.setActive(true);
            this.turret.setAlpha(1);
        }

        if (this.pulse) {
            this.pulse.setPosition(x, y);
            this.pulse.setVisible(true);
            this.pulse.setAlpha(0);
            this.pulse.setRotation(rotation);
            this.pulse.width = 331;
            this.pulse.height = 331;

            this.pulse2.setPosition(x, y);
            this.pulse2.setVisible(true);
            this.pulse2.setAlpha(0);
            this.pulse2.setRotation(rotation);
            this.pulse2.width = 325;
            this.pulse2.height = 325;

            this._startPulseEffect();
        }
    }

    _startPulseEffect() {
        const playPulse = () => {
            if (!this.pulse || !this.pulse.scene) return;

            const triggerOne = (p, finalSize) => {
                if (!p || !p.scene) return;
                p.width = 338;
                p.height = 338;
                p.setAlpha(1);

                PhaserScene.tweens.add({
                    targets: p,
                    width: finalSize,
                    height: finalSize,
                    duration: 1100,
                    ease: 'Quart.easeOut'
                });

                PhaserScene.tweens.add({
                    targets: p,
                    alpha: 0,
                    duration: 1100,
                    ease: 'Quad.easeOut'
                });
            };

            triggerOne(this.pulse, 625);

            PhaserScene.time.delayedCall(100, () => {
                triggerOne(this.pulse2, 563);
            });

            if (typeof cameraManager !== 'undefined') {
                cameraManager.shake(120, 0.004);
            }
            if (typeof audio !== 'undefined') {
                audio.play('drum_beat', 0.85);
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
        if (this.turret) this.turret.setPosition(x, y);
        if (this.pulse) this.pulse.setPosition(x, y);
        if (this.pulse2) this.pulse2.setPosition(x, y);
    }

    setRotation(rot) {
        super.setRotation(rot);
        if (this.turret) this.turret.setRotation(rot);
    }

    deactivate() {
        super.deactivate();
        if (this.turret) {
            this.turret.setVisible(false);
            this.turret.setActive(false);
        }
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
    }
}

class Boss2 extends Boss {
    constructor(levelScalingModifier = 1) {
        super(levelScalingModifier);
        this.model = new Boss2Model(levelScalingModifier);
        this.view = new Boss2View();
    }

    activate(x, y, scaleFactor = 1.0) {
        // Base boss health for Boss 2 is 200
        const bossHealth = 200;

        super.activate(x, y, {
            maxHealth: bossHealth,
            damage: GAME_CONSTANTS.ENEMY_BASE_DAMAGE * 3, // Assuming same collision damage
            selfDamage: 0,
            speed: GAME_CONSTANTS.ENEMY_BASE_SPEED * 2.5, // 2.5x speed
            initialSpeedMult: this.model.initialSpeedMult,
            rampDuration: this.model.rampDuration,
            size: this.model.size
        });

        PhaserScene.time.delayedCall(1000, () => {
            messageBus.publish('AnnounceText', t('ui', 'boss_2_name'));
        });
    }
}
