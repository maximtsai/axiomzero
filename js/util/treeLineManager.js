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
        treeGroupRef = config.treeGroup;
        draggableGroupRef = config.draggableGroup;
        nodesRef = config.nodes;
    }

    /**
     * Creates a single connecting line between two points.
     * @param {number} px - Parent X
     * @param {number} py - Parent Y
     * @param {number} cx - Child X
     * @param {number} cy - Child Y
     * @param {Object} metadata - Additional data for the line sprite.
     * @returns {Phaser.GameObjects.Image} The created line object.
     */
    function createLine(px, py, cx, cy, metadata) {
        const dx = cx - px, dy = cy - py;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx) + 1.57;

        // Factor in group state so that VirtualGroup.add captures the correct local offset
        const gx = draggableGroupRef ? draggableGroupRef.x : 0;
        const gy = draggableGroupRef ? draggableGroupRef.y : 0;
        const gs = draggableGroupRef ? draggableGroupRef.getScale() : 1;

        const screenX = (px + TREE_X_OFFSET) * gs + gx;
        const screenY = py * gs + gy;

        const line = PhaserScene.add.image(screenX, screenY, 'buttons', 'white_pixel.png');
        // Initial screen scale must factor in current group scale so that VirtualGroup.add() 
        // correctly records the intended "local" base scale.
        line.setScale(1.5 * gs, (distance / 2) * gs);
        line.setOrigin(0.5, 1);
        line.setRotation(angle);
        line.setDepth(GAME_CONSTANTS.DEPTH_UPGRADE_TREE + 1);
        line.setScrollFactor(0);
        Object.assign(line, metadata);

        lines.push(line);
        if (draggableGroupRef) draggableGroupRef.add(line);
        return line;
    }

    /**
     * Plays a "shaking" effect for a line between a parent and child.
     * @param {string} parentId
     * @param {string} childId
     */
    function shakeLine(parentId, childId) {
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

    /**
     * Updates the visibility and alpha of all lines based on node states.
     * Creates lines if they haven't been generated yet or if new nodes were added.
     */
    function updateLines() {
        if (!nodesRef) return;

        // 1. Ensure all lines exist for current nodes
        const isDuoLineDrawn = {};
        // Pre-populate duo line map from existing lines
        for (const line of lines) {
            if (line.isDuoLine) {
                isDuoLineDrawn[line.duoBoxTier + '_' + line.parentId] = true;
            }
        }

        for (const id in nodesRef) {
            const n = nodesRef[id];
            if (n.parents && n.parents.length > 0) {
                for (let pid of n.parents) {
                    const p = nodesRef[pid];
                    if (!p) continue;

                    // Check if a line already exists for this connection
                    const lineExists = lines.some(l => l.parentId === pid && (l.childId === id || (l.isDuoLine && l.duoSiblingChildId === id)));
                    if (lineExists) continue;

                    if (n.isDuoBox && n.duoBoxTier > 0) {
                        const duoKey = n.duoBoxTier + '_' + pid;
                        if (isDuoLineDrawn[duoKey]) continue;
                        isDuoLineDrawn[duoKey] = true;

                        const sibling = n.duoSiblingId ? nodesRef[n.duoSiblingId] : null;
                        const targetX = sibling ? (n.treeX + sibling.treeX) / 2 : n.treeX;
                        const targetY = sibling ? (n.treeY + sibling.treeY) / 2 : n.treeY;

                        const newLine = createLine(p.treeX, p.treeY, targetX, targetY, {
                            childId: id,
                            duoSiblingChildId: n.duoSiblingId,
                            parentId: pid,
                            duoBoxTier: n.duoBoxTier,
                            isDuoLine: true,
                        });
                        newLine.setScale(1.5, newLine.scaleY);
                    } else {
                        const newLine = createLine(p.treeX, p.treeY, n.treeX, n.treeY, {
                            childId: id,
                            parentId: pid,
                        });
                        newLine.setScale(1.5, newLine.scaleY);
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
            const p = nodesRef[line.parentId];
            const n = nodesRef[line.childId];

            if (!p || !n) continue;

            // Update line position and length to match current node coordinates
            const targetX = line.isDuoLine && n.duoSiblingId ? (n.treeX + nodesRef[n.duoSiblingId].treeX) / 2 : n.treeX;
            const targetY = line.isDuoLine && n.duoSiblingId ? (n.treeY + nodesRef[n.duoSiblingId].treeY) / 2 : n.treeY;

            const dx = targetX - p.treeX;
            const dy = targetY - p.treeY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const angle = Math.atan2(dy, dx) + 1.57;

            // Update Screen Position
            line.setPosition((p.treeX + TREE_X_OFFSET) * gs + gx, p.treeY * gs + gy);
            line.setRotation(angle);
            line.setScale(1.5 * gs, (distance / 2) * gs);

            let shouldHide = (p.state === NODE_STATE.HIDDEN || n.state === NODE_STATE.HIDDEN);
            // Exception: Always show lines between manually revealed nodes
            if (p.revealedManually && n.revealedManually) shouldHide = false;

            // Exception: Duo box lines should ONLY be visible if the parent is Unlocked/Maxed or revealed manually
            const parentIsActiveOrManual = (p.state !== NODE_STATE.HIDDEN && (p.state !== NODE_STATE.GHOST || p.revealedManually));
            if ((n.isDuoBox || n.isPlaceholder) && !parentIsActiveOrManual) {
                shouldHide = true;
            } else if (n.isDuoBox && parentIsActiveOrManual) {
                shouldHide = false;
            }

            // Hide lines for normal nodes if alpha is 0
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

                if (childManuallyRevealed) {
                    line.setAlpha(0.6);
                } else if (isGhost && (parentActive || isDuoBranch || revealedLine)) {
                    line.setAlpha(0.25);
                } else {
                    line.setAlpha((parentActive || isDuoBranch || revealedLine) ? 0.6 : 0);
                }
            }
        }

        // Update offsets so the VirtualGroup doesn't snap objects back to old positions
        if (draggableGroupRef && draggableGroupRef.recalculateOffsets) {
            draggableGroupRef.recalculateOffsets();
        }
    }

    /**
     * Hides all lines instantly.
     */
    function hideLines() {
        for (let i = 0; i < lines.length; i++) {
            lines[i].setVisible(false);
        }
    }

    return { init, createLine, shakeLine, updateLines, hideLines };
})();
