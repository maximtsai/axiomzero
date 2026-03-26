// js/enemies/enemy.js — Base enemy system (Refactored to MVC).
//
// EnemyModel  — Pure state: health, damage, speed, position, velocity. No Phaser.
// EnemyView   — Phaser sprites: img, hpImg, tints, tweens, cropping.
// Enemy       — Controller: binds model ↔ view, proxies public API for enemyManager.
//
// Subclasses extend EnemyModel / EnemyView / Enemy for per-type behaviour.

// ─── MODEL ───────────────────────────────────────────────────────────────────

class EnemyModel {
    constructor() {
        this.alive = false;
        this.health = 0;
        this.maxHealth = 0;
        this.damage = 0;
        this.size = 0;
        this.speed = 0;
        this.isBoss = false;
        this.isMiniboss = false;
        this.knockBackModifier = 1;
        this.stunned = false;
        this.hitStopTimer = 0;
        this.baseResourceDrop = 0;
        this.selfDamage = 0;
        this.cannotRotate = false;
        this.attackCooldown = 2.0;
        this.attackTimer = 0;
        this.isAttacking = false;
        this.type = '';
        this.burnDuration = 0;
        this.burnDamage = 0;
        this.burnTimer = 0;

        // Speed Ramp properties
        this.initialSpeedMult = 1.0;
        this.rampDuration = 0;
        this.speedMult = 1.0;
        this.aliveTime = 0;
        this.baseSpeed = 1; // The un-multiplied speed

        // Velocity (px/sec)
        this.vx = 0;
        this.vy = 0;

        // World position
        this.x = 0;
        this.y = 0;

        // Rotation
        this.baseRotation = 0;

        // Damage tracking (set per-hit for external readers)
        this.lastDamageAmount = 0;
        this.lastDamageWasProtected = false;

        this.forceSlowMult = 1.0;
        this.forceSlowTimer = 0;
        this.isGhosting = false;
        this.invincible = false;
        this.hitByPulse = false;
        this.hitByShockwave = false;
    }

    activate(x, y, config = {}) {
        this.x = x;
        this.y = y;
        this.alive = true;
        this.stunned = false;
        this.isAttacking = false;
        this.burnDuration = 0;
        this.burnDamage = 0;
        this.burnTimer = 0;

        if (config.maxHealth !== undefined) {
            this.maxHealth = config.maxHealth;
            this.health = config.maxHealth;
        }
        if (config.speed !== undefined) {
            this.speed = config.speed;
            this.baseSpeed = config.speed; // Store base speed for speed mult calculations
        }
        if (config.damage !== undefined) this.damage = config.damage;
        if (config.size !== undefined) this.size = config.size;
        if (config.selfDamage !== undefined) this.selfDamage = config.selfDamage;

        // Speed ramp initialization
        if (config.initialSpeedMult !== undefined) this.initialSpeedMult = config.initialSpeedMult;
        if (config.rampDuration !== undefined) this.rampDuration = config.rampDuration;
        this.aliveTime = 0;
        this.speedMult = this.initialSpeedMult;

        if (!this.cannotRotate) {
            const distToTowerX = GAME_CONSTANTS.halfWidth - x;
            const distToTowerY = GAME_CONSTANTS.halfHeight - y;
            this.baseRotation = Math.atan2(distToTowerY, distToTowerX);
        } else {
            this.baseRotation = 0;
        }

        this.forceSlowMult = 1.0;
        this.forceSlowTimer = 0;
        this.hitByPulse = false;
        this.hitByShockwave = false;
    }

    deactivate() {
        this.alive = false;
        this.isGhosting = false;
        this.stunned = false;
        this.burnDuration = 0;
        this.burnDamage = 0;
        this.burnTimer = 0;
    }

    aimAt(tx, ty) {
        const dx = tx - this.x;
        const dy = ty - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;

        const effectiveSpeed = this.baseSpeed * Math.max(1, this.speedMult) * (this.speed / (this.baseSpeed || 1));

        this.vx = (dx / dist) * effectiveSpeed;
        this.vy = (dy / dist) * effectiveSpeed;
    }

    update(dt) {
        if (!this.alive) return;

        this.aliveTime += dt;

        if (this.rampDuration > 0) {
            if (this.aliveTime < this.rampDuration) {
                const progress = Math.min(1.0, this.aliveTime / this.rampDuration);
                this.speedMult = this.initialSpeedMult + ((1.0 - this.initialSpeedMult) * progress);
                // Dynamically re-aim to apply the new speed
                if (!this.stunned && !this.isAttacking) {
                    this.aimAt(GAME_CONSTANTS.halfWidth, GAME_CONSTANTS.halfHeight);
                }
            } else if (this.speedMult !== 1.0) {
                this.speedMult = 1.0;
                if (!this.stunned && !this.isAttacking) {
                    this.aimAt(GAME_CONSTANTS.halfWidth, GAME_CONSTANTS.halfHeight);
                }
            }
        }

        if (!this.stunned && !this.isAttacking) {
            let moveMult = 1;
            if (this.hitStopTimer > 0) {
                moveMult = 0.1;
                this.hitStopTimer -= dt;
            }

            // Force slow applies separately and stacks with hit-stop
            moveMult *= this.forceSlowMult;

            this.x += this.vx * dt * moveMult;
            this.y += this.vy * dt * moveMult;
        }

        if (this.forceSlowTimer > 0) {
            this.forceSlowTimer -= dt;
            if (this.forceSlowTimer <= 0) {
                this.forceSlowMult = 1.0;
                this.forceSlowTimer = 0;
            }
        }

        if (this.attackTimer > 0) {
            this.attackTimer -= dt;
        }

        // Burn logic (ticks every 1.0s)
        let burnTick = 0;
        if (this.burnDuration > 0) {
            this.burnDuration -= dt;
            this.burnTimer += dt;
            if (this.burnTimer >= 1.0) {
                this.burnTimer -= 1.0;
                burnTick = this.burnDamage;
            }
            if (this.burnDuration <= 0) {
                this.burnDuration = 0;
                this.burnTimer = 0;
            }
        }

        return burnTick; // Return the amount for the controller to trigger manager.damageEnemy (to get floating numbers)
    }

    /**
     * Apply damage. Returns an object with { died, finalAmount, wasProtected }.
     * Pure math — no visuals.
     */
    takeDamage(amount) {
        if (this.invincible && (this.isBoss || this.isMiniboss)) {
            this.lastDamageAmount = 0;
            return false;
        }

        this.lastDamageWasProtected = false;

        // Protector aura logic
        if (this.type !== 'protector' && !this.isBoss) {
            const protectors = typeof enemyManager !== 'undefined' ? enemyManager.getActiveProtectors() : [];
            let protectedBy = null;
            for (let i = 0; i < protectors.length; i++) {
                const p = protectors[i];
                if (!p.model || !p.model.alive || !p.model.auraActive) continue;
                
                const dx = this.x - p.model.x;
                const dy = this.y - p.model.y;
                if ((dx * dx + dy * dy) <= GAME_CONSTANTS.PROTECTOR_AURA_SQUARED) {
                    protectedBy = p;
                    break;
                }
            }

            if (protectedBy) {
                amount = Math.ceil(amount * 0.5);
                this.lastDamageWasProtected = true;
                protectedBy.triggerAuraDefend();
            }
        }

        this.lastDamageAmount = amount;
        this.health -= amount;

        // Hit-stop scaling
        if (!this.isBoss && !this.isMiniboss) {
            this.hitStopTimer = 0.15 * this.knockBackModifier;
        }

        if (this.health <= 0) {
            this.health = 0;
            return true;
        }
        return false;
    }

    /**
     * Apply knockback position change (pure math).
     * Returns { newX, newY, stunDuration }.
     */
    applyKnockback(dirX, dirY, distance) {
        if (this.isBoss) return null;

        const knockDist = distance * this.knockBackModifier;
        this.x += dirX * knockDist;
        this.y += dirY * knockDist;

        this.stunned = true;
        const stunDuration = 150 * this.knockBackModifier;

        return { newX: this.x, newY: this.y, stunDuration };
    }

    /**
     * Set burn status for periodic damage.
     * @param {number} duration Seconds of burn remaining
     * @param {number} damage   Damage dealt per 1-second tick
     */
    applyBurn(duration, damage) {
        this.burnDuration = duration;
        this.burnDamage = damage;
        this.burnTimer = 0; // Fresh apply resets the tick accumulator
    }

    /** Health fraction 0–1. */
    getHealthPct() {
        if (this.maxHealth <= 0) return 0;
        return this.health / this.maxHealth;
    }

    /** Override in subclasses for custom feedback config. */
    getHitFeedbackConfig() {
        return {};
    }
}

// ─── VIEW ────────────────────────────────────────────────────────────────────

class EnemyView {
    /**
     * @param {string} texKey     Atlas texture key (e.g. 'enemies')
     * @param {string} frameKey   Frame within the atlas (e.g. 'basic.png')
     * @param {string} hpFrameKey Frame for the HP overlay sprite
     * @param {number} depth      Phaser depth layer
     */
    constructor(texKey, frameKey, hpFrameKey, depth) {
        this.img = PhaserScene.add.image(0, 0, texKey, frameKey);
        this.img.setDepth(depth);
        this.img.setVisible(false);
        this.img.setActive(false);

        this.hpImg = PhaserScene.add.image(0, 0, texKey, hpFrameKey);
        this.hpImg.setDepth(depth);
        this.hpImg.setVisible(false);
        this.hpImg.setActive(false);

        this.enemyGlow = PhaserScene.add.image(0, 0, texKey, 'default_enemy_glow.png');
        this.enemyGlow.setDepth(depth - 2);
        this.enemyGlow.setVisible(false);
        this.enemyGlow.setActive(false);
    }

    activate(x, y, rotation, cannotRotate) {
        if (this.img) {
            this.img.setPosition(x, y);
            this.img.setVisible(true);
            this.img.setActive(true);
            this.img.setAlpha(1);
            this.img.setScale(1);
        }
        if (this.hpImg) {
            this.hpImg.setPosition(x, y);
            this.hpImg.setVisible(true);
            this.hpImg.setActive(true);
            this.hpImg.setAlpha(1);
            this.hpImg.setScale(1);
        }
        if (this.enemyGlow) {
            this.enemyGlow.setPosition(x, y);
            this.enemyGlow.setActive(true);
            this.enemyGlow.setVisible(false); // defaults to false
            this.enemyGlow.setAlpha(1);
            this.enemyGlow.setScale(1);
        }

        if (!cannotRotate) {
            this.setRotation(rotation);
        }
        this.update(0);
    }

    update(dt, model) {
        if (model && model.burnDuration > 0) {
            // Apply a pulsating orange/red tint when on fire
            const pulse = 0.8 + 0.2 * Math.sin(PhaserScene.time.now * 0.01);
            const tint = model.isBoss ? 0xff4400 : 0xff6600;
            this.img.setTint(tint);
        } else {
            this.img.clearTint();
        }
    }

    deactivate() {
        if (this.img) {
            PhaserScene.tweens.killTweensOf(this.img);
            this.img.setVisible(false);
            this.img.setActive(false);
        }
        if (this.hpImg) {
            PhaserScene.tweens.killTweensOf(this.hpImg);
            this.hpImg.setVisible(false);
            this.hpImg.setActive(false);
        }
        if (this.enemyGlow) {
            PhaserScene.tweens.killTweensOf(this.enemyGlow);
            this.enemyGlow.setVisible(false);
            this.enemyGlow.setActive(false);
        }
    }

    syncPosition(x, y) {
        if (this.img) this.img.setPosition(x, y);
        if (this.hpImg) this.hpImg.setPosition(x, y);
        if (this.enemyGlow) this.enemyGlow.setPosition(x, y);
    }

    setRotation(rot) {
        if (this.img) this.img.setRotation(rot);
        if (this.hpImg) this.hpImg.setRotation(rot);
        if (this.enemyGlow) this.enemyGlow.setRotation(rot);
    }

    updateHPCrop(healthPct) {
        if (!this.hpImg) return;

        let cropPct = 1.0;
        if (healthPct < 1.0) {
            cropPct = healthPct * 0.975;
        }

        const fullWidth = this.hpImg.width;
        const fullHeight = this.hpImg.height;
        this.hpImg.setCrop(0, 0, fullWidth * cropPct, fullHeight);
    }

    playHitFlash() {
        if (this.img && this.img.scene) {
            this.img.setTintFill(0xffffff);
            if (this.hpImg) this.hpImg.setTintFill(0xffffff);
            if (this.enemyGlow) this.enemyGlow.setTintFill(0xffffff);
        }
    }

    clearHitFlash() {
        this.refreshTint();
    }

    refreshTint() {
        if (this.img && this.img.scene) {
            this.img.clearTint();
        }
        if (this.hpImg && this.hpImg.scene) {
            this.hpImg.clearTint();
        }
        if (this.enemyGlow && this.enemyGlow.scene) {
            this.enemyGlow.clearTint();
        }
    }

    setScale(scale) {
        if (this.img) this.img.setScale(scale);
        if (this.hpImg) this.hpImg.setScale(scale);
        if (this.enemyGlow) this.enemyGlow.setScale(scale);
    }

    setHPOrigin(x, y) {
        if (this.hpImg) this.hpImg.setOrigin(x, y);
    }

    playHitFeedback(config = {}) {
        if (!this.img || !this.img.scene) return;

        const {
            flickerAlpha = 0.5,
            flickerDuration = 80
        } = config;

        PhaserScene.tweens.add({
            targets: [this.img, this.hpImg, this.enemyGlow].filter(i => i && i.scene),
            alpha: { from: flickerAlpha, to: 1 },
            duration: flickerDuration,
            ease: 'Linear'
        });
    }

    setEnemyGlow(frame) {
        if (this.enemyGlow) {
            this.enemyGlow.setFrame(frame);
            this.enemyGlow.setVisible(true);
        }
    }
}

// ─── CONTROLLER ──────────────────────────────────────────────────────────────

class Enemy {
    constructor() {
        // Subclasses MUST set this.model and this.view in their constructors.
        // The base Enemy constructor does NOT create them — subclasses choose
        // which Model/View subclass to instantiate.
        this.model = null;
        this.view = null;
    }

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    activate(x, y, config = {}) {
        this.model.activate(x, y, config);
        this.view.activate(x, y, this.model.baseRotation, this.model.cannotRotate);
        this.view.updateHPCrop(this.model.getHealthPct());
    }

    deactivate() {
        this.model.deactivate();
        this.view.deactivate();
    }

    // ── Movement ──────────────────────────────────────────────────────────────

    setRotation(rot) {
        if (this.model.cannotRotate) return;
        this.view.setRotation(rot);
    }

    aimAt(tx, ty) {
        this.model.aimAt(tx, ty);
    }

    setScale(scale) {
        this.view.setScale(scale);
    }

    setHPOrigin(x, y) {
        this.view.setHPOrigin(x, y);
    }

    update(dt) {
        const tickAmt = this.model.update(dt);
        if (tickAmt > 0 && typeof enemyManager !== 'undefined') {
            enemyManager.damageEnemy(this, tickAmt);
        }
        this.view.syncPosition(this.model.x, this.model.y);
        this.view.updateHPCrop(this.model.getHealthPct());
        this.view.update(dt, this.model);
    }

    // ── Damage ────────────────────────────────────────────────────────────────

    takeDamage(amount) {
        const died = this.model.takeDamage(amount);

        // Visual feedback
        this.view.playHitFlash();
        PhaserScene.time.delayedCall(135, () => {
            this.view.clearHitFlash();
        });

        this.view.updateHPCrop(this.model.getHealthPct());
        this.view.playHitFeedback(this.model.getHitFeedbackConfig());

        return died;
    }

    refreshTint() {
        this.view.refreshTint();
    }

    setEnemyGlow(frame) {
        this.view.setEnemyGlow(frame);
    }

    applyKnockback(dirX, dirY, distance) {
        const result = this.model.applyKnockback(dirX, dirY, distance);
        if (!result) return; // Boss — immune

        this.view.syncPosition(result.newX, result.newY);

        PhaserScene.time.delayedCall(result.stunDuration, () => {
            this.model.stunned = false;
        });
    }

    stun(duration) {
        if (this.isBoss) return;
        this.model.stunned = true;
        PhaserScene.time.delayedCall(duration, () => {
            this.model.stunned = false;
        });
    }

    applyBurn(duration, damage) {
        this.model.applyBurn(duration, damage);
    }

    forceSlow(mult, duration) {
        this.model.forceSlowMult = mult;
        const finalDuration = (this.isBoss || this.isMiniboss) ? duration * 0.66 : duration;
        this.model.forceSlowTimer = finalDuration;
    }

    // ── Property proxies (backward-compatible API for enemyManager etc.) ─────

    // The getters and setters previously here have been removed.
    // External systems must now access 'enemy.model.health', 'enemy.view.img', etc.

    /** Texture key shared by all enemy instances. */
    static get TEX_KEY() { return 'enemies'; }
}
