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
        this.type = 'basic';
        this.baseResourceDrop = 1;
        BasicEnemy._ensureTexture();
        this.img = PhaserScene.add.image(0, 0, BasicEnemy.TEX_KEY, 'basic.png');
        this.img.setDepth(GAME_CONSTANTS.DEPTH_ENEMIES);
        this.img.setVisible(false);
        this.img.setActive(false);

        // TODO: Swap out special HP sprite per enemy type
        this.hpImg = PhaserScene.add.image(0, 0, BasicEnemy.TEX_KEY, 'basic_enemy_hp.png');
        this.hpImg.setDepth(GAME_CONSTANTS.DEPTH_ENEMIES);
        this.hpImg.setVisible(false);
        this.hpImg.setActive(false);
    }

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    activate(x, y, scaleFactor) {
        super.activate(x, y, {
            maxHealth: GAME_CONSTANTS.ENEMY_BASE_HEALTH * scaleFactor,
            damage: GAME_CONSTANTS.ENEMY_BASE_DAMAGE * scaleFactor,
            selfDamage: GAME_CONSTANTS.ENEMY_BASE_HEALTH * scaleFactor * 3,
            speed: GAME_CONSTANTS.ENEMY_BASE_SPEED,
            size: 18
        });
    }

    // ── Static texture helpers ────────────────────────────────────────────────

    /** Generate the texture once; no-op if it already exists. */
    static _ensureTexture() {
        if (PhaserScene.textures.exists(BasicEnemy.TEX_KEY)) return;
        const size = 24;
        const gfx = PhaserScene.add.graphics();
        gfx.fillStyle(GAME_CONSTANTS.COLOR_HOSTILE, 1);
        gfx.fillRect(0, 0, size, size);
        gfx.generateTexture(BasicEnemy.TEX_KEY, size, size);
        gfx.destroy();
    }
}
