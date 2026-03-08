// pulseAttack.js — Player cursor AOE pulse attack (Refactored to MVC).
// A nine-sliced square centered on the mouse that fires every FIRE_INTERVAL ms,
// dealing DAMAGE to all enemies within its AOE. Activated by "basic_pulse" node.
// Visual: 0.3 alpha idle, flashes to 1 on fire with Quart.easeOut tween back.

class PulseAttackModel {
    constructor() {
        this.FIRE_INTERVAL = 2000;  // ms between pulses
        this.BASE_DAMAGE = 4;
        this.BASE_SIZE = 100;    // px — AOE square side length

        this.active = false;  // true when combat phase AND node purchased
        this.unlocked = false;  // true after basic_pulse purchased
        this.paused = false;
        this.fireTimer = 0;
        this.size = this.BASE_SIZE;  // current square side length (upgradeable)
        this.damage = this.BASE_DAMAGE; // current damage per pulse (upgradeable)
    }

    resetTimer() {
        this.fireTimer = 0;
    }

    updateTimer(delta) {
        this.fireTimer += delta;
        if (this.fireTimer >= this.FIRE_INTERVAL) {
            this.fireTimer -= this.FIRE_INTERVAL;
            return true; // Should fire
        }
        return false;
    }
}

class PulseAttackView {
    constructor() {
        this.IDLE_ALPHA = 0.45;
        this.FLASH_ALPHA = 1.0;
        this.FLASH_DURATION = 500;  // ms — tween from flash back to idle
        this.CORNER_SIZE = 30;    // nine-slice corner size

        this.sprite = null;
        this.spriteBright = null;
        this.spritePointer = null;
        this.spriteRed = null;

        this.shakeVelX = 0;
        this.shakeVelY = 0;
        this.shakeX = 0;
        this.shakeY = 0;
    }

    init(initialSize) {
        // Base sprite
        this.sprite = PhaserScene.add.nineslice(
            0, 0,
            'player', 'player_attack.png',
            initialSize, initialSize,
            this.CORNER_SIZE, this.CORNER_SIZE, this.CORNER_SIZE, this.CORNER_SIZE
        );
        this.sprite.setOrigin(0.5, 0.5);
        this.sprite.setDepth(GAME_CONSTANTS.DEPTH_TOWER + 1);
        this.sprite.setAlpha(this.IDLE_ALPHA);
        this.sprite.setTint(GAME_CONSTANTS.COLOR_FRIENDLY);
        this.sprite.setScrollFactor(0);
        this.sprite.setVisible(false);

        // Red background pulse
        this.spriteRed = PhaserScene.add.nineslice(
            0, 0,
            'player', 'player_attack_red.png',
            initialSize + 4, initialSize + 4,
            this.CORNER_SIZE, this.CORNER_SIZE, this.CORNER_SIZE, this.CORNER_SIZE
        );
        this.spriteRed.setOrigin(0.5, 0.5);
        this.spriteRed.setDepth(GAME_CONSTANTS.DEPTH_TOWER);
        this.spriteRed.setAlpha(0);
        this.spriteRed.setScrollFactor(0);
        this.spriteRed.setVisible(false);

        // Flash overlay sprite
        this.spriteBright = PhaserScene.add.nineslice(
            0, 0,
            'player', 'player_attack_bright.png',
            initialSize, initialSize,
            this.CORNER_SIZE, this.CORNER_SIZE, this.CORNER_SIZE, this.CORNER_SIZE
        );
        this.spriteBright.setOrigin(0.5, 0.5);
        this.spriteBright.setDepth(GAME_CONSTANTS.DEPTH_TOWER + 2);
        this.spriteBright.setAlpha(0);
        this.spriteBright.setScrollFactor(0);
        this.spriteBright.setVisible(false);

        // Pointer sprite
        this.spritePointer = PhaserScene.add.image(0, 0, 'player', 'player_pointer.png');
        this.cursorX = 0;
        this.cursorY = 0;
        this.spritePointer.setDepth(GAME_CONSTANTS.DEPTH_TOWER + 4);
        this.spritePointer.setScrollFactor(0);
        this.spritePointer.setVisible(false);
    }

    setSize(newSize) {
        if (this.sprite) {
            this.sprite.setSize(newSize, newSize);
        }
        if (this.spriteBright) {
            this.spriteBright.setSize(newSize, newSize);
        }
        if (this.spriteRed) {
            this.spriteRed.setSize(newSize + 4, newSize + 4);
        }
    }

    updatePosition(delta, targetX, targetY) {
        if (!this.sprite) return;

        this.sprite.setPosition(targetX + this.shakeX, targetY + this.shakeY);
        this.spriteBright.setPosition(targetX, targetY);
        this.spritePointer.setPosition(targetX, targetY);
        this.spriteRed.setPosition(targetX + this.shakeX * 0.5, targetY + this.shakeY * 0.5);

        this.shakeX += this.shakeVelX * delta;
        this.shakeY += this.shakeVelY * delta;
        this.shakeX *= 0.36;
        this.shakeY *= 0.36;
    }

    playFireAnimation() {
        if (!this.sprite) return;

        // Pulse flash overlay
        this.spriteBright.setAlpha(this.FLASH_ALPHA);
        this.spriteBright.setScale(1.2);

        this.spriteRed.setAlpha(0.35);
        this.spriteRed.setScale(1.35);
        this.spriteRed.setRotation((Math.random() - 0.5) * 0.09);

        // Tween alpha back to 0
        PhaserScene.tweens.add({
            delay: 75,
            targets: [this.spriteBright, this.spriteRed],
            alpha: 0,
            duration: this.FLASH_DURATION,
            ease: 'Quart.easeOut',
        });

        this.sprite.setScale(1.25);

        PhaserScene.tweens.add({
            targets: [this.sprite, this.spriteBright, this.spriteRed],
            scaleX: 1,
            scaleY: 1,
            rotation: 0,
            duration: 240,
            ease: 'Cubic.easeOut',
        });

        // Jitter shake for base sprite only
        if (this.sprite.scene) {
            this.shakeX = (Math.random() - 0.5);
            this.shakeY = (Math.random() - 0.5);

            PhaserScene.tweens.addCounter({
                from: 4,
                to: 0,
                duration: 200,
                onUpdate: (twn) => {
                    const power = twn.getValue();
                    this.shakeVelX = (Math.random() - 0.5) * power;
                    this.shakeVelY = (Math.random() - 0.5) * power;
                },
                onComplete: () => {
                    this.shakeVelX = 0;
                    this.shakeVelY = 0;
                    this.shakeX = 0;
                    this.shakeY = 0;
                }
            });
        }
    }

    setVisibility(visible, isIdle = true) {
        if (!this.sprite) return;
        this.sprite.setVisible(visible);
        this.spriteBright.setVisible(visible);
        this.spritePointer.setVisible(visible);
        this.spriteRed.setVisible(visible);

        if (visible && isIdle) {
            this.sprite.setAlpha(this.IDLE_ALPHA);
            this.spriteBright.setAlpha(0);
            this.spriteRed.setAlpha(0);
        }
    }
}

// The Controller IIFE
const pulseAttack = (() => {
    const model = new PulseAttackModel();
    const view = new PulseAttackView();

    // Reusable array for enemy queries — avoids GC
    const _hitBuffer = [];

    function init() {
        view.init(model.size);
        if (typeof _recalcPulseDamage === 'function') _recalcPulseDamage();
        if (typeof _recalcPulseSize === 'function') _recalcPulseSize();
        messageBus.subscribe('phaseChanged', _onPhaseChanged);
        messageBus.subscribe('gamePaused', () => { model.paused = true; });
        messageBus.subscribe('gameResumed', () => { model.paused = false; });
        updateManager.addFunction(_update);
    }

    function unlock() {
        model.unlocked = true;
    }

    function setSize(newSize) {
        model.size = newSize;
        view.setSize(newSize);
    }

    function setDamage(newDamage) {
        model.damage = newDamage;
    }

    function _update(delta) {
        if (!model.active || model.paused) return;

        view.updatePosition(delta, GAME_VARS.mouseposx, GAME_VARS.mouseposy);

        if (model.updateTimer(delta)) {
            _fire();
        }
    }

    function _fire() {
        const cx = GAME_VARS.mouseposx;
        const cy = GAME_VARS.mouseposy;
        const damageSize = (model.size / 2) + 5;

        view.playFireAnimation();

        // Micro camera shake
        zoomShake(1.005);

        // Damage all enemies in range
        const hits = enemyManager.getEnemiesInSquareRange(cx, cy, damageSize, _hitBuffer);
        for (let i = 0; i < hits.length; i++) {
            enemyManager.damageEnemy(hits[i], model.damage);
        }
    }

    function _onPhaseChanged(phase) {
        if (phase === GAME_CONSTANTS.PHASE_COMBAT && model.unlocked) {
            model.active = true;
            model.resetTimer();
            view.setVisibility(true, true);
        } else {
            model.active = false;
            view.setVisibility(false);
        }
    }

    return { init, unlock, setSize, setDamage };
})();
