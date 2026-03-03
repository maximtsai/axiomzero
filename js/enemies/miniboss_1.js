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
    HEALTH: 50,
    SPEED_MULT: 1.5,   // × ENEMY_BASE_SPEED
    ATTACK_RANGE: 200,   // px — stop and attack
    RETREAT_RANGE: 240,   // px — resume movement if pushed past this
    FIRE_INTERVAL: 3000,  // ms between shots
    BULLET_DAMAGE: 4,
    KNOCKBACK_MOD: 0.4,   // 60% knockback reduction
};

const MINIBOSS_STATE = {
    MOVING: 'MOVING',
    ATTACKING: 'ATTACKING',
};

class Miniboss1 extends Miniboss {
    constructor() {
        super();
        this.img = PhaserScene.add.image(0, 0, Enemy.TEX_KEY, 'miniboss_1.png');
        this.img.setDepth(GAME_CONSTANTS.DEPTH_ENEMIES + 2);
        this.img.setVisible(false);
        this.img.setActive(false);

        this.state = MINIBOSS_STATE.MOVING;
        this.fireCooldown = 0;
    }

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    activate(x, y) {
        this.maxHealth = MB1.HEALTH;
        this.health = this.maxHealth;
        this.damage = 0; // miniboss does NOT deal contact damage
        this.speed = GAME_CONSTANTS.ENEMY_BASE_SPEED * MB1.SPEED_MULT;
        this.knockBackModifier = MB1.KNOCKBACK_MOD;

        this.state = MINIBOSS_STATE.MOVING;
        this.fireCooldown = 0; // starts at 0 so first shot fires immediately on entering range

        // Reset visuals
        if (this.img) {
            this.img.setAlpha(1);
            this.img.setScale(1);
            this.img.setTint(GAME_CONSTANTS.COLOR_HOSTILE);
        }

        super.activate(x, y);
    }

    // ── Per-frame ─────────────────────────────────────────────────────────────

    update(dt) {
        const tPos = tower.getPosition();
        const dx = tPos.x - this.x;
        const dy = tPos.y - this.y;
        const distToTower = Math.sqrt(dx * dx + dy * dy);

        if (this.state === MINIBOSS_STATE.MOVING) {
            // Move toward tower
            super.update(dt);

            // Check if within attack range
            if (distToTower <= MB1.ATTACK_RANGE) {
                this.state = MINIBOSS_STATE.ATTACKING;
                this.vx = 0;
                this.vy = 0;
                this.fireTimer = 0;
            }
        } else if (this.state === MINIBOSS_STATE.ATTACKING) {
            // Check if pushed out of range
            if (distToTower > MB1.RETREAT_RANGE) {
                this.state = MINIBOSS_STATE.MOVING;
                this.aimAt(tPos.x, tPos.y);
                return;
            }

            // Fire cooldown: counts down to 0, fires immediately when ready
            const dtMs = dt * 1000;
            if (this.fireCooldown <= 0) {
                this._fireBullet(tPos.x, tPos.y);
                this.fireCooldown = MB1.FIRE_INTERVAL;
            } else {
                this.fireCooldown -= dtMs;
            }
        }
    }

    _fireBullet(targetX, targetY) {
        if (typeof enemyBulletManager !== 'undefined') {
            enemyBulletManager.fire(
                this.x, this.y,
                targetX, targetY,
                MB1.BULLET_DAMAGE
            );
        }
    }

    // ── Damage ────────────────────────────────────────────────────────────────

    takeDamage(amount) {
        const died = super.takeDamage(amount);

        if (this.img) {
            // Health-proportional tint shift: hostile color → white
            const ratio = Math.max(0, this.health / this.maxHealth);
            const hR = (GAME_CONSTANTS.COLOR_HOSTILE >> 16) & 0xff;
            const hG = (GAME_CONSTANTS.COLOR_HOSTILE >> 8) & 0xff;
            const hB = GAME_CONSTANTS.COLOR_HOSTILE & 0xff;
            const r = Math.round(hR + (255 - hR) * (1 - ratio));
            const g = Math.round(hG + (255 - hG) * (1 - ratio));
            const b = Math.round(hB + (255 - hB) * (1 - ratio));
            this.img.setTint((r << 16) | (g << 8) | b);

            // Rotation wobble on hit
            const wobble = Phaser.Math.FloatBetween(-0.3, 0.3);
            this.img.setRotation(this.baseRotation + wobble);
            if (this.wobbleAnim) this.wobbleAnim.stop();
            this.wobbleAnim = PhaserScene.tweens.add({
                delay: 75,
                targets: this.img,
                rotation: '-=' + wobble,
                duration: 370,
                ease: 'Cubic.easeInOut',
                onComplete: () => {
                    this.img.setRotation(this.baseRotation);
                    this.wobbleAnim = null;
                }
            });

            // Alpha flicker
            if (this.img.scene) {
                PhaserScene.tweens.add({
                    targets: this.img,
                    alpha: { from: 0.5, to: 1 },
                    duration: 80,
                    ease: 'Linear',
                });
            }
        }

        return died;
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
            // aimAt will be called once velocity is restored (after knockback stun)
            PhaserScene.time.delayedCall(160, () => {
                if (this.alive) {
                    this.aimAt(tPos.x, tPos.y);
                }
            });
        }
    }
}
