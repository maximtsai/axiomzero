/**
 * @fileoverview Combat Shield ability logic.
 * Manages the health and logic for the player's controllable shield.
 */

class CombatShield {
    constructor() {
        this.maxHealth = 15;
        this.health = 15;
        this.unlocked = false;
        this.alive = false;
        this.angle = 0;
        this._sprite = null;
        this._baseScale = 1;
        this.rotationVelocity = 0;
        this.rotationAcceleration = 0;
        this.rotationJerk = 0;
        this._initialized = false;

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
        if (this._sprite) {
            this._sprite.destroy();
            this._sprite = null;
        }
    }

    update(dt) {
        if (!this.unlocked || !this.alive || !this._sprite) return;
        const delta = dt / 16.66;

        const pointer = PhaserScene.input.activePointer;
        if (pointer) {
            const dx = pointer.worldX - GAME_CONSTANTS.halfWidth;
            const dy = pointer.worldY - GAME_CONSTANTS.halfHeight;
            const dist = Math.sqrt(dx * dx + dy * dy);

            let diffDeg = 0;
            if (dist > 4) {
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

            const newAngleDeg = Phaser.Math.Angle.WrapDegrees(Phaser.Math.RadToDeg(this.angle) + (this.rotationVelocity * delta));
            this.angle = Phaser.Math.DegToRad(newAngleDeg);
            this._sprite.setRotation(this.angle);
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

        if (this._sprite && this.health > 0) {
            this._sprite.setScale(1.01);
            PhaserScene.tweens.killTweensOf(this._sprite);
            PhaserScene.tweens.add({
                targets: this._sprite,
                scaleX: 0.72,
                scaleY: 0.72,
                duration: 140,
                ease: 'Quart.easeOut',
                onCoplete: () => {
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

    die() {
        this.alive = false;
        if (this._sprite) {
            PhaserScene.tweens.killTweensOf(this._sprite);

            const baseX = GAME_CONSTANTS.halfWidth;
            const baseY = GAME_CONSTANTS.halfHeight;

            PhaserScene.tweens.add({
                targets: this._sprite,
                scaleX: 0.85,
                scaleY: 0.85,
                alpha: 0,
                duration: 600,
                ease: 'Quad.easeIn',
                onComplete: () => {
                    this.despawn();
                }
            });

            PhaserScene.tweens.add({
                targets: this._sprite,
                x: baseX + 5,
                y: baseY - 5,
                duration: 50,
                yoyo: true,
                repeat: 10,
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
