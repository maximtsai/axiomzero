// js/enemies/shooter_enemy.js — Standard enemy that stops and shoots bullets
//
// Behaviour:
//   • Speeds and health matched with basic enemy.
//   • Stops at 120px from tower and fires bullets via enemyBulletManager
//   • Deals 1 base damage per bullet.

const SHOOTER_STATE = {
    MOVING: 'MOVING',
    ATTACKING: 'ATTACKING',
};

class ShooterEnemy extends Enemy {
    constructor() {
        super();
        this.type = 'shooter';
        this.baseResourceDrop = 2;
        this.img = PhaserScene.add.image(0, 0, Enemy.TEX_KEY, 'shooter.png');
        this.img.setDepth(GAME_CONSTANTS.DEPTH_ENEMIES);
        this.img.setVisible(false);
        this.img.setActive(false);

        // UI: Health sprite overlay
        this.hpImg = PhaserScene.add.image(0, 0, Enemy.TEX_KEY, 'shooter_enemy_hp.png');
        this.hpImg.setDepth(GAME_CONSTANTS.DEPTH_ENEMIES);
        this.hpImg.setVisible(false);
        this.hpImg.setActive(false);

        this.state = SHOOTER_STATE.MOVING;
        this.fireCooldown = 0;
        this.baseProjectileDamage = 1.5;
        this.projectileDamage = 1;
    }

    activate(x, y, scaleFactor) {
        this.maxHealth = GAME_CONSTANTS.ENEMY_BASE_HEALTH * scaleFactor;
        this.health = this.maxHealth;
        this.selfDamage = 0;
        this.damage = GAME_CONSTANTS.ENEMY_BASE_DAMAGE * scaleFactor; // Deals damage if it touches base
        this.projectileDamage = this.baseProjectileDamage * scaleFactor;
        this.speed = GAME_CONSTANTS.ENEMY_BASE_SPEED;
        this.size = 12;

        this.state = SHOOTER_STATE.MOVING;
        this.fireCooldown = 0;

        if (this.img) {
            this.img.setAlpha(1);
            this.img.setScale(1);
        }
        if (this.hpImg) {
            this.hpImg.setAlpha(1);
            this.hpImg.setScale(1);
        }

        super.activate(x, y);
    }

    update(dt) {
        const tPos = tower.getPosition();
        const dx = tPos.x - this.x;
        const dy = tPos.y - this.y;
        const distToTower = Math.sqrt(dx * dx + dy * dy);

        if (this.state === SHOOTER_STATE.MOVING) {
            super.update(dt);

            if (distToTower <= 110) {
                this.state = SHOOTER_STATE.ATTACKING;
                this.vx = 0;
                this.vy = 0;
                this.fireCooldown = 0;
            }
        } else if (this.state === SHOOTER_STATE.ATTACKING) {
            if (distToTower > 110) {
                this.state = SHOOTER_STATE.MOVING;
                this.aimAt(tPos.x, tPos.y);
                return;
            }

            // Keep facing the tower just in case
            this.baseRotation = Math.atan2(dy, dx);
            this.setRotation(this.baseRotation);

            this.vx = 0;
            this.vy = 0;

            const dtMs = dt * 1000;
            if (this.fireCooldown <= 0) {
                this._fireBullet(tPos.x, tPos.y);
                this.fireCooldown = 2500; // fires every 2.5 seconds
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
                this.projectileDamage,
                'projectile.png'
            );
        }
    }

    takeDamage(amount) {
        const died = super.takeDamage(amount);

        if (this.img) {
            // Rotation wobble on hit
            const wobble = Phaser.Math.FloatBetween(-0.3, 0.3);
            this.setRotation(this.baseRotation + wobble);
            if (this.wobbleAnim) this.wobbleAnim.stop();
            this.wobbleAnim = PhaserScene.tweens.add({
                delay: 75,
                targets: [this.img, this.hpImg],
                rotation: '-=' + wobble,
                duration: 370,
                ease: 'Cubic.easeInOut',
                onComplete: () => {
                    this.setRotation(this.baseRotation);
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
                if (this.hpImg) {
                    PhaserScene.tweens.add({
                        targets: this.hpImg,
                        alpha: { from: 0.5, to: 1 },
                        duration: 80,
                        ease: 'Linear',
                    });
                }
            }
        }

        return died;
    }
}
