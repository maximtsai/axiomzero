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

    // --- State ---
    let active = false;
    let isEnding = false;
    let blocker = null;
    let topBar = null;
    let bottomBar = null;

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    /**
     * Plays a cinematic cutscene.
     * @param {Function} [actionCallback] - Called once bars are fully in.
     *   Receives a single argument: the `endCutscene` callback to call when done.
     */
    function playCutscene(actionCallback) {
        if (active) return;
        active = true;
        isEnding = false;

        console.log('[Cinematic] Cutscene started');

        // Block all custom buttons
        if (typeof buttonManager !== 'undefined') buttonManager.setBlocked(true);

        _createBlocker();
        _createBars();
        _fadeUI(0, FADE_IN_DUR);
        _slideBarsIn(() => {
            if (actionCallback) {
                actionCallback(endCutscene);
            } else {
                PhaserScene.time.delayedCall(3000, endCutscene);
            }
        });
    }

    /**
     * Ends the cinematic sequence, slides bars out, restores UI, and cleans up.
     */
    function endCutscene() {
        if (!active || isEnding) return;
        isEnding = true;

        console.log('[Cinematic] Cutscene ending');

        _fadeUI(1, FADE_OUT_DUR);
        _slideBarsOut(() => {
            // Unblock custom buttons
            if (typeof buttonManager !== 'undefined') buttonManager.setBlocked(false);

            _cleanup();
            active = false;
            isEnding = false;
            console.log('[Cinematic] Cutscene finished');
        });
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    function _createBlocker() {
        blocker = PhaserScene.add.image(GAME_CONSTANTS.halfWidth, GAME_CONSTANTS.halfHeight, 'white_pixel');
        blocker.setDepth(BLOCKER_DEPTH)
            .setDisplaySize(GAME_CONSTANTS.WIDTH, GAME_CONSTANTS.HEIGHT)
            .setScrollFactor(0)
            .setAlpha(0.1)
            .setInteractive(); // absorbs pointer events
    }

    function _createBars() {
        const cx = GAME_CONSTANTS.halfWidth;
        topBar = PhaserScene.add.image(cx, -BAR_HEIGHT / 2, 'black_pixel');
        topBar.setDepth(BAR_DEPTH).setDisplaySize(GAME_CONSTANTS.WIDTH, BAR_HEIGHT).setScrollFactor(0);

        bottomBar = PhaserScene.add.image(cx, GAME_CONSTANTS.HEIGHT + BAR_HEIGHT / 2, 'black_pixel');
        bottomBar.setDepth(BAR_DEPTH).setDisplaySize(GAME_CONSTANTS.WIDTH, BAR_HEIGHT).setScrollFactor(0);
    }

    function _slideBarsIn(onComplete) {
        PhaserScene.tweens.add({ targets: topBar, y: BAR_HEIGHT / 2, duration: IN_DURATION, ease: 'Cubic.easeInOut' });
        PhaserScene.tweens.add({ targets: bottomBar, y: GAME_CONSTANTS.HEIGHT - BAR_HEIGHT / 2, duration: IN_DURATION, ease: 'Cubic.easeInOut', onComplete });
    }

    function _slideBarsOut(onComplete) {
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

    return { playCutscene, endCutscene };
})();
