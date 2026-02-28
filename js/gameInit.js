// gameInit.js
// Game bootstrapper — subscribes to 'assetsLoaded' and initialises all systems.
// This file is loaded last among game scripts (see index.html load order).
//
// Startup sequence:
//   1. 'assetsLoaded' fires from loadingScreen._onComplete()
//   2. Audio mute state is restored from localStorage
//   3. All game systems are initialised in dependency order
//   4. Game state defaults are applied (or loaded from save)
//   5. Mute/SFX toggle buttons are created
//   6. Game enters UPGRADE_PHASE to begin

messageBus.subscribeOnce('assetsLoaded', () => {

    audio.recheckMuteState();

    // ── Restore or initialise game state ────────────────────────────────
    if (hasSave()) {
        loadGame();
        debugLog('Save restored');
    } else {
        // Apply defaults for a fresh game
        Object.assign(gameState, JSON.parse(JSON.stringify(GAME_STATE_DEFAULTS)));
        debugLog('Fresh game state initialised');
    }

    // ── Init all Phase 1 systems (order matters for dependencies) ───────

    // Floating text pool — requires PhaserScene, no other deps
    floatingText.init(PhaserScene);

    // Core entities — no cross-deps at init time
    tower.init();
    enemyManager.init();
    projectileManager.init();
    resourceManager.init();

    // Wave lifecycle — depends on tower, enemyManager
    waveManager.init();

    // Upgrade manager stub (kept for forward compatibility)
    upgradeManager.init();

    // UI systems — depend on resource / tower for data display
    gameHUD.init();
    neuralTree.init();
    iterationOverScreen.init();
    transitionManager.init();

    // Options button (top-right corner, always visible)
    let optionsBtnOffset = helper.testMobile() ? 3 : 0;
    createOptionsButton(GAME_CONSTANTS.WIDTH - 35 + optionsBtnOffset, 35 + optionsBtnOffset);

    // ── Set background color ────────────────────────────────────────────
    PhaserScene.cameras.main.setBackgroundColor(GAME_CONSTANTS.COLOR_BG);

    // ── Spawn tower sparkle — always visible before first AWAKEN click ──
    tower.spawn();
    // For returning players who already purchased AWAKEN, skip sparkle animation
    if ((gameState.upgrades && gameState.upgrades.awaken) >= 1) {
        tower.awaken();
    }

    // ── Enter the game ──────────────────────────────────────────────────
    gameStateMachine.goTo('UPGRADE_PHASE');
    debugLog('Game initialised — entering UPGRADE_PHASE');

});
