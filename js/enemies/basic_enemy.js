// js/enemies/basic_enemy.js — Phase 1 enemy: red-violet square (MVC).
//
// Behaviour:
//   • Charges straight toward the tower at a constant speed.
//   • Stats (health, damage) scale with wave progression via a scaleFactor.
//   • Brief alpha flicker on every hit.

class BasicEnemyModel extends EnemyModel {
    constructor() {
        super();
        this.type = 'basic';
        this.baseResourceDrop = 1;
    }
}

class BasicEnemyView extends EnemyView {
    constructor() {
        BasicEnemy._ensureTexture();
        super(Enemy.TEX_KEY, 'basic.png', 'basic_enemy_hp.png', GAME_CONSTANTS.DEPTH_ENEMIES);
    }
}

class BasicEnemy extends Enemy {
    constructor() {
        super();
        this.model = new BasicEnemyModel();
        this.view = new BasicEnemyView();
    }

    activate(x, y, scaleFactor) {
        super.activate(x, y, {
            maxHealth: GAME_CONSTANTS.ENEMY_BASE_HEALTH * scaleFactor,
            damage: GAME_CONSTANTS.ENEMY_BASE_DAMAGE * scaleFactor,
            selfDamage: GAME_CONSTANTS.ENEMY_BASE_HEALTH * scaleFactor,
            speed: GAME_CONSTANTS.ENEMY_BASE_SPEED,
            size: 18
        });
    }

    // ── Static texture helpers ────────────────────────────────────────────────

    /** Generate the texture once; no-op if it already exists. */
    static _ensureTexture() {
        if (PhaserScene.textures.exists(Enemy.TEX_KEY)) return;
        const size = 24;
        const gfx = PhaserScene.add.graphics();
        gfx.fillStyle(GAME_CONSTANTS.COLOR_HOSTILE, 1);
        gfx.fillRect(0, 0, size, size);
        gfx.generateTexture(Enemy.TEX_KEY, size, size);
        gfx.destroy();
    }
}
