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
    }

    activate(x, y, scaleFactor) {
        this.maxHealth = GAME_CONSTANTS.ENEMY_BASE_HEALTH * scaleFactor;
        this.health = this.maxHealth;
        this.selfDamage = this.maxHealth * 0.501;
        this.damage = GAME_CONSTANTS.ENEMY_BASE_DAMAGE * scaleFactor * 1.5;
        this.speed = GAME_CONSTANTS.ENEMY_BASE_SPEED * 2.5;
        this.size = 15;

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
            // Fast, jittery wobble
            const wobble = Phaser.Math.FloatBetween(-0.4, 0.4);
            this.img.setRotation(this.baseRotation + wobble);
            if (this.wobbleAnim) this.wobbleAnim.stop();
            this.wobbleAnim = PhaserScene.tweens.add({
                delay: 40,
                targets: this.img,
                rotation: '-=' + wobble,
                duration: 200, // Short duration for fast feel
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
                    alpha: { from: 0.4, to: 1 },
                    duration: 60,
                    ease: 'Linear',
                });
            }
        }

        return died;
    }
}
