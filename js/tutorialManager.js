// tutorialManager.js - Handles early-game tutorial messages and guidance.

const tutorialManager = (() => {
    let tutorialText = null;
    let tutorialBg = null;

    function init() {
        messageBus.subscribe('phaseChanged', _onPhaseChanged);
    }

    function _onPhaseChanged(phase) {
        if (phase === GAME_CONSTANTS.PHASE_COMBAT) {
            _checkEarlyGameTutorial();
        } else if (phase === GAME_CONSTANTS.PHASE_UPGRADE) {
            _checkUpgradeTutorial();
        } else {
            // waveManager handles cleanup of tutorialText if it was registered, 
            // but we can also null it here for local tracking.
            _clearTutorial();
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

    function _checkUpgradeTutorial() {
        const upgrades = gameState.upgrades || {};
        const upgradeKeys = Object.keys(upgrades);
        const data = resourceManager.getData();

        // Condition: Player has 1+ DATA and ONLY 'AWAKEN' (level 1) purchased
        const onlyAwaken = upgradeKeys.length === 1 && upgrades.awaken === 1;
        const condition = data >= 1 && onlyAwaken;

        if (condition) {
            if (!tutorialText) {
                _showUpgradeTutorial();
            }
        } else {
            _clearTutorial();
        }
    }

    function _showCombatTutorial() {
        const msg = "COLLECT DATA \u25C8 TO EVOLVE";
        const x = GAME_CONSTANTS.halfWidth;
        const y = GAME_CONSTANTS.halfHeight - 300;

        _createTutorialPopup(msg, x, y, false);
    }

    function _showUpgradeTutorial() {
        const msg = "USE DATA \u25C8 TO EVOLVE";
        // 200px above Awaken node (treeX: 400, treeY: 750)
        const x = 0;
        const y = 550;

        _createTutorialPopup(msg, x, y, true);
    }

    function _createTutorialPopup(msg, x, y, isUpgradeTree) {
        // 1. Create temporary text to measure its final width
        const measureText = PhaserScene.add.text(0, 0, msg, {
            fontFamily: 'VCR',
            fontSize: '24px'
        }).setVisible(false);
        const textWidth = measureText.width;
        const finalWidth = textWidth + 40; // Add padding
        const finalHeight = measureText.height + 15;
        measureText.destroy();

        // 2. Create the black background bar
        tutorialBg = PhaserScene.add.image(x, y, 'white_pixel');
        tutorialBg.setTint(0x000000).setAlpha(0.4).setDepth(isUpgradeTree ? GAME_CONSTANTS.DEPTH_NEURAL_TREE + 10 : GAME_CONSTANTS.DEPTH_HUD - 1);
        tutorialBg.setDisplaySize(0, finalHeight);

        if (!isUpgradeTree) {
            tutorialBg.setScrollFactor(0);
        }

        // Tween BG width
        PhaserScene.tweens.add({
            targets: tutorialBg,
            displayWidth: finalWidth,
            duration: 200,
            ease: 'Quad.easeOut'
        });

        // 3. Create the typewriter text - Positioned so (0, 0.5) origin results in centered text when full
        tutorialText = PhaserScene.add.text(x - textWidth / 2, y, '', {
            fontFamily: 'VCR',
            fontSize: '24px',
            color: '#00f5ff',
            align: 'left'
        }).setOrigin(0, 0.5).setDepth(isUpgradeTree ? GAME_CONSTANTS.DEPTH_NEURAL_TREE + 11 : GAME_CONSTANTS.DEPTH_HUD).setAlpha(1);

        if (!isUpgradeTree) {
            tutorialText.setScrollFactor(0);
        }

        // Add a faint cyan glow
        tutorialText.setShadow(0, 0, '#00f5ff', 10, true, true);

        // Use local typewriter logic to play sound per character
        let charIdx = 0;
        PhaserScene.time.addEvent({
            delay: 40,
            repeat: msg.length - 1,
            callback: () => {
                if (!tutorialText || !tutorialText.active) return;
                charIdx++;
                tutorialText.setText(msg.substring(0, charIdx));
                if (typeof audio !== 'undefined') {
                    audio.play('digital_typewriter_short', 0.6);
                }
            }
        });

        // If in upgrade tree, add to the draggable group so it moves with the nodes
        if (isUpgradeTree && typeof neuralTree !== 'undefined') {
            const group = neuralTree.getDraggableGroup();
            if (group) {
                group.add(tutorialBg);
                group.add(tutorialText);
            }
        }

        // Register for cleanup - Combat one might be cleaned by waveManager, 
        // but we also have our manual cleanup and timer.
        if (!isUpgradeTree && typeof waveManager !== 'undefined' && waveManager.registerCombatObject) {
            waveManager.registerCombatObject(tutorialText);
            waveManager.registerCombatObject(tutorialBg);
        }

        // Auto-fade tutorial after 5 seconds
        PhaserScene.tweens.add({
            targets: [tutorialText, tutorialBg],
            alpha: 0,
            duration: 1000,
            delay: 5000,
            onComplete: () => {
                _clearTutorial();
            }
        });
    }

    function _clearTutorial() {
        if (tutorialText) {
            if (tutorialText.active) tutorialText.destroy();
            tutorialText = null;
        }
        if (tutorialBg) {
            if (tutorialBg.active) tutorialBg.destroy();
            tutorialBg = null;
        }
    }

    return { init };
})();
