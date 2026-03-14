// js/enemies/boss_1.js — Phase 1 boss (MVC).
// Spawns when wave progress reaches 100%.
// Starts moving very fast (7x speed) and slows down linearly to default (0.75x speed) over 1.25s.
// High health. On defeat, triggers a special sequence that kills all enemies and vacuums drops.

class Boss1Model extends BossModel {
    constructor() {
        super();
        this.initialSpeedMult = 7.0;
        this.rampDuration = 1.3;
        this.size = 120;
    }
}

class Boss1View extends EnemyView {
    constructor() {
        const baseDepth = GAME_CONSTANTS.DEPTH_ENEMIES - 1;
        super(Enemy.TEX_KEY, 'boss_1.png', 'boss_hp.png', baseDepth);

        // Add pink pulse nineslice — corner size 65px
        // Phaser 3.60+ nineslice: (x, y, texture, frame, width, height, left, right, top, bottom)
        this.pulse = PhaserScene.add.nineslice(0, 0, Enemy.TEX_KEY, 'pink_pulse.png', 265, 265, 65, 65, 65, 65);
        this.pulse.setDepth(baseDepth - 1);
        this.pulse.setVisible(false);
        this.pulse.setAlpha(0);

        this.pulseTimer = null;
    }

    activate(x, y, rotation, cannotRotate) {
        super.activate(x, y, rotation, cannotRotate);

        if (this.pulse) {
            this.pulse.setPosition(x, y);
            this.pulse.setVisible(true);
            this.pulse.setAlpha(0);
            this.pulse.setRotation(rotation);
            this.pulse.width = 265;
            this.pulse.height = 265;

            this._startPulseEffect();
        }
    }

    _startPulseEffect() {
        const playPulse = () => {
            if (!this.pulse || !this.pulse.scene) return;

            // Reset state
            this.pulse.width = 270;
            this.pulse.height = 270;
            // Subtle screenshake
            if (typeof cameraManager !== 'undefined') {
                cameraManager.shake(120, 0.004);
            }
            // Play drum beat sound
            if (typeof audio !== 'undefined') {
                audio.play('drum_beat', 0.85);
            }
            this.pulse.setAlpha(1);
            // Tween size to 400 over 1s (Cubic.easeOut)
            PhaserScene.tweens.add({
                targets: this.pulse,
                width: 480,
                height: 480,
                duration: 1100,
                ease: 'Quart.easeOut'
            });

            // Tween alpha to 0 over 1s (Linear)
            PhaserScene.tweens.add({
                targets: this.pulse,
                alpha: 0,
                duration: 1100,
                ease: 'Quad.easeOut'
            });
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
    }
}

class Boss1 extends Boss {
    constructor() {
        super();
        this.model = new Boss1Model();
        this.view = new Boss1View();
    }

    activate(x, y, scaleFactor = 1.0) {
        const bossHealth = 150;

        super.activate(x, y, {
            maxHealth: bossHealth,
            damage: GAME_CONSTANTS.ENEMY_BASE_DAMAGE * 3,
            selfDamage: 0,
            speed: GAME_CONSTANTS.ENEMY_BASE_SPEED * 0.75,
            size: this.model.size
        });

        // Speed ramp state
        this.model.baseSpeed = this.model.speed;
        this.model.aliveTime = 0;
        this.model.speedMult = this.model.initialSpeedMult;
        this.model._applyAimedVelocity();
    }
}
