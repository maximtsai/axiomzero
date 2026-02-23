// gameStateMachine.js
// Owns the current game phase and broadcasts transitions via messageBus.
//
// Phases:
//   'UPGRADE_PHASE' — between waves; player spends currency and prepares
//   'WAVE_ACTIVE'   — wave is running; enemies are alive
//   'WAVE_COMPLETE' — wave just ended; brief pause before returning to upgrades
//   'GAME_OVER'     — player failed the wave
//
// Usage:
//   gameStateMachine.goTo('WAVE_ACTIVE');
//   gameStateMachine.getPhase();          // → 'WAVE_ACTIVE'
//   messageBus.subscribe('phaseChanged', (phase) => { ... });

const gameStateMachine = (() => {
    let currentPhase = null;

    function goTo(phase) {
        if (currentPhase === phase) return;
        debugLog(`Phase: ${currentPhase} → ${phase}`);
        currentPhase = phase;
        messageBus.publish('phaseChanged', phase);
    }

    function getPhase() {
        return currentPhase;
    }

    function is(phase) {
        return currentPhase === phase;
    }

    return { goTo, getPhase, is };
})();
