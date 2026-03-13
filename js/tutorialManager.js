// tutorialManager.js - Handles early-game tutorial messages and guidance.

const tutorialManager = (() => {
    let tutorialText = null;
    let tutorialBg = null;

    function init() {
        messageBus.subscribe('phaseChanged', _onPhaseChanged);
    }

    function _onPhaseChanged(phase) {
        _clearTutorial();

        if (phase === GAME_CONSTANTS.PHASE_COMBAT) {
            _checkEarlyGameTutorial();
        } else if (phase === GAME_CONSTANTS.PHASE_UPGRADE) {
            PhaserScene.time.delayedCall(GAME_CONSTANTS.TRANSITION_DURATION || 600, () => {
                if (gameStateMachine.is(GAME_CONSTANTS.PHASE_UPGRADE)) {
                    _checkUpgradeTutorial();
                    _checkDuoTutorial();
                }
            });
        }
    }

    function _checkEarlyGameTutorial() {
        const upgrades = gameState.upgrades || {};
        const upgradeKeys = Object.keys(upgrades);

        // Condition: Player only has purchased 'AWAKEN' (level 1)
        const onlyAwaken = upgradeKeys.length === 1 && upgrades.awaken === 1;

        if (onlyAwaken && !gameState.tutorialsSeen['combat_data']) {
            PhaserScene.time.delayedCall(8500, () => {
                // Ensure we are still in combat phase and haven't bought anything else mid-iteration
                if (gameStateMachine.is(GAME_CONSTANTS.PHASE_COMBAT) && !gameState.tutorialsSeen['combat_data']) {
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
        const condition = data >= 1 && onlyAwaken && !gameState.tutorialsSeen['upgrade_data'];

        if (condition) {
            if (!tutorialText) {
                _showUpgradeTutorial();
            }
        } else {
            _clearTutorial();
        }
    }

    function _checkDuoTutorial() {
        const shardCount = resourceManager.getShards();
        const duoPurchasedCount = Object.keys(gameState.duoBoxPurchased || {}).length;

        // Condition: Has a shard but no duo weapons purchased yet
        const condition = shardCount >= 1 && duoPurchasedCount === 0 && !gameState.tutorialsSeen['duo_shard'];

        if (condition) {
            if (!tutorialText) {
                const msg = "Unlock new abilities with \u25C6";
                const x = 0;
                const y = 440;
                _createTutorialPopup(msg, x, y, true, '#ffaaaa', '#ff0000', 'duo_shard', '30px');
            }
        }
    }

    function _showCombatTutorial() {
        const msg = "COLLECT DATA \u25C8 TO EVOLVE";
        const x = GAME_CONSTANTS.halfWidth;
        const y = GAME_CONSTANTS.halfHeight - 300;

        _createTutorialPopup(msg, x, y, false, undefined, undefined, 'combat_data', '30px');

        PhaserScene.time.delayedCall(2500, () => {
            if (typeof messageBus !== 'undefined') {
                messageBus.publish('pulseData');
                PhaserScene.time.delayedCall(2000, () => {
                    messageBus.publish('pulseData');
                });
            }
        });
    }

    function _showUpgradeTutorial() {
        const msg = "USE DATA \u25C8 TO EVOLVE";
        // 200px above Awaken node (treeX: 400, treeY: 750)
        const x = 0;
        const y = 550;

        _createTutorialPopup(msg, x, y, true, undefined, undefined, 'upgrade_data', '30px');
    }

    function _createTutorialPopup(msg, x, y, isUpgradeTree, color = '#00f5ff', shadowColor = '#00f5ff', tutorialId = null, fontSize = '30px') {
        if (tutorialId) {
            gameState.tutorialsSeen[tutorialId] = true;
            if (typeof saveGame === 'function') saveGame();
        }
        _clearTutorial();

        // 1. Create temporary text to measure its final width
        const measureText = PhaserScene.add.text(0, 0, msg, {
            fontFamily: 'VCR',
            fontSize: fontSize
        }).setVisible(false);
        const textWidth = measureText.width;
        const finalWidth = textWidth + 40; // Add padding
        const finalHeight = measureText.height + 15;
        measureText.destroy();

        // 2. Create the black background bar
        tutorialBg = PhaserScene.add.image(x, y, 'white_pixel');
        tutorialBg.setTint(0x000000).setAlpha(0.4).setDepth(isUpgradeTree ? GAME_CONSTANTS.DEPTH_NEURAL_TREE + 10 : GAME_CONSTANTS.DEPTH_HUD - 1);
        tutorialBg.setDisplaySize(0, finalHeight);
        tutorialBg.targetAlpha = 0.4;

        // 3. Create the typewriter text - Positioned so (0, 0.5) origin results in centered text when full
        tutorialText = PhaserScene.add.text(x - textWidth / 2, y, '', {
            fontFamily: 'VCR',
            fontSize: fontSize,
            color: color,
            align: 'left'
        }).setOrigin(0, 0.5).setDepth(isUpgradeTree ? GAME_CONSTANTS.DEPTH_NEURAL_TREE + 11 : GAME_CONSTANTS.DEPTH_HUD);

        tutorialText.setAlpha(1);
        if (!isUpgradeTree) {
            tutorialBg.setScrollFactor(0);
            tutorialText.setScrollFactor(0);
        }

        // Add a faint glow
        tutorialText.setShadow(0, 0, shadowColor, 10, true, true);

        // Tracking for cropping
        tutorialText.targetAlpha = 1;

        // Tween BG width
        PhaserScene.tweens.add({
            targets: tutorialBg,
            displayWidth: finalWidth,
            duration: 200,
            ease: 'Quad.easeOut'
        });

        // Use local typewriter logic to play sound per character
        let charIdx = 0;
        PhaserScene.time.delayedCall(600, () => {
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
        });

        // If in upgrade tree, add to the draggable group so it moves with the nodes
        if (isUpgradeTree && typeof neuralTree !== 'undefined') {
            const group = neuralTree.getDraggableGroup();
            if (group) {
                group.add(tutorialBg);
                group.add(tutorialText);
            }
        }

        // Auto-fade tutorial after 6 seconds
        PhaserScene.tweens.add({
            targets: [tutorialText, tutorialBg],
            alpha: 0,
            targetAlpha: 0,
            duration: 2000,
            delay: 6600,
            onComplete: () => {
                _clearTutorial();
            }
        });
    }


    function showDuoSwapTutorial() {
        if (!gameState.tutorialsSeen['duo_swap']) {
            _clearTutorial();
            const msg = "SWAPPING ABILITIES IS FREE";
            const x = 0;
            const y = 440;
            _createTutorialPopup(msg, x, y, true, '#ffaaaa', '#ff0000', 'duo_swap', '30px');
        }
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

    return { init, showDuoSwapTutorial };
})();
