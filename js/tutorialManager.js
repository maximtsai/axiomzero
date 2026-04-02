// tutorialManager.js - Handles early-game tutorial messages and guidance.

const tutorialManager = (() => {
    let activePopups = [];

    function init() {
        messageBus.subscribe('phaseChanged', _onPhaseChanged);
        messageBus.subscribe('trigger_tutorial', (id) => {
            if (id === 'duo_swap') showDuoSwapTutorial();
        });
    }

    function _onPhaseChanged(phase) {
        _clearTutorial();

        if (phase === GAME_CONSTANTS.PHASE_COMBAT) {
            _checkEarlyGameTutorial();
            _checkCognitionTutorial();
        } else if (phase === GAME_CONSTANTS.PHASE_UPGRADE) {
            PhaserScene.time.delayedCall(GAME_CONSTANTS.TRANSITION_DURATION || 600, () => {
                if (gameStateMachine.is(GAME_CONSTANTS.PHASE_UPGRADE)) {
                    _checkControlsTutorial();
                    _checkUpgradeTutorial();
                    _checkDuoTutorial();
                }
            });
        }
    }

    function _checkControlsTutorial() {
        if (helper.isMobileDevice()) return;
        const upgrades = gameState.upgrades || {};
        const upgradeKeys = Object.keys(upgrades);

        // Condition: No nodes purchased at all
        const noUpgrades = upgradeKeys.length === 0;
        if (noUpgrades) {
            const msg = t('tutorial', 'controls_mouse');
            const x = 0;
            const y = 510;
            _createTutorialPopup(msg, x, y, true, '#ffffff', '#ffffff', null, '38px');
        }
    }

    function _checkEarlyGameTutorial() {
        const upgrades = gameState.upgrades || {};
        const upgradeKeys = Object.keys(upgrades);

        // Condition: Player only has purchased 'AWAKEN' (level 1)
        const onlyAwaken = upgradeKeys.length === 1 && upgrades.awaken === 1;

        if (onlyAwaken) {
            PhaserScene.time.delayedCall(8500, () => {
                // Ensure we are still in combat phase and haven't bought anything else mid-iteration
                if (gameStateMachine.is(GAME_CONSTANTS.PHASE_COMBAT)) {
                    _showCombatTutorial();
                }
            });
        }
    }

    function _checkCognitionTutorial() {
        if (gameState.tutorialsSeen['cognition_damage']) return;

        const upgrades = gameState.upgrades || {};
        // Condition: Has purchased basic_pulse (Cognition)
        if (upgrades.basic_pulse >= 1) {
            PhaserScene.time.delayedCall(5000, () => {
                if (gameStateMachine.is(GAME_CONSTANTS.PHASE_COMBAT) && !gameState.tutorialsSeen['cognition_damage']) {
                    const msg = t('tutorial', 'cognition_damage');
                    const x = GAME_CONSTANTS.halfWidth;
                    const y = GAME_CONSTANTS.halfHeight - 270;
                    _createTutorialPopup(msg, x, y, false, undefined, undefined, 'cognition_damage', '42px');
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
            _showUpgradeTutorial();
        }
    }

    function _checkDuoTutorial() {
        const shardCount = resourceManager.getShards();
        const duoPurchasedCount = Object.keys(gameState.duoBoxPurchased || {}).length;

        // Condition: Has a shard but no duo weapons purchased yet
        const condition = shardCount >= 1 && duoPurchasedCount === 0 && !gameState.tutorialsSeen['duo_shard'];

        if (condition) {
            const msg = t('tutorial', 'unlock_shards');
            const x = 0;
            const y = 600;
            _createTutorialPopup(msg, x, y, true, '#ffaaaa', '#ff0000', 'duo_shard', '38px');
        }
    }

    function _showCombatTutorial() {
        const msg = t('tutorial', 'combat_collect');
        const x = GAME_CONSTANTS.halfWidth;
        const y = GAME_CONSTANTS.halfHeight - 300;

        _createTutorialPopup(msg, x, y, false, undefined, undefined, null, '42px', 8500);

        PhaserScene.time.delayedCall(2500, () => {
            if (typeof messageBus !== 'undefined') {
                messageBus.publish('pulseData');
                PhaserScene.time.delayedCall(2200, () => {
                    messageBus.publish('pulseData');
                    PhaserScene.time.delayedCall(2200, () => {
                        messageBus.publish('pulseData');
                    });
                });
            }
        });
    }

    function _showUpgradeTutorial() {
        const msg = t('tutorial', 'upgrade_use');
        // 200px above Awaken node (treeX: 400, treeY: 750)
        const x = 0;
        const y = 550;

        _createTutorialPopup(msg, x, y, true, undefined, undefined, null, '38px');

        // Play glow on specific primary nodes
        const nodesToGlow = ['basic_pulse', 'integrity', 'intensity'];
        nodesToGlow.forEach(id => {
            if (typeof upgradeTree !== 'undefined') {
                const node = upgradeTree.getNode(id);
                if (node && typeof node._playRevealGlow === 'function') {
                    node._playRevealGlow();
                }
            }
        });
    }

    function _createTutorialPopup(msg, x, y, isUpgradeTree, color = '#00f5ff', shadowColor = '#00f5ff', tutorialId = null, fontSize = '48px', stayDuration = 6600) {
        if (tutorialId) {
            gameState.tutorialsSeen[tutorialId] = true;
            if (typeof saveGame === 'function') saveGame();
        }

        // 1. Create temporary text to measure its final width
        const measureText = PhaserScene.add.text(0, 0, msg, {
            fontFamily: 'MunroSmall',
            fontSize: fontSize
        }).setVisible(false);
        const textWidth = measureText.width;
        const finalWidth = textWidth + 40; // Add padding
        const finalHeight = measureText.height + 15;
        measureText.destroy();

        // 2. Create the black background bar
        const bg = PhaserScene.add.image(x, y, 'white_pixel');
        bg.setTint(0x000000).setAlpha(0.4).setDepth(isUpgradeTree ? GAME_CONSTANTS.DEPTH_UPGRADE_TREE + 10 : GAME_CONSTANTS.DEPTH_HUD - 1);
        bg.setDisplaySize(0, finalHeight);
        bg.targetAlpha = 0.4;

        // 3. Create the typewriter text - Positioned so (0, 0.5) origin results in centered text when full
        const txt = PhaserScene.add.text(x - textWidth / 2, y, '', {
            fontFamily: 'MunroSmall',
            fontSize: fontSize,
            color: color,
            align: 'left'
        }).setOrigin(0, 0.5).setDepth(isUpgradeTree ? GAME_CONSTANTS.DEPTH_UPGRADE_TREE + 11 : GAME_CONSTANTS.DEPTH_HUD);
        txt.setAlpha(1);
        if (!isUpgradeTree) {
            bg.setScrollFactor(0);
            txt.setScrollFactor(0);
        }

        const popupObj = { bg, txt };
        activePopups.push(popupObj);

        // Add a faint glow
        txt.setShadow(0, 0, shadowColor, 10, true, true);

        // Tracking for cropping
        txt.targetAlpha = 1;

        // Tween BG width
        PhaserScene.tweens.add({
            targets: bg,
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
                    if (!txt || !txt.active) return;
                    charIdx++;
                    txt.setText(msg.substring(0, charIdx));
                    if (typeof audio !== 'undefined') {
                        audio.play('digital_typewriter_short', 0.6);
                    }
                }
            });
        });

        // If in upgrade tree, add to the draggable group so it moves with the nodes
        if (isUpgradeTree && typeof upgradeTree !== 'undefined') {
            const group = upgradeTree.getDraggableGroup();
            if (group) {
                group.add(bg);
                group.add(txt);
            }
        }

        // Auto-fade tutorial after 6 seconds
        PhaserScene.tweens.add({
            targets: [txt, bg],
            alpha: 0,
            targetAlpha: 0,
            duration: 2000,
            delay: stayDuration,
            onComplete: () => {
                const idx = activePopups.indexOf(popupObj);
                if (idx !== -1) activePopups.splice(idx, 1);
                if (txt && txt.active) txt.destroy();
                if (bg && bg.active) bg.destroy();
            }
        });
    }


    function showDuoSwapTutorial() {
        if (!gameState.tutorialsSeen['duo_swap']) {
            _clearTutorial();
            const msg = t('tutorial', 'duo_swap_free');
            const x = 0;
            const y = 600;
            _createTutorialPopup(msg, x, y, true, '#ffaaaa', '#ff0000', 'duo_swap', '38px');
        }
    }

    function _clearTutorial() {
        activePopups.forEach(p => {
            if (p.txt && p.txt.active) p.txt.destroy();
            if (p.bg && p.bg.active) p.bg.destroy();
        });
        activePopups = [];
    }

    return { init, showDuoSwapTutorial };
})();
