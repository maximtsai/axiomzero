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
    let hintPulseTimer = null;

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
        _createCryptoMineButton();
        _initPools();

        if (FLAGS.DEBUG) {
            _checkNodeIntegrity();
        }

        messageBus.subscribe('phaseChanged', _onPhaseChanged);
        messageBus.subscribe('towerSpawned', _onTowerSpawned);
        messageBus.subscribe('currencyChanged', _onCurrencyChanged);
        messageBus.subscribe('upgradePurchased', _onUpgradePurchased);
        messageBus.subscribe('node_purchase_feedback', _onNodePurchaseFeedback);

        PhaserScene.events.on('postupdate', _updateBackgroundCrop);
    }

    /**
     * Debug-only check to ensure all parent-child relationships in nodeDefs.js match.
     * Logs warnings for missing references or one-way connections.
     */
    function _checkNodeIntegrity() {
        console.log("%c [DEBUG] Neural Tree integrity check starting... ", "background: #111; color: #00f5ff; border: 1px solid #00f5ff;");
        let warnings = 0;

        for (const def of NODE_DEFS) {
            const id = def.id;

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
            console.log("%c [DEBUG] Neural Tree integrity check: PASS ", "color: #00ff66;");
        } else {
            console.warn(`[DEBUG] Neural Tree integrity check: FAIL (${warnings} warnings). Check console above.`);
        }
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
        // Using a Phaser Image instead of the Button system to avoid click consumption issues
        dragSurface = PhaserScene.add.image(TREE_CENTER_X, GAME_CONSTANTS.halfHeight, 'white_pixel');
        dragSurface.setScale(PANEL_W / 2, GAME_CONSTANTS.HEIGHT / 2);
        dragSurface.setAlpha(0.001);
        dragSurface.setDepth(GAME_CONSTANTS.DEPTH_NEURAL_TREE + 0.1);
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
        }).setOrigin(0.5, 0).setDepth(GAME_CONSTANTS.DEPTH_NEURAL_TREE + 20).setScrollFactor(0).setVisible(false);
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
        });
        deployBtn.setScale(helper.isMobileDevice() ? 0.95 : 0.9, helper.isMobileDevice() ? 1.0 : 0.9);
        deployBtn.addText(t('ui', 'deploy'), {
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
        cryptoMineBtn.addText(t('ui', 'mine'), {
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

        // Check every 4 seconds
        hintPulseTimer = PhaserScene.time.addEvent({
            delay: 4000,
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
        pulse.setDepth(GAME_CONSTANTS.DEPTH_NEURAL_TREE + 10);
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
                const awakenNode = nodes['awaken'];
                const awakenX = (awakenNode ? awakenNode.treeX : 400) + TREE_X_OFFSET;
                const awakenY = (awakenNode ? awakenNode.treeY : 730);
                const ind = helper.ninesliceIndicator(awakenX, awakenY, 'buttons', 'indicator_pulse_thin.png', 120, 120, 46, 46, 16);
                ind.setDepth(GAME_CONSTANTS.DEPTH_NEURAL_TREE + 10);
                const indShort = helper.ninesliceIndicatorShort(awakenX, awakenY, 'buttons', 'indicator_pulse.png', 150, 150, 48, 48, 16);
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

        const line = PhaserScene.add.image(px + TREE_X_OFFSET, py, 'pixels', 'white_pixel.png');
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

            // Determine visibility: Hide if either p or n is HIDDEN.
            // SPECIAL CASE: Duo node children/lines show if Duo parent is purchased (level > 0)
            let shouldHide = (p.state === NODE_STATE.HIDDEN || n.state === NODE_STATE.HIDDEN);
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
                { fontFamily: 'JetBrainsMono_Bold', color: data.popupColor, fontSize: 24 }
            );
        }

        // 3. Purchase pulses
        playPurchasePulse(data.x, data.y + 1, data.isMaxed);

        if (data.isDuoBox) {
            const node = nodes[data.id];
            if (node && node._playDuoPulse) node._playDuoPulse();
        }
    }

    function _onDeployClicked() {
        if (!gameStateMachine.is(GAME_CONSTANTS.PHASE_UPGRADE)) return;

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
            if (deployBtn.visible) return;

            deployBtn.setVisible(true);
            deployBtn.setState(NORMAL);

            // Only pulse if the only node purchased is Awaken
            const upgrades = gameState.upgrades || {};
            const keys = Object.keys(upgrades).filter(k => upgrades[k] > 0);
            const onlyAwaken = keys.length === 1 && keys[0] === 'awaken';

            if (onlyAwaken) {
                const bx = PANEL_W - 110 + TREE_X_OFFSET;
                const by = GAME_CONSTANTS.HEIGHT - 57;
                const bw = 344 * 0.6;
                const bh = 120 * 0.6;

                const ind2 = helper.ninesliceIndicatorShort(bx, by, 'buttons', 'button_normal.png', bw + 80, bh + 80, bw, bh, 24);
                ind2.setDepth(GAME_CONSTANTS.DEPTH_NEURAL_TREE + 10);
                deployBtn.indicator = ind2;

                deployBtn.hiTimer = PhaserScene.time.delayedCall(5000, () => {
                    if (deployBtn.indicator) {
                        deployBtn.indicator.destroy();
                    }
                    const ind3 = helper.ninesliceIndicatorShort(bx, by, 'buttons', 'button_normal.png', bw + 80, bh + 80, bw, bh, 24);
                    ind3.setDepth(GAME_CONSTANTS.DEPTH_NEURAL_TREE + 10);
                    deployBtn.indicator = ind3;
                    deployBtn.hiTimer = null;
                });
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
