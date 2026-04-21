// js/enemies/bossCircle.js — Phase 1 alternative boss (MVC). Boss1.
// Spawns when wave progress reaches 100%.

const BOSS_CIRCLE_STATE = {
    MOVING: 'moving',
    SLOWING: 'slowing',
    ROTATING: 'rotating',
    WAITING: 'waiting',
    ATTACKING: 'attacking',
    STAYING: 'staying',
    RETRACTING: 'retracting',
    COOLDOWN: 'cooldown',
    ANTICIPATING: 'anticipating'
};

class BossCircleModel extends BossModel {
    constructor(levelScalingModifier = 1) {
        super(levelScalingModifier);
        this.initialSpeedMult = 5.5;
        this.rampDuration = 2.1;
        this.size = 168;
        this.bossId = 'bossCircle';

        // Custom behavior state
        this.behaviorState = BOSS_CIRCLE_STATE.MOVING;
        this.rotationOffset = 0;
        this.visualOffset = 0; // offset along the rotation axis
        this.stateTimer = 0;
        this.baseSpeedFactor = 1.0;
        this.rotationStarted = false;
        this.rotationFinished = false;
    }

    getSpawnDistanceOffset() {
        return 40;
    }

    activate(x, y, config = {}) {
        super.activate(x, y, config);
        this.behaviorState = BOSS_CIRCLE_STATE.MOVING;
        this.rotationOffset = 0;
        this.visualOffset = 0;
        this.stateTimer = 0;
        this.baseSpeedFactor = 1.0;
        this.rotationStarted = false;
        this.rotationFinished = false;
        this.isAttacking = false; // Bug 2: ensure never left stuck from prior use
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
                p.setScale(0.44);
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

    syncPosition(x, y, rotation, visualOffset) {
        // We override syncPosition to handle visual offset
        const dx = Math.cos(rotation) * visualOffset;
        const dy = Math.sin(rotation) * visualOffset;

        if (this.img) this.img.setPosition(x + dx, y + dy);
        if (this.hpImg) this.hpImg.setPosition(x + dx, y + dy);
        if (this.enemyGlow) this.enemyGlow.setPosition(x + dx, y + dy);

        // Pulses stay at base position
        if (this.pulse) this.pulse.setPosition(x, y);
        if (this.pulse2) this.pulse2.setPosition(x, y);
    }

    setRotation(rot) {
        super.setRotation(rot);
        // Sync pulses rotation too
        if (this.pulse) this.pulse.setRotation(rot);
        if (this.pulse2) this.pulse2.setRotation(rot);
    }

    deactivate() {
        super.deactivate();
        // Bug 5: kill any in-progress model tweens (rotation / visualOffset)
        PhaserScene.tweens.killTweensOf(this.pulse);
        PhaserScene.tweens.killTweensOf(this.pulse2);
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

    deactivate() {
        // Bug 5: kill any in-flight tweens targeting the model (rotation, visualOffset)
        PhaserScene.tweens.killTweensOf(this.model);
        super.deactivate();
    }

    activate(x, y, scaleFactor = 1.0) {
        const bossHealth = 255;

        super.activate(x, y, {
            maxHealth: bossHealth,
            damage: 25,
            selfDamage: 0,
            speed: GAME_CONSTANTS.ENEMY_BASE_SPEED * 0.95,
            initialSpeedMult: this.model.initialSpeedMult,
            rampDuration: this.model.rampDuration,
            size: this.model.size
        });

        // Ensure we re-initialize move state
        this.model.behaviorState = BOSS_CIRCLE_STATE.MOVING;
        this.model.rotationOffset = 0;
        this.model.visualOffset = 0;
        this.model.rotationStarted = false;
        this.model.rotationFinished = false;

        PhaserScene.time.delayedCall(1000, () => {
            messageBus.publish('BossAnnounceText', { msg1: t('ui', 'boss_prefix'), msg2: t('ui', 'bossCircle_name') });
        });
    }

    update(dt) {
        if (!this.model.alive) return;

        const tPos = tower.getPosition();
        const tx = tPos.x;
        const ty = tPos.y;
        const dx = tx - this.model.x;
        const dy = ty - this.model.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Keep rotation aimed at target even as we move
        if (!this.model.isAttacking) {
            this.model.baseRotation = Math.atan2(dy, dx);
        }

        // State Machine
        switch (this.model.behaviorState) {
            case BOSS_CIRCLE_STATE.MOVING:
                if (dist < 340) {
                    this.model.behaviorState = BOSS_CIRCLE_STATE.SLOWING;
                }
                break;

            case BOSS_CIRCLE_STATE.SLOWING:
                // When we enter slowing at 340, start rotating immediately
                if (!this.model.rotationStarted) {
                    this.model.rotationStarted = true;
                    if (typeof audio !== 'undefined') {
                        audio.play('creak_turn_bosscircle', 1.1);
                    }
                    PhaserScene.tweens.add({
                        targets: this.model,
                        rotationOffset: Math.PI,
                        duration: 7000,
                        ease: 'Quad.easeInOut',
                        onComplete: () => {
                            this.model.rotationFinished = true;
                        }
                    });
                }

                // If rotation is finished, we don't care about distance anymore - proceed to attack sequence
                if (this.model.rotationFinished) {
                    this.model.baseSpeedFactor = 0;
                    this.model.vx = 0;
                    this.model.vy = 0;
                    this.model.isAttacking = true;
                    this.model.behaviorState = BOSS_CIRCLE_STATE.WAITING;
                    this.model.stateTimer = 0.4;
                    if (typeof audio !== 'undefined') {
                        audio.play('three_taps', 0.9);
                    }
                }
                // If we reach the stopping point but are still turning, stop moving and wait
                else if (dist <= 225) {
                    this.model.baseSpeedFactor = 0;
                    this.model.vx = 0;
                    this.model.vy = 0;
                    this.model.isAttacking = true;
                    this.model.behaviorState = BOSS_CIRCLE_STATE.ROTATING;
                } else {
                    const progress = Phaser.Math.Clamp((340 - dist) / (340 - 200), 0, 1);
                    this.model.baseSpeedFactor = 1.0 - (progress * 0.9);
                }
                break;

            case BOSS_CIRCLE_STATE.ROTATING:
                // Just wait for rotation to finish
                if (this.model.rotationFinished) {
                    this.model.behaviorState = BOSS_CIRCLE_STATE.WAITING;
                    this.model.stateTimer = 0.1;
                }
                break;
        }

        // Handle standard burn/timers but block base movement if stopped
        const tickAmt = this.model.update(dt);
        if (tickAmt > 0 && typeof enemyManager !== 'undefined') {
            enemyManager.damageEnemy(this, tickAmt, 'burn');
        }

        // Apply our custom movement factor if we are slowing down but not yet stopped at 220
        if (this.model.behaviorState === BOSS_CIRCLE_STATE.SLOWING && this.model.baseSpeedFactor < 1.0) {
            const moveMultBase = this.model.forceSlowMult * (this.model.hitStopTimer > 0 ? 0.14 : 1.0);
            // model.update already moved by full speed. We subtract the surplus.
            const surplusRatio = 1.0 - this.model.baseSpeedFactor;
            this.model.x -= this.model.vx * dt * moveMultBase * surplusRatio;
            this.model.y -= this.model.vy * dt * moveMultBase * surplusRatio;
        }

        // Handle Timers
        if (this.model.stateTimer > 0) {
            this.model.stateTimer -= dt;
            if (this.model.stateTimer <= 0) {
                this._onTimerExpired();
            }
        }

        // Update View
        // Lunge always moves toward the center (tower), so use baseRotation for the offset,
        // even though the sprite itself is rotated 180 degrees (totalRot).
        const totalRot = this.model.baseRotation + this.model.rotationOffset;
        this.view.syncPosition(this.model.x, this.model.y, this.model.baseRotation, this.model.visualOffset);
        this.view.updateHPCrop(this.model.getHealthPct());
        this.view.setRotation(totalRot);
        this.view.update(dt, this.model);
    }

    _onTimerExpired() {
        switch (this.model.behaviorState) {
            case BOSS_CIRCLE_STATE.WAITING:
                this._startAttack();
                break;
            case BOSS_CIRCLE_STATE.STAYING:
                this._retract();
                break;
            case BOSS_CIRCLE_STATE.COOLDOWN:
                this.model.behaviorState = BOSS_CIRCLE_STATE.WAITING;
                this.model.stateTimer = 0.01; // trigger immediately
                break;
        }
    }

    _startAttack() {
        this.model.behaviorState = BOSS_CIRCLE_STATE.ANTICIPATING;

        // Step 1: Back off 25 units (visual only) over 600ms
        PhaserScene.tweens.add({
            targets: this.model,
            visualOffset: -18,
            duration: 1200,
            ease: 'Quint.easeInOut',
            completeDelay: 400,
            onComplete: () => {
                this.model.behaviorState = BOSS_CIRCLE_STATE.ATTACKING;

                // Step 2: Charge in reaching 142 units from player
                const tx = GAME_CONSTANTS.halfWidth;
                const ty = GAME_CONSTANTS.halfHeight;
                const dx = tx - this.model.x;
                const dy = ty - this.model.y;
                const currentDist = Math.sqrt(dx * dx + dy * dy);
                const targetOffset = Math.max(0, currentDist - 142);

                PhaserScene.tweens.add({
                    targets: this.model,
                    visualOffset: targetOffset,
                    duration: 650,
                    ease: 'Quint.easeIn',
                    onComplete: () => {
                        // Deal 25 damage
                        if (typeof tower !== 'undefined') {
                            tower.takeDamage(25);
                            cameraManager.shake(400, 0.02);
                            // if (typeof audio !== 'undefined') audio.play('explosion_large', 0.8);
                        }

                        this.model.behaviorState = BOSS_CIRCLE_STATE.STAYING;
                        this.model.stateTimer = 0.5;
                    }
                });
            }
        });
    }

    _retract() {
        this.model.behaviorState = BOSS_CIRCLE_STATE.RETRACTING;

        PhaserScene.tweens.add({
            targets: this.model,
            visualOffset: 0,
            duration: 750,
            ease: 'Cubic.easeInOut',
            onComplete: () => {
                this.model.behaviorState = BOSS_CIRCLE_STATE.COOLDOWN;
                this.model.stateTimer = 1.5;
            }
        });
    }
}
