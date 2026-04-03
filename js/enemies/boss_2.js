// js/enemies/boss_2.js — Phase 2 boss (MVC).
// Spawns when wave progress reaches 100% on Level 2.
// Moves 3.0x as fast as a basic enemy and has a similar starting speed boost to Boss 1.
// 200 base health.

const BOSS_2_STATES = {
    TRAVEL: 'travel',
    CIRCLING: 'circling',
    SETUP: 'setup',
    AIMING: 'aiming',
    BOMBARD: 'bombard'
};

class Boss2Model extends BossModel {
    constructor(levelScalingModifier = 1) {
        super(levelScalingModifier);
        this.initialSpeedMult = 4.5; // Same burst of speed as Boss 1
        this.rampDuration = 1.5;
        this.size = 60;
        this.bossId = 'boss2';

        this.state = BOSS_2_STATES.TRAVEL;
        this.maxRotationSpeed = 0.6; // Radians per second, give it some "weight"
        this.currentMoveRotation = 0;
        this.pastRotationChange = 0;

        // Attack timers
        this.circlingTime = 0;
        this.attackCooldown = 0;
        this.projectileDamage = 4.5;

        // SETUP state
        this.attackCount = 0;      // attacks fired while circling
        this.setupDelay = 0;       // 1.5 s countdown before movement begins
        this.setupTarget = null;   // { x, y } chosen flank position

        // AIMING stage
        this.turretRotation = 0;
        this.maxTurretRotationSpeed = 1; // Radians per second

        // BOMBARD stage
        this.bombardTimer = 0;
        this.spawnCount = 0;
        this.spawnTimer = 0;
        this.barrageCount = 0;
    }

    activate(x, y, config = {}) {
        super.activate(x, y, config);
        this.state = BOSS_2_STATES.TRAVEL;
        this.circlingTime = 0;
        this.attackCooldown = 0;
        this.projectileDamage = config.projectileDamage || 4.5;
        this.attackCount = 0;
        this.setupDelay = 0;
        this.setupTarget = null;
        this.turretRotation = this.baseRotation;
        this.bombardTimer = 0;
        this.spawnCount = 0;
        this.spawnTimer = 0;
        this.barrageCount = 0;

        // Initial rotation towards tower
        const dx = GAME_CONSTANTS.halfWidth - x;
        const dy = GAME_CONSTANTS.halfHeight - y;
        this.currentMoveRotation = Math.atan2(dy, dx);
        this.baseRotation = this.currentMoveRotation;
    }

    update(dt) {
        const burnTick = super.update(dt);
        if (!this.alive || this.stunned || this.isAttacking) return burnTick;

        const getDiff = (a, b) => {
            let d = a - b;
            while (d > Math.PI) d -= Math.PI * 2;
            while (d < -Math.PI) d += Math.PI * 2;
            return d;
        };

        const rotateTowards = (current, target, maxChange) => {
            const diff = getDiff(target, current);

            // Snap directly to target if distance is tiny
            if (Math.abs(diff) < 0.02) return target;

            // Arrival Smoothing: move a fraction (20%) of the way each frame
            // This naturally eases out the rotation as we get closer to the target.
            const smoothedStep = diff * 0.20;
            let rotationChange = Phaser.Math.Clamp(smoothedStep, -maxChange, maxChange);
            rotationChange = this.pastRotationChange * 0.65 + rotationChange * 0.35;
            this.pastRotationChange = rotationChange;
            return current + rotationChange
        };

        const syncVelocity = (s) => {
            if (s !== undefined) this.speed = s;
            const effectiveSpeed = this.speed * this.speedMult;
            this.vx = Math.cos(this.currentMoveRotation) * effectiveSpeed;
            this.vy = Math.sin(this.currentMoveRotation) * effectiveSpeed;
        };

        // Update attack cooldown
        if (this.attackCooldown > 0) {
            this.attackCooldown -= dt;
        }

        const centerX = GAME_CONSTANTS.halfWidth;
        const centerY = GAME_CONSTANTS.halfHeight;
        const dx = this.x - centerX;
        const dy = this.y - centerY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (this.state === BOSS_2_STATES.TRAVEL) {
            // Rotate gradually towards the player
            const angleToTower = Math.atan2(-dy, -dx);
            this.currentMoveRotation = rotateTowards(this.currentMoveRotation, angleToTower, 0.6 * this.maxRotationSpeed * dt);
            this.baseRotation = this.currentMoveRotation;

            // Move directly towards tower (aimAt is already called by Enemy.update/ramp)
            if (dist < 370) {
                this.state = BOSS_2_STATES.CIRCLING;
                this.circlingTime = 0;
                this.attackCount = 0; // Reset circling attack count
                this.speed = GAME_CONSTANTS.ENEMY_BASE_SPEED * 1.6;
            } else {
                const targetSpeed = GAME_CONSTANTS.ENEMY_BASE_SPEED * 3.0;
                if (this.speed < targetSpeed) {
                    // Gradually accelerate towards 3x base speed
                    this.speed += 80 * dt;
                    if (this.speed > targetSpeed) this.speed = targetSpeed;
                }
            }

            // Sync velocity with speed and rotation to ensure movement continues
            syncVelocity();
        } else if (this.state === BOSS_2_STATES.CIRCLING) {
            this.circlingTime += dt;
            // 1. Calculate desired velocity vector
            const targetOrbitRadius = 270;

            // Tangent clockwise: (dy, -dx)
            // Radial towards center: (-dx, -dy)
            const tx = dy;
            const ty = -dx;
            const cx = -dx;
            const cy = -dy;

            // Blend tangent and radial based on current distance error
            // If we are at 450, radial factor is significant to pull us to 300.
            const distError = dist - targetOrbitRadius;
            const radialWeight = Phaser.Math.Clamp(distError / 100, -1, 1);

            const desiredVx = tx + cx * radialWeight;
            const desiredVy = ty + cy * radialWeight;
            const targetRotation = Math.atan2(desiredVy, desiredVx);

            // 2. Smoothly rotate currentMoveRotation towards targetRotation
            let diff = targetRotation - this.currentMoveRotation;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;

            this.currentMoveRotation = rotateTowards(this.currentMoveRotation, targetRotation, this.maxRotationSpeed * dt);
            this.baseRotation = this.currentMoveRotation;

            // 3. Update velocity based on current rotation and current speed
            syncVelocity();
        } else if (this.state === BOSS_2_STATES.SETUP) {
            if (this.setupDelay > 0) {
                // Drift with momentum — just let position update happen naturally
                this.setupDelay -= dt;

                // Choose flank target at the very end of the delay
                if (this.setupDelay <= 0 && this.setupTarget === null) {
                    this.setupDelay = 0;
                    this.speed = GAME_CONSTANTS.ENEMY_BASE_SPEED * 3.0; // Return to 3x speed
                    const futureX = this.x + this.vx * 3;
                    if (futureX < GAME_CONSTANTS.halfWidth) {
                        this.setupTarget = { x: 210, y: GAME_CONSTANTS.halfHeight };
                    } else {
                        this.setupTarget = { x: GAME_CONSTANTS.WIDTH - 210, y: GAME_CONSTANTS.halfHeight };
                    }
                }
            } else if (this.setupTarget !== null) {
                // Steer toward setup target using same weighted-rotation system
                const tdx = this.setupTarget.x - this.x;
                const tdy = this.setupTarget.y - this.y;
                const targetDist = Math.sqrt(tdx * tdx + tdy * tdy) || 1;

                if (targetDist < 100) {
                    this.state = BOSS_2_STATES.AIMING;
                } else {
                    // Normalize steering vector to ensure weights are consistent
                    let desiredVx = tdx / targetDist;
                    let desiredVy = tdy / targetDist;

                    // Tower avoidance: if within 250 units, add radial push outward
                    const avoidRadius = 250;
                    if (dist < avoidRadius) {
                        const pushStrength = Phaser.Math.Clamp((avoidRadius - dist) / avoidRadius, 0, 1);
                        // Radial push (dx, dy are already the center-to-boss vector)
                        desiredVx += (dx / (dist || 1)) * pushStrength * 3.0;
                        desiredVy += (dy / (dist || 1)) * pushStrength * 3.0;
                    }

                    const targetRotation = Math.atan2(desiredVy, desiredVx);
                    this.currentMoveRotation = rotateTowards(this.currentMoveRotation, targetRotation, this.maxRotationSpeed * dt);
                    this.baseRotation = this.currentMoveRotation;

                    syncVelocity();
                }
            }
        } else if (this.state === BOSS_2_STATES.AIMING) {
            // Speed steadily slows down
            const speedMag = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
            if (speedMag > 0) {
                const decel = 120 * dt;
                const newSpeed = Math.max(0, speedMag - decel);
                syncVelocity(newSpeed);
            }

            // Boss Rotation (perpendicular to tower)
            const angleToTowerCenter = Math.atan2(-dy, -dx);
            const opt1 = angleToTowerCenter + Math.PI / 2;
            const opt2 = angleToTowerCenter - Math.PI / 2;

            const targetBodyRot = Math.abs(getDiff(opt1, this.currentMoveRotation)) < Math.abs(getDiff(opt2, this.currentMoveRotation)) ? opt1 : opt2;
            this.currentMoveRotation = rotateTowards(this.currentMoveRotation, targetBodyRot, this.maxRotationSpeed * dt);
            this.baseRotation = this.currentMoveRotation;

            // Turret Rotation (slowly towards tower)
            let tChange = this.maxTurretRotationSpeed * dt;
            if (speedMag > 0.01) tChange *= 0.25;

            const tDiff = getDiff(angleToTowerCenter, this.turretRotation);
            if (Math.abs(tDiff) < 0.01) {
                this.turretRotation = angleToTowerCenter;
                this.state = BOSS_2_STATES.BOMBARD;
                this.bombardTimer = 2.0;
                this.spawnCount = 0;
                this.spawnTimer = 0;
                this.barrageCount = 0;
            } else {
                this.turretRotation = rotateTowards(this.turretRotation, angleToTowerCenter, tChange);
            }
        } else if (this.state === BOSS_2_STATES.BOMBARD) {
            // Decelerate if still moving
            const speedMag = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
            if (speedMag > 0) {
                const decel = 120 * dt;
                const newSpeed = Math.max(0, speedMag - decel);
                syncVelocity(newSpeed);
            }

            // Turret Rotation: Track tower normally, but realign with ship during the final delay
            const angleToTowerCenter = Math.atan2(-dy, -dx);
            const targetTurretRot = (this.barrageCount === 2) ? this.baseRotation : angleToTowerCenter;

            this.turretRotation = rotateTowards(this.turretRotation, targetTurretRot, this.maxTurretRotationSpeed * dt);

            if (this.bombardTimer > 0) {
                this.bombardTimer -= dt;
            } else {
                // Done spawning this barrage?
                if (this.spawnCount >= 1) {
                    if (this.barrageCount < 1) { // 1 barrage completed, we want 1 more
                        this.barrageCount++;
                        // 0.75 cooldown + 2s chargeup
                        this.bombardTimer = 2.75;
                        this.spawnCount = 0;
                        this.spawnTimer = 0;
                    } else if (this.barrageCount < 2) {
                        // Second barrage done, 1.9s pause before circling
                        // Turret will begin realigning here
                        this.barrageCount++;
                        this.bombardTimer = 1.9;
                    } else {
                        // Return to travel after all barrages and exit delay complete
                        this.state = BOSS_2_STATES.TRAVEL;
                    }
                }
            }
        }

        // Default: turret always follows boss unless in AIMING or BOMBARD phase
        if (this.state !== BOSS_2_STATES.AIMING && this.state !== BOSS_2_STATES.BOMBARD) {
            this.turretRotation = this.baseRotation;
        }

        return burnTick;
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

        // Charge-up visual logic (like Miniboss 1)
        this.chargeSprite = PhaserScene.add.image(0, 0, Enemy.TEX_KEY, 'chargeup.png');
        this.chargeSprite.setDepth(baseDepth + 2);
        this.chargeSprite.setVisible(false);

        // Optional pink pulse nineslice effect identical to Boss 1 (if standard for bosses)
        this.pulse = PhaserScene.add.nineslice(0, 0, Enemy.TEX_KEY, 'pink_pulse.png', 199, 199, 65, 65, 65, 65);
        this.pulse.setDepth(baseDepth - 1);
        this.pulse.setVisible(false);
        this.pulse.setAlpha(0);

        this.pulse2 = PhaserScene.add.nineslice(0, 0, Enemy.TEX_KEY, 'pink_pulse.png', 219, 219, 65, 65, 65, 65);
        this.pulse2.setDepth(baseDepth - 1);
        this.pulse2.setVisible(false);
        this.pulse2.setAlpha(0);

        this.pulseTimer = null;

        // Pooled launch effects
        this._launchEffectPool = new ObjectPool(
            () => {
                const spr = PhaserScene.add.sprite(0, 0, 'attacks', 'enemy_hit_circle1.png');
                spr.setDepth(GAME_CONSTANTS.DEPTH_ENEMIES + 4);
                spr.setVisible(false);
                spr.setActive(false);
                return spr;
            },
            (spr) => {
                spr.setVisible(false);
                spr.setActive(false);
            },
            2
        ).preAllocate(2);
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
            this.pulse.width = 199;
            this.pulse.height = 199;

            this.pulse2.setPosition(x, y);
            this.pulse2.setVisible(true);
            this.pulse2.setAlpha(0);
            this.pulse2.width = 215;
            this.pulse2.height = 215;

            this._startPulseEffect();
        }
    }

    _startPulseEffect() {
        const playPulse = () => {
            if (!this.pulse || !this.pulse.scene) return;

            const currentRotation = this.img.rotation;
            this.pulse.setRotation(currentRotation + Math.PI / 4);
            this.pulse2.setRotation(currentRotation + Math.PI / 4);

            const triggerOne = (p, finalSize) => {
                if (!p || !p.scene) return;
                p.width = 203;
                p.height = 203;
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

            triggerOne(this.pulse, 440);

            PhaserScene.time.delayedCall(100, () => {
                triggerOne(this.pulse2, 360);
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

    setTurretRotation(rot) {
        if (this.turret) this.turret.setRotation(rot);
    }

    startCharge() {
        if (!this.chargeSprite) return;
        this.chargeSprite.setVisible(true);
        this.chargeSprite.setScale(0.28);
        this.chargeSprite.setAlpha(1);

        PhaserScene.tweens.killTweensOf(this.chargeSprite);

        // 1.4x scale relative to Miniboss 1 (0.2 -> 0.28, 1.1 -> 1.54, 0.4 -> 0.56, 1.2 -> 1.68)
        PhaserScene.tweens.add({
            targets: this.chargeSprite,
            scale: 1.54,
            duration: 250,
            ease: 'Quad.easeIn',
            onComplete: () => {
                if (!this.chargeSprite.visible) return;
                PhaserScene.tweens.add({
                    targets: this.chargeSprite,
                    scale: 0.56,
                    alpha: 0.7,
                    duration: 350,
                    ease: 'Quad.easeOut',
                    onComplete: () => {
                        if (!this.chargeSprite.visible) return;
                        PhaserScene.tweens.add({
                            targets: this.chargeSprite,
                            scale: 1.68,
                            alpha: 1,
                            duration: 1400, // Total 2000ms chargeup check in controller
                            ease: 'Linear',
                            onComplete: () => {
                                if (!this.chargeSprite.visible) return;
                                this.chargeSprite.setScale(1.96);
                                this.chargeSprite.setAlpha(1);
                            }
                        });
                    }
                });
            }
        });
    }

    stopCharge() {
        if (this.chargeSprite) {
            this.chargeSprite.setVisible(false);
            PhaserScene.tweens.killTweensOf(this.chargeSprite);
        }
    }

    syncChargePosition(x, y, turretRot) {
        if (!this.chargeSprite || !this.chargeSprite.visible) return;
        const nozzleDist = 135; // Unified nozzle distance
        this.chargeSprite.setPosition(
            x + Math.cos(turretRot) * nozzleDist,
            y + Math.sin(turretRot) * nozzleDist
        );
        this.chargeSprite.setRotation(turretRot);
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
        if (this.chargeSprite) {
            this.chargeSprite.setVisible(false);
            PhaserScene.tweens.killTweensOf(this.chargeSprite);
        }
        if (this.pulse) {
            this.pulse.setVisible(false);
            PhaserScene.tweens.killTweensOf(this.pulse);
        }
        if (this.pulse2) {
            this.pulse2.setVisible(false);
            PhaserScene.tweens.killTweensOf(this.pulse2);
        }
        // NOTE: Don't clear the pool as this instance is pooled and reused.
        // Let objects stay in the pool idle for the next activation.
    }

    playLaunchEffect(x, y) {
        const spr = this._launchEffectPool.get();
        if (!spr) return;

        spr.setPosition(x, y);
        spr.setVisible(true);
        spr.setActive(true);
        spr.play('enemy_hit_circle');
        spr.once('animationcomplete', () => {
            if (this._launchEffectPool) this._launchEffectPool.release(spr);
        });
    }
}

class Boss2 extends Boss {
    constructor(levelScalingModifier = 1) {
        super(levelScalingModifier);
        this.model = new Boss2Model(levelScalingModifier);
        this.view = new Boss2View();
        this._isCharging = false;
    }

    activate(x, y, scaleFactor = 1.0) {
        // Intended: Minibosses/Bosses do not scale with level progression
        const bossHealth = 285;

        super.activate(x, y, {
            maxHealth: bossHealth,
            damage: GAME_CONSTANTS.ENEMY_BASE_DAMAGE, // Static hull damage
            selfDamage: 0,
            speed: GAME_CONSTANTS.ENEMY_BASE_SPEED * 3.0, // 3.0x speed
            initialSpeedMult: this.model.initialSpeedMult,
            rampDuration: this.model.rampDuration,
            size: this.model.size,
            projectileDamage: 4.5 // Static projectile damage
        });

        this.setHPOrigin(0.47, 0.5);

        // Play warcry 0.75s after spawn
        PhaserScene.time.delayedCall(750, () => {
            if (typeof audio !== 'undefined') {
                const pan = (x < GAME_CONSTANTS.halfWidth) ? -0.15 : 0.15;
                audio.play('boss2_warcry', 1.0, false, false, pan);
            }
        });

        PhaserScene.time.delayedCall(1000, () => {
            messageBus.publish('AnnounceText', t('ui', 'boss_2_name'));
        });
    }

    update(dt) {
        super.update(dt);
        // Sync visual rotation with the model's calculated steering rotation
        this.setRotation(this.model.baseRotation);
        this.view.setTurretRotation(this.model.turretRotation);
        this.view.syncChargePosition(this.model.x, this.model.y, this.model.turretRotation);

        // Chargeup visual state tracking
        if (this.model.state === BOSS_2_STATES.BOMBARD) {
            // Only start chargeup visual when we are 2 seconds or less from barrage launch
            if (!this._isCharging && this.model.bombardTimer <= 2.0 && this.model.spawnCount === 0) {
                this._isCharging = true;
                this.view.startCharge();
            }

            // Handle Spawning sequence after chargeup (bombardTimer reaches 0)
            if (this.model.bombardTimer <= 0 && this.model.spawnCount < 1) {
                this.model.spawnTimer -= dt;
                if (this.model.spawnTimer <= 0) {
                    this._spawnShellEnemy();
                    this.model.spawnCount++;
                    this.model.spawnTimer = 0.5;

                    // If this was the last enemy in the barrage, reset charging flag for next loop/cooldown
                    if (this.model.spawnCount >= 1) {
                        this._isCharging = false;
                        this.view.stopCharge();
                    }
                }
            }
        } else {
            if (this._isCharging) {
                this._isCharging = false;
                this.view.stopCharge();
            }
        }

        // Ranged Attack logic (Circling phase)
        if (this.model.state === BOSS_2_STATES.CIRCLING && this.model.circlingTime >= 4) {
            if (this.model.attackCooldown <= 0) {
                this._fireProjectilePair();
                this.model.attackCount++;
                if (this.model.attackCount >= 3) {
                    this.model.attackCount = 0;
                    this.model.setupDelay = 1.5;
                    this.model.setupTarget = null;
                    this.model.state = BOSS_2_STATES.SETUP;
                }
            }
        }
    }

    _fireProjectilePair() {
        this.model.attackCooldown = 4.5;

        const centerX = GAME_CONSTANTS.halfWidth;
        const centerY = GAME_CONSTANTS.halfHeight;

        const fireSingle = (lateralOffset, detuneOffset) => {
            if (!this.model.alive) return;
            if (typeof enemyBulletManager === 'undefined') return;

            // Vector from boss to tower
            const dx = centerX - this.model.x;
            const dy = centerY - this.model.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist === 0) return;

            const vx = dx / dist;
            const vy = dy / dist;

            // Perpendicular vector for lateral offset (right relative to flight)
            // (vx, vy) rotated 90 deg clockwise is (vy, -vx)
            // Wait, standard screen coords: (vx, vy) -> (vy, -vx) is right?
            // Let's test: pointing Right (1, 0) -> (0, -1) is Up.
            // Pointing Down (0, 1) -> (1, 0) is Right.
            // Right relative to direction (vx, vy) is (-vy, vx). 
            // Let's re-verify: (1,0) direction, right is (0, 1). Yes.
            const rx = -vy;
            const ry = vx;

            // Spawn pos: Boss + 85 forward + lateral
            const spawnX = this.model.x + vx * 90 + rx * lateralOffset;
            const spawnY = this.model.y + vy * 90 + ry * lateralOffset;

            enemyBulletManager.fire(
                spawnX, spawnY,
                centerX, centerY,
                this.model.projectileDamage,
                'projectile.png',
                GAME_CONSTANTS.ENEMY_PROJECTILE_SPEED
            );

            this.view.playLaunchEffect(spawnX, spawnY);

            if (typeof audio !== 'undefined') {
                const s = audio.play('pew', 0.82);
                if (s) s.detune = detuneOffset;
            }
        };

        // First projectile: Right offset 30px
        const detuneRand = Math.random() * 200 - 100;
        fireSingle(28, detuneRand - 100);

        // Second projectile: Left offset 30px, 0.15s delay
        PhaserScene.time.delayedCall(400, () => {
            fireSingle(-26, detuneRand + 100);
        });
    }

    _spawnShellEnemy() {
        if (typeof enemyManager === 'undefined') return;

        const nozzleDist = 135;
        const spawnX = this.model.x + Math.cos(this.model.turretRotation) * nozzleDist;
        const spawnY = this.model.y + Math.sin(this.model.turretRotation) * nozzleDist;

        // Spawn at the nozzle position with an initial speed boost
        enemyManager.spawnAt('shell', spawnX, spawnY, {
            initialSpeedMult: 2,
            rampDuration: 1.2
        });
    }
}
