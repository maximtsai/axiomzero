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
        super.activate(x, y, {
            maxHealth: GAME_CONSTANTS.ENEMY_BASE_HEALTH * scaleFactor,
            damage: GAME_CONSTANTS.ENEMY_BASE_DAMAGE * scaleFactor,
            selfDamage: GAME_CONSTANTS.ENEMY_BASE_HEALTH * scaleFactor * 3,
            speed: GAME_CONSTANTS.ENEMY_BASE_SPEED,
            size: 19
        });

        this.fireCooldown = 0;
        this.baseAttackInterval = 2500;
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
                'projectile.png',
                GAME_CONSTANTS.ENEMY_PROJECTILE_SPEED // 30% slower
            );
        }
    }

}
