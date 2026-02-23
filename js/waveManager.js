// waveManager.js
// Manages wave spawning, enemy logic, and win/fail detection.
// Responds to 'phaseChanged' events from gameStateMachine.
//
// Topics published:
//   'enemyKilled'    — an enemy was destroyed
//   'waveComplete'   — all enemies in the wave are dead
//
// Topics subscribed:
//   'phaseChanged'   — starts/stops wave logic based on phase

const waveManager = (() => {

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
        // TODO: spawn enemies, start wave timer
    }

    function _stopWave() {
        // TODO: clean up enemies, cancel timers
    }

    return { init };

})();
