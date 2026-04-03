// js/enemies/heavy_enemy.js — High health, low speed tank enemy (MVC).
//
// Behaviour:
//   • Moves at 0.75x speed of basic enemy.
//   • Health is 5x base health.
//   • Deals 0.201 of its max health to itself on tower contact.
//   • Uses heavy.png from enemies atlas.

class HeavyEnemyModel extends EnemyModel {
    constructor() {
        super();
        this.type = 'heavy';
        this.baseResourceDrop = 3;
        this.knockBackModifier = 0.6;
    }

    getHitFeedbackConfig() {
        return {
            wobbleIntensity: 0.2,
            wobbleDuration: 500,
            flickerAlpha: 0.6,
            flickerDuration: 100
        };
    }
}

class HeavyEnemyView extends EnemyView {
    constructor() {
        super(Enemy.TEX_KEY, 'heavy.png', 'heavy_hp.png', GAME_CONSTANTS.DEPTH_ENEMIES);
    }
}

class HeavyEnemy extends Enemy {
    constructor() {
        super();
        this.model = new HeavyEnemyModel();
        this.view = new HeavyEnemyView();
    }

    activate(x, y, scaleFactor) {
        super.activate(x, y, {
            maxHealth: GAME_CONSTANTS.ENEMY_BASE_HEALTH * scaleFactor * 5,
            damage: GAME_CONSTANTS.ENEMY_BASE_DAMAGE * 1.5 * (1 + (scaleFactor - 1) * GAME_CONSTANTS.ENEMY_DAMAGE_SCALING_EFFICIENCY),
            selfDamage: GAME_CONSTANTS.ENEMY_BASE_HEALTH * scaleFactor * 5 * 0.201,
            speed: GAME_CONSTANTS.ENEMY_BASE_SPEED * 0.75,
            size: 42
        });

        if (this.view.img) this.view.img.setTint(0xffffff);
        this.setEnemyGlow('heavy_glow.png');
    }
}
