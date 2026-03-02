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
     * @param {'WAVE_ACTIVE'|'UPGRADE_PHASE'} targetPhase
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

        if (targetPhase === 'WAVE_ACTIVE') {
            // First switch phase so game logic activates, then slide camera
            gameStateMachine.goTo('WAVE_ACTIVE');
            const targetX = -GAME_CONSTANTS.halfWidth;

            _tweenTreeGroup(targetX, duration);
            cameraManager.toCombatView(duration, () => {
                _endTransition();
            });
        } else if (targetPhase === 'UPGRADE_PHASE') {
            // First switch phase so tree UI appears, then slide camera
            gameStateMachine.goTo('UPGRADE_PHASE');

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
                group.tweenTo(targetX, 0, { duration, ease: 'Sine.easeInOut' });
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
