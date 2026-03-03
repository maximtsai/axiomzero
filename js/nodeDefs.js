// nodeDefs.js — Neural Tree upgrade definitions.
// Centralized node data for the upgrade tree.
// Tree center X is at 400 (half of 800px panel width)

const NODE_DEFS = [
    {
        id: 'awaken',
        name: 'AWAKEN',
        icon: 'Skillicon14_01.png',
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
        effect: function () {
            tower.awaken();
            // Show the deploy button immediately
            if (neuralTree.isVisible()) {
                neuralTree._showDeployButton();
            }
        },
    },
    {
        id: 'basic_pulse',
        name: 'FOCUS',
        icon: 'Skillicon14_02.png',
        description: 'Your cursor also deals damage now.',
        maxLevel: 1,
        baseCost: 1,
        costType: 'data',
        costScaling: 'static',
        costStep: 0,
        parentId: 'awaken',
        childIds: ['pulse_damage'],
        treeX: 250,
        treeY: 425,
        effect: function () {
            pulseAttack.unlock();
            debugLog('Basic Pulse unlocked');
        },
    },
    {
        id: 'pulse_damage',
        name: 'AMPLIFY',
        icon: 'Skillicon14_06.png',
        description: '+2 pulse damage',
        popupText: '+2 PULSE DMG',
        popupColor: '#' + GAME_CONSTANTS.COLOR_HOSTILE.toString(16).padStart(6, '0'),
        maxLevel: 3,
        baseCost: 4,
        costType: 'data',
        costScaling: 'linear',
        costStep: 4,
        parentId: 'basic_pulse',
        childIds: [],
        treeX: 250,
        treeY: 287,
        effect: function () {
            const lvl = (gameState.upgrades && gameState.upgrades.pulse_damage) || 0;
            pulseAttack.setDamage(5 + 2 * lvl);
        },
    },
    {
        id: 'reinforce',
        name: 'REINFORCE',
        icon: 'Skillicon14_03.png',
        description: '+4 tower max health',
        popupText: '+4 MAX HEALTH',
        popupColor: '#' + GAME_CONSTANTS.COLOR_FRIENDLY.toString(16).padStart(6, '0'),
        maxLevel: 5,
        baseCost: 2,
        costType: 'data',
        costScaling: 'linear',
        costStep: 2,
        parentId: 'awaken',
        childIds: ['regen'],
        treeX: 400,
        treeY: 425,
        effect: function () {
            // Stats recalculated via 'upgradePurchased' → tower._onUpgradePurchased
        },
    },
    {
        id: 'sharpen',
        name: 'SHARPEN',
        icon: 'Skillicon14_04.png',
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
        effect: function () {
            // Stats recalculated via 'upgradePurchased' → tower._onUpgradePurchased
        },
    },
    {
        id: 'regen',
        name: 'REGEN',
        icon: 'Skillicon14_05.png',
        description: '+0.2 health regen',
        popupText: '+0.2 REGEN',
        popupColor: '#' + GAME_CONSTANTS.COLOR_FRIENDLY.toString(16).padStart(6, '0'),
        maxLevel: 5,
        baseCost: 2,
        costType: 'data',
        costScaling: 'linear',
        costStep: 2,
        parentId: 'reinforce',
        childIds: [],
        treeX: 400,
        treeY: 287,
        effect: function () {
            // Stats recalculated via 'upgradePurchased' → tower._onUpgradePurchased
        },
    },
];
