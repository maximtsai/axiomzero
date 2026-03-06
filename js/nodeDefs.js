// nodeDefs.js — Neural Tree upgrade definitions.
// Centralized node data for the upgrade tree.
// Tree center X is at 400 (half of 800px panel width)

/** Recalculates total pulse damage from all pulse upgrade nodes. */
function _recalcPulseDamage() {
    const ups = gameState.upgrades || {};
    const ampLv = ups.pulse_damage || 0;
    pulseAttack.setDamage(5 + 2 * ampLv);
}

/** Recalculates total pulse size from all pulse upgrade nodes. */
function _recalcPulseSize() {
    const ups = gameState.upgrades || {};
    const surgeLv = ups.pulse_damage_2 || 0;
    pulseAttack.setSize(100 + 40 * surgeLv);
}

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
        childIds: ['pulse_damage', 'reinforce', 'sharpen'],
        treeX: 400,
        treeY: 800,
        effect: function () {
            tower.awaken();
            // Show the deploy button immediately
            if (neuralTree.isVisible()) {
                neuralTree._showDeployButton();
            }
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
        parentId: 'awaken',
        childIds: ['pulse_damage_2'],
        treeX: 325,
        treeY: 725,
        effect: function () {
            _recalcPulseDamage();
        },
    },
    {
        id: 'pulse_damage_2',
        name: 'SURGE',
        icon: 'Skillicon14_07.png',
        description: '+40 pulse attack size',
        popupText: '+40 PULSE SIZE',
        popupColor: '#' + GAME_CONSTANTS.COLOR_HOSTILE.toString(16).padStart(6, '0'),
        maxLevel: 1,
        baseCost: 10,
        costType: 'data',
        costScaling: 'static',
        costStep: 0,
        parentId: 'pulse_damage',
        requiresMaxParent: true,
        childIds: [],
        treeX: 325,
        treeY: 650,
        effect: function () {
            _recalcPulseSize();
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
        treeY: 725,
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
        treeX: 475,
        treeY: 725,
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
        treeY: 650,
        effect: function () {
            // Stats recalculated via 'upgradePurchased' → tower._onUpgradePurchased
        },
    },
];
