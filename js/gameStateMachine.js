// gameStateMachine.js
// Owns the current game phase and broadcasts transitions via messageBus.
//
// Phases:
//   'UPGRADE_PHASE' — between waves; player spends currency and prepares
//   'COMBAT_PHASE'   — wave is running; enemies are alive
//   'WAVE_COMPLETE' — wave just ended; brief pause before returning to upgrades
//   'GAME_OVER'     — player failed the wave
//
// Usage:
//   gameStateMachine.goTo('COMBAT_PHASE');
//   gameStateMachine.getPhase();          // → 'COMBAT_PHASE'
//   messageBus.subscribe('phaseChanged', (phase) => { ... });

const gameStateMachine = (() => {
    let currentPhase = null;

    function goTo(phase, data = {}) {
        if (currentPhase === phase) return;
        debugLog(`Phase: ${currentPhase} → ${phase}`);
        currentPhase = phase;
        messageBus.publish('phaseChanged', phase, data);
    }

    function getPhase() {
        return currentPhase;
    }

    function is(phase) {
        return currentPhase === phase;
    }

    return { goTo, getPhase, is };
})();
