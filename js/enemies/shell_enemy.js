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

    activate(x, y) {
        // Shells specifically ignore the wave-based scaling factor (scaleFactor includes wave + level)
        // We only want the level-specific scalar here.
        let levelScale = 1;
        if (typeof getCurrentLevelConfig !== 'undefined') {
            levelScale = getCurrentLevelConfig().levelScalingModifier || 1;
        }

        super.activate(x, y, {
            maxHealth: GAME_CONSTANTS.ENEMY_BASE_HEALTH * levelScale * 2,
            damage: GAME_CONSTANTS.ENEMY_BASE_DAMAGE * levelScale * 2,
            selfDamage: GAME_CONSTANTS.ENEMY_BASE_HEALTH * levelScale * 4,
            speed: GAME_CONSTANTS.ENEMY_BASE_SPEED * 3.5,
            size: 32
        });

        this.setEnemyGlow('shell_glow.png');
    }
}
