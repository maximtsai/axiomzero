/**
 * treeLineManager.js - Handles the visual connections between nodes in the Upgrade Tree.
 * Extracted from upgradeTree.js to improve modularity and maintainability.
 */
const treeLineManager = (() => {
    let lines = [];
    let treeGroupRef = null;
    let draggableGroupRef = null;
    let nodesRef = null;

    // Constant offset used in upgradeTree.js
    const TREE_X_OFFSET = 8;

    /**
     * Initializes the manager with necessary references.
     * @param {Object} config - Configuration mapping.
     */
    function init(config) {
        // CLEANUP: If we are re-initializing, clear old lines to prevent duplicates
        if (lines && lines.length > 0) {
            console.log(`treeLineManager.init: Cleaning up ${lines.length} existing lines.`);
            for (let l of lines) {
                if (l && l.destroy) l.destroy();
            }
            lines = [];
        }

        treeGroupRef = config.treeGroup;
        draggableGroupRef = config.draggableGroup;
        nodesRef = config.nodes;
    }

    /**
     * Helper to get visual X coordinate factoring in Duo node button offsets (22px)
     */
    const getVisualX = (node) => {
        if (!node) return 0;
        if (node.isDuoBox && node.duoSiblingId) {
            const sibling = nodesRef[node.duoSiblingId];
            if (sibling) {
                const boxCenter = (node.treeX + sibling.treeX) / 2;
                const side = node._getDuoSide ? node._getDuoSide() : (node.treeX < sibling.treeX ? 'left' : 'right');
                return boxCenter + (side === 'left' ? -22 : 22);
            }
        }
        return node.treeX;
    };

    /**
     * Creates a single connecting line between two points.
     * @param {number} px - Parent X (Virtual)
     * @param {number} py - Parent Y (Virtual)
     * @param {number} cx - Child X (Virtual)
     * @param {number} cy - Child Y (Virtual)
     * @param {Object} metadata - Additional data for the line sprite.
     * @returns {Phaser.GameObjects.Image} The created line object.
     */
    function createLine(px, py, cx, cy, metadata) {
        const dx = cx - px, dy = cy - py;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);

        // Factor in group state so that VirtualGroup.add captures the correct local offset
        const gx = draggableGroupRef ? draggableGroupRef.x : 0;
        const gy = draggableGroupRef ? draggableGroupRef.y : 0;
        const gs = draggableGroupRef ? draggableGroupRef.getScale() : 1;

        const screenX = (px + TREE_X_OFFSET) * gs + gx;
        const screenY = py * gs + gy;

        const p = nodesRef ? nodesRef[metadata.parentId] : null;
        const n = nodesRef ? nodesRef[metadata.childId] : null;

        // Initial texture choice
        let nMaxed = (n && n.state === NODE_STATE.MAXED);
        if (metadata.isDuoLine && !nMaxed && n && n.duoSiblingId) {
            const sibling = nodesRef[n.duoSiblingId];
            if (sibling && sibling.state === NODE_STATE.MAXED) nMaxed = true;
        }
        const isGold = (p && n && p.state === NODE_STATE.MAXED && nMaxed);
        const tex = isGold ? 'node_line_gold.png' : 'node_line.png';

        const line = PhaserScene.add.image(screenX, screenY, 'buttons', tex);
        // Initial screen scale must factor in current group scale so that VirtualGroup.add() 
        // correctly records the intended "local" base scale.
        // node_line is 100px wide, so scale X by distance/100 and Y by 1.5 for thickness.
        line.setScale((distance / 100) * gs, 1.5 * gs);
        line.setRotation(angle);
        line.setDepth(GAME_CONSTANTS.DEPTH_UPGRADE_TREE + 1);
        line.setScrollFactor(0);

        // Use setData for metadata to prevent collision with Phaser properties
        for (let key in metadata) {
            line.setData(key, metadata[key]);
        }

        // ALWAYS set origin last to ensure it wins against metadata or default frame pivots
        line.setOrigin(0, 0.5);

        lines.push(line);
        if (draggableGroupRef) draggableGroupRef.add(line);
        return line;
    }

    /**
     * Plays a "shaking" effect for a line between a parent and child.
     */
    function shakeLine(parentId, childId) {
        const line = lines.find(l => l.getData('parentId') === parentId && (l.getData('childId') === childId || l.getData('duoSiblingChildId') === childId));
        if (!line) return;

        const baselineThickness = 1.5;
        line.setScale(line.scaleX, baselineThickness * 4);

        PhaserScene.tweens.add({
            targets: line,
            scaleY: baselineThickness,
            duration: 600,
            ease: 'Quart.easeOut'
        });
    }

    /**
     * Updates the visibility and alpha of all lines based on node states.
     * Creates lines if they haven't been generated yet or if new nodes were added.
     */
    function updateLines() {
        if (!nodesRef) return;

        // 1. Ensure all lines exist for current nodes
        const isDuoLineDrawn = {};
        for (const line of lines) {
            if (line.getData('isDuoLine')) {
                const pid = line.getData('parentId');
                const tier = line.getData('duoBoxTier');
                isDuoLineDrawn[tier + '_' + pid] = true;
            }
        }

        for (const id in nodesRef) {
            const n = nodesRef[id];
            if (n.parents && n.parents.length > 0) {
                for (let pid of n.parents) {
                    const p = nodesRef[pid];
                    if (!p) continue;

                    // Check if a line already exists for this connection
                    const lineExists = lines.some(l => l.getData('parentId') === pid && (l.getData('childId') === id || (l.getData('isDuoLine') && l.getData('duoSiblingChildId') === id)));
                    if (lineExists) continue;

                    if (n.isDuoBox && n.duoBoxTier > 0) {
                        const duoKey = n.duoBoxTier + '_' + pid;
                        if (isDuoLineDrawn[duoKey]) continue;
                        isDuoLineDrawn[duoKey] = true;

                        const sibling = n.duoSiblingId ? nodesRef[n.duoSiblingId] : null;
                        const targetX = sibling ? (n.treeX + sibling.treeX) / 2 : n.treeX;
                        const targetY = sibling ? (n.treeY + sibling.treeY) / 2 : n.treeY;

                        createLine(p.treeX, p.treeY, targetX, targetY, {
                            childId: id,
                            duoSiblingChildId: n.duoSiblingId,
                            parentId: pid,
                            duoBoxTier: n.duoBoxTier,
                            isDuoLine: true,
                        });
                    } else {
                        createLine(p.treeX, p.treeY, n.treeX, n.treeY, {
                            childId: id,
                            parentId: pid,
                        });
                    }
                }
            }
        }

        // Logic update: Alpha, visibility, and Position
        const gx = draggableGroupRef ? draggableGroupRef.x : 0;
        const gy = draggableGroupRef ? draggableGroupRef.y : 0;
        const gs = draggableGroupRef ? draggableGroupRef.getScale() : 1;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const pId = line.getData('parentId');
            const cId = line.getData('childId');
            const p = nodesRef[pId];
            const n = nodesRef[cId];

            if (!p || !n) continue;

            const isDuoLine = line.getData('isDuoLine');
            const sibling = isDuoLine && n.duoSiblingId ? nodesRef[n.duoSiblingId] : null;

            // Duo lines (parent -> box) always point to the center of the duo box
            // Normal lines point to the visual center of the button (accounting for duo shift)
            const targetX = sibling ? (n.treeX + sibling.treeX) / 2 : getVisualX(n);
            const targetY = sibling ? (n.treeY + sibling.treeY) / 2 : n.treeY;

            // Start point also needs duo shift if parent is a duo node
            const startX = getVisualX(p);
            const startY = p.treeY;

            const dx = targetX - startX;
            const dy = targetY - startY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const angle = Math.atan2(dy, dx);

            // Update Screen Position
            line.setPosition((startX + TREE_X_OFFSET) * gs + gx, startY * gs + gy);
            line.setRotation(angle);
            line.setScale((distance / 100) * gs, 1.5 * gs);

            // Gold line logic: both parent and child (or its active duo sibling) must be MAXED
            let nMaxed = (n.state === NODE_STATE.MAXED);
            if (isDuoLine && !nMaxed && sibling) {
                if (sibling.state === NODE_STATE.MAXED) nMaxed = true;
            }
            const isGold = (p.state === NODE_STATE.MAXED && nMaxed);

            if (isGold) {
                const screenDist = distance * gs;
                const visualWidth = line.displayWidth;
                // Periodic logging for gold lines
                if (Math.random() < 0.01) {
                    console.log(`Gold Line | Parent: ${pId} (${p.treeX}, ${p.treeY}) | Child: ${cId} (${targetX}, ${targetY}) | Distance: ${distance.toFixed(2)} | Scale: ${line.scaleX.toFixed(4)} | Width: ${visualWidth.toFixed(2)} | Origin: (${line.originX}, ${line.originY})`);
                }

                if (Math.abs(screenDist - visualWidth) > 1.0) {
                    console.warn(`Line Length Mismatch! Calculated Screen Dist: ${screenDist.toFixed(2)}, Actual Width: ${visualWidth.toFixed(2)}`);
                }
            }

            const tex = isGold ? 'node_line_gold.png' : 'node_line.png';
            if (line.frame.name !== tex) {
                line.setFrame(tex, false, false);
            }

            // Safety: Ensure origin is always correct
            if (line.originX !== 0 || line.originY !== 0.5) {
                line.setOrigin(0, 0.5);
            }

            let shouldHide = (p.state === NODE_STATE.HIDDEN || n.state === NODE_STATE.HIDDEN);
            if (p.revealedManually && n.revealedManually) shouldHide = false;

            const parentIsActiveOrManual = (p.state !== NODE_STATE.HIDDEN && (p.state !== NODE_STATE.GHOST || p.revealedManually));
            if ((n.isDuoBox || n.isPlaceholder) && !parentIsActiveOrManual) {
                shouldHide = true;
            } else if (n.isDuoBox && parentIsActiveOrManual) {
                shouldHide = false;
            }

            if (!p.isPlaceholder && p.getAlpha() === 0 && !p.revealedManually) shouldHide = true;
            if (!n.isPlaceholder && n.getAlpha() === 0 && !n.revealedManually) shouldHide = true;

            if (shouldHide) {
                line.setVisible(false);
            } else {
                line.setVisible(true);
                const parentActive = (p.state === NODE_STATE.UNLOCKED || p.state === NODE_STATE.MAXED);
                const isDuoBranch = (n.isDuoDescendant && n.isDuoDescendant());
                const revealedLine = (p.revealed || n.revealed);
                const childManuallyRevealed = n.revealedManually;
                const isGhost = (n.state === NODE_STATE.GHOST);

                if (isGold) {
                    line.setAlpha(1.0);
                } else if (childManuallyRevealed) {
                    line.setAlpha(0.6);
                } else if (isGhost && (parentActive || isDuoBranch || revealedLine)) {
                    line.setAlpha(0.25);
                } else {
                    line.setAlpha((parentActive || isDuoBranch || revealedLine) ? 0.6 : 0);
                }
            }
        }

        if (draggableGroupRef && draggableGroupRef.recalculateOffsets) {
            draggableGroupRef.recalculateOffsets();
        }
    }

    function hideLines() {
        for (let i = 0; i < lines.length; i++) {
            lines[i].setVisible(false);
        }
    }

    return { init, createLine, shakeLine, updateLines, hideLines };
})();
