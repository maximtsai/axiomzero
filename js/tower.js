// tower.js — Player Tower entity
// Owns the tower sprite, glow, breathe animation, health, regen, EXP, and auto-attack.

const tower = (() => {
    let sprite = null;
    let glowSprite = null;
    let breatheTween = null;

    // Runtime combat state (not persisted — reset each session)
    let health = 0;
    let maxHealth = 0;
    let damage = 0;
    let attackRange = 0;
    let healthRegen = 0;
    let attackCooldown = 0;
    let attackTimer = 0;

    // EXP accumulator
    let exp = 0;

    let alive = false;
    let active = false; // true only during WAVE_ACTIVE

    // ── helpers ──────────────────────────────────────────────────────────────

    function _recalcStats() {
        const ups = gameState.upgrades || {};
        const reinforceLv = ups.reinforce || 0;
        const sharpenLv   = ups.sharpen   || 0;

        maxHealth   = GAME_CONSTANTS.TOWER_BASE_HEALTH * (1 + 0.25 * reinforceLv);
        damage      = GAME_CONSTANTS.TOWER_BASE_DAMAGE * (1 + 0.25 * sharpenLv);
        attackRange = GAME_CONSTANTS.TOWER_ATTACK_RANGE;
        healthRegen = GAME_CONSTANTS.TOWER_BASE_REGEN;
        attackCooldown = GAME_CONSTANTS.TOWER_ATTACK_COOLDOWN;
    }

    // ── public API ───────────────────────────────────────────────────────────

    function init() {
        messageBus.subscribe('phaseChanged', _onPhaseChanged);
        messageBus.subscribe('upgradePurchased', _onUpgradePurchased);
    }

    function spawn() {
        if (sprite) return; // already spawned

        const cx = GAME_CONSTANTS.halfWidth;
        const cy = GAME_CONSTANTS.halfHeight;

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
            targets: glowSprite,
            alpha: { from: 0.2, to: 0.5 },
            scale: { from: 1.3, to: 1.45 },
            duration: 1800,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
        });

        _recalcStats();
        health = maxHealth;
        alive = true;
        exp = 0;

        messageBus.publish('towerSpawned');
        messageBus.publish('healthChanged', health, maxHealth);
        messageBus.publish('expChanged', exp, GAME_CONSTANTS.EXP_TO_INSIGHT);
    }

    function reset() {
        _recalcStats();
        health = maxHealth;
        alive = true;
        attackTimer = 0;
        exp = 0;
        // NOTE: active is controlled solely by _onPhaseChanged — do NOT set it here
        messageBus.publish('healthChanged', health, maxHealth);
        messageBus.publish('expChanged', exp, GAME_CONSTANTS.EXP_TO_INSIGHT);
    }

    function takeDamage(amount) {
        if (!alive) return;
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
                targets: sprite,
                alpha: { from: 0.5, to: 1 },
                duration: 120,
                ease: 'Linear',
            });
        }
    }

    function heal(amount) {
        if (!alive) return;
        health = Math.min(health + amount, maxHealth);
        messageBus.publish('healthChanged', health, maxHealth);
    }

    function die() {
        alive = false;
        active = false;
        messageBus.publish('towerDied');
        debugLog('Tower destroyed');
    }

    function getPosition() {
        if (!sprite) return { x: GAME_CONSTANTS.halfWidth, y: GAME_CONSTANTS.halfHeight };
        return { x: sprite.x, y: sprite.y };
    }

    function isAlive() { return alive; }

    function getDamage() { return damage; }

    function setVisible(vis) {
        if (sprite) sprite.setVisible(vis);
        if (glowSprite) glowSprite.setVisible(vis);
    }

    function setPosition(x, y) {
        if (sprite) sprite.setPosition(x, y);
        if (glowSprite) glowSprite.setPosition(x, y);
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

        // Auto-attack
        attackTimer += delta;
        if (attackTimer >= attackCooldown) {
            attackTimer -= attackCooldown;
            _tryAutoAttack();
        }
    }

    function _tryAutoAttack() {
        const pos = getPosition();
        const target = enemyManager.getNearestEnemy(pos.x, pos.y, attackRange);
        if (!target) return;
        projectileManager.fire(pos.x, pos.y, target.x, target.y, damage);
    }

    // ── event handlers ───────────────────────────────────────────────────────

    function _onPhaseChanged(phase) {
        if (phase === 'WAVE_ACTIVE') {
            active = true;
            attackTimer = 0;
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

    // register with update loop
    updateManager.addFunction(_update);

    return { init, spawn, reset, takeDamage, heal, die, getPosition, isAlive, getDamage, setVisible, setPosition };
})();
