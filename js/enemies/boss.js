// js/enemies/boss.js — Abstract base class for all boss types (MVC).
//
// Extends EnemyModel/Enemy with shared boss features:
//   • Immune to knockback (isBoss = true).
//   • Does not scale with standard wave progression.
//   • Shared entry speed ramp (burst of speed on spawn that decays to target speed).
//   • Larger base hitbox size.

class BossModel extends EnemyModel {
    constructor(levelScalingModifier = 1) {
        super();
        this.levelScalingModifier = levelScalingModifier;
        this.type = 'boss';
        this.isBoss = true;
        this.isMiniboss = false;
        this.knockBackModifier = 0;
        this.size = 100;
        this.hasPostUpdate = false;
    }

    postUpdate(dt) {
        // Optional hook for complex multi-unit behaviors (like HP sharing)
    }
}

class Boss extends Enemy {
    constructor(levelScalingModifier = 1) {
        super();
        this.levelScalingModifier = levelScalingModifier;
        // Subclasses MUST set this.model and this.view
    }

    update(dt) {
        if (!this.model.alive) return;

        const tickAmt = this.model.update(dt);
        if (tickAmt > 0 && typeof enemyManager !== 'undefined') {
            enemyManager.damageEnemy(this, tickAmt, 'burn');
        }

        this.view.syncPosition(this.model.x, this.model.y);
        this.view.updateHPCrop(this.model.getHealthPct());

        // Bosses consistently face their target (the tower)
        this.view.setRotation(this.model.baseRotation);
        this.view.update(dt, this.model);
    }

    onDeath(isFinal = true) {
        if (!isFinal) return;

        if (typeof customEmitters !== 'undefined') {
            const ex = this.model.x;
            const ey = this.model.y;
            const bossDepth = (this.view && this.view.img) ? this.view.img.depth : (GAME_CONSTANTS.DEPTH_ENEMIES || 150);

            // Default standard boss death
            if (customEmitters.createBossExplosionRays) {
                customEmitters.createBossExplosionRays(ex, ey, bossDepth, {});
            }
            if (typeof enemyManager !== 'undefined' && enemyManager.killAllNonBossEnemies) {
                PhaserScene.time.delayedCall(450, () => {
                    enemyManager.killAllNonBossEnemies();
                    PhaserScene.cameras.main.shake(1000, 0.023);
                });
            }
        }
    }

    /**
     * Defines how this boss group spawns. Returns an array of partial activations.
     * Default is just one unit at sx, sy.
     */
    static getSpawnLayout(sx, sy, angle, distance) {
        return [{ x: sx, y: sy, angle: angle }];
    }
}
