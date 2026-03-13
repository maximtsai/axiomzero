// neuralTree.js — Upgrade Tree UI (left half of screen during Upgrade Phase).
// Phase 1: AWAKEN root node + 3 children (Basic Pulse, Reinforce, Sharpen).
// Uses Node class from node.js for individual node logic.

const neuralTree = (() => {
    // Panel container position (the left half slides on/off)
    let panelX = 0;

    // All Node instances keyed by id
    const nodes = {};

    // Tree visual elements
    let panelBg = null;
    let panelOutline = null;
    let panelOutlineGlitch = null;
    let dragSurface = null;
    let titleText = null;
    let deployBtn = null;
    let cryptoMineBtn = null;
    let lines = [];  // Phaser Graphics lines connecting parent → child
    let treeGroup = null;
    let draggableGroup = null;

    let buyPulsePool = null;
    let maxPulsePool = null;

    let lastDragX = 0;
    let lastDragY = 0;

    let visible = false;
    let hasShownThisSession = false;

    // Tree layout constants (within the 800px left-half panel)
    const PANEL_W = GAME_CONSTANTS.halfWidth;
    const TREE_CENTER_X = PANEL_W / 2;  // 400

    // ── init ─────────────────────────────────────────────────────────────

    function init() {
        treeGroup = createVirtualGroup(PhaserScene, 0, 0);
        draggableGroup = createVirtualGroup(PhaserScene, 0, 0);

        _createPanel();
        _createNodes();
        _createDeployButton();
        _createCryptoMineButton();
        _initPools();

        messageBus.subscribe('phaseChanged', _onPhaseChanged);
        messageBus.subscribe('towerSpawned', _onTowerSpawned);
        messageBus.subscribe('currencyChanged', _onCurrencyChanged);
        messageBus.subscribe('upgradePurchased', _onUpgradePurchased);

        PhaserScene.events.on('postupdate', _updateBackgroundCrop);
    }


    function _createPanel() {
        // Pretty background image - moves with the nodes
        panelBg = PhaserScene.add.image(TREE_CENTER_X, GAME_CONSTANTS.halfHeight, 'backgrounds', 'upgrade_background.png');
        panelBg.setScale(1.2);
        panelBg.setDepth(GAME_CONSTANTS.DEPTH_NEURAL_TREE);
        panelBg.setScrollFactor(0);
        panelBg.setVisible(false);

        // Add to treeGroup for panel transitions, and draggableGroup for scrolling sync
        treeGroup.add(panelBg);
        draggableGroup.add(panelBg);

        // Static outline frame for the left half
        panelOutline = PhaserScene.add.image(TREE_CENTER_X, GAME_CONSTANTS.halfHeight, 'backgrounds', 'upgrade_outline.png');
        panelOutline.setDepth(GAME_CONSTANTS.DEPTH_NEURAL_TREE + 4);
        panelOutline.setScrollFactor(0);
        panelOutline.setVisible(false);
        treeGroup.add(panelOutline);

        // Second copy of the outline frame for a glitch effect
        panelOutlineGlitch = PhaserScene.add.image(TREE_CENTER_X, GAME_CONSTANTS.halfHeight, 'backgrounds', 'upgrade_outline.png');
        panelOutlineGlitch.setDepth(GAME_CONSTANTS.DEPTH_NEURAL_TREE + 4);
        panelOutlineGlitch.setScrollFactor(0);
        panelOutlineGlitch.setTint(0x888888); // Grey tint
        panelOutlineGlitch.setVisible(false);
        treeGroup.add(panelOutlineGlitch);

        // Animation sequence for glitch outline
        const startGlitch = () => {
            const glitchSteps = [
                { delay: 0, alpha: 1 },
                { delay: 200, alpha: 0.4 },
                { delay: 40, alpha: 1 },
                { delay: 100, alpha: 0.25 },
                { delay: 40, alpha: 1 },
                { delay: 300, alpha: 0.25 },
                { delay: 150, alpha: 0.5 },
                { delay: 100, alpha: -1 }, // -1 = hide
            ];

            panelOutlineGlitch.setVisible(true);
            let cumDelay = 0;
            for (const step of glitchSteps) {
                cumDelay += step.delay;
                const { alpha } = step;
                PhaserScene.time.delayedCall(cumDelay, () => {
                    if (alpha < 0) {
                        panelOutlineGlitch.setVisible(false);
                    } else {
                        panelOutlineGlitch.setAlpha(alpha);
                    }
                });
            }
        };

        // Start the glitch animation (one-time upon creation)
        if (panelOutlineGlitch) {
            // We use a slightly longer delay to ensure the panel might be visible if it was opened immediately
            // but the prompt says 0.3s after creation.
            startGlitch();
        }

        // Invisible drag surface - covers the 800px wide panel
        dragSurface = new Button({
            normal: {
                ref: 'white_pixel',
                x: TREE_CENTER_X,
                y: GAME_CONSTANTS.halfHeight,
                scaleX: PANEL_W / 2, // 2x2 pixel -> 800px
                scaleY: GAME_CONSTANTS.HEIGHT / 2, // 2x2 pixel -> 900px
                alpha: 0.001,
                depth: GAME_CONSTANTS.DEPTH_NEURAL_TREE + 0.1
            },
            onMouseDown: (x, y) => {
                lastDragX = x;
                lastDragY = y;
                buttonManager.setDraggedObj(dragSurface);
            },
            onDrag: (x, y) => {
                const dx = x - lastDragX;
                const dy = y - lastDragY;

                const currentX = draggableGroup.x;
                const currentY = draggableGroup.y;

                // Restrict movement based on global tree drag constants
                const nextX = Phaser.Math.Clamp(currentX + dx, GAME_CONSTANTS.TREE_DRAG_MIN_X, GAME_CONSTANTS.TREE_DRAG_MAX_X);
                const nextY = Phaser.Math.Clamp(currentY + dy, GAME_CONSTANTS.TREE_DRAG_MIN_Y, GAME_CONSTANTS.TREE_DRAG_MAX_Y);

                const finalDx = nextX - currentX;
                const finalDy = nextY - currentY;

                if (finalDx !== 0 || finalDy !== 0) {
                    draggableGroup.moveBy(finalDx, finalDy);
                }

                lastDragX = x;
                lastDragY = y;
            },
            onMouseUp: () => {
                if (typeof nodeTooltip !== 'undefined') {
                    nodeTooltip.hide();
                }
            }
        });
        dragSurface.setScrollFactor(0);
        dragSurface.setVisible(false);
        treeGroup.add(dragSurface);

        // Title
        titleText = PhaserScene.add.text(TREE_CENTER_X, 48, 'NEURAL TREE', {
            fontFamily: 'Michroma',
            fontSize: '28px',
            color: '#00f5ff',
            align: 'center',
        }).setOrigin(0.5, 0).setDepth(GAME_CONSTANTS.DEPTH_NEURAL_TREE + 20).setScrollFactor(0).setVisible(false);
        titleText.setShadow(0, 0, '#00f5ff', 12, true, true);

        treeGroup.add(titleText);
    }

    function _createNodes() {
        for (let i = 0; i < NODE_DEFS.length; i++) {
            const def = NODE_DEFS[i];
            const node = def.isDuoBox ? new DuoNode(def) : new Node(def);
            nodes[def.id] = node;
            node.create(0, 0); // offset handled by treeX/treeY in defs

            // Restore saved level
            const savedLevel = (gameState.upgrades && gameState.upgrades[def.id]) || 0;
            if (savedLevel > 0) {
                node.level = savedLevel;
            }
        }

        // Set initial states
        _refreshAllNodes();
    }

    function _refreshAllNodes() {
        for (const id in nodes) {
            const n = nodes[id];
            n.refreshState();
            // Always set logical node visible; internal _updateVisual handles hiding button/label if HIDDEN.
            // This prevents HIDDEN inner Duo nodes from hiding the shared backing sprite.
            n.setVisible(true);
        }
    }

    function _revealChildren(parentId) {
        const parent = nodes[parentId];
        if (!parent) return;
        for (let i = 0; i < parent.childIds.length; i++) {
            const child = nodes[parent.childIds[i]];
            if (child) {
                child.refreshState();
            }
        }
        // Redraw lines to reflect new child states
        _updateLines();
    }

    function _createDeployButton() {
        deployBtn = new Button({
            normal: {
                ref: 'button_normal.png',
                atlas: 'buttons',
                x: PANEL_W - 105,
                y: GAME_CONSTANTS.HEIGHT - 57,
            },
            hover: {
                ref: 'button_hover.png',
                atlas: 'buttons',
                x: PANEL_W - 105,
                y: GAME_CONSTANTS.HEIGHT - 57,
            },
            press: {
                ref: 'button_press.png',
                atlas: 'buttons',
                x: PANEL_W - 105,
                y: GAME_CONSTANTS.HEIGHT - 57,
            },
            onMouseUp: _onDeployClicked,
        });
        deployBtn.setScale(helper.isMobileDevice() ? 0.95 : 0.9, helper.isMobileDevice() ? 1.0 : 0.9);
        deployBtn.addText('DEPLOY', {
            fontFamily: 'JetBrainsMono_Bold',
            fontSize: '25px',
            color: '#ffffff',
        });
        deployBtn.setDepth(GAME_CONSTANTS.DEPTH_NEURAL_TREE + 5);
        deployBtn.setScrollFactor(0);
        // Hidden until tower is spawned
        deployBtn.setVisible(false);
        deployBtn.setState(DISABLE);
        // Virtual group handles tracking positions relative to master
        treeGroup.add(deployBtn.getContainer ? deployBtn.getContainer() : deployBtn); // Note: Button doesn't expose container generally, maybe add multiple
    }

    function _createCryptoMineButton() {
        cryptoMineBtn = new Button({
            normal: {
                ref: 'button_normal.png',
                atlas: 'buttons',
                x: TREE_CENTER_X + 220, // Beside the 'NEURAL TREE' text
                y: 48,
            },
            hover: {
                ref: 'button_hover.png',
                atlas: 'buttons',
                x: TREE_CENTER_X + 220,
                y: 48,
            },
            press: {
                ref: 'button_press.png',
                atlas: 'buttons',
                x: TREE_CENTER_X + 220,
                y: 48,
            },
            onMouseUp: () => {
                if (typeof cryptoMine !== 'undefined') {
                    cryptoMine.show();
                }
            },
        });
        cryptoMineBtn.setScale(helper.isMobileDevice() ? 1.0 : 0.9);
        cryptoMineBtn.addText('MINE', {
            fontFamily: 'JetBrainsMono_Bold',
            fontSize: '21px',
            color: '#ff9500',
        });
        cryptoMineBtn.setDepth(GAME_CONSTANTS.DEPTH_NEURAL_TREE + 25);
        cryptoMineBtn.setScrollFactor(0);

        cryptoMineBtn.setVisible(false);
        cryptoMineBtn.setState(DISABLE);

        treeGroup.add(cryptoMineBtn.getContainer ? cryptoMineBtn.getContainer() : cryptoMineBtn);
    }

    function _initPools() {
        const resetFn = (p) => {
            p.setVisible(false);
            p.setActive(false);
        };

        buyPulsePool = new ObjectPool(() => {
            // 9-slice: x, y, atlas, frame, width, height, left, right, top, bottom
            const slice = PhaserScene.add.nineslice(0, 0, 'buttons', 'buy_pulse.png', 80, 80, 25, 25, 25, 25);
            slice.setDepth(GAME_CONSTANTS.DEPTH_NEURAL_TREE + 3); // behind node button (2.0)
            slice.setScrollFactor(0);
            treeGroup.add(slice);
            draggableGroup.add(slice);
            return slice;
        }, resetFn, 10).preAllocate(4);

        maxPulsePool = new ObjectPool(() => {
            const slice = PhaserScene.add.nineslice(0, 0, 'buttons', 'max_pulse.png', 80, 80, 25, 25, 25, 25);
            slice.setDepth(GAME_CONSTANTS.DEPTH_NEURAL_TREE + 3);
            slice.setScrollFactor(0);
            treeGroup.add(slice);
            draggableGroup.add(slice);
            return slice;
        }, resetFn, 10).preAllocate(4);
    }

    function playPurchasePulse(x, y, isMaxed) {
        if (!buyPulsePool || !maxPulsePool) return;

        const dur = isMaxed ? 750 : 600;
        const startAlpha = isMaxed ? 1.3 : 1;

        // Primary pulse
        _animatePulse(x, y, isMaxed ? maxPulsePool : buyPulsePool, 64, isMaxed ? 156 : 98, dur, startAlpha);

        // Secondary inner pulse (Max only)
        if (isMaxed) {
            _animatePulse(x, y, maxPulsePool, 64, 130, dur + 50, startAlpha - 0.35, 70);
        }
    }

    function _animatePulse(x, y, pool, startSize, targetSize, duration, alpha, delay = 0) {
        const pulse = pool.get();
        pulse.setPosition(x, y);
        pulse.setVisible(true);
        pulse.setActive(true);
        pulse.setAlpha(alpha);

        pulse.setScale(1);
        pulse.width = startSize;
        pulse.height = startSize;

        PhaserScene.tweens.add({
            delay: delay,
            targets: pulse,
            width: targetSize,
            height: targetSize,
            duration: duration,
            ease: 'Quart.easeOut'
        });

        PhaserScene.tweens.add({
            delay: delay,
            targets: pulse,
            alpha: 0,
            duration: duration,
            onComplete: () => {
                pool.release(pulse);
            }
        });
    }

    // ── show / hide ──────────────────────────────────────────────────────

    function show() {
        visible = true;
        panelBg.setVisible(true);

        if (!hasShownThisSession) {
            hasShownThisSession = true;
            panelBg.setAlpha(0.15);
            PhaserScene.tweens.add({
                targets: panelBg,
                alpha: 1,
                duration: 1000,
                ease: 'Linear'
            });

            // Hint for new players: pulse indicate the AWAKEN node
            const awakenLevel = (gameState.upgrades && gameState.upgrades.awaken) || 0;
            if (awakenLevel === 0) {
                const ind = helper.ninesliceIndicator(400, 750, 'buttons', 'indicator_pulse_thin.png', 120, 120, 46, 46, 16);
                ind.setDepth(GAME_CONSTANTS.DEPTH_NEURAL_TREE + 10);
                const indShort = helper.ninesliceIndicatorShort(400, 750, 'buttons', 'indicator_pulse.png', 150, 150, 48, 48, 16);
                indShort.setDepth(GAME_CONSTANTS.DEPTH_NEURAL_TREE + 10);
                treeGroup.add(ind);
                treeGroup.add(indShort);


            }
        } else {
            panelBg.setAlpha(1);
        }

        panelOutline.setVisible(true);
        dragSurface.setVisible(true);
        titleText.setVisible(true);

        _refreshAllNodes();

        // Show DEPLOY button only if tower has been spawned
        const awakenLevel = (gameState.upgrades && gameState.upgrades.awaken) || 0;
        if (awakenLevel > 0) {
            _showDeployButton();
        }

        const mineLevel = (gameState.upgrades && gameState.upgrades.crypto_mine_unlock) || 0;
        if (mineLevel > 0) {
            cryptoMineBtn.setVisible(true);
            cryptoMineBtn.setState(NORMAL);
        }

        _updateLines();
    }

    function hide() {
        visible = false;
        panelBg.setVisible(false);
        panelOutline.setVisible(false);
        dragSurface.setVisible(false);
        titleText.setVisible(false);
        deployBtn.setVisible(false);
        if (deployBtn.indicator) {
            deployBtn.indicator.setVisible(false);
        }

        deployBtn.setState(DISABLE);

        if (cryptoMineBtn) {
            cryptoMineBtn.setVisible(false);
            cryptoMineBtn.setState(DISABLE);
        }

        for (const id in nodes) {
            nodes[id].setVisible(false);
        }
        _hideLines();
    }

    function _createLine(px, py, cx, cy, metadata) {
        const dx = cx - px, dy = cy - py;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx) + 1.57;

        const line = PhaserScene.add.image(px, py, 'pixels', 'white_pixel.png');
        line.setScale(1.5, distance / 2);
        line.setOrigin(0.5, 1);
        line.setRotation(angle);
        line.setDepth(GAME_CONSTANTS.DEPTH_NEURAL_TREE + 1);
        line.setScrollFactor(0);
        Object.assign(line, metadata);

        lines.push(line);
        treeGroup.add(line);
        draggableGroup.add(line);
        return line;
    }

    function _updateLines() {
        // Create lines if they don't exist yet
        if (lines.length === 0) {
            const isDuoLineDrawn = {};

            for (const id in nodes) {
                const n = nodes[id];
                if (n.parents && n.parents.length > 0) {
                    for (let pid of n.parents) {
                        const p = nodes[pid];
                        if (!p) continue;

                        if (n.isDuoBox && n.duoBoxTier > 0) {
                            const duoKey = n.duoBoxTier + '_' + pid;
                            if (isDuoLineDrawn[duoKey]) continue;
                            isDuoLineDrawn[duoKey] = true;

                            const sibling = n.duoSiblingId ? nodes[n.duoSiblingId] : null;
                            const targetX = sibling ? (n.treeX + sibling.treeX) / 2 : n.treeX;
                            const targetY = sibling ? (n.treeY + sibling.treeY) / 2 : n.treeY;

                            _createLine(p.treeX, p.treeY, targetX, targetY, {
                                childId: id,
                                duoSiblingChildId: n.duoSiblingId,
                                parentId: pid,
                                isDuoLine: true,
                            });
                        } else {
                            _createLine(p.treeX, p.treeY, n.treeX, n.treeY, {
                                childId: id,
                                parentId: pid,
                            });
                        }
                    }
                }
            }

            // Adjust line thickness now that they are created
            for (const line of lines) {
                line.setScale(1.5, line.scaleY);
            }
        }

        // Update visual states based on current node states
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const p = nodes[line.parentId];
            const n = nodes[line.childId];

            if (!p || !n) continue;

            // Determine visibility
            let shouldHide;
            if (line.isDuoLine) {
                shouldHide = (p.state === NODE_STATE.HIDDEN);
            } else {
                shouldHide = (p.state === NODE_STATE.HIDDEN || n.state === NODE_STATE.HIDDEN);
            }

            if (shouldHide) {
                line.setVisible(false);
            } else {
                line.setVisible(true);
                const parentActive = (p.state === NODE_STATE.UNLOCKED || p.state === NODE_STATE.MAXED);
                const isDuoBranch = (n.isDuoDescendant && n.isDuoDescendant());
                line.setAlpha((parentActive || isDuoBranch) ? 0.6 : 0); // Slightly more opaque (0.6)
            }
        }
    }

    function _hideLines() {
        for (let i = 0; i < lines.length; i++) {
            lines[i].setVisible(false);
        }
    }

    // ── events ───────────────────────────────────────────────────────────

    function _onPhaseChanged(phase) {
        if (phase === GAME_CONSTANTS.PHASE_UPGRADE) {
            show();
            if (draggableGroup) draggableGroup.activate();
        } else {
            if (draggableGroup) draggableGroup.deactivate();
            if (typeof transitionManager === 'undefined' || !transitionManager.isTransitioning()) {
                hide();
            }
        }
    }

    function _onTowerSpawned() {
        // Show DEPLOY button after AWAKEN is purchased
        if (visible) {
            _showDeployButton();
        }
    }

    function _onCurrencyChanged() {
        if (!gameStateMachine.is(GAME_CONSTANTS.PHASE_UPGRADE)) return;
        // Refresh UNLOCKED node visuals so disabled/normal state tracks affordability
        for (const id in nodes) {
            const n = nodes[id];
            if (n.state === NODE_STATE.UNLOCKED) {
                n._updateVisual();
            }
        }
    }

    function _onUpgradePurchased() {
        _refreshAllNodes();
        _updateLines();
    }

    function _onDeployClicked() {
        if (!gameStateMachine.is(GAME_CONSTANTS.PHASE_UPGRADE)) return;

        // Mark first launch as complete
        gameState.isFirstLaunch = false;

        transitionManager.transitionTo(GAME_CONSTANTS.PHASE_COMBAT);
    }

    // ── public ───────────────────────────────────────────────────────────

    function getNode(id) { return nodes[id] || null; }

    function isVisible() { return visible; }

    function _updateBackgroundCrop() {
        if (!panelBg || !visible) return;

        const groupX = treeGroup ? treeGroup.x : 0;
        const groupY = treeGroup ? treeGroup.y : 0;

        const minVisX = groupX;
        const maxVisX = groupX + GAME_CONSTANTS.halfWidth - 20;
        const minVisY = groupY + 22;
        const maxVisY = groupY + GAME_CONSTANTS.HEIGHT - 22;

        const scale = 1.2;
        const texW = 728;
        const texH = 1024;

        // Bounds of the scaled sprite
        const spriteLeft = panelBg.x - (texW * scale) / 2;
        const spriteRight = panelBg.x + (texW * scale) / 2;
        const spriteTop = panelBg.y - (texH * scale) / 2;
        const spriteBottom = panelBg.y + (texH * scale) / 2;

        // Calculate visible portion
        const cropLeft = Math.max(spriteLeft, minVisX);
        const cropRight = Math.min(spriteRight, maxVisX);
        const cropTop = Math.max(spriteTop, minVisY);
        const cropBottom = Math.min(spriteBottom, maxVisY);

        const cropW = (cropRight - cropLeft) / scale;
        const cropH = (cropBottom - cropTop) / scale;

        if (cropW <= 0 || cropH <= 0) {
            panelBg.setCrop(0, 0, 0.1, 0.1);
        } else {
            const cropX = (cropLeft - spriteLeft) / scale;
            const cropY = (cropTop - spriteTop) / scale;
            panelBg.setCrop(cropX, cropY, cropW, cropH);
        }

        if (typeof tutorialManager !== 'undefined' && tutorialManager.updateCropping) {
            tutorialManager.updateCropping(minVisX, maxVisX, minVisY, maxVisY);
        }
    }

    function _showDeployButton() {
        if (deployBtn) {
            if (deployBtn.visible) return;

            deployBtn.setVisible(true);
            deployBtn.setState(NORMAL);

            // Only pulse if the only node purchased is Awaken
            const upgrades = gameState.upgrades || {};
            const keys = Object.keys(upgrades).filter(k => upgrades[k] > 0);
            const onlyAwaken = keys.length === 1 && keys[0] === 'awaken';

            if (onlyAwaken) {
                const bx = PANEL_W - 105;
                const by = GAME_CONSTANTS.HEIGHT - 57;
                const bw = 344 * 0.6;
                const bh = 120 * 0.6;

                const ind2 = helper.ninesliceIndicatorShort(bx, by, 'buttons', 'button_normal.png', bw + 80, bh + 80, bw, bh, 24);
                ind2.setDepth(GAME_CONSTANTS.DEPTH_NEURAL_TREE + 10);
                deployBtn.indicator = ind2;
            }
        }
    }

    function _showCryptoMineButton() {
        if (cryptoMineBtn) {
            cryptoMineBtn.setVisible(true);
            cryptoMineBtn.setState(NORMAL);
        }
    }

    function getGroup() { return treeGroup; }
    function getDraggableGroup() { return draggableGroup; }

    return { init, show, hide, getNode, isVisible, _revealChildren, _showDeployButton, _showCryptoMineButton, playPurchasePulse, getGroup, getDraggableGroup };
})();
