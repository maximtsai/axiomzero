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
        debugLog('Tower died — ending wave');
        gameStateMachine.goTo('WAVE_COMPLETE');
    }

    /** Called by END ITERATION button — voluntarily end combat. */
    function endIteration() {
        if (!gameStateMachine.is('WAVE_ACTIVE')) return;
        debugLog('Player ended iteration manually');
        gameStateMachine.goTo('WAVE_COMPLETE');
    }

    return { init, endIteration };
})();
