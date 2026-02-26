// transitionManager.js — 0.8s linear slide animation between phases.
// Blocks all input during the transition via click blocker.
// Not a state machine phase — it's a visual bridge between goTo() calls.

const transitionManager = (() => {
    let transitioning = false;

    function init() {
        // No subscriptions needed — called directly by neuralTree / iterationOverScreen
    }

    /**
     * Animate the visual transition, then call gameStateMachine.goTo(targetPhase).
     * @param {'WAVE_ACTIVE'|'UPGRADE_PHASE'} targetPhase
     */
    function transitionTo(targetPhase) {
        if (transitioning) return;
        transitioning = true;

        // Block all input
        helper.createGlobalClickBlocker(false);

        const duration = GAME_CONSTANTS.TRANSITION_DURATION;

        // For Phase 1, a simple fade-through-black approach:
        // 1. Fade overlay to black over half the duration
        // 2. Switch phase state (HUD reconfigures)
        // 3. Fade overlay back to transparent

        const overlay = PhaserScene.add.image(
            GAME_CONSTANTS.halfWidth, GAME_CONSTANTS.halfHeight, 'white_pixel'
        );
        overlay.setDisplaySize(GAME_CONSTANTS.WIDTH, GAME_CONSTANTS.HEIGHT);
        overlay.setTint(0x000000);
        overlay.setAlpha(0);
        overlay.setDepth(GAME_CONSTANTS.DEPTH_TRANSITION);

        let completed = false;

        function _finish() {
            if (completed) return;
            completed = true;
            overlay.destroy();
            helper.hideGlobalClickBlocker();
            transitioning = false;
        }

        // Fade in
        PhaserScene.tweens.add({
            targets: overlay,
            alpha: 1,
            duration: duration / 2,
            ease: 'Linear',
            onComplete: () => {
                // Switch phase at the midpoint (while screen is black)
                gameStateMachine.goTo(targetPhase);

                // Fade out
                PhaserScene.tweens.add({
                    targets: overlay,
                    alpha: 0,
                    duration: duration / 2,
                    ease: 'Linear',
                    onComplete: _finish,
                });
            },
        });

        // Safety fallback: if tweens stall, force-complete after duration + buffer
        setTimeout(() => {
            if (!completed) {
                debugLog('Transition fallback triggered');
                if (gameStateMachine.getPhase() !== targetPhase) {
                    gameStateMachine.goTo(targetPhase);
                }
                _finish();
            }
        }, duration + 500);
    }

    function isTransitioning() {
        return transitioning;
    }

    return { init, transitionTo, isTransitioning };
})();
