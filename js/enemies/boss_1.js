// js/enemies/boss_1.js — Phase 1 boss (MVC).
// Spawns when wave progress reaches 100%.
// Starts moving very fast (7x speed) and slows down linearly to default (0.75x speed) over 1.25s.
// High health. On defeat, triggers a special sequence that kills all enemies and vacuums drops.

class Boss1Model extends BossModel {
    constructor() {
        super();
        this.initialSpeedMult = 7.0;
        this.rampDuration = 1.3;
        this.size = 130;
    }
}

class Boss1View extends EnemyView {
    constructor() {
        super(Enemy.TEX_KEY, 'boss_1.png', 'boss_hp.png', GAME_CONSTANTS.DEPTH_ENEMIES - 1);
    }
}

class Boss1 extends Boss {
    constructor() {
        super();
        this.model = new Boss1Model();
        this.view = new Boss1View();
    }

    activate(x, y, scaleFactor = 1.0) {
        const bossHealth = 150;

        super.activate(x, y, {
            maxHealth: bossHealth,
            damage: GAME_CONSTANTS.ENEMY_BASE_DAMAGE * 3,
            selfDamage: 0,
            speed: GAME_CONSTANTS.ENEMY_BASE_SPEED * 0.75,
            size: this.model.size
        });

        // Speed ramp state
        this.model.baseSpeed = this.model.speed;
        this.model.aliveTime = 0;
        this.model.speedMult = this.model.initialSpeedMult;
        this.model._applyAimedVelocity();
    }
}
