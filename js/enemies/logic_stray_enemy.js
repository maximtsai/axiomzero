// js/enemies/logic_stray_enemy.js — Rare stray enemy that doesn't target the tower.
//
// Behaviour:
//   • Steady 1 rotation / 3 seconds (manual rotation).
//   • 2x basic enemy health.
//   • 0 damage, 0 self-damage.
//   • Angles its flight path 1.0 radians away from the tower.
//   • Once damaged: 2x speed and 2x rotation speed.
//   • Deactivates if > 1150px from tower (X or Y).
//   • Drops PROCESSOR resources instead of DATA.

class LogicStrayEnemy extends Enemy {
    constructor() {
        super();
        this.type = 'logic_stray';
        this.baseResourceDrop = 0; // Drops custom resources on death

        this.img = PhaserScene.add.image(0, 0, Enemy.TEX_KEY, 'logic_stray.png');
        this.img.setVisible(false);
        this.img.setActive(false);

        this.hpImg = PhaserScene.add.image(0, 0, Enemy.TEX_KEY, 'logic_stray_enemy_hp.png');
        this.hpImg.setDepth(GAME_CONSTANTS.DEPTH_ENEMIES);
        this.hpImg.setVisible(false);
        this.hpImg.setActive(false);

        this.cannotRotate = true; // We handle rotation manually
        this.isEnraged = false;
        this.rotationTime = 0;
        this.baseRotationSpeed = (Math.PI * 2) / 3; // 1 rotation per 3s
    }

    activate(x, y, scaleFactor) {
        this.maxHealth = GAME_CONSTANTS.ENEMY_BASE_HEALTH * scaleFactor * 2;
        this.health = this.maxHealth;
        this.speed = GAME_CONSTANTS.ENEMY_BASE_SPEED;
        this.damage = 0;
        this.selfDamage = 0;
        this.size = 14;
        this.isEnraged = false;
        this.rotationTime = Math.random() * 3; // Random start phase

        if (this.img) {
            this.img.setAlpha(1);
            this.img.setScale(1);
            this.img.setTint(0xffffff);
        }
        if (this.hpImg) {
            this.hpImg.setAlpha(1);
            this.hpImg.setScale(1);
        }

        super.activate(x, y);

        // Movement logic: angle 0.25 rad away from tower
        const dx = GAME_CONSTANTS.halfWidth - x;
        const dy = GAME_CONSTANTS.halfHeight - y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;

        const baseAngle = Math.atan2(dy, dx);
        const deviation = (Math.random() < 0.5 ? -1 : 1) * 1.0;
        const finalAngle = baseAngle + deviation;

        this.vx = Math.cos(finalAngle) * this.speed;
        this.vy = Math.sin(finalAngle) * this.speed;
    }

    update(dt) {
        // Enrage check: double speed and rotation speed if health < maxHealth
        if (!this.isEnraged && this.health < this.maxHealth) {
            this.isEnraged = true;
            this.speed *= 2;
            // Update velocity to match new speed
            const mag = Math.sqrt(this.vx * this.vx + this.vy * this.vy) || 1;
            this.vx = (this.vx / mag) * this.speed;
            this.vy = (this.vy / mag) * this.speed;
        }

        // Manual rotation
        const rotMult = this.isEnraged ? 2 : 1;
        this.rotationTime += dt * rotMult;
        const currentRot = this.rotationTime * this.baseRotationSpeed;

        // Apply rotation to both images (override setRotation bypass)
        if (this.img) this.img.setRotation(currentRot);
        if (this.hpImg) this.hpImg.setRotation(currentRot);

        super.update(dt);

        // Auto-cleanup if too far from tower
        const dx = Math.abs(this.x - GAME_CONSTANTS.halfWidth);
        const dy = Math.abs(this.y - GAME_CONSTANTS.halfHeight);
        if (dx > 1150 || dy > 1150) {
            this.deactivate();
        }
    }

    takeDamage(amount) {
        const died = super.takeDamage(amount);

        if (this.img && this.img.scene) {
            // Standard hit flicker already handled by super? 
            // Actually subclasses often add their own wobble.
            // USER specified: "Once damaged, starts spinning twice as fast and moves twice as fast"
            // This is handled in update to avoid state issues mid-damage-calc.
        }

        return died;
    }
}
