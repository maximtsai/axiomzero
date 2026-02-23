// gameInit.js
// Game bootstrapper — subscribes to 'assetsLoaded' and initialises all systems.
// This file is loaded last among game scripts (see index.html load order).
//
// Startup sequence:
//   1. 'assetsLoaded' fires from loadingScreen._onComplete()
//   2. Audio mute state is restored from localStorage
//   3. All game systems are initialised
//   4. Mute/SFX toggle buttons are created
//   5. Game enters UPGRADE_PHASE to begin

messageBus.subscribeOnce('assetsLoaded', () => {

    audio.recheckMuteState();

    // TODO: loadGame() — restore save data when a save system is added

    waveManager.init();
    upgradeManager.init();
    gameHUD.init();

    createMuteSFXButton(27, 27);
    createMuteMusicButton(54, 27);

    gameStateMachine.goTo('UPGRADE_PHASE');

});
