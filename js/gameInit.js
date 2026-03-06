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

    // ── Restore or initialise game state ────────────────────────────────
    initGameState();

    audio.init(PhaserScene);

    // Browser autoplay policy: play music on the first interaction
    messageBus.subscribeOnce('pointerDown', () => {
        debugLog('First interaction detected, starting music...');
        // Only start if not muted in settings
        if (!gameState.settings.musicMuted && !audio.getMusicName()) {
            audio.playMusic('bg_music1');
        }
    });

    // ── Init all Phase 1 systems (order matters for dependencies) ───────

    // Global Animations
    createAnimations(PhaserScene);

    // Floating text pool — requires PhaserScene, no other deps
    floatingText.init(PhaserScene);

    // Core entities — no cross-deps at init time
    tower.init();
    enemyManager.init();
    projectileManager.init();
    enemyBulletManager.init();
    resourceManager.init();

    // Wave lifecycle — depends on tower, enemyManager
    waveManager.init();

    // Upgrade manager stub (kept for forward compatibility)
    upgradeManager.init();

    // UI systems — depend on resource / tower for data display
    neuralTree.init();
    gameHUD.init();
    iterationOverScreen.init();

    // Camera & transition — cameraManager before transitionManager
    cameraManager.init();
    transitionManager.init();

    // Tooltip, milestone tracking, and glitch effects
    tooltipManager.init();
    milestoneTracker.init();
    glitchFX.init();
    glitchFX.setColors(GAME_CONSTANTS.COLOR_HOSTILE, GAME_CONSTANTS.COLOR_FRIENDLY);

    // Pulse attack — cursor AOE (unlocked by default)
    pulseAttack.init();
    pulseAttack.unlock();

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
    // Start camera in upgrade view position (no animation on initial load)
    PhaserScene.cameras.main.scrollX = -GAME_CONSTANTS.halfWidth / 2;
    gameStateMachine.goTo(GAME_CONSTANTS.PHASE_UPGRADE);
    debugLog('Game initialised — entering UPGRADE_PHASE');

});
