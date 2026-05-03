/**
 * @fileoverview Utility functions for manipulating the upgrade tree and node definitions.
 */

/**
 * Dynamically registers a new upgrade node and updates its parents to include it as a child.
 * @param {Object} config - The node definition object.
 * @returns {Object} The registered node definition.
 */
function registerNode(config) {
    if (!config.id) {
        console.error("[NODE UTILS] Cannot register node without an ID.");
        return null;
    }

    console.log(`[NODE UTILS] Registering node: ${config.id}`);

    // Ensure defaults
    if (config.maxLevel === undefined) config.maxLevel = 1;
    if (!config.costType) config.costType = 'data';
    if (!config.parents) config.parents = [];
    if (!config.childIds) config.childIds = [];

    // Add to global definitions (assumes NODE_DEFS is globally available)
    if (typeof NODE_DEFS !== 'undefined') {
        // Prevent duplicates
        if (NODE_DEFS.some(d => d.id === config.id)) {
            console.log(`[NODE UTILS] Node '${config.id}' is already registered.`);
            return getNodeDef(config.id);
        }

        NODE_DEFS.push(config);

        // Sync reciprocity: Add this node to its parents' childIds
        config.parents.forEach(parentId => {
            const parentDef = NODE_DEFS.find(d => d.id === parentId);
            if (parentDef) {
                if (!parentDef.childIds) parentDef.childIds = [];
                if (!parentDef.childIds.includes(config.id)) {
                    console.log(`[NODE UTILS] Adding reciprocity: parent ${parentId} now lists ${config.id} as child.`);
                    parentDef.childIds.push(config.id);
                }
            }
        });

        // Persist the registration
        saveDynamicNode(config.id);
    } else {
        console.warn("[NODE UTILS] NODE_DEFS not found. Node registered in vacuum.");
    }

    return config;
}

/**
 * Returns a node definition by its ID.
 * @param {string} id - The node ID to find.
 * @returns {Object|null} The node definition or null if not found.
 */
function getNodeDef(id) {
    if (typeof NODE_DEFS === 'undefined') return null;
    return NODE_DEFS.find(d => d.id === id) || null;
}

/**
 * Attaches a node (from active or disabled definitions) to a parent node.
 * Handles reciprocity and dynamic registration if moving from DISABLED_NODES.
 * @param {string} nodeId - The ID of the node to attach.
 * @param {string} parentId - The ID of the node that will become the parent.
 */
function attachNodeToParent(nodeId, parentId) {
    console.log(`[NODE UTILS] Attaching node '${nodeId}' to parent '${parentId}'`);
    let nodeDef = getNodeDef(nodeId);

    // If not in active defs, check disabled nodes
    if (!nodeDef && typeof DISABLED_NODES !== 'undefined') {
        nodeDef = DISABLED_NODES.find(d => d.id === nodeId);
        if (nodeDef) {
            console.log(`[NODE UTILS] Found '${nodeId}' in DISABLED_NODES. Activating...`);
            // Ensure the parent is listed before registering to trigger reciprocity
            if (!nodeDef.parents.includes(parentId)) {
                nodeDef.parents.push(parentId);
            }
            registerNode(nodeDef);
        }
    }

    if (!nodeDef) {
        console.error(`[NODE UTILS] Node '${nodeId}' not found.`);
        return;
    }

    const parentDef = getNodeDef(parentId);
    if (!parentDef) {
        console.error(`[NODE UTILS] Parent node '${parentId}' not found.`);
        return;
    }

    // Update link reciprocity
    if (!nodeDef.parents.includes(parentId)) {
        nodeDef.parents.push(parentId);
    }
    if (!parentDef.childIds) parentDef.childIds = [];
    if (!parentDef.childIds.includes(nodeId)) {
        console.log(`[NODE UTILS] Updating reciprocity link: parent ${parentId} -> child ${nodeId}`);
        parentDef.childIds.push(nodeId);
    }

    // Persist the new relationship
    saveDynamicNode(nodeId);

    // Live sync: If the game is running, ensure the node is spawned and visibility cascades
    if (typeof upgradeTree !== 'undefined' && typeof upgradeTree.getNode === 'function') {
        const parent = upgradeTree.getNode(parentId);
        let child = upgradeTree.getNode(nodeId);

        // 1. If child doesn't exist in the UI yet, spawn it
        if (!child && typeof upgradeTree.spawnNode === 'function') {
            console.log(`[NODE UTILS] Triggering UI spawn for '${nodeId}'`);
            child = upgradeTree.spawnNode(nodeId);
        } else if (!child) {
            console.warn(`[NODE UTILS] Cannot spawn '${nodeId}' visually: upgradeTree.spawnNode is missing!`);
        }

        // 2. Refresh parent state to trigger visibility cascade (HIDDEN -> GHOST)
        if (parent) {
            console.log(`[NODE UTILS] Refreshing parent '${parentId}' for visibility cascade.`);
            parent.refreshState();
        } else if (child) {
            console.log(`[NODE UTILS] Refreshing child '${nodeId}' directly.`);
            child.refreshState();
        }
    }
}

/**
 * Saves a node's dynamic state (parents, position) to the gameState for persistence.
 * @param {string} nodeId - The ID of the node to save.
 */
function saveDynamicNode(nodeId) {
    if (typeof gameState === 'undefined' || !gameState.dynamicNodes) return;
    const def = getNodeDef(nodeId);
    if (!def) return;

    console.log(`[NODE UTILS] Persisting node '${nodeId}' to gameState.`);

    gameState.dynamicNodes[nodeId] = {
        parents: [...def.parents],
        treeX: def.treeX,
        treeY: def.treeY
    };
}

/**
 * Restores all dynamically registered nodes and their relationships from the save file.
 * This should be called during the game initialization sequence, before the upgrade tree is built.
 */
function restoreDynamicNodes() {
    if (typeof gameState === 'undefined' || !gameState.dynamicNodes) return;

    console.log("[NODE UTILS] Restoring dynamic nodes from save...");

    for (const nodeId in gameState.dynamicNodes) {
        const savedData = gameState.dynamicNodes[nodeId];

        // 1. Find the node (check active first, then disabled)
        let def = getNodeDef(nodeId);
        if (!def && typeof DISABLED_NODES !== 'undefined') {
            def = DISABLED_NODES.find(d => d.id === nodeId);
            if (def) {
                console.log(`[NODE UTILS] Restoring '${nodeId}' from DISABLED_NODES.`);
                // Apply saved position before registering
                if (savedData.treeX !== undefined) def.treeX = savedData.treeX;
                if (savedData.treeY !== undefined) def.treeY = savedData.treeY;
                
                // Set saved parents before registering so registerNode handles reciprocity
                def.parents = [...savedData.parents];
                registerNode(def);
            }
        } else if (def) {
            console.log(`[NODE UTILS] Syncing active node '${nodeId}' from save.`);
            // Node is already active, just sync any saved properties
            if (savedData.treeX !== undefined) def.treeX = savedData.treeX;
            if (savedData.treeY !== undefined) def.treeY = savedData.treeY;

            // Re-apply parent links just in case
            savedData.parents.forEach(parentId => {
                attachNodeToParent(nodeId, parentId);
            });
        }
    }
}

/**
 * Updates a node's position and persists it to the save file.
 * @param {string} nodeId - The ID of the node to move.
 * @param {number} x - The new treeX coordinate.
 * @param {number} y - The new treeY coordinate.
 */
function updateNodePosition(nodeId, x, y) {
    console.log(`[NODE UTILS] Moving node '${nodeId}' to (${x}, ${y})`);
    const def = getNodeDef(nodeId);
    if (!def) {
        console.error(`[NODE UTILS] Cannot update position: Node '${nodeId}' not found.`);
        return;
    }

    def.treeX = x;
    def.treeY = y;

    // Update live instance if it exists
    if (typeof upgradeTree !== 'undefined') {
        const liveNode = upgradeTree.getNode(nodeId);
        if (liveNode && typeof liveNode.setPosition === 'function') {
            console.log(`[NODE UTILS] Updating live sprite position for '${nodeId}'`);
            liveNode.setPosition(x, y);
        } else if (liveNode) {
            console.warn(`[NODE UTILS] liveNode found but setPosition is missing for '${nodeId}'!`);
        }

        // Recalculate tree bounds and redraw lines
        if (typeof upgradeTree._calculateContentBounds === 'function') {
            upgradeTree._calculateContentBounds();
        }
        if (typeof treeLineManager !== 'undefined') {
            treeLineManager.updateLines();
        }
    }

    // Persist the change
    saveDynamicNode(nodeId);
}
