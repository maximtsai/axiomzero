// tower.js — Player Tower entity
// Owns the tower sprite, glow, breathe animation, health, regen, EXP, and auto-attack.
//
// Two-stage visual lifecycle:
//   spawn()   — creates a sparkle placeholder at screen center (called on AWAKEN node purchase)
//   awaken()  — destroys sparkle, creates real tower sprite + glow, enables auto-attack

const tower = (() => {
    // ── sparkle (pre-awaken placeholder) ────────────────────────────────────
    let sparkleSprite = null;
    let sparkleTween  = null;
    let awakened      = false; // true after awaken() is called

    // ── tower visuals (post-awaken) ──────────────────────────────────────────
    let sprite      = null;
    let glowSprite  = null;
    let breatheTween = null;

    // ── runtime combat state (not persisted — reset each session) ────────────
    let health        = 0;
    let maxHealth     = 0;
    let damage        = 0;
    let attackRange   = 0;
    let healthRegen   = 0;
    let attackCooldown = 0;
    let attackTimer   = 0;

    // ── EXP accumulator ──────────────────────────────────────────────────────
    let exp = 0;

    let alive        = false;
    let active       = false;       // true only during WAVE_ACTIVE
    let isInvincible = false;       // true briefly after a boss is defeated

    // ── helpers ──────────────────────────────────────────────────────────────

    function _recalcStats() {
        const ups = gameState.upgrades || {};
        const reinforceLv = ups.reinforce || 0;
        const sharpenLv   = ups.sharpen   || 0;

        maxHealth      = GAME_CONSTANTS.TOWER_BASE_HEALTH * (1 + 0.25 * reinforceLv);
        damage         = GAME_CONSTANTS.TOWER_BASE_DAMAGE * (1 + 0.25 * sharpenLv);
        attackRange    = GAME_CONSTANTS.TOWER_ATTACK_RANGE;
        healthRegen    = GAME_CONSTANTS.TOWER_BASE_REGEN;
        attackCooldown = GAME_CONSTANTS.TOWER_ATTACK_COOLDOWN;
    }

    /** Tweens the active tower visuals (sprite+glow OR sparkle) to a new x. */
    function _tweenToX(targetX, duration) {
        const targets = [];
        if (sprite)       targets.push(sprite);
        if (glowSprite)   targets.push(glowSprite);
        if (sparkleSprite) targets.push(sparkleSprite);
        if (targets.length === 0) return;

        PhaserScene.tweens.add({
            targets,
            x: targetX,
            duration,
            ease: 'Sine.easeInOut',
        });
    }

    // ── public API ───────────────────────────────────────────────────────────

    function init() {
        messageBus.subscribe('phaseChanged',    _onPhaseChanged);
        messageBus.subscribe('upgradePurchased', _onUpgradePurchased);
        messageBus.subscribe('bossDefeated',    _onBossDefeated);
    }

    /**
     * Creates the pre-awaken sparkle placeholder at screen center.
     * Does NOT create the tower sprite — call awaken() for the full transformation.
     */
    function spawn() {
        if (sparkleSprite) return; // already spawned

        const cx = GAME_CONSTANTS.halfWidth + GAME_CONSTANTS.halfWidth / 2;
        const cy = GAME_CONSTANTS.halfHeight;

        sparkleSprite = PhaserScene.add.sprite(cx, cy, 'player', 'sparkle.png');
        sparkleSprite.setDepth(GAME_CONSTANTS.DEPTH_TOWER);
        sparkleSprite.setAlpha(0.8);
        sparkleSprite.setTint(GAME_CONSTANTS.COLOR_FRIENDLY);

        sparkleTween = PhaserScene.tweens.add({
            targets:  sparkleSprite,
            alpha:    { from: 0.4, to: 1.0 },
            scale:    { from: 0.8, to: 1.2 },
            duration: 900,
            yoyo:     true,
            repeat:   -1,
            ease:     'Sine.easeInOut',
        });

        _recalcStats();
        health   = maxHealth;
        alive    = true;
        awakened = false;
        exp      = 0;

        messageBus.publish('towerSpawned');
        messageBus.publish('healthChanged', health, maxHealth);
        messageBus.publish('expChanged',    exp, GAME_CONSTANTS.EXP_TO_INSIGHT);
    }

    /**
     * Visual transformation: sparkle → tower sprite + glow.
     * Destroys the sparkle, creates the real tower visuals, starts the breathe tween,
     * and enables auto-attack logic. Safe to call if already awakened (no-op).
     */
    function awaken() {
        if (awakened) return;
        awakened = true;

        // Capture position from sparkle before destroying it
        const cx = sparkleSprite ? sparkleSprite.x : GAME_CONSTANTS.halfWidth + GAME_CONSTANTS.halfWidth / 2;
        const cy = sparkleSprite ? sparkleSprite.y : GAME_CONSTANTS.halfHeight;

        // Destroy sparkle placeholder
        if (sparkleTween)  { sparkleTween.stop(); sparkleTween = null; }
        if (sparkleSprite) { sparkleSprite.destroy(); sparkleSprite = null; }

        // Glow layer — additive blend, slightly larger, pulses
        glowSprite = PhaserScene.add.sprite(cx, cy, 'player', 'tower1.png');
        glowSprite.setDepth(GAME_CONSTANTS.DEPTH_GLOW);
        glowSprite.setScale(1.35);
        glowSprite.setAlpha(0.35);
        glowSprite.setTint(GAME_CONSTANTS.COLOR_FRIENDLY);
        glowSprite.setBlendMode(Phaser.BlendModes.ADD);

        // Main tower sprite
        sprite = PhaserScene.add.sprite(cx, cy, 'player', 'tower1.png');
        sprite.setDepth(GAME_CONSTANTS.DEPTH_TOWER);

        // Breathe / pulse tween on glow
        breatheTween = PhaserScene.tweens.add({
            targets:  glowSprite,
            alpha:    { from: 0.2, to: 0.5 },
            scale:    { from: 1.3, to: 1.45 },
            duration: 1800,
            yoyo:     true,
            repeat:   -1,
            ease:     'Sine.easeInOut',
        });

        messageBus.publish('towerAwakened');
        debugLog('Tower awakened');
    }

    function reset() {
        _recalcStats();
        health       = maxHealth;
        alive        = true;
        attackTimer  = 0;
        exp          = 0;
        isInvincible = false;
        // NOTE: active is controlled solely by _onPhaseChanged — do NOT set it here
        messageBus.publish('healthChanged', health, maxHealth);
        messageBus.publish('expChanged',    exp, GAME_CONSTANTS.EXP_TO_INSIGHT);
    }

    function takeDamage(amount) {
        if (!alive || isInvincible) return;
        health -= amount;
        if (health <= 0) {
            health = 0;
            messageBus.publish('healthChanged', health, maxHealth);
            die();
            return;
        }
        messageBus.publish('healthChanged', health, maxHealth);

        // visual hit flash
        if (sprite) {
            PhaserScene.tweens.add({
                targets:  sprite,
                alpha:    { from: 0.5, to: 1 },
                duration: 120,
                ease:     'Linear',
            });
        }
    }

    function heal(amount) {
        if (!alive) return;
        health = Math.min(health + amount, maxHealth);
        messageBus.publish('healthChanged', health, maxHealth);
    }

    function die() {
        alive        = false;
        active       = false;
        isInvincible = false;
        messageBus.publish('towerDied');
        debugLog('Tower destroyed');
    }

    function getPosition() {
        if (sprite)       return { x: sprite.x,       y: sprite.y };
        if (sparkleSprite) return { x: sparkleSprite.x, y: sparkleSprite.y };
        return { x: GAME_CONSTANTS.halfWidth + GAME_CONSTANTS.halfWidth / 2, y: GAME_CONSTANTS.halfHeight };
    }

    function isAlive()    { return alive; }
    function getDamage()  { return damage; }

    function setVisible(vis) {
        if (sprite)       sprite.setVisible(vis);
        if (glowSprite)   glowSprite.setVisible(vis);
        if (sparkleSprite) sparkleSprite.setVisible(vis);
    }

    function setPosition(x, y) {
        if (sprite)       sprite.setPosition(x, y);
        if (glowSprite)   glowSprite.setPosition(x, y);
        if (sparkleSprite) sparkleSprite.setPosition(x, y);
    }

    /**
     * Violently shake the tower left/right for `duration` ms, then call onComplete.
     * Elevates sprite depths above the death overlay so the tower stays visible.
     */
    function shake(duration, onComplete) {
        const targets = [];
        if (sprite)        targets.push(sprite);
        if (glowSprite)    targets.push(glowSprite);
        if (sparkleSprite) targets.push(sparkleSprite);
        if (targets.length === 0) { if (onComplete) onComplete(); return; }

        // Elevate above death overlay
        if (sprite)        sprite.setDepth(GAME_CONSTANTS.DEPTH_DEATH_TOWER);
        if (glowSprite)    glowSprite.setDepth(GAME_CONSTANTS.DEPTH_DEATH_TOWER);
        if (sparkleSprite) sparkleSprite.setDepth(GAME_CONSTANTS.DEPTH_DEATH_TOWER);

        const origX = targets[0].x;

        // 5 full oscillations in `duration` ms: each direction change = duration/10
        PhaserScene.tweens.add({
            targets,
            x: { from: origX - 10, to: origX + 10 },
            duration: duration / 10,
            yoyo: true,
            repeat: 4,
            ease: 'Linear',
            onComplete: () => {
                // Snap back to original x and restore normal depths
                for (let i = 0; i < targets.length; i++) { targets[i].x = origX; }
                if (sprite)        sprite.setDepth(GAME_CONSTANTS.DEPTH_TOWER);
                if (glowSprite)    glowSprite.setDepth(GAME_CONSTANTS.DEPTH_GLOW);
                if (sparkleSprite) sparkleSprite.setDepth(GAME_CONSTANTS.DEPTH_TOWER);
                if (onComplete) onComplete();
            },
        });
    }

    // ── per-frame update ─────────────────────────────────────────────────────

    function _update(delta) {
        if (!alive || !active) return;

        const dt = delta / 1000; // seconds

        // Negative health regen
        health += healthRegen * dt;
        if (health <= 0) {
            health = 0;
            messageBus.publish('healthChanged', health, maxHealth);
            die();
            return;
        }
        messageBus.publish('healthChanged', health, maxHealth);

        // EXP accumulation
        exp += GAME_CONSTANTS.EXP_FILL_RATE * dt;
        if (exp >= GAME_CONSTANTS.EXP_TO_INSIGHT) {
            exp -= GAME_CONSTANTS.EXP_TO_INSIGHT;
            resourceManager.addInsight(1);
            messageBus.publish('insightGained');
        }
        messageBus.publish('expChanged', exp, GAME_CONSTANTS.EXP_TO_INSIGHT);

        // Auto-attack — only active after awaken() has been called
        if (awakened) {
            attackTimer += delta;
            if (attackTimer >= attackCooldown) {
                attackTimer -= attackCooldown;
                _tryAutoAttack();
            }
        }
    }

    function _tryAutoAttack() {
        const pos    = getPosition();
        const target = enemyManager.getNearestEnemy(pos.x, pos.y, attackRange);
        if (!target) return;
        projectileManager.fire(pos.x, pos.y, target.x, target.y, damage);
    }

    // ── event handlers ───────────────────────────────────────────────────────

    function _onPhaseChanged(phase) {
        if (phase === 'WAVE_ACTIVE') {
            active      = true;
            attackTimer = 0;
            // Tween back to full-screen center
            _tweenToX(GAME_CONSTANTS.halfWidth, 500);
        } else if (phase === 'UPGRADE_PHASE') {
            active = false;
            // Tween to center of right half (right of neural tree panel)
            _tweenToX(GAME_CONSTANTS.halfWidth + GAME_CONSTANTS.halfWidth / 2, 500);
        } else {
            active = false;
        }
    }

    function _onUpgradePurchased() {
        _recalcStats();
        // If between waves, refresh health to new max
        if (!active) {
            health = maxHealth;
            messageBus.publish('healthChanged', health, maxHealth);
        }
    }

    function _onBossDefeated() {
        isInvincible = true;
        // Lift invincibility after 2 s (resource collection window)
        PhaserScene.time.delayedCall(2000, () => {
            isInvincible = false;
        });
        debugLog('Tower invincible for 2s after boss defeat');
    }

    // register with update loop
    updateManager.addFunction(_update);

    return {
        init, spawn, awaken, reset,
        takeDamage, heal, die, shake,
        getPosition, isAlive, getDamage,
        setVisible, setPosition,
    };
})();
