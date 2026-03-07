// js/enemies/miniboss_1.js — First miniboss type: ranged attacker.
//
// Behaviour:
//   • Beelines toward the tower at 1.5× normal enemy speed.
//   • At 200px from tower, stops and enters ATTACKING state.
//   • Fires 1 bullet every 3 seconds via enemyBulletManager.
//   • If knocked back past 240px, re-enters MOVING state.
//   • 50 HP, no wave scaling. Drops 1 SHARD on death.
//   • Tint shifts from hostile color toward white as health drops.

/** Local config — owned by this class, not exposed to globals. */
const MB1 = {
    HEALTH: 60,
    SPEED_MULT: 1.5,   // × ENEMY_BASE_SPEED
    ATTACK_RANGE: 180,   // px — stop and attack
    RETREAT_RANGE: 220,   // px — resume movement if pushed past this
    FIRE_INTERVAL: 3000,  // ms between shots
    BULLET_DAMAGE: 4,
    KNOCKBACK_MOD: 0,   // 0 knockback
    SPAWN_BURST_DURATION: 2,    // seconds — speed burst on spawn
    SPAWN_BURST_MULT: 7,    // initial speed multiplier at spawn (fades to 1×)
};

const MINIBOSS_STATE = {
    MOVING: 'MOVING',
    ATTACKING: 'ATTACKING',
};

class Miniboss1 extends Miniboss {
    constructor() {
        super();
        this.isMiniboss = true;
        this.img = PhaserScene.add.image(0, 0, Enemy.TEX_KEY, 'miniboss_1.png');
        this.img.setDepth(GAME_CONSTANTS.DEPTH_ENEMIES + 2);
        this.img.setVisible(false);
        this.img.setActive(false);

        // TODO: Swap out special HP sprite per enemy type
        this.hpImg = PhaserScene.add.image(0, 0, Enemy.TEX_KEY, 'miniboss_1_enemy_hp.png');
        this.hpImg.setDepth(GAME_CONSTANTS.DEPTH_ENEMIES + 2);
        this.hpImg.setVisible(false);
        this.hpImg.setActive(false);

        this.state = MINIBOSS_STATE.MOVING;
        this.fireCooldown = 0;

        // Charge-up visual indicator
        this.chargeSprite = PhaserScene.add.image(0, 0, Enemy.TEX_KEY, 'chargeup.png');
        this.chargeSprite.setDepth(GAME_CONSTANTS.DEPTH_ENEMIES + 3);
        this.chargeSprite.setVisible(false);
        this.isCharging = false;
        this._isRampingUp = false;
        this._chargeWobbleTime = 0;
    }

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    activate(x, y) {
        this.maxHealth = MB1.HEALTH;
        this.health = this.maxHealth;
        this.damage = 0; // miniboss does NOT deal contact damage
        this.speed = GAME_CONSTANTS.ENEMY_BASE_SPEED * MB1.SPEED_MULT;
        this.knockBackModifier = MB1.KNOCKBACK_MOD;
        this.size = 70;

        this.state = MINIBOSS_STATE.MOVING;
        this.fireCooldown = MB1.FIRE_INTERVAL; // Give full cooldown instead of 0
        this._spawnBurstElapsed = 0; // seconds elapsed since spawn — drives the speed burst

        // Reset visuals
        if (this.img) {
            this.img.setAlpha(1);
            this.img.setScale(1);
            this.img.clearTint();
        }
        if (this.hpImg) {
            this.hpImg.setAlpha(1);
            this.hpImg.setScale(1);
        }

        if (this.chargeSprite) {
            PhaserScene.tweens.killTweensOf(this.chargeSprite);
            this.chargeSprite.setVisible(false);
            this.chargeSprite.setScale(0.2);
            this.chargeSprite.setAlpha(1);
        }
        this.isCharging = false;
        this._isRampingUp = false;

        super.activate(x, y);
    }

    deactivate() {
        super.deactivate();
        if (this.chargeSprite) {
            PhaserScene.tweens.killTweensOf(this.chargeSprite);
            this.chargeSprite.setVisible(false);
        }
        this.isCharging = false;
        this._isRampingUp = false;
    }

    // ── Per-frame ─────────────────────────────────────────────────────────────

    update(dt) {
        const tPos = tower.getPosition();
        const dx = tPos.x - this.x;
        const dy = tPos.y - this.y;
        const distToTower = Math.sqrt(dx * dx + dy * dy);

        if (this.state === MINIBOSS_STATE.MOVING) {
            // Spawn burst: 7× speed at t=0, linearly fading to 1× over SPAWN_BURST_DURATION seconds
            let burstMult = 1;
            if (this._spawnBurstElapsed < MB1.SPAWN_BURST_DURATION) {
                const t = this._spawnBurstElapsed / MB1.SPAWN_BURST_DURATION;
                burstMult = MB1.SPAWN_BURST_MULT + (1 - MB1.SPAWN_BURST_MULT) * t;
                this._spawnBurstElapsed += dt;
            }

            // Move toward tower (scale dt by burst multiplier)
            super.update(dt * burstMult);

            // Check if within attack range
            if (distToTower <= MB1.ATTACK_RANGE) {
                this.state = MINIBOSS_STATE.ATTACKING;
                this.vx = 0;
                this.vy = 0;
                this.fireTimer = 0;
            }
        } else if (this.state === MINIBOSS_STATE.ATTACKING) {
            this.baseRotation = Math.atan2(dy, dx);
            this.setRotation(this.baseRotation);

            // Sync charge sprite position if it's active
            if (this.chargeSprite && this.chargeSprite.visible) {
                const dist = Math.max(1, distToTower);
                const ux = dx / dist;
                const uy = dy / dist;
                // Offset 41px towards player
                this.chargeSprite.setPosition(this.x + ux * 41, this.y + uy * 41);
                this.chargeSprite.setRotation(0); // Forced to 0 rotation

                if (this._isRampingUp) {
                    this._chargeWobbleTime += dt;
                    const wx = Math.sin(this._chargeWobbleTime * 25) * 0.06;
                    const wy = Math.cos(this._chargeWobbleTime * 21) * 0.06;
                    const baseScale = this.chargeSprite.scaleX;
                    this.chargeSprite.scaleX = baseScale + wx;
                    this.chargeSprite.scaleY = baseScale + wy;
                }
            }

            // Check if pushed out of range
            if (distToTower > MB1.RETREAT_RANGE) {
                this.state = MINIBOSS_STATE.MOVING;
                this._stopCharge();
                this.aimAt(tPos.x, tPos.y);
                return;
            }

            const dtMs = dt * 1000;
            this.fireCooldown -= dtMs;

            // Trigger charge up at 2.25s (250ms pop + 350ms shrink + 1600ms build + 50ms peak)
            if (this.fireCooldown <= 2250 && !this.isCharging && this.fireCooldown > 0) {
                this._startCharge();
            }

            if (this.fireCooldown <= 0) {
                this._fireBullet(tPos.x, tPos.y);
                this._stopCharge();
                this.fireCooldown = MB1.FIRE_INTERVAL;
            }
        }
    }

    _startCharge() {
        if (!this.chargeSprite) return;
        this.isCharging = true;
        this.chargeSprite.setVisible(true);
        this.chargeSprite.setScale(0.2);
        this.chargeSprite.setAlpha(1);

        PhaserScene.tweens.killTweensOf(this.chargeSprite);

        // Match specialized Sniper timings updated by user
        PhaserScene.tweens.add({
            targets: this.chargeSprite,
            scale: 1.1,
            duration: 250,
            ease: 'Quad.easeIn',
            onComplete: () => {
                if (!this.isCharging) return;
                PhaserScene.tweens.add({
                    targets: this.chargeSprite,
                    scale: 0.4,
                    alpha: 0.7,
                    duration: 350,
                    ease: 'Quad.easeOut',
                    onComplete: () => {
                        if (!this.isCharging) return;
                        this._isRampingUp = true;
                        this._chargeWobbleTime = 0;
                        PhaserScene.tweens.add({
                            targets: this.chargeSprite,
                            scale: 1.2,
                            alpha: 1,
                            duration: 1600,
                            ease: 'Linear',
                            onComplete: () => {
                                if (!this.isCharging) return;
                                // Stage 4: Final jump (duration is approx 0.05s based on trigger)
                                this._isRampingUp = false;
                                this.chargeSprite.setScale(1.4);
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
            const dx = targetX - this.x;
            const dy = targetY - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const ux = dx / dist;
            const uy = dy / dist;

            enemyBulletManager.fire(
                this.x + ux * 20, this.y + uy * 20,
                targetX, targetY,
                MB1.BULLET_DAMAGE
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

        // After knockback, re-check distance and update state if needed
        const tPos = tower.getPosition();
        const dx = tPos.x - this.x;
        const dy = tPos.y - this.y;
        const distToTower = Math.sqrt(dx * dx + dy * dy);

        if (this.state === MINIBOSS_STATE.ATTACKING && distToTower > MB1.RETREAT_RANGE) {
            this.state = MINIBOSS_STATE.MOVING;
            this.aimAt(tPos.x, tPos.y);
        }
    }
}
