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
    }

    activate(x, y, scaleFactor) {
        this.maxHealth = GAME_CONSTANTS.ENEMY_BASE_HEALTH * scaleFactor * 5;
        this.health = this.maxHealth;
        this.selfDamage = this.maxHealth * 0.201;
        this.damage = GAME_CONSTANTS.ENEMY_BASE_DAMAGE * scaleFactor * 1.5;
        this.speed = GAME_CONSTANTS.ENEMY_BASE_SPEED * 0.75;
        this.size = 24;

        if (this.img) {
            this.img.setAlpha(1);
            this.img.setScale(1);
            this.img.setTint(0xffffff); // Reset tint
        }

        super.activate(x, y);
    }

    takeDamage(amount) {
        const died = super.takeDamage(amount);

        if (this.img) {
            // Slower, heavier wobble
            const wobble = Phaser.Math.FloatBetween(-0.2, 0.2);
            this.img.setRotation(this.baseRotation + wobble);
            if (this.wobbleAnim) this.wobbleAnim.stop();
            this.wobbleAnim = PhaserScene.tweens.add({
                delay: 75,
                targets: this.img,
                rotation: '-=' + wobble,
                duration: 500, // Longer duration for heavy feel
                ease: 'Cubic.easeInOut',
                onComplete: () => {
                    this.img.setRotation(this.baseRotation || 0);
                    this.wobbleAnim = null;
                }
            });

            // Alpha flicker
            if (this.img.scene) {
                PhaserScene.tweens.add({
                    targets: this.img,
                    alpha: { from: 0.6, to: 1 },
                    duration: 100,
                    ease: 'Linear',
                });
            }
        }

        return died;
    }
}
