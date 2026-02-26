// neuralTree.js — Upgrade Tree UI (left half of screen during Upgrade Phase).
// Phase 1: AWAKEN root node + 3 children (Basic Pulse, Reinforce, Sharpen).
// Uses Node class from node.js for individual node logic.

const neuralTree = (() => {
    // Panel container position (the left half slides on/off)
    let panelX = 0;

    // All Node instances keyed by id
    const nodes = {};

    // Tree visual elements
    let panelBg    = null;
    let titleText  = null;
    let deployBtn  = null;
    let lines      = [];  // Phaser Graphics lines connecting parent → child

    let visible = false;

    // Tree layout constants (within the 640px left-half panel)
    const PANEL_W = GAME_CONSTANTS.halfWidth;
    const TREE_CENTER_X = PANEL_W / 2;  // 320

    // ── node definitions (Phase 1) ───────────────────────────────────────

    const NODE_DEFS = [
        {
            id: 'awaken',
            name: 'AWAKEN',
            description: 'Initialize the core process. Begin existence.',
            maxLevel: 1,
            baseCost: 0,
            costType: 'data',
            costScaling: 'static',
            costStep: 0,
            parentId: null,
            childIds: ['basic_pulse', 'reinforce', 'sharpen'],
            treeX: TREE_CENTER_X,
            treeY: 450,
            effect: function() {
                tower.awaken();
                // Reveal children
                _revealChildren('awaken');
                // Show the deploy button immediately
                if (visible) {
                    deployBtn.setVisible(true);
                    deployBtn.setState(NORMAL);
                }
            },
        },
        {
            id: 'basic_pulse',
            name: 'Basic Pulse',
            description: 'Unlocks cursor auto-pulse attack (2s interval, AoE).',
            maxLevel: 1,
            baseCost: 5,
            costType: 'data',
            costScaling: 'static',
            costStep: 0,
            parentId: 'awaken',
            childIds: [],
            treeX: TREE_CENTER_X - 120,
            treeY: 340,
            effect: function() {
                // Stub — cursor pulse implemented in Phase 2
                debugLog('Basic Pulse unlocked (stub)');
            },
        },
        {
            id: 'reinforce',
            name: 'Reinforce',
            description: '+25% tower max health per level.',
            maxLevel: 3,
            baseCost: 5,
            costType: 'data',
            costScaling: 'linear',
            costStep: 5,
            parentId: 'awaken',
            childIds: [],
            treeX: TREE_CENTER_X,
            treeY: 340,
            effect: function() {
                // Stats recalculated via 'upgradePurchased' → tower._onUpgradePurchased
            },
        },
        {
            id: 'sharpen',
            name: 'Sharpen',
            description: '+25% tower attack damage per level.',
            maxLevel: 3,
            baseCost: 5,
            costType: 'data',
            costScaling: 'linear',
            costStep: 5,
            parentId: 'awaken',
            childIds: [],
            treeX: TREE_CENTER_X + 120,
            treeY: 340,
            effect: function() {
                // Stats recalculated via 'upgradePurchased' → tower._onUpgradePurchased
            },
        },
    ];

    // ── init ─────────────────────────────────────────────────────────────

    function init() {
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
        panelBg.setTint(0x0a0a18);
        panelBg.setAlpha(0.9);
        panelBg.setDepth(GAME_CONSTANTS.DEPTH_NEURAL_TREE);
        panelBg.setVisible(false);

        // Title
        titleText = PhaserScene.add.text(TREE_CENTER_X, 30, 'NEURAL TREE', {
            fontFamily: 'Michroma',
            fontSize: '18px',
            color: '#00f5ff',
            align: 'center',
        }).setOrigin(0.5, 0).setDepth(GAME_CONSTANTS.DEPTH_NEURAL_TREE + 5).setVisible(false);
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
    }

    function _createDeployButton() {
        deployBtn = new Button({
            normal: {
                ref: 'button_normal.png',
                atlas: 'buttons',
                x: PANEL_W - 80,
                y: GAME_CONSTANTS.HEIGHT - 50,
                depth: GAME_CONSTANTS.DEPTH_NEURAL_TREE + 5,
            },
            hover: {
                ref: 'button_hover.png',
                atlas: 'buttons',
                x: PANEL_W - 80,
                y: GAME_CONSTANTS.HEIGHT - 50,
                depth: GAME_CONSTANTS.DEPTH_NEURAL_TREE + 5,
            },
            press: {
                ref: 'button_press.png',
                atlas: 'buttons',
                x: PANEL_W - 80,
                y: GAME_CONSTANTS.HEIGHT - 50,
                depth: GAME_CONSTANTS.DEPTH_NEURAL_TREE + 5,
            },
            onMouseUp: _onDeployClicked,
        });
        deployBtn.addText('DEPLOY', {
            fontFamily: 'JetBrainsMono-Bold',
            fontSize: '13px',
            color: '#ffffff',
        });
        // Hidden until tower is spawned
        deployBtn.setVisible(false);
        deployBtn.setState(DISABLE);
    }

    // ── show / hide ──────────────────────────────────────────────────────

    function show() {
        visible = true;
        panelBg.setVisible(true);
        titleText.setVisible(true);

        // Show all nodes according to their state
        for (const id in nodes) {
            const n = nodes[id];
            n.setVisible(n.state !== NODE_STATE.HIDDEN);
        }

        // Show DEPLOY button only if tower has been spawned
        const awakenLevel = (gameState.upgrades && gameState.upgrades.awaken) || 0;
        if (awakenLevel > 0) {
            deployBtn.setVisible(true);
            deployBtn.setState(NORMAL);
        }

        _drawLines();
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
        _clearLines();
    }

    function _drawLines() {
        _clearLines();
        const gfx = PhaserScene.add.graphics();
        gfx.lineStyle(1, 0x00f5ff, 0.3);
        gfx.setDepth(GAME_CONSTANTS.DEPTH_NEURAL_TREE + 0.5);

        for (const id in nodes) {
            const n = nodes[id];
            if (n.state === NODE_STATE.HIDDEN) continue;
            if (n.parentId && nodes[n.parentId]) {
                const p = nodes[n.parentId];
                if (p.state === NODE_STATE.HIDDEN) continue;
                gfx.lineBetween(p.treeX, p.treeY, n.treeX, n.treeY);
            }
        }
        lines.push(gfx);
    }

    function _clearLines() {
        for (let i = 0; i < lines.length; i++) {
            lines[i].destroy();
        }
        lines.length = 0;
    }

    // ── events ───────────────────────────────────────────────────────────

    function _onPhaseChanged(phase) {
        if (phase === 'UPGRADE_PHASE') {
            show();
        } else {
            hide();
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
        // Could refresh node affordability visuals here if desired
    }

    function _onDeployClicked() {
        if (!gameStateMachine.is('UPGRADE_PHASE')) return;

        // Mark first launch as complete
        gameState.isFirstLaunch = false;

        hide();
        transitionManager.transitionTo('WAVE_ACTIVE');
    }

    // ── public ───────────────────────────────────────────────────────────

    function getNode(id) { return nodes[id] || null; }

    return { init, show, hide, getNode };
})();
