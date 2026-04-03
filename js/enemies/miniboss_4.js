// js/enemies/miniboss_4.js — Sniper miniboss type: ultra long-range specialist (MVC).
//
// Behaviour:
//   • Moves at 0.9x base speed (same as standard sniper).
//   • Stops at 425px from tower (standard sniper + 175).
//   • Fires a flat 15 damage projectile.
//   • Long charge time (3.75s) and slow attack cooldown (6s).

const MB4 = {
    HEALTH: 260,
    SPEED_MULT: 0.9,
    ATTACK_RANGE: 425,
    FIRE_INTERVAL: 6000,
    CHARGE_DURATION: 3750,
    DAMAGE: 15,
};

class Miniboss4Model extends MinibossModel {
    constructor(levelScalingModifier = 1) {
        super(levelScalingModifier);
        this.isMiniboss = true;
        this.type = 'miniboss_4';
        this.state = 'MOVING';
        this.fireCooldown = 0;
        this.isCharging = false;
        this._isRampingUp = false;
        this._chargeWobbleTime = 0;
        this.cannotRotate = true; // Intended: does not rotate to face tower (Sniper style)
        
        // Use standard initial speed boost for minibosses
        this.initialSpeedMult = 7;
        this.rampDuration = 2;
    }
}

class Miniboss4View extends EnemyView {
    constructor() {
        // High depth for minibosses
        super(Enemy.TEX_KEY, 'miniboss_sniper.png', 'miniboss_sniper_hp.png', GAME_CONSTANTS.DEPTH_ENEMIES + 2);
        
        // HP bar rotated 90 deg CCW like original sniper
        this.hpImg.setRotation(-Math.PI / 2);

        // Charge-up visual indicator
        this.chargeSprite = PhaserScene.add.image(0, 0, Enemy.TEX_KEY, 'chargeup.png');
        this.chargeSprite.setDepth(GAME_CONSTANTS.DEPTH_ENEMIES + 3);
        this.chargeSprite.setVisible(false);
    }

    startCharge() {
        if (!this.chargeSprite) return;
        this.chargeSprite.setVisible(true);
        this.chargeSprite.setScale(0.25); // Slightly bigger scale for miniboss
        this.chargeSprite.setAlpha(1);

        PhaserScene.tweens.killTweensOf(this.chargeSprite);

        // Pop feel from MB1/Sniper
        PhaserScene.tweens.add({
            targets: this.chargeSprite,
            scale: 1.25,
            duration: 250,
            ease: 'Quad.easeIn',
            onComplete: () => {
                if (!this.chargeSprite.visible) return;
                PhaserScene.tweens.add({
                    targets: this.chargeSprite,
                    scale: 0.6,
                    alpha: 0.7,
                    duration: 350,
                    ease: 'Quad.easeOut',
                    onComplete: () => {
                        if (!this.chargeSprite.visible) return;
                        // Long building swell (3.75s total - 0.25 - 0.35)
                        PhaserScene.tweens.add({
                            targets: this.chargeSprite,
                            scale: 1.6,
                            alpha: 1,
                            duration: 3150,
                            ease: 'Linear',
                            onComplete: () => {
                                if (!this.chargeSprite.visible) return;
                                this.chargeSprite.setScale(1.8);
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
        }
    }

    applyChargeWobble(dt, wobbleTime) {
        if (!this.chargeSprite || !this.chargeSprite.visible) return wobbleTime;
        wobbleTime += dt;
        const wx = Math.sin(wobbleTime * 25) * 0.08;
        const wy = Math.cos(wobbleTime * 21) * 0.08;
        const baseScale = this.chargeSprite.scaleX;
        
        // Intended: wobble is cumulative for a more frantic, unstable visual feel
        this.chargeSprite.scaleX = baseScale + wx;
        this.chargeSprite.scaleY = baseScale + wy;
        return wobbleTime;
    }

    deactivate() {
        super.deactivate();
        this.stopCharge();
    }
}

class Miniboss4 extends Miniboss {
    constructor(levelScalingModifier = 1) {
        super(levelScalingModifier);
        this.model = new Miniboss4Model(levelScalingModifier);
        this.view = new Miniboss4View();
    }

    activate(x, y) {
        const m = this.model;
        const v = this.view;
        
        // Intended: Minibosses/Bosses do not scale with level progression
        m.maxHealth = MB4.HEALTH * (m.multiplier || 1);
        m.health = m.maxHealth;
        m.damage = 15 * (m.multiplier || 1); // Does not deal contact damage usually
        m.speed = GAME_CONSTANTS.ENEMY_BASE_SPEED * MB4.SPEED_MULT;
        m.size = 65;

        m.state = 'MOVING';
        m.fireCooldown = 2000; // First shot delay after entering range
        m.isCharging = false;
        m._isRampingUp = false;
        m._chargeWobbleTime = 0;

        super.activate(x, y, {
            initialSpeedMult: m.initialSpeedMult,
            rampDuration: m.rampDuration
        });
    }

    update(dt) {
        const m = this.model;
        const v = this.view;
        const tPos = tower.getPosition();
        const dx = tPos.x - m.x;
        const dy = tPos.y - m.y;
        const distToTower = Math.sqrt(dx * dx + dy * dy);

        super.update(dt);

        if (m.state === 'MOVING') {
            if (distToTower <= MB4.ATTACK_RANGE) {
                m.state = 'ATTACKING';
                m.vx = 0;
                m.vy = 0;
                m.fireCooldown = MB4.FIRE_INTERVAL * 0.5; // Half cooldown for first shot
            }
        } else if (m.state === 'ATTACKING') {
            // Sync visuals
            v.syncChargePosition(m.x, m.y);
            if (m._isRampingUp) {
                m._chargeWobbleTime = v.applyChargeWobble(dt, m._chargeWobbleTime);
            }

            // Pushed out check
            if (distToTower > MB4.ATTACK_RANGE + 40) {
                m.state = 'MOVING';
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

            // Start charge at CHARGE_DURATION before firing
            if (m.fireCooldown <= MB4.CHARGE_DURATION && !m.isCharging && m.fireCooldown > 0) {
                m.isCharging = true;
                m._isRampingUp = true;
                v.startCharge();
            }

            if (m.fireCooldown <= 0) {
                this._fireBullet(tPos.x, tPos.y);
                v.stopCharge();
                m.isCharging = false;
                m._isRampingUp = false;
                m.fireCooldown = MB4.FIRE_INTERVAL;
            }
        }
    }

    _fireBullet(targetX, targetY) {
        if (typeof enemyBulletManager !== 'undefined') {
            enemyBulletManager.fire(
                this.model.x, this.model.y,
                targetX, targetY,
                MB4.DAMAGE * (1 + ((this.model.multiplier || 1) - 1) * 0.5),
                'sniper_projectile.png',
                550, // Ultra fast projectile
                true, // isCritical/Heavy
                140, // Sound detune
                0.012, // Extra screenshake on hit
                'sniper_bullet'
            );
            
            if (typeof audio !== 'undefined') {
                audio.play('gunshot', 1.0, false, false, 0).detune = -400; // Deep boom
            }
            if (typeof cameraManager !== 'undefined') {
                cameraManager.shake(200, 0.015);
            }
        }
    }
}
