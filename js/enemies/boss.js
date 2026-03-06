// js/enemies/boss.js — Abstract base class for all boss types.
//
// Extends Enemy with shared boss features:
//   • Immune to knockback (isBoss = true).
//   • Does not scale with standard wave progression (controlled by waveManager).
//   • Shared entry speed ramp (burst of speed on spawn that decay to target speed).
//   • Larger base hitbox size.

class Boss extends Enemy {
    constructor() {
        super();
        this.type = 'boss';
        this.isBoss = true;       // Immune to knockback
        this.isMiniboss = false;
        this.knockBackModifier = 0; // Absolute immunity

        // Shared speed ramping state
        this.aliveTime = 0;
        this.baseSpeed = 0;        // Target speed after ramp ends
        this.speedMult = 1.0;      // Current multiplier
        this.initialSpeedMult = 1.0; // Start mult
        this.rampDuration = 1.25;   // Seconds to ramp down to 1.0

        // Base size for boss class (Subclasses expected to double this per GDD)
        this.size = 14;
    }

    _applyAimedVelocity() {
        // Bosses always aim for the tower center
        const tx = GAME_CONSTANTS.halfWidth;
        const ty = GAME_CONSTANTS.halfHeight;
        const dx = tx - this.x;
        const dy = ty - this.y;

        // Protection against divide by zero if boss overlaps tower exactly
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
            // Linear lerp from initial multiplier down to 1.0 (target)
            this.speedMult = this.initialSpeedMult - ((this.initialSpeedMult - 1.0) * progress);
            this._applyAimedVelocity();
        } else if (this.speedMult !== 1.0) {
            this.speedMult = 1.0;
            this._applyAimedVelocity();
        }

        // Parent handles positioning + HP crop
        super.update(dt);

        // Bosses consistently face their target (the tower)
        this.setRotation(this.baseRotation);
    }
}
