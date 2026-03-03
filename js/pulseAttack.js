// pulseAttack.js — Player cursor AOE pulse attack.
// A nine-sliced square centered on the mouse that fires every FIRE_INTERVAL ms,
// dealing DAMAGE to all enemies within its AOE. Activated by "basic_pulse" node.
// Visual: 0.3 alpha idle, flashes to 1 on fire with Quart.easeOut tween back.

const pulseAttack = (() => {
    // ── Config ───────────────────────────────────────────────────────────────
    const FIRE_INTERVAL = 2000;  // ms between pulses
    const BASE_DAMAGE = 5;
    const BASE_SIZE = 90;    // px — AOE square side length
    const IDLE_ALPHA = 0.4;
    const FLASH_ALPHA = 1.0;
    const FLASH_DURATION = 500;  // ms — tween from flash back to idle
    const CORNER_SIZE = 30;    // nine-slice corner size

    let sprite = null;
    let active = false;  // true when combat phase AND node purchased
    let unlocked = false;  // true after basic_pulse purchased
    let fireTimer = 0;
    let size = BASE_SIZE;  // current square side length (upgradeable)
    let damage = BASE_DAMAGE; // current damage per pulse (upgradeable)

    // Reusable array for enemy queries — avoids GC
    const _hitBuffer = [];

    // ── init ─────────────────────────────────────────────────────────────────

    function init() {
        // Nine-sliced sprite — created once, reused
        sprite = PhaserScene.add.nineslice(
            0, 0,
            'player', 'player_attack.png',
            size, size,
            CORNER_SIZE, CORNER_SIZE, CORNER_SIZE, CORNER_SIZE
        );
        sprite.setOrigin(0.5, 0.5);
        sprite.setDepth(GAME_CONSTANTS.DEPTH_TOWER + 1);
        sprite.setAlpha(IDLE_ALPHA);
        sprite.setVisible(false);

        messageBus.subscribe('phaseChanged', _onPhaseChanged);
        updateManager.addFunction(_update);
    }

    /** Called when the basic_pulse node is purchased. */
    function unlock() {
        unlocked = true;
    }

    /** Allow external systems to adjust AOE size (future upgrades). */
    function setSize(newSize) {
        size = newSize;
        if (sprite) {
            sprite.setSize(size, size);
        }
    }

    /** Set the damage per pulse. */
    function setDamage(newDamage) {
        damage = newDamage;
    }

    // ── per-frame ────────────────────────────────────────────────────────────

    function _update(delta) {
        if (!active) return;

        // Follow mouse
        sprite.setPosition(GAME_VARS.mouseposx, GAME_VARS.mouseposy);

        // Fire timer
        fireTimer += delta;
        if (fireTimer >= FIRE_INTERVAL) {
            fireTimer -= FIRE_INTERVAL;
            _fire();
        }
    }

    function _fire() {
        const cx = GAME_VARS.mouseposx;
        const cy = GAME_VARS.mouseposy;
        const halfSize = size / 2;

        // Flash visual — alpha
        sprite.setAlpha(FLASH_ALPHA);
        PhaserScene.tweens.add({
            targets: sprite,
            alpha: IDLE_ALPHA,
            duration: FLASH_DURATION,
            ease: 'Quart.easeOut',
        });

        // Scale punch — pop out then snap back
        sprite.setScale(1.15);
        PhaserScene.tweens.add({
            targets: sprite,
            scaleX: 1,
            scaleY: 1,
            duration: 200,
            ease: 'Cubic.easeOut',
        });

        // Micro camera shake
        PhaserScene.cameras.main.shake(80, 0.003);

        // Damage all enemies in range
        const hits = enemyManager.getEnemiesInSquareRange(cx, cy, halfSize, _hitBuffer);
        for (let i = 0; i < hits.length; i++) {
            enemyManager.damageEnemy(hits[i], damage);
        }
    }

    // ── event handlers ───────────────────────────────────────────────────────

    function _onPhaseChanged(phase) {
        if (phase === GAME_CONSTANTS.PHASE_COMBAT && unlocked) {
            active = true;
            fireTimer = 0;
            sprite.setVisible(true);
            sprite.setAlpha(IDLE_ALPHA);
        } else {
            active = false;
            sprite.setVisible(false);
        }
    }

    return { init, unlock, setSize, setDamage };
})();
