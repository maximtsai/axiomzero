// js/enemies/shell_enemy.js — High speed, medium health enemy (MVC).
//
// Behaviour:
//   • Moves at 3.5x speed of basic enemy.
//   • Health is 2x base health.
//   • Deals 2x base damage.
//   • Sprites and HP bar are rendered 1 depth higher than standard enemies.

class ShellEnemyModel extends EnemyModel {
    constructor() {
        super();
        this.type = 'shell';
        this.baseResourceDrop = 0;
    }
}

class ShellEnemyView extends EnemyView {
    constructor() {
        // Depth is GAME_CONSTANTS.DEPTH_ENEMIES + 1.
        // This will set both the main image and the HP bar to the higher depth.
        super(Enemy.TEX_KEY, 'shell.png', 'shell_hp.png', GAME_CONSTANTS.DEPTH_ENEMIES + 1);
    }
}

class ShellEnemy extends Enemy {
    constructor() {
        super();
        this.model = new ShellEnemyModel();
        this.view = new ShellEnemyView();
    }

    activate(x, y, scaleFactor) {
        super.activate(x, y, {
            maxHealth: GAME_CONSTANTS.ENEMY_BASE_HEALTH * scaleFactor * 2,
            damage: GAME_CONSTANTS.ENEMY_BASE_DAMAGE * scaleFactor * 2,
            selfDamage: GAME_CONSTANTS.ENEMY_BASE_HEALTH * scaleFactor * 4,
            speed: GAME_CONSTANTS.ENEMY_BASE_SPEED * 3.5,
            size: 30
        });

        this.setEnemyGlow('shell_glow.png');
    }
}
