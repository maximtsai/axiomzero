/**
 * @fileoverview Combat Shield ability logic.
 * Manages the health and logic for the player's controllable shield.
 */

class CombatShield {
    constructor() {
        this.maxHealth = 20;
        this.health = 20;
        this.unlocked = false;
        this.alive = false;
        this.angle = 0;
        this._sprite = null;
        this._baseScale = 1;
        this.rotationVelocity = 0;
        this.rotationAcceleration = 0;
        this.rotationJerk = 0;
        this._initialized = false;
        this.isFrozen = false;
        this._freezeTimer = null;
        this.isSlowed = false;
        this._slowTimer = null;
        this._particlePool = null;
        this._activeParticles = [];

        // Future Upgrade placeholders
        this.knockbackStrength = 120;
        this.baseDamageMult = 1.0;
    }

    init() {
        if (this._initialized) return;

        messageBus.subscribe('phaseChanged', (phase) => {
            this._onPhaseChanged(phase);
        });

        messageBus.subscribe('testingDefensesStarted', () => {
            this.spawn();
        });

        messageBus.subscribe('freezeShield', (duration) => {
            this.freeze(duration);
        });

        updateManager.addFunction((dt) => this.update(dt));
        this._initialized = true;
    }

    unlock() {
        this.unlocked = true;
        this.spawn();
    }

    lock() {
        this.unlocked = false;
        this.despawn();
    }

    _onPhaseChanged(phase) {
        if (phase === GAME_CONSTANTS.PHASE_COMBAT) {
            this.spawn();
        }
    }

    spawn() {
        if (!this.unlocked) return;
        this.health = this.maxHealth;
        this.alive = true;

        if (this._sprite) {
            this._sprite.setAlpha(1);
            return;
        }

        if (typeof PhaserScene !== 'undefined') {
            const tx = GAME_CONSTANTS.halfWidth;
            const ty = GAME_CONSTANTS.halfHeight;

            this._sprite = PhaserScene.add.image(tx, ty, 'player', 'shield.png');
            if (this._sprite) {
                this._sprite.setOrigin(0.5, 0.5);
                this._sprite.setDepth(GAME_CONSTANTS.DEPTH_TOWER + 1);

                this._sprite.setScale(0.8);
                this._sprite.setAlpha(1);
                this._sprite.setRotation(0); // Default pointed right
            }
        }
    }

    despawn() {
        this.alive = false;
        this.isFrozen = false;
        if (this._freezeTimer) {
            this._freezeTimer.remove();
            this._freezeTimer = null;
        }
        this.isSlowed = false;
        if (this._slowTimer) {
            this._slowTimer.remove();
            this._slowTimer = null;
        }
        if (this._particlePool && this._activeParticles.length > 0) {
            this._particlePool.releaseAll();
            this._activeParticles.length = 0;
        }
        if (this._sprite) {
            this._sprite.destroy();
            this._sprite = null;
        }
    }

    update(dt) {
        if (!this.unlocked || !this.alive || !this._sprite) return;
        const delta = dt / 16.66;

        if (!this.isFrozen) {
            const pointer = PhaserScene.input.activePointer;
            if (pointer) {
                const dx = pointer.worldX - GAME_CONSTANTS.halfWidth;
                const dy = pointer.worldY - GAME_CONSTANTS.halfHeight;
                const distSq = dx * dx + dy * dy;

                let diffDeg = 0;
                if (distSq > 16) {
                    const targetAngle = Math.atan2(dy, dx);
                    diffDeg = Phaser.Math.Angle.ShortestBetween(
                        Phaser.Math.RadToDeg(this.angle),
                        Phaser.Math.RadToDeg(targetAngle)
                    );
                    this.rotationAcceleration = diffDeg * 0.15;
                } else {
                    this.rotationAcceleration = 0;
                }

                this.rotationVelocity += this.rotationAcceleration * delta;
                this.rotationVelocity *= Math.pow(0.75, delta);

                const currentVelocity = this.isSlowed ? (this.rotationVelocity * 0.05) : this.rotationVelocity;
                const newAngleDeg = Phaser.Math.Angle.WrapDegrees(Phaser.Math.RadToDeg(this.angle) + (currentVelocity * delta));
                this.angle = Phaser.Math.DegToRad(newAngleDeg);
                this._sprite.setRotation(this.angle);
            }
        }

        if (this._activeParticles && this._activeParticles.length > 0) {
            for (let i = this._activeParticles.length - 1; i >= 0; i--) {
                const p = this._activeParticles[i];
                p.life -= dt;

                if (p.life <= 0) {
                    this._particlePool.release(p);
                    this._activeParticles.splice(i, 1);
                } else {
                    const progress = Math.min(1, (p.maxLife - p.life) / p.maxLife);
                    const easedProgress = 1 - Math.pow(1 - progress, 3);

                    p.setPosition(
                        p.startX + p.totalX * easedProgress,
                        p.startY + p.totalY * easedProgress
                    );
                    p.setScale(20 * (1 - progress), 4 - progress);
                }
            }
        }
    }

    isAttackBlocked(sourceX, sourceY) {
        if (!this.unlocked || !this.alive) return false;

        const dx = sourceX - GAME_CONSTANTS.halfWidth;
        const dy = sourceY - GAME_CONSTANTS.halfHeight;
        const attackAngle = Math.atan2(dy, dx);

        const diffDeg = Phaser.Math.Angle.ShortestBetween(
            Phaser.Math.RadToDeg(this.angle),
            Phaser.Math.RadToDeg(attackAngle)
        );

        // 100 degrees total (50 degrees leeway on each side)
        return Math.abs(diffDeg) <= 50;
    }

    takeDamage(amount) {
        if (!this.unlocked || !this.alive) return;

        this.health -= amount;
        this.slowShield();

        if (!this._particlePool && typeof PhaserScene !== 'undefined' && typeof ObjectPool !== 'undefined') {
            this._particlePool = new ObjectPool(
                () => {
                    const p = PhaserScene.add.image(0, 0, 'pixels', 'white_pixel.png');
                    p.setDepth(GAME_CONSTANTS.DEPTH_TOWER + 2);
                    p.setVisible(false);
                    return p;
                },
                (p) => {
                    p.setVisible(false);
                    p.setPosition(0, 0);
                    p.setRotation(0);
                    p.setScale(1, 1);
                    p.setAlpha(1);
                    p.startX = 0;
                    p.startY = 0;
                    p.totalX = 0;
                    p.totalY = 0;
                    p.life = 0;
                    p.maxLife = 0;
                },
                {
                    maxSize: 45,
                    destroy: (p) => {
                        if (p && p.destroy) p.destroy();
                    }
                }
            );
        }

        if (this._particlePool) {
            const reach = 45;
            const spreadRad = 70 * Math.PI / 180;
            let randAngle, edgeX, edgeY, particleAngle, speed, duration, vx, vy;

            const particleCount = 3 + Math.floor((amount / this.maxHealth) * 10);

            for (let i = 0; i < particleCount; i++) {
                randAngle = this.angle + (Math.random() - 0.5) * 0.2;
                edgeX = GAME_CONSTANTS.halfWidth + Math.cos(randAngle) * reach;
                edgeY = GAME_CONSTANTS.halfHeight + Math.sin(randAngle) * reach;

                particleAngle = randAngle + Phaser.Math.FloatBetween(-spreadRad, spreadRad);

                const p = this._particlePool.get();
                if (p) {
                    p.setPosition(edgeX, edgeY);
                    p.setRotation(particleAngle);
                    p.setScale(20, 4);
                    p.setVisible(true);

                    speed = Phaser.Math.FloatBetween(120, 240);
                    duration = Phaser.Math.Between(250, 650);

                    vx = Math.cos(particleAngle) * speed;
                    vy = Math.sin(particleAngle) * speed;

                    p.startX = edgeX;
                    p.startY = edgeY;
                    p.totalX = vx * (duration / 1000);
                    p.totalY = vy * (duration / 1000);
                    p.life = duration;
                    p.maxLife = duration;

                    this._activeParticles.push(p);
                }
            }
        }

        if (this._sprite && this.health > 0) {
            this._sprite.setScale(1.01);
            PhaserScene.tweens.killTweensOf(this._sprite);
            PhaserScene.tweens.add({
                targets: this._sprite,
                scaleX: 0.72,
                scaleY: 0.72,
                duration: 140,
                ease: 'Quart.easeOut',
                onComplete: () => {
                    PhaserScene.tweens.add({
                        targets: this._sprite,
                        scaleX: 0.8,
                        scaleY: 0.8,
                        duration: 440,
                        ease: 'Back.easeOut',
                        easeParams: [3]
                    });
                }
            });
        }

        if (this.health <= 0) {
            this.health = 0;
            this.die();
        }
    }

    freeze(duration = 2000) {
        if (!this.unlocked || !this.alive) return;
        this.isFrozen = true;

        if (this._freezeTimer) {
            this._freezeTimer.remove();
        }

        if (typeof PhaserScene !== 'undefined') {
            this._freezeTimer = PhaserScene.time.delayedCall(duration, () => {
                this.isFrozen = false;
                this._freezeTimer = null;
            });
        }
    }

    slowShield(duration = 150) {
        if (!this.unlocked || !this.alive) return;
        this.isSlowed = true;

        if (this._slowTimer) {
            this._slowTimer.remove();
        }

        if (typeof PhaserScene !== 'undefined') {
            this._slowTimer = PhaserScene.time.delayedCall(duration, () => {
                this.isSlowed = false;
                this._slowTimer = null;
            });
        }
    }

    die() {
        this.alive = false;
        this.isFrozen = false;
        if (this._freezeTimer) {
            this._freezeTimer.remove();
            this._freezeTimer = null;
        }
        this.isSlowed = false;
        if (this._slowTimer) {
            this._slowTimer.remove();
            this._slowTimer = null;
        }
        if (this._particlePool && this._activeParticles.length > 0) {
            this._particlePool.releaseAll();
            this._activeParticles.length = 0;
        }
        if (this._sprite) {
            PhaserScene.tweens.killTweensOf(this._sprite);

            const baseX = GAME_CONSTANTS.halfWidth;
            const baseY = GAME_CONSTANTS.halfHeight;

            PhaserScene.tweens.add({
                targets: this._sprite,
                scaleX: 0.85,
                scaleY: 0.85,
                alpha: 0,
                duration: 1000,
                ease: 'Quad.easeIn',
                onComplete: () => {
                    this.despawn();
                }
            });

            PhaserScene.tweens.add({
                targets: this._sprite,
                x: baseX + 5,
                y: baseY - 5,
                duration: 45,
                yoyo: true,
                repeat: 9,
                ease: 'Linear',
                onComplete: () => {
                    if (this._sprite) {
                        this._sprite.setPosition(baseX, baseY);
                    }
                }
            });
        }
    }
}

// Global instance
const combatShield = new CombatShield();
