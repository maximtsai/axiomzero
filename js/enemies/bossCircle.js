// js/enemies/bossCircle.js — Phase 1 alternative boss (MVC).
// Spawns when wave progress reaches 100%.
// Identical stats to BossSquare but different visuals.

class BossCircleModel extends BossModel {
    constructor(levelScalingModifier = 1) {
        super(levelScalingModifier);
        this.initialSpeedMult = 5.5;
        this.rampDuration = 2.2;
        this.size = 163;
        this.bossId = 'bossCircle';
    }

    getSpawnDistanceOffset() {
        return 40;
    }
}

class BossCircleView extends EnemyView {
    constructor() {
        const baseDepth = GAME_CONSTANTS.DEPTH_ENEMIES - 1;
        super(Enemy.TEX_KEY, 'bosscircle.png', 'bosscircle_hp.png', baseDepth);

        // Add pink pulse sprites
        this.pulse = PhaserScene.add.image(0, 0, Enemy.TEX_KEY, 'pink_circle_pulse.png');
        this.pulse.setDepth(baseDepth - 1);
        this.pulse.setVisible(false);
        this.pulse.setAlpha(0);

        this.pulse2 = PhaserScene.add.image(0, 0, Enemy.TEX_KEY, 'pink_circle_pulse.png');
        this.pulse2.setDepth(baseDepth - 1);
        this.pulse2.setVisible(false);
        this.pulse2.setAlpha(0);

        this.pulseTimer = null;
    }

    activate(x, y, rotation, cannotRotate) {
        super.activate(x, y, rotation, cannotRotate);

        if (this.pulse) {
            this.pulse.setPosition(x, y);
            this.pulse.setVisible(true);
            this.pulse.setAlpha(0);
            this.pulse.setScale(0.5);

            this.pulse2.setPosition(x, y);
            this.pulse2.setVisible(true);
            this.pulse2.setAlpha(0);
            this.pulse2.setScale(0.5);

            this._startPulseEffect();
        }
    }

    _startPulseEffect() {
        const playPulse = () => {
            if (!this.pulse || !this.pulse.scene) return;

            const triggerOne = (p, finalScale) => {
                if (!p || !p.scene) return;
                // Reset state
                p.setScale(0.5);
                p.setAlpha(1);

                // Tween scale
                PhaserScene.tweens.add({
                    targets: p,
                    scaleX: finalScale,
                    scaleY: finalScale,
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

            // First pulse
            triggerOne(this.pulse, 1.65);

            // Second pulse 0.1s later
            PhaserScene.time.delayedCall(100, () => {
                triggerOne(this.pulse2, 1.4);
            });

            if (typeof cameraManager !== 'undefined') {
                cameraManager.shake(120, 0.004);
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
    }
}

class BossCircle extends Boss {
    constructor(levelScalingModifier = 1) {
        super(levelScalingModifier);
        this.model = new BossCircleModel(levelScalingModifier);
        this.view = new BossCircleView();
    }

    activate(x, y, scaleFactor = 1.0) {
        const bossHealth = 200;

        super.activate(x, y, {
            maxHealth: bossHealth,
            damage: GAME_CONSTANTS.ENEMY_BASE_DAMAGE * 3,
            selfDamage: 0,
            speed: GAME_CONSTANTS.ENEMY_BASE_SPEED * 0.8,
            initialSpeedMult: this.model.initialSpeedMult,
            rampDuration: this.model.rampDuration,
            size: this.model.size
        });

        PhaserScene.time.delayedCall(1000, () => {
            messageBus.publish('BossAnnounceText', { msg1: t('ui', 'boss_prefix'), msg2: t('ui', 'bossCircle_name') });
        });
    }
}
