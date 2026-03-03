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
    let spriteBright = null;
    let active = false;  // true when combat phase AND node purchased
    let unlocked = false;  // true after basic_pulse purchased
    let fireTimer = 0;
    let size = BASE_SIZE;  // current square side length (upgradeable)
    let damage = BASE_DAMAGE; // current damage per pulse (upgradeable)
    let shakeVelX = 0;
    let shakeVelY = 0;
    let shakeX = 0;
    let shakeY = 0;

    // Reusable array for enemy queries — avoids GC
    const _hitBuffer = [];

    // ── init ─────────────────────────────────────────────────────────────────

    function init() {
        // Base sprite
        sprite = PhaserScene.add.nineslice(
            0, 0,
            'player', 'player_attack.png',
            size, size,
            CORNER_SIZE, CORNER_SIZE, CORNER_SIZE, CORNER_SIZE
        );
        sprite.setOrigin(0.5, 0.5);
        sprite.setDepth(GAME_CONSTANTS.DEPTH_TOWER + 1);
        sprite.setAlpha(IDLE_ALPHA);
        sprite.setTint(GAME_CONSTANTS.COLOR_FRIENDLY);
        sprite.setVisible(false);

        // Flash overlay sprite
        spriteBright = PhaserScene.add.nineslice(
            0, 0,
            'player', 'player_attack_bright.png',
            size, size,
            CORNER_SIZE, CORNER_SIZE, CORNER_SIZE, CORNER_SIZE
        );
        spriteBright.setOrigin(0.5, 0.5);
        spriteBright.setDepth(GAME_CONSTANTS.DEPTH_TOWER + 2);
        spriteBright.setAlpha(0);
        spriteBright.setVisible(false);

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
        if (spriteBright) {
            spriteBright.setSize(size, size);
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
        const mx = GAME_VARS.mouseposx;
        const my = GAME_VARS.mouseposy;
        sprite.setPosition(mx + shakeX, my + shakeY);
        spriteBright.setPosition(mx, my);

        shakeX += shakeVelX * delta;
        shakeY += shakeVelY * delta;
        shakeX *= 0.36;
        shakeY *= 0.36;

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
        const damageSize = halfSize + 5;

        // Pulse flash overlay
        spriteBright.setAlpha(FLASH_ALPHA);
        spriteBright.setScale(1.25);

        // Tween alpha back to 0
        PhaserScene.tweens.add({
            targets: spriteBright,
            alpha: 0,
            duration: FLASH_DURATION,
            ease: 'Quart.easeOut',
        });

        // Scale punch for both sprites
        sprite.setScale(1.25);

        PhaserScene.tweens.add({
            targets: [sprite, spriteBright],
            scaleX: 1,
            scaleY: 1,
            duration: 240,
            ease: 'Cubic.easeOut',
        });

        // Jitter shake for base sprite only
        if (sprite.scene) {
            shakeX = (Math.random() - 0.5);
            shakeY = (Math.random() - 0.5);

            PhaserScene.tweens.addCounter({
                from: 4,
                to: 0,
                duration: 200,
                onUpdate: (twn) => {
                    const power = twn.getValue();
                    shakeVelX = (Math.random() - 0.5) * power;
                    shakeVelY = (Math.random() - 0.5) * power;
                },
                onComplete: () => {
                    shakeVelX = 0;
                    shakeVelY = 0;
                    shakeX = 0;
                    shakeY = 0;
                }
            });
        }

        // Micro camera shake
        zoomShake(1.005);

        // Damage all enemies in range
        const hits = enemyManager.getEnemiesInSquareRange(cx, cy, damageSize, _hitBuffer);
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
            spriteBright.setVisible(true);
            spriteBright.setAlpha(0);
        } else {
            active = false;
            sprite.setVisible(false);
            spriteBright.setVisible(false);
        }
    }

    return { init, unlock, setSize, setDamage };
})();
