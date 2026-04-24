// js/enemies/logic_stray_enemy.js — Rare stray enemy that doesn't target the tower (MVC).
//
// Behaviour:
//   • Steady 1 rotation / 3 seconds (manual rotation).
//   • 2x basic enemy health.
//   • 0 damage, 0 self-damage.
//   • Angles its flight path 0.3 radians away from the tower.
//   • Once damaged: 3x speed and 1 rotation per second (3x rotation speed).
//   • Deactivates if > 1150px from tower (X or Y).
//   • Drops PROCESSOR resources instead of DATA.

class LogicStrayEnemyModel extends EnemyModel {
    constructor() {
        super();
        this.type = 'logic_stray';
        this.baseResourceDrop = 0;
        this.cannotRotate = true;
        this.isEnraged = false;
        this.rotationTime = 0;
        this.baseRotationSpeed = (Math.PI * 2) / 3; // 1 rotation per 3s
        this.ghostTimer = 0;
    }
}

class LogicStrayEnemyView extends EnemyView {
    constructor() {
        super(Enemy.TEX_KEY, 'logic_stray.png', 'logic_stray_enemy_hp.png', GAME_CONSTANTS.DEPTH_ENEMIES);
    }

    setManualRotation(rot) {
        if (this.img) this.img.setRotation(rot);
        if (this.hpImg) this.hpImg.setRotation(rot);
    }
}

class LogicStrayEnemy extends Enemy {
    constructor() {
        super();
        this.model = new LogicStrayEnemyModel();
        this.view = new LogicStrayEnemyView();
    }

    activate(x, y, scaleFactor) {
        const m = this.model;
        m.maxHealth = GAME_CONSTANTS.ENEMY_BASE_HEALTH * scaleFactor * 2;
        m.health = m.maxHealth;
        m.speed = GAME_CONSTANTS.ENEMY_BASE_SPEED;
        m.damage = 0;
        m.selfDamage = 0;
        m.size = 25;
        m.isEnraged = false;
        m.rotationTime = Math.random() * 3;
        m.ghostTimer = 0;

        if (this.view.img) {
            this.view.img.setAlpha(1);
            this.view.img.setScale(1);
            this.view.img.setTint(0xffffff);
        }
        if (this.view.hpImg) {
            this.view.hpImg.setAlpha(1);
            this.view.hpImg.setScale(1);
        }

        super.activate(x, y);
    }

    update(dt) {
        const m = this.model;

        // Enrage check
        if (!m.isEnraged && m.health < m.maxHealth) {
            m.isEnraged = true;
            m.speed *= 3;
            const mag = Math.sqrt(m.vx * m.vx + m.vy * m.vy) || 1;
            m.vx = (m.vx / mag) * m.speed;
            m.vy = (m.vy / mag) * m.speed;
        }

        // Manual rotation
        const rotMult = m.isEnraged ? 3 : 1;
        m.rotationTime += dt * rotMult;
        const currentRot = m.rotationTime * m.baseRotationSpeed;
        this.view.setManualRotation(currentRot);

        // Ghost trail every 1.25s
        m.ghostTimer += dt;
        if (m.ghostTimer >= 1.25) {
            m.ghostTimer %= 1.25;
            if (this.view.img) {
                customEmitters.logicStrayGhost(m.x, m.y, this.view.img.rotation, this.view.img.scaleX);
            }
        }

        super.update(dt);

        // Auto-cleanup if too far from tower
        const dx = Math.abs(m.x - GAME_CONSTANTS.halfWidth);
        const dy = Math.abs(m.y - GAME_CONSTANTS.halfHeight);
        if (dx > 1150 || dy > 1150) {
            this.deactivate();
        }
    }

    aimAt(tx, ty) {
        const m = this.model;
        // Divert flight path by 0.3 rad away from target
        const dx = tx - m.x;
        const dy = ty - m.y;

        const baseAngle = Math.atan2(dy, dx);
        const deviation = (Math.random() < 0.5 ? -1 : 1) * 0.3;
        const finalAngle = baseAngle + deviation;

        m.vx = Math.cos(finalAngle) * m.speed;
        m.vy = Math.sin(finalAngle) * m.speed;
    }

    onDeath(isFinal = true) {
        if (typeof resourceManager !== 'undefined') {
            resourceManager.spawnProcessorDrop(this.model.x, this.model.y);
        }
    }
}
