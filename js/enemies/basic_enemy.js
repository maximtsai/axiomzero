// js/enemies/basic_enemy.js — Phase 1 enemy: red-violet square.
//
// Behaviour:
//   • Charges straight toward the tower at a constant speed.
//   • Stats (health, damage) scale with wave progression via a scaleFactor.
//   • Tint shifts from hostile color toward white as health drops.
//   • Brief alpha flicker on every hit.
//
// To add a new enemy type, duplicate this file and adjust activate(), update(),
// and takeDamage() as needed — the base Enemy class handles the rest.

class BasicEnemy extends Enemy {
    constructor() {
        super();
        BasicEnemy._ensureTexture();
        this.img = PhaserScene.add.image(0, 0, BasicEnemy.TEX_KEY, 'basic.png');
        this.img.setDepth(GAME_CONSTANTS.DEPTH_ENEMIES);
        this.img.setVisible(false);
        this.img.setActive(false);
    }

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    /**
     * @param {number} x           Spawn x position (world coords)
     * @param {number} y           Spawn y position (world coords)
     * @param {number} scaleFactor Wave-progression multiplier: 1 + waveElapsed * SCALE_RATE
     */
    activate(x, y, scaleFactor) {
        this.maxHealth = GAME_CONSTANTS.ENEMY_BASE_HEALTH * scaleFactor;
        this.health    = this.maxHealth;
        this.damage    = GAME_CONSTANTS.ENEMY_BASE_DAMAGE * scaleFactor;
        this.speed     = GAME_CONSTANTS.ENEMY_BASE_SPEED;

        // Reset visuals before super.activate() makes the img visible
        if (this.img) {
            this.img.setAlpha(1);
            this.img.setScale(1);
        }

        super.activate(x, y);
    }

    // ── Damage ────────────────────────────────────────────────────────────────

    /**
     * Tint toward white proportional to health lost; alpha flicker on every hit.
     * @returns {boolean} true if the enemy died
     */
    takeDamage(amount) {
        const died = super.takeDamage(amount);

        if (this.img) {
            // Health-proportional tint shift: hostile color → white
            const ratio = Math.max(0, this.health / this.maxHealth);
            const hR    = (GAME_CONSTANTS.COLOR_HOSTILE >> 16) & 0xff;
            const hG    = (GAME_CONSTANTS.COLOR_HOSTILE >> 8)  & 0xff;
            const hB    =  GAME_CONSTANTS.COLOR_HOSTILE        & 0xff;
            const r     = Math.round(hR + (255 - hR) * (1 - ratio));
            const g     = Math.round(hG + (255 - hG) * (1 - ratio));
            const b     = Math.round(hB + (255 - hB) * (1 - ratio));
            this.img.setTint((r << 16) | (g << 8) | b);

            // Rotation wobble on hit, then tween back to base rotation
            const wobble = Phaser.Math.FloatBetween(-0.3, 0.3);
            this.img.setRotation(this.baseRotation + wobble);
            if (this.wobbleAnim) {
                this.wobbleAnim.stop();
            }
            this.wobbleAnim = PhaserScene.tweens.add({
                delay: 75,
                targets:  this.img,
                rotation: '-=' + wobble,
                duration: 370,
                ease:     'Cubic.easeInOut',
                onComplete: () => {
                    this.img.setRotation(this.baseRotation);
                    this.wobbleAnim = null;
                }
            });

            // Alpha flicker
            if (this.img.scene) {
                PhaserScene.tweens.add({
                    targets:  this.img,
                    alpha:    { from: 0.5, to: 1 },
                    duration: 80,
                    ease:     'Linear',
                });
            }
        }

        return died;
    }

    // ── Static texture helpers ────────────────────────────────────────────────

    /** Generate the texture once; no-op if it already exists. */
    static _ensureTexture() {
        if (PhaserScene.textures.exists(BasicEnemy.TEX_KEY)) return;
        const size = 24;
        const gfx  = PhaserScene.add.graphics();
        gfx.fillStyle(GAME_CONSTANTS.COLOR_HOSTILE, 1);
        gfx.fillRect(0, 0, size, size);
        gfx.generateTexture(BasicEnemy.TEX_KEY, size, size);
        gfx.destroy();
    }
}
