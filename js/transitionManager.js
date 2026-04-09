// transitionManager.js — 0.8s linear slide animation between phases.
// Uses cameraManager for camera-based transitions.
// Blocks all input during the transition via click blocker.

const transitionManager = (() => {
    let transitioning = false;
    let blocker = null;

    function init() {
        // No subscriptions needed — called directly by upgradeTree / iterationOverScreen
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
                scaleX: GAME_CONSTANTS.WIDTH,
                scaleY: GAME_CONSTANTS.HEIGHT,
                alpha: 0.001,
                tint: 0x000000,
            },
            onMouseUp: () => { }
        });
        blocker.setDepth(200000);
        blocker.setScrollFactor(0);

        const duration = GAME_CONSTANTS.TRANSITION_DURATION;

        if (targetPhase === GAME_CONSTANTS.PHASE_COMBAT) {
            messageBus.publish('AnnounceText', t('ui', 'combat_intro'));
            // First switch phase so game logic activates, then slide camera
            gameStateMachine.goTo(GAME_CONSTANTS.PHASE_COMBAT);

            if (typeof upgradeTree !== 'undefined' && upgradeTree.preTransitionHide) {
                upgradeTree.preTransitionHide();
            }

            const targetX = -GAME_CONSTANTS.halfWidth - 10;
            _tweenTreeGroup(targetX, duration);
            cameraManager.toCombatView(duration, () => {
                _endTransition();
                if (typeof upgradeTree !== 'undefined') {
                    upgradeTree.hide();
                }

            });
            // Trigger visual "System Scan" on wave start
            if (typeof glitchFX !== 'undefined') {
                glitchFX.triggerSystemScan(1300);
            }
        } else if (targetPhase === GAME_CONSTANTS.PHASE_UPGRADE) {
            // Stop boss track & bring back main BGM if applicable
            audio.stopComplexTransition(GAME_CONSTANTS.AUDIO_TRANSITIONS.BOSS);

            // First switch phase so tree UI appears, then slide camera
            gameStateMachine.goTo(GAME_CONSTANTS.PHASE_UPGRADE);

            const targetX = 0;
            _tweenTreeGroup(targetX, duration);
            setTimeout(() => {
                if (typeof upgradeTree !== 'undefined' && upgradeTree.revealCoordText) {
                    upgradeTree.revealCoordText();
                }
            }, duration * 0.6)
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
        if (typeof upgradeTree !== 'undefined' && upgradeTree.getGroup) {
            const group = upgradeTree.getGroup();
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
        messageBus.publish('transitionComplete');
    }

    function isTransitioning() {
        return transitioning;
    }

    return { init, transitionTo, isTransitioning };
})();
