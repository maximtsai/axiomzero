// nodeDefs.js — Neural Tree upgrade definitions.
// Centralized node data for the upgrade tree.
// Tree center X is at 400 (half of 800px panel width)

/** Recalculates total pulse damage from all pulse upgrade nodes. */
function _recalcPulseDamage() {
    const ups = gameState.upgrades || {};
    const ampLv = ups.pulse_damage || 0;
    const overchargeLv = ups.pulse_damage_3 || 0;
    pulseAttack.setDamage(4 + 2 * ampLv + 4 * overchargeLv);
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
        childIds: ['basic_pulse', 'reinforce', 'sharpen', 'crypto_mine_unlock'],
        treeX: 400,
        treeY: 750,
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
        name: 'COGNITION',
        icon: 'Skillicon14_02.png',
        description: 'Your cursor now auto-attacks.',
        popupText: 'PULSE UNLOCKED',
        popupColor: '#' + GAME_CONSTANTS.COLOR_HOSTILE.toString(16).padStart(6, '0'),
        maxLevel: 1,
        baseCost: 1,
        costType: 'data',
        costScaling: 'static',
        costStep: 0,
        parentId: 'awaken',
        childIds: ['pulse_damage', 'magnet'],
        treeX: 400,
        treeY: 670,
        effect: function () {
            pulseAttack.unlock();
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
        childIds: ['pulse_damage_2'],
        treeX: 480,
        treeY: 670,
        effect: function () {
            _recalcPulseDamage();
        },
    },
    {
        id: 'magnet',
        name: 'ATTRACT',
        icon: 'Skillicon14_10.png',
        description: '+40% resource pickup range',
        popupText: '+40% RANGE',
        popupColor: '#' + GAME_CONSTANTS.COLOR_RESOURCE.toString(16).padStart(6, '0'),
        maxLevel: 1,
        baseCost: 1,
        costType: 'insight',
        costScaling: 'static',
        costStep: 0,
        parentId: 'basic_pulse',
        childIds: [],
        treeX: 320,
        treeY: 670,
        effect: function () {
            resourceManager.recalcPickupRadius();
        },
    },
    {
        id: 'pulse_damage_2',
        name: 'NOVA',
        icon: 'Skillicon14_07.png',
        description: '+40 pulse attack size',
        popupText: '+40 PULSE SIZE',
        popupColor: '#' + GAME_CONSTANTS.COLOR_HOSTILE.toString(16).padStart(6, '0'),
        maxLevel: 1,
        baseCost: 20,
        costType: 'data',
        costScaling: 'static',
        costStep: 0,
        parentId: 'pulse_damage',
        requiresMaxParent: true,
        childIds: ['pulse_damage_3'],
        treeX: 560,
        treeY: 670,
        effect: function () {
            _recalcPulseSize();
        },
    },
    {
        id: 'pulse_damage_3',
        name: 'OVERCHARGE',
        icon: 'Skillicon14_08.png',
        description: '+4 pulse damage',
        popupText: '+4 PULSE DMG',
        popupColor: '#' + GAME_CONSTANTS.COLOR_HOSTILE.toString(16).padStart(6, '0'),
        maxLevel: 2,
        baseCost: 10,
        costType: 'data',
        costScaling: 'linear',
        costStep: 5,
        parentId: 'pulse_damage_2',
        childIds: [],
        tier: 2,
        treeX: 560,
        treeY: 590,
        effect: function () {
            _recalcPulseDamage();
        },
    },
    {
        id: 'reinforce',
        name: 'REINFORCE',
        icon: 'Skillicon14_03.png',
        description: '+5 tower max health',
        popupText: '+5 MAX HEALTH',
        popupColor: '#' + GAME_CONSTANTS.COLOR_FRIENDLY.toString(16).padStart(6, '0'),
        maxLevel: 4,
        baseCost: 4,
        costType: 'data',
        costScaling: 'linear',
        costStep: 8,
        parentId: 'awaken',
        childIds: ['regen', 'armor'],
        treeX: 320,
        treeY: 750,
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
        baseCost: 6,
        costType: 'data',
        costScaling: 'linear',
        costStep: 4,
        parentId: 'awaken',
        childIds: ['focus'],
        treeX: 480,
        treeY: 750,
        effect: function () {
            // Stats recalculated via 'upgradePurchased' → tower._onUpgradePurchased
        },
    },
    {
        id: 'focus',
        name: 'INFLUENCE',
        icon: 'Skillicon14_15.png',
        description: '+20% tower attack range',
        popupText: '+20% RANGE',
        popupColor: '#' + GAME_CONSTANTS.COLOR_HOSTILE.toString(16).padStart(6, '0'),
        maxLevel: 1,
        baseCost: 20,
        costType: 'data',
        costScaling: 'static',
        costStep: 0,
        parentId: 'sharpen',
        requiresMaxParent: true,
        childIds: [],
        treeX: 560,
        treeY: 750,
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
        maxLevel: 3,
        baseCost: 6,
        costType: 'data',
        costScaling: 'linear',
        costStep: 6,
        parentId: 'reinforce',
        childIds: [],
        treeX: 240,
        treeY: 750,
        effect: function () {
            // Stats recalculated via 'upgradePurchased' → tower._onUpgradePurchased
        },
    },
    {
        id: 'crypto_mine_unlock',
        name: 'CRYPTO MINE',
        icon: 'Skillicon14_09.png',
        description: 'Unlocks the Crypto Mine.',
        popupText: 'MINE UNLOCKED',
        popupColor: '#' + GAME_CONSTANTS.COLOR_RESOURCE.toString(16).padStart(6, '0'),
        maxLevel: 1,
        baseCost: 0,
        costType: 'data',
        costScaling: 'static',
        costStep: 0,
        parentId: 'awaken',
        childIds: [],
        treeX: 400,
        treeY: 830,
        effect: function () {
            if (typeof neuralTree !== 'undefined') {
                neuralTree._showCryptoMineButton();
            }
        },
    },
    {
        id: 'armor',
        name: 'ARMOR',
        icon: 'Skillicon14_11.png',
        description: 'Reduces incoming damage by 1.',
        popupText: '+1 ARMOR',
        popupColor: '#' + GAME_CONSTANTS.COLOR_FRIENDLY.toString(16).padStart(6, '0'),
        maxLevel: 5,
        baseCost: 10,
        costType: 'data',
        costScaling: 'linear',
        costStep: 10,
        parentId: 'reinforce',
        childIds: [],
        treeX: 240,
        treeY: 830,
        effect: function () {
            // Stats recalculated via 'upgradePurchased' → tower._onUpgradePurchased
        },
    },
];
