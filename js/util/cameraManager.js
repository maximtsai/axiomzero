/**
 * @fileoverview Camera management singleton — shake, flash, and slide transitions.
 * The camera scrolls between views rather than moving game objects.
 * @module cameraManager
 *
 * Views:
 *   Combat:  scrollX = 0 (tower at screen center)
 *   Upgrade: scrollX = -halfWidth (tower visible in right half, tree panel on left)
 */
const cameraManager = (() => {
    let camera = null;
    let sliding = false;

    function init() {
        camera = PhaserScene.cameras.main;
    }

    /**
     * Smoothly scroll the camera to a target scrollX.
     * @param {number} targetX - Target scrollX value.
     * @param {number} [duration=GAME_CONSTANTS.TRANSITION_DURATION] - Transition duration in ms.
     * @param {string} [ease='Cubic.easeOut'] - Easing function.
     * @param {Function} [onComplete] - Called when slide finishes.
     */
    function slideTo(targetX, duration = GAME_CONSTANTS.TRANSITION_DURATION, ease = 'Cubic.easeOut', onComplete) {
        if (!camera) return;
        sliding = true;
        PhaserScene.tweens.add({
            targets: camera,
            scrollX: targetX,
            duration,
            ease,
            onComplete: () => {
                sliding = false;
                if (onComplete) onComplete();
            }
        });
    }

    /** Scroll camera to Upgrade Phase view (tower in right half). */
    function toUpgradeView(duration = GAME_CONSTANTS.TRANSITION_DURATION, onComplete) {
        slideTo(-GAME_CONSTANTS.halfWidth / 2, duration, 'Cubic.easeOut', onComplete);
    }

    /** Scroll camera to Combat view (tower centered). */
    function toCombatView(duration = GAME_CONSTANTS.TRANSITION_DURATION, onComplete) {
        slideTo(0, duration, 'Cubic.easeOut', onComplete);
    }

    /**
     * Camera shake effect.
     * @param {number} [duration=150] - Duration in ms.
     * @param {number} [intensity=0.01] - Shake intensity (0–1).
     */
    function shake(duration = 150, intensity = 0.01) {
        if (!camera) return;
        camera.shake(duration, intensity);
    }

    /**
     * Screen flash effect.
     * @param {number} [duration=500] - Flash duration in ms.
     * @param {number} [r=255] @param {number} [g=255] @param {number} [b=255]
     */
    function flash(duration = 500, r = 255, g = 255, b = 255) {
        if (!camera) return;
        camera.flash(duration, r, g, b);
    }

    /** @returns {boolean} True if a slide transition is currently active. */
    function isSliding() {
        return sliding;
    }

    /** @returns {number} Current camera scrollX. */
    function getScrollX() {
        return camera ? camera.scrollX : 0;
    }

    return { init, slideTo, toUpgradeView, toCombatView, shake, flash, isSliding, getScrollX };
})();
