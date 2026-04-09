// js/enemies/swarmer_enemy.js — Enemy that spawns in clusters (MVC).
//
// Behaviour:
//   • Speed is 1.25x of basic enemy, health is 3.
//   • Spawned in groups to overwhelm the tower.
//   • Deals same base damage as basic enemy.

class SwarmerEnemyModel extends EnemyModel {
    constructor() {
        super();
        this.type = 'swarmer';
        this.baseResourceDrop = 0.4;
    }
}

class SwarmerEnemyView extends EnemyView {
    constructor() {
        super(Enemy.TEX_KEY, 'swarmer.png', 'swarmer_enemy_hp.png', GAME_CONSTANTS.DEPTH_ENEMIES + 1);
    }
}

class SwarmerEnemy extends Enemy {
    constructor() {
        super();
        this.model = new SwarmerEnemyModel();
        this.view = new SwarmerEnemyView();
    }

    activate(x, y, scaleFactor) {
        super.activate(x, y, {
            maxHealth: GAME_CONSTANTS.ENEMY_BASE_HEALTH * scaleFactor * 0.5,
            damage: GAME_CONSTANTS.ENEMY_BASE_DAMAGE * (1 + (scaleFactor - 1) * GAME_CONSTANTS.ENEMY_DAMAGE_SCALING_EFFICIENCY),
            selfDamage: GAME_CONSTANTS.ENEMY_BASE_HEALTH * scaleFactor * 0.5,
            speed: GAME_CONSTANTS.ENEMY_BASE_SPEED * 1.25,
            size: 17
        });

        if (this.view.img) {
            this.view.img.setAlpha(1);
            this.view.img.setScale(1);
        }
        if (this.view.hpImg) {
            this.view.hpImg.setAlpha(1);
            this.view.hpImg.setScale(1);
        }
    }
}
