// js/enemies/miniboss_3.js — Third miniboss type: ultra-heavy tank (MVC).
//
// Behaviour:
//   • Lumbering beeline toward the tower at slow speed (same as Heavy enemy).
//   • High HP (350 base).
//   • Large size (2x Heavy).
//   • Strong starting speed boost to quickly enter the fray.
//   • SLAM ATTACK: 10 damage after a wind-up and lunge animation.

const MB3 = {
    HEALTH: 470,
    SPEED_MULT: 0.85,
    INITIAL_SPEED_MULT: 7,
    RAMP_DURATION: 2.5,
    ATTACK_COOLDOWN: 2500,
    ATTACK_DAMAGE: 6,
};

class Miniboss3Model extends MinibossModel {
    constructor(levelScalingModifier = 1) {
        super(levelScalingModifier);
        this.isMiniboss = true;
        this.initialSpeedMult = MB3.INITIAL_SPEED_MULT;
        this.rampDuration = MB3.RAMP_DURATION;
        this.attackCooldown = 0;
        this.isSlamming = false;
    }
}

class Miniboss3View extends EnemyView {
    constructor() {
        super(Enemy.TEX_KEY, 'miniboss_3.png', 'miniboss_3_hp.png', GAME_CONSTANTS.DEPTH_ENEMIES + 2);
    }
}

class Miniboss3 extends Miniboss {
    constructor(levelScalingModifier = 1) {
        super(levelScalingModifier);
        this.model = new Miniboss3Model(levelScalingModifier);
        this.view = new Miniboss3View();
    }

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    activate(x, y) {
        const m = this.model;

        // Intended: Minibosses/Bosses do not scale health or damage with level progression
        m.maxHealth = MB3.HEALTH;
        m.health = m.maxHealth;
        m.damage = MB3.ATTACK_DAMAGE; // Intended static damage
        m.speed = GAME_CONSTANTS.ENEMY_BASE_SPEED * MB3.SPEED_MULT;
        m.knockBackModifier = 0; // Immune to knockback
        m.size = 94;

        m.attackCooldown = 0; // Ready immediately
        m.isSlamming = false;

        this.setEnemyGlow('heavy_glow.png');

        super.activate(x, y, {
            initialSpeedMult: m.initialSpeedMult,
            rampDuration: m.rampDuration
        });
    }

    deactivate() {
        super.deactivate();
        this._stopSlamAnimation();
    }

    // ── Per-frame ─────────────────────────────────────────────────────────────

    update(dt) {
        const m = this.model;
        if (!m.alive) return;

        // Process model updates (burn ticks, stun timers, hitstop, speed ramp)
        // This must run every frame, even during slam animation, to ensure burn damage works.
        const tickAmt = m.update(dt);
        if (tickAmt > 0 && typeof enemyManager !== 'undefined') {
            enemyManager.damageEnemy(this, tickAmt, 'burn');
        }

        this.view.updateHPCrop(m.getHealthPct());
        this.view.update(dt, m);

        if (m.isSlamming) {
            // Position is currently being controlled by Phaser tweens in _performSlam
            return;
        }

        // Sync position to model only when not slamming
        this.view.syncPosition(m.x, m.y);

        if (m.attackCooldown > 0) {
            m.attackCooldown -= dt * 1000;
        }

        const tPos = tower.getPosition();
        const dx = tPos.x - m.x;
        const dy = tPos.y - m.y;
        const distSq = dx * dx + dy * dy;

        // Melee range check (similar to enemyManager)
        const contactR = 10 + m.size * 1.1;
        const contactR2 = contactR * contactR;

        if (distSq <= contactR2) {
            m.isAttacking = true;
            m.vx = 0;
            m.vy = 0;

            if (m.attackCooldown <= 0) {
                this._performSlam(dx, dy);
            }
        } else {
            m.isAttacking = false;
            this.model.aimAt(tPos.x, tPos.y);
        }
    }

    // ── Custom Attack ─────────────────────────────────────────────────────────

    _performSlam(dx, dy) {
        const m = this.model;
        const v = this.view;
        if (!m.alive) return;

        m.isSlamming = true;
        const angle = Math.atan2(dy, dx);

        // Tween "back" (away from tower)
        const backDist = 25;
        const backX = -Math.cos(angle) * backDist;
        const backY = -Math.sin(angle) * backDist;

        // Reset positions to model baseline before starting tween
        v.syncPosition(m.x, m.y);

        PhaserScene.tweens.add({
            targets: [v.img, v.hpImg],
            x: m.x + backX,
            y: m.y + backY,
            duration: 600,
            ease: 'Cubic.easeOut',
            onComplete: () => {
                if (!m.alive) return;

                // Slam forward
                PhaserScene.tweens.add({
                    targets: [v.img, v.hpImg],
                    x: m.x,
                    y: m.y,
                    duration: 100,
                    ease: 'Quart.easeIn',
                    onComplete: () => {
                        if (!m.alive) return;

                        // Deal damage at the collision point using model's damage value
                        tower.takeDamage(m.damage, m.x, m.y);

                        if (typeof cameraManager !== 'undefined') {
                            cameraManager.shake(300, 0.02);
                        }

                        // Added bounce back: Cubic.easeOut over 200ms
                        const bounceDist = 5;
                        const bx = -Math.cos(angle) * bounceDist;
                        const by = -Math.sin(angle) * bounceDist;

                        PhaserScene.tweens.add({
                            targets: [v.img, v.hpImg],
                            x: m.x + bx,
                            y: m.y + by,
                            duration: 200,
                            ease: 'Cubic.easeOut',
                            onComplete: () => {
                                if (!m.alive) return;
                                m.isSlamming = false;
                                m.attackCooldown = MB3.ATTACK_COOLDOWN;
                            }
                        });
                    }
                });
            }
        });
    }

    _stopSlamAnimation() {
        const v = this.view;
        if (typeof PhaserScene !== 'undefined' && v) {
            PhaserScene.tweens.killTweensOf([v.img, v.hpImg]);
        }
    }
}
