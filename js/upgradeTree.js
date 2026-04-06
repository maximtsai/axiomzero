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
    let titleText = null;
    let deployBtn = null;
    let coinMineBtn = null;
    let lines = [];  // Phaser Graphics lines connecting parent → child
    let treeGroup = null;
    let draggableGroup = null;
    let coordText = null;
    let currentHoverLabel = " ";

    let buyPulsePool = null;
    let maxPulsePool = null;

    let zoomInBtn = null;
    let zoomOutBtn = null;
    let debugLogBtn = null;
    let zoomGoal = 1.0;


    let lastDragX = 0;
    let lastDragY = 0;

    let visible = false;
    let hasShownThisSession = false;
    let hintPulseTimer = null;

    // Level Selection Popup
    let levelSelectOverlay = null;
    let levelSelectContainer = null;
    let levelSelectButtons = [];
    let selectedLevel = 1;

    // Tree layout constants (within the 800px left-half panel)
    const PANEL_W = GAME_CONSTANTS.halfWidth;
    const TREE_X_OFFSET = 8;
    const TREE_CENTER_X = PANEL_W / 2 + TREE_X_OFFSET;  // 408

    // ── init ─────────────────────────────────────────────────────────────

    function init() {
        treeGroup = createVirtualGroup(PhaserScene, 0, 0);
        draggableGroup = createVirtualGroup(PhaserScene, 0, 0);

        _createPanel();
        _createNodes();
        _createDeployButton();
        _createCoinMineButton();
        _createZoomButtons();
        _initPools();

        if (FLAGS.DEBUG) {
            _checkNodeIntegrity();
        }

        messageBus.subscribe('phaseChanged', _onPhaseChanged);
        messageBus.subscribe('towerSpawned', _onTowerSpawned);
        messageBus.subscribe('currencyChanged', _onCurrencyChanged);
        messageBus.subscribe('upgradePurchased', _onUpgradePurchased);
        messageBus.subscribe('node_purchase_feedback', _onNodePurchaseFeedback);

        updateManager.addFunction(_update);
        PhaserScene.events.on('postupdate', _updateBackgroundCrop);

        // Zoom Input Logic (Scroll Wheel)
        PhaserScene.input.on('wheel', (pointer, gameObjects, deltaX, deltaY, deltaZ) => {
            if (!visible || !draggableGroup) return;

            // Only zoom if pointer is within the upgrade panel bounds (800px left half)
            if (pointer.x > PANEL_W) return;

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

                // No bounds clamping on zoom-out to avoid "snapping" or "stuck" feel, 
                // but let the regular update loop handle positional clamping if needed.
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
        panelBg = PhaserScene.add.image(TREE_CENTER_X, GAME_CONSTANTS.halfHeight - 350, 'backgrounds', 'upgrade_background.png');
        panelBg.setDepth(GAME_CONSTANTS.DEPTH_UPGRADE_TREE);
        panelBg.setScrollFactor(0);
        panelBg.setVisible(false);

        // Add to treeGroup for panel transitions, and draggableGroup for scrolling sync
        treeGroup.add(panelBg);
        draggableGroup.add(panelBg);

        // Static outline frame for the left half
        panelOutline = PhaserScene.add.image(TREE_CENTER_X, GAME_CONSTANTS.halfHeight, 'backgrounds', 'upgrade_outline.png');
        panelOutline.setDepth(GAME_CONSTANTS.DEPTH_UPGRADE_TREE + 15);
        panelOutline.setScrollFactor(0);
        panelOutline.setVisible(false);
        treeGroup.add(panelOutline);

        // Second copy of the outline frame for a glitch effect
        panelOutlineGlitch = PhaserScene.add.image(TREE_CENTER_X, GAME_CONSTANTS.halfHeight, 'backgrounds', 'upgrade_outline.png');
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

        treeGroup.add(dragSurface);

        // Title
        titleText = PhaserScene.add.text(TREE_CENTER_X, 48, t('ui', 'neural_tree'), {
            fontFamily: 'Michroma',
            fontSize: '28px',
            color: '#00f5ff',
            align: 'center',
        }).setOrigin(0.5, 0).setDepth(GAME_CONSTANTS.DEPTH_UPGRADE_TREE + 20).setScrollFactor(0).setVisible(false);
        titleText.setShadow(0, 0, '#00f5ff', 12, true, true);

        treeGroup.add(titleText);
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
            const childId = parent.childIds[i];
            const child = nodes[childId];
            if (child) {
                const oldState = child.state;
                child.refreshState();

                if (oldState === NODE_STATE.GHOST && child.state === NODE_STATE.UNLOCKED) {
                    _shakeLine(parentId, childId);
                }
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
                x: PANEL_W - 110 + TREE_X_OFFSET,
                y: GAME_CONSTANTS.HEIGHT - 57,
            },
            hover: {
                ref: 'button_hover.png',
                atlas: 'buttons',
                x: PANEL_W - 110 + TREE_X_OFFSET,
                y: GAME_CONSTANTS.HEIGHT - 57,
            },
            press: {
                ref: 'button_press.png',
                atlas: 'buttons',
                x: PANEL_W - 110 + TREE_X_OFFSET,
                y: GAME_CONSTANTS.HEIGHT - 57,
            },
            onMouseUp: _onDeployClicked,
            onHover: () => {
                let sfx = audio.play('click', 0.95);
                if (sfx) sfx.detune = Phaser.Math.Between(-50, 50);
                setHoverLabel("BEGIN WAVE");
            },
            onHoverOut: () => { setHoverLabel(null); }
        });
        deployBtn.setScale(helper.isMobileDevice() ? 0.95 : 0.9, helper.isMobileDevice() ? 1.0 : 0.9);
        deployBtn.addText(t('ui', 'deploy'), {
            fontFamily: 'JetBrainsMono_Bold',
            fontSize: '25px',
            color: '#ffffff',
        });
        deployBtn.setDepth(GAME_CONSTANTS.DEPTH_UPGRADE_TREE + 16);
        deployBtn.setScrollFactor(0);
        // Hidden until tower is spawned
        deployBtn.setVisible(false);
        deployBtn.setState(DISABLE);
        // Virtual group handles tracking positions relative to master
        treeGroup.add(deployBtn.getContainer ? deployBtn.getContainer() : deployBtn); // Note: Button doesn't expose container generally, maybe add multiple

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

        treeGroup.add(coinMineBtn.getContainer ? coinMineBtn.getContainer() : coinMineBtn);
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
            treeGroup.add(slice);
            draggableGroup.add(slice);
            return slice;
        }, resetFn, 10).preAllocate(4);

        maxPulsePool = new ObjectPool(() => {
            const slice = PhaserScene.add.nineslice(0, 0, 'buttons', 'max_pulse.png', 80, 80, 25, 25, 25, 25);
            slice.setDepth(GAME_CONSTANTS.DEPTH_UPGRADE_TREE + 3);
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

    function _playDuoHintPulse(nodeA, nodeB) {
        // Pulse at the center of the duo box
        const centerX = (nodeA.treeX + nodeB.treeX) / 2 + TREE_X_OFFSET;
        const centerY = (nodeA.treeY + nodeB.treeY) / 2;

        const pulseYPos = centerY + draggableGroup.y;

        const pulse = PhaserScene.add.image(centerX, pulseYPos, 'buttons', 'duo_node_pulse.png');
        pulse.setDepth(GAME_CONSTANTS.DEPTH_UPGRADE_TREE + 10);
        pulse.setScrollFactor(0);
        pulse.setScale(2.1);
        pulse.setAlpha(0);

        treeGroup.add(pulse);
        draggableGroup.add(pulse);

        PhaserScene.tweens.add({
            targets: pulse,
            scaleX: 1.01,
            scaleY: 1,
            alpha: 1,
            duration: 2000,
            ease: 'Cubic.easeIn',
            onComplete: () => {
                PhaserScene.tweens.add({
                    targets: pulse,
                    scaleX: 1.8,
                    scaleY: 1.8,
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

    // ── show / hide ──────────────────────────────────────────────────────

    function show() {
        visible = true;
        panelBg.setVisible(true);

        // Cinematic background fade-in
        panelBg.setAlpha(0.2);
        PhaserScene.tweens.add({
            targets: panelBg,
            alpha: 0.9,
            duration: 2500,
            ease: 'Back.easeOut'
        });

        if (!hasShownThisSession) {
            hasShownThisSession = true;

            // Hint for new players: pulse indicate the AWAKEN node
            const awakenLevel = (gameState.upgrades && gameState.upgrades.awaken) || 0;
            if (awakenLevel === 0) {
                const awakenNode = nodes['awaken'];
                const awakenX = (awakenNode ? awakenNode.treeX : 400) + TREE_X_OFFSET;
                const awakenY = (awakenNode ? awakenNode.treeY : 730);
                const ind = helper.ninesliceIndicator(awakenX, awakenY, 'buttons', 'indicator_pulse_thin.png', 120, 120, 46, 46, 16);
                ind.setDepth(GAME_CONSTANTS.DEPTH_UPGRADE_TREE + 10);
                const indShort = helper.ninesliceIndicatorShort(awakenX, awakenY, 'buttons', 'indicator_pulse.png', 150, 150, 48, 48, 16);
                indShort.setDepth(GAME_CONSTANTS.DEPTH_UPGRADE_TREE + 10);
                treeGroup.add(ind);
                treeGroup.add(indShort);
            }
        }

        panelOutline.setVisible(true);
        dragSurface.setVisible(true);
        titleText.setVisible(true);

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

        _updateLines();
    }

    function hide() {
        visible = false;
        panelBg.setVisible(false);
        panelOutline.setVisible(false);
        dragSurface.setVisible(false);
        titleText.setVisible(false);
        deployBtn.setVisible(false);
        if (coordText) coordText.setVisible(false);

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
        _hideLines();
    }

    function preTransitionHide() {
        if (coordText) coordText.setVisible(false);
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

    function _createLine(px, py, cx, cy, metadata) {
        const dx = cx - px, dy = cy - py;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx) + 1.57;

        const line = PhaserScene.add.image(px + TREE_X_OFFSET, py, 'pixels', 'white_pixel.png');
        line.setScale(1.5, distance / 2);
        line.setOrigin(0.5, 1);
        line.setRotation(angle);
        line.setDepth(GAME_CONSTANTS.DEPTH_UPGRADE_TREE + 1);
        line.setScrollFactor(0);
        Object.assign(line, metadata);

        lines.push(line);
        treeGroup.add(line);
        draggableGroup.add(line);
        return line;
    }

    function _shakeLine(parentId, childId) {
        // Find line matching parent -> child (or parent -> siblingChild for Duo boxes)
        const line = lines.find(l => l.parentId === parentId && (l.childId === childId || l.duoSiblingChildId === childId));
        if (!line) return;

        const baselineWidth = 1.5;
        line.setScale(baselineWidth * 4, line.scaleY);

        PhaserScene.tweens.add({
            targets: line,
            scaleX: baselineWidth,
            duration: 600,
            ease: 'Quart.easeOut'
        });
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
            // Determine visibility: Hide if either p or n is HIDDEN.
            // SPECIAL CASE: Duo node children/lines show if Duo parent is purchased (level > 0)
            let shouldHide = (p.state === NODE_STATE.HIDDEN || n.state === NODE_STATE.HIDDEN);

            // Hide lines for normal nodes if alpha is 0 (placeholders are always alpha 0)
            if (!p.isPlaceholder && p.getAlpha() === 0) shouldHide = true;
            if (!n.isPlaceholder && n.getAlpha() === 0) shouldHide = true;


            if (shouldHide && n.isDuoDescendant && n.isDuoDescendant()) {
                if (n.isDuoPathPurchased()) {
                    shouldHide = false;
                }
            }

            if (shouldHide) {
                line.setVisible(false);
            } else {
                line.setVisible(true);
                const parentActive = (p.state === NODE_STATE.UNLOCKED || p.state === NODE_STATE.MAXED);
                const isDuoBranch = (n.isDuoDescendant && n.isDuoDescendant());
                const revealedLine = (p.revealed || n.revealed);
                const ghostToActive = (p.state === NODE_STATE.GHOST && (n.state === NODE_STATE.UNLOCKED || n.state === NODE_STATE.MAXED));
                line.setAlpha((parentActive || isDuoBranch || revealedLine || ghostToActive) ? 0.6 : 0); // Slightly more opaque (0.6)
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
        _refreshAllNodes();
        _updateLines();
    }

    function _onUpgradePurchased() {
        _refreshAllNodes();
        _updateLines();
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
            playPurchasePulse(data.x, data.y + 1, data.isMaxed);
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
                pivotY: GAME_CONSTANTS.halfHeight
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

        zoomInBtn = new Button({
            normal: { ref: 'increment_dim.png', atlas: 'buttons', x: x, y: baseY - spacing },
            hover: { ref: 'increment_normal.png', atlas: 'buttons', x: x, y: baseY - spacing },
            press: { ref: 'increment_dim_press.png', atlas: 'buttons', x: x, y: baseY - spacing },
            onMouseUp: () => { zoomHelper(0.25); },
            onHover: () => {
                let sfxclick = audio.play('click', 0.95);
                if (sfxclick) sfxclick.detune = Phaser.Math.Between(0, 100);
                setHoverLabel("ZOOM IN");
            },
            onHoverOut: () => { setHoverLabel(null); }
        });
        zoomInBtn.addText("+", { fontFamily: 'JetBrainsMono_Bold', fontSize: '30px', color: '#ffffff' });
        zoomInBtn.setDepth(GAME_CONSTANTS.DEPTH_UPGRADE_TREE + 20);
        zoomInBtn.setScrollFactor(0);
        zoomInBtn.setVisible(false);
        treeGroup.add(zoomInBtn);

        zoomOutBtn = new Button({
            normal: { ref: 'increment_dim.png', atlas: 'buttons', x: x, y: baseY },
            hover: { ref: 'increment_normal.png', atlas: 'buttons', x: x, y: baseY },
            press: { ref: 'increment_dim_press.png', atlas: 'buttons', x: x, y: baseY },
            onMouseUp: () => { zoomHelper(-0.25); },
            onHover: () => {
                let sfxclick = audio.play('click', 0.95);
                if (sfxclick) sfxclick.detune = Phaser.Math.Between(-100, 0);
                setHoverLabel("ZOOM OUT");
            },
            onHoverOut: () => { setHoverLabel(null); }
        });
        zoomOutBtn.addText("-", { fontFamily: 'JetBrainsMono_Bold', fontSize: '34px', color: '#ffffff' });
        zoomOutBtn.setDepth(GAME_CONSTANTS.DEPTH_UPGRADE_TREE + 20);
        zoomOutBtn.setScrollFactor(0);
        zoomOutBtn.setVisible(false);
        treeGroup.add(zoomOutBtn);
    }

    function _update(delta) {
        if (!visible) return;

        // Coordinate Update (Every frame while visible)
        if (coordText && coordText.visible) {
            const mx = Math.floor(GAME_VARS.mouseposx);
            const my = Math.floor(GAME_CONSTANTS.HEIGHT - GAME_VARS.mouseposy);
            coordText.setText(`${currentHoverLabel}\nX: ${mx}\nY: ${my}`);
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
            _showLevelSelectPopup();
        } else {
            transitionManager.transitionTo(GAME_CONSTANTS.PHASE_COMBAT);
        }
    }

    function _showLevelSelectPopup() {
        audio.play('retro1', 1.0);
        const cx = GAME_CONSTANTS.halfWidth;
        const cy = GAME_CONSTANTS.halfHeight;
        const depth = GAME_CONSTANTS.DEPTH_POPUPS + 1000;

        // Default to highest unlocked level (highest boss defeated + 1), capped by max config
        const maxLevel = Math.min((gameState.levelsDefeated || 0) + 1, getMaxConfiguredLevel());
        selectedLevel = maxLevel;

        // Black back screen
        levelSelectOverlay = PhaserScene.add.image(cx, cy, 'black_pixel');
        levelSelectOverlay.setDisplaySize(GAME_CONSTANTS.WIDTH, GAME_CONSTANTS.HEIGHT);
        levelSelectOverlay.setAlpha(0.45).setDepth(depth).setScrollFactor(0).setInteractive();

        levelSelectContainer = PhaserScene.add.container(cx, cy).setDepth(depth + 1);
        levelSelectContainer.setScrollFactor(0);

        // Background box
        const bg = PhaserScene.add.nineslice(0, 0, 'ui', 'popup_nineslice.png', 550, 360, 64, 64, 64, 64);
        levelSelectContainer.add(bg);

        // Title
        const title = PhaserScene.add.text(0, -140, t('ui', 'choose_level'), {
            fontFamily: 'JetBrainsMono_Bold',
            fontSize: '34px',
            color: '#00f5ff',
            align: 'center',
        }).setOrigin(0.5).setShadow(2, 2, '#000000', 2, true, true);
        levelSelectContainer.add(title);

        const levelDisplay = PhaserScene.add.text(0, -78, t('ui', 'level') + selectedLevel, {
            fontFamily: 'JetBrainsMono_Bold',
            fontSize: '34px',
            color: GAME_CONSTANTS.COLOR_NEUTRAL,
            align: 'center',
        }).setOrigin(0.5).setShadow(2, 2, '#000000', 2, true, true);
        levelSelectContainer.add(levelDisplay);

        // DATA Bonus text
        const bonusDisplay = PhaserScene.add.text(0, -36, '', {
            fontFamily: 'JetBrainsMono_Bold',
            fontSize: '22px',
            color: '#00f5ff',
            align: 'center',
        }).setOrigin(0.5, 0.75).setShadow(1, 1, '#000000', 1, true, true);
        levelSelectContainer.add(bonusDisplay);

        const updateLevelUI = () => {
            levelDisplay.setText(t('ui', 'level') + selectedLevel);

            // Calculate and show DATA bonus
            const config = LEVEL_CONFIG[selectedLevel] || {};
            const mult = config.dataDropMultiplier || 1.0;
            if (mult > 1.0) {
                const pct = Math.round((mult - 1) * 100);
                bonusDisplay.setText(`+${pct}% DATA`);
                bonusDisplay.setVisible(true);

                // Quick bounce animation for feedback
                PhaserScene.tweens.add({
                    targets: bonusDisplay,
                    scale: { from: 1, to: 1.07 },
                    duration: 100,
                    yoyo: true,
                    ease: 'Cubic.easeOut'
                });
            } else {
                bonusDisplay.setVisible(false);
            }

            // Update button states
            minusBtn.setState(selectedLevel > 1 ? NORMAL : DISABLE);
            plusBtn.setState(selectedLevel < maxLevel ? NORMAL : DISABLE);
        };

        // Minus button
        const minusBtn = new Button({
            normal: { ref: 'increment_normal.png', atlas: 'buttons', x: cx - 35, y: cy + 15 },
            hover: { ref: 'increment_hover.png', atlas: 'buttons', x: cx - 35, y: cy + 15 },
            press: { ref: 'increment_press.png', atlas: 'buttons', x: cx - 35, y: cy + 15 },
            disable: { ref: 'increment_disable.png', atlas: 'buttons', x: cx - 35, y: cy + 15 },
            onMouseUp: () => {
                if (selectedLevel > 1) {
                    selectedLevel--;
                    updateLevelUI();
                }
            }
        });
        minusBtn.addText("-", { fontFamily: 'JetBrainsMono_Bold', fontSize: '48px', color: GAME_CONSTANTS.COLOR_NEUTRAL });
        minusBtn.setDepth(depth + 2);
        minusBtn.setScrollFactor(0);
        levelSelectButtons.push(minusBtn);

        // Plus button
        const plusBtn = new Button({
            normal: { ref: 'increment_normal.png', atlas: 'buttons', x: cx + 35, y: cy + 15 },
            hover: { ref: 'increment_hover.png', atlas: 'buttons', x: cx + 35, y: cy + 15 },
            press: { ref: 'increment_press.png', atlas: 'buttons', x: cx + 35, y: cy + 15 },
            disable: { ref: 'increment_disable.png', atlas: 'buttons', x: cx + 35, y: cy + 15 },
            onMouseUp: () => {
                if (selectedLevel < maxLevel) {
                    selectedLevel++;
                    updateLevelUI();
                }
            }
        });
        plusBtn.addText("+", { fontFamily: 'JetBrainsMono_Bold', fontSize: '48px', color: GAME_CONSTANTS.COLOR_NEUTRAL });
        plusBtn.setDepth(depth + 2);
        plusBtn.setScrollFactor(0);
        levelSelectButtons.push(plusBtn);

        // START Button
        const startBtn = new Button({
            normal: { ref: 'button_normal.png', atlas: 'buttons', x: cx, y: cy + 80 },
            hover: { ref: 'button_hover.png', atlas: 'buttons', x: cx, y: cy + 80 },
            press: { ref: 'button_press.png', atlas: 'buttons', x: cx, y: cy + 80 },
            onMouseUp: () => {
                gameState.currentLevel = selectedLevel;
                _closeLevelSelect();
                transitionManager.transitionTo(GAME_CONSTANTS.PHASE_COMBAT);
            }
        });
        startBtn.addText(t('ui', 'start'), { fontFamily: 'JetBrainsMono_Bold', fontSize: '24px', color: GAME_CONSTANTS.COLOR_NEUTRAL });
        startBtn.setDepth(depth + 2);
        startBtn.setScrollFactor(0);
        levelSelectButtons.push(startBtn);

        // BACK Button
        const backBtn = new Button({
            normal: { ref: 'button_normal.png', atlas: 'buttons', x: cx, y: cy + 140 },
            hover: { ref: 'button_hover.png', atlas: 'buttons', x: cx, y: cy + 140 },
            press: { ref: 'button_press.png', atlas: 'buttons', x: cx, y: cy + 140 },
            onMouseUp: _closeLevelSelect
        });
        backBtn.addText(t('ui', 'back'), { fontFamily: 'JetBrainsMono_Bold', fontSize: '22px', color: '#aaaaaa' });
        backBtn.setDepth(depth + 2);
        backBtn.setScrollFactor(0);
        levelSelectButtons.push(backBtn);

        updateLevelUI();
    }

    function _closeLevelSelect() {
        if (levelSelectOverlay) {
            levelSelectOverlay.destroy();
            levelSelectOverlay = null;
        }
        if (levelSelectContainer) {
            levelSelectContainer.destroy();
            levelSelectContainer = null;
        }
        levelSelectButtons.forEach(b => b.destroy());
        levelSelectButtons = [];
    }

    // ── public ───────────────────────────────────────────────────────────

    function getNode(id) { return nodes[id] || null; }

    function isVisible() { return visible; }

    function _updateBackgroundCrop() {
        if (!panelBg || !visible) return;

        const groupX = treeGroup ? treeGroup.x : 0;
        const groupY = treeGroup ? treeGroup.y : 0;

        const minVisX = groupX;
        const maxVisX = groupX + GAME_CONSTANTS.halfWidth;

        const texW = 1143;
        const texH = 1590;

        const scale = panelBg.scaleX || 1;

        // Bounds of the sprite (taking scale into account)
        const spriteLeft = panelBg.x - (texW * scale) / 2;
        const spriteRight = panelBg.x + (texW * scale) / 2;
        const spriteTop = panelBg.y - (texH * scale) / 2;
        const spriteBottom = panelBg.y + (texH * scale) / 2;

        // Calculate visible portion in Screen Space
        const cropLeft = Math.max(spriteLeft, minVisX);
        const cropRight = Math.min(spriteRight, maxVisX);
        const cropTop = spriteTop;
        const cropBottom = spriteBottom;

        const cropW = cropRight - cropLeft;
        const cropH = cropBottom - cropTop;

        if (cropW <= 0 || cropH <= 0) {
            panelBg.setCrop(0, 0, 0.1, 0.1);
        } else {
            // Convert to Texture Space for Phaser setCrop
            const cropX = (cropLeft - spriteLeft) / scale;
            const cropY = (cropTop - spriteTop) / scale;
            panelBg.setCrop(cropX, cropY, cropW / scale, cropH / scale);
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

                deployBtn.hiTimer = PhaserScene.time.delayedCall(5000, () => {
                    if (deployBtn.indicator) {
                        deployBtn.indicator.destroy();
                    }
                    const ind3 = helper.ninesliceIndicatorShort(bx, by, 'buttons', 'button_normal.png', bw + 80, bh + 80, bw, bh, 24);
                    ind3.setDepth(GAME_CONSTANTS.DEPTH_UPGRADE_TREE + 16);
                    deployBtn.indicator = ind3;
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

    return { init, show, hide, getNode, isVisible, _revealChildren, _refreshAllNodes, _showDeployButton, _showCoinMineButton, playPurchasePulse, getGroup, getDraggableGroup, setHoverLabel, preTransitionHide, revealCoordText };
})();
