// js/enemies/boss_2.js — Phase 2 boss (MVC).
// Spawns when wave progress reaches 100% on Level 2.
// Moves 3.0x as fast as a basic enemy and has a similar starting speed boost to Boss 1.
// 200 base health.

const BOSS_2_STATES = {
    TRAVEL: 'travel',
    CIRCLING: 'circling'
};

class Boss2Model extends BossModel {
    constructor(levelScalingModifier = 1) {
        super(levelScalingModifier);
        this.initialSpeedMult = 7.0; // Same burst of speed as Boss 1
        this.rampDuration = 1.5;
        this.size = 60;
        this.bossId = 'boss2';

        this.state = BOSS_2_STATES.TRAVEL;
        this.maxRotationSpeed = 0.7; // Radians per second, give it some "weight"
        this.currentMoveRotation = 0;

        // Attack timers
        this.circlingTime = 0;
        this.attackCooldown = 0;
        this.projectileDamage = 1;
    }

    activate(x, y, config = {}) {
        super.activate(x, y, config);
        this.state = BOSS_2_STATES.TRAVEL;
        this.circlingTime = 0;
        this.attackCooldown = 0;
        this.projectileDamage = config.projectileDamage || 1.5;

        // Initial rotation towards tower
        const dx = GAME_CONSTANTS.halfWidth - x;
        const dy = GAME_CONSTANTS.halfHeight - y;
        this.currentMoveRotation = Math.atan2(dy, dx);
        this.baseRotation = this.currentMoveRotation;
    }

    update(dt) {
        const burnTick = super.update(dt);
        if (!this.alive || this.stunned || this.isAttacking) return burnTick;

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
            // Move directly towards tower (aimAt is already called by Enemy.update/ramp)
            if (dist < 400) {
                this.state = BOSS_2_STATES.CIRCLING;
                this.circlingTime = 0;
                this.speed = GAME_CONSTANTS.ENEMY_BASE_SPEED * 2.0;
            }
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

            const maxChange = this.maxRotationSpeed * dt;
            const actualChange = Phaser.Math.Clamp(diff, -maxChange, maxChange);
            this.currentMoveRotation += actualChange;
            this.baseRotation = this.currentMoveRotation;

            // 3. Update velocity based on current rotation and current speed
            const effectiveSpeed = this.baseSpeed * (this.speed / (this.baseSpeed || 1)) * this.speedMult;
            this.vx = Math.cos(this.currentMoveRotation) * effectiveSpeed;
            this.vy = Math.sin(this.currentMoveRotation) * effectiveSpeed;
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
        // Base boss health for Boss 2 is 280 (increased from 200)
        const bossHealth = 280;

        super.activate(x, y, {
            maxHealth: bossHealth,
            damage: GAME_CONSTANTS.ENEMY_BASE_DAMAGE,
            selfDamage: 0,
            speed: GAME_CONSTANTS.ENEMY_BASE_SPEED * 3.0, // 3.0x speed
            initialSpeedMult: this.model.initialSpeedMult,
            rampDuration: this.model.rampDuration,
            size: this.model.size,
            projectileDamage: 4
        });

        this.setHPOrigin(0.475, 0.5);

        PhaserScene.time.delayedCall(1000, () => {
            messageBus.publish('AnnounceText', t('ui', 'boss_2_name'));
        });
    }

    update(dt) {
        super.update(dt);
        // Sync visual rotation with the model's calculated steering rotation
        this.setRotation(this.model.baseRotation);

        // Ranged Attack logic
        if (this.model.state === BOSS_2_STATES.CIRCLING && this.model.circlingTime >= 3.0) {
            if (this.model.attackCooldown <= 0) {
                this._fireProjectilePair();
            }
        }
    }

    _fireProjectilePair() {
        this.model.attackCooldown = 4.5;

        const centerX = GAME_CONSTANTS.halfWidth;
        const centerY = GAME_CONSTANTS.halfHeight;

        const fireSingle = (lateralOffset) => {
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
            const spawnX = this.model.x + vx * 85 + rx * lateralOffset;
            const spawnY = this.model.y + vy * 85 + ry * lateralOffset;

            enemyBulletManager.fire(
                spawnX, spawnY,
                centerX, centerY,
                this.model.projectileDamage,
                'projectile.png',
                GAME_CONSTANTS.ENEMY_PROJECTILE_SPEED
            );
        };

        // First projectile: Right offset 30px
        fireSingle(27);

        // Second projectile: Left offset 30px, 0.15s delay
        PhaserScene.time.delayedCall(150, () => {
            fireSingle(-27);
        });
    }
}
