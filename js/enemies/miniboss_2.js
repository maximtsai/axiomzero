// js/enemies/miniboss_2.js — Second miniboss type: fast charging melee attacker (MVC).
//
// Behaviour:
//   • Spawns and waits 3 seconds (PAUSED).
//   • Travels at 2.5× normal enemy speed toward tower (TRAVEL) with a particle trail.
//   • At 200px, drops speed to 0 over 1s (CHARGE).
//   • Lunges rapidly to deal exactly 1 attack (ATTACK). Takes 0 knockback from all tower hits.
//   • After hit, sticks to tower for 1.5s (PAUSED_POST_ATTACK).
//   • Retreats until >150px away (RETREAT), then repeats from CHARGE.
//   • 210 HP, 9 Damage, 10 Self-Damage. Drops 1 SHARD on death.

/** Local config — owned by this class, not exposed to globals. */
const MB2 = {
    HEALTH: 230,
    DAMAGE: 10,
    SELF_DAMAGE: 5,
    SPEED_MULT: 2.4,
    CHARGE_RANGE: 200,
    RETREAT_PAST_RANGE: 150,
    INITIAL_WAIT_MS: 2200,
    CHARGE_WAIT_MS: 800,
    POST_ATTACK_WAIT_MS: 2000,
    KNOCKBACK_MOD: 0, // NO natural knockback or bounce
    ATTACK_ACCELERATION: 1500, // px/s^2 for the lunge
    ATTACK_MAX_SPEED: 800,
    INITIAL_SPEED_MULT: 9,
    RAMP_DURATION: 1.5,
};

const MINIBOSS2_STATE = {
    SPAWN_PAUSE: 'SPAWN_PAUSE',
    TRAVEL: 'TRAVEL',
    CHARGE: 'CHARGE',
    ATTACK: 'ATTACK',
    POST_ATTACK_PAUSE: 'POST_ATTACK_PAUSE',
    RETREAT: 'RETREAT'
};

class Miniboss2Model extends MinibossModel {
    constructor(levelScalingModifier = 1) {
        super(levelScalingModifier);
        this.isMiniboss = true;
        this.state = MINIBOSS2_STATE.SPAWN_PAUSE;
        this.stateTimer = 0;
        this.trailActive = false;

        // Attack physics state
        this.attackSpeed = 0;
        this.hasHitTowerInCurrentAttack = false;

        this.chargeStartSpeed = 0;
        this.initialSpeedMult = MB2.INITIAL_SPEED_MULT;
        this.rampDuration = MB2.RAMP_DURATION;
    }
}

class Miniboss2View extends EnemyView {
    constructor() {
        super(Enemy.TEX_KEY, 'miniboss_2.png', 'miniboss_2_hp.png', GAME_CONSTANTS.DEPTH_ENEMIES + 2);

        // Particle trail (spinning, scaling down)
        // Ensure the texture 'shooter_enemy_hp.png' exists in 'enemies' atlas
        this.trailEmitter = PhaserScene.add.particles(0, 0, 'enemies', {
            frame: 'shooter_enemy_hp.png',
            lifespan: 1000,
            scale: { start: 1.4, end: 0 },
            angle: { min: 0, max: 360 },
            speed: { min: 5, max: 20 },
            rotate: { start: 0, end: 180 }, // slow spin
            frequency: 50,
            emitting: false,
            depth: GAME_CONSTANTS.DEPTH_ENEMIES - 2
        });
    }

    activate(x, y, rotation, cannotRotate) {
        super.activate(x, y, rotation, cannotRotate);
        if (this.trailEmitter) {
            const offX = -Math.cos(rotation) * 45;
            const offY = -Math.sin(rotation) * 45;
            this.trailEmitter.startFollow(this.img, offX, offY);
            this.trailEmitter.stop(); // default off
        }
    }

    deactivate() {
        super.deactivate();
        if (this.trailEmitter) {
            this.trailEmitter.stopFollow();
            this.trailEmitter.stop();
        }
    }

    setTrailActive(active) {
        if (!this.trailEmitter) return;
        if (active && !this.trailEmitter.emitting) {
            this.trailEmitter.start();
        } else if (!active && this.trailEmitter.emitting) {
            this.trailEmitter.stop();
        }
    }
}

class Miniboss2 extends Miniboss {
    constructor(levelScalingModifier = 1) {
        super(levelScalingModifier);
        this.model = new Miniboss2Model(levelScalingModifier);
        this.view = new Miniboss2View();
    }

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    activate(x, y) {
        const m = this.model;
        m.maxHealth = MB2.HEALTH;
        m.health = m.maxHealth;

        // Base damage is 0 natively so it doesn't accidentally trigger tower damage on simple overlap
        // It relies purely on the manual lunge collision logic.
        m.damage = 0;
        m.selfDamage = 0;

        m.baseSpeed = GAME_CONSTANTS.ENEMY_BASE_SPEED * MB2.SPEED_MULT;
        m.speed = 0; // Starts paused
        m.knockBackModifier = MB2.KNOCKBACK_MOD; // Will not get bounced backwards
        m.size = 60; // Approximate size

        m.state = MINIBOSS2_STATE.SPAWN_PAUSE;
        m.stateTimer = MB2.INITIAL_WAIT_MS;
        m.trailActive = false;
        m.attackSpeed = 0;
        m.hasHitTowerInCurrentAttack = false;

        // Reset visuals
        if (this.view.img) {
            this.view.img.setAlpha(1);
            this.view.img.setScale(1);
            this.view.img.clearTint();
        }
        if (this.view.hpImg) {
            this.view.hpImg.setAlpha(1);
            this.view.hpImg.setScale(1);
        }
        this.view.setTrailActive(false);

        super.activate(x, y, {
            initialSpeedMult: m.initialSpeedMult,
            rampDuration: m.rampDuration
        });
    }

    deactivate() {
        this.view.setTrailActive(false);
        super.deactivate();
    }

    // ── Per-frame ─────────────────────────────────────────────────────────────

    update(dt) {
        const m = this.model;
        const v = this.view;
        const dtMs = dt * 1000;
        const tPos = tower.getPosition();
        const dx = tPos.x - m.x;
        const dy = tPos.y - m.y;
        const distToTower = Math.sqrt(dx * dx + dy * dy);

        // Sync Trail State
        v.setTrailActive(m.trailActive);

        switch (m.state) {
            case MINIBOSS2_STATE.SPAWN_PAUSE:
                m.vx = 0;
                m.vy = 0;
                m.stateTimer -= dtMs;
                if (m.stateTimer <= 0) {
                    this._transitionTo(MINIBOSS2_STATE.TRAVEL);
                }
                break;

            case MINIBOSS2_STATE.TRAVEL:
                // Move towards tower at baseSpeed 
                m.speed = m.baseSpeed;
                m.aimAt(tPos.x, tPos.y);

                super.update(dt);

                if (distToTower <= MB2.CHARGE_RANGE) {
                    this._transitionTo(MINIBOSS2_STATE.CHARGE);
                }
                break;

            case MINIBOSS2_STATE.CHARGE:
                // Decelerate to 0 over CHARGE_WAIT_MS
                m.stateTimer -= dtMs;
                const progress = 1 - Math.max(0, m.stateTimer / MB2.CHARGE_WAIT_MS);
                m.speed = m.chargeStartSpeed * (1 - progress);

                m.aimAt(tPos.x, tPos.y);
                super.update(dt);

                if (m.stateTimer <= 0) {
                    this._transitionTo(MINIBOSS2_STATE.ATTACK);
                }
                break;

            case MINIBOSS2_STATE.ATTACK:
                m.trailActive = true;

                // Rapidly accelerate directly towards the tower
                m.attackSpeed += MB2.ATTACK_ACCELERATION * dt;
                if (m.attackSpeed > MB2.ATTACK_MAX_SPEED) m.attackSpeed = MB2.ATTACK_MAX_SPEED;

                const ux = dx / (distToTower || 1);
                const uy = dy / (distToTower || 1);

                m.x += ux * m.attackSpeed * dt;
                m.y += uy * m.attackSpeed * dt;
                v.syncPosition(m.x, m.y);

                // Collision detection
                if (distToTower <= m.size && !m.hasHitTowerInCurrentAttack) {
                    // Force the manual attack
                    tower.takeDamage(MB2.DAMAGE, m.x, m.y);
                    if (typeof cameraManager !== 'undefined') {
                        cameraManager.shake(300, 0.02);
                    }

                    // Force manual self damage and text display by proxy
                    // We directly take damage since we disabled our native 'damage' stat
                    enemyManager.damageEnemy(this, MB2.SELF_DAMAGE);

                    m.hasHitTowerInCurrentAttack = true;

                    // Check if still alive after self damage
                    if (m.health > 0) {
                        this._transitionTo(MINIBOSS2_STATE.POST_ATTACK_PAUSE);
                    }
                }
                break;

            case MINIBOSS2_STATE.POST_ATTACK_PAUSE:
                // Instantly snap to be flush against the tower 
                const snapUx = dx / (distToTower || 1);
                const snapUy = dy / (distToTower || 1);
                m.x = tPos.x - snapUx * m.size;
                m.y = tPos.y - snapUy * m.size;
                v.syncPosition(m.x, m.y);

                m.vx = 0;
                m.vy = 0;
                m.stateTimer -= dtMs;
                if (m.stateTimer <= 0) {
                    this._transitionTo(MINIBOSS2_STATE.RETREAT);
                }
                break;

            case MINIBOSS2_STATE.RETREAT:
                // Negative speed to move backwards
                m.speed = -m.baseSpeed;

                // Move AWAY from tower
                const rx = dx / (distToTower || 1);
                const ry = dy / (distToTower || 1);

                m.x += rx * m.speed * dt;
                m.y += ry * m.speed * dt;
                v.syncPosition(m.x, m.y);

                if (distToTower > MB2.RETREAT_PAST_RANGE) {
                    this._transitionTo(MINIBOSS2_STATE.CHARGE);
                }
                break;
        }

        // Ensure HP UI strictly follows final visual position
        if (v.hpBarVisible) v.updateHpPosition(m.x, m.y);
    }

    _transitionTo(newState) {
        const m = this.model;
        m.state = newState;

        switch (newState) {
            case MINIBOSS2_STATE.SPAWN_PAUSE:
                m.stateTimer = MB2.INITIAL_WAIT_MS;
                m.trailActive = false;
                break;
            case MINIBOSS2_STATE.TRAVEL:
                m.trailActive = true;
                break;
            case MINIBOSS2_STATE.CHARGE:
                m.stateTimer = MB2.CHARGE_WAIT_MS;
                m.trailActive = false;
                m.chargeStartSpeed = m.speed;
                break;
            case MINIBOSS2_STATE.ATTACK:
                m.trailActive = true;
                m.attackSpeed = 0;
                m.hasHitTowerInCurrentAttack = false;
                break;
            case MINIBOSS2_STATE.POST_ATTACK_PAUSE:
                m.stateTimer = MB2.POST_ATTACK_WAIT_MS;
                m.trailActive = false;
                break;
            case MINIBOSS2_STATE.RETREAT:
                m.trailActive = false;
                break;
        }
    }

    // ── Damage & Knockback ────────────────────────────────────────────────────

    takeDamage(amount) {
        return super.takeDamage(amount);
    }

    applyKnockback(dirX, dirY, distance) {
        // Enforce strong 0 knockback.
        // Even if we have a knockback modifier of 0 natively, super.applyKnockback
        // might attempt to push us for collision resolution if we used normal movement.
        // We do absolutely nothing here.
    }
}
