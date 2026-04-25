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

        const line = PhaserScene.add.image(px + TREE_X_OFFSET, py, 'pixels', 'white_pixel.png');
        line.setScale(1.5, distance / 2);
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
     * Creates lines if they haven't been generated yet.
     */
    function updateLines() {
        if (!nodesRef) return;

        // Initialization: Create lines if empty
        if (lines.length === 0) {
            const isDuoLineDrawn = {};

            for (const id in nodesRef) {
                const n = nodesRef[id];
                if (n.parents && n.parents.length > 0) {
                    for (let pid of n.parents) {
                        const p = nodesRef[pid];
                        if (!p) continue;

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

            // Standardize scaling
            for (const line of lines) {
                line.setScale(1.5, line.scaleY);
            }
        }

        // Logic update: Alpha and visibility
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const p = nodesRef[line.parentId];
            const n = nodesRef[line.childId];

            if (!p || !n) continue;

            let shouldHide = (p.state === NODE_STATE.HIDDEN || n.state === NODE_STATE.HIDDEN);

            // Hide lines for normal nodes if alpha is 0
            if (!p.isPlaceholder && p.getAlpha() === 0) shouldHide = true;
            if (!n.isPlaceholder && n.getAlpha() === 0) shouldHide = true;

            if (shouldHide) {
                line.setVisible(false);
            } else {
                line.setVisible(true);
                const parentActive = (p.state === NODE_STATE.UNLOCKED || p.state === NODE_STATE.MAXED);
                const isDuoBranch = (n.isDuoDescendant && n.isDuoDescendant());
                const revealedLine = (p.revealed || n.revealed);
                const isGhost = (n.state === NODE_STATE.GHOST);

                if (isGhost && (parentActive || isDuoBranch || revealedLine)) {
                    line.setAlpha(0.25);
                } else {
                    line.setAlpha((parentActive || isDuoBranch || revealedLine || ghostToActive) ? 0.6 : 0);
                }
            }
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
