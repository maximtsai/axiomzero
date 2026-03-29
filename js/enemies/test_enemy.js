// js/enemies/test_enemy.js — Sandbox enemy for testing defenses.
//
// Behaviour:
//   • Identical to basic enemy in movement and appearance.
//   • Deals 0 damage.
//   • Drops 0 data/resources.
//   • Dies instantly upon contacting the tower (high selfDamage).

class TestEnemyModel extends EnemyModel {
    constructor() {
        super();
        this.type = 'test';
        this.baseResourceDrop = 0; // Drops nothing
        this.knockBackModifier = 1.0;
    }

    getHitFeedbackConfig() {
        return {
            wobbleIntensity: 0.2,
            wobbleDuration: 200,
            flickerAlpha: 0.6,
            flickerDuration: 100
        };
    }
}

class TestEnemyView extends EnemyView {
    constructor() {
        super(Enemy.TEX_KEY, 'test.png', 'basic_enemy_hp.png', GAME_CONSTANTS.DEPTH_ENEMIES);
    }
}

class TestEnemy extends Enemy {
    constructor() {
        super();
        this.model = new TestEnemyModel();
        this.view = new TestEnemyView();
    }

    activate(x, y, scaleFactor) {
        super.activate(x, y, {
            maxHealth: GAME_CONSTANTS.ENEMY_BASE_HEALTH * scaleFactor,
            damage: 0, // Deals NO damage to the tower
            selfDamage: 99999, // Dies instantly when hitting tower
            speed: GAME_CONSTANTS.ENEMY_BASE_SPEED,
            size: 14, // standard basic size
            initialSpeedMult: 18, // Start 300% faster
            rampDuration: 0.9     // Decay to normal speed over 1.5s
        });

        // Visually distinguish slightly from normal basic enemies (e.g., white tint)
        if (this.view.img) this.view.img.setTint(0xffffff);
    }

    // Override death to prevent wave progression logic or visual clutter
    onDeath(isCoreDeath = true) {
        if (!this.model.alive) return;
        this.model.alive = false;

        // Custom death effect for test enemy (simple poof, no drops)
        if (typeof customEmitters !== 'undefined' && customEmitters.playShellDeath) {
            customEmitters.playShellDeath(this.model.x, this.model.y, this.view.img ? this.view.img.depth : GAME_CONSTANTS.DEPTH_ENEMIES);
        }
    }
}
