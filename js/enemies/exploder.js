// js/enemies/exploder.js — Exploding enemy type (MVC).
//
// Behaviour:
//   • Stats identical to basic enemy.
//   • Explodes on death dealing damage to other enemies in a diamond shape.

class ExploderEnemyModel extends EnemyModel {
    constructor() {
        super();
        this.size = GAME_CONSTANTS.ENEMY_SIZE_EXPLODER;
        this.type = 'exploder';
        this.baseResourceDrop = 1; // Same as basic for now
    }
}

class ExploderEnemyView extends EnemyView {
    constructor() {
        super(Enemy.TEX_KEY, 'bomb.png', 'bomb_hp.png', GAME_CONSTANTS.DEPTH_ENEMIES);
    }
}

class ExploderEnemy extends Enemy {
    constructor() {
        super();
        this.model = new ExploderEnemyModel();
        this.view = new ExploderEnemyView();
    }

    activate(x, y, scaleFactor, extraConfig = {}) {
        super.activate(x, y, {
            maxHealth: GAME_CONSTANTS.ENEMY_BASE_HEALTH * scaleFactor,
            damage: GAME_CONSTANTS.ENEMY_BASE_DAMAGE * (1 + (scaleFactor - 1) * GAME_CONSTANTS.ENEMY_DAMAGE_SCALING_EFFICIENCY),
            selfDamage: GAME_CONSTANTS.ENEMY_BASE_HEALTH * scaleFactor, // Dies on hit
            speed: GAME_CONSTANTS.ENEMY_BASE_SPEED,
            size: GAME_CONSTANTS.ENEMY_SIZE_EXPLODER,
            ...extraConfig
        });
        
        this.setEnemyGlow('bomb_glow.png');
    }

    onDeath(isFinal = true) {
        const ups = gameState.upgrades || {};
        const payloadLv = ups.volatile_payload || 0;
        // Intentionally slightly fudged numbers compared to description
        const explosionRange = 188 * (1 + 0.16 * payloadLv);
        const explosionDamage = this.model.maxHealth * 1.25;
        const bx = this.model.x;
        const by = this.model.y;

        PhaserScene.time.delayedCall(270, () => {
            if (typeof customEmitters !== 'undefined' && customEmitters.createExploderExplosion) {
                customEmitters.createExploderExplosion(bx, by, explosionRange * explosionRange, explosionDamage);
            }

            if (typeof enemyManager !== 'undefined') {
                const targets = enemyManager.getEnemiesInDiamondRange(bx, by, explosionRange);
                for (let i = 0; i < targets.length; i++) {
                    enemyManager.damageEnemy(targets[i], explosionDamage, 'friendlyfire');
                }
            }
        });
    }
}
