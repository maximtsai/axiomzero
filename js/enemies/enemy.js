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
        this.alive = false;
        this.health = 0;
        this.maxHealth = 0;
        this.damage = 0;   // damage dealt to the tower on contact
        this.size = 0;   // hitbox extent in px — added to AOE range checks
        this.speed = 0;   // movement speed in px/sec
        this.isBoss = false; // if true, knockback does not apply
        this.knockBackModifier = 1; // multiplier for knockback distance (0-1), default 1
        this.stunned = false;
        this.baseResourceDrop = 0;
        this.selfDamage = 0;
        this.cannotRotate = false;
        this.hpImg = null; // Health representing sprite

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
        this.x = x;
        this.y = y;
        this.alive = true;
        this.stunned = false;
        if (this.img) {
            this.img.setPosition(x, y);
            this.img.setVisible(true);
            this.img.setActive(true);

            if (this.hpImg) {
                this.hpImg.setPosition(x, y);
                this.hpImg.setVisible(true);
                this.hpImg.setActive(true);
                this._updateHPCrop();
            }

            if (this.cannotRotate) {
                this.baseRotation = 0;
                this.setRotation(0);
            } else {
                const distToTowerX = GAME_CONSTANTS.halfWidth - x;
                const distToTowerY = GAME_CONSTANTS.halfHeight - y;
                this.baseRotation = Math.atan2(distToTowerY, distToTowerX);
                this.setRotation(this.baseRotation);
            }
        }
    }

    /**
     * Return to the pool — hide and mark as dead.
     */
    deactivate() {
        this.alive = false;
        this.stunned = false;
        if (this.img) {
            PhaserScene.tweens.killTweensOf(this.img);
            this.img.setVisible(false);
            this.img.setActive(false);
        }
        if (this.hpImg) {
            PhaserScene.tweens.killTweensOf(this.hpImg);
            this.hpImg.setVisible(false);
            this.hpImg.setActive(false);
        }
    }

    // ── Movement ──────────────────────────────────────────────────────────────

    setRotation(rot) {
        if (this.cannotRotate) return;
        this.img.setRotation(rot);
        if (this.hpImg) this.hpImg.setRotation(rot);
    }

    /**
     * Point velocity toward (tx, ty) at this.speed.
     * Call after this.speed is set in activate().
     */
    aimAt(tx, ty) {
        const dx = tx - this.x;
        const dy = ty - this.y;
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
        if (!this.stunned) {
            this.x += this.vx * dt;
            this.y += this.vy * dt;
        }
        if (this.img) this.img.setPosition(this.x, this.y);
        if (this.hpImg) {
            this.hpImg.setPosition(this.x, this.y);
            this._updateHPCrop();
        }
    }

    /**
     * Updates the health sprite's cropping based on health percentage.
     * 100% health = full bar
     * < 100% -> scales from 95% down to 5% visible at near-zero.
     */
    _updateHPCrop() {
        if (!this.hpImg) return;

        let pct = this.health / this.maxHealth;
        let cropPct = 1.0;

        if (pct < 1.0) {
            // Map [0.0, 1.0] health to [0.05, 0.95] crop
            cropPct = 0.05 + (pct * 0.90);
        }

        // Apply crop: x, y, width, height (width is based on full texture width)
        const fullWidth = this.hpImg.width;
        const fullHeight = this.hpImg.height;
        this.hpImg.setCrop(0, 0, fullWidth * cropPct, fullHeight);
    }

    /**
     * Restore the enemy's color/tint. Default is clear, but subclasses with
     * dynamic coloring (e.g. health-based) should override this.
     */
    refreshTint() {
        if (this.img && this.img.scene) {
            this.img.clearTint();
        }
        if (this.hpImg && this.hpImg.scene) {
            this.hpImg.clearTint();
        }
    }

    // ── Damage ────────────────────────────────────────────────────────────────

    /**
     * Apply damage. Returns true if health reached 0 (enemy should die).
     * Override to add hit visuals; always call and return super.takeDamage(amount).
     * @param   {number}  amount
     * @returns {boolean} true if the enemy died
     */
    takeDamage(amount) {
        this.lastDamageWasProtected = false;

        // Protector aura logic
        if (this.type !== 'protector') {
            const protectors = typeof enemyManager !== 'undefined' ? enemyManager.getActiveProtectors() : [];
            let protectedBy = null;
            for (let i = 0; i < protectors.length; i++) {
                const p = protectors[i];
                const dx = this.x - p.x;
                const dy = this.y - p.y;
                if ((dx * dx + dy * dy) <= GAME_CONSTANTS.PROTECTOR_AURA_SQUARED) {
                    protectedBy = p;
                    break; // Just need one
                }
            }

            if (protectedBy) {
                amount = Math.ceil(amount * 0.5);
                this.lastDamageWasProtected = true;
                protectedBy.triggerAuraDefend();
            }
        }

        this.lastDamageAmount = amount;
        this.health -= amount;

        // White hit flash — applies to all enemy types/damage sources
        if (this.img && this.img.scene) {
            this.img.setTintFill(0xffffff);
            if (this.hpImg) this.hpImg.setTintFill(0xffffff);

            PhaserScene.time.delayedCall(135, () => {
                this.refreshTint();
            });
        }

        this._updateHPCrop();

        if (this.health <= 0) {
            this.health = 0;
            return true;
        }
        return false;
    }

    /**
     * Apply knockback in direction (dirX, dirY) for stunDuration ms.
     * Non-bosses are pushed back and temporarily stop. Affected by knockBackModifier.
     * @param {number} dirX  Unit direction (normalized)
     * @param {number} dirY  Unit direction (normalized)
     * @param {number} distance  Base distance in pixels
     */
    applyKnockback(dirX, dirY, distance) {
        if (this.isBoss) return; // Bosses are immune

        const knockDist = distance * this.knockBackModifier;
        this.x += dirX * knockDist;
        this.y += dirY * knockDist;
        if (this.img) {
            this.img.setPosition(this.x, this.y);
        }
        if (this.hpImg) {
            this.hpImg.setPosition(this.x, this.y);
        }

        this.stunned = true;
        const stunDuration = 150 * this.knockBackModifier;

        PhaserScene.time.delayedCall(stunDuration, () => {
            this.stunned = false;
        });
    }

    /** Texture key shared by all enemy instances. */
    static get TEX_KEY() { return 'enemies'; }
}
