// cursorAttack.js — Player cursor AOE cursor attack (Refactored to MVC).
// A nine-sliced square centered on the mouse that fires every FIRE_INTERVAL ms,
// dealing DAMAGE to all enemies within its AOE. Activated by "awaken" node.
// Visual: 0.3 alpha idle, flashes to 1 on fire with Quart.easeOut tween back.

class PulseAttackModel {
    constructor() {
        this.FIRE_INTERVAL = 2000;  // ms between pulses
        this.BASE_DAMAGE = 4;
        this.BASE_SIZE = 100;    // px — AOE square side length

        this.active = false;  // true when combat phase AND node purchased
        this.unlocked = false;  // true after awaken purchased
        this.paused = false;
        this.fireTimer = 0;
        this.size = this.BASE_SIZE;  // current square side length (upgradeable)
        this.damage = this.BASE_DAMAGE; // current damage per pulse (upgradeable)

        this.charges = 0;
        this.maxCharges = 2;
        this.canQueueClick = false;
        this.wasCanQueueClick = false; // Track previous state for animation
        this.clickQueued = false;
        this.isolationLevel = 0;
        this.saturationLevel = 0;
        this.aftershockLevel = 0;
        this.persistentExploitLevel = 0;
        this.bombArmed = false;
        this.bombAnimating = false;
        this.bombReadyToFire = false;
        this.bombQueued = false;
        this.bombFired = false;
        this.maxBombUses = 0;
        this.bombUses = 0;
        this.resonanceLevel = 0;
        this.currentAttackCount = 0;
    }

    resetTimer() {
        this.fireTimer = 0;
    }

    setFireInterval(ms) {
        this.FIRE_INTERVAL = ms;
    }

    setMaxBombUses(count) {
        this.maxBombUses = count;
        this.bombUses = count;
        messageBus.publish('bombUsesChanged', { uses: this.bombUses, max: this.maxBombUses });
    }

    updateTimer(delta) {
        if (this.bombArmed) return false; // No auto-attack while bomb is armed

        this.fireTimer += delta;

        // Check if within 225ms window for a new charge
        if (this.manualMode && this.charges < this.maxCharges) {
            this.canQueueClick = (this.fireTimer >= this.FIRE_INTERVAL - 225);
        } else {
            this.canQueueClick = false;
        }

        if (this.fireTimer >= this.FIRE_INTERVAL) {
            this.fireTimer -= this.FIRE_INTERVAL;
            this.canQueueClick = false; // Gained charge, reset window

            if (this.manualMode) {
                if (this.charges < this.maxCharges) {
                    this.charges++;
                }

                // If a click was queued, fire it immediately
                if (this.clickQueued && this.charges > 0) {
                    this.charges--;
                    this.clickQueued = false;
                    return true;
                }
                return false;
            }
            return true;
        }
        return false;
    }
}

class PulseAttackView {
    constructor() {
        this.IDLE_ALPHA = 0.9;
        this.FLASH_ALPHA = 1.0;
        this.FLASH_DURATION = 500;  // ms — tween from flash back to idle
        this.CORNER_SIZE = 30;    // nine-slice corner size

        this.sprite = null;
        this.spriteBright = null;
        this.spritePointer = null;
        this.spriteRed = null;
        this.aftershockBright = null;
        this.aftershockRed = null;

        this.artillerySprite = null;
        this.artilleryBright = null;
        this.artilleryBrightGlow = null;
        this.artilleryBlack = null;
        this.artilleryRed = null;

        this.shakeVelX = 0;
        this.shakeVelY = 0;
        this.shakeX = 0;
        this.shakeY = 0;
        this.chargeSprites = [];
        this.playerReloadSprite = null;
        this.reloadSizeTween = null;
        this.reloadAlphaTween = null;
        this.aftershockLevel = 0;
        this.wavePool = null;
        this.detonateReminderText = null;
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
        this.sprite.setBlendMode(Phaser.BlendModes.ADD);
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
        this.spriteRed.setBlendMode(Phaser.BlendModes.ADD);
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
        this.spriteBright.setBlendMode(Phaser.BlendModes.ADD);
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
        this.aftershockRed.setBlendMode(Phaser.BlendModes.ADD);
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
        this.aftershockBright.setBlendMode(Phaser.BlendModes.ADD);
        this.aftershockBright.setScrollFactor(0);
        this.aftershockBright.setVisible(false);

        // Pointer sprite
        this.spritePointer = PhaserScene.add.image(0, 0, 'player', 'player_pointer.png');
        this.spritePointer.setDepth(GAME_CONSTANTS.DEPTH_TOWER + 4);
        this.spritePointer.setBlendMode(Phaser.BlendModes.ADD);
        this.spritePointer.setScrollFactor(0);
        this.spritePointer.setVisible(false);

        // Charge indicators (Right-to-left at top-right of the square)
        for (let i = 0; i < 8; i++) { // Increased to support upgrades
            const s = PhaserScene.add.image(0, 0, 'player', 'player_pointer.png');
            s.setScale(1.25);
            s.setDepth(GAME_CONSTANTS.DEPTH_TOWER + 5);
            s.setScrollFactor(0);
            s.setVisible(false);
            this.chargeSprites.push(s);
        }

        // Reload animation sprite (nineslice with 2px corners)
        this.playerReloadSprite = PhaserScene.add.nineslice(
            0, 0,
            'player', 'player_nineslice.png',
            32, 32,
            2, 2, 2, 2
        );
        this.playerReloadSprite.setOrigin(0.5, 0.5);
        this.playerReloadSprite.setDepth(GAME_CONSTANTS.DEPTH_TOWER + 6);
        this.playerReloadSprite.setAlpha(0);
        this.playerReloadSprite.setScrollFactor(0);
        this.playerReloadSprite.setVisible(false);

        // Wave effect pool
        this.wavePool = new ObjectPool(
            () => {
                const slice = PhaserScene.add.nineslice(0, 0, 'player', 'cursorwave.png', 110, 110, 50, 50, 50, 50);
                slice.setOrigin(0.5, 0.5);
                slice.setDepth(-2);
                slice.setVisible(false);
                slice.setActive(false);
                return slice;
            },
            (fx) => {
                fx.setScrollFactor(0);
                fx.setVisible(false);
                fx.setActive(false);
            }
        ).preAllocate(5);

        // Artillery Bomb sprites (40px corners)
        const artInitSize = initialSize + 20;

        this.artillerySprite = PhaserScene.add.nineslice(
            0, 0,
            'player', 'artillery.png',
            artInitSize, artInitSize,
            40, 40, 40, 40
        );
        this.artillerySprite.setOrigin(0.5, 0.5).setDepth(GAME_CONSTANTS.DEPTH_TOWER + 10).setScrollFactor(0).setVisible(false);
        this.artillerySprite.rotVel = 0;
        this.reentryExtraSize = 0;

        this.artilleryBright = PhaserScene.add.nineslice(
            0, 0,
            'player', 'artillery_bright.png',
            artInitSize, artInitSize,
            40, 40, 40, 40
        );
        this.artilleryBright.setOrigin(0.5, 0.5).setDepth(GAME_CONSTANTS.DEPTH_TOWER + 11).setScrollFactor(0).setVisible(false).setBlendMode(Phaser.BlendModes.ADD);

        this.artilleryBrightGlow = PhaserScene.add.nineslice(
            0, 0,
            'player', 'artillery_bright_glow.png',
            artInitSize, artInitSize,
            70, 70, 70, 70
        );
        this.artilleryBrightGlow.setOrigin(0.5, 0.5).setDepth(GAME_CONSTANTS.DEPTH_TOWER + 9).setScrollFactor(0).setVisible(false).setBlendMode(Phaser.BlendModes.ADD);

        this.artilleryBlack = PhaserScene.add.nineslice(
            0, 0,
            'player', 'artillery_black.png',
            artInitSize, artInitSize,
            40, 40, 40, 40
        );
        this.artilleryBlack.setOrigin(0.5, 0.5).setDepth(2).setScrollFactor(0).setVisible(false);

        this.artilleryRed = PhaserScene.add.nineslice(
            0, 0,
            'player', 'artillery_red.png',
            artInitSize, artInitSize,
            40, 40, 40, 40
        );
        this.artilleryRed.setOrigin(0.5, 0.5).setDepth(GAME_CONSTANTS.DEPTH_TOWER + 8).setScrollFactor(0).setVisible(false).setBlendMode(Phaser.BlendModes.ADD);

        // Subtle detonation reminder text
        const isMobile = helper.isMobileDevice();
        const reminderMsg = isMobile ? "CLICK TO DETONATE" : "SPACEBAR TO DETONATE";
        this.detonateReminderText = PhaserScene.add.text(GAME_CONSTANTS.halfWidth, GAME_CONSTANTS.halfHeight + 375, reminderMsg, {
            fontFamily: 'MunroSmall',
            fontSize: '26px',
            color: '#FFFFFF',
            align: 'center'
        });
        this.detonateReminderText.setOrigin(0.5).setDepth(GAME_CONSTANTS.DEPTH_HUD).setScrollFactor(0).setVisible(false).setAlpha(0);
        this.detonateReminderText.setStroke('#000000', 8);
        this.detonateReminderText.setBlendMode(Phaser.BlendModes.ADD);
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

    setDetonateReminderVisibility(visible) {
        if (!this.detonateReminderText) return;

        const isUpgrade = gameStateMachine.getPhase() === GAME_CONSTANTS.PHASE_UPGRADE;
        const targetX = GAME_CONSTANTS.halfWidth + (isUpgrade ? 400 : 0);
        const targetY = GAME_CONSTANTS.halfHeight + (isUpgrade ? 325 : 375);

        this.detonateReminderText.setPosition(targetX, targetY);

        this.detonateReminderText.setVisible(visible);
        this.detonateReminderText.setAlpha(visible ? 0.6 : 0);
    }

    updatePosition(delta, targetX, targetY, model) {
        if (!this.sprite) return;

        this.sprite.setPosition(targetX + this.shakeX, targetY + this.shakeY);
        this.spriteBright.setPosition(targetX, targetY);
        this.spritePointer.setPosition(targetX, targetY);
        this.spriteRed.setPosition(targetX + this.shakeX * 0.5, targetY + this.shakeY * 0.5);

        if (this.artillerySprite && model.bombArmed && !model.bombFired) {
            this.artillerySprite?.setPosition(targetX, targetY);
            this.artilleryBright?.setPosition(targetX, targetY);
            this.artilleryBrightGlow?.setPosition(targetX, targetY);
            this.artilleryBlack?.setPosition(targetX, targetY);
            this.artilleryRed?.setPosition(targetX, targetY);
        }

        // Physics: calculate rotational spring wobble
        const rotAccel = this.sprite.rotation * -0.1 - this.sprite.rotVel * 0.23;
        this.sprite.rotVel += rotAccel;
        this.sprite.rotation += this.sprite.rotVel * delta * 0.14;

        this.spriteBright.setRotation(this.sprite.rotation);

        if (this.artillerySprite && (!model.bombArmed && model.bombFired)) {
            const rotAccelArt = this.artillerySprite.rotation * -0.1 - this.artillerySprite.rotVel * 0.32;
            this.artillerySprite.rotVel += rotAccelArt;
            this.artillerySprite.rotation += this.artillerySprite.rotVel * delta * 0.14;
            this.artilleryBright.setRotation(this.artillerySprite.rotation);
            this.artilleryBrightGlow?.setRotation(this.artillerySprite.rotation);
        }

        const size = model.size;
        const topY = targetY - size / 2 - 4; // 4px above edge (matching user's recent change)
        const leftAnchorX = targetX - size / 2 + 4; // Offset from left edge
        const spacing = 13;

        for (let i = 0; i < this.chargeSprites.length; i++) {
            const s = this.chargeSprites[i];
            // i=0 is the first charge (leftmost), i=1 is the second (to its right), etc.
            s.setPosition(leftAnchorX + i * spacing + 3, topY - 2);
        }

        // Position reload sprite over the NEXT available slot
        if (this.playerReloadSprite.visible) {
            const nextIdx = model.charges;
            if (nextIdx < this.chargeSprites.length) {
                this.playerReloadSprite.setPosition(leftAnchorX + nextIdx * spacing + 3, topY - 2);
            }
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

    playCursorReentryEffect(baseSize) {
        this.reentryExtraSize = 280;
        PhaserScene.tweens.add({
            targets: this,
            reentryExtraSize: 0,
            duration: 250,
            ease: 'Quart.easeOut',
            onUpdate: () => {
                this.setSize(baseSize + this.reentryExtraSize);
            }
        });
    }

    playFireAnimation(isResonanceHit = false) {
        if (!this.sprite) return;

        const flippedLeft = Math.random() < 0.5;
        const goalRot = flippedLeft ? -0.29 : 0.29;

        const extraScale = Math.max(0, (200 - this.sprite.width) * 0.005);
        const resMultiplier = isResonanceHit ? 1.3 : 1.0;

        // Pulse flash overlay
        this.spriteBright.setAlpha(this.FLASH_ALPHA);
        this.spriteBright.setScale((1.35 + extraScale) * resMultiplier);
        this.spriteBright.setRotation(goalRot);
        this.sprite.setRotation(goalRot);

        this.spriteRed.setAlpha(0.40);
        this.spriteRed.setScale((1.35 + extraScale) * resMultiplier);
        this.spriteRed.setRotation((Math.random() - 0.5) * 0.09);

        // Tween alpha back to 0
        PhaserScene.tweens.add({
            delay: 60,
            targets: [this.spriteBright, this.spriteRed],
            alpha: 0,
            duration: this.FLASH_DURATION,
            ease: 'Quart.easeOut',
        });
        PhaserScene.tweens.add({
            delay: 90,
            targets: [this.spriteBright, this.spriteRed],
            alpha: 0,
            duration: this.FLASH_DURATION + 100,
            ease: 'Cubic.easeOut',
        });


        this.sprite.setScale((1.4 + extraScale) * resMultiplier);

        PhaserScene.tweens.add({
            targets: [this.sprite, this.spriteBright],
            scaleX: 1,
            scaleY: 1,
            duration: 250,
            ease: 'Cubic.easeOut',
        });

        PhaserScene.tweens.add({
            targets: [this.spriteRed],
            scaleX: 1,
            scaleY: 1,
            rotation: 0,
            duration: 400,
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

    setVisibility(visible, isIdle = true, manualMode = false, charges = 0, bombArmed = false, bombFired = false) {
        if (!this.sprite) return;
        this.sprite.setVisible(visible && !bombArmed && !bombFired);
        this.spriteBright.setVisible(visible && !bombArmed && !bombFired);
        this.spriteRed.setVisible(visible && !bombArmed && !bombFired);

        const showAftershock = visible && this.aftershockLevel > 0;
        this.aftershockBright.setVisible(showAftershock);
        this.aftershockRed.setVisible(showAftershock);
        if (visible && isIdle) {
            this.sprite.setAlpha(this.IDLE_ALPHA);
        }

        if (this.artillerySprite && !bombArmed && !bombFired) {
            this.artillerySprite.setVisible(false);
            this.artilleryBright.setVisible(false);
            this.artilleryBrightGlow?.setVisible(false);
            this.artilleryBlack.setVisible(false);
            this.artilleryRed.setVisible(false);
        }

        this.updateCharges(charges, 0, manualMode && !bombArmed && !bombFired);
    }

    playReloadAnimation() {
        if (!this.playerReloadSprite) return;

        if (this.reloadSizeTween) this.reloadSizeTween.stop();
        if (this.reloadAlphaTween) this.reloadAlphaTween.stop();

        this.playerReloadSprite.setVisible(true);
        this.playerReloadSprite.setAlpha(0);
        this.playerReloadSprite.width = 36;
        this.playerReloadSprite.height = 36;

        this.reloadSizeTween = PhaserScene.tweens.add({
            targets: this.playerReloadSprite,
            width: 6,
            height: 6,
            duration: 225,
            ease: 'Quad.easeIn'
        });

        this.reloadAlphaTween = PhaserScene.tweens.add({
            targets: this.playerReloadSprite,
            alpha: 1,
            duration: 225,
            ease: 'Linear',
            onComplete: () => {
                this.playerReloadSprite.alpha = 0;
            }
        });
    }

    stopReloadAnimation() {
        if (this.reloadSizeTween) this.reloadSizeTween.stop();
        if (this.reloadAlphaTween) this.reloadAlphaTween.stop();
        this.reloadSizeTween = null;
        this.reloadAlphaTween = null;

        if (this.playerReloadSprite) {
            this.playerReloadSprite.setAlpha(0);
            this.playerReloadSprite.setVisible(false);
        }
    }

    playAftershockAnimation(x, y, baseSize) {
        if (!this.aftershockBright) return;

        this.aftershockRed.setPosition(x, y);
        this.aftershockBright.setPosition(x, y);

        const size = baseSize + 100;
        this.aftershockBright.setSize(size - 2, size - 2);
        this.aftershockRed.setSize(size, size);

        this.aftershockBright.setAlpha(0.9);
        this.aftershockRed.setAlpha(0.6);
        this.aftershockBright.setScale(1.1);
        this.aftershockRed.setScale(1.17);

        // White tint flash — instant detonation feel
        this.aftershockBright.setTintFill(0xffffff).setAlpha(0.5);
        this.aftershockRed.setTintFill(0xffffff).setAlpha(0.35);
        PhaserScene.time.delayedCall(50, () => {
            if (this.aftershockBright) {
                this.aftershockBright.setAlpha(0.45).clearTint();
                this.aftershockRed.setAlpha(0.40).clearTint();
            }
        });

        PhaserScene.tweens.add({
            targets: [this.aftershockBright],
            scaleX: 1,
            scaleY: 1,
            duration: 450,
            easeParams: [2],
            ease: 'Back.easeOut',
        });
        PhaserScene.tweens.add({
            targets: [this.aftershockRed],
            scaleX: 0.98,
            scaleY: 0.98,
            duration: 450,
            easeParams: [2],
            ease: 'Back.easeOut',
        });
        PhaserScene.tweens.add({
            targets: [this.aftershockBright, this.aftershockRed],
            delay: 75,
            alpha: 0,
            duration: 525,
            ease: 'Quart.easeOut',
        });
    }

    /** Recoil: briefly shrink the main pulse sprite then spring back. */
    playRecoil() {
        if (!this.sprite) return;

        PhaserScene.tweens.add({
            targets: this.sprite,
            scaleX: 0.9,
            scaleY: 0.9,
            duration: 40,
            ease: 'Cubic.easeOut',
            onComplete: () => {
                PhaserScene.tweens.add({
                    targets: this.sprite,
                    scaleX: 1,
                    scaleY: 1,
                    duration: 180,
                    ease: 'Back.easeOut',
                    easeParams: [3],
                });
            }
        });
    }

    setPointerVisibility(visible) {
        if (this.spritePointer) {
            this.spritePointer.setVisible(visible);
        }
    }

    playWaveEffect(x, y, baseSize) {
        if (!this.wavePool) return;

        const fx = this.wavePool.get();
        if (!fx) return;

        const startSize = 50 + baseSize * 0.15;
        const endSize = 50 + baseSize * 1.08;
        fx.setPosition(x, y);
        fx.width = startSize;
        fx.height = startSize;
        fx.setAlpha(1);
        fx.setVisible(true);
        fx.setActive(true);

        const tweenDuration = 400 + Math.floor(baseSize * 0.5);

        PhaserScene.tweens.add({
            targets: fx,
            width: endSize,
            height: endSize,
            duration: tweenDuration,
            ease: 'Cubic.easeOut'
        });

        PhaserScene.tweens.add({
            targets: fx,
            alpha: 0,
            duration: tweenDuration,
            ease: 'Quad.easeOut',
            onComplete: () => {
                this.wavePool.release(fx);
            }
        });
    }

    playBombArmAnimation(baseSize, finalBombSize, onPhase1Complete, onPhase2Complete) {
        if (!this.artillerySprite) return;

        this.artillerySprite.setVisible(true).setAlpha(1);
        this.artilleryBright.setVisible(false).setAlpha(1);

        this.artillerySprite.setRotation(0);

        const initSize = baseSize + 20;
        this.artillerySprite.setSize(initSize, initSize);

        // Store tweens so they can be cancelled
        this.armTweens = [];

        // Phase 1: +300 units, 0.25s, Back.easeOut
        const randStartRot = Math.random() < 0.5 ? -0.08 : 0.08;
        const tw1 = PhaserScene.tweens.add({
            targets: [this.artillerySprite],
            width: initSize + 420,
            height: initSize + 420,
            rotation: randStartRot,
            duration: 100,
            ease: 'Quart.easeOut',
            easeParams: [4],
            onComplete: () => {
                const tw2 = PhaserScene.tweens.add({
                    targets: [this.artillerySprite],
                    width: initSize + 320,
                    height: initSize + 320,
                    rotation: 0,
                    duration: 140,
                    ease: 'Back.easeOut',
                    easeParams: [2.5],
                    onComplete: () => {
                        if (onPhase1Complete) onPhase1Complete();
                        const overshootSize = finalBombSize + 90;

                        const tw3 = PhaserScene.tweens.add({
                            targets: [this.artillerySprite],
                            width: overshootSize,
                            height: overshootSize,
                            rotation: -randStartRot,
                            duration: 90,
                            ease: 'Quart.easeOut',
                            onComplete: () => {
                                // Phase 2: +150 units, 0.2s, Back.easeOut
                                this.artilleryBright.setSize(finalBombSize, finalBombSize);
                                this.artilleryBright.setRotation(0);
                                const tw4 = PhaserScene.tweens.add({
                                    targets: [this.artillerySprite],
                                    width: finalBombSize,
                                    height: finalBombSize,
                                    rotation: 0,
                                    duration: 200,
                                    ease: 'Back.easeOut',
                                    easeParams: [3.5]
                                });
                                this.armTweens.push(tw4);
                                // Bug 3 fix: store so cancelBomb can cancel it
                                this.phase2Timer = PhaserScene.time.delayedCall(100, () => {
                                    this.phase2Timer = null;
                                    onPhase2Complete();
                                });
                            }
                        });
                        this.armTweens.push(tw3);
                    }
                });
                this.armTweens.push(tw2);
            }
        });
        this.armTweens.push(tw1);
    }

    playBombCancelAnimation(baseSize) {
        // Stop any expansion tweens
        if (this.armTweens) {
            this.armTweens.forEach(t => t.stop());
            this.armTweens = [];
        }
        // Bug 3 fix: cancel the phase2 delayedCall if it's still pending
        if (this.phase2Timer) {
            this.phase2Timer.remove();
            this.phase2Timer = null;
        }

        const targetSize = baseSize + 20;

        PhaserScene.tweens.add({
            targets: [this.artillerySprite],
            width: targetSize,
            height: targetSize,
            duration: 300,
            ease: 'Cubic.easeIn',
            onComplete: () => {
                this.artillerySprite.setVisible(false);
                this.artilleryBright.setVisible(false);
            }
        });
    }

    playBombFireAnimation(finalSize, x, y, onDetonate, onComplete) {
        if (!this.artillerySprite) return;

        // Lock position for all artillery layers
        this.artillerySprite?.setPosition(x, y);
        this.artilleryBright?.setPosition(x, y);
        this.artilleryBrightGlow?.setPosition(x, y);
        this.artilleryBlack?.setPosition(x, y);
        this.artilleryRed?.setPosition(x, y);
        this.artilleryBrightGlow.setAlpha(0.1).setVisible(true);
        this.artilleryBrightGlow.setSize(this.artillerySprite.width + 50, this.artillerySprite.height + 50);
        // Anticipation (0.2s)
        PhaserScene.tweens.add({
            targets: [this.artillerySprite, this.artilleryBrightGlow],
            scaleX: 1.035,
            scaleY: 1.035,
            alpha: 1,
            duration: 210,
            onComplete: () => {
                PhaserScene.cameras.main.setZoom(1.03);
                // Zoom in slightly here
                // DETONATE
                // Slow down the game (80% slower = 0.2x speed)
                this.artillerySprite.setVisible(false);
                this.artilleryBrightGlow.setVisible(false);
                PhaserScene.time.timeScale = 0.15;
                PhaserScene.anims.globalTimeScale = 0.15;
                GAME_VARS.timeScale = 0.15;

                PhaserScene.time.delayedCall(10, () => {
                    this.artilleryBrightGlow.setVisible(false);
                    PhaserScene.time.delayedCall(5, () => {
                        this.artilleryBrightGlow.setVisible(true);
                        PhaserScene.time.delayedCall(3, () => {
                            this.artilleryBrightGlow.setVisible(false);
                        });
                    });
                });
                PhaserScene.time.delayedCall(20, () => {
                    if (onDetonate) onDetonate();
                    cameraManager.shake(200, 0.02);
                    // 1. Show artilleryBlack for 0.075s
                    this.artilleryBlack.setVisible(true).setAlpha(1);
                    this.artilleryBlack.setSize(finalSize, finalSize);
                    this.artilleryBlack.setScale(1.04);
                    this.artilleryBlack.setRotation(this.artillerySprite.rotation);

                    this.artillerySprite.setVisible(false);


                    this.artilleryRed.setVisible(true).setAlpha(0.80);
                    this.artilleryRed.setSize(finalSize + 30, finalSize + 30);


                    PhaserScene.time.delayedCall(9, () => {
                        PhaserScene.cameras.main.setZoom(1.0);
                        this.artilleryBlack.setVisible(false);
                        this.artillerySprite.setVisible(true);
                        this.artilleryBright.setVisible(true).setAlpha(1);
                        PhaserScene.time.delayedCall(20, () => {
                            PhaserScene.time.delayedCall(13, () => {
                                // Always restore game speed to 1.0 to prevent capture bugs
                                PhaserScene.time.timeScale = 1.0;
                                PhaserScene.tweens.timeScale = 1.0;
                                PhaserScene.anims.globalTimeScale = 1.0;
                                GAME_VARS.timeScale = 1.0;
                            });
                            // 2. Hide artilleryBlack (as requested: "artilleryBlack is set invisible")

                            // 3. Show others and start animation
                            this.artillerySprite.setVisible(true).setAlpha(1);

                            this.artillerySprite.setScale(1.15);
                            this.artilleryBright.setScale(1.17).setAlpha(1);
                            this.artilleryRed.setScale(1.2);

                            const randRot = Math.random() < 0.5 ? -0.12 : 0.12;
                            this.artillerySprite.setRotation(randRot);
                            this.artilleryBright.setRotation(randRot);
                            this.artilleryRed.setRotation(randRot * 0.25);

                            // Tween them back
                            PhaserScene.tweens.add({
                                targets: [this.artillerySprite, this.artilleryBright, this.artilleryRed],
                                scaleX: 1,
                                scaleY: 1,
                                duration: 400,
                                ease: 'Quart.easeOut'
                            });

                            this.artilleryBright.setAlpha(1);

                            PhaserScene.tweens.add({
                                targets: [this.artilleryBright, this.artilleryRed],
                                delay: 70,
                                alpha: 0,
                                duration: 200,
                                ease: 'Quad.easeOut',
                            });

                            PhaserScene.tweens.add({
                                targets: [this.artilleryBright],
                                alpha: 0,
                                duration: 450,
                                ease: 'Quad.easeIn',
                                onComplete: () => {
                                    this.artillerySprite.setVisible(false);
                                    this.artilleryBright.setVisible(false);
                                    this.artilleryBrightGlow.setVisible(false);
                                    this.artilleryBlack.setVisible(false);
                                    this.artilleryRed.setVisible(false);
                                    if (onComplete) onComplete();
                                }
                            });

                            // Shake for impact
                            zoomShake(1.02);
                        });
                    });
                });
            }
        });
    }
}

// The Controller IIFE
const pulseAttack = (() => {
    const model = new PulseAttackModel();
    const view = new PulseAttackView();
    let _lastPulseDetune = 0;

    // Reusable array for enemy queries — avoids GC
    const _hitBuffer = [];

    /** Helper to apply testing offset to damage calculations during upgrade phase */
    function _getDamageCoordX(x) {
        if (gameStateMachine.getPhase() === GAME_CONSTANTS.PHASE_UPGRADE && (typeof GAME_VARS !== 'undefined' && GAME_VARS.testingDefenses)) {
            return x - 400;
        }
        return x;
    }

    function init() {
        view.init(model.size);
        messageBus.subscribe('phaseChanged', _onPhaseChanged);
        messageBus.subscribe('gamePaused', () => { model.paused = true; });
        messageBus.subscribe('gameResumed', () => { model.paused = false; });
        messageBus.subscribe('testingDefensesStarted', () => {
            _resetState();
            model.active = true;
            view.setVisibility(true, true, model.manualMode, model.charges);
            view.setPointerVisibility(true);
        });
        messageBus.subscribe('testingDefensesEnded', () => {
            _resetState();
            model.active = false;
            view.setVisibility(false);
            view.setPointerVisibility(false);
        });
        updateManager.addFunction(_update);

        // Global click listener for manual firing
        PhaserScene.input.on('pointerdown', (pointer, currentlyOver) => {
            if (currentlyOver && currentlyOver.length > 0) return;
            if (typeof buttonManager !== 'undefined' && (buttonManager.lastHovered || buttonManager.isAnyButtonHovered(pointer.x, pointer.y))) return;

            const isTesting = typeof GAME_VARS !== 'undefined' && GAME_VARS.testingDefenses;

            if (model.bombArmed) {
                if (model.bombReadyToFire) {
                    _fireBomb();
                } else if (model.bombAnimating) {
                    // Instruction: if first animation finished (0.25s), click queues.
                    // model.bombAnimating is true for the FULL 0.45s.
                    // Phase 1 completion sets a different flag?
                    // I'll implement a 'canQueueBomb' check.
                    if (model.canQueueBomb) {
                        model.bombQueued = true;
                    }
                }
            } else if (model.manualMode && (model.active || isTesting) && !model.paused && !model.bombFired) {
                if (model.charges > 0) {
                    model.charges--;
                    model.clickQueued = false; // Cancel any queue if we clicked naturally
                    _fire();
                } else if (model.canQueueClick) {
                    model.clickQueued = true;
                }
            }
        });

        // Spacebar listener for armBomb and detonation
        PhaserScene.input.keyboard.on('keydown-SPACE', () => {
            const isUpgrade = gameStateMachine.getPhase() === GAME_CONSTANTS.PHASE_UPGRADE;
            if ((!model.active && !isUpgrade) || model.paused || !tower.isAlive()) return;

            if (model.bombArmed) {
                if (model.bombReadyToFire) {
                    _fireBomb();
                } else if (model.bombAnimating && model.canQueueBomb) {
                    model.bombQueued = true;
                }
            } else {
                armBomb();
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

        const phase = gameStateMachine.getPhase();
        const isTesting = (typeof GAME_VARS !== 'undefined' && GAME_VARS.testingDefenses);
        const inActivePhase = (phase === GAME_CONSTANTS.PHASE_COMBAT || isTesting || phase === GAME_CONSTANTS.PHASE_UPGRADE);

        if (inActivePhase) {
            const cx = GAME_VARS.mouseposx;
            const cy = GAME_VARS.mouseposy;
            view.updatePosition(delta, cx, cy, model);
            view.updateCharges(model.charges, model.maxCharges, model.manualMode && !model.bombArmed);

            // Handle reload animation trigger
            if (model.active && model.manualMode && model.canQueueClick && !model.wasCanQueueClick && !model.bombArmed) {
                view.playReloadAnimation();
            }
            if ((!model.canQueueClick && model.wasCanQueueClick) || !model.active || model.bombArmed) {
                view.stopReloadAnimation();
            }
            model.wasCanQueueClick = model.canQueueClick;
        }

        const isVisible = (phase === GAME_CONSTANTS.PHASE_COMBAT || isTesting) && tower.isAlive();
        view.setVisibility(isVisible, true, model.manualMode, model.charges, model.bombArmed, model.bombFired);

        // Manage detonation reminder text
        view.setDetonateReminderVisibility(model.bombReadyToFire);

        if (!model.active || !tower.isAlive() || model.bombArmed || model.bombFired) {
            return;
        }

        // Auto-attack if in combat OR testing (Sandbox Mode)
        const canAutoFire = (phase === GAME_CONSTANTS.PHASE_COMBAT || isTesting);
        if (canAutoFire && model.updateTimer(delta)) {
            _fire();
        }
    }

    function _determineResonance(model) {
        if (model.resonanceLevel <= 0) return false;
        model.currentAttackCount++;
        if (model.currentAttackCount >= 4) {
            model.currentAttackCount = 0;
            return true;
        }
        return false;
    }

    function _fire() {
        const cx = GAME_VARS.mouseposx;
        const cy = GAME_VARS.mouseposy;
        const damageSize = (model.size / 2) + 5;

        // Play cursor pulse sound with unique detune
        let detune = (Math.random() * 500 - 250);
        if (Math.abs(detune - _lastPulseDetune) < 50) {
            detune = (Math.random() * 500 - 250);
        }
        _lastPulseDetune = detune;
        const s = audio.play('cursor_pulse', 0.3);
        if (s) s.detune = detune;

        const isResonanceHit = _determineResonance(model);
        view.playFireAnimation(isResonanceHit);
        view.playWaveEffect(cx, cy, model.size);

        // Micro camera shake
        zoomShake(1.005);

        const damageX = _getDamageCoordX(cx);

        // Damage all enemies in range
        const hits = enemyManager.getEnemiesInSquareRange(damageX, cy, damageSize, _hitBuffer);

        // Calculate base actual damage
        let actualDamage = model.damage;

        // ISOLATION PROTOCOL logic
        if (hits.length === 1 && model.isolationLevel > 0) {
            actualDamage *= (1 + 0.40 * model.isolationLevel);
        }
        // AREA SATURATION logic
        else if (hits.length > 1 && model.saturationLevel > 0) {
            actualDamage += (model.saturationLevel * (hits.length - 1));
        }

        // Apply double damage from RESONANCE last so it doubles additive bonuses too
        if (isResonanceHit) {
            actualDamage *= 2;
        }

        if (isResonanceHit) {
            // Audio punch for resonance hit
            const r = audio.play('retro1', 0.5);
            if (r) r.detune = 200;
        }

        for (let i = 0; i < hits.length; i++) {
            const enemy = hits[i];
            let damageToApply = actualDamage;

            // ISOLATION bonus visual flag
            if (hits.length === 1 && model.isolationLevel > 0) {
                enemy.model.wasIsolatedHit = true;
            }

            // RESONANCE bonus visual flag
            if (isResonanceHit) {
                enemy.model.wasResonanceHit = true;
            }

            // REPEAT EXPLOIT logic
            if (model.persistentExploitLevel > 0 && enemy.model.hitByPulse) {
                damageToApply += (4 * model.persistentExploitLevel);
            }

            enemyManager.damageEnemy(enemy, damageToApply, 'cursor');
            enemy.model.hitByPulse = true;
        }

        // AFTERSHOCK logic
        if (model.aftershockLevel > 0) {
            PhaserScene.time.delayedCall(100, () => {
                const isInCombat = gameStateMachine.getPhase() === GAME_CONSTANTS.PHASE_COMBAT || (typeof GAME_VARS !== 'undefined' && GAME_VARS.testingDefenses);
                if (!model.active || model.paused || !tower.isAlive() || !isInCombat) return;

                view.playAftershockAnimation(cx, cy, model.size);
                view.playRecoil();

                const aftershockDamage = 4 + 2 * model.aftershockLevel;
                const aftershockSizeRadius = ((model.size + 100) / 2) + 5;
                const damageX = _getDamageCoordX(cx);

                const aftershockHits = enemyManager.getEnemiesInSquareRange(damageX, cy, aftershockSizeRadius, _hitBuffer);
                for (let i = 0; i < aftershockHits.length; i++) {
                    enemyManager.damageEnemy(aftershockHits[i], aftershockDamage, 'cursor');
                }
            });
        }
    }

    function _onPhaseChanged(phase) {
        const isCombat = phase === GAME_CONSTANTS.PHASE_COMBAT;

        view.setPointerVisibility(isCombat || GAME_VARS.testingDefenses);

        if ((isCombat || GAME_VARS.testingDefenses) && model.unlocked) {
            model.active = true;
            model.resetTimer();
            view.setVisibility(true, true, model.manualMode, model.charges);
        } else {
            _resetState();
            model.active = false;
            view.setVisibility(false);
        }
    }

    function _resetState() {
        model.bombArmed = false;
        model.bombAnimating = false;
        model.bombReadyToFire = false;
        model.bombQueued = false;
        model.bombFired = false;
        model.canQueueBomb = false;
        model.clickQueued = false;
        model.charges = model.maxCharges;
        model.fireTimer = 0;
        model.bombUses = model.maxBombUses;
        model.currentAttackCount = 0;
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

    function setPersistentExploitLevel(level) {
        model.persistentExploitLevel = level;
    }

    function setResonanceLevel(level) {
        model.resonanceLevel = level;
        if (level === 0) model.currentAttackCount = 0;
    }

    function getBombFinalSize() {
        // Base bomb visual scale bonus is 500 units larger than base pulse.
        // This can be extended to include node-specific multipliers later.
        return model.size + 500;
    }

    function cancelBomb() {
        if (!model.bombArmed || model.bombFired) return;

        model.bombArmed = false;
        model.bombAnimating = false;
        model.bombReadyToFire = false;
        model.bombQueued = false;
        model.canQueueBomb = false;

        // Refund the charge — clamped defensively in case of state inconsistency
        model.bombUses = Math.min(model.bombUses + 1, model.maxBombUses);
        messageBus.publish('bombUsesChanged', { uses: model.bombUses, max: model.maxBombUses });

        view.playBombCancelAnimation(model.size);
        messageBus.publish('cursorBombCancelled');
    }

    function armBomb() {
        const isUpgrade = (gameStateMachine.getPhase() === GAME_CONSTANTS.PHASE_UPGRADE);
        const canArm = model.active || isUpgrade;
        if (!canArm || model.bombArmed || model.bombFired || model.bombUses <= 0) return;

        if (gameStateMachine.getPhase() === GAME_CONSTANTS.PHASE_UPGRADE) {
            if (typeof GAME_VARS !== 'undefined') {
                const wasTesting = GAME_VARS.testingDefenses;
                GAME_VARS.testingDefenses = true;
                if (!wasTesting) {
                    messageBus.publish('testingDefensesStarted');
                }
            }
        }

        model.bombUses--;
        messageBus.publish('bombUsesChanged', { uses: model.bombUses, max: model.maxBombUses });
        model.bombArmed = true;
        model.bombAnimating = true;
        model.bombReadyToFire = false;
        model.bombQueued = false;
        model.canQueueBomb = false;

        messageBus.publish('cursorBombArmed');

        view.playBombArmAnimation(
            model.size,
            getBombFinalSize(),
            () => {
                // Phase 1 (0.28s) Complete
                model.canQueueBomb = true;
                messageBus.publish('cursorBombCanCancel');
            },
            () => {
                // Phase 2 (0.5s total) Complete
                model.bombAnimating = false;
                model.bombReadyToFire = true;
                if (model.bombQueued) {
                    _fireBomb();
                }
            }
        );
    }

    function _fireBomb() {
        model.bombReadyToFire = false;
        model.bombAnimating = false;
        model.bombQueued = false;
        model.bombFired = true;
        messageBus.publish('cursorBombFired');

        const cx = GAME_VARS.mouseposx;
        const cy = GAME_VARS.mouseposy;
        const finalSize = getBombFinalSize();

        view.playBombFireAnimation(finalSize, cx, cy,
            () => {
                // This callback runs after the 0.2s anticipation
                model.bombArmed = false;

                // Slow down hit enemies too
                const damageSize = finalSize / 2 + 5;
                const damage = model.damage + 40;

                const damageX = _getDamageCoordX(cx);
                const hits = enemyManager.getEnemiesInSquareRange(damageX, cy, damageSize, _hitBuffer);
                for (let i = 0; i < hits.length; i++) {
                    enemyManager.damageEnemy(hits[i], damage, 'cursor');
                    if (typeof hits[i].forceSlow === 'function') {
                        hits[i].forceSlow(0.25, 0.1);
                    }
                }

                model.resetTimer();
                view.playWaveEffect(cx, cy, finalSize);
            },
            () => {
                // This callback runs after the entire explosion animation finishes
                model.bombFired = false;

                // Infinite recharge in upgrade phase
                if (gameStateMachine.getPhase() === GAME_CONSTANTS.PHASE_UPGRADE) {
                    model.bombUses = model.maxBombUses;
                    // Bug 1 fix: consistent object payload format
                    messageBus.publish('bombUsesChanged', { uses: model.bombUses, max: model.maxBombUses });

                    // Auto-stop testing if all enemies cleared
                    if (typeof GAME_VARS !== 'undefined' && GAME_VARS.testingDefenses) {
                        const enemyCount = enemyManager.getActiveEnemies().length;
                        if (enemyCount === 0) {
                            GAME_VARS.testingDefenses = false;
                            messageBus.publish('testingDefensesEnded');
                        }
                    }
                }

                view.playCursorReentryEffect(model.size);
                messageBus.publish('cursorBombReady');
            }
        );
    }

    function setMaxBombUses(count) {
        model.maxBombUses = count;
        model.bombUses = count;
        messageBus.publish('bombUsesChanged', { uses: model.bombUses, max: model.maxBombUses });
    }

    return { init, unlock, setSize, setDamage, setManualMode, setMaxCharges, setFireInterval, setIsolationLevel, setSaturationLevel, setAftershockLevel, setPersistentExploitLevel, setResonanceLevel, armBomb, cancelBomb, setMaxBombUses, getModel: () => model };
})();
