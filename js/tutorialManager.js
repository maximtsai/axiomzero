// tutorialManager.js - Handles early-game tutorial messages and guidance.

const tutorialManager = (() => {
    let activePopups = [];
    let _activeDelayedCalls = [];
    let _bombTutorialActiveThisPhase = false;

    function init() {
        messageBus.subscribe('phaseChanged', _onPhaseChanged);
        messageBus.subscribe('trigger_tutorial', (id) => {
            if (id === 'duo_swap') showDuoSwapTutorial();
        });
        messageBus.subscribe('bombUsesChanged', (data) => {
            if (data.max === 1 && !gameState.tutorialsSeen.bomb) {
                _checkBombTutorial();
            }
        });
        messageBus.subscribe('cursorBombFired', () => {
            gameState.tutorialsSeen.bomb = true;
        });
    }

    function _onPhaseChanged(phase) {
        _clearTutorial();
        _cancelActiveDelayedCalls();
        _bombTutorialActiveThisPhase = false;

        if (phase === GAME_CONSTANTS.PHASE_COMBAT) {
            _checkEarlyGameTutorial();
            _checkCognitionTutorial();
        } else if (phase === GAME_CONSTANTS.PHASE_UPGRADE) {
            PhaserScene.time.delayedCall(GAME_CONSTANTS.TRANSITION_DURATION || 600, () => {
                if (gameStateMachine.is(GAME_CONSTANTS.PHASE_UPGRADE)) {
                    _checkControlsTutorial();
                    _checkUpgradeTutorial();
                    _checkDuoTutorial();
                    _checkBombTutorial();
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
            const x = 400;
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
            const DelayAmt = 1750;
            // 1. Pause spawner 4 seconds before tutorial starts
            const dcDelay = PhaserScene.time.delayedCall(DelayAmt, () => {
                if (gameStateMachine.is(GAME_CONSTANTS.PHASE_COMBAT)) {
                    messageBus.publish('addEnemySpawnDelay', 6000);
                }
            });
            _activeDelayedCalls.push(dcDelay);

            // 2. Show tutorial text
            const dc = PhaserScene.time.delayedCall(DelayAmt + 14750, () => {
                // Ensure we are still in combat phase and haven't bought anything else mid-iteration
                if (gameStateMachine.is(GAME_CONSTANTS.PHASE_COMBAT)) {
                    _showCombatTutorial();
                }
            });
            _activeDelayedCalls.push(dc);
        }
    }

    function _checkCognitionTutorial() {
        const upgrades = gameState.upgrades || {};
        const upgradeKeys = Object.keys(upgrades);

        // Condition: Player only has purchased 'AWAKEN' (level 1)
        const onlyAwaken = upgradeKeys.length === 1 && upgrades.awaken === 1;

        if (onlyAwaken) {
            const dc = PhaserScene.time.delayedCall(4500, () => {
                if (gameStateMachine.is(GAME_CONSTANTS.PHASE_COMBAT)) {
                    // Check again inside delayed call to be safe
                    const currentUpgrades = Object.keys(gameState.upgrades || {});
                    if (currentUpgrades.length === 1 && gameState.upgrades.awaken === 1) {
                        const msg = t('tutorial', 'cognition_damage');
                        const x = GAME_CONSTANTS.halfWidth;
                        const y = GAME_CONSTANTS.halfHeight - 220;
                        _createTutorialPopup(msg, x, y, false, undefined, undefined, null, '42px');
                    }
                }
            });
            _activeDelayedCalls.push(dc);
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
            const x = 400;
            const y = 625;
            _createTutorialPopup(msg, x, y, true, '#ffaaaa', '#ff0000', 'duo_shard', '38px', 7000);
        }
    }

    function _checkBombTutorial() {
        if (gameState.tutorialsSeen.bomb || _bombTutorialActiveThisPhase) return;
        if (gameStateMachine.getPhase() !== GAME_CONSTANTS.PHASE_UPGRADE) return;

        const pulseModel = pulseAttack.getModel();
        if (pulseModel.maxBombUses >= 1) {
            _bombTutorialActiveThisPhase = true;
            const isMobile = helper.isMobileDevice();
            const msgKey = isMobile ? 'bomb_tutorial_mobile' : 'bomb_tutorial';
            const msg = t('tutorial', msgKey);

            const x = GAME_CONSTANTS.WIDTH * 0.75;
            const y = (GAME_CONSTANTS.HEIGHT * 0.82);

            // Pass null as tutorialId so it doesn't auto-flag as seen. It flags on cursorBombFired.
            _createTutorialPopup(msg, x, y, false, '#ffffff', '#ffffff', null, '38px', 10000);
            messageBus.publish('bombShowHint', true);
        }
    }

    function _showCombatTutorial() {
        const msg = t('tutorial', 'combat_collect');
        const x = GAME_CONSTANTS.halfWidth;
        const y = GAME_CONSTANTS.halfHeight - 280;

        _createTutorialPopup(msg, x, y, false, undefined, undefined, null, '42px', 8500);

        // Measure text width to find edges for spawning data bits
        const measure = PhaserScene.add.text(0, 0, msg, { fontFamily: 'MunroSmall', fontSize: '42px' }).setVisible(false);
        const hw = measure.width / 2;
        measure.destroy();

        // Burst 8 bits of data from the text after 1.5 seconds
        const burstDC = PhaserScene.time.delayedCall(1500, () => {
            if (!gameStateMachine.is(GAME_CONSTANTS.PHASE_COMBAT)) return;

            const burstSettings = [
                { x: x - hw, y: y, dist: 80, ang: -2.4 }, // Left Up
                { x: x - hw, y: y, dist: 130, ang: 2.4 },  // Left Down
                { x: x, y: y, dist: 150, ang: 3.54 },  // Center Left
                { x: x, y: y, dist: 100, ang: 1.57 },  // Center Down
                { x: x, y: y, dist: 150, ang: -0.4 },     // Center Right
                { x: x + hw, y: y, dist: 80, ang: -0.7 }, // Right Up
                { x: x + hw, y: y, dist: 130, ang: 0.7 },  // Right Down
            ];

            burstSettings.forEach((s, idx) => {
                PhaserScene.time.delayedCall(idx * 50, () => {
                    if (gameStateMachine.is(GAME_CONSTANTS.PHASE_COMBAT)) {
                        resourceManager.spawnDataDrop(s.x, s.y, s.dist + Math.random() * 40, s.ang + (Math.random() * 0.4 - 0.2));
                    }
                });
            });
        });
        _activeDelayedCalls.push(burstDC);

        const dc = PhaserScene.time.delayedCall(2450, () => {
            if (typeof messageBus !== 'undefined') {
                messageBus.publish('pulseData');
                const innerDc1 = PhaserScene.time.delayedCall(2200, () => {
                    if (typeof messageBus !== 'undefined') messageBus.publish('pulseData');
                    const innerDc2 = PhaserScene.time.delayedCall(2200, () => {
                        if (typeof messageBus !== 'undefined') messageBus.publish('pulseData');
                    });
                    _activeDelayedCalls.push(innerDc2);
                });
                _activeDelayedCalls.push(innerDc1);
            }
        });
        _activeDelayedCalls.push(dc);
    }

    function _showUpgradeTutorial() {
        const msg = t('tutorial', 'upgrade_use');
        // 200px above Awaken node (treeX: 400, treeY: 750) -> moved up another 140px (down 60 from 350)
        const x = 400;
        const y = 410;

        _createTutorialPopup(msg, x, y, true, undefined, undefined, null, '38px');

        // Play glow on specific primary nodes
        const nodesToGlow = ['automated_defense', 'integrity', 'focus'];
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
            // Note: We no longer save immediately here to avoid redundant I/O. 
            // Saving is handled by phase transitions in milestoneTracker.js.
        }

        // Apply big font scaling if enabled
        if (gameState.settings.bigFont) {
            const numPart = parseInt(fontSize);
            if (!isNaN(numPart)) {
                fontSize = (numPart + 6) + 'px';
            }
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
        bg.isTreeElement = true; // Prevent automatic ignore from tree cameras
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
        txt.isTreeElement = true;
        txt.setAlpha(1);

        if (typeof upgradeTree !== 'undefined' && upgradeTree.assignToUICamera) {
            upgradeTree.assignToUICamera(bg);
            upgradeTree.assignToUICamera(txt);
        }

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
                    audio.play('digital_typewriter_short', 0.35); // Added sound effect
                }
            });
        });

        // If in upgrade tree, add to the tree group (slides with panel, but doesn't pan/zoom with nodes)
        if (isUpgradeTree && typeof upgradeTree !== 'undefined') {
            const group = upgradeTree.getGroup();
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
            const x = 400;
            const y = 625;
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

    function _cancelActiveDelayedCalls() {
        _activeDelayedCalls.forEach(dc => {
            if (dc && dc.remove) dc.remove();
        });
        _activeDelayedCalls = [];
    }

    return { init, showDuoSwapTutorial };
})();
