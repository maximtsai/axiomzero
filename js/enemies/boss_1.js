// js/enemies/boss_1.js
// Phase 1 boss. Spawns when wave progress reaches 100%.
// Starts moving very fast (7x speed) and slows down linearly to default (0.75x speed) over 1.25s.
// High health. On defeat, triggers a special sequence that kills all enemies and vacuums drops.

class Boss1 extends Boss {
    constructor() {
        super();
        this.initialSpeedMult = 7.0; // Initial burst speed scale
        this.rampDuration = 1.25;

        // Set specialized size for Boss 1
        this.size = 40;

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
    }

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    activate(x, y, scaleFactor = 1.0) {
        // High health pool multiplier (specific to Boss 1)
        const healthMult = 80;
        const bossHealth = GAME_CONSTANTS.ENEMY_BASE_HEALTH * healthMult * scaleFactor;

        super.activate(x, y, {
            maxHealth: bossHealth,
            damage: GAME_CONSTANTS.ENEMY_BASE_DAMAGE * 3 * scaleFactor, // Big hit on collision
            selfDamage: 0, // Doesn't die on hitting the tower
            speed: GAME_CONSTANTS.ENEMY_BASE_SPEED * 0.75, // Target speed
            size: this.size // 28
        });

        // Speed ramp state
        this.baseSpeed = this.speed;
        this.aliveTime = 0;

        // Initial acceleration — apply the modifier from the start
        this.speedMult = this.initialSpeedMult;
        this._applyAimedVelocity();
    }
}
