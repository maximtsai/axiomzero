// tutorialManager.js - Handles early-game tutorial messages and guidance.

const tutorialManager = (() => {
    let tutorialText = null;

    function init() {
        messageBus.subscribe('phaseChanged', _onPhaseChanged);
    }

    function _onPhaseChanged(phase) {
        if (phase === GAME_CONSTANTS.PHASE_COMBAT) {
            _checkEarlyGameTutorial();
        } else {
            // waveManager handles cleanup of tutorialText if it was registered, 
            // but we can also null it here for local tracking.
            tutorialText = null;
        }
    }

    function _checkEarlyGameTutorial() {
        const upgrades = gameState.upgrades || {};
        const upgradeKeys = Object.keys(upgrades);

        // Condition: Player only has purchased 'AWAKEN' (level 1)
        const onlyAwaken = upgradeKeys.length === 1 && upgrades.awaken === 1;

        if (onlyAwaken) {
            PhaserScene.time.delayedCall(6000, () => {
                // Ensure we are still in combat phase and haven't bought anything else mid-iteration
                if (gameStateMachine.is(GAME_CONSTANTS.PHASE_COMBAT)) {
                    _showCombatTutorial();
                }
            });
        }
    }

    function _showCombatTutorial() {
        const msg = "COLLECT DATA \u25C8 TO EVOLVE";
        const x = GAME_CONSTANTS.halfWidth;
        const y = GAME_CONSTANTS.halfHeight - 300;

        // 1. Create temporary text to measure its final width
        const measureText = PhaserScene.add.text(0, 0, msg, {
            fontFamily: 'VCR',
            fontSize: '24px'
        }).setVisible(false);
        const finalWidth = measureText.width + 40; // Add padding
        const finalHeight = measureText.height + 15;
        measureText.destroy();

        // 2. Create the black background bar
        const bg = PhaserScene.add.image(x, y, 'white_pixel');
        bg.setTint(0x000000).setAlpha(0.4).setDepth(GAME_CONSTANTS.DEPTH_HUD - 1);
        bg.setDisplaySize(0, finalHeight);

        // Tween BG width
        PhaserScene.tweens.add({
            targets: bg,
            displayWidth: finalWidth,
            duration: 200,
            ease: 'Quad.easeOut'
        });

        // 3. Create the typewriter text
        tutorialText = PhaserScene.add.text(x, y, '', {
            fontFamily: 'VCR',
            fontSize: '24px',
            color: '#00f5ff',
            align: 'center'
        }).setOrigin(0.5, 0.5).setDepth(GAME_CONSTANTS.DEPTH_HUD).setAlpha(1);

        // Add a faint cyan glow
        tutorialText.setShadow(0, 0, '#00f5ff', 10, true, true);

        // Use local typewriter logic to play sound per character
        let charIdx = 0;
        PhaserScene.time.addEvent({
            delay: 40,
            repeat: msg.length - 1,
            callback: () => {
                charIdx++;
                tutorialText.setText(msg.substring(0, charIdx));
                if (typeof audio !== 'undefined') {
                    audio.play('digital_typewriter_short', 0.6);
                }
            }
        });

        // Register for cleanup on end iteration
        if (typeof waveManager !== 'undefined' && waveManager.registerCombatObject) {
            waveManager.registerCombatObject(tutorialText);
            waveManager.registerCombatObject(bg);
        }

        // Fade out after 6 seconds total (2s longer than previous 4s delay)
        PhaserScene.tweens.add({
            targets: [tutorialText, bg],
            alpha: 0,
            duration: 1000,
            delay: 6000,
            onComplete: () => {
                if (tutorialText && tutorialText.active) tutorialText.destroy();
                if (bg && bg.active) bg.destroy();
                tutorialText = null;
            }
        });
    }

    return { init };
})();
