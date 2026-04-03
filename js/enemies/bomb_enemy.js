// js/enemies/bomb_enemy.js — Exploding enemy type (MVC).
//
// Behaviour:
//   • Stats identical to basic enemy.
//   • Explodes on death dealing damage to other enemies in a diamond shape.

class BombEnemyModel extends EnemyModel {
    constructor() {
        super();
        this.type = 'bomb';
        this.baseResourceDrop = 1; // Same as basic for now
    }
}

class BombEnemyView extends EnemyView {
    constructor() {
        super(Enemy.TEX_KEY, 'bomb.png', 'bomb_hp.png', GAME_CONSTANTS.DEPTH_ENEMIES);
    }
}

class BombEnemy extends Enemy {
    constructor() {
        super();
        this.model = new BombEnemyModel();
        this.view = new BombEnemyView();
    }

    activate(x, y, scaleFactor, extraConfig = {}) {
        super.activate(x, y, {
            maxHealth: GAME_CONSTANTS.ENEMY_BASE_HEALTH * scaleFactor,
            damage: GAME_CONSTANTS.ENEMY_BASE_DAMAGE * (1 + (scaleFactor - 1) * GAME_CONSTANTS.ENEMY_DAMAGE_SCALING_EFFICIENCY),
            selfDamage: GAME_CONSTANTS.ENEMY_BASE_HEALTH * scaleFactor, // Dies on hit
            speed: GAME_CONSTANTS.ENEMY_BASE_SPEED,
            size: 18,
            ...extraConfig
        });
        
        this.setEnemyGlow('bomb_glow.png');
    }
}
