// js/enemies/boss.js — Abstract base class for all boss types (MVC).
//
// Extends EnemyModel/Enemy with shared boss features:
//   • Immune to knockback (isBoss = true).
//   • Does not scale with standard wave progression.
//   • Shared entry speed ramp (burst of speed on spawn that decays to target speed).
//   • Larger base hitbox size.

class BossModel extends EnemyModel {
    constructor(levelScalingModifier = 1) {
        super();
        this.levelScalingModifier = levelScalingModifier;
        this.type = 'boss';
        this.isBoss = true;
        this.isMiniboss = false;
        this.knockBackModifier = 0;

        // Speed ramping state
        this.aliveTime = 0;
        this.baseSpeed = 0;
        this.speedMult = 1.0;
        this.initialSpeedMult = 1.0;
        this.rampDuration = 1.25;

        this.size = 100;
    }

    _applyAimedVelocity() {
        const tx = GAME_CONSTANTS.halfWidth;
        const ty = GAME_CONSTANTS.halfHeight;
        const dx = tx - this.x;
        const dy = ty - this.y;

        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) {
            this.vx = 0;
            this.vy = 0;
            return;
        }

        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const effectiveSpeed = this.baseSpeed * this.speedMult;

        this.vx = (dx / dist) * effectiveSpeed;
        this.vy = (dy / dist) * effectiveSpeed;
    }

    update(dt) {
        if (!this.alive) return;

        // Shared entry speed curve (decaying burst)
        if (this.aliveTime < this.rampDuration) {
            this.aliveTime += dt;
            const progress = Math.min(1.0, this.aliveTime / this.rampDuration);
            this.speedMult = this.initialSpeedMult - ((this.initialSpeedMult - 1.0) * progress);
            this._applyAimedVelocity();
        } else if (this.speedMult !== 1.0) {
            this.speedMult = 1.0;
            this._applyAimedVelocity();
        }

        super.update(dt);
    }
}

class Boss extends Enemy {
    constructor(levelScalingModifier = 1) {
        super();
        this.levelScalingModifier = levelScalingModifier;
        // Subclasses MUST set this.model and this.view
    }

    update(dt) {
        if (!this.model.alive) return;

        this.model.update(dt);
        this.view.syncPosition(this.model.x, this.model.y);
        this.view.updateHPCrop(this.model.getHealthPct());

        // Bosses consistently face their target (the tower)
        this.view.setRotation(this.model.baseRotation);
    }
}
