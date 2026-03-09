// js/enemies/sniper_enemy.js — Long-range, slow-firing specialist enemy.
//
// Behaviour:
//   • Stops at 250px from tower to fire.
//   • Fires 1 high-damage bullet every 4 seconds.
//   • First shot fires after 3 seconds of entering range.
//   • Size is 2x basic enemy (24).
//   • Uses sniper.png and sniper_projectile.png from enemies atlas.

const SNIPER_STATE = {
    MOVING: 'MOVING',
    ATTACKING: 'ATTACKING',
};

class SniperEnemy extends Enemy {
    constructor() {
        super();
        this.type = 'sniper';
        this.baseResourceDrop = 5;
        this.img = PhaserScene.add.image(0, 0, Enemy.TEX_KEY, 'sniper.png');
        this.img.setVisible(false);
        this.img.setActive(false);

        // UI: Health sprite overlay
        this.hpImg = PhaserScene.add.image(0, 0, Enemy.TEX_KEY, 'sniper_enemy_hp.png');
        this.hpImg.setDepth(GAME_CONSTANTS.DEPTH_ENEMIES);
        this.hpImg.setRotation(-Math.PI / 2); // 90 deg CCW
        this.hpImg.setVisible(false);
        this.hpImg.setActive(false);

        // Charge-up visual indicator
        this.chargeSprite = PhaserScene.add.image(0, 0, Enemy.TEX_KEY, 'chargeup.png');
        this.chargeSprite.setDepth(GAME_CONSTANTS.DEPTH_ENEMIES + 1);
        this.chargeSprite.setVisible(false);

        this.state = SNIPER_STATE.MOVING;
        this.fireCooldown = 0;
        this.baseAttackInterval = 5000; // 5 seconds
        this.isCharging = false;
        this.cannotRotate = true;
        this._isRampingUp = false;
        this._chargeWobbleTime = 0;
        this.knockBackModifier = 0;
    }

    activate(x, y, scaleFactor) {
        super.activate(x, y, {
            maxHealth: GAME_CONSTANTS.ENEMY_BASE_HEALTH * scaleFactor * 2,
            damage: GAME_CONSTANTS.ENEMY_BASE_DAMAGE * scaleFactor,
            selfDamage: 0,
            speed: GAME_CONSTANTS.ENEMY_BASE_SPEED * 0.9,
            size: 24
        });

        this.projectileDamage = 4 * scaleFactor;
        this.state = SNIPER_STATE.MOVING;
        this.fireCooldown = 0;
        this.isCharging = false;
        this._isRampingUp = false;
        this._chargeWobbleTime = 0;

        if (this.img) this.img.setTint(0xffffff);
    }

    deactivate() {
        super.deactivate();
        if (this.chargeSprite) {
            PhaserScene.tweens.killTweensOf(this.chargeSprite);
            this.chargeSprite.setVisible(false);
        }
        this.isCharging = false;
    }

    update(dt) {
        const tPos = tower.getPosition();
        const dx = tPos.x - this.x;
        const dy = tPos.y - this.y;
        const distToTower = Math.sqrt(dx * dx + dy * dy);
        const range = 250;

        // Sync charge sprite position if it's active
        if (this.chargeSprite && this.chargeSprite.visible) {
            this.chargeSprite.setPosition(this.x, this.y);
            this.chargeSprite.setRotation(0);

            if (this._isRampingUp) {
                this._chargeWobbleTime += dt;
                const wx = Math.sin(this._chargeWobbleTime * 25) * 0.06;
                const wy = Math.cos(this._chargeWobbleTime * 21) * 0.06;
                // Add wobble on top of current base scale
                const baseScale = this.chargeSprite.scaleX;
                this.chargeSprite.scaleX = baseScale + wx;
                this.chargeSprite.scaleY = baseScale + wy;
            }
        }

        if (this.state === SNIPER_STATE.MOVING) {
            super.update(dt);

            if (this.isCharging) {
                this._stopCharge();
            }

            if (distToTower <= range) {
                this.state = SNIPER_STATE.ATTACKING;
                this.vx = 0;
                this.vy = 0;
                // Starts with a cooldown of 3 seconds upon first entering range
                this.fireCooldown = 3000;
            }
        } else if (this.state === SNIPER_STATE.ATTACKING) {
            if (distToTower > range + 20) { // Slight buffer for retreat
                this.state = SNIPER_STATE.MOVING;
                this._stopCharge();
                this.aimAt(tPos.x, tPos.y);
                return;
            }

            this.baseRotation = Math.atan2(dy, dx);
            this.setRotation(this.baseRotation);

            this.vx = 0;
            this.vy = 0;

            const dtMs = dt * 1000;
            this.fireCooldown -= dtMs;

            if (this.fireCooldown <= 3000 && !this.isCharging && this.fireCooldown > 0) {
                this._startCharge();
            }

            if (this.fireCooldown <= 0) {
                this._fireBullet(tPos.x, tPos.y);
                this._stopCharge();
                this.fireCooldown = this.baseAttackInterval;
            }
        }
    }

    _startCharge() {
        if (!this.chargeSprite) return;
        this.isCharging = true;
        this.chargeSprite.setVisible(true);
        this.chargeSprite.setScale(0.2);
        this.chargeSprite.setAlpha(1);

        // Animation sequence
        PhaserScene.tweens.killTweensOf(this.chargeSprite);

        // Stage 1: Pop up
        PhaserScene.tweens.add({
            targets: this.chargeSprite,
            scale: 1.1,
            duration: 250,
            ease: 'Quad.easeIn',
            onComplete: () => {
                if (!this.isCharging) return;
                // Stage 2: Shrink and fade
                PhaserScene.tweens.add({
                    targets: this.chargeSprite,
                    scale: 0.4,
                    alpha: 0.7,
                    duration: 350,
                    ease: 'Quad.easeOut',
                    onComplete: () => {
                        if (!this.isCharging) return;
                        // Stage 3: Slow build-up
                        this._isRampingUp = true;
                        this._chargeWobbleTime = 0;
                        PhaserScene.tweens.add({
                            targets: this.chargeSprite,
                            scale: 1.2,
                            alpha: 1,
                            duration: 2200,
                            ease: 'Linear',
                            onComplete: () => {
                                if (!this.isCharging) return;
                                // Stage 4: Final jump
                                this._isRampingUp = false;
                                this.chargeSprite.setScale(1.35);
                                this.chargeSprite.setAlpha(1);
                            }
                        });
                    }
                });
            }
        });
    }

    _stopCharge() {
        this.isCharging = false;
        this._isRampingUp = false;
        if (this.chargeSprite) {
            this.chargeSprite.setVisible(false);
            PhaserScene.tweens.killTweensOf(this.chargeSprite);
        }
    }

    _fireBullet(targetX, targetY) {
        if (typeof enemyBulletManager !== 'undefined') {
            enemyBulletManager.fire(
                this.x, this.y,
                targetX, targetY,
                this.projectileDamage,
                'sniper_projectile.png'
            );
        }
    }

}
