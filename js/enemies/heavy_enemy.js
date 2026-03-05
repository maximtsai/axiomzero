// js/enemies/heavy_enemy.js — High health, low speed tank enemy.
//
// Behaviour:
//   • Moves at 0.75x speed of basic enemy.
//   • Health is 5x base health.
//   • Deals 0.201 of its max health to itself on tower contact.
//   • Uses heavy.png from enemies atlas.

class HeavyEnemy extends Enemy {
    constructor() {
        super();
        this.type = 'heavy';
        this.baseResourceDrop = 4;
        this.img = PhaserScene.add.image(0, 0, Enemy.TEX_KEY, 'heavy.png');
        this.img.setDepth(GAME_CONSTANTS.DEPTH_ENEMIES);
        this.img.setVisible(false);
        this.img.setActive(false);

        // TODO: Swap out special HP sprite per enemy type
        this.hpImg = PhaserScene.add.image(0, 0, Enemy.TEX_KEY, 'basic_enemy_hp.png');
        this.hpImg.setDepth(GAME_CONSTANTS.DEPTH_ENEMIES);
        this.hpImg.setVisible(false);
        this.hpImg.setActive(false);
    }

    activate(x, y, scaleFactor) {
        super.activate(x, y, {
            maxHealth: GAME_CONSTANTS.ENEMY_BASE_HEALTH * scaleFactor * 5,
            damage: GAME_CONSTANTS.ENEMY_BASE_DAMAGE * scaleFactor * 1.5,
            selfDamage: GAME_CONSTANTS.ENEMY_BASE_HEALTH * scaleFactor * 5 * 0.201,
            speed: GAME_CONSTANTS.ENEMY_BASE_SPEED * 0.75,
            size: 24
        });

        if (this.img) this.img.setTint(0xffffff);
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
