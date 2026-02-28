// waveManager.js
// Manages wave lifecycle: listens for phase changes, coordinates
// enemy spawning (via enemyManager), and detects tower death → WAVE_COMPLETE.
//
// Topics published:
//   'waveComplete'          — wave ended (tower died or END ITERATION pressed)
//   'freezeEnemies'         — halt all enemy movement and spawning (death sequence)
//   'unfreezeEnemies'       — resume enemy update behaviour
//   'towerShakeRequested'   — ask tower to shake for N ms, then publish 'towerShakeComplete'
//
// Topics subscribed:
//   'phaseChanged'          — starts/stops wave logic based on phase
//   'towerDied'             — tower health reached 0
//   'towerShakeComplete'    — tower shake animation finished; finalize death sequence
//   'endIterationRequested' — player pressed END ITERATION button

const waveManager = (() => {
    let towerDiedSub = null;
    let deathOverlay = null; // module-level so _onTowerShakeComplete can clean it up

    function init() {
        messageBus.subscribe('phaseChanged',          _onPhaseChanged);
        messageBus.subscribe('endIterationRequested', endIteration);
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

        // Unsubscribe immediately to prevent re-entry
        if (towerDiedSub) { towerDiedSub.unsubscribe(); towerDiedSub = null; }

        // 1. Freeze all enemies — stop movement and spawning
        messageBus.publish('freezeEnemies');

        // 2. Block all cursor input
        helper.createGlobalClickBlocker(false);

        // 3. Signal HUD to hide the END ITERATION button immediately
        messageBus.publish('towerDeathStarted');

        // 4. Play explosion sound
        audio.play('retro_explosion', 1.0, false);

        // 5. Black pixel overlay scales up from center to full screen at 0.3 alpha.
        deathOverlay = PhaserScene.add.image(
            GAME_CONSTANTS.halfWidth, GAME_CONSTANTS.halfHeight, 'black_pixel'
        );
        deathOverlay.setScale(0);
        deathOverlay.setAlpha(0);
        deathOverlay.setDepth(GAME_CONSTANTS.DEPTH_DEATH_OVERLAY);

        PhaserScene.tweens.add({
            targets:  deathOverlay,
            scaleX:   GAME_CONSTANTS.WIDTH,
            scaleY:   GAME_CONSTANTS.HEIGHT,
            alpha:    0.3,
            duration: 350,
            ease:     'Quad.easeOut',
        });

        // 6. Request tower shake — _onTowerShakeComplete fires when done
        messageBus.subscribeOnce('towerShakeComplete', _onTowerShakeComplete);
        messageBus.publish('towerShakeRequested', 500);
    }

    function _onTowerShakeComplete() {
        if (deathOverlay) { deathOverlay.destroy(); deathOverlay = null; }
        helper.hideGlobalClickBlocker();
        messageBus.publish('unfreezeEnemies');
        gameStateMachine.goTo('WAVE_COMPLETE');
        debugLog('Death sequence complete — entering WAVE_COMPLETE');
    }

    /** Called via 'endIterationRequested' — voluntarily end combat. */
    function endIteration() {
        if (!gameStateMachine.is('WAVE_ACTIVE')) return;
        debugLog('Player ended iteration manually');
        gameStateMachine.goTo('WAVE_COMPLETE');
    }

    return { init, endIteration };
})();
