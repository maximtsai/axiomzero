// waveManager.js
// Manages wave lifecycle: listens for phase changes, coordinates
// enemy spawning (via enemyManager), and detects tower death → WAVE_COMPLETE.
//
// Topics published:
//   'waveComplete'   — wave ended (tower died or END ITERATION pressed)
//
// Topics subscribed:
//   'phaseChanged'   — starts/stops wave logic based on phase
//   'towerDied'      — tower health reached 0

const waveManager = (() => {
    let towerDiedSub = null;

    function init() {
        messageBus.subscribe('phaseChanged', _onPhaseChanged);
    }

    function _onPhaseChanged(phase) {
        if (phase === 'WAVE_ACTIVE') {
            _startWave();
        } else {
            _stopWave();
        }
    }

    function _startWave() {
        debugLog('Wave started — wave', gameState.currentWave || 1);

        // Reset tower for this combat session
        tower.reset();

        // Listen for tower death
        towerDiedSub = messageBus.subscribe('towerDied', _onTowerDied);

        // enemyManager picks up WAVE_ACTIVE from phaseChanged and begins spawning
    }

    function _stopWave() {
        if (towerDiedSub) {
            towerDiedSub.unsubscribe();
            towerDiedSub = null;
        }
        // enemyManager handles its own cleanup on phaseChanged
    }

    function _onTowerDied() {
        debugLog('Tower died — playing death sequence');

        // Unsubscribe immediately to prevent any re-entry
        if (towerDiedSub) { towerDiedSub.unsubscribe(); towerDiedSub = null; }

        // 1. Freeze all enemies — stop movement and spawning
        enemyManager.freeze();

        // 2. Block all cursor input
        helper.createGlobalClickBlocker(false);

        // 3. Signal HUD to hide the END ITERATION button immediately
        messageBus.publish('towerDeathStarted');

        // 4. Play explosion sound
        audio.play('retro_explosion', 1.0, false);

        // 5. Black pixel overlay scales up from center to full screen at 0.3 alpha.
        // black_pixel is 1×1 — drive display size via scaleX/scaleY directly so
        // the scale tween (0 → game dimensions) produces a clean expand-from-center.
        const deathOverlay = PhaserScene.add.image(
            GAME_CONSTANTS.halfWidth, GAME_CONSTANTS.halfHeight, 'black_pixel'
        );
        deathOverlay.setScale(0);
        deathOverlay.setAlpha(0);
        deathOverlay.setDepth(GAME_CONSTANTS.DEPTH_DEATH_OVERLAY);

        PhaserScene.tweens.add({
            targets:  deathOverlay,
            scaleX:   GAME_CONSTANTS.WIDTH,   // 1×1 px → 1280 px wide
            scaleY:   GAME_CONSTANTS.HEIGHT,  // 1×1 px → 720 px tall
            alpha:    0.3,
            duration: 350,
            ease:     'Quad.easeOut',
        });

        // 6. Tower shakes violently for 500ms, then transition to WAVE_COMPLETE
        tower.shake(500, () => {
            deathOverlay.destroy();
            helper.hideGlobalClickBlocker();
            enemyManager.unfreeze(); // also cleared properly by WAVE_COMPLETE
            gameStateMachine.goTo('WAVE_COMPLETE');
            debugLog('Death sequence complete — entering WAVE_COMPLETE');
        });
    }

    /** Called by END ITERATION button — voluntarily end combat. */
    function endIteration() {
        if (!gameStateMachine.is('WAVE_ACTIVE')) return;
        debugLog('Player ended iteration manually');
        gameStateMachine.goTo('WAVE_COMPLETE');
    }

    return { init, endIteration };
})();
