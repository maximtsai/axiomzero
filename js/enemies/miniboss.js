// js/enemies/miniboss.js — Abstract base class for all miniboss types.
//
// Extends Enemy with miniboss-specific behaviour:
//   • Not knockback-immune, but knockback is reduced (knockBackModifier)
//   • Spawns from left/right side only (constrained angle)
//   • Does not scale with wave progression
//   • Does NOT die on tower contact (handled by enemyManager)
//
// Subclasses (Miniboss1, etc.) override activate(), update(), takeDamage().

class Miniboss extends Enemy {
    constructor() {
        super();
        this.isBoss = false;        // minibosses are NOT knockback-immune
        this.isMiniboss = true;     // identification flag
        this.knockBackModifier = 0.4; // default; subclasses override via their own config
    }

    /**
     * Returns a spawn angle constrained to the left or right side of the screen.
     * The angle is within ±(MINIBOSS_SPAWN_ANGLE/2) degrees from horizontal,
     * randomly choosing left (π) or right (0) side.
     * @returns {number} Angle in radians
     */
    static getSpawnAngle() {
        const halfCone = (GAME_CONSTANTS.MINIBOSS_SPAWN_ANGLE / 2) * (Math.PI / 180);
        const side = Math.random() < 0.5 ? 0 : Math.PI; // right or left
        const offset = (Math.random() * 2 - 1) * halfCone; // random within cone
        return side + offset;
    }
}
