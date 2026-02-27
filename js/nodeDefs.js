// nodeDefs.js — Neural Tree upgrade definitions.
// Centralized node data for the upgrade tree.
// Tree center X is at 320 (half of 640px panel width)

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
        name: 'Basic Pulse',
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
        name: 'Reinforce',
        description: '+25% tower max health per level.',
        maxLevel: 3,
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
        name: 'Sharpen',
        description: '+25% tower attack damage per level.',
        maxLevel: 3,
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
