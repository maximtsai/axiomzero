// nodeDefs.js — Neural Tree upgrade definitions.
// Centralized node data for the upgrade tree.
// Tree center X is at 320 (half of 640px panel width)

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
        treeX: 320,
        treeY: 450,
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
        name: 'BASIC PULSE',
        description: 'Unlocks cursor auto-pulse attack (2s interval, AoE).',
        maxLevel: 1,
        baseCost: 5,
        costType: 'data',
        costScaling: 'static',
        costStep: 0,
        parentId: 'awaken',
        childIds: [],
        treeX: 200,
        treeY: 340,
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
        baseCost: 5,
        costType: 'data',
        costScaling: 'linear',
        costStep: 5,
        parentId: 'awaken',
        childIds: [],
        treeX: 320,
        treeY: 340,
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
        baseCost: 5,
        costType: 'data',
        costScaling: 'linear',
        costStep: 5,
        parentId: 'awaken',
        childIds: [],
        treeX: 440,
        treeY: 340,
        effect: function() {
            // Stats recalculated via 'upgradePurchased' → tower._onUpgradePurchased
        },
    },
];
