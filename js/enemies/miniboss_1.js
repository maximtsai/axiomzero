// js/enemies/miniboss_1.js — First miniboss type: ranged attacker (MVC).
//
// Behaviour:
//   • Beelines toward the tower at 1.5× normal enemy speed.
//   • At 195px from tower, stops and enters ATTACKING state.
//   • Fires 1 bullet every 4 seconds via enemyBulletManager.
//   • If knocked back past 235px, re-enters MOVING state.
//   • 70 HP, no wave scaling. Drops 1 SHARD on death.

/** Local config — owned by this class, not exposed to globals. */
const MB1 = {
    HEALTH: 80,
    SPEED_MULT: 1.5,
    ATTACK_RANGE: 200,
    RETREAT_RANGE: 235,
    FIRE_INTERVAL: 4000,
    BULLET_DAMAGE: 4,
    KNOCKBACK_MOD: 0,
    INITIAL_SPEED_MULT: 7,
    RAMP_DURATION: 2,
};

const MINIBOSS_STATE = {
    MOVING: 'MOVING',
    ATTACKING: 'ATTACKING',
};

class Miniboss1Model extends MinibossModel {
    constructor(levelScalingModifier = 1) {
        super(levelScalingModifier);
        this.isMiniboss = true;
        this.state = MINIBOSS_STATE.MOVING;
        this.fireCooldown = 0;
        this.isCharging = false;
        this.chargeAttackPlayed = false;
        this._isRampingUp = false;
        this._chargeWobbleTime = 0;
        this.initialSpeedMult = MB1.INITIAL_SPEED_MULT;
        this.rampDuration = MB1.RAMP_DURATION;
    }
}

class Miniboss1View extends EnemyView {
    constructor() {
        super(Enemy.TEX_KEY, 'miniboss_1.png', 'miniboss_1_enemy_hp.png', GAME_CONSTANTS.DEPTH_ENEMIES + 2);

        // Charge-up visual indicator
        this.chargeSprite = PhaserScene.add.image(0, 0, Enemy.TEX_KEY, 'chargeup.png');
        this.chargeSprite.setDepth(GAME_CONSTANTS.DEPTH_ENEMIES + 3);
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

    deactivate() {
        super.deactivate();
        this.stopCharge();
    }

    startCharge(isChargingRef) {
        if (!this.chargeSprite) return;
        this.chargeSprite.setVisible(true);
        this.chargeSprite.setScale(0.2);
        this.chargeSprite.setAlpha(1);

        PhaserScene.tweens.killTweensOf(this.chargeSprite);

        PhaserScene.tweens.add({
            targets: this.chargeSprite,
            scale: 1.1,
            duration: 250,
            ease: 'Quad.easeIn',
            onComplete: () => {
                if (!this.chargeSprite.visible) return;
                PhaserScene.tweens.add({
                    targets: this.chargeSprite,
                    scale: 0.4,
                    alpha: 0.7,
                    duration: 350,
                    ease: 'Quad.easeOut',
                    onComplete: () => {
                        if (!this.chargeSprite.visible) return;
                        // Signal ramp-up start (controller sets model flag)
                        if (isChargingRef) isChargingRef();
                        PhaserScene.tweens.add({
                            targets: this.chargeSprite,
                            scale: 1.2,
                            alpha: 1,
                            duration: 1600,
                            ease: 'Linear',
                            onComplete: () => {
                                if (!this.chargeSprite.visible) return;
                                this.chargeSprite.setScale(1.4);
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

    syncChargePosition(x, y, dirX, dirY, distToTower) {
        if (!this.chargeSprite || !this.chargeSprite.visible) return;
        const dist = Math.max(1, distToTower);
        const ux = dirX / dist;
        const uy = dirY / dist;
        this.chargeSprite.setPosition(x + ux * 50, y + uy * 50);
        this.chargeSprite.setRotation(0);
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
}

class Miniboss1 extends Miniboss {
    constructor(levelScalingModifier = 1) {
        super(levelScalingModifier);
        this.model = new Miniboss1Model(levelScalingModifier);
        this.view = new Miniboss1View();
    }

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    activate(x, y) {
        const m = this.model;

        // Intended: Minibosses/Bosses do not scale health or damage with level progression
        m.maxHealth = MB1.HEALTH * (m.multiplier || 1);
        m.health = m.maxHealth;
        m.damage = 0;
        m.speed = GAME_CONSTANTS.ENEMY_BASE_SPEED * MB1.SPEED_MULT;
        m.knockBackModifier = MB1.KNOCKBACK_MOD;
        m.size = 60;

        m.state = MINIBOSS_STATE.MOVING;
        m.fireCooldown = MB1.FIRE_INTERVAL;
        m.isCharging = false;
        m.chargeAttackPlayed = false;
        m._isRampingUp = false;
        m._chargeWobbleTime = 0;

        // Uses Miniboss superclass activate, passing the speed mult config implicitly via the class variables setup.
        // But the EnemyModel activate config handles it explicitly. So let's pass it via super.activate.

        // Reset visuals
        if (this.view.img) {
            this.view.img.setAlpha(1);
            this.view.img.setScale(1);
            this.view.img.clearTint();
        }
        if (this.view.hpImg) {
            this.view.hpImg.setAlpha(1);
            this.view.hpImg.setScale(1);
        }

        super.activate(x, y, {
            initialSpeedMult: m.initialSpeedMult,
            rampDuration: m.rampDuration
        });
    }

    deactivate() {
        this.model.isCharging = false;
        this.model._isRampingUp = false;
        super.deactivate();
    }

    // ── Per-frame ─────────────────────────────────────────────────────────────

    update(dt) {
        const m = this.model;
        const v = this.view;
        const tPos = tower.getPosition();
        const dx = tPos.x - m.x;
        const dy = tPos.y - m.y;
        const distToTower = Math.sqrt(dx * dx + dy * dy);

        // Call super.update to process model updates (burn, stun) and base view updates
        super.update(dt);

        if (m.state === MINIBOSS_STATE.MOVING) {
            if (distToTower <= MB1.ATTACK_RANGE) {
                m.state = MINIBOSS_STATE.ATTACKING;
                m.isAttacking = true;
                m.vx = 0;
                m.vy = 0;
                m.fireCooldown = 2500; // Intended: faster first shot delay upon entering range
            }
        } else if (m.state === MINIBOSS_STATE.ATTACKING) {
            m.baseRotation = Math.atan2(dy, dx);
            v.setRotation(m.baseRotation);

            // Sync charge sprite position
            v.syncChargePosition(m.x, m.y, dx, dy, distToTower);

            if (m._isRampingUp) {
                m._chargeWobbleTime = v.applyChargeWobble(dt, m._chargeWobbleTime);
            }

            // Check if pushed out of range
            if (distToTower > MB1.RETREAT_RANGE) {
                m.state = MINIBOSS_STATE.MOVING;
                m.isAttacking = false;
                v.stopCharge();
                m.isCharging = false;
                m._isRampingUp = false;
                m.aimAt(tPos.x, tPos.y);
                return;
            }

            const dtMs = dt * 1000;
            m.fireCooldown -= dtMs;

            // Trigger charge up at 2.25s
            if (m.fireCooldown <= 2250 && !m.isCharging && m.fireCooldown > 0) {
                m.isCharging = true;
                v.startCharge(() => {
                    m._isRampingUp = true;
                    m._chargeWobbleTime = 0;
                });
            }

            if (m.fireCooldown <= 2000 && !m.chargeAttackPlayed && m.fireCooldown > 0) {
                m.chargeAttackPlayed = true;
            }

            if (m.fireCooldown <= 0) {
                this._fireBullet(tPos.x, tPos.y);
                v.stopCharge();
                m.isCharging = false;
                m._isRampingUp = false;
                m.fireCooldown = MB1.FIRE_INTERVAL;
                m.chargeAttackPlayed = false;
            }
        }
    }

    _fireBullet(targetX, targetY) {
        if (typeof enemyBulletManager !== 'undefined') {
            const m = this.model;
            const dx = targetX - m.x;
            const dy = targetY - m.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const ux = dx / dist;
            const uy = dy / dist;

            enemyBulletManager.fire(
                m.x + ux * 27, m.y + uy * 27,
                targetX, targetY,
                MB1.BULLET_DAMAGE * (1 + ((m.multiplier || 1) - 1) * GAME_CONSTANTS.ENEMY_DAMAGE_SCALING_EFFICIENCY),
                'bullet.png',
                null,
                true,
                100,
                0.0075
            );
        }
    }

    // ── Damage ────────────────────────────────────────────────────────────────

    takeDamage(amount) {
        return super.takeDamage(amount);
    }

    // ── Knockback override ────────────────────────────────────────────────────

    applyKnockback(dirX, dirY, distance) {
        super.applyKnockback(dirX, dirY, distance);

        // After knockback, re-check distance and update state
        const m = this.model;
        const tPos = tower.getPosition();
        const dx = tPos.x - m.x;
        const dy = tPos.y - m.y;
        const distToTower = Math.sqrt(dx * dx + dy * dy);

        if (m.state === MINIBOSS_STATE.ATTACKING && distToTower > MB1.RETREAT_RANGE) {
            m.state = MINIBOSS_STATE.MOVING;
            m.aimAt(tPos.x, tPos.y);
        }
    }
}
