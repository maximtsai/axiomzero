// nodeDefs.js — Neural Tree upgrade definitions.
// Centralized node data for the upgrade tree.
// Tree center X is at 400 (half of 800px panel width)

const NODE_DEFS = [
    {
        id: 'awaken',
        name: 'AWAKEN',
        description: 'Begin existence.',
        maxLevel: 1,
        baseCost: 0,
        costType: 'data',
        costScaling: 'static',
        costStep: 0,
        parentId: null,
        childIds: ['basic_pulse', 'reinforce', 'sharpen'],
        treeX: 400,
        treeY: 563,
        effect: function() {
            tower.awaken();
            // Reveal children
            neuralTree._revealChildren('awaken');
            // Show the deploy button immediately
            if (neuralTree.isVisible()) {
                neuralTree._showDeployButton();
            }
        },
    },
    {
        id: 'basic_pulse',
        name: 'FOCUS',
        description: 'Your cursor also deals damage now.',
        maxLevel: 1,
        baseCost: 1,
        costType: 'data',
        costScaling: 'static',
        costStep: 0,
        parentId: 'awaken',
        childIds: [],
        treeX: 250,
        treeY: 425,
        effect: function() {
            // Stub — cursor pulse implemented in Phase 2
            debugLog('Basic Pulse unlocked (stub)');
        },
    },
    {
        id: 'reinforce',
        name: 'REINFORCE',
        description: '+4 tower max health',
        popupText: '+4 MAX HEALTH',
        popupColor: '#' + GAME_CONSTANTS.COLOR_FRIENDLY.toString(16).padStart(6, '0'),
        maxLevel: 5,
        baseCost: 2,
        costType: 'data',
        costScaling: 'linear',
        costStep: 2,
        parentId: 'awaken',
        childIds: [],
        treeX: 400,
        treeY: 425,
        effect: function() {
            // Stats recalculated via 'upgradePurchased' → tower._onUpgradePurchased
        },
    },
    {
        id: 'sharpen',
        name: 'SHARPEN',
        description: '+2 tower basic damage',
        popupText: '+2 DAMAGE',
        popupColor: '#' + GAME_CONSTANTS.COLOR_HOSTILE.toString(16).padStart(6, '0'),
        maxLevel: 5,
        baseCost: 2,
        costType: 'data',
        costScaling: 'linear',
        costStep: 2,
        parentId: 'awaken',
        childIds: [],
        treeX: 550,
        treeY: 425,
        effect: function() {
            // Stats recalculated via 'upgradePurchased' → tower._onUpgradePurchased
        },
    },
];
