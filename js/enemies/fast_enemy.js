// js/enemies/fast_enemy.js — High speed, low health interceptor enemy (MVC).
//
// Behaviour:
//   • Moves at 2.5x speed of basic enemy.
//   • Deals 1.5x tower damage on contact.
//   • Deals 0.501 of its max health to itself on tower contact.
//   • Uses fast.png from enemies atlas.

class FastEnemyModel extends EnemyModel {
    constructor() {
        super();
        this.type = 'fast';
        this.baseResourceDrop = 1.5;
    }

    getHitFeedbackConfig() {
        return {
            wobbleIntensity: 0.4,
            wobbleDuration: 200,
            flickerAlpha: 0.4,
            flickerDuration: 60
        };
    }
}

class FastEnemyView extends EnemyView {
    constructor() {
        super(Enemy.TEX_KEY, 'fast.png', 'fast_enemy_hp.png', GAME_CONSTANTS.DEPTH_ENEMIES);
    }
}

class FastEnemy extends Enemy {
    constructor() {
        super();
        this.model = new FastEnemyModel();
        this.view = new FastEnemyView();
    }

    activate(x, y, scaleFactor) {
        super.activate(x, y, {
            maxHealth: GAME_CONSTANTS.ENEMY_BASE_HEALTH * scaleFactor,
            damage: GAME_CONSTANTS.ENEMY_BASE_DAMAGE * scaleFactor * 1.5,
            selfDamage: GAME_CONSTANTS.ENEMY_BASE_HEALTH * scaleFactor * 0.501,
            speed: GAME_CONSTANTS.ENEMY_BASE_SPEED * 2.5,
            size: 20
        });

        this.setEnemyGlow('fast_glow.png');

        if (this.view.img) this.view.img.setTint(0xffffff);
    }
}
