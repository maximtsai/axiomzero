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
        super(Enemy.TEX_KEY, 'swarmer.png', 'swarmer_enemy_hp.png', GAME_CONSTANTS.DEPTH_ENEMIES);
    }
}

class SwarmerEnemy extends Enemy {
    constructor() {
        super();
        this.model = new SwarmerEnemyModel();
        this.view = new SwarmerEnemyView();
    }

    activate(x, y, scaleFactor) {
        this.model.maxHealth = 3; // Always 3
        this.model.health = this.model.maxHealth;
        this.model.selfDamage = this.model.maxHealth * 3;
        this.model.damage = GAME_CONSTANTS.ENEMY_BASE_DAMAGE * scaleFactor;
        this.model.speed = GAME_CONSTANTS.ENEMY_BASE_SPEED * 1.25;
        this.model.size = 14;

        if (this.view.img) {
            this.view.img.setAlpha(1);
            this.view.img.setScale(1);
        }
        if (this.view.hpImg) {
            this.view.hpImg.setAlpha(1);
            this.view.hpImg.setScale(1);
        }

        super.activate(x, y);
    }
}
