// js/enemies/sniper_enemy.js — Long-range, slow-firing specialist enemy (MVC).
//
// Behaviour:
//   • Stops at 250px from tower to fire.
//   • Fires 1 high-damage bullet every 5 seconds.
//   • First shot fires after 3 seconds of entering range.
//   • Size is 2x basic enemy (24).
//   • Uses sniper.png and sniper_projectile.png from enemies atlas.

const SNIPER_STATE = {
    MOVING: 'MOVING',
    ATTACKING: 'ATTACKING',
};

class SniperEnemyModel extends EnemyModel {
    constructor() {
        super();
        this.type = 'sniper';
        this.baseResourceDrop = 4;
        this.cannotRotate = true;
        this.knockBackModifier = 0;

        this.state = SNIPER_STATE.MOVING;
        this.fireCooldown = 0;
        this.baseAttackInterval = 5000;
        this.projectileDamage = 4;
        this.isCharging = false;
        this._isRampingUp = false;
        this._chargeWobbleTime = 0;
    }
}

class SniperEnemyView extends EnemyView {
    constructor() {
        super(Enemy.TEX_KEY, 'sniper.png', 'sniper_enemy_hp.png', GAME_CONSTANTS.DEPTH_ENEMIES);
        // HP bar rotated 90 deg CCW
        this.hpImg.setRotation(-Math.PI / 2);

        // Charge-up visual indicator
        this.chargeSprite = PhaserScene.add.image(0, 0, Enemy.TEX_KEY, 'chargeup.png');
        this.chargeSprite.setDepth(GAME_CONSTANTS.DEPTH_ENEMIES + 1);
        this.chargeSprite.setVisible(false);
    }

    activate(x, y, rotation, cannotRotate) {
        super.activate(x, y, rotation, cannotRotate);
        if (this.chargeSprite) {
            PhaserScene.tweens.killTweensOf(this.chargeSprite);
            this.chargeSprite.setVisible(false);
            this.chargeSprite.setScale(0.2);
            this.chargeSprite.setAlpha(1);
        }
    }

    startCharge() {
        if (!this.chargeSprite) return;
        this.chargeSprite.setVisible(true);
        this.chargeSprite.setScale(0.2);
        this.chargeSprite.setAlpha(1);

        PhaserScene.tweens.killTweensOf(this.chargeSprite);

        // Stage 1: Pop up
        PhaserScene.tweens.add({
            targets: this.chargeSprite,
            scale: 1.1,
            duration: 250,
            ease: 'Quad.easeIn',
            onComplete: () => {
                if (!this.chargeSprite.visible) return;
                // Stage 2: Shrink and fade
                PhaserScene.tweens.add({
                    targets: this.chargeSprite,
                    scale: 0.4,
                    alpha: 0.7,
                    duration: 350,
                    ease: 'Quad.easeOut',
                    onComplete: () => {
                        if (!this.chargeSprite.visible) return;
                        // Stage 3: Slow build-up (flag handled by controller)
                        PhaserScene.tweens.add({
                            targets: this.chargeSprite,
                            scale: 1.2,
                            alpha: 1,
                            duration: 2200,
                            ease: 'Linear',
                            onComplete: () => {
                                if (!this.chargeSprite.visible) return;
                                // Stage 4: Final jump
                                this.chargeSprite.setScale(1.35);
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

    syncChargePosition(x, y) {
        if (this.chargeSprite && this.chargeSprite.visible) {
            this.chargeSprite.setPosition(x, y);
            this.chargeSprite.setRotation(0);
        }
    }

    applyChargeWobble(dt, wobbleTime) {
        if (!this.chargeSprite || !this.chargeSprite.visible) return wobbleTime;
        wobbleTime += dt;
        const wx = Math.sin(wobbleTime * 25) * 0.06;
        const wy = Math.cos(wobbleTime * 21) * 0.06;
        const baseScale = this.chargeSprite.scaleX;
        this.chargeSprite.scaleX = baseScale + wx;
        this.chargeSprite.scaleY = baseScale + wy;
        return wobbleTime;
    }

    deactivate() {
        super.deactivate();
        this.stopCharge();
    }
}

class SniperEnemy extends Enemy {
    constructor() {
        super();
        this.model = new SniperEnemyModel();
        this.view = new SniperEnemyView();
    }

    activate(x, y, scaleFactor) {
        super.activate(x, y, {
            maxHealth: GAME_CONSTANTS.ENEMY_BASE_HEALTH * scaleFactor * 2,
            damage: GAME_CONSTANTS.ENEMY_BASE_DAMAGE * scaleFactor,
            selfDamage: 0,
            speed: GAME_CONSTANTS.ENEMY_BASE_SPEED * 0.9,
            size: 28
        });

        const m = this.model;
        m.projectileDamage = 4 * scaleFactor;
        m.state = SNIPER_STATE.MOVING;
        m.fireCooldown = 0;
        m.isCharging = false;
        m._isRampingUp = false;
        m._chargeWobbleTime = 0;

        if (this.view.img) this.view.img.setTint(0xffffff);
    }

    deactivate() {
        this.model.isCharging = false;
        this.model._isRampingUp = false;
        super.deactivate();
    }

    update(dt) {
        const m = this.model;
        const v = this.view;
        const tPos = tower.getPosition();
        const dx = tPos.x - m.x;
        const dy = tPos.y - m.y;
        const distToTower = Math.sqrt(dx * dx + dy * dy);
        const range = 250;

        // Sync model/view first (burn, position)
        super.update(dt);

        // Sync charge sprite position
        v.syncChargePosition(m.x, m.y);

        // Apply wobble during ramp-up
        if (m._isRampingUp) {
            m._chargeWobbleTime = v.applyChargeWobble(dt, m._chargeWobbleTime);
        }

        if (m.state === SNIPER_STATE.MOVING) {
            if (m.isCharging) {
                v.stopCharge();
                m.isCharging = false;
                m._isRampingUp = false;
            }

            if (distToTower <= range) {
                m.state = SNIPER_STATE.ATTACKING;
                m.isAttacking = true;
                m.vx = 0;
                m.vy = 0;
                m.fireCooldown = 3000;
            }
        } else if (m.state === SNIPER_STATE.ATTACKING) {
            if (distToTower > range + 20) {
                m.state = SNIPER_STATE.MOVING;
                m.isAttacking = false;
                v.stopCharge();
                m.isCharging = false;
                m._isRampingUp = false;
                m.aimAt(tPos.x, tPos.y);
                return;
            }

            m.vx = 0;
            m.vy = 0;

            const dtMs = dt * 1000;
            m.fireCooldown -= dtMs;

            if (m.fireCooldown <= 3000 && !m.isCharging && m.fireCooldown > 0) {
                m.isCharging = true;
                m._isRampingUp = true;
                m._chargeWobbleTime = 0;
                v.startCharge();
            }

            if (m.fireCooldown <= 0) {
                this._fireBullet(tPos.x, tPos.y);
                v.stopCharge();
                m.isCharging = false;
                m._isRampingUp = false;
                m.fireCooldown = m.baseAttackInterval;
            }
        }
    }

    _fireBullet(targetX, targetY) {
        if (typeof enemyBulletManager !== 'undefined') {
            enemyBulletManager.fire(
                this.model.x, this.model.y,
                targetX, targetY,
                this.model.projectileDamage,
                'sniper_projectile.png',
                null,
                false,
                200,
                0.015,
                'sniper_bullet'
            );
        }
    }
}
