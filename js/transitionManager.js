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

        // Skip fade - go straight to target phase
        gameStateMachine.goTo(targetPhase);
        transitioning = false;
    }

    function isTransitioning() {
        return transitioning;
    }

    return { init, transitionTo, isTransitioning };
})();
