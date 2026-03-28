// js/enemies/boss_1.js — Phase 1 boss (MVC).
// Spawns when wave progress reaches 100%.
// Starts moving very fast (7x speed) and slows down linearly to default (0.75x speed) over 1.25s.
// High health. On defeat, triggers a special sequence that kills all enemies and vacuums drops.

class Boss1Model extends BossModel {
    constructor(levelScalingModifier = 1) {
        super(levelScalingModifier);
        this.initialSpeedMult = 7.0;
        this.rampDuration = 1.4;
        this.size = 163; // Increased 25% from 130
        this.bossId = 'boss1';
    }
}

class Boss1View extends EnemyView {
    constructor() {
        const baseDepth = GAME_CONSTANTS.DEPTH_ENEMIES - 1;
        super(Enemy.TEX_KEY, 'boss_1.png', 'boss_hp.png', baseDepth);

        // Add pink pulse nineslice — corner size 65px
        // Phaser 3.60+ nineslice: (x, y, texture, frame, width, height, left, right, top, bottom)
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
                // Reset state
                p.width = 338;
                p.height = 338;
                p.setAlpha(1);

                // Tween size
                PhaserScene.tweens.add({
                    targets: p,
                    width: finalSize,
                    height: finalSize,
                    duration: 1100,
                    ease: 'Quart.easeOut'
                });

                // Tween alpha
                PhaserScene.tweens.add({
                    targets: p,
                    alpha: 0,
                    duration: 1100,
                    ease: 'Quad.easeOut'
                });
            };

            // First pulse
            triggerOne(this.pulse, 625);

            // Second pulse 0.1s later
            PhaserScene.time.delayedCall(100, () => {
                triggerOne(this.pulse2, 563);
            });

            // Subtle screenshake
            if (typeof cameraManager !== 'undefined') {
                cameraManager.shake(120, 0.004);
            }
            // Play drum beat sound
            if (typeof audio !== 'undefined') {
                audio.play('drum_beat', 0.85);
            }
        };

        // Initial play
        playPulse();

        // Recurring pulse timer — every 2.4 seconds
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

class Boss1 extends Boss {
    constructor(levelScalingModifier = 1) {
        super(levelScalingModifier);
        this.model = new Boss1Model(levelScalingModifier);
        this.view = new Boss1View();
    }

    activate(x, y, scaleFactor = 1.0) {
        // Intended: Minibosses/Bosses do not scale with level progression
        const bossHealth = 200;

        super.activate(x, y, {
            maxHealth: bossHealth,
            damage: GAME_CONSTANTS.ENEMY_BASE_DAMAGE * 3, // Intended static damage
            selfDamage: 0,
            speed: GAME_CONSTANTS.ENEMY_BASE_SPEED * 0.8,
            initialSpeedMult: this.model.initialSpeedMult,
            rampDuration: this.model.rampDuration,
            size: this.model.size
        });

        PhaserScene.time.delayedCall(1000, () => {
            messageBus.publish('AnnounceText', t('ui', 'boss_1_name'));
        });
    }
}
