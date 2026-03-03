// transitionManager.js — 0.8s linear slide animation between phases.
// Uses cameraManager for camera-based transitions.
// Blocks all input during the transition via click blocker.

const transitionManager = (() => {
    let transitioning = false;
    let blocker = null;

    function init() {
        // No subscriptions needed — called directly by neuralTree / iterationOverScreen
    }

    /**
     * Animate the visual transition via camera slide, then call gameStateMachine.goTo(targetPhase).
     * @param {'COMBAT_PHASE'|'UPGRADE_PHASE'} targetPhase
     */
    function transitionTo(targetPhase) {
        if (transitioning) return;
        transitioning = true;

        // Block clicks during transition
        blocker = new Button({
            normal: {
                ref: 'white_pixel',
                x: GAME_CONSTANTS.halfWidth,
                y: GAME_CONSTANTS.halfHeight,
                scaleX: GAME_CONSTANTS.WIDTH * 2,
                scaleY: GAME_CONSTANTS.HEIGHT * 2,
                alpha: 0.001,
                tint: 0x000000,
            },
            onMouseUp: () => { }
        });
        blocker.setDepth(200000);
        blocker.setScrollFactor(0);

        const duration = GAME_CONSTANTS.TRANSITION_DURATION;

        if (targetPhase === GAME_CONSTANTS.PHASE_COMBAT) {
            gameHUD.showTransitionMessage(GAME_CONSTANTS.COMBAT_INTRO_TEXT);
            // First switch phase so game logic activates, then slide camera
            gameStateMachine.goTo(GAME_CONSTANTS.PHASE_COMBAT);
            const targetX = -GAME_CONSTANTS.halfWidth - 10;

            _tweenTreeGroup(targetX, duration);
            cameraManager.toCombatView(duration, () => {
                _endTransition();
                if (typeof neuralTree !== 'undefined') {
                    neuralTree.hide();
                }
            });
        } else if (targetPhase === GAME_CONSTANTS.PHASE_UPGRADE) {
            // First switch phase so tree UI appears, then slide camera
            gameStateMachine.goTo(GAME_CONSTANTS.PHASE_UPGRADE);

            const targetX = 0;
            _tweenTreeGroup(targetX, duration);
            cameraManager.toUpgradeView(duration, () => {
                _endTransition();
            });
        } else {
            // Fallback — instant transition
            gameStateMachine.goTo(targetPhase);
            _endTransition();
        }
    }

    function _tweenTreeGroup(targetX, duration) {
        if (typeof neuralTree !== 'undefined' && neuralTree.getGroup) {
            const group = neuralTree.getGroup();
            if (group) {
                group.tweenTo(targetX, 0, { duration, ease: 'Cubic.easeOut' });
            }
        }
    }

    function _endTransition() {
        transitioning = false;
        if (blocker) {
            blocker.destroy();
            blocker = null;
        }
    }

    function isTransitioning() {
        return transitioning;
    }

    return { init, transitionTo, isTransitioning };
})();
