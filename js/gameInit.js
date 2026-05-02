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

messageBus.subscribeOnce('assetsLoaded', async () => {

    // ── Restore or initialise game state ────────────────────────────────
    if (typeof FLAGS !== 'undefined' && FLAGS.USING_CRAZYGAMES_SDK && typeof sdk !== 'undefined') {
        try {
            const cloudSave = await sdk.getItem(SAVE_KEY);
            if (cloudSave) {
                let finalSave = cloudSave;
                
                if (typeof cloudSave === 'string') {
                    const trimmed = cloudSave.trim();
                    if (trimmed && trimmed[0] !== '{') {
                        try {
                            const decompressed = LZString.decompressFromEncodedURIComponent(trimmed);
                            if (decompressed) {
                                finalSave = decompressed;
                            }
                        } catch (decompError) {
                            console.error('Failed to decompress cloud save:', decompError);
                        }
                    }
                } else if (typeof cloudSave === 'object' && cloudSave !== null) {
                    // SDK returned parsed object directly
                    finalSave = JSON.stringify(cloudSave);
                }
                
                localStorage.setItem(SAVE_KEY, finalSave);
                debugLog('Cloud save fetched, unpacked, and injected into localStorage.');
            }
        } catch (e) {
            console.error('Failed to pre-fetch cloud save:', e);
        }

        try {
            const cloudOptions = await sdk.getItem(OPTIONS_KEY);
            if (cloudOptions && typeof gameOptions !== 'undefined') {
                let finalOptions = cloudOptions;
                let parsedOptions = null;

                if (typeof cloudOptions === 'string') {
                    try {
                        parsedOptions = JSON.parse(cloudOptions);
                    } catch (parseError) {
                        console.error('Failed to parse cloud options string:', parseError);
                    }
                } else if (typeof cloudOptions === 'object' && cloudOptions !== null) {
                    parsedOptions = cloudOptions;
                    finalOptions = JSON.stringify(cloudOptions);
                }

                if (parsedOptions) {
                    localStorage.setItem(OPTIONS_KEY, finalOptions);
                    Object.assign(gameOptions, parsedOptions);
                    debugLog('Cloud options fetched and updated.');
                }
            }
        } catch (e) {
            console.error('Failed to pre-fetch cloud options:', e);
        }
    }

    initGameState();
    if (typeof restoreDynamicNodes === 'function') {
        restoreDynamicNodes();
    }

    if (typeof FLAGS !== 'undefined' && FLAGS.DEBUG) {
        console.group('%c [DEBUG] Purchased Upgrades ', 'background: #222; color: #00f5ff; font-weight: bold;');
        const upgrades = gameState.upgrades || {};
        if (Object.keys(upgrades).length === 0) {
            console.log('No upgrades purchased.');
        } else {
            for (const id in upgrades) {
                console.log(`- ${id}: Lv. ${upgrades[id]}`);
            }
        }
        console.groupEnd();
    }

    audio.init(PhaserScene);

    // Browser autoplay policy: play music on the first interaction
    messageBus.subscribeOnce('pointerDown', () => {
        debugLog('First interaction detected, starting music...');
        // Only start if not muted in settings
        if (!gameState.settings.musicMuted && !audio.getMusicName()) {
            audio.playMusic('bg_music1');
        }
    });

    // Helper for Recovery Protocol passive
    function _applyThreatAdaptation(yOffset) {
        if (gameState.upgrades && gameState.upgrades.threat_response >= 1) {
            const currentHP = tower.getHealth();
            const targetHP = tower.getMaxHealth() * 0.5;

            if (currentHP < targetHP) {
                const healAmount = targetHP - currentHP;
                tower.heal(healAmount);
            }
        }
    }

    // Start boss music when boss spawns
    messageBus.subscribe('bossSpawned', () => {
        debugLog('Playing boss music...');
        audio.playComplexTransition(GAME_CONSTANTS.AUDIO_TRANSITIONS.BOSS);
        _applyThreatAdaptation(80);
    });

    messageBus.subscribe('minibossSpawned', () => {
        _applyThreatAdaptation(60);
    });

    // Track active gameplay state for CrazyGames analytics
    messageBus.subscribe(GAME_CONSTANTS.EVENTS.PHASE_CHANGED, (phase) => {
        if (typeof sdk !== 'undefined') {
            if (phase === GAME_CONSTANTS.PHASE_COMBAT) {
                sdk.gameplayStart();
            } else if (phase === GAME_CONSTANTS.PHASE_UPGRADE || phase === GAME_CONSTANTS.PHASE_GAME_OVER) {
                sdk.gameplayStop();
            }
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
    customEmitters.init();
    projectileManager.init();
    enemyBulletManager.init();
    resourceManager.init();
    hijackManager.init();

    // Wave lifecycle — depends on tower, enemyManager
    waveManager.init();

    // Upgrade manager stub (kept for forward compatibility)
    upgradeManager.init();

    // UI systems — depend on resource / tower for data display
    upgradeTree.init();
    announcementManager.init();
    gameHUD.init();
    iterationOverScreen.init();
    coinMine.init();
    tutorialManager.init();

    // Camera & transition — cameraManager before transitionManager
    cameraManager.init();
    transitionManager.init();

    // Tooltip, milestone tracking, and glitch effects
    tooltipManager.init();
    scoreManager.init();
    milestoneTracker.init();
    achievementManager.init();
    glitchFX.init();
    glitchFX.setColors(GAME_CONSTANTS.COLOR_HOSTILE, GAME_CONSTANTS.COLOR_FRIENDLY);
    dustParticles.init();
    dustParticles.start(PhaserScene);

    // cursor AOE (must be unlocked via Upgrade Tree)
    pulseAttack.init();
    if ((gameState.upgrades && gameState.upgrades.awaken) >= 1) {
        pulseAttack.unlock();
    }

    // Duo-box weapons (must be unlocked via Upgrade Tree shard purchase)
    lightningAttack.init();
    shockwaveAttack.init();
    laserAttack.init();
    artilleryAttack.init();
    scytheAttack.init();
    swordAttack.init();
    combatShield.init();
    if (gameState.upgrades && gameState.upgrades.combat_shield) {
        combatShield.unlock();
    }
    // Restore weapon state from save
    if (gameState.duoBoxPurchased && gameState.duoBoxPurchased[1]) {
        const activeShard = gameState.activeShards && gameState.activeShards[1];
        if (activeShard === 'lightning_weapon') {
            lightningAttack.unlock();
        } else if (activeShard === 'shockwave_weapon') {
            shockwaveAttack.unlock();
        }
    }
    if (gameState.duoBoxPurchased && gameState.duoBoxPurchased[3]) {
        const activeShard = gameState.activeShards && gameState.activeShards[3];
        if (activeShard === 'artillery') {
            artilleryAttack.unlock();
        } else if (activeShard === 'laser') {
            laserAttack.unlock();
        }
    }
    if (gameState.duoBoxPurchased && gameState.duoBoxPurchased[4]) {
        const activeShard = gameState.activeShards && gameState.activeShards[4];
        if (activeShard === 'scythe') {
            scytheAttack.unlock();
        } else if (activeShard === 'sword') {
            if (typeof swordAttack !== 'undefined') swordAttack.unlock();
        }
    }

    // Initialize all upgrade effects
    if (typeof upgradeDispatcher !== 'undefined') {
        upgradeDispatcher.recalcEverything();
    }

    // Options button (top-right corner, always visible)
    let optionsBtnOffset = helper.isMobileDevice() ? 3 : 0;
    createOptionsButton(GAME_CONSTANTS.WIDTH - 43 + optionsBtnOffset, 42 + optionsBtnOffset);

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
    resourceManager.recalcPickupRadius();
    PhaserScene.cameras.main.scrollX = -GAME_CONSTANTS.halfWidth / 2;
    gameStateMachine.goTo(GAME_CONSTANTS.PHASE_UPGRADE);
    debugLog('Game initialised — entering UPGRADE_PHASE');

});
