/**
 * @fileoverview Cinematic manager for orchestrating "cutscenes" and high-level UI animations.
 * Handles letterboxing, click blocking, and global HUD fading.
 * @module cinematicManager
 */

const cinematicManager = (() => {
    // --- Constants ---
    const BAR_HEIGHT = 100;
    const IN_DURATION = 1400;
    const OUT_DURATION = 1100;
    const FADE_IN_DUR = 800;
    const FADE_OUT_DUR = 600;
    const BLOCKER_DEPTH = 10001;
    const BAR_DEPTH = 10002;
    const RESOLVE_PCT = 0.15; // Actions start at 40% of intro completion

    // --- State ---
    let active = false;
    let isEnding = false;
    let isMinimal = false;
    let blocker = null;
    let topBar = null;
    let bottomBar = null;

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    /**
     * Plays a cinematic cutscene.
     * @returns {Promise<Function>} A promise that resolves with the `endCutscene` function 
     * once intro animations are complete.
     */
    function playCutscene() {
        if (active) return Promise.resolve(() => { });
        active = true;
        isEnding = false;
        isMinimal = false;

        console.log('[Cinematic] Cutscene started');

        // Block all custom buttons
        if (typeof buttonManager !== 'undefined') buttonManager.setBlocked(true);

        _createBlocker();
        _createBars();
        _fadeUI(0, FADE_IN_DUR);
        _slideBarsIn();

        return new Promise(resolve => {
            // Resolve early at 75% to allow actions to overlap with finishing bars
            PhaserScene.time.delayedCall(IN_DURATION * RESOLVE_PCT, () => {
                resolve(endCutscene);
            });
        });
    }

    /**
     * Plays a minimal cinematic sequence (blocks input and fades UI, but no black bars).
     */
    function playCutsceneMinimal() {
        if (active) return Promise.resolve(() => { });
        active = true;
        isEnding = false;
        isMinimal = true;

        console.log('[Cinematic] Minimal cutscene started');

        if (typeof buttonManager !== 'undefined') buttonManager.setBlocked(true);

        _createBlocker();
        _fadeUI(0, FADE_IN_DUR);

        return new Promise(resolve => {
            PhaserScene.time.delayedCall(IN_DURATION * RESOLVE_PCT, () => {
                resolve(endCutscene);
            });
        });
    }

    /**
     * Ends the cinematic sequence, slides bars out, restores UI, and cleans up.
     * @param {Function} [onComplete] - Optional callback called after the exit animation and cleanup are finished.
     */
    function endCutscene(onComplete) {
        if (!active || isEnding) {
            if (onComplete) onComplete();
            return;
        }
        isEnding = true;

        console.log('[Cinematic] Cutscene ending');

        _fadeUI(1, FADE_OUT_DUR);

        const onFinish = () => {
            if (typeof buttonManager !== 'undefined') buttonManager.setBlocked(false);

            _cleanup();
            active = false;
            isEnding = false;
            isMinimal = false;
            console.log('[Cinematic] Cutscene finished');
            if (onComplete) onComplete();
        };

        if (isMinimal) {
            // Wait for UI fade-in to finish before cleaning up
            PhaserScene.time.delayedCall(FADE_OUT_DUR, onFinish);
        } else {
            _slideBarsOut(onFinish);
        }
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    /**
     * Plays a brief "System Scan" interruption effect.
     * Simulates a hostile system scan with text and a visual stutter.
     */
    function playSystemScanInterruption() {
        if (active) return Promise.resolve();
        active = true;

        console.log('[Cinematic] System Scan Interruption triggered');

        // Slow down game speed by 70% (timeScale 0.3)
        // We set applyToTweens to false so the cinematic tweens themselves aren't slowed
        if (typeof timeManager !== 'undefined') {
            timeManager.applyTimeScale(0.3, false);
        }

        // Block input
        if (typeof buttonManager !== 'undefined') buttonManager.setBlocked(true);

        const overlay = _createInterruptionOverlay();

        // Play glitch sound if available
        if (typeof audio !== 'undefined') {
            audio.play('glitch_heavy', 0.7);
        }

        return new Promise(resolve => {
            // Brief "freeze" simulation - just wait a tiny bit before starting animations
            PhaserScene.time.delayedCall(50, () => {
                // Flash the text and scanline
                PhaserScene.tweens.add({
                    targets: overlay.container,
                    alpha: 1,
                    duration: 30,
                    yoyo: true,
                    repeat: 3,
                    onComplete: () => {
                        // Restore time scale
                        if (typeof timeManager !== 'undefined') {
                            timeManager.applyTimeScale(1, true);
                        }
                        // Keep it visible for a moment
                        PhaserScene.time.delayedCall(100, () => {
                            _cleanupInterruption(overlay);
                            active = false;
                            if (typeof buttonManager !== 'undefined') buttonManager.setBlocked(false);
                            resolve();
                        });
                    }
                });
            });
        });
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    function _createInterruptionOverlay() {
        const cx = GAME_CONSTANTS.halfWidth;
        const cy = GAME_CONSTANTS.halfHeight;
        const container = PhaserScene.add.container(0, 0).setDepth(BLOCKER_DEPTH + 50).setScrollFactor(0);

        // Dark red vignette/flash
        const flash = PhaserScene.add.image(cx, cy, 'buttons', 'white_pixel.png');
        flash.setDisplaySize(GAME_CONSTANTS.WIDTH, GAME_CONSTANTS.HEIGHT)
            .setTint(0xff0000)
            .setAlpha(0.2);

        const text = PhaserScene.add.text(cx, cy, 'CRITICAL_PROCESS_INTERRUPTION', {
            fontFamily: 'Michroma',
            fontSize: '42px',
            color: '#ff0000',
            backgroundColor: '#000000',
            padding: { x: 20, y: 10 }
        }).setOrigin(0.5);

        const subtext = PhaserScene.add.text(cx, cy + 60, 'SYSTEM_SCAN_IN_PROGRESS...', {
            fontFamily: 'Quantico-Bold',
            fontSize: '24px',
            color: '#ff0000'
        }).setOrigin(0.5);

        container.add([flash, text, subtext]);
        container.setAlpha(0);

        if (typeof upgradeTree !== 'undefined' && upgradeTree.assignToUICamera) {
            upgradeTree.assignToUICamera(container);
        }

        return { container, flash, text, subtext };
    }

    function _cleanupInterruption(overlay) {
        if (overlay.container) overlay.container.destroy();
    }

    function _createBlocker() {
        blocker = PhaserScene.add.image(GAME_CONSTANTS.halfWidth, GAME_CONSTANTS.halfHeight, 'buttons', 'white_pixel.png');
        blocker.isTreeElement = true; // Prevent automatic ignore from tree cameras
        blocker.setDepth(BLOCKER_DEPTH)
            .setDisplaySize(GAME_CONSTANTS.WIDTH, GAME_CONSTANTS.HEIGHT)
            .setScrollFactor(0)
            .setAlpha(0.001)
            .setInteractive(); // absorbs pointer events

        if (typeof upgradeTree !== 'undefined' && upgradeTree.assignToUICamera) {
            upgradeTree.assignToUICamera(blocker);
        }
    }

    function _createBars() {
        const cx = GAME_CONSTANTS.halfWidth;
        topBar = PhaserScene.add.image(cx, -BAR_HEIGHT / 2, 'buttons', 'black_pixel.png');
        topBar.isTreeElement = true;
        topBar.setDepth(BAR_DEPTH).setDisplaySize(GAME_CONSTANTS.WIDTH, BAR_HEIGHT).setScrollFactor(0);

        bottomBar = PhaserScene.add.image(cx, GAME_CONSTANTS.HEIGHT + BAR_HEIGHT / 2, 'buttons', 'black_pixel.png');
        bottomBar.isTreeElement = true;
        bottomBar.setDepth(BAR_DEPTH).setDisplaySize(GAME_CONSTANTS.WIDTH, BAR_HEIGHT).setScrollFactor(0);

        if (typeof upgradeTree !== 'undefined' && upgradeTree.assignToUICamera) {
            upgradeTree.assignToUICamera(topBar);
            upgradeTree.assignToUICamera(bottomBar);
        }
    }

    function _slideBarsIn() {
        if (!topBar || !bottomBar) return;
        PhaserScene.tweens.add({ targets: topBar, y: BAR_HEIGHT / 2, duration: IN_DURATION, ease: 'Cubic.easeInOut' });
        PhaserScene.tweens.add({ targets: bottomBar, y: GAME_CONSTANTS.HEIGHT - BAR_HEIGHT / 2, duration: IN_DURATION, ease: 'Cubic.easeInOut' });
    }

    function _slideBarsOut(onComplete) {
        if (!topBar || !bottomBar) {
            if (onComplete) onComplete();
            return;
        }
        PhaserScene.tweens.add({ targets: topBar, y: -BAR_HEIGHT / 2, duration: OUT_DURATION, ease: 'Cubic.easeInOut' });
        PhaserScene.tweens.add({ targets: bottomBar, y: GAME_CONSTANTS.HEIGHT + BAR_HEIGHT / 2, duration: OUT_DURATION, ease: 'Cubic.easeInOut', onComplete });
    }

    /** Fades all registered UI modules to `target` alpha over `duration` ms. */
    function _fadeUI(target, duration) {
        if (typeof gameHUD !== 'undefined' && gameHUD.setAlpha) _animateAlpha(v => gameHUD.setAlpha(v), target, duration);
        if (typeof upgradeTree !== 'undefined' && upgradeTree.setUIAlpha) _animateAlpha(v => upgradeTree.setUIAlpha(v), target, duration);
    }

    /**
     * Tweens a numeric proxy and pipes it into an arbitrary setter.
     * @param {Function} setter - Called each frame with the current alpha value.
     */
    function _animateAlpha(setter, target, duration) {
        const proxy = { v: 1 - target };
        PhaserScene.tweens.add({
            targets: proxy,
            v: target,
            duration,
            onUpdate: () => setter(proxy.v)
        });
    }

    function _cleanup() {
        if (blocker) { blocker.destroy(); blocker = null; }
        if (topBar) { topBar.destroy(); topBar = null; }
        if (bottomBar) { bottomBar.destroy(); bottomBar = null; }
    }

    /** @returns {boolean} Whether a cinematic is currently active. */
    function isActive() {
        return active;
    }

    // --- Glitch Pooling ---
    let glitchPool = null;

    function _getGlitchFromPool(x, y, frame) {
        if (!glitchPool) {
            glitchPool = PhaserScene.add.group({
                classType: Phaser.GameObjects.Image,
                maxSize: 60
            });
        }
        
        let sprite = glitchPool.get(x, y, 'glitch', frame);
        if (!sprite) {
            // If pool is full, recycle the oldest one or just skip
            sprite = glitchPool.getFirstDead(false);
            if (!sprite) return null;
            sprite.setPosition(x, y).setFrame(frame);
        }

        const alpha = Phaser.Math.FloatBetween(0.2, 0.9);
        sprite.setActive(true).setVisible(true).setAlpha(alpha);
        if (typeof upgradeTree !== 'undefined' && upgradeTree.assignToUICamera) {
            upgradeTree.assignToUICamera(sprite);
        }
        return sprite;
    }

    /**
     * Punchy glitch effect for boss spawns. 
     * Scatters jittery glitch sprites across the screen over time.
     * @param {number} intensity - multiplier for glitch frequency
     * @param {number} duration - total time the effect runs in ms
     */
    function playBossSpawnGlitch(intensity = 1.0, duration = 400) {
        const frames = ['glitch_large.png', 'glitch_medium.png', 'glitch_small.png'];
        const cx = GAME_CONSTANTS.halfWidth;
        const cy = GAME_CONSTANTS.halfHeight;
        const minDistSq = 240 * 240;

        // Calculate count based on intensity/duration
        const baseCount = 10;
        const count = Math.floor(baseCount * intensity * (duration / 400));
        
        for (let i = 0; i < count; i++) {
            const delay = (duration / count) * i;

            PhaserScene.time.delayedCall(delay, () => {
                const frame = frames[Math.floor(Math.random() * frames.length)];
                let x = Math.random() * GAME_CONSTANTS.WIDTH;
                let y = Math.random() * GAME_CONSTANTS.HEIGHT;
                
                // One retry if too close to tower
                if ((x - cx) ** 2 + (y - cy) ** 2 < minDistSq) {
                    x = Math.random() * GAME_CONSTANTS.WIDTH;
                    y = Math.random() * GAME_CONSTANTS.HEIGHT;
                }

                const sprite = _getGlitchFromPool(x, y, frame);
                if (!sprite) return;

                sprite.setDepth(BLOCKER_DEPTH + 100)
                      .setScrollFactor(0)
                      .setFlip(Math.random() < 0.5, Math.random() < 0.5)
                      .setTint(0xff0000);

                PhaserScene.tweens.add({
                    targets: sprite,
                    x: x + (Math.random() - 0.5) * 40,
                    y: y + (Math.random() - 0.5) * 40,
                    alpha: 0,
                    duration: Phaser.Math.Between(150, 400),
                    ease: 'Cubic.easeOut',
                    onComplete: () => {
                        sprite.setActive(false).setVisible(false);
                    }
                });
            });
        }
    }

    return { playCutscene, playCutsceneMinimal, playSystemScanInterruption, playBossSpawnGlitch, endCutscene, isActive };
})();
