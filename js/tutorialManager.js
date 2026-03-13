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
            PhaserScene.time.delayedCall(6000, () => {
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
                const y = 550;
                _createTutorialPopup(msg, x, y, true, '#ffaaaa', '#ff0000', 'duo_shard');
            }
        }
    }

    function _showCombatTutorial() {
        const msg = "COLLECT DATA \u25C8 TO EVOLVE";
        const x = GAME_CONSTANTS.halfWidth;
        const y = GAME_CONSTANTS.halfHeight - 300;

        _createTutorialPopup(msg, x, y, false, undefined, undefined, 'combat_data');
    }

    function _showUpgradeTutorial() {
        const msg = "USE DATA \u25C8 TO EVOLVE";
        // 200px above Awaken node (treeX: 400, treeY: 750)
        const x = 0;
        const y = 550;

        _createTutorialPopup(msg, x, y, true, undefined, undefined, 'upgrade_data');
    }

    function _createTutorialPopup(msg, x, y, isUpgradeTree, color = '#00f5ff', shadowColor = '#00f5ff', tutorialId = null) {
        if (tutorialId) {
            gameState.tutorialsSeen[tutorialId] = true;
            if (typeof saveGame === 'function') saveGame();
        }
        // 1. Create temporary text to measure its final width
        const measureText = PhaserScene.add.text(0, 0, msg, {
            fontFamily: 'VCR',
            fontSize: '24px'
        }).setVisible(false);
        const textWidth = measureText.width;
        const finalWidth = textWidth + 40; // Add padding
        const finalHeight = measureText.height + 15;
        measureText.destroy();

        // 2. Manage the background and text objects (reuse or create)
        if (!tutorialBg || !tutorialBg.active) {
            tutorialBg = PhaserScene.add.image(x, y, 'white_pixel');
        } else {
            PhaserScene.tweens.killTweensOf(tutorialBg);
            tutorialBg.setPosition(x, y);
        }
        
        tutorialBg.setTint(0x000000).setAlpha(0.4).setVisible(true);
        tutorialBg.setDepth(isUpgradeTree ? GAME_CONSTANTS.DEPTH_NEURAL_TREE + 10 : GAME_CONSTANTS.DEPTH_HUD - 1);
        tutorialBg.setDisplaySize(0, finalHeight);
        tutorialBg.targetAlpha = 0.4;

        if (!tutorialText || !tutorialText.active) {
            tutorialText = PhaserScene.add.text(x - textWidth / 2, y, '', {
                fontFamily: 'VCR',
                fontSize: '24px'
            }).setOrigin(0, 0.5);
        } else {
            PhaserScene.tweens.killTweensOf(tutorialText);
            tutorialText.setPosition(x - textWidth / 2, y);
            tutorialText.setText('');
        }

        tutorialText.setStyle({ color: color });
        tutorialText.setDepth(isUpgradeTree ? GAME_CONSTANTS.DEPTH_NEURAL_TREE + 11 : GAME_CONSTANTS.DEPTH_HUD);
        tutorialText.setAlpha(1);
        tutorialText.setVisible(true);
        tutorialText.setShadow(0, 0, shadowColor, 10, true, true);
        tutorialText.targetAlpha = 1;

        if (!isUpgradeTree) {
            tutorialBg.setScrollFactor(0);
            tutorialText.setScrollFactor(0);
        } else {
            tutorialBg.setScrollFactor(1);
            tutorialText.setScrollFactor(1);
        }

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
                if (!group.contains(tutorialBg)) group.add(tutorialBg);
                if (!group.contains(tutorialText)) group.add(tutorialText);
            }
        }

        // Auto-fade tutorial after 6 seconds
        PhaserScene.tweens.add({
            targets: [tutorialText, tutorialBg],
            targetAlpha: 0,
            duration: 2000,
            delay: 6600,
            onComplete: () => {
                _clearTutorial();
            }
        });
    }

    function updateCropping(minVisX, maxVisX, minVisY, maxVisY) {
        if (!tutorialText || !tutorialText.active) return;

        const objects = [tutorialText, tutorialBg];
        objects.forEach(obj => {
            if (!obj) return;
            const ox = obj.x;
            const oy = obj.y;
            const ow = obj.width || obj.displayWidth;
            const oh = obj.height || obj.displayHeight;

            // For text with origin 0, width is to the right. 
            // For BG image with origin 0.5 (default), width is around it? 
            // Wait, tutorialBg is origin 0.5, 0.5 usually for images?
            // Actually tutorialBg is at (x, y) with displaySize. Origin is (0.5, 0.5) by default.

            let isOut = false;
            if (obj === tutorialText) {
                // Origin 0, 0.5
                isOut = (ox + ow < minVisX || ox > maxVisX || oy + oh / 2 < minVisY || oy - oh / 2 > maxVisY);
            } else {
                // Origin 0.5, 0.5
                isOut = (ox + ow / 2 < minVisX || ox - ow / 2 > maxVisX || oy + oh / 2 < minVisY || oy - oh / 2 > maxVisY);
            }

            obj.setAlpha(isOut ? 0 : (obj.targetAlpha !== undefined ? obj.targetAlpha : obj.alpha));
        });
    }

    function showDuoSwapTutorial() {
        if (!gameState.tutorialsSeen['duo_swap']) {
            _clearTutorial();
            const msg = "SWAP ABILITIES FOR FREE";
            const x = 370; // Above left duo node
            const y = 450;
            _createTutorialPopup(msg, x, y, true, '#ffaaaa', '#ff0000', 'duo_swap');
        }
    }

    function _clearTutorial() {
        if (tutorialText && tutorialText.active) {
            tutorialText.setVisible(false);
            tutorialText.setText('');
            tutorialText.alpha = 0;
            tutorialText.targetAlpha = 0;
            PhaserScene.tweens.killTweensOf(tutorialText);
        }
        if (tutorialBg && tutorialBg.active) {
            tutorialBg.setVisible(false);
            tutorialBg.alpha = 0;
            tutorialBg.targetAlpha = 0;
            PhaserScene.tweens.killTweensOf(tutorialBg);
        }
    }

    return { init, updateCropping, showDuoSwapTutorial };
})();
