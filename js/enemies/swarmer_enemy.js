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

        // TODO: Swap out special HP sprite per enemy type
        this.hpImg = PhaserScene.add.image(0, 0, Enemy.TEX_KEY, 'basic_enemy_hp.png');
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
        this.size = 10; // Slightly smaller contact radius

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

    takeDamage(amount) {
        const died = super.takeDamage(amount);

        if (this.img) {
            // Rotation wobble on hit
            const wobble = Phaser.Math.FloatBetween(-0.4, 0.4);
            this.img.setRotation(this.baseRotation + wobble);
            if (this.wobbleAnim) this.wobbleAnim.stop();
            this.wobbleAnim = PhaserScene.tweens.add({
                delay: 75,
                targets: this.hpImg ? [this.img, this.hpImg] : this.img,
                rotation: '-=' + wobble,
                duration: 370,
                ease: 'Cubic.easeInOut',
                onComplete: () => {
                    this.setRotation(this.baseRotation);
                    this.wobbleAnim = null;
                }
            });

            // Alpha flicker
            if (this.img.scene) {
                PhaserScene.tweens.add({
                    targets: this.img,
                    alpha: { from: 0.5, to: 1 },
                    duration: 80,
                    ease: 'Linear',
                });
                if (this.hpImg) {
                    PhaserScene.tweens.add({
                        targets: this.hpImg,
                        alpha: { from: 0.5, to: 1 },
                        duration: 80,
                        ease: 'Linear',
                    });
                }
            }
        }

        return died;
    }
}
