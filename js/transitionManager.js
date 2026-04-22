// transitionManager.js — 0.8s linear slide animation between phases.
// Uses cameraManager for camera-based transitions.
// Blocks all input during the transition via click blocker.

const transitionManager = (() => {
    let transitioning = false;
    let isWiping = false;
    let blocker = null;
    let _failsafeTimer = null;
    let _revealTimer = null;

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

        // Block clicks during transition using the global helper
        helper.createGlobalClickBlocker(false);

        const duration = GAME_CONSTANTS.TRANSITION_DURATION;

        if (targetPhase === GAME_CONSTANTS.PHASE_COMBAT) {
            messageBus.publish('AnnounceText', t('ui', 'combat_intro'));
            // First switch phase so game logic activates, then slide camera
            gameStateMachine.goTo(GAME_CONSTANTS.PHASE_COMBAT);

            if (typeof upgradeTree !== 'undefined' && upgradeTree.preTransitionHide) {
                upgradeTree.preTransitionHide();
            }

            if (_revealTimer) {
                _revealTimer.remove();
                _revealTimer = null;
            }

            const targetX = -GAME_CONSTANTS.halfWidth - 10;
            _tweenTreeGroup(targetX, duration);
            _tweenTreeMaskContainer(targetX, duration);
            _startFailsafe(duration);
            cameraManager.toCombatView(duration, () => {
                // Hide tree before publishing transitionComplete so subscribers see correct state
                if (typeof upgradeTree !== 'undefined') {
                    upgradeTree.hide();
                }
                _endTransition();
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
            _tweenTreeMaskContainer(targetX, duration);
            _startFailsafe(duration);
            // Bug 2 fix: use Phaser time so this respects time scaling, not wall-clock
            _revealTimer = PhaserScene.time.delayedCall(duration * 0.6, () => {
                _revealTimer = null;
                if (typeof upgradeTree !== 'undefined' && upgradeTree.revealCoordText) {
                    upgradeTree.revealCoordText();
                }
            });
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

    function _tweenTreeMaskContainer(targetX, duration) {
        if (typeof upgradeTree !== 'undefined') {
            const container = upgradeTree.getTreeMaskContainer();
            const shape = upgradeTree.getMaskShape ? upgradeTree.getMaskShape() : null;

            if (container) {
                PhaserScene.tweens.add({
                    targets: container,
                    x: targetX,
                    duration: duration,
                    ease: 'Cubic.easeOut'
                });
            }
            if (shape) {
                PhaserScene.tweens.add({
                    targets: shape,
                    x: targetX,
                    duration: duration,
                    ease: 'Cubic.easeOut'
                });
            }
        }
    }

    function _endTransition() {
        // Idempotency guard — prevents double-fire if failsafe AND camera callback both complete
        if (!transitioning) return;

        // Clear failsafe if normal completion fires first
        if (_failsafeTimer) {
            _failsafeTimer.remove();
            _failsafeTimer = null;
        }

        if (_revealTimer) {
            _revealTimer.remove();
            _revealTimer = null;
        }
        transitioning = false;
        helper.hideGlobalClickBlocker();
        messageBus.publish('transitionComplete');
    }

    function _startFailsafe(duration) {
        // Guard: if the camera callback never fires, force-end the transition
        // after duration + a generous 1s buffer so we never permanently lock up.
        // Note: _endTransition() has its own idempotency guard, so no need to check transitioning here.
        if (_failsafeTimer) _failsafeTimer.remove();
        _failsafeTimer = PhaserScene.time.delayedCall(duration + 1000, () => {
            console.warn('[transitionManager] Failsafe triggered — camera callback never fired.');
            _endTransition();
        });
    }

    function isTransitioning() {
        return transitioning;
    }

    return { init, transitionTo, isTransitioning };
})();
