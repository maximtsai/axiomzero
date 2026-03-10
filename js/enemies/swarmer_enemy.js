// js/enemies/swarmer_enemy.js — Enemy that spawns in clusters.
//
// Behaviour:
//   • Speeds is 1.25x of basic enemy, health is 3.
//   • Spawned in groups to overwhelm the tower.
//   • Deals same base damage as basic enemy.

class SwarmerEnemy extends Enemy {
    constructor() {
        super();
        this.type = 'swarmer';
        this.baseResourceDrop = 0.4;
        this.img = PhaserScene.add.image(0, 0, Enemy.TEX_KEY, 'swarmer.png');
        this.img.setDepth(GAME_CONSTANTS.DEPTH_ENEMIES);
        this.img.setVisible(false);
        this.img.setActive(false);

        // UI: Health sprite overlay
        this.hpImg = PhaserScene.add.image(0, 0, Enemy.TEX_KEY, 'swarmer_enemy_hp.png');
        this.hpImg.setDepth(GAME_CONSTANTS.DEPTH_ENEMIES);
        this.hpImg.setVisible(false);
        this.hpImg.setActive(false);
    }

    activate(x, y, scaleFactor) {
        this.maxHealth = 3; // Always 3
        this.health = this.maxHealth;
        this.selfDamage = this.maxHealth * 3;
        this.damage = GAME_CONSTANTS.ENEMY_BASE_DAMAGE * scaleFactor;
        this.speed = GAME_CONSTANTS.ENEMY_BASE_SPEED * 1.25;
        this.size = 14;

        if (this.img) {
            this.img.setAlpha(1);
            this.img.setScale(1);
        }
        if (this.hpImg) {
            this.hpImg.setAlpha(1);
            this.hpImg.setScale(1);
        }

        super.activate(x, y);
    }
}
