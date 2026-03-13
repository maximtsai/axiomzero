// js/enemies/shooter_enemy.js — Standard enemy that stops and shoots bullets (MVC).
//
// Behaviour:
//   • Speeds and health matched with basic enemy.
//   • Stops at 120px from tower and fires bullets via enemyBulletManager.
//   • Deals 1 base damage per bullet.

const SHOOTER_STATE = {
    MOVING: 'MOVING',
    ATTACKING: 'ATTACKING',
};

class ShooterEnemyModel extends EnemyModel {
    constructor() {
        super();
        this.type = 'shooter';
        this.baseResourceDrop = 2;
        this.state = SHOOTER_STATE.MOVING;
        this.fireCooldown = 0;
        this.baseProjectileDamage = 1.5;
        this.projectileDamage = 1;
        this.baseAttackInterval = 2500;
    }
}

class ShooterEnemyView extends EnemyView {
    constructor() {
        super(Enemy.TEX_KEY, 'shooter.png', 'shooter_enemy_hp.png', GAME_CONSTANTS.DEPTH_ENEMIES);
    }
}

class ShooterEnemy extends Enemy {
    constructor() {
        super();
        this.model = new ShooterEnemyModel();
        this.view = new ShooterEnemyView();
    }

    activate(x, y, scaleFactor) {
        super.activate(x, y, {
            maxHealth: GAME_CONSTANTS.ENEMY_BASE_HEALTH * scaleFactor,
            damage: GAME_CONSTANTS.ENEMY_BASE_DAMAGE * scaleFactor,
            selfDamage: GAME_CONSTANTS.ENEMY_BASE_HEALTH * scaleFactor * 3,
            speed: GAME_CONSTANTS.ENEMY_BASE_SPEED,
            size: 19
        });

        this.model.fireCooldown = 0;
        this.model.baseAttackInterval = 2500;
        this.model.state = SHOOTER_STATE.MOVING;
    }

    update(dt) {
        const m = this.model;
        const tPos = tower.getPosition();
        const dx = tPos.x - m.x;
        const dy = tPos.y - m.y;
        const distToTower = Math.sqrt(dx * dx + dy * dy);

        if (m.state === SHOOTER_STATE.MOVING) {
            super.update(dt);

            if (distToTower <= 120) {
                m.state = SHOOTER_STATE.ATTACKING;
                m.vx = 0;
                m.vy = 0;
                m.fireCooldown = 0;
            }
        } else if (m.state === SHOOTER_STATE.ATTACKING) {
            if (distToTower > 130) {
                m.state = SHOOTER_STATE.MOVING;
                m.aimAt(tPos.x, tPos.y);
                return;
            }

            // Keep facing the tower
            m.baseRotation = Math.atan2(dy, dx);
            this.view.setRotation(m.baseRotation);

            m.vx = 0;
            m.vy = 0;

            const dtMs = dt * 1000;
            if (m.fireCooldown <= 0) {
                this._fireBullet(tPos.x, tPos.y);
                m.fireCooldown = 2500;
            } else {
                m.fireCooldown -= dtMs;
            }
        }
    }

    _fireBullet(targetX, targetY) {
        if (typeof enemyBulletManager !== 'undefined') {
            enemyBulletManager.fire(
                this.model.x, this.model.y,
                targetX, targetY,
                this.model.projectileDamage,
                'projectile.png',
                GAME_CONSTANTS.ENEMY_PROJECTILE_SPEED
            );
        }
    }
}
