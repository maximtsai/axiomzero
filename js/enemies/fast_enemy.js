// js/enemies/fast_enemy.js — High speed, low health interceptor enemy.
//
// Behaviour:
//   • Moves at 2.5x speed of basic enemy.
//   • Deals 1.5x tower damage on contact.
//   • Deals 0.501 of its max health to itself on tower contact.
//   • Uses fast.png from enemies atlas.

class FastEnemy extends Enemy {
    constructor() {
        super();
        this.type = 'fast';
        this.baseResourceDrop = 1.5;
        this.img = PhaserScene.add.image(0, 0, Enemy.TEX_KEY, 'fast.png');
        this.img.setDepth(GAME_CONSTANTS.DEPTH_ENEMIES);
        this.img.setVisible(false);
        this.img.setActive(false);

        // UI: Health sprite overlay
        this.hpImg = PhaserScene.add.image(0, 0, Enemy.TEX_KEY, 'fast_enemy_hp.png');
        this.hpImg.setDepth(GAME_CONSTANTS.DEPTH_ENEMIES);
        this.hpImg.setVisible(false);
        this.hpImg.setActive(false);
    }

    activate(x, y, scaleFactor) {
        super.activate(x, y, {
            maxHealth: GAME_CONSTANTS.ENEMY_BASE_HEALTH * scaleFactor,
            damage: GAME_CONSTANTS.ENEMY_BASE_DAMAGE * scaleFactor * 1.5,
            selfDamage: GAME_CONSTANTS.ENEMY_BASE_HEALTH * scaleFactor * 0.501,
            speed: GAME_CONSTANTS.ENEMY_BASE_SPEED * 2.5,
            size: 20
        });

        if (this.img) this.img.setTint(0xffffff); // Unique reset for this type
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
