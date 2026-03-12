// nodeDefs.js — Neural Tree upgrade definitions.
// Centralized node data for the upgrade tree.
// Tree center X is at 400 (half of 800px panel width)

/** Recalculates total cursor damage from all pulse upgrade nodes. */
function _recalcPulseDamage() {
    const ups = gameState.upgrades || {};
    const ampLv = ups.pulse_damage || 0;
    const overchargeLv = ups.pulse_damage_3 || 0;
    pulseAttack.setDamage(4 + 2 * ampLv + 4 * overchargeLv);
}

/** Recalculates total pulse size from all pulse upgrade nodes. */
function _recalcPulseSize() {
    const ups = gameState.upgrades || {};
    const expansionLv = ups.pulse_expansion || 0;
    pulseAttack.setSize(100 * (1 + 0.3 * expansionLv));
}

/** Recalculates lightning chain count from upgrade nodes. */
function _recalcLightningChains() {
    const ups = gameState.upgrades || {};
    const chainLv = ups.lightning_chain || 0;
    lightningAttack.setChainCount(2 + chainLv);
}

/** Recalculates lightning damage from upgrade nodes. */
function _recalcLightningDamage() {
    const ups = gameState.upgrades || {};
    const boostLv = ups.lightning_boost || 0;
    lightningAttack.setDamage(6 + 3 * boostLv);
}

/** Recalculates shockwave upgrades from upgrade nodes. */
function _recalcShockwaveStats() {
    if (typeof shockwaveAttack === 'undefined') return;
    const ups = gameState.upgrades || {};
    const ampLv = ups.shockwave_amplifier || 0;
    const resLv = ups.shockwave_resonance || 0;
    shockwaveAttack.setAmplifierLevel(ampLv);
    shockwaveAttack.setResonanceLevel(resLv);
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
        childIds: ['basic_pulse', 'integrity', 'intensity', 'crypto_mine_unlock'],
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
        childIds: ['pulse_damage', 'magnet', 'lightning_weapon', 'shockwave_weapon'],
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
        description: '+2 cursor damage',
        popupText: '+2 CURSOR DMG',
        popupColor: '#' + GAME_CONSTANTS.COLOR_HOSTILE.toString(16).padStart(6, '0'),
        maxLevel: 3,
        baseCost: 5,
        costType: 'data',
        costScaling: 'linear',
        costStep: 10,
        parentId: 'basic_pulse',
        childIds: ['pulse_expansion'],
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
        popupText: '+40% PICKUP RANGE',
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
        id: 'pulse_expansion',
        name: 'EXPANSION',
        icon: 'Skillicon14_07.png',
        description: '+30% cursor attack size',
        popupText: '+30% CURSOR SIZE',
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
        description: '+4 cursor damage',
        popupText: '+4 CURSOR DMG',
        popupColor: '#' + GAME_CONSTANTS.COLOR_HOSTILE.toString(16).padStart(6, '0'),
        maxLevel: 2,
        baseCost: 10,
        costType: 'data',
        costScaling: 'linear',
        costStep: 5,
        parentId: 'pulse_expansion',
        childIds: [],
        tier: 2,
        treeX: 560,
        treeY: 590,
        effect: function () {
            _recalcPulseDamage();
        },
    },
    {
        id: 'integrity',
        name: 'INTEGRITY',
        icon: 'Skillicon14_03.png',
        description: '+5 tower max health',
        popupText: '+5 MAX HEALTH',
        popupColor: '#' + GAME_CONSTANTS.COLOR_FRIENDLY.toString(16).padStart(6, '0'),
        maxLevel: 8,
        baseCost: 4,
        costType: 'data',
        costScaling: 'linear',
        costStep: 4,
        costStepScaling: 4,
        parentId: 'awaken',
        childIds: ['regen', 'armor'],
        treeX: 320,
        treeY: 750,
        effect: function () {
            // Stats recalculated via 'upgradePurchased' → tower._onUpgradePurchased
        },
    },
    {
        id: 'intensity',
        name: 'INTENSITY',
        icon: 'Skillicon14_04.png',
        description: '+2 tower basic damage',
        popupText: '+2 DAMAGE',
        popupColor: '#' + GAME_CONSTANTS.COLOR_HOSTILE.toString(16).padStart(6, '0'),
        maxLevel: 4,
        baseCost: 5,
        costType: 'data',
        costScaling: 'linear',
        costStep: 5,
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
        popupText: '+20% ATTACK RANGE',
        popupColor: '#' + GAME_CONSTANTS.COLOR_HOSTILE.toString(16).padStart(6, '0'),
        maxLevel: 1,
        baseCost: 20,
        costType: 'data',
        costScaling: 'static',
        costStep: 0,
        parentId: 'intensity',
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
        parentId: 'integrity',
        childIds: ['overclock', 'prismatic_array', 'data_compression'],
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
        maxLevel: 1,
        baseCost: 0,
        costType: 'data',
        costScaling: 'static',
        costStep: 0,
        parentId: 'integrity',
        childIds: [],
        treeX: 240,
        treeY: 830,
        effect: function () {
            // Stats recalculated via 'upgradePurchased' → tower._onUpgradePurchased
        },
    },
    {
        id: 'placeholder_duo_1',
        isPlaceholder: true,
        parentId: null,
        monitorsDuoTier: 1,
        childIds: ['base_hp_boost'],
        tier: 1,
        treeX: 400,
        treeY: 580,
        effect: function () { },
    },
    // ── Tier 1 Duo-Box: Lightning Weapon & Shockwave Weapon ──────────────
    {
        id: 'lightning_weapon',
        name: 'LIGHTNING',
        icon: 'Skillicon14_17.png',
        description: 'Tower shoots lightning every 3s that chains across enemies.',
        popupText: 'LIGHTNING WEAPON',
        popupColor: '#' + GAME_CONSTANTS.COLOR_HOSTILE.toString(16).padStart(6, '0'),
        maxLevel: 1,
        baseCost: 1,
        costType: 'shard',
        costScaling: 'static',
        costStep: 0,
        parentId: 'basic_pulse',
        childIds: ['lightning_chain', 'lightning_boost'],
        isDuoBox: true,
        duoBoxTier: 1,
        shardId: 'lightning_weapon',
        duoSiblingId: 'shockwave_weapon',
        treeX: 370,
        treeY: 550,
        effect: function () {
            lightningAttack.unlock();
            shockwaveAttack.lock();
        },
    },
    {
        id: 'shockwave_weapon',
        name: 'SHOCKWAVE',
        icon: 'Skillicon14_20.png',
        description: 'Tower releases a shockwave every 3s, damaging nearby enemies.',
        popupText: 'SHOCKWAVE WEAPON',
        popupColor: '#' + GAME_CONSTANTS.COLOR_HOSTILE.toString(16).padStart(6, '0'),
        maxLevel: 1,
        baseCost: 1,
        costType: 'shard',
        costScaling: 'static',
        costStep: 0,
        parentId: 'basic_pulse',
        childIds: ['shockwave_amplifier', 'shockwave_resonance'],
        isDuoBox: true,
        duoBoxTier: 1,
        shardId: 'shockwave_weapon',
        duoSiblingId: 'lightning_weapon',
        treeX: 430,
        treeY: 550,
        effect: function () {
            shockwaveAttack.unlock();
            lightningAttack.lock();
        },
    },
    {
        id: 'lightning_chain',
        name: 'FORK',
        icon: 'Skillicon14_17.png',
        description: '+1 lightning chain target',
        popupText: '+1 CHAIN',
        popupColor: '#' + GAME_CONSTANTS.COLOR_HOSTILE.toString(16).padStart(6, '0'),
        maxLevel: 1,
        baseCost: 15,
        costType: 'data',
        costScaling: 'static',
        costStep: 0,
        parentId: 'lightning_weapon',
        childIds: [],
        treeX: 280,
        treeY: 590,
        effect: function () {
            _recalcLightningChains();
        },
    },
    {
        id: 'lightning_boost',
        name: 'VOLTAGE',
        icon: 'Skillicon14_18.png',
        description: '+50% lightning damage',
        popupText: '+50% LIGHTNING DMG',
        popupColor: '#' + GAME_CONSTANTS.COLOR_HOSTILE.toString(16).padStart(6, '0'),
        maxLevel: 1,
        baseCost: 20,
        costType: 'data',
        costScaling: 'static',
        costStep: 0,
        parentId: 'lightning_weapon',
        childIds: [],
        treeX: 280,
        treeY: 510,
        effect: function () {
            _recalcLightningDamage();
        },
    },
    {
        id: 'shockwave_amplifier',
        name: 'AMPLIFIER',
        icon: 'Skillicon14_21.png',
        description: '+25% shockwave damage & range',
        popupText: '+25% RANGE & DMG',
        popupColor: '#' + GAME_CONSTANTS.COLOR_HOSTILE.toString(16).padStart(6, '0'),
        maxLevel: 1,
        baseCost: 40,
        costType: 'data',
        costScaling: 'static',
        costStep: 0,
        parentId: 'shockwave_weapon',
        childIds: [],
        treeX: 520,
        treeY: 590,
        effect: function () {
            _recalcShockwaveStats();
        },
    },
    {
        id: 'shockwave_resonance',
        name: 'RESONANCE',
        icon: 'Skillicon14_22.png',
        description: 'Shockwave deals +1/2/3 dmg per enemy hit',
        popupText: 'RESONANCE FREQUENCY',
        popupColor: '#' + GAME_CONSTANTS.COLOR_HOSTILE.toString(16).padStart(6, '0'),
        maxLevel: 3,
        baseCost: 30,
        costType: 'data',
        costScaling: 'linear',
        costStep: 30,
        parentId: 'shockwave_weapon',
        childIds: [],
        treeX: 520,
        treeY: 510,
        effect: function () {
            _recalcShockwaveStats();
        },
    },
    {
        id: 'base_hp_boost',
        name: 'STABILITY',
        icon: 'Skillicon14_13.png',
        description: '+10 tower max health',
        popupText: '+10 MAX HEALTH',
        popupColor: '#' + GAME_CONSTANTS.COLOR_FRIENDLY.toString(16).padStart(6, '0'),
        maxLevel: 1,
        baseCost: 50,
        costType: 'data',
        costScaling: 'static',
        costStep: 0,
        parentId: 'placeholder_duo_1',
        tier: 2,
        treeX: 400,
        treeY: 430,
        effect: function () {
            // Recalculated via messageBus 'upgradePurchased' → tower._onUpgradePurchased
        },
    },
    {
        id: 'overclock',
        name: 'OVERCLOCK',
        icon: 'Skillicon14_04.png',
        description: '-25% tower attack cooldown',
        popupText: '-25% COOLDOWN',
        popupColor: '#' + GAME_CONSTANTS.COLOR_FRIENDLY.toString(16).padStart(6, '0'),
        maxLevel: 1,
        baseCost: 10,
        costType: 'data',
        costScaling: 'static',
        costStep: 0,
        parentId: 'regen',
        childIds: [],
        treeX: 160,
        treeY: 750,
        effect: function () {
            // Recalculated via messageBus 'upgradePurchased' → tower._onUpgradePurchased
        },
    },
    {
        id: 'prismatic_array',
        name: 'PRISMATIC ARRAY',
        icon: 'Skillicon14_12.png',
        description: '+25% chance to fire an extra projectile',
        popupText: 'PRISMATIC ARRAY',
        popupColor: '#' + GAME_CONSTANTS.COLOR_FRIENDLY.toString(16).padStart(6, '0'),
        maxLevel: 4,
        baseCost: 20,
        costType: 'data',
        costScaling: 'linear',
        costStep: 20,
        parentId: 'regen',
        childIds: [],
        treeX: 80,
        treeY: 750,
        effect: function () {
            // Recalculated via normal gameplay checks
        },
    },
    {
        id: 'data_compression',
        name: 'DATA COMPRESSION',
        icon: 'Skillicon14_19.png',
        description: '50% chance to double collected DATA',
        popupText: 'DATA COMPRESSION',
        popupColor: '#' + GAME_CONSTANTS.COLOR_RESOURCE.toString(16).padStart(6, '0'),
        maxLevel: 1,
        baseCost: 2,
        costType: 'insight',
        costScaling: 'static',
        costStep: 0,
        parentId: 'regen',
        childIds: [],
        treeX: 160,
        treeY: 830,
        effect: function () {
            // Recalculated via normal gameplay checks
        },
    },
];
