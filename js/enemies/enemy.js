// js/enemies/enemy.js — Abstract base class for all enemy types.
//
// Defines the shared lifecycle, movement model, and damage contract that every
// enemy must satisfy. Subclasses (BasicEnemy, etc.) supply the Phaser display
// object, per-type stats, and hit visuals.
//
// Conventions for subclasses:
//   • Assign this.img in the constructor.
//   • Override activate(x, y, ...) to set stats, reset visuals, then call super.activate(x, y).
//   • Override update(dt) for non-linear movement (homing, zig-zag, etc.); call super if needed.
//   • Override takeDamage(amount) for hit feedback; always return super.takeDamage(amount).

class Enemy {
    constructor() {
        // Phaser display object — assigned by the subclass constructor
        this.img = null;

        // ── Combat state ──────────────────────────────────────────────────────
        this.alive     = false;
        this.health    = 0;
        this.maxHealth = 0;
        this.damage    = 0;   // damage dealt to the tower on contact
        this.speed     = 0;   // movement speed in px/sec

        // ── Velocity (px/sec) — set by aimAt() or overridden by update() ──────
        this.vx = 0;
        this.vy = 0;

        // ── World position ────────────────────────────────────────────────────
        this.x = 0;
        this.y = 0;
    }

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    /**
     * Activate at (x, y) and make the display object visible.
     * Subclasses set stats and reset visuals BEFORE calling super.activate().
     */
    activate(x, y) {
        this.x     = x;
        this.y     = y;
        this.alive = true;
        if (this.img) {
            this.img.setPosition(x, y);
            this.img.setVisible(true);
            this.img.setActive(true);
        }
    }

    /**
     * Return to the pool — hide and mark as dead.
     */
    deactivate() {
        this.alive = false;
        if (this.img) {
            this.img.setVisible(false);
            this.img.setActive(false);
        }
    }

    // ── Movement ──────────────────────────────────────────────────────────────

    /**
     * Point velocity toward (tx, ty) at this.speed.
     * Call after this.speed is set in activate().
     */
    aimAt(tx, ty) {
        const dx   = tx - this.x;
        const dy   = ty - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        this.vx = (dx / dist) * this.speed;
        this.vy = (dy / dist) * this.speed;
    }

    /**
     * Advance position by velocity * dt and sync the display object.
     * Override for special movement patterns (homing, zig-zag, etc.).
     * @param {number} dt  Delta time in seconds
     */
    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        if (this.img) this.img.setPosition(this.x, this.y);
    }

    // ── Damage ────────────────────────────────────────────────────────────────

    /**
     * Apply damage. Returns true if health reached 0 (enemy should die).
     * Override to add hit visuals; always call and return super.takeDamage(amount).
     * @param   {number}  amount
     * @returns {boolean} true if the enemy died
     */
    takeDamage(amount) {
        this.health -= amount;
        if (this.health <= 0) {
            this.health = 0;
            return true;
        }
        return false;
    }

    /** Texture key shared by all enemy instances. */
    static get TEX_KEY() { return 'enemies'; }
}
