// upgradeTree.js — Upgrade Tree UI (left half of screen during Upgrade Phase).
// Phase 1: AWAKEN root node + 3 children (Basic Pulse, Reinforce, Sharpen).
// Uses Node class from treeNode.js for individual node logic.

const upgradeTree = (() => {
    // Panel container position (the left half slides on/off)
    let panelX = 0;

    // All Node instances keyed by id
    const nodes = {};

    // Tree visual elements
    let panelBg = null;
    let panelOutline = null;
    let panelOutlineGlitch = null;
    let dragSurface = null;
    let deployBtn = null;
    let deployBtnInitialX = 0;
    let coinMineBtn = null;
    let slideRightBtn = null;
    let slideLeftBtn = null;

    let treeGroup = null;
    let draggableGroup = null;
    let treeMaskContainer = null;
    let treeNodeCamera = null;
    let uiCamera = null;
    let currentHoverLabel = " ";

    let buyPulsePool = null;
    let maxPulsePool = null;
    let insightMaxPulsePool = null;
    let insightBuyPulsePool = null;

    let zoomInBtn = null;
    let zoomOutBtn = null;
    let debugLogBtn = null;
    let zoomGoal = 1.0;


    let lastDragX = 0;
    let lastDragY = 0;

    let visible = false;
    let hasShownThisSession = false;
    let fullUpgradeView = false;
    let hintPulseTimer = null;
    let awakenHintTimer = null;
    let lastCoordX = -1;
    let lastCoordY = -1;
    let lastHoverLabel = "";
    let _currencyDirty = false;
    let _currencyFrameCount = 0;



    // Tree layout constants (within the 800px left-half panel)
    const PANEL_W = GAME_CONSTANTS.halfWidth;
    const TREE_X_OFFSET = 8;
    const TREE_CENTER_X = PANEL_W / 2 + TREE_X_OFFSET;  // 408

    // Content-Aware Bounds
    let contentBounds = { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    const NODE_SIZE_PADDING = 80;

    const SLIDE_DURATION = 500;

    // ── init ─────────────────────────────────────────────────────────────

    function init() {
        treeGroup = createVirtualGroup(PhaserScene, 0, 0);
        draggableGroup = createVirtualGroup(PhaserScene, 0, 0);

        // Create a dedicated container for masked elements.
        // It stays at (0,0) so that VirtualGroup world-coordinate logic still works relative to its parent.
        treeMaskContainer = PhaserScene.add.container(0, 0);
        treeMaskContainer.setScrollFactor(0);
        treeMaskContainer.setDepth(GAME_CONSTANTS.DEPTH_UPGRADE_TREE + 2);
        treeMaskContainer.isTreeElement = true;

        // Create Secondary Cameras for clipping and UI 
        treeNodeCamera = PhaserScene.cameras.add(0, 0, PANEL_W, GAME_CONSTANTS.HEIGHT);
        treeNodeCamera.setBackgroundColor('rgba(0,0,0,0)');

        uiCamera = PhaserScene.cameras.add(0, 0, GAME_CONSTANTS.WIDTH, GAME_CONSTANTS.HEIGHT);
        uiCamera.setBackgroundColor('rgba(0,0,0,0)');

        // Hide tree from main camera, and world from tree cameras
        PhaserScene.cameras.main.ignore(treeMaskContainer);
        treeNodeCamera.ignore(PhaserScene.children.list);
        uiCamera.ignore(PhaserScene.children.list);

        treeMaskContainer.cameraFilter &= ~treeNodeCamera.id; // Un-ignore the container itself

        // Global hook: newly spawned enemies/bullets get ignored by tree cameras
        PhaserScene.events.on('addedtoscene', (child) => {
            if (!child.isTreeElement) {
                if (treeNodeCamera) treeNodeCamera.ignore(child);
                if (uiCamera) uiCamera.ignore(child);
            }
        });

        // Wrap treeGroup.add to assign UI elements to uiCamera
        const _originalTreeGroupAdd = treeGroup.add;
        treeGroup.add = (gameObject) => {
            assignToUICamera(gameObject);
            return _originalTreeGroupAdd(gameObject);
        };

        // Wrap draggableGroup.add to auto-collect masked elements
        const _originalAdd = draggableGroup.add;
        draggableGroup.add = (gameObject) => {
            _applyTreeMask(gameObject);
            return _originalAdd(gameObject);
        };

        _createPanel();
        _createNodes();
        _calculateContentBounds(); // Measure the tree after nodes are created
        _createDeployButton();
        _createCoinMineButton();
        _createSlideButton();
        _createZoomButtons();
        _initPools();
        treeLineManager.init({ treeGroup, draggableGroup, nodes });

        // Initial snap to constraints
        _applyConstraints();

        // Optimization: Sort by depth after initialization to ensure lines (depth+1) are behind nodes (depth+2).
        // We delay by 0ms so that show() has a chance to run and create the lazy-loaded lines first.
        PhaserScene.time.delayedCall(0, () => {
            if (treeMaskContainer) {
                treeMaskContainer.sort('depth');
                console.log("depth sorted tree lines all (delayed) ======");
            }
        });

        if (FLAGS.DEBUG) {
            _checkNodeIntegrity();
        }

        messageBus.subscribe('phaseChanged', _onPhaseChanged);
        messageBus.subscribe('towerSpawned', _onTowerSpawned);
        messageBus.subscribe('currencyChanged', _onCurrencyChanged);
        messageBus.subscribe('upgradePurchased', _onUpgradePurchased);
        messageBus.subscribe('node_purchase_feedback', _onNodePurchaseFeedback);

        updateManager.addFunction(_update);


        // Zoom Input Logic (Scroll Wheel)
        PhaserScene.input.on('wheel', (pointer, gameObjects, deltaX, deltaY, deltaZ) => {
            if (!visible || !draggableGroup) return;

            // Only zoom if pointer is within bounds. In full view, bounds is the whole screen.
            if (!fullUpgradeView && pointer.x > PANEL_W) return;

            const zoomStep = 0.08;
            const minScale = 0.5;
            const maxScale = 1.0;
            const currentScale = draggableGroup.getScale();

            let newScale = currentScale;
            if (pointer.deltaY > 0) {
                newScale = Math.max(minScale, currentScale - zoomStep);
            } else {
                newScale = Math.min(maxScale, currentScale + zoomStep);
            }

            if (newScale !== currentScale) {
                const mx = pointer.x;
                const my = pointer.y;

                // Pivot-based scaling: Keep the point under the mouse constant
                // groupPos_new = mousePos - ((mousePos - groupPos_old) / scale_old) * scale_new
                const nextX = mx - ((mx - draggableGroup.x) / currentScale) * newScale;
                const nextY = my - ((my - draggableGroup.y) / currentScale) * newScale;

                zoomGoal = newScale;
                draggableGroup.setScale(newScale);
                draggableGroup.setPosition(nextX, nextY);
                _applyConstraints();
            }
        });
    }

    /**
     * Debug-only check to ensure all parent-child relationships in nodeDefs.js match.
     * Logs warnings for missing references or one-way connections.
     */
    function _checkNodeIntegrity() {
        console.log("%c [DEBUG] Upgrade Tree integrity check starting... ", "background: #111; color: #00f5ff; border: 1px solid #00f5ff;");
        let warnings = 0;

        for (const def of NODE_DEFS) {
            const id = def.id;

            // 0. Schema Validation
            if (!id) {
                console.warn(`[NODE INTEGRITY] A node is missing 'id'.`, def);
                warnings++;
                continue;
            }
            if (!def.isPlaceholder && !def.name) {
                console.warn(`[NODE INTEGRITY] Node '${id}' is missing a 'name'.`);
                warnings++;
            }
            if (!def.isPlaceholder && !def.costType) {
                console.warn(`[NODE INTEGRITY] Node '${id}' is missing a 'costType'.`);
                warnings++;
            }
            if (!def.isPlaceholder && typeof def.maxLevel !== 'number') {
                console.warn(`[NODE INTEGRITY] Node '${id}' is missing a valid 'maxLevel' number.`);
                warnings++;
            }

            // 1. Check all children list this node as a parent
            if (def.childIds) {
                for (const cid of def.childIds) {
                    const child = NODE_DEFS.find(d => d.id === cid);
                    if (!child) {
                        console.warn(`[NODE INTEGRITY] Node '${id}' references non-existent child: '${cid}'`);
                        warnings++;
                        continue;
                    }
                    if (!child.parents || !child.parents.includes(id)) {
                        // EXCEPTION: A placeholder lists duo nodes as children, but duo nodes list the grandparent as parent
                        if (child.isDuoBox) {
                            const childListsGrandparent = child.parents.some(pid => {
                                const grandparent = NODE_DEFS.find(d => d.id === pid);
                                return grandparent && grandparent.childIds && grandparent.childIds.includes(id);
                            });
                            if (childListsGrandparent) continue;
                        }

                        console.warn(`[NODE INTEGRITY] Reciprocity failure: '${id}' -> child '${cid}', but '${cid}' does not list '${id}' as parent.`);
                        warnings++;
                    }
                }
            }

            // 2. Check all parents list this node as a child
            if (def.parents) {
                for (const pid of def.parents) {
                    const parent = NODE_DEFS.find(d => d.id === pid);
                    if (!parent) {
                        console.warn(`[NODE INTEGRITY] Node '${id}' references non-existent parent: '${pid}'`);
                        warnings++;
                        continue;
                    }
                    if (!parent.childIds || !parent.childIds.includes(id)) {
                        // EXCEPTION: Duo nodes may list a root parent while being technically children of an intermediate (like a placeholder)
                        if (def.isDuoBox) {
                            const parentHasIntermediate = parent.childIds.some(cid => {
                                const intermediate = NODE_DEFS.find(d => d.id === cid);
                                return intermediate && intermediate.childIds && intermediate.childIds.includes(id);
                            });
                            if (parentHasIntermediate) continue;
                        }

                        console.warn(`[NODE INTEGRITY] Reciprocity failure: '${id}' -> parent '${pid}', but '${pid}' does not list '${id}' as child.`);
                        warnings++;
                    }
                }
            }
        }

        if (warnings === 0) {
            console.log("%c [DEBUG] Upgrade Tree integrity check: PASS ", "color: #00ff66;");
        } else {
            console.warn(`[DEBUG] Upgrade Tree integrity check: FAIL (${warnings} warnings). Check console above.`);
        }
    }


    function _createPanel() {
        // Pretty background image - moves with the nodes
        panelBg = PhaserScene.add.image(TREE_CENTER_X + 25, GAME_CONSTANTS.halfHeight - 350, 'backgrounds', 'upgrade_background.png');
        panelBg.setDepth(GAME_CONSTANTS.DEPTH_UPGRADE_TREE);
        panelBg.setScrollFactor(0);
        panelBg.setVisible(false);

        // Add to draggableGroup for scrolling sync and treeMaskContainer for transitions
        draggableGroup.add(panelBg);

        // Static outline frame for the left half
        panelOutline = PhaserScene.add.nineslice(TREE_CENTER_X - 414, GAME_CONSTANTS.halfHeight, 'backgrounds', 'upgrade_outline.png', 816, 902, 230, 230, 230, 230);
        panelOutline.setOrigin(0, 0.5);
        panelOutline.setDepth(GAME_CONSTANTS.DEPTH_UPGRADE_TREE + 15);
        panelOutline.setScrollFactor(0);
        panelOutline.setVisible(false);
        treeGroup.add(panelOutline);

        // Second copy of the outline frame for a glitch effect
        panelOutlineGlitch = PhaserScene.add.nineslice(TREE_CENTER_X - 414, GAME_CONSTANTS.halfHeight, 'backgrounds', 'upgrade_outline.png', 816, 902, 230, 230, 230, 230);
        panelOutlineGlitch.setOrigin(0, 0.5);
        panelOutlineGlitch.setDepth(GAME_CONSTANTS.DEPTH_UPGRADE_TREE + 15);
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
        // Using a Phaser Image instead of the Button system to avoid click consumption issues
        dragSurface = PhaserScene.add.image(TREE_CENTER_X, GAME_CONSTANTS.halfHeight, 'white_pixel');
        dragSurface.setScale(PANEL_W / 2, GAME_CONSTANTS.HEIGHT / 2);
        dragSurface.setAlpha(0.001);
        dragSurface.setDepth(GAME_CONSTANTS.DEPTH_UPGRADE_TREE + 0.1);
        dragSurface.setScrollFactor(0);
        dragSurface.setVisible(false);
        dragSurface.setInteractive();

        let isDraggingTree = false;
        let dragDistanceTotal = 0;

        dragSurface.on('pointerdown', (pointer) => {
            const hoveredBtn = buttonManager.getHoveredButton(pointer.x, pointer.y);
            // Only block dragging if we are clicking a button belonging to a popup (very high depth)
            if (hoveredBtn && hoveredBtn.getDepth() > 10000) return;

            if (typeof treePopups !== 'undefined' && treePopups.isAnyPopupVisible()) return;
            if (helper.isGlobalBlockerActive()) return;

            isDraggingTree = true;
            dragDistanceTotal = 0;
            lastDragX = pointer.x;
            lastDragY = pointer.y;
        });

        PhaserScene.input.on('pointermove', (pointer) => {
            if (!isDraggingTree || !visible) return;

            const x = pointer.x;
            const y = pointer.y;
            const dx = x - lastDragX;
            const dy = y - lastDragY;

            dragDistanceTotal += Math.abs(dx) + Math.abs(dy);

            if (dx !== 0 || dy !== 0) {
                draggableGroup.moveBy(dx, dy);
                _applyConstraints();
            }

            lastDragX = x;
            lastDragY = y;
        });

        PhaserScene.input.on('pointerup', () => {
            if (isDraggingTree) {
                isDraggingTree = false;

                // Only hide tooltip if we actually dragged significantly.
                // This prevents clicks on nodes (which also trigger dragSurface pointer events)
                // from prematurely closing the hover popup.
                // if (dragDistanceTotal > 5) {
                //     if (typeof nodeTooltip !== 'undefined') {
                //         nodeTooltip.hide();
                //     }
                // }
            }
        });

        // dragSurface is intentionally NOT added to treeGroup so it stays static during transitions
    }

    /** Measures the total extent of the node tree in local space to drive constraints. */
    function _calculateContentBounds() {
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;

        for (const def of NODE_DEFS) {
            // Nodes are positioned at (treeX + offset) in the group
            const lx = def.treeX + TREE_X_OFFSET;
            const ly = def.treeY;

            minX = Math.min(minX, lx - NODE_SIZE_PADDING);
            maxX = Math.max(maxX, lx + NODE_SIZE_PADDING);
            minY = Math.min(minY, ly - NODE_SIZE_PADDING);
            maxY = Math.max(maxY, ly + NODE_SIZE_PADDING);
        }

        contentBounds = {
            minX: minX - 700, // Increased by 300px (was -400)
            maxX: maxX + 300, // Increased by 300px
            minY: minY - 400,
            maxY: maxY
        };
    }

    /** 
     * Scale-aware constraint engine. Pans between edges if zoomed in, centers if zoomed out. 
     * Accepts custom viewport dimensions to support future window-resizing features.
     */
    function _applyConstraints(viewportW = PANEL_W, viewportH = GAME_CONSTANTS.HEIGHT) {
        if (!draggableGroup) return;

        const scale = draggableGroup.getScale();

        const contentW = (contentBounds.maxX - contentBounds.minX) * scale;
        const contentH = (contentBounds.maxY - contentBounds.minY) * scale;

        // --- Horizontal Constraints ---
        if (contentW <= viewportW) {
            const centerLocal = (contentBounds.minX + contentBounds.maxX) / 2;
            draggableGroup.x = (viewportW / 2) - (centerLocal * scale);
        } else {
            const leftLimit = -(contentBounds.minX * scale);
            const rightLimit = viewportW - (contentBounds.maxX * scale);
            draggableGroup.x = Phaser.Math.Clamp(draggableGroup.x, rightLimit, leftLimit);
        }

        // --- Vertical Constraints ---
        if (contentH <= viewportH) {
            const centerLocal = (contentBounds.minY + contentBounds.maxY) / 2;
            draggableGroup.y = (viewportH / 2) - (centerLocal * scale);
        } else {
            const topLimit = -(contentBounds.minY * scale);
            const bottomLimit = viewportH - (contentBounds.maxY * scale);
            draggableGroup.y = Phaser.Math.Clamp(draggableGroup.y, bottomLimit, topLimit);
        }
    }

    function _createNodes() {
        for (let i = 0; i < NODE_DEFS.length; i++) {
            const def = NODE_DEFS[i];
            const node = def.isDuoBox ? new DuoNode(def) : new Node(def);
            nodes[def.id] = node;
            node.create(TREE_X_OFFSET, 0); // offset handled by treeX/treeY in defs

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
        // Refresh every node in the tree. refreshState() is recursive, which handles
        // downstream propagation, but iterating through all nodes ensures that isolated 
        // branches or nodes with custom revelation logic are always caught.
        for (const id in nodes) {
            nodes[id].setVisible(true);
            nodes[id].refreshState();
        }
    }

    function _revealChildren(parentId) {
        const parent = nodes[parentId];
        if (!parent) return;
        for (let i = 0; i < parent.childIds.length; i++) {
            const childId = parent.childIds[i];
            const child = nodes[childId];
            if (child) {
                const oldState = child.state;
                child.refreshState();

                if (oldState === NODE_STATE.GHOST && child.state === NODE_STATE.UNLOCKED) {
                    treeLineManager.shakeLine(parentId, childId);
                }
            }
        }
        // Redraw lines to reflect new child states
        treeLineManager.updateLines();
    }

    function _createDeployButton() {
        deployBtn = new Button({
            normal: {
                ref: helper.isMobileDevice() ? 'button_c_normal_mobile.png' : 'button_c_normal.png',
                atlas: 'buttons',
                x: PANEL_W - 108 + TREE_X_OFFSET,
                y: GAME_CONSTANTS.HEIGHT - 52.5,
            },
            hover: {
                ref: 'button_c_hover.png',
                atlas: 'buttons',
            },
            press: {
                ref: 'button_c_press.png',
                atlas: 'buttons',
            },
            onMouseUp: _onDeployClicked,
            onHover: () => {
                let sfx = audio.play('click', 0.95);
                if (sfx) sfx.detune = Phaser.Math.Between(-50, 50);
                setHoverLabel("BEGIN WAVE");
            },
            onHoverOut: () => { setHoverLabel(null); }
        });
        deployBtn.setScale(0.675);
        deployBtn.addText(t('ui', 'deploy'), {
            fontFamily: 'JetBrainsMono_Bold',
            fontSize: '28px',
            color: '#ffffff',
        });
        deployBtn.setDepth(GAME_CONSTANTS.DEPTH_UPGRADE_TREE + 16);
        deployBtn.setScrollFactor(0);
        // Hidden until tower is spawned
        deployBtn.setVisible(false);
        deployBtn.setState(DISABLE);
        deployBtnInitialX = deployBtn.x;
        // Virtual group handles tracking positions relative to master
        treeGroup.add(deployBtn);

        // Cursor Coordinate display (Requirement §N.2)
        coordText = PhaserScene.add.text(GAME_CONSTANTS.halfWidth + 26, GAME_CONSTANTS.HEIGHT - 24, 'TEST', {
            fontFamily: 'JetBrainsMono_Bold',
            fontSize: '24px',
            color: '#aaaaaa',
            align: 'left',
            lineSpacing: 2
        }).setOrigin(0, 1).setDepth(GAME_CONSTANTS.DEPTH_UPGRADE_TREE + 4).setScrollFactor(0).setVisible(false);
        treeGroup.add(coordText);

        // Initial flicker reveal reveal
        revealCoordText();
    }

    function _createCoinMineButton() {
        coinMineBtn = new Button({
            normal: {
                ref: 'button_normal.png',
                atlas: 'buttons',
                x: TREE_CENTER_X + 220, // Beside the 'UPGRADE TREE' text
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
                if (typeof coinMine !== 'undefined') {
                    coinMine.show();
                }
            },
        });
        coinMineBtn.setScale(helper.isMobileDevice() ? 1.0 : 0.9);
        coinMineBtn.addText(t('ui', 'mine'), {
            fontFamily: 'JetBrainsMono_Bold',
            fontSize: '21px',
            color: '#ff9500',
        });
        coinMineBtn.setDepth(GAME_CONSTANTS.DEPTH_UPGRADE_TREE + 25);
        coinMineBtn.setScrollFactor(0);

        coinMineBtn.setVisible(false);
        coinMineBtn.setState(DISABLE);

        treeGroup.add(coinMineBtn);
    }

    function _createSlideButton() {
        const cx = GAME_CONSTANTS.halfWidth;
        const cy = GAME_CONSTANTS.halfHeight;

        slideRightBtn = new Button({
            normal: { ref: 'slide_right_btn.png', atlas: 'buttons', x: cx + 5, y: cy, alpha: 1 },
            hover: { ref: 'slide_right_btn_hover.png', atlas: 'buttons' },
            press: { ref: 'slide_right_btn_press.png', atlas: 'buttons' },
            disable: { ref: 'slide_right_btn_press.png', atlas: 'buttons', alpha: 0 },
            onMouseUp: () => _onSlideRightClicked(),
            onHover: () => {
                let sfx = audio.play('click', 0.85);
                if (sfx) sfx.detune = Phaser.Math.Between(-100, 100);
            },
            onHoverOut: () => { }
        });

        slideRightBtn.setDepth(GAME_CONSTANTS.DEPTH_UPGRADE_TREE + 25);
        slideRightBtn.setScrollFactor(0);
        slideRightBtn.setState(DISABLE);
        slideRightBtn.setOrigin(0, 0.5);
        treeGroup.add(slideRightBtn);

        slideLeftBtn = new Button({
            normal: { ref: 'slide_left_btn.png', atlas: 'buttons', x: cx - 23, y: cy, alpha: 1 },
            hover: { ref: 'slide_left_btn_hover.png', atlas: 'buttons' },
            press: { ref: 'slide_left_btn_press.png', atlas: 'buttons' },
            disable: { ref: 'slide_left_btn_press.png', atlas: 'buttons', alpha: 0 },
            onMouseUp: () => _onSlideLeftClicked(),
            onHover: () => {
                let sfx = audio.play('click', 0.85);
                if (sfx) sfx.detune = Phaser.Math.Between(-100, 100);
            },
            onHoverOut: () => { }
        });

        slideLeftBtn.setDepth(GAME_CONSTANTS.DEPTH_UPGRADE_TREE + 25);
        slideLeftBtn.setScrollFactor(0);
        slideLeftBtn.setState(DISABLE);
        slideLeftBtn.setOrigin(1, 0.5);
        treeGroup.add(slideLeftBtn);
    }

    function _onSlideRightClicked(customDuration = SLIDE_DURATION) {
        if (typeof cameraManager === 'undefined' || !slideRightBtn) return;

        // If called as a callback, customDuration might be a Pointer object.
        // Force fallback to SLIDE_DURATION if it's not a number.
        if (typeof customDuration !== 'number') customDuration = SLIDE_DURATION;

        fullUpgradeView = true;
        slideRightBtn.setState(DISABLE);
        const targetX = GAME_CONSTANTS.WIDTH * 0.5;
        const targetXHalf = GAME_CONSTANTS.WIDTH * 0.25;

        helper.createGlobalClickBlocker(false);
        cameraManager.slideTo(-GAME_CONSTANTS.WIDTH * 0.75, customDuration, 'Cubic.easeOut');

        if (typeof gameHUD !== 'undefined') {
            gameHUD.setTestButtonVisible(false);
            gameHUD.setBombButtonVisible(false);
            gameHUD.setHealthBtnVisible(false);
        }
        if (typeof towerStatsUI !== 'undefined') {
            towerStatsUI.setEnabled(false);
        }

        if (treeGroup) {
            treeGroup.tweenTo(targetX, 0, {
                duration: customDuration,
                ease: 'Cubic.easeOut',
                onComplete: () => {
                    _updateNodesHitArea(GAME_CONSTANTS.WIDTH);
                    if (typeof gameHUD !== 'undefined') gameHUD.setCurrencyHUDShifted(true);
                }
            });

            // Enable navigation button slightly before tween ends for better feel
            PhaserScene.time.delayedCall(customDuration - SLIDE_DURATION * 0.3, () => {
                helper.hideGlobalClickBlocker();
                if (slideLeftBtn) slideLeftBtn.setState(NORMAL);
            });
        }
        if (treeNodeCamera) {
            PhaserScene.tweens.add({ targets: treeNodeCamera, width: GAME_CONSTANTS.WIDTH, duration: customDuration, ease: 'Cubic.easeOut' });
        }
        if (panelOutline) {
            PhaserScene.tweens.add({ targets: panelOutline, x: -6, width: 1598, duration: customDuration, ease: 'Cubic.easeOut' });
        }
        if (panelOutlineGlitch) {
            PhaserScene.tweens.add({ targets: panelOutlineGlitch, x: -6, width: 1598, duration: customDuration, ease: 'Cubic.easeOut' });
        }
        if (deployBtn) {
            PhaserScene.tweens.add({ targets: deployBtn, x: deployBtnInitialX + 782, duration: customDuration, ease: 'Cubic.easeOut' });
        }
        if (zoomInBtn) {
            PhaserScene.tweens.add({ targets: zoomInBtn, x: 62, duration: customDuration, ease: 'Cubic.easeOut' });
        }
        if (zoomOutBtn) {
            PhaserScene.tweens.add({ targets: zoomOutBtn, x: 62, duration: customDuration, ease: 'Cubic.easeOut' });
        }
        if (debugLogBtn) {
            PhaserScene.tweens.add({ targets: debugLogBtn, x: 62, duration: customDuration, ease: 'Cubic.easeOut' });
        }

        // Expand drag surface to full screen
        if (dragSurface) {
            dragSurface.setX(GAME_CONSTANTS.WIDTH / 2);
            dragSurface.setScale(GAME_CONSTANTS.WIDTH / 2, GAME_CONSTANTS.HEIGHT / 2);
        }
    }

    function _onSlideLeftClicked(customDuration = SLIDE_DURATION) {
        if (typeof cameraManager === 'undefined' || !slideLeftBtn) return;

        // Force fallback to SLIDE_DURATION if it's not a number.
        if (typeof customDuration !== 'number') customDuration = SLIDE_DURATION;
        fullUpgradeView = false;
        slideLeftBtn.setState(DISABLE);
        const targetX = 0;
        const targetXHalf = 0;

        _updateNodesHitArea(GAME_CONSTANTS.halfWidth - 10);
        helper.createGlobalClickBlocker(false);

        cameraManager.slideTo(-GAME_CONSTANTS.WIDTH * 0.25, customDuration, 'Cubic.easeOut');

        if (treeGroup) {
            treeGroup.tweenTo(targetX, 0, {
                duration: customDuration,
                ease: 'Cubic.easeOut',
                onComplete: () => {
                    // Restore HUD buttons only after transition completes
                    if (typeof gameHUD !== 'undefined') {
                        gameHUD.setTestButtonVisible(true);
                        gameHUD.setBombButtonVisible(true);
                        gameHUD.setHealthBtnVisible(true);
                        gameHUD.setCurrencyHUDShifted(false);
                    }
                    if (typeof towerStatsUI !== 'undefined') {
                        towerStatsUI.setEnabled(true);
                    }
                }
            });

            // Enable navigation button slightly before tween ends for better feel
            PhaserScene.time.delayedCall(customDuration - SLIDE_DURATION * 0.3, () => {
                helper.hideGlobalClickBlocker();
                if (slideRightBtn) slideRightBtn.setState(NORMAL);
            });
        }
        if (treeNodeCamera) {
            PhaserScene.tweens.add({ targets: treeNodeCamera, width: PANEL_W, duration: customDuration, ease: 'Cubic.easeOut' });
        }
        if (panelOutline) {
            PhaserScene.tweens.add({ targets: panelOutline, x: -6, width: 816, duration: customDuration, ease: 'Cubic.easeOut' });
        }
        if (panelOutlineGlitch) {
            PhaserScene.tweens.add({ targets: panelOutlineGlitch, x: -6, width: 816, duration: customDuration, ease: 'Cubic.easeOut' });
        }
        if (deployBtn) {
            PhaserScene.tweens.add({ targets: deployBtn, x: deployBtnInitialX, duration: customDuration, ease: 'Cubic.easeOut' });
        }
        if (zoomInBtn) {
            PhaserScene.tweens.add({ targets: zoomInBtn, x: 62, duration: customDuration, ease: 'Cubic.easeOut' });
        }
        if (zoomOutBtn) {
            PhaserScene.tweens.add({ targets: zoomOutBtn, x: 62, duration: customDuration, ease: 'Cubic.easeOut' });
        }
        if (debugLogBtn) {
            PhaserScene.tweens.add({ targets: debugLogBtn, x: 62, duration: customDuration, ease: 'Cubic.easeOut' });
        }

        // Retract drag surface to left panel
        if (dragSurface) {
            dragSurface.setX(TREE_CENTER_X);
            dragSurface.setScale(PANEL_W / 2, GAME_CONSTANTS.HEIGHT / 2);
        }
    }

    /** Helper to update the hit area of all nodes to support full-screen expansion */
    function _updateNodesHitArea(width) {
        for (const id in nodes) {
            const node = nodes[id];
            if (node && node.btn) {
                node.btn.setHitArea(0, 0, width, GAME_CONSTANTS.HEIGHT);
            }
        }
    }

    function _initPools() {
        const resetFn = (p) => {
            p.setVisible(false);
            p.setActive(false);
        };

        buyPulsePool = new ObjectPool(() => {
            // 9-slice: x, y, atlas, frame, width, height, left, right, top, bottom
            const slice = PhaserScene.add.nineslice(0, 0, 'buttons', 'buy_pulse.png', 80, 80, 25, 25, 25, 25);
            slice.setDepth(GAME_CONSTANTS.DEPTH_UPGRADE_TREE + 3); // behind node button (2.0)
            slice.setScrollFactor(0);
            draggableGroup.add(slice);
            return slice;
        }, resetFn, 10).preAllocate(4);

        maxPulsePool = new ObjectPool(() => {
            const slice = PhaserScene.add.nineslice(0, 0, 'buttons', 'max_pulse.png', 80, 80, 25, 25, 25, 25);
            slice.setDepth(GAME_CONSTANTS.DEPTH_UPGRADE_TREE + 3);
            slice.setScrollFactor(0);
            draggableGroup.add(slice);
            return slice;
        }, resetFn, 10).preAllocate(4);

        insightMaxPulsePool = new ObjectPool(() => {
            const img = PhaserScene.add.image(0, 0, 'buttons', 'insight_max_pulse.png');
            img.setDepth(GAME_CONSTANTS.DEPTH_UPGRADE_TREE + 3);
            img.setScrollFactor(0);
            draggableGroup.add(img);
            return img;
        }, resetFn, 10).preAllocate(2);

        insightBuyPulsePool = new ObjectPool(() => {
            const img = PhaserScene.add.image(0, 0, 'buttons', 'insight_buy_pulse.png');
            img.setDepth(GAME_CONSTANTS.DEPTH_UPGRADE_TREE + 3);
            img.setScrollFactor(0);
            draggableGroup.add(img);
            return img;
        }, resetFn, 10).preAllocate(4);
    }

    function playPurchasePulse(x, y, isMaxed, isInsight = false) {
        if (!buyPulsePool || !maxPulsePool) return;

        const dur = isMaxed ? 750 : 600;
        const startAlpha = isMaxed ? 1.3 : 1;

        if (isInsight && isMaxed) {
            if (!insightMaxPulsePool) return;
            // Native image size assumed to be around 128x128
            _animatePulseScale(x, y, insightMaxPulsePool, 1.0, 2.5, dur, startAlpha);
            _animatePulseScale(x, y, insightMaxPulsePool, 1.0, 2.0, dur + 50, startAlpha - 0.35, 70);
        } else if (isInsight && !isMaxed) {
            if (!insightBuyPulsePool) return;
            // Scaling proportionally matching the 64 -> 98 transition of the nine-slice (~1.53x)
            _animatePulseScale(x, y, insightBuyPulsePool, 1.0, 1.7, dur, startAlpha);
        } else {
            // Primary pulse
            _animatePulse(x, y, isMaxed ? maxPulsePool : buyPulsePool, 64, isMaxed ? 156 : 98, dur, startAlpha);

            // Secondary inner pulse (Max only)
            if (isMaxed) {
                _animatePulse(x, y, maxPulsePool, 64, 130, dur + 50, startAlpha - 0.35, 70);
            }
        }
    }

    function _startHintTimer() {
        if (hintPulseTimer) return;

        const check = () => {
            if (!visible) return;
            const shardCount = resourceManager.getShards();
            if (shardCount <= 0) return;

            // Group duo nodes by tier
            const duoTiers = {}; // tier -> [nodeA, nodeB]
            for (const id in nodes) {
                const n = nodes[id];
                if (n.isDuoBox && n.duoBoxTier > 0) {
                    if (!duoTiers[n.duoBoxTier]) duoTiers[n.duoBoxTier] = [];
                    duoTiers[n.duoBoxTier].push(n);
                }
            }

            for (const tier in duoTiers) {
                const purchased = !!(gameState.duoBoxPurchased && gameState.duoBoxPurchased[tier]);
                if (purchased) continue;

                const pair = duoTiers[tier];
                if (pair.length < 2) continue;

                const nA = pair[0];
                const nB = pair[1];

                if (nA.isRequirementsMet() || nB.isRequirementsMet()) {
                    _playDuoHintPulse(nA, nB);
                }
            }
        };

        // Check every 3 seconds to match the 3-second hint pulse animation cycle
        hintPulseTimer = PhaserScene.time.addEvent({
            delay: 3000,
            callback: check,
            loop: true
        });
    }

    function _stopHintTimer() {
        if (hintPulseTimer) {
            hintPulseTimer.remove();
            hintPulseTimer = null;
        }
    }

    function _startAwakenHint() {
        if (awakenHintTimer) return;

        const check = () => {
            const level = (gameState.upgrades && gameState.upgrades.awaken) || 0;
            if (level > 0 || !visible) {
                _stopAwakenHint();
                return;
            }

            const awakenNode = nodes['awaken'];
            if (!awakenNode) return;

            const scale = draggableGroup.getScale() || 1;
            const ax = (awakenNode.treeX + TREE_X_OFFSET - 1) * scale + draggableGroup.x;
            const ay = (awakenNode.treeY + 1) * scale + draggableGroup.y;

            // Trigger animations
            const ind = helper.ninesliceIndicator(ax, ay, 'buttons', 'indicator_pulse_thin.png', 130, 130, 56, 56, 16);
            ind.setDepth(GAME_CONSTANTS.DEPTH_UPGRADE_TREE + 10);
            ind.setScale(scale);
            draggableGroup.add(ind);

            const indShort = helper.ninesliceIndicatorShort(ax, ay, 'buttons', 'indicator_pulse.png', 160, 160, 58, 58, 16);
            indShort.setDepth(GAME_CONSTANTS.DEPTH_UPGRADE_TREE + 10);
            indShort.setScale(scale);
            draggableGroup.add(indShort);

            // Cycle: 3s animation + 2s delay = 5000ms
            awakenHintTimer = PhaserScene.time.delayedCall(5500, check);
        };

        check();
    }

    function _stopAwakenHint() {
        if (awakenHintTimer) {
            awakenHintTimer.remove();
            awakenHintTimer = null;
        }
    }

    function _playDuoHintPulse(nodeA, nodeB) {
        // Pulse at the center of the duo box
        const scale = draggableGroup.getScale() || 1;
        const localX = (nodeA.treeX + nodeB.treeX) / 2 + TREE_X_OFFSET;
        const localY = (nodeA.treeY + nodeB.treeY) / 2;

        const centerX = draggableGroup.x + localX * scale;
        const centerY = draggableGroup.y + localY * scale;

        const pulse = PhaserScene.add.image(centerX, centerY, 'buttons', 'duo_node_pulse.png');
        pulse.setDepth(GAME_CONSTANTS.DEPTH_UPGRADE_TREE + 10);
        pulse.setScrollFactor(0);
        pulse.setScale(2.1 * scale);
        pulse.setAlpha(0);

        // Only add to draggableGroup (it auto-proxies to mask container)
        draggableGroup.add(pulse);

        PhaserScene.tweens.add({
            targets: pulse,
            scaleX: 1.01 * scale,
            scaleY: 1 * scale,
            alpha: 1,
            duration: 2000,
            ease: 'Cubic.easeIn',
            onComplete: () => {
                PhaserScene.tweens.add({
                    targets: pulse,
                    scaleX: 1.8 * scale,
                    scaleY: 1.8 * scale,
                    duration: 1000,
                    ease: 'Cubic.easeOut',
                    onComplete: () => {
                        treeGroup.removeChild(pulse);
                        draggableGroup.removeChild(pulse);
                        pulse.destroy();
                    }
                });
                PhaserScene.tweens.add({
                    targets: pulse,
                    alpha: 0,
                    duration: 1000,
                    ease: 'Quad.easeOut',
                });
            }
        });

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

    function _animatePulseScale(x, y, pool, startScale, targetScale, duration, alpha, delay = 0) {
        const pulse = pool.get();
        pulse.setPosition(x, y);
        pulse.setVisible(true);
        pulse.setActive(true);
        pulse.setAlpha(alpha);

        pulse.setScale(startScale);

        PhaserScene.tweens.add({
            delay: delay,
            targets: pulse,
            scaleX: targetScale,
            scaleY: targetScale,
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

        // Cinematic background fade-in
        panelBg.setAlpha(0.2);
        PhaserScene.tweens.add({
            targets: panelBg,
            alpha: 1.0,
            duration: 2500,
            ease: 'Back.easeOut'
        });

        if (!hasShownThisSession) {
            hasShownThisSession = true;
        }

        // Start looping hint if not yet awakened
        _startAwakenHint();

        panelOutline.setVisible(true);
        dragSurface.setVisible(true);

        if (zoomInBtn) {
            zoomInBtn.setVisible(true);
            zoomInBtn.setState(NORMAL);
        }
        if (debugLogBtn) {
            debugLogBtn.setVisible(true);
            debugLogBtn.setState(NORMAL);
        }
        if (zoomOutBtn) {
            zoomOutBtn.setVisible(true);
            zoomOutBtn.setState(NORMAL);
        }

        _refreshAllNodes();

        // Show DEPLOY button only if tower has been spawned
        const awakenLevel = (gameState.upgrades && gameState.upgrades.awaken) || 0;
        if (awakenLevel > 0) {
            _showDeployButton();
        }

        const mineLevel = (gameState.upgrades && gameState.upgrades.coin_mine_unlock) || 0;
        if (mineLevel > 0) {
            coinMineBtn.setVisible(true);
            coinMineBtn.setState(NORMAL);
        }

        if (slideRightBtn) {
            slideRightBtn.setState(fullUpgradeView ? DISABLE : NORMAL);
        }
        if (slideLeftBtn) {
            slideLeftBtn.setState(fullUpgradeView ? NORMAL : DISABLE);
        }

        if (typeof gameHUD !== 'undefined') {
            gameHUD.setTestButtonVisible(!fullUpgradeView);
        }

        treeLineManager.updateLines();
    }
    function hide() {
        visible = false;
        panelBg.setVisible(false);
        panelOutline.setVisible(false);
        dragSurface.setVisible(false);
        deployBtn.setVisible(false);
        if (coordText) coordText.setVisible(false);

        _stopAwakenHint();

        deployBtn.setState(DISABLE);

        if (coinMineBtn) {
            coinMineBtn.setVisible(false);
            coinMineBtn.setState(DISABLE);
        }

        if (zoomInBtn) {
            zoomInBtn.setVisible(false);
            zoomInBtn.setState(DISABLE);
        }
        if (debugLogBtn) {
            debugLogBtn.setVisible(false);
            debugLogBtn.setState(DISABLE);
        }
        if (zoomOutBtn) {
            zoomOutBtn.setVisible(false);
            zoomOutBtn.setState(DISABLE);
        }

        for (const id in nodes) {
            nodes[id].setVisible(false);
        }
        if (slideRightBtn) {
            slideRightBtn.setState(DISABLE);
        }
        if (slideLeftBtn) {
            slideLeftBtn.setState(DISABLE);
        }
        treeLineManager.hideLines();
    }

    function preTransitionHide() {
        if (coordText) coordText.setVisible(false);
        if (slideRightBtn) {
            slideRightBtn.setState(DISABLE);
        }
        if (slideLeftBtn) {
            slideLeftBtn.setState(DISABLE);
        }
    }

    /** Shows HUD-fixed elements after transition slide finished */
    function revealCoordText() {
        if (coordText) {
            coordText.setVisible(true);

            const glitchSteps = [
                { delay: 0, alpha: 1 },
                { delay: 200, alpha: 0.7 },
                { delay: 40, alpha: 1 },
                { delay: 100, alpha: 0.5 },
                { delay: 40, alpha: 1 },
                { delay: 300, alpha: 0.5 },
                { delay: 150, alpha: 0.75 },
                { delay: 100, alpha: 1.0 }, // Final lock to 1.0
            ];

            let cumDelay = 0;
            for (const step of glitchSteps) {
                cumDelay += step.delay;
                const { alpha } = step;
                PhaserScene.time.delayedCall(cumDelay, () => {
                    if (coordText) coordText.setAlpha(alpha);
                });
            }
        }
    }



    // ── events ───────────────────────────────────────────────────────────

    function _onPhaseChanged(phase) {
        if (phase === GAME_CONSTANTS.PHASE_UPGRADE) {
            show();
            if (draggableGroup) draggableGroup.activate();
            _startHintTimer();
        } else {
            _stopHintTimer();
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
        _currencyDirty = true;
    }

    function _onUpgradePurchased(data) {
        _refreshAllNodes();
        treeLineManager.updateLines();

        if (data) {
            _stopAwakenHint();
        }
    }

    function _onNodePurchaseFeedback(data) {
        // 1. Audio feedback (Decoupled §5)
        if (data.isLore) {
            audio.play('flip3', 1.6).detune = -100 + Math.random() * 200;
        } else {
            const s = audio.play('upgrade', 1.35);
            if (s) {
                if (data.maxLevel === 1) {
                    s.detune = 200;
                } else {
                    s.detune = (data.level - data.maxLevel) * 100 + 200;
                }
            }
            if (data.isMaxed) {
                audio.play('upgrade_max', 0.45 + Math.random() * 0.07);
            }
        }

        // 2. Floating text popup
        if (data.popupText) {
            const pos = tower.getPosition();
            floatingText.show(
                pos.x + (Math.random() - 0.5) * 100,
                pos.y + (Math.random() - 0.5) * 100,
                data.popupText,
                { fontFamily: 'JetBrainsMono_Bold', color: data.popupColor, fontSize: 24, travel: 70, noScale: true }
            );
        }

        // 3. Purchase pulses
        if (!data.isDuoBox) {
            const nodeInfo = nodes[data.id];
            playPurchasePulse(data.x, data.y + 1, data.isMaxed, nodeInfo && nodeInfo.costType === 'insight');
        } else {
            const node = nodes[data.id];
            if (node && node._playDuoPulse) {
                node._playDuoPulse(1.38);
                // Play a second layered duo pulse
                PhaserScene.time.delayedCall(130, () => {
                    if (node && node._playDuoPulse) {
                        node._playDuoPulse(1.05); // Pass a custom scale multiplier for the second pulse
                    }
                });
            }
        }
    }

    function _createZoomButtons() {
        const x = 62;
        const baseY = GAME_CONSTANTS.HEIGHT - 65;
        const spacing = 62;

        const zoomHelper = (delta) => {
            zoomGoal = Phaser.Math.Clamp(zoomGoal + delta, 0.5, 1.0);
            draggableGroup.tweenScale(zoomGoal, {
                duration: 250,
                ease: 'Cubic.easeOut',
                pivotX: PANEL_W / 2,
                pivotY: GAME_CONSTANTS.halfHeight,
                onUpdate: () => _applyConstraints()
            });
        };

        if (FLAGS.DEBUG) {
            debugLogBtn = new Button({
                normal: { ref: 'increment_dim.png', atlas: 'buttons', x: x, y: baseY - spacing * 2 },
                hover: { ref: 'increment_normal.png', atlas: 'buttons', x: x, y: baseY - spacing * 2 },
                press: { ref: 'increment_dim_press.png', atlas: 'buttons', x: x, y: baseY - spacing * 2 },
                onMouseUp: () => {
                    console.log("%c [DEBUG] Upgrade Tree Node Status: ", "background: #111; color: #ff00ff; border: 1px solid #ff00ff; font-weight: bold;");
                    for (const id in nodes) {
                        const n = nodes[id];
                        const idStr = (n.id || "unknown").padEnd(25);
                        const nameStr = (n.name || "[Placeholder]").padEnd(20);
                        const stateStr = (n.state || "UNKNOWN").padEnd(10);
                        console.log(`Node ID: ${idStr} | Name: ${nameStr} | State: ${stateStr} | Level: ${n.level}/${n.maxLevel}`);
                    }
                }
            });
            debugLogBtn.addText("?", { fontFamily: 'JetBrainsMono_Bold', fontSize: '26px', color: '#ff00ff' });
            debugLogBtn.setDepth(GAME_CONSTANTS.DEPTH_UPGRADE_TREE + 20);
            debugLogBtn.setScrollFactor(0);
            debugLogBtn.setVisible(false);
            treeGroup.add(debugLogBtn);
        }

        const isMobile = helper.isMobileDevice();
        const zoomNormalAsset = isMobile ? 'increment_dim_mobile.png' : 'increment_dim.png';
        const zoomHoverAsset = 'increment_normal.png';
        const zoomPressAsset = 'increment_dim_press.png';

        zoomInBtn = new Button({
            normal: { ref: zoomNormalAsset, atlas: 'buttons', x: x, y: baseY - spacing },
            hover: { ref: zoomHoverAsset, atlas: 'buttons', x: x, y: baseY - spacing },
            press: { ref: zoomPressAsset, atlas: 'buttons', x: x, y: baseY - spacing },
            onMouseUp: () => { zoomHelper(0.25); },
            onHover: () => {
                let sfxclick = audio.play('click', 0.95);
                if (sfxclick) sfxclick.detune = Phaser.Math.Between(0, 100);
                setHoverLabel("ZOOM IN");
            },
            onHoverOut: () => { setHoverLabel(null); }
        });
        let zoomInText = zoomInBtn.addText("+", { fontFamily: 'JetBrainsMono_Bold', fontSize: '34px', color: '#ffffff' });
        zoomInText.offsetX = 1;
        zoomInText.offsetY = -2;
        zoomInBtn.updateTextPosition();

        zoomInBtn.setDepth(GAME_CONSTANTS.DEPTH_UPGRADE_TREE + 20);
        zoomInBtn.setScrollFactor(0);
        zoomInBtn.setVisible(false);
        treeGroup.add(zoomInBtn);

        zoomOutBtn = new Button({
            normal: { ref: zoomNormalAsset, atlas: 'buttons', x: x, y: baseY },
            hover: { ref: zoomHoverAsset, atlas: 'buttons', x: x, y: baseY },
            press: { ref: zoomPressAsset, atlas: 'buttons', x: x, y: baseY },
            onMouseUp: () => { zoomHelper(-0.25); },
            onHover: () => {
                let sfxclick = audio.play('click', 0.95);
                if (sfxclick) sfxclick.detune = Phaser.Math.Between(-100, 0);
                setHoverLabel("ZOOM OUT");
            },
            onHoverOut: () => { setHoverLabel(null); }
        });
        zoomOutBtn.addText("-", { fontFamily: 'JetBrainsMono_Bold', fontSize: '38px', color: '#ffffff' });
        zoomOutBtn.setDepth(GAME_CONSTANTS.DEPTH_UPGRADE_TREE + 20);
        zoomOutBtn.setScrollFactor(0);
        zoomOutBtn.setVisible(false);
        treeGroup.add(zoomOutBtn);
    }

    function _update(delta) {
        if (!visible) return;

        // Throttled currency refresh: once every 10 frames
        if (_currencyDirty) {
            _currencyFrameCount++;
            if (_currencyFrameCount >= 10) {
                _currencyFrameCount = 0;
                _currencyDirty = false;
                _refreshAllNodes();
                treeLineManager.updateLines();
            }
        }

        // Coordinate Update (Requirement §N.2)
        // Optimization: Only update text if mouse moved or label changed to save texture re-generation
        if (coordText && coordText.visible) {
            const mx = Math.floor(GAME_VARS.mouseposx);
            const my = Math.floor(GAME_CONSTANTS.HEIGHT - GAME_VARS.mouseposy);

            if (mx !== lastCoordX || my !== lastCoordY || currentHoverLabel !== lastHoverLabel) {
                coordText.setText(`${currentHoverLabel || " "}\nX: ${mx}\nY: ${my}`);
                lastCoordX = mx;
                lastCoordY = my;
                lastHoverLabel = currentHoverLabel;
            }
        }
    }

    function _onDeployClicked() {
        if (!gameStateMachine.is(GAME_CONSTANTS.PHASE_UPGRADE)) return;

        if (typeof GAME_VARS !== 'undefined' && GAME_VARS.testingDefenses) {
            GAME_VARS.testingDefenses = false;
            if (typeof enemyManager !== 'undefined' && enemyManager.stopTestingDefenses) {
                enemyManager.stopTestingDefenses();
            }
        }

        if (deployBtn.indicator) {
            deployBtn.indicator.setVisible(false);
        }

        // Mark first launch as complete
        gameState.isFirstLaunch = false;

        if (deployBtn.hiTimer) {
            deployBtn.hiTimer.remove();
            deployBtn.hiTimer = null;
        }

        _stopHintTimer();

        // If high level boss defeated, show level selector
        if ((gameState.levelsDefeated || 0) >= 1) {
            treePopups.showLevelSelectPopup();
        } else {
            transitionManager.transitionTo(GAME_CONSTANTS.PHASE_COMBAT);
        }
    }



    // ── public ───────────────────────────────────────────────────────────

    function getNode(id) { return nodes[id] || null; }

    function isVisible() { return visible; }
    function isFullView() { return fullUpgradeView; }

    function _revealChildren(parentId) {
        const parent = nodes[parentId];
        if (!parent) return;
        for (let i = 0; i < parent.childIds.length; i++) {
            const childId = parent.childIds[i];
            const child = nodes[childId];
            if (child) {
                child.refreshState();
            }
        }
    }

    function _showDeployButton() {
        if (deployBtn) {
            if (deployBtn.visible) return;

            deployBtn.setVisible(true);
            deployBtn.setState(NORMAL);

            // Only pulse if the only node purchased is Awaken and player has 0 data
            const upgrades = gameState.upgrades || {};
            const keys = Object.keys(upgrades).filter(k => upgrades[k] > 0);
            const onlyAwaken = keys.length === 1 && keys[0] === 'awaken';
            const hasNoData = resourceManager.getData() <= 0;

            if (onlyAwaken && hasNoData) {
                const bx = PANEL_W - 110 + TREE_X_OFFSET;
                const by = GAME_CONSTANTS.HEIGHT - 57;
                const bw = 344 * 0.6;
                const bh = 120 * 0.6;

                const ind2 = helper.ninesliceIndicatorShort(bx, by, 'buttons', 'button_normal.png', bw + 80, bh + 80, bw, bh, 24);
                ind2.setDepth(GAME_CONSTANTS.DEPTH_UPGRADE_TREE + 16);
                deployBtn.indicator = ind2;
                treeGroup.add(ind2);

                deployBtn.hiTimer = PhaserScene.time.delayedCall(5000, () => {
                    if (deployBtn.indicator) {
                        deployBtn.indicator.destroy();
                    }
                    const ind3 = helper.ninesliceIndicatorShort(bx, by, 'buttons', 'button_normal.png', bw + 80, bh + 80, bw, bh, 24);
                    ind3.setDepth(GAME_CONSTANTS.DEPTH_UPGRADE_TREE + 16);
                    deployBtn.indicator = ind3;
                    treeGroup.add(ind3);
                    deployBtn.hiTimer = null;
                });
            }
        }
    }

    function _showCoinMineButton() {
        if (coinMineBtn) {
            coinMineBtn.setVisible(true);
            coinMineBtn.setState(NORMAL);
        }
    }

    function getGroup() { return treeGroup; }
    function getDraggableGroup() { return draggableGroup; }

    /** Sets the top-line label for the coordinate display. Pass null to reset to " ". */
    function setHoverLabel(label) {
        currentHoverLabel = label || " ";
    }

    function assignToUICamera(gameObject) {
        if (!uiCamera || !gameObject) return;

        // Un-ignore from uiCamera so it gets rendered
        if (gameObject.cameraFilter !== undefined) gameObject.cameraFilter &= ~uiCamera.id;
        if (gameObject.bgSprite && gameObject.bgSprite.cameraFilter !== undefined) gameObject.bgSprite.cameraFilter &= ~uiCamera.id;
        if (gameObject.text && gameObject.text.cameraFilter !== undefined) gameObject.text.cameraFilter &= ~uiCamera.id;

        // Ignore from main camera so it doesn't render twice
        PhaserScene.cameras.main.ignore(gameObject);
        if (gameObject.bgSprite) PhaserScene.cameras.main.ignore(gameObject.bgSprite);
        if (gameObject.text) PhaserScene.cameras.main.ignore(gameObject.text);

        // Also ignore from treeNodeCamera
        if (treeNodeCamera) {
            treeNodeCamera.ignore(gameObject);
            if (gameObject.bgSprite) treeNodeCamera.ignore(gameObject.bgSprite);
            if (gameObject.text) treeNodeCamera.ignore(gameObject.text);
        }

        // Handle Container children recursively
        if (gameObject.list && Array.isArray(gameObject.list)) {
            gameObject.list.forEach(child => assignToUICamera(child));
        }
    }

    /**
     * Apply the tree clipping mask to a game object.
     * Handles both Button instances and standard Phaser GameObjects.
     */
    function _applyTreeMask(gameObject) {
        if (!treeMaskContainer) return;

        // Un-ignore from treeNodeCamera so it gets rendered
        if (treeNodeCamera) {
            if (gameObject.cameraFilter !== undefined) gameObject.cameraFilter &= ~treeNodeCamera.id;
            if (gameObject.bgSprite && gameObject.bgSprite.cameraFilter !== undefined) gameObject.bgSprite.cameraFilter &= ~treeNodeCamera.id;
            if (gameObject.text && gameObject.text.cameraFilter !== undefined) gameObject.text.cameraFilter &= ~treeNodeCamera.id;
        }

        if (gameObject instanceof Button) {
            gameObject.addToContainer(treeMaskContainer);
        } else if (gameObject && typeof gameObject.setMask === 'function') {
            treeMaskContainer.add(gameObject);
        }
    }

    function getTreeMaskContainer() { return treeMaskContainer; }
    function getTreeNodeCamera() { return treeNodeCamera; }
    function getUICamera() { return uiCamera; }

    function setUIAlpha(alpha) {
        if (coordText) coordText.setAlpha(alpha);
        if (zoomInBtn) zoomInBtn.setAlpha(alpha);
        if (zoomOutBtn) zoomOutBtn.setAlpha(alpha);
        if (debugLogBtn) debugLogBtn.setAlpha(alpha);
        if (deployBtn) deployBtn.setAlpha(alpha);
        if (coinMineBtn) coinMineBtn.setAlpha(alpha);
    }

    /**
     * Specialized transition entry for the upgrade tree (Combat -> Upgrade).
     * Tweens elements to their correct positions based on fullUpgradeView state.
     */
    function unlockNode(id) {
        if (!nodes[id]) return false;
        if (!gameState.unlockedNodes) gameState.unlockedNodes = {};
        gameState.unlockedNodes[id] = true;
        nodes[id].refreshState();
        _refreshAllNodes();
        return true;
    }

    function revealNode(id) {
        if (!nodes[id]) return false;
        if (!gameState.revealedNodes) gameState.revealedNodes = {};
        gameState.revealedNodes[id] = true;
        nodes[id].revealedManually = true;
        nodes[id].refreshState();
        _refreshAllNodes();
        return true;
    }

    function onEnterUpgradePhase(duration) {
        let treeTargetX = 0;
        let maskTargetX = 0;
        let maskScaleX = 1;
        let panelW = 816;
        let panelX = -6;
        let deployX = deployBtnInitialX;

        if (fullUpgradeView) {
            treeTargetX = GAME_CONSTANTS.WIDTH * 0.5;
            maskTargetX = GAME_CONSTANTS.WIDTH * 0.25;
            maskScaleX = 1.98;
            panelW = 1598;
            deployX = deployBtnInitialX + 782;
            _updateNodesHitArea(GAME_CONSTANTS.WIDTH);

            if (dragSurface) {
                dragSurface.setX(GAME_CONSTANTS.WIDTH / 2);
                dragSurface.setScale(GAME_CONSTANTS.WIDTH / 2, GAME_CONSTANTS.HEIGHT / 2);
            }
        } else {
            _updateNodesHitArea(GAME_CONSTANTS.halfWidth - 10);

            if (dragSurface) {
                dragSurface.setX(TREE_CENTER_X);
                dragSurface.setScale(PANEL_W / 2, GAME_CONSTANTS.HEIGHT / 2);
            }
        }

        if (treeGroup) {
            treeGroup.tweenTo(treeTargetX, 0, { duration, ease: 'Cubic.easeOut' });
        }

        if (treeMaskContainer) {
            PhaserScene.tweens.add({ targets: treeMaskContainer, x: maskTargetX, duration, ease: 'Cubic.easeOut' });
        }
        if (treeNodeCamera) {
            const camTargetW = fullUpgradeView ? GAME_CONSTANTS.WIDTH : PANEL_W;
            PhaserScene.tweens.add({ targets: treeNodeCamera, width: camTargetW, duration, ease: 'Cubic.easeOut' });
        }

        if (panelOutline) {
            PhaserScene.tweens.add({ targets: panelOutline, x: panelX, width: panelW, duration, ease: 'Cubic.easeOut' });
        }
        if (panelOutlineGlitch) {
            PhaserScene.tweens.add({ targets: panelOutlineGlitch, x: panelX, width: panelW, duration, ease: 'Cubic.easeOut' });
        }
        if (deployBtn) {
            PhaserScene.tweens.add({ targets: deployBtn, x: deployX, duration, ease: 'Cubic.easeOut' });
        }

        // Zoom buttons and Debug button
        if (zoomInBtn) PhaserScene.tweens.add({ targets: zoomInBtn, x: 62, duration, ease: 'Cubic.easeOut' });
        if (zoomOutBtn) PhaserScene.tweens.add({ targets: zoomOutBtn, x: 62, duration, ease: 'Cubic.easeOut' });
        if (debugLogBtn) PhaserScene.tweens.add({ targets: debugLogBtn, x: 62, duration, ease: 'Cubic.easeOut' });
    }

    /** Specialized transition exit for the upgrade tree (Upgrade -> Combat) */
    function onExitUpgradePhase(duration) {
        const treeGroupTargetX = -GAME_CONSTANTS.halfWidth - 20;
        let baseTargetX = treeGroupTargetX;
        if (fullUpgradeView) {
            baseTargetX -= 782;
        }

        if (treeGroup) {
            treeGroup.tweenTo(treeGroupTargetX, 0, { duration, ease: 'Cubic.easeOut' });
        }

        if (treeMaskContainer) {
            PhaserScene.tweens.add({ targets: treeMaskContainer, x: treeGroupTargetX, duration, ease: 'Cubic.easeOut' });
        }
        if (treeNodeCamera) {
            PhaserScene.tweens.add({ targets: treeNodeCamera, width: PANEL_W, duration, ease: 'Cubic.easeOut' });
        }

        if (panelOutline) {
            PhaserScene.tweens.add({ targets: panelOutline, x: baseTargetX, duration, ease: 'Cubic.easeOut' });
        }
        if (panelOutlineGlitch) {
            PhaserScene.tweens.add({ targets: panelOutlineGlitch, x: baseTargetX, duration, ease: 'Cubic.easeOut' });
        }

        if (deployBtn) {
            let btnTargetX = -114;
            PhaserScene.tweens.add({ targets: deployBtn, x: btnTargetX, duration, ease: 'Cubic.easeOut' });
        }

        const buttonOffscreenX = -GAME_CONSTANTS.WIDTH - 4;
        if (zoomInBtn) PhaserScene.tweens.add({ targets: zoomInBtn, x: buttonOffscreenX, duration, ease: 'Cubic.easeOut' });
        if (zoomOutBtn) PhaserScene.tweens.add({ targets: zoomOutBtn, x: buttonOffscreenX, duration, ease: 'Cubic.easeOut' });
        if (debugLogBtn) PhaserScene.tweens.add({ targets: debugLogBtn, x: buttonOffscreenX, duration, ease: 'Cubic.easeOut' });
    }

    return { init, show, hide, getNode, unlockNode, revealNode, isVisible, isFullView, onEnterUpgradePhase, onExitUpgradePhase, _revealChildren, _refreshAllNodes, _showDeployButton, _showCoinMineButton, _onSlideRightClicked, _onSlideLeftClicked, SLIDE_DURATION, playPurchasePulse, getGroup, getDraggableGroup, getTreeNodeCamera, getUICamera, getTreeMaskContainer, setHoverLabel, preTransitionHide, revealCoordText, setUIAlpha, assignToUICamera };
})();
