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
    }

    activate(x, y, config = {}) {
        this.x = x;
        this.y = y;
        this.alive = true;
        this.stunned = false;
        this.isAttacking = false;

        if (config.maxHealth !== undefined) {
            this.maxHealth = config.maxHealth;
            this.health = config.maxHealth;
        }
        if (config.speed !== undefined) this.speed = config.speed;
        if (config.damage !== undefined) this.damage = config.damage;
        if (config.size !== undefined) this.size = config.size;
        if (config.selfDamage !== undefined) this.selfDamage = config.selfDamage;

        if (!this.cannotRotate) {
            const distToTowerX = GAME_CONSTANTS.halfWidth - x;
            const distToTowerY = GAME_CONSTANTS.halfHeight - y;
            this.baseRotation = Math.atan2(distToTowerY, distToTowerX);
        } else {
            this.baseRotation = 0;
        }
    }

    deactivate() {
        this.alive = false;
        this.stunned = false;
    }

    aimAt(tx, ty) {
        const dx = tx - this.x;
        const dy = ty - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        this.vx = (dx / dist) * this.speed;
        this.vy = (dy / dist) * this.speed;
    }

    update(dt) {
        if (!this.stunned && !this.isAttacking) {
            let moveMult = 1;
            if (this.hitStopTimer > 0) {
                moveMult = 0.1;
                this.hitStopTimer -= dt;
            }
            this.x += this.vx * dt * moveMult;
            this.y += this.vy * dt * moveMult;
        }

        if (this.attackTimer > 0) {
            this.attackTimer -= dt;
        }
    }

    /**
     * Apply damage. Returns an object with { died, finalAmount, wasProtected }.
     * Pure math — no visuals.
     */
    takeDamage(amount) {
        this.lastDamageWasProtected = false;

        // Protector aura logic
        if (this.type !== 'protector') {
            const protectors = typeof enemyManager !== 'undefined' ? enemyManager.getActiveProtectors() : [];
            let protectedBy = null;
            for (let i = 0; i < protectors.length; i++) {
                const p = protectors[i];
                const dx = this.x - p.x;
                const dy = this.y - p.y;
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

        if (!cannotRotate) {
            this.setRotation(rotation);
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
    }

    syncPosition(x, y) {
        if (this.img) this.img.setPosition(x, y);
        if (this.hpImg) this.hpImg.setPosition(x, y);
    }

    setRotation(rot) {
        if (this.img) this.img.setRotation(rot);
        if (this.hpImg) this.hpImg.setRotation(rot);
    }

    updateHPCrop(healthPct) {
        if (!this.hpImg) return;

        let cropPct = 1.0;
        if (healthPct < 1.0) {
            cropPct = 0.05 + (healthPct * 0.90);
        }

        const fullWidth = this.hpImg.width;
        const fullHeight = this.hpImg.height;
        this.hpImg.setCrop(0, 0, fullWidth * cropPct, fullHeight);
    }

    playHitFlash() {
        if (this.img && this.img.scene) {
            this.img.setTintFill(0xffffff);
            if (this.hpImg) this.hpImg.setTintFill(0xffffff);
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
    }

    playHitFeedback(config = {}) {
        if (!this.img || !this.img.scene) return;

        const {
            flickerAlpha = 0.5,
            flickerDuration = 80
        } = config;

        PhaserScene.tweens.add({
            targets: [this.img, this.hpImg].filter(i => i && i.scene),
            alpha: { from: flickerAlpha, to: 1 },
            duration: flickerDuration,
            ease: 'Linear'
        });
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

    update(dt) {
        this.model.update(dt);
        this.view.syncPosition(this.model.x, this.model.y);
        this.view.updateHPCrop(this.model.getHealthPct());
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

    applyKnockback(dirX, dirY, distance) {
        const result = this.model.applyKnockback(dirX, dirY, distance);
        if (!result) return; // Boss — immune

        this.view.syncPosition(result.newX, result.newY);

        PhaserScene.time.delayedCall(result.stunDuration, () => {
            this.model.stunned = false;
        });
    }

    // ── Property proxies (backward-compatible API for enemyManager etc.) ─────

    get x() { return this.model.x; }
    set x(v) { this.model.x = v; }

    get y() { return this.model.y; }
    set y(v) { this.model.y = v; }

    get alive() { return this.model.alive; }
    set alive(v) { this.model.alive = v; }

    get health() { return this.model.health; }
    set health(v) { this.model.health = v; }

    get maxHealth() { return this.model.maxHealth; }
    set maxHealth(v) { this.model.maxHealth = v; }

    get damage() { return this.model.damage; }
    set damage(v) { this.model.damage = v; }

    get speed() { return this.model.speed; }
    set speed(v) { this.model.speed = v; }

    get size() { return this.model.size; }
    set size(v) { this.model.size = v; }

    get type() { return this.model.type; }
    set type(v) { this.model.type = v; }

    get isBoss() { return this.model.isBoss; }
    set isBoss(v) { this.model.isBoss = v; }

    get isMiniboss() { return this.model.isMiniboss; }
    set isMiniboss(v) { this.model.isMiniboss = v; }

    get knockBackModifier() { return this.model.knockBackModifier; }
    set knockBackModifier(v) { this.model.knockBackModifier = v; }

    get selfDamage() { return this.model.selfDamage; }
    set selfDamage(v) { this.model.selfDamage = v; }

    get baseResourceDrop() { return this.model.baseResourceDrop; }
    set baseResourceDrop(v) { this.model.baseResourceDrop = v; }

    get stunned() { return this.model.stunned; }
    set stunned(v) { this.model.stunned = v; }

    get attackCooldown() { return this.model.attackCooldown; }
    set attackCooldown(v) { this.model.attackCooldown = v; }

    get attackTimer() { return this.model.attackTimer; }
    set attackTimer(v) { this.model.attackTimer = v; }

    get isAttacking() { return this.model.isAttacking; }
    set isAttacking(v) { this.model.isAttacking = v; }

    get vx() { return this.model.vx; }
    set vx(v) { this.model.vx = v; }

    get vy() { return this.model.vy; }
    set vy(v) { this.model.vy = v; }

    get baseRotation() { return this.model.baseRotation; }
    set baseRotation(v) { this.model.baseRotation = v; }

    get cannotRotate() { return this.model.cannotRotate; }
    set cannotRotate(v) { this.model.cannotRotate = v; }

    get lastDamageAmount() { return this.model.lastDamageAmount; }
    get lastDamageWasProtected() { return this.model.lastDamageWasProtected; }

    get hitStopTimer() { return this.model.hitStopTimer; }
    set hitStopTimer(v) { this.model.hitStopTimer = v; }

    // img proxy — enemyManager reads e.img for miniboss explosion
    get img() { return this.view.img; }

    // hpImg proxy
    get hpImg() { return this.view.hpImg; }

    /** Texture key shared by all enemy instances. */
    static get TEX_KEY() { return 'enemies'; }
}
