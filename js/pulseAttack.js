// pulseAttack.js — Player cursor AOE cursor attack (Refactored to MVC).
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

        this.charges = 0;
        this.maxCharges = 2;
        this.isolationLevel = 0;
        this.saturationLevel = 0;
        this.aftershockLevel = 0;
    }

    resetTimer() {
        this.fireTimer = 0;
    }

    setFireInterval(ms) {
        this.FIRE_INTERVAL = ms;
    }

    updateTimer(delta) {
        this.fireTimer += delta;
        if (this.fireTimer >= this.FIRE_INTERVAL) {
            this.fireTimer -= this.FIRE_INTERVAL;

            if (this.manualMode) {
                if (this.charges < this.maxCharges) {
                    this.charges++;
                }
                return false; // Manual mode doesn't auto-fire
            }
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
        this.aftershockBright = null;
        this.aftershockRed = null;

        this.shakeVelX = 0;
        this.shakeVelY = 0;
        this.shakeX = 0;
        this.shakeY = 0;
        this.chargeSprites = [];
        this.aftershockLevel = 0;
    }

    init(initialSize) {
        // Base sprite
        this.sprite = PhaserScene.add.nineslice(
            0, 0,
            'player', 'player_attack.png',
            initialSize, initialSize,
            this.CORNER_SIZE, this.CORNER_SIZE, this.CORNER_SIZE, this.CORNER_SIZE
        );
        this.sprite.rotVel = 0;
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

        // Aftershock sprites (100 units larger than base)
        this.aftershockRed = PhaserScene.add.nineslice(
            0, 0,
            'player', 'player_attack_red.png',
            initialSize + 104, initialSize + 104,
            this.CORNER_SIZE, this.CORNER_SIZE, this.CORNER_SIZE, this.CORNER_SIZE
        );
        this.aftershockRed.setOrigin(0.5, 0.5);
        this.aftershockRed.setDepth(GAME_CONSTANTS.DEPTH_TOWER);
        this.aftershockRed.setAlpha(0);
        this.aftershockRed.setScrollFactor(0);
        this.aftershockRed.setVisible(false);

        this.aftershockBright = PhaserScene.add.nineslice(
            0, 0,
            'player', 'player_attack.png',
            initialSize + 100, initialSize + 100,
            this.CORNER_SIZE, this.CORNER_SIZE, this.CORNER_SIZE, this.CORNER_SIZE
        );
        this.aftershockBright.setOrigin(0.5, 0.5);
        this.aftershockBright.setDepth(GAME_CONSTANTS.DEPTH_TOWER + 1);
        this.aftershockBright.setAlpha(0);
        this.aftershockBright.setTint(GAME_CONSTANTS.COLOR_FRIENDLY);
        this.aftershockBright.setScrollFactor(0);
        this.aftershockBright.setVisible(false);

        // Pointer sprite
        this.spritePointer = PhaserScene.add.image(0, 0, 'player', 'player_pointer.png');
        this.spritePointer.setDepth(GAME_CONSTANTS.DEPTH_TOWER + 4);
        this.spritePointer.setScrollFactor(0);
        this.spritePointer.setVisible(false);

        // Charge indicators (Right-to-left at top-right of the square)
        for (let i = 0; i < 8; i++) { // Increased to support upgrades
            const s = PhaserScene.add.image(0, 0, 'player', 'player_pointer.png');
            s.setScale(2);
            s.setDepth(GAME_CONSTANTS.DEPTH_TOWER + 5);
            s.setScrollFactor(0);
            s.setVisible(false);
            this.chargeSprites.push(s);
        }
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

    updatePosition(delta, targetX, targetY, model) {
        if (!this.sprite) return;

        this.sprite.setPosition(targetX + this.shakeX, targetY + this.shakeY);
        this.spriteBright.setPosition(targetX, targetY);
        this.spritePointer.setPosition(targetX, targetY);
        this.spriteRed.setPosition(targetX + this.shakeX * 0.5, targetY + this.shakeY * 0.5);

        const rotAccel = this.sprite.rotation * -0.1 - this.sprite.rotVel * 0.25;
        this.sprite.rotVel += rotAccel;

        this.sprite.rotation += this.sprite.rotVel * delta * 0.14;
        this.spriteBright.setRotation(this.sprite.rotation);

        const size = model.size;
        const topY = targetY - size / 2 - 4; // 4px above edge (matching user's recent change)
        const leftAnchorX = targetX - size / 2 + 4; // Offset from left edge
        const spacing = 13;

        for (let i = 0; i < this.chargeSprites.length; i++) {
            const s = this.chargeSprites[i];
            // i=0 is the first charge (leftmost), i=1 is the second (to its right), etc.
            s.setPosition(leftAnchorX + i * spacing + 3, topY - 2);
        }

        this.shakeX += this.shakeVelX * delta;
        this.shakeY += this.shakeVelY * delta;
        this.shakeX *= 0.36;
        this.shakeY *= 0.36;
    }

    updateCharges(count, maxCharges, manualMode) {
        for (let i = 0; i < this.chargeSprites.length; i++) {
            const s = this.chargeSprites[i];
            s.setVisible(manualMode && i < count && this.sprite.visible);
        }
    }

    playFireAnimation() {
        if (!this.sprite) return;

        const flippedLeft = Math.random() < 0.5;
        const goalRot = flippedLeft ? -0.3 : 0.3;

        // Pulse flash overlay
        this.spriteBright.setAlpha(this.FLASH_ALPHA);
        this.spriteBright.setScale(1.3);
        this.spriteBright.setRotation(goalRot);
        this.sprite.setRotation(this.spriteBright.rotation);

        this.spriteRed.setAlpha(0.35);
        this.spriteRed.setScale(1.4);
        this.spriteRed.setRotation((Math.random() - 0.5) * 0.09);

        // Tween alpha back to 0
        PhaserScene.tweens.add({
            delay: 75,
            targets: [this.spriteBright, this.spriteRed],
            alpha: 0,
            duration: this.FLASH_DURATION,
            ease: 'Quart.easeOut',
        });

        // PhaserScene.tweens.add({
        //     rotation: goalRot * -0.3,
        //     targets: [this.spriteBright, this.sprite],
        //     duration: 100,
        //     ease: 'Quart.easeInOut',
        //     onComplete: () => {
        //         PhaserScene.tweens.add({
        //             rotation: goalRot * 0.1,
        //             targets: [this.spriteBright, this.sprite],
        //             duration: 120,
        //             ease: 'Cubic.easeInOut',
        //             onComplete: () => {
        //                 PhaserScene.tweens.add({
        //                     rotation: 0,
        //                     targets: [this.spriteBright, this.sprite],
        //                     duration: 200,
        //                     ease: 'Back.easeOut',
        //                 });
        //             }
        //         });
        //     }
        // });

        this.sprite.setScale(1.35);

        PhaserScene.tweens.add({
            targets: [this.sprite, this.spriteBright],
            scaleX: 1,
            scaleY: 1,
            duration: 240,
            ease: 'Cubic.easeOut',
        });

        PhaserScene.tweens.add({
            targets: [this.spriteRed],
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

    setVisibility(visible, isIdle = true, manualMode = false, charges = 0) {
        if (!this.sprite) return;
        this.sprite.setVisible(visible);
        this.spriteBright.setVisible(visible);
        this.spriteRed.setVisible(visible);

        const showAftershock = visible && this.aftershockLevel > 0;
        this.aftershockBright.setVisible(showAftershock);
        this.aftershockRed.setVisible(showAftershock);

        if (visible && isIdle) {
            this.sprite.setAlpha(this.IDLE_ALPHA);
            this.spriteBright.setAlpha(0);
            this.spriteRed.setAlpha(0);
        }

        this.updateCharges(charges, 0, manualMode);
    }

    playAftershockAnimation(x, y, baseSize) {
        if (!this.aftershockBright) return;

        this.aftershockRed.setPosition(x, y);
        this.aftershockBright.setPosition(x, y);

        const size = baseSize + 100;
        this.aftershockBright.setSize(size, size);
        this.aftershockRed.setSize(size + 4, size + 4);

        this.aftershockBright.setAlpha(0.65);
        this.aftershockRed.setAlpha(0.35);
        this.aftershockBright.setScale(1.1);
        this.aftershockRed.setScale(1.15);

        PhaserScene.tweens.add({
            targets: [this.aftershockBright, this.aftershockRed],
            alpha: 0,
            scaleX: 1,
            scaleY: 1,
            duration: 600,
            ease: 'Quart.easeOut',
        });
    }

    setPointerVisibility(visible) {
        if (this.spritePointer) {
            this.spritePointer.setVisible(visible);
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
        messageBus.subscribe('phaseChanged', _onPhaseChanged);
        messageBus.subscribe('gamePaused', () => { model.paused = true; });
        messageBus.subscribe('gameResumed', () => { model.paused = false; });
        updateManager.addFunction(_update);

        // Global click listener for manual firing
        PhaserScene.input.on('pointerdown', () => {
            if (model.manualMode && model.active && !model.paused) {
                if (model.charges > 0) {
                    model.charges--;
                    _fire();
                }
            }
        });
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
        if (model.paused) return;

        // The pointer is always tracked and updated if combat is active
        const isCombat = gameStateMachine.getPhase() === GAME_CONSTANTS.PHASE_COMBAT;
        if (isCombat) {
            view.updatePosition(delta, GAME_VARS.mouseposx, GAME_VARS.mouseposy, model);
            view.updateCharges(model.charges, model.maxCharges, model.manualMode);
        }

        if (!model.active || !tower.isAlive()) {
            if (isCombat && !tower.isAlive()) {
                view.setVisibility(false);
            }
            return;
        }

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

        // ISOLATION PROTOCOL logic
        let actualDamage = model.damage;
        if (hits.length === 1 && model.isolationLevel > 0) {
            actualDamage *= (1 + 0.25 * model.isolationLevel);
        }
        // AREA SATURATION logic
        else if (hits.length > 1 && model.saturationLevel > 0) {
            actualDamage *= (1 + 0.05 * model.saturationLevel * (hits.length - 1));
        }

        for (let i = 0; i < hits.length; i++) {
            enemyManager.damageEnemy(hits[i], actualDamage);
        }

        // AFTERSHOCK logic
        if (model.aftershockLevel > 0) {
            PhaserScene.time.delayedCall(125, () => {
                if (!model.active || model.paused || !tower.isAlive() || gameStateMachine.getPhase() !== GAME_CONSTANTS.PHASE_COMBAT) return;

                view.playAftershockAnimation(cx, cy, model.size);

                const aftershockDamage = 4 * model.aftershockLevel;
                const aftershockSizeRadius = ((model.size + 100) / 2) + 5;
                const aftershockHits = enemyManager.getEnemiesInSquareRange(cx, cy, aftershockSizeRadius, _hitBuffer);
                for (let i = 0; i < aftershockHits.length; i++) {
                    enemyManager.damageEnemy(aftershockHits[i], aftershockDamage);
                }
            });
        }
    }

    function _onPhaseChanged(phase) {
        const isCombat = phase === GAME_CONSTANTS.PHASE_COMBAT;

        view.setPointerVisibility(isCombat);

        if (isCombat && model.unlocked) {
            model.active = true;
            model.resetTimer();
            view.setVisibility(true, true, model.manualMode, model.charges);
        } else {
            model.active = false;
            view.setVisibility(false);
        }
    }

    function setManualMode(enabled) {
        model.manualMode = enabled;
        if (!enabled) model.charges = 0;
    }

    function setFireInterval(ms) {
        model.setFireInterval(ms);
    }

    function setMaxCharges(newMax) {
        model.maxCharges = newMax;
    }

    function setIsolationLevel(level) {
        model.isolationLevel = level;
    }

    function setSaturationLevel(level) {
        model.saturationLevel = level;
    }

    function setAftershockLevel(level) {
        model.aftershockLevel = level;
        view.aftershockLevel = level;
    }

    return { init, unlock, setSize, setDamage, setManualMode, setMaxCharges, setFireInterval, setIsolationLevel, setSaturationLevel, setAftershockLevel };
})();
