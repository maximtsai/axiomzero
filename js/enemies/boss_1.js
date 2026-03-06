// js/enemies/boss_1.js
// Phase 1 boss. Spawns when wave progress reaches 100%.
// Starts moving very fast (7x speed) and slows down linearly to default (0.75x speed) over 1.25s.
// High health. On defeat, triggers a special sequence that kills all enemies and vacuums drops.

class Boss1 extends Enemy {
    constructor() {
        super();
        this.type = 'boss';
        this.isBoss = true; // Immune to knockback
        this.isMiniboss = false;

        // Visuals
        this.img = PhaserScene.add.image(0, 0, Enemy.TEX_KEY, 'boss_1.png');
        this.img.setDepth(GAME_CONSTANTS.DEPTH_ENEMIES);
        this.img.setVisible(false);
        this.img.setActive(false);

        // HP sprite specialized for boss
        this.hpImg = PhaserScene.add.image(0, 0, Enemy.TEX_KEY, 'boss_hp.png');
        this.hpImg.setDepth(GAME_CONSTANTS.DEPTH_ENEMIES);
        this.hpImg.setVisible(false);
        this.hpImg.setActive(false);

        // State trackers for speed curve
        this.aliveTime = 0;
        this.baseSpeed = 0; // The target steady speed (e.g. 0.75x base)
        this.speedMult = 7.0; // Initial burst speed scale
    }

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    activate(x, y, scaleFactor = 1.0) {
        // High health pool. Using a fixed value scaled by level configuration
        const bossHealth = GAME_CONSTANTS.ENEMY_BASE_HEALTH * 80 * scaleFactor;

        super.activate(x, y, {
            maxHealth: bossHealth,
            damage: GAME_CONSTANTS.ENEMY_BASE_DAMAGE * 3 * scaleFactor, // Big hit on collision
            selfDamage: 0, // Doesn't die on hitting the tower
            speed: GAME_CONSTANTS.ENEMY_BASE_SPEED * 0.75, // Target speed
            size: 28
        });

        // Speed ramp state
        this.baseSpeed = this.speed;
        this.aliveTime = 0;

        // Initial acceleration — apply the 7x modifier from the start
        this.speedMult = 7.0;
        this._applyAimedVelocity();
    }

    _applyAimedVelocity() {
        const tx = GAME_CONSTANTS.halfWidth;
        const ty = GAME_CONSTANTS.halfHeight;
        const dx = tx - this.x;
        const dy = ty - this.y;

        // Minor protection against overlapping the tower directly
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

        // Custom speed curving logic
        if (this.aliveTime < 1.25) {
            this.aliveTime += dt;

            // Lerp multiplier down from 7.0 to 1.0 continuously
            const progress = Math.min(1.0, this.aliveTime / 1.25);
            // Linear falloff 
            this.speedMult = 7.0 - (6.0 * progress);

            // Adjust current velocities dynamically as speed drops
            this._applyAimedVelocity();
        } else if (this.speedMult !== 1.0) {
            // Hard-cap the slowdown point once reached
            this.speedMult = 1.0;
            this._applyAimedVelocity();
        }

        // Apply movement
        super.update(dt);

        // Boss 1 face tracks moving towards tower
        this.setRotation(this.baseRotation);
    }
}
