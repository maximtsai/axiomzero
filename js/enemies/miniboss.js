// js/enemies/miniboss.js — Abstract base class for all miniboss types (MVC).
//
// Extends EnemyModel/Enemy with miniboss-specific behaviour:
//   • Not knockback-immune, but knockback is reduced (knockBackModifier)
//   • Spawns from left/right side only (constrained angle)
//   • Does not scale with wave progression
//   • Does NOT die on tower contact (handled by enemyManager)

class MinibossModel extends EnemyModel {
    constructor(levelScalingModifier = 1) {
        super();
        this.levelScalingModifier = levelScalingModifier;
        this.type = 'miniboss';
        this.isBoss = true;
        this.isMiniboss = true;
        this.knockBackModifier = 0;
        this.pushbackScale = 0;
        this.multiplier = 1;
    }
}

class Miniboss extends Enemy {
    constructor(levelScalingModifier = 1) {
        super();
        this.levelScalingModifier = levelScalingModifier;
        this.multiplier = 1;
        // Subclasses MUST set this.model and this.view
    }

    /**
     * Returns a spawn angle constrained to the left or right side of the screen.
     * @returns {number} Angle in radians
     */
    static getSpawnAngle() {
        const halfCone = (GAME_CONSTANTS.MINIBOSS_SPAWN_ANGLE / 2) * (Math.PI / 180);
        const side = Math.random() < 0.5 ? 0 : Math.PI;
        const offset = (Math.random() * 2 - 1) * halfCone;
        return side + offset;
    }
}
