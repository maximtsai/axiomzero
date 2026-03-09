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

        messageBus.subscribe('phaseChanged', _onPhaseChanged);
        messageBus.subscribe('towerSpawned', _onTowerSpawned);
        messageBus.subscribe('currencyChanged', _onCurrencyChanged);

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
            panelOutlineGlitch.setVisible(true);
            panelOutlineGlitch.setAlpha(1);

            PhaserScene.time.delayedCall(200, () => {
                panelOutlineGlitch.setAlpha(0.4);
                PhaserScene.time.delayedCall(40, () => {
                    panelOutlineGlitch.setAlpha(1);
                    PhaserScene.time.delayedCall(100, () => {
                        panelOutlineGlitch.setAlpha(0.25);
                        PhaserScene.time.delayedCall(40, () => {
                            panelOutlineGlitch.setAlpha(1);
                            PhaserScene.time.delayedCall(300, () => {
                                panelOutlineGlitch.setAlpha(0.25);
                                PhaserScene.time.delayedCall(150, () => {
                                    panelOutlineGlitch.setAlpha(0.5);
                                    PhaserScene.time.delayedCall(100, () => {
                                        panelOutlineGlitch.setVisible(false);
                                    });
                                });
                            });
                        });
                    });
                });
            });
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
            const node = new Node(def);
            nodes[def.id] = node;
            node.create(0, 0); // offset handled by treeX/treeY in defs

            // Restore saved level
            const savedLevel = (gameState.upgrades && gameState.upgrades[def.id]) || 0;
            if (savedLevel > 0) {
                node.level = savedLevel;
            }
        }

        // Set initial states
        _applyInitialStates();
    }

    function _applyInitialStates() {
        // Refresh all nodes. Parents refresh their children recursively,
        // so we just need to hit lahat (all) root nodes or just all nodes to be safe.
        for (const id in nodes) {
            nodes[id].refreshState();
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
        deployBtn.addText('DEPLOY', {
            fontFamily: 'JetBrainsMono_Bold',
            fontSize: '22px',
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
        cryptoMineBtn.addText('MINE', {
            fontFamily: 'JetBrainsMono_Bold',
            fontSize: '18px',
            color: '#ff9500',
        });
        cryptoMineBtn.setDepth(GAME_CONSTANTS.DEPTH_NEURAL_TREE + 25);
        cryptoMineBtn.setScrollFactor(0);

        cryptoMineBtn.setVisible(false);
        cryptoMineBtn.setState(DISABLE);

        treeGroup.add(cryptoMineBtn.getContainer ? cryptoMineBtn.getContainer() : cryptoMineBtn);
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
        } else {
            panelBg.setAlpha(1);
        }

        panelOutline.setVisible(true);
        dragSurface.setVisible(true);
        titleText.setVisible(true);

        for (const id in nodes) {
            const n = nodes[id];
            n.setVisible(n.state !== NODE_STATE.HIDDEN);
            if (n.state !== NODE_STATE.HIDDEN) {
                n._updateVisual();
            }
        }

        // Show DEPLOY button only if tower has been spawned
        const awakenLevel = (gameState.upgrades && gameState.upgrades.awaken) || 0;
        if (awakenLevel > 0) {
            deployBtn.setVisible(true);
            deployBtn.setState(NORMAL);
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

    function _updateLines() {
        // Create lines if they don't exist yet
        if (lines.length === 0) {
            for (const id in nodes) {
                const n = nodes[id];
                if (n.parentId && nodes[n.parentId]) {
                    const p = nodes[n.parentId];

                    const px = p.btn.x;
                    const py = p.btn.y;
                    const cx = n.btn.x;
                    const cy = n.btn.y;

                    const dx = cx - px;
                    const dy = cy - py;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    const angle = Math.atan2(dy, dx) + 1.57;

                    const line = PhaserScene.add.image(px, py, 'pixels', 'white_pixel.png');
                    line.setScale(1.5, distance / 2);
                    line.setOrigin(0.5, 1);
                    line.setRotation(angle);
                    line.setDepth(GAME_CONSTANTS.DEPTH_NEURAL_TREE + 1);
                    line.setScrollFactor(0);

                    // Attach id data so we know who this line belongs to
                    line.childId = id;
                    line.parentId = n.parentId;

                    lines.push(line);
                    treeGroup.add(line);
                    draggableGroup.add(line);
                }
            }
        }

        // Update their visual states based on the current nodes' states
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const p = nodes[line.parentId];
            const n = nodes[line.childId];

            if (p.state === NODE_STATE.HIDDEN || n.state === NODE_STATE.HIDDEN) {
                line.setVisible(false);
            } else {
                line.setVisible(true);
                const alpha = n.state === NODE_STATE.GHOST ? 0.25 : 1.0;
                line.setAlpha(alpha);
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
            deployBtn.setVisible(true);
            deployBtn.setState(NORMAL);
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
    }

    function _showDeployButton() {
        if (deployBtn) {
            deployBtn.setVisible(true);
            deployBtn.setState(NORMAL);
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

    return { init, show, hide, getNode, isVisible, _revealChildren, _showDeployButton, _showCryptoMineButton, getGroup, getDraggableGroup };
})();
