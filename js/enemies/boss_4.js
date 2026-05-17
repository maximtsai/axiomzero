// js/enemies/boss_4.js — Boss 4 (EXECUTE).
// A relentless, high-precision entity that focuses on single-target neutralization.

const BOSS_4_STATE = {
    ARRIVING: 'arriving',
    AIMING: 'aiming',
    TWEENING: 'tweening'
};

class Boss4Model extends BossModel {
    constructor(levelScalingModifier = 1) {
        super(levelScalingModifier);
        this.bossId = 'boss4';
        this.type = 'boss4';
        this.size = 115;
        this.initialSpeedMult = 6.5;
        this.rampDuration = 2.0;

        this.behaviorState = BOSS_4_STATE.ARRIVING;
        this.stateTimer = 0;
        this.chargeProgress = 0;

        this.arrivalTargetX = 0;
        this.arrivalTargetY = 0;
        this.autoUpdateTraceCrop = false;
        this.flashLine = false;
    }

    getSpawnDistanceOffset() {
        return 0;
    }

    getSpawnAngle() {
        // Limited angle similar to Boss 5: Spawn from West (PI) or East (0) with small variance
        const halfCone = (5 / 2) * (Math.PI / 180); // 2.5 degrees either way
        const side = Math.random() < 0.5 ? 0 : Math.PI;
        const offset = (Math.random() * 2 - 1) * halfCone;
        return side + offset;
    }

    activate(x, y, config = {}) {
        // Boss 4 doesn't deal contact damage or self-damage on impact
        super.activate(x, y, {
            ...config,
            damage: 0,
            selfDamage: 0
        });

        // Target positions: x = 175 or x = halfWidth - 175 (625)
        const t1 = 175;
        const t2 = GAME_CONSTANTS.halfWidth - 175;
        this.arrivalTargetX = (Math.abs(x - t1) < Math.abs(x - t2)) ? t1 : t2;
        this.arrivalTargetY = GAME_CONSTANTS.halfHeight;

        this.behaviorState = BOSS_4_STATE.ARRIVING;
        this.autoUpdateTraceCrop = false;

        // Lock in the initial velocity toward the arrival target
        this.aimAt(this.arrivalTargetX, this.arrivalTargetY);
    }

    update(dt) {
        // If arriving or aiming, we override the default "aim at center" logic
        if (this.behaviorState === BOSS_4_STATE.ARRIVING || this.behaviorState === BOSS_4_STATE.AIMING) {
            this.aliveTime += dt;

            // Speed ramp logic (without re-aiming at center)
            if (this.rampDuration > 0) {
                if (this.aliveTime < this.rampDuration) {
                    const progress = Math.min(1.0, this.aliveTime / this.rampDuration);
                    this.speedMult = this.initialSpeedMult + ((1.0 - this.initialSpeedMult) * progress);
                } else {
                    this.speedMult = 1.0;
                }
            }

            // During ARRIVING, we actively re-aim to stay on track
            if (this.behaviorState === BOSS_4_STATE.ARRIVING) {
                this.aimAt(this.arrivalTargetX, this.arrivalTargetY);
            }

            // Movement
            if (!this.stunned && !this.isAttacking) {
                let moveMult = this.forceSlowMult;
                if (this.hitStopTimer > 0) {
                    moveMult *= 0.1;
                    this.hitStopTimer -= dt;
                }
                const globalSpeed = (typeof GAME_VARS !== 'undefined') ? GAME_VARS.enemySpeedMultiplier : 1;
                const levelSpeed = (typeof GAME_VARS !== 'undefined') ? GAME_VARS.levelSpeedMultiplier : 1;
                this.x += this.vx * dt * moveMult * globalSpeed * levelSpeed;
                this.y += this.vy * dt * moveMult * globalSpeed * levelSpeed;
            }

            // Burn logic etc.
            return this._updateCommon(dt);
        }

        return super.update(dt);
    }

    /** Helper to run common update logic (timers, burn) without movement. */
    _updateCommon(dt) {
        if (this.forceSlowTimer > 0) {
            this.forceSlowTimer -= dt;
            if (this.forceSlowTimer <= 0) {
                this.forceSlowMult = 1.0;
                this.forceSlowTimer = 0;
            }
        }
        if (this.attackTimer > 0) this.attackTimer -= dt;

        let burnTick = 0;
        if (this.burnDuration > 0) {
            this.burnDuration -= dt;
            this.burnTimer += dt;
            if (this.burnTimer >= 1.0) {
                this.burnTimer -= 1.0;
                burnTick = this.burnDamage;
            }
            if (this.burnDuration <= 0) {
                this.burnDuration = 0;
                this.burnTimer = 0;
            }
        }
        return burnTick;
    }
}

class Boss4View extends EnemyView {
    constructor() {
        const baseDepth = GAME_CONSTANTS.DEPTH_ENEMIES - 2;
        // High-precision EXECUTE assets
        super('bosses', 'boss_4.png', 'boss_4_hp.png', baseDepth);

        // Placeholder for core glow (could use a pixel or existing frame)
        this.coreGlow = PhaserScene.add.image(0, 0, 'bosses', 'boss_3_charge.png');
        this.coreGlow.setDepth(baseDepth + 1);
        this.coreGlow.setVisible(false);
        this.coreGlow.setAlpha(0);
        this.coreGlow.setTint(0xff0000);

        // Tracing line sprite
        this.tracingLine = PhaserScene.add.image(0, 0, 'bosses', 'tracing_line.png');
        this.tracingLine.setOrigin(0, 0.5);
        this.tracingLine.setVisible(false);
        this.tracingLine.setAlpha(0);
        this.tracingLine.setDepth(baseDepth - 1);
    }

    update(dt, model) {
        super.update(dt, model);

        // Standard cleanup (unneeded states removed)
        this.img.clearTint();
        this.coreGlow.setVisible(false);
    }

    syncPosition(x, y) {
        super.syncPosition(x, y);
        if (this.coreGlow) this.coreGlow.setPosition(x, y);
        // Tracing line follows the boss
        if (this.tracingLine && this.tracingLine.visible) {
            this.tracingLine.setPosition(x, y);
        }
    }

    deactivate() {
        super.deactivate();
        if (this.coreGlow) this.coreGlow.setVisible(false);
        if (this.tracingLine) {
            PhaserScene.tweens.killTweensOf(this.tracingLine);
            this.tracingLine.setVisible(false);
            this.tracingLine.setAlpha(0);
        }
    }
}

class Boss4 extends Boss {
    constructor(levelScalingModifier = 1) {
        super(levelScalingModifier);
        this.model = new Boss4Model(levelScalingModifier);
        this.view = new Boss4View();
    }

    activate(x, y, scale = 1.0, config = {}) {
        const bossHealth = 1000;

        super.activate(x, y, {
            maxHealth: bossHealth,
            damage: 0, // No contact damage
            selfDamage: 0, // No self-damage on impact
            speed: GAME_CONSTANTS.ENEMY_BASE_SPEED * 1.15,
            initialSpeedMult: this.model.initialSpeedMult,
            rampDuration: this.model.rampDuration,
            size: this.model.size,
            ...config
        });

        // Fix 5: Target positions: x = 175 or x = WIDTH - 175
        const t1 = 175;
        const t2 = (GAME_CONSTANTS.WIDTH || 1600) - 175;
        this.model.arrivalTargetX = (Math.abs(x - t1) < Math.abs(x - t2)) ? t1 : t2;
        this.model.arrivalTargetY = GAME_CONSTANTS.halfHeight;

        // Warcry 0.75s after spawn
        PhaserScene.time.delayedCall(750, () => {
            if (this.model.alive && typeof audio !== 'undefined') {
                audio.play('quitebeat', 1.0);
            }
        });

        PhaserScene.time.delayedCall(1000, () => {
            if (this.model.alive) {
                messageBus.publish('BossAnnounceText', { msg1: t('ui', 'boss_prefix'), msg2: t('ui', 'boss_4_name') });
            }
        });
    }

    deactivate() {
        // Fix 6: Kill tweens before super.deactivate()
        if (PhaserScene.tweens) {
            PhaserScene.tweens.killTweensOf(this.model);
        }
        this.model.flashLine = false;
        super.deactivate();
    }

    update(dt) {
        if (!this.model.alive) return;

        // State Machine
        switch (this.model.behaviorState) {
            case BOSS_4_STATE.ARRIVING:
                const dx = this.model.arrivalTargetX - this.model.x;
                const dy = this.model.arrivalTargetY - this.model.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < 30) {
                    this.model.behaviorState = BOSS_4_STATE.AIMING;

                    // Slow down velocity to 0 over 750ms
                    PhaserScene.tweens.add({
                        targets: this.model,
                        vx: 0,
                        vy: 0,
                        duration: 750,
                        ease: 'Quad.easeOut'
                    });

                    // Rotate toward tower over 750ms
                    const tPos = tower.getPosition();
                    const targetAngle = Math.atan2(tPos.y - this.model.y, tPos.x - this.model.x);

                    let currentAngle = this.model.baseRotation;
                    let angleDiff = targetAngle - currentAngle;
                    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
                    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;

                    PhaserScene.tweens.add({
                        targets: this.model,
                        baseRotation: currentAngle + angleDiff,
                        duration: 750,
                        ease: 'Quad.easeInOut',
                        onComplete: () => {
                            // Fix 1: Guard onComplete
                            if (!this.model.alive) return;

                            this.model.behaviorState = BOSS_4_STATE.TWEENING;
                            this.model.vx = 0;
                            this.model.vy = 0;

                            // Setup tracing line
                            if (this.view.tracingLine) {
                                const tl = this.view.tracingLine;
                                tl.setVisible(true);
                                tl.setAlpha(0.6);
                                tl.setPosition(this.model.x, this.model.y);
                                tl.setRotation(this.model.baseRotation);
                                // Completely cropped: set width to 0
                                tl.setCrop(0, 0, 0, tl.height);

                                this.tweenTraceLine();
                            }
                        }
                    });
                }
                break;

            case BOSS_4_STATE.AIMING:
                // Logic handled by tweens initiated in ARRIVING transition
                break;

            case BOSS_4_STATE.TWEENING:
                const tl = this.view.tracingLine;
                // Auto-update crop if enabled
                if (this.model.autoUpdateTraceCrop) {
                    if (tl && tl.visible) {
                        const tPos = tower.getPosition();
                        const d = Phaser.Math.Distance.Between(this.model.x, this.model.y, tPos.x, tPos.y);
                        tl.setCrop(0, 0, d, tl.height);
                    }
                }

                // Rapidly pingpong alpha if flashLine is true
                if (this.model.flashLine && tl) {
                    // Oscillation between 0.3 and 1.0
                    const alpha = 0.65 + 0.35 * Math.sin(PhaserScene.time.now * 0.05);
                    tl.setAlpha(alpha);
                } else if (tl && tl.alpha !== 0.6 && this.model.autoUpdateTraceCrop) {
                    // Reset to default alpha if not flashing
                    tl.setAlpha(0.6);
                }
                break;
        }

        super.update(dt);
    }

    tweenTraceLine() {
        const tl = this.view.tracingLine;
        if (!tl) return;

        const tPos = tower.getPosition();
        const dist = Phaser.Math.Distance.Between(this.model.x, this.model.y, tPos.x, tPos.y);
        const maxLineLen = 750;
        const targetLen = Math.min(maxLineLen, dist);

        tl.currentCropWidth = 0;
        PhaserScene.tweens.add({
            targets: tl,
            currentCropWidth: targetLen,
            duration: 2000,
            ease: 'Cubic.easeOut',
            onUpdate: () => {
                if (tl && tl.scene && !this.model.autoUpdateTraceCrop) {
                    tl.setCrop(0, 0, tl.currentCropWidth, tl.height);
                }
            },
            onComplete: () => {
                // Fix 1: Guard onComplete
                if (!this.model.alive) return;

                this.model.autoUpdateTraceCrop = true;
                this.slowForward();
            }
        });
    }

    slowForward() {
        if (!this.model.alive) return;

        // Fix 3: Refresh angle for the second stage of lurch
        const angle2 = this.model.baseRotation;
        const dist2 = 32;
        const targetX2 = this.model.x + Math.cos(angle2) * dist2;
        const targetY2 = this.model.y + Math.sin(angle2) * dist2;

        PhaserScene.tweens.add({
            targets: this.model,
            x: targetX2,
            y: targetY2,
            duration: 1600,
            ease: 'Back.easeIn',
            easeParams: [3],
            onComplete: () => {
                // Fix 1: Guard onComplete
                if (!this.model.alive) return;
                this.rocketForward();
            }
        });
    }

    rocketForward() {
        const tPos = tower.getPosition();
        const dx = this.model.x - tPos.x;
        const dy = this.model.y - tPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Fix 7: Prevent division by zero
        if (dist < 1) {
            this.impactAttack();
            return;
        }

        // Target is 100 units away from the tower along the line between boss and tower
        const targetX = tPos.x + (dx / dist) * 125;
        const targetY = tPos.y + (dy / dist) * 125;

        this.model.flashLine = true;

        PhaserScene.tweens.add({
            targets: this.model,
            x: targetX,
            y: targetY,
            duration: 600,
            ease: 'Quart.easeIn',
            onComplete: () => {
                // Fix 1: Guard onComplete
                if (!this.model.alive) return;
                this.model.flashLine = false;
                this.impactAttack();
            }
        });
    }

    impactAttack() {
        if (typeof tower !== 'undefined' && tower.isAlive()) {
            tower.takeDamage(20);
        }

        // Briefly slow down time using built-in timeManager
        if (typeof timeManager !== 'undefined') {
            timeManager.setTempPause(200, 0.05);
        }

        // Add a lot of screen shake and a zoom pulse
        if (typeof cameraManager !== 'undefined') {
            cameraManager.shake(600, 0.02);
        }
        if (typeof zoomShake !== 'undefined') {
            zoomShake(1.02);
        }

        // Slow grinding movement forward (10px over 1000ms)
        const angle = this.model.baseRotation;
        PhaserScene.tweens.add({
            targets: this.model,
            x: this.model.x + Math.cos(angle) * 10,
            y: this.model.y + Math.sin(angle) * 10,
            duration: 1000,
            ease: 'Quad.easeOut',
            onComplete: () => {
                // Fix 1: Guard onComplete
                if (!this.model.alive) return;
                this.pullOut();
            }
        });
    }

    pullOut() {
        // Fix 3: Refresh angle
        const angle = this.model.baseRotation;

        // Stage 1: Move back 15 units over 1000ms (unsticking phase)
        const targetX1 = this.model.x - Math.cos(angle) * 15;
        const targetY1 = this.model.y - Math.sin(angle) * 15;

        PhaserScene.tweens.add({
            targets: this.model,
            x: targetX1,
            y: targetY1,
            duration: 1000,
            ease: 'Quad.easeIn',
            onComplete: () => {
                // Fix 1: Guard onComplete
                if (!this.model.alive) return;

                // Fix 3: Refresh angle
                const angle2 = this.model.baseRotation;
                // Stage 2: Move back another 20 units over 300ms with Back.easeOut
                const targetX2 = this.model.x - Math.cos(angle2) * 20;
                const targetY2 = this.model.y - Math.sin(angle2) * 20;

                PhaserScene.tweens.add({
                    targets: this.model,
                    x: targetX2,
                    y: targetY2,
                    duration: 300,
                    ease: 'Back.easeOut',
                    onComplete: () => {
                        // Fix 1: Guard onComplete
                        if (!this.model.alive) return;
                        this.pullBack();
                    }
                });
            }
        });
    }

    pullBack() {
        PhaserScene.tweens.add({
            targets: this.model,
            x: this.model.arrivalTargetX,
            y: this.model.arrivalTargetY,
            duration: 7500,
            ease: 'Cubic.easeInOut',
            onComplete: () => {
                // Fix 1: Guard onComplete
                if (!this.model.alive) return;
                this.prepAttack();
            }
        });
    }

    prepAttack() {
        // Fix 3: Refresh angle
        const angle = this.model.baseRotation;
        const targetX = this.model.x - Math.cos(angle) * 1;
        const targetY = this.model.y - Math.sin(angle) * 1;

        PhaserScene.tweens.add({
            targets: this.model,
            x: targetX,
            y: targetY,
            duration: 100,
            ease: 'Linear',
            onComplete: () => {
                // Fix 1: Guard onComplete
                if (!this.model.alive) return;
                this.slowForward();
            }
        });
    }
}
