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

        this.model.update(dt);
        this.view.syncPosition(this.model.x, this.model.y);
        this.view.updateHPCrop(this.model.getHealthPct());

        // Bosses consistently face their target (the tower)
        this.view.setRotation(this.model.baseRotation);
    }
}
