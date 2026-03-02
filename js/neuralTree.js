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
    let titleText = null;
    let deployBtn = null;
    let lines = [];  // Phaser Graphics lines connecting parent → child
    let treeGroup = null;

    let visible = false;

    // Tree layout constants (within the 800px left-half panel)
    const PANEL_W = GAME_CONSTANTS.halfWidth;
    const TREE_CENTER_X = PANEL_W / 2;  // 400

    // ── init ─────────────────────────────────────────────────────────────

    function init() {
        treeGroup = createVirtualGroup(PhaserScene, 0, 0);

        _createPanel();
        _createNodes();
        _createDeployButton();

        messageBus.subscribe('phaseChanged', _onPhaseChanged);
        messageBus.subscribe('towerSpawned', _onTowerSpawned);
        messageBus.subscribe('currencyChanged', _onCurrencyChanged);
    }

    function _createPanel() {
        // Semi-transparent dark background for the left half
        panelBg = PhaserScene.add.image(0, 0, 'white_pixel');
        panelBg.setOrigin(0, 0);
        panelBg.setDisplaySize(PANEL_W, GAME_CONSTANTS.HEIGHT);
        panelBg.setTint(0x12122a);
        panelBg.setAlpha(0.9);
        panelBg.setDepth(GAME_CONSTANTS.DEPTH_NEURAL_TREE);
        panelBg.setScrollFactor(0);
        // Flat depth layering (scrollFactor(0)) keeps UI elements fixed and reduces rendering overhead, improving performance.

        panelBg.setVisible(false);
        treeGroup.add(panelBg);

        // Title
        titleText = PhaserScene.add.text(TREE_CENTER_X, 38, 'NEURAL TREE', {
            fontFamily: 'Michroma',
            fontSize: '22px',
            color: '#00f5ff',
            align: 'center',
        }).setOrigin(0.5, 0).setDepth(GAME_CONSTANTS.DEPTH_NEURAL_TREE + 5).setScrollFactor(0).setVisible(false);

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
        const isFirst = gameState.isFirstLaunch !== false;

        if (isFirst) {
            // First launch: only AWAKEN visible and unlocked
            nodes.awaken.setState(NODE_STATE.UNLOCKED);
            nodes.basic_pulse.setState(NODE_STATE.HIDDEN);
            nodes.reinforce.setState(NODE_STATE.HIDDEN);
            nodes.sharpen.setState(NODE_STATE.HIDDEN);
        } else {
            // Returning player — restore states from saved levels
            const ups = gameState.upgrades || {};
            for (const id in nodes) {
                const n = nodes[id];
                if (ups[id] && ups[id] >= n.maxLevel) {
                    n.setState(NODE_STATE.MAXED);
                } else if (ups[id] && ups[id] > 0) {
                    n.setState(NODE_STATE.UNLOCKED);
                } else {
                    // Check if parent is purchased
                    if (n.parentId && ups[n.parentId] && ups[n.parentId] > 0) {
                        n.setState(NODE_STATE.UNLOCKED);
                    } else if (!n.parentId) {
                        n.setState(ups[id] > 0 ? NODE_STATE.MAXED : NODE_STATE.UNLOCKED);
                    } else {
                        n.setState(NODE_STATE.GHOST);
                    }
                }
            }
        }
    }

    function _revealChildren(parentId) {
        const parent = nodes[parentId];
        if (!parent) return;
        for (let i = 0; i < parent.childIds.length; i++) {
            const child = nodes[parent.childIds[i]];
            if (child && (child.state === NODE_STATE.HIDDEN || child.state === NODE_STATE.GHOST)) {
                child.setState(NODE_STATE.UNLOCKED);
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
                x: PANEL_W - 100,
                y: GAME_CONSTANTS.HEIGHT - 63,
            },
            hover: {
                ref: 'button_hover.png',
                atlas: 'buttons',
                x: PANEL_W - 100,
                y: GAME_CONSTANTS.HEIGHT - 63,
            },
            press: {
                ref: 'button_press.png',
                atlas: 'buttons',
                x: PANEL_W - 100,
                y: GAME_CONSTANTS.HEIGHT - 63,
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

    // ── show / hide ──────────────────────────────────────────────────────

    function show() {
        visible = true;
        panelBg.setVisible(true);
        titleText.setVisible(true);

        // Show all nodes and refresh affordability state
        for (const id in nodes) {
            const n = nodes[id];
            n.setVisible(n.state !== NODE_STATE.HIDDEN);
            if (n.state === NODE_STATE.UNLOCKED) {
                n._updateVisual();
            }
        }

        // Show DEPLOY button only if tower has been spawned
        const awakenLevel = (gameState.upgrades && gameState.upgrades.awaken) || 0;
        if (awakenLevel > 0) {
            deployBtn.setVisible(true);
            deployBtn.setState(NORMAL);
        }

        _updateLines();
    }

    function hide() {
        visible = false;
        panelBg.setVisible(false);
        titleText.setVisible(false);
        deployBtn.setVisible(false);
        deployBtn.setState(DISABLE);
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

                    const px = p.treeX;
                    const py = p.treeY;
                    const cx = n.treeX;
                    const cy = n.treeY;

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
                const alpha = n.state === NODE_STATE.GHOST ? 0.6 : 1.0;
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
        if (phase === 'UPGRADE_PHASE') {
            show();
        } else {
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
        if (!gameStateMachine.is('UPGRADE_PHASE')) return;
        // Refresh UNLOCKED node visuals so disabled/normal state tracks affordability
        for (const id in nodes) {
            const n = nodes[id];
            if (n.state === NODE_STATE.UNLOCKED) {
                n._updateVisual();
            }
        }
    }

    function _onDeployClicked() {
        if (!gameStateMachine.is('UPGRADE_PHASE')) return;

        // Mark first launch as complete
        gameState.isFirstLaunch = false;

        transitionManager.transitionTo('WAVE_ACTIVE');
    }

    // ── public ───────────────────────────────────────────────────────────

    function getNode(id) { return nodes[id] || null; }

    function isVisible() { return visible; }

    function _showDeployButton() {
        if (deployBtn) {
            deployBtn.setVisible(true);
            deployBtn.setState(NORMAL);
        }
    }

    function getGroup() { return treeGroup; }

    return { init, show, hide, getNode, isVisible, _revealChildren, _showDeployButton, getGroup };
})();
