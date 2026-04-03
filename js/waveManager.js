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
    let waveProgress = 0;    // 0→1 over WAVE_DURATION seconds during combat
    let waveActive = false;
    let frozen = false;
    let paused = false; // true during options menu
    let progressPaused = false; // true while a miniboss/boss is alive
    let currentWaveDuration = 45;
    let combatRegistry = [];    // Registry for ephemeral objects that must be cleared on end iteration

    function init() {
        messageBus.subscribe('phaseChanged', _onPhaseChanged);
        messageBus.subscribe('endIterationRequested', endIteration);
        messageBus.subscribe('freezeEnemies', () => { frozen = true; });
        messageBus.subscribe('unfreezeEnemies', () => { frozen = false; });
        messageBus.subscribe('minibossSpawned', () => { progressPaused = true; });
        messageBus.subscribe('minibossDefeated', () => { progressPaused = false; });
        messageBus.subscribe('bossDefeated', _onBossDefeated);
        messageBus.subscribe('gamePaused', () => { paused = true; });
        messageBus.subscribe('gameResumed', () => { paused = false; });
    }

    function _onPhaseChanged(phase) {
        if (phase === GAME_CONSTANTS.PHASE_COMBAT) {
            _startWave();
        } else {
            _stopWave();
        }
    }

    function _startWave() {
        debugLog('Wave started — wave', gameState.currentWave || 1);
        waveProgress = 0;
        waveActive = true;
        frozen = false;
        progressPaused = false;

        const currentLevel = gameState.currentLevel || 1;
        const levelBeaten = (gameState.levelsDefeated || 0) >= currentLevel;
        const minibossBeaten = (gameState.minibossLevelsDefeated || 0) >= currentLevel;

        if (levelBeaten) {
            // Endless farming mode — no progress bar, no boss
            currentWaveDuration = 999999;
            messageBus.publish('waveModeFarmingStarted');
        } else {
            currentWaveDuration = minibossBeaten ? 40 : GAME_CONSTANTS.WAVE_DURATION;
            messageBus.publish('waveModeNormalStarted');
        }

        // Reset tower and stats for this combat session
        tower.reset(true);
        statsTracker.reset();

        // Listen for tower death
        towerDiedSub = messageBus.subscribe('towerDied', _onTowerDied);

        // enemyManager picks up COMBAT_PHASE from phaseChanged and begins spawning
    }

    function _stopWave() {
        waveActive = false;
        waveProgress = 0;
        if (towerDiedSub) {
            towerDiedSub.unsubscribe();
            towerDiedSub = null;
        }
        // enemyManager handles its own cleanup on phaseChanged
        _clearCombatRegistry();
    }

    /** Register an object (with a .destroy() method) to be cleaned up when the wave ends. */
    function registerCombatObject(obj) {
        if (obj) combatRegistry.push(obj);
    }

    function _clearCombatRegistry() {
        combatRegistry.forEach(obj => {
            if (obj && obj.destroy) {
                try {
                    obj.destroy();
                } catch (e) {
                    console.warn('Failed to destroy combat registry object:', e);
                }
            }
        });
        combatRegistry = [];
    }

    function _onTowerDied() {
        debugLog('Tower died — playing death sequence');

        // Unsubscribe immediately to prevent re-entry
        if (towerDiedSub) { towerDiedSub.unsubscribe(); towerDiedSub = null; }

        // 1. Freeze all enemies — stop movement and spawning
        messageBus.publish('freezeEnemies');
        PhaserScene.time.timeScale = 1.0;

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
        deathOverlay.setScale(0, 0);
        deathOverlay.setAlpha(0);
        deathOverlay.setDepth(GAME_CONSTANTS.DEPTH_DEATH_OVERLAY);

        PhaserScene.tweens.add({
            targets: deathOverlay,
            scaleX: GAME_CONSTANTS.halfWidth,
            scaleY: GAME_CONSTANTS.halfHeight,
            alpha: 0.3,
            duration: 350,
            ease: 'Quad.easeOut',
        });

        customEmitters.towerDeath(GAME_CONSTANTS.halfWidth, GAME_CONSTANTS.halfHeight);
        PhaserScene.cameras.main.shake(500, 0.012);

        // 5.5 High-intensity failure visuals
        _triggerDeathGlitchBurst();


        // 6. Request tower shake — _onTowerShakeComplete fires when done
        messageBus.subscribeOnce('towerShakeComplete', _onTowerShakeComplete);
        messageBus.publish('towerShakeRequested', 500);
    }

    function _onTowerShakeComplete() {
        if (deathOverlay) { deathOverlay.destroy(); deathOverlay = null; }
        helper.hideGlobalClickBlocker();
        messageBus.publish('unfreezeEnemies');

        // Added 300ms of extra air-time for the glitch and "SIGNAL LOST" visual to breathe
        PhaserScene.time.delayedCall(300, () => {
            gameStateMachine.goTo(GAME_CONSTANTS.PHASE_WAVE_COMPLETE);
            debugLog('Death sequence complete — entering WAVE_COMPLETE');
        });
    }

    function _triggerDeathGlitchBurst() {
        // Create the "SIGNAL LOST" text
        const cx = GAME_CONSTANTS.halfWidth;
        const cy = GAME_CONSTANTS.halfHeight;
        const signalText = PhaserScene.add.text(cx, cy - 90, 'SIGNAL LOST', {
            fontFamily: 'MunroSmall',
            fontSize: '60px',
            color: '#ffffff',
            stroke: '#ff2d78',
            strokeThickness: 2,
        }).setOrigin(0.5).setDepth(GAME_CONSTANTS.DEPTH_POPUPS + 10).setAlpha(0);

        // Register for cleanup just in case
        registerCombatObject(signalText);

        // Entrance flicker
        PhaserScene.tweens.add({
            targets: signalText,
            alpha: 1,
            duration: 100,
            yoyo: true,
            repeat: 1,
            onComplete: () => {
                signalText.setAlpha(1);
                // Apply glitch effects to the text
                if (typeof glitchFX !== 'undefined') {
                    glitchFX.triggerChromaticAberration(signalText, 600, 1.5);
                    glitchFX.triggerFlicker([signalText], 600);
                }
            }
        });

        // Trigger multiple full-screen scanline tears
        if (typeof glitchFX !== 'undefined') {
            for (let i = 0; i < 12; i++) {
                PhaserScene.time.delayedCall(i * 40, () => {
                    glitchFX.triggerScanline(4, 65);
                });
            }
        }

        // White "flash" overlay for a split second
        const flash = PhaserScene.add.image(cx, cy, 'white_pixel');
        flash.setDisplaySize(GAME_CONSTANTS.WIDTH, GAME_CONSTANTS.HEIGHT);
        flash.setTint(0xffffff).setAlpha(0.6).setDepth(GAME_CONSTANTS.DEPTH_DEATH_OVERLAY + 5);

        PhaserScene.tweens.add({
            targets: flash,
            alpha: 0,
            duration: 250,
            onComplete: () => flash.destroy()
        });

        // Final exit fade
        PhaserScene.time.delayedCall(650, () => {
            PhaserScene.tweens.add({
                targets: signalText,
                alpha: 0,
                duration: 150,
                onComplete: () => signalText.destroy()
            });
        });
    }

    function _onBossDefeated(x, y) {
        // Update level defeat state
        const currentLevel = gameState.currentLevel || 1;
        if (currentLevel > (gameState.levelsDefeated || 0)) {
            gameState.levelsDefeated = currentLevel;
            debugLog('New boss record: level ' + currentLevel);
        }

        debugLog('Advanced to Tier ' + gameState.currentTier);

        const isBoss5 = currentLevel >= 5;

        // 1. Tower becomes invincible (no need to call, boss is dead and enemies are dying, plus transition handles this)
        // Also handled safely by the incoming phase change

        PhaserScene.time.delayedCall(750, () => {
            // 2. Play shockwave animation at boss location
            const shockwave = PhaserScene.add.image(x, y, 'enemies', 'explosion_flash.png');
            shockwave.setDepth(GAME_CONSTANTS.DEPTH_WAVE_COMPLETE);
            shockwave.setScale(0.1);
            shockwave.setAlpha(0.8);

            // Flash tint cyan to match player colors
            shockwave.setTintFill(GAME_CONSTANTS.COLOR_FRIENDLY);

            // Explode outward
            PhaserScene.tweens.add({
                targets: shockwave,
                scaleX: 12,
                scaleY: 12,
                duration: 500,
                ease: 'Cubic.easeIn',
            });

            PhaserScene.tweens.add({
                targets: shockwave,
                alpha: 0,
                duration: 500,
                ease: 'Quart.easeIn',
                onComplete: () => {
                    shockwave.destroy();
                }
            });
            PhaserScene.time.delayedCall(2300, () => {
                // 3. Inform enemyManager to instantly kill all non-boss enemies
                if (typeof enemyManager !== 'undefined') {
                    enemyManager.killAllNonBossEnemies();
                }

                // 4. Trigger resource vacuum (implemented in resourceManager)
                messageBus.publish('triggerResourceVacuum');
            });


            // 5. Delay then transition — extended for Boss5
            const transitionDelay = isBoss5 ? 6000 : 4400;
            PhaserScene.time.delayedCall(transitionDelay, () => {
                gameStateMachine.goTo(GAME_CONSTANTS.PHASE_WAVE_COMPLETE, { bossKill: true });
            });
        });
    }

    /** Called via 'endIterationRequested' — voluntarily end combat. */
    function endIteration() {
        if (!gameStateMachine.is(GAME_CONSTANTS.PHASE_COMBAT)) return;
        waveProgress = 0;
        debugLog('Player ended iteration manually');
        gameStateMachine.goTo(GAME_CONSTANTS.PHASE_WAVE_COMPLETE);
    }

    // ── per-frame update ────────────────────────────────────────────────────────

    function _update(delta) {
        if (!waveActive || frozen || paused) return;
        const dt = delta / 1000;

        if (!progressPaused) {
            waveProgress = Math.min(1, waveProgress + dt / currentWaveDuration);
            messageBus.publish('waveProgressChanged', waveProgress);
        }
    }

    function getProgress() { return waveProgress; }

    updateManager.addFunction(_update);

    return { init, endIteration, getProgress, registerCombatObject };
})();
