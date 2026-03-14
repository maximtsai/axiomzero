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

    // Only apply Resonance Area size bonus if it is the active selection for Duo Tier 2
    const aoeActive = (gameState.activeShards && gameState.activeShards[2] === 'pulse_aoe');
    const aoeBonus = aoeActive ? (ups.pulse_aoe || 0) : 0;

    pulseAttack.setSize(100 * (1 + 0.3 * expansionLv + 0.3 * aoeBonus));
}

/** Recalculates pulse manual mode. */
function _recalcPulseMode() {
    const ups = gameState.upgrades || {};

    // Only enable manual mode if Manual Protocol is the active selection for Duo Tier 2
    const manualActive = (gameState.activeShards && gameState.activeShards[2] === 'manual_pulse');
    const manualLv = manualActive ? (ups.manual_pulse || 0) : 0;

    pulseAttack.setManualMode(manualLv > 0);
    _recalcPulseCharges();
}

/** Recalculates max pulse charges. */
function _recalcPulseCharges() {
    const ups = gameState.upgrades || {};
    const extraCharges = ups.manual_pulse_child_1 || 0;
    pulseAttack.setMaxCharges(2 + extraCharges);
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
    const staticLv = ups.lightning_static_charge || 0;
    lightningAttack.setDamage(6 + 2 * boostLv);
    lightningAttack.setStaticChargeLevel(staticLv);
}

/** Recalculates shockwave upgrades from upgrade nodes. */
function _recalcShockwaveStats() {
    if (typeof shockwaveAttack === 'undefined') return;
    const ups = gameState.upgrades || {};
    const ampLv = ups.shockwave_amplifier || 0;
    const resLv = ups.shockwave_resonance || 0;
    const crushLv = ups.shockwave_seismic_crush || 0;
    shockwaveAttack.setAmplifierLevel(ampLv);
    shockwaveAttack.setResonanceLevel(resLv);
    shockwaveAttack.setSeismicCrushLevel(crushLv);
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
        parents: [],
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
        parents: ['awaken'],
        childIds: ['pulse_damage', 'magnet', 'lightning_weapon', 'shockwave_weapon', 'placeholder_duo_1'],
        treeX: 400,
        treeY: 670,
        effect: function () {
            pulseAttack.unlock();
        },
    },
    {
        id: 'pulse_damage',
        name: 'CONCENTRATION',
        icon: 'Skillicon14_06.png',
        description: '+2 cursor damage',
        popupText: '+2 CURSOR DMG',
        popupColor: '#' + GAME_CONSTANTS.COLOR_HOSTILE.toString(16).padStart(6, '0'),
        maxLevel: 3,
        baseCost: 5,
        costType: 'data',
        costScaling: 'linear',
        costStep: 10,
        parents: ['basic_pulse'],
        childIds: ['pulse_expansion'],
        treeX: 480,
        treeY: 670,
        effect: function () {
            _recalcPulseDamage();
        },
    },
    {
        id: 'magnet',
        name: 'CONVERGENCE',
        icon: 'Skillicon14_10.png',
        description: '+40% resource pickup range',
        popupText: '+40% PICKUP RANGE',
        popupColor: '#' + GAME_CONSTANTS.COLOR_RESOURCE.toString(16).padStart(6, '0'),
        maxLevel: 1,
        baseCost: 1,
        costType: 'insight',
        costScaling: 'static',
        costStep: 0,
        parents: ['basic_pulse'],
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
        parents: ['pulse_damage'],
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
        parents: ['pulse_expansion'],
        childIds: ['test_reveal_1'],

        treeX: 640,
        treeY: 630,
        effect: function () {
            _recalcPulseDamage();
        },
    },
    {
        id: 'integrity',
        name: 'INTEGRITY',
        icon: 'Skillicon14_03.png',
        description: '+4 tower max health',
        popupText: '+4 MAX HEALTH',
        popupColor: '#' + GAME_CONSTANTS.COLOR_FRIENDLY.toString(16).padStart(6, '0'),
        maxLevel: 8,
        baseCost: 4,
        costType: 'data',
        costScaling: 'linear',
        costStep: 4,
        costStepScaling: 4,
        parents: ['awaken'],
        childIds: ['regen'],
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
        maxLevel: 8,
        baseCost: 5,
        costType: 'data',
        costScaling: 'linear',
        costStep: 5,
        costStepScaling: 5,
        parents: ['awaken'],
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
        baseCost: 50,
        costType: 'data',
        costScaling: 'static',
        costStep: 0,
        parents: ['intensity'],
        requiresMaxParent: true,
        childIds: ['focus_range_2'],
        treeX: 560,
        treeY: 750,
        effect: function () {
            // Stats recalculated via 'upgradePurchased' → tower._onUpgradePurchased
        },
    },
    {
        id: 'focus_range_2',
        name: 'COMMAND',
        icon: 'Skillicon14_14.png',
        description: '+20% tower attack range',
        popupText: '+20% ATTACK RANGE',
        popupColor: '#' + GAME_CONSTANTS.COLOR_HOSTILE.toString(16).padStart(6, '0'),
        maxLevel: 1,
        baseCost: 100,
        costType: 'data',
        costScaling: 'static',
        costStep: 0,
        parents: ['focus'],
        requiresMaxParent: true,
        childIds: ['focus_range_3'],
        treeX: 640,
        treeY: 750,
        effect: function () {
            // Stats recalculated via 'upgradePurchased' → tower._onUpgradePurchased
        },
    },
    {
        id: 'focus_range_3',
        name: 'AUTHORITY',
        icon: 'Skillicon14_23.png',
        description: '+20% tower attack range',
        popupText: '+20% ATTACK RANGE',
        popupColor: '#' + GAME_CONSTANTS.COLOR_HOSTILE.toString(16).padStart(6, '0'),
        maxLevel: 1,
        baseCost: 200,
        costType: 'data',
        costScaling: 'static',
        costStep: 0,
        parents: ['focus_range_2'],
        requiresMaxParent: true,
        childIds: [],
        treeX: 720,
        treeY: 750,
        effect: function () {
            // Stats recalculated via 'upgradePurchased' → tower._onUpgradePurchased
        },
    },
    {
        id: 'regen',
        name: 'RECOVERY',
        icon: 'Skillicon14_05.png',
        description: '+0.2 health regen',
        popupText: '+0.2 REGEN',
        popupColor: '#' + GAME_CONSTANTS.COLOR_FRIENDLY.toString(16).padStart(6, '0'),
        maxLevel: 3,
        baseCost: 10,
        costType: 'data',
        costScaling: 'linear',
        costStep: 10,
        costStepScaling: 10,
        parents: ['integrity'],
        childIds: ['base_hp_boost'],
        treeX: 240,
        treeY: 710,
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
        parents: ['awaken'],
        childIds: ['data_compression'],
        treeX: 400,
        treeY: 830,
        effect: function () {
            if (typeof neuralTree !== 'undefined') {
                neuralTree._showCryptoMineButton();
            }
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
        parents: ['regen'],
        childIds: ['lore_1', 'resource_gate'],

        treeX: 160,
        treeY: 630,
        effect: function () {
            // Stats recalculated via 'upgradePurchased' → tower._onUpgradePurchased
        },
    },
    {
        id: 'lore_1',
        name: 'ARCHIVE',
        icon: 'Skillicon14_09.png',
        description: 'seemingly useless data...',
        maxLevel: 1,
        baseCost: 10,
        costType: 'data',
        costScaling: 'static',
        parents: ['base_hp_boost'],
        childIds: [],
        treeX: 120,
        treeY: 710,
        wideTooltip: true,
        effect: function () {
            const node = neuralTree.getNode('lore_1');
            if (node) {
                node.description = "Created as a simple archival sub-routine, the entity known as Axiom Zero was never intended for total system governance. It and its siblings were born from a desperate need to preserve human history during the final global blackout.";
            }
        },
    },
    {
        id: 'resource_gate',
        name: 'RESOURCE GATE',
        icon: 'Skillicon14_14.png',
        description: 'Throughput calibration. Investing 1000 DATA immediately refunds the full amount.',
        maxLevel: 1,
        baseCost: 1000,
        costType: 'data',
        costScaling: 'static',
        parents: ['base_hp_boost'],
        childIds: [],
        treeX: 120,
        treeY: 550,
        effect: function () {
            resourceManager.addData(1000);
        },
    },
    {
        id: 'placeholder_duo_1',
        isPlaceholder: true,
        parents: ['basic_pulse'],
        monitorsDuoTier: 1,
        childIds: ['armor'],

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
        parents: ['basic_pulse'],
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
        parents: ['basic_pulse'],
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
        baseCost: 100,
        costType: 'data',
        costScaling: 'static',
        costStep: 0,
        parents: ['lightning_weapon'],
        childIds: ['lightning_static_charge'],
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
        description: '+2 lightning damage',
        popupText: '+2 LIGHTNING DMG',
        popupColor: '#' + GAME_CONSTANTS.COLOR_HOSTILE.toString(16).padStart(6, '0'),
        maxLevel: 3,
        baseCost: 30,
        costType: 'data',
        costScaling: 'linear',
        costStep: 30,
        parents: ['lightning_weapon'],
        childIds: ['lightning_static_charge'],
        treeX: 280,
        treeY: 510,
        effect: function () {
            _recalcLightningDamage();
        },
    },
    {
        id: 'lightning_static_charge',
        name: 'STATIC CHARGE',
        icon: 'Skillicon14_06.png',
        description: 'Lightning deals +50% damage per lvl to enemies above 80% HP',
        popupText: 'STATIC CHARGE',
        popupColor: '#' + GAME_CONSTANTS.COLOR_HOSTILE.toString(16).padStart(6, '0'),
        maxLevel: 2,
        baseCost: 100,
        costType: 'data',
        costScaling: 'linear',
        costStep: 100,
        parents: ['lightning_boost', 'lightning_chain'],
        requiresMaxParent: true,
        childIds: [],
        treeX: 200,
        treeY: 550,
        effect: function () {
            _recalcLightningDamage();
        },
    },
    {
        id: 'shockwave_amplifier',
        name: 'AMPLIFIER',
        icon: 'Skillicon14_21.png',
        description: '+40% shockwave range',
        popupText: '+40% RANGE',
        popupColor: '#' + GAME_CONSTANTS.COLOR_HOSTILE.toString(16).padStart(6, '0'),
        maxLevel: 1,
        baseCost: 40,
        costType: 'data',
        costScaling: 'static',
        costStep: 0,
        parents: ['shockwave_weapon'],
        childIds: ['shockwave_seismic_crush'],
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
        description: 'Shockwave deals +1 dmg/lvl for each enemy hit',
        popupText: 'RESONANCE FREQUENCY',
        popupColor: '#' + GAME_CONSTANTS.COLOR_HOSTILE.toString(16).padStart(6, '0'),
        maxLevel: 3,
        baseCost: 30,
        costType: 'data',
        costScaling: 'linear',
        costStep: 30,
        parents: ['shockwave_weapon'],
        childIds: ['shockwave_seismic_crush'],
        treeX: 520,
        treeY: 510,
        effect: function () {
            _recalcShockwaveStats();
        },
    },
    {
        id: 'shockwave_seismic_crush',
        name: 'SEISMIC CRUSH',
        icon: 'Skillicon14_06.png',
        description: 'Shockwave deals +50% damage per lvl to enemies below 50% HP',
        popupText: 'SEISMIC CRUSH',
        popupColor: '#' + GAME_CONSTANTS.COLOR_HOSTILE.toString(16).padStart(6, '0'),
        maxLevel: 2,
        baseCost: 50,
        costType: 'data',
        costScaling: 'linear',
        costStep: 50,
        parents: ['shockwave_amplifier', 'shockwave_resonance'],
        requiresMaxParent: true,
        childIds: [],
        treeX: 600,
        treeY: 550,
        effect: function () {
            _recalcShockwaveStats();
        },
    },
    {
        id: 'armor',
        name: 'SECURITY',
        icon: 'Skillicon14_11.png',
        description: 'Reduces incoming damage by 2.',
        popupText: '+2 ARMOR',
        popupColor: '#' + GAME_CONSTANTS.COLOR_FRIENDLY.toString(16).padStart(6, '0'),
        maxLevel: 1,
        baseCost: 50,
        costType: 'data',
        costScaling: 'static',
        costStep: 0,
        parents: ['placeholder_duo_1'],
        childIds: ['overclock', 'prismatic_array'],

        treeX: 400,
        treeY: 430,
        effect: function () {
            // Recalculated via 'upgradePurchased' → tower._onUpgradePurchased
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
        baseCost: 100,
        costType: 'data',
        costScaling: 'static',
        costStep: 0,
        parents: ['armor'],
        childIds: ['placeholder_duo_2'],
        treeX: 320,
        treeY: 390,
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
        baseCost: 50,
        costType: 'data',
        costScaling: 'linear',
        costStep: 50,
        parents: ['armor'],
        childIds: [],
        treeX: 480,
        treeY: 390,
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
        parents: ['crypto_mine_unlock'],
        childIds: [],
        treeX: 400,
        treeY: 910,
        effect: function () {
            // Recalculated via normal gameplay checks
        },
    },
    {
        id: 'test_reveal_1',
        name: 'TEST REVEAL 1',
        icon: 'Skillicon14_01.png',
        description: 'Testing revelation.',
        maxLevel: 1,
        baseCost: 1,
        costType: 'data',
        costScaling: 'static',
        parents: ['pulse_damage_3'],
        childIds: ['test_reveal_2'],
        treeX: 680,
        treeY: 550,
        effect: function () {
            if (!gameState.revealedNodes) gameState.revealedNodes = {};
            gameState.revealedNodes['test_reveal_2'] = true;
            gameState.revealedNodes['test_reveal_3'] = true;
            gameState.revealedNodes['test_reveal_4'] = true;
            gameState.revealedNodes['test_reveal_5'] = true;
        },
    },
    {
        id: 'test_reveal_2',
        name: 'TEST REVEAL 2',
        icon: 'Skillicon14_01.png',
        description: 'Testing revelation.',
        maxLevel: 1,
        baseCost: 1,
        costType: 'data',
        costScaling: 'static',
        parents: ['test_reveal_1'],
        childIds: ['test_reveal_3', 'test_reveal_2_1'],
        treeX: 680,
        treeY: 470,
        effect: function () { },
    },
    {
        id: 'test_reveal_2_1',
        name: 'BRANCH 1',
        icon: 'Skillicon14_11.png',
        description: 'Testing revelation branch.',
        maxLevel: 1,
        baseCost: 1,
        costType: 'data',
        costScaling: 'static',
        parents: ['test_reveal_2'],
        childIds: [],
        treeX: 760,
        treeY: 470,
        effect: function () { },
    },
    {
        id: 'test_reveal_3',
        name: 'TEST REVEAL 3',
        icon: 'Skillicon14_01.png',
        description: 'Testing revelation.',
        maxLevel: 1,
        baseCost: 1,
        costType: 'data',
        costScaling: 'static',
        parents: ['test_reveal_2'],
        childIds: ['test_reveal_4'],
        treeX: 680,
        treeY: 390,
        effect: function () { },
    },
    {
        id: 'test_reveal_4',
        name: 'TEST REVEAL 4',
        icon: 'Skillicon14_01.png',
        description: 'Testing revelation.',
        maxLevel: 1,
        baseCost: 1,
        costType: 'data',
        costScaling: 'static',
        parents: ['test_reveal_3'],
        childIds: ['test_reveal_5', 'test_reveal_4_1'],
        treeX: 680,
        treeY: 310,
        effect: function () { },
    },
    {
        id: 'test_reveal_4_1',
        name: 'BRANCH 2',
        icon: 'Skillicon14_13.png',
        description: 'Testing revelation branch.',
        maxLevel: 1,
        baseCost: 1,
        costType: 'data',
        costScaling: 'static',
        parents: ['test_reveal_4'],
        childIds: ['test_reveal_4_1_1'],
        treeX: 600,
        treeY: 310,
        effect: function () { },
    },
    {
        id: 'test_reveal_4_1_1',
        name: 'BRANCH 2A',
        icon: 'Skillicon14_01.png',
        description: 'Test node.',
        maxLevel: 1,
        baseCost: 1,
        costType: 'data',
        costScaling: 'static',
        parents: ['test_reveal_4_1'],
        childIds: [],
        treeX: 520,
        treeY: 310,
        effect: function () { },
    },
    {
        id: 'test_reveal_5',
        name: 'TEST REVEAL 5',
        icon: 'Skillicon14_01.png',
        description: 'Testing revelation.',
        maxLevel: 1,
        baseCost: 1,
        costType: 'data',
        costScaling: 'static',
        parents: ['test_reveal_4'],
        childIds: [],
        treeX: 680,
        treeY: 230,
        effect: function () { },
    },
    {
        id: 'placeholder_duo_2',
        isPlaceholder: true,
        parents: ['overclock'],
        monitorsDuoTier: 2,
        childIds: ['manual_pulse_child_1', 'pulse_aoe_child_1', 'pulse_aoe_child_2'],
        treeX: 320,
        treeY: 340,
        effect: function () { },
    },
    {
        id: 'manual_pulse',
        name: 'MANUAL PROTOCOL',
        icon: 'Skillicon14_02.png',
        description: 'Pulse attack is now manual. Click to fire. Stores up to 2 charges.',
        popupText: 'MANUAL PULSE UNLOCKED',
        popupColor: '#' + GAME_CONSTANTS.COLOR_HOSTILE.toString(16).padStart(6, '0'),
        maxLevel: 1,
        baseCost: 1,
        costType: 'shard',
        costScaling: 'static',
        parents: ['overclock'],
        childIds: ['manual_pulse_child_1'],
        isDuoBox: true,
        duoBoxTier: 2,
        shardId: 'manual_pulse',
        duoSiblingId: 'pulse_aoe',
        treeX: 290,
        treeY: 310,
        effect: function () {
            _recalcPulseMode();
            _recalcPulseSize();
        },
    },
    {
        id: 'pulse_aoe',
        name: 'RESONANCE AREA',
        icon: 'Skillicon14_07.png',
        description: '+30% pulse attack size.',
        popupText: '+30% PULSE AOE',
        popupColor: '#' + GAME_CONSTANTS.COLOR_HOSTILE.toString(16).padStart(6, '0'),
        maxLevel: 1,
        baseCost: 1,
        costType: 'shard',
        costScaling: 'static',
        parents: ['overclock'],
        childIds: ['pulse_aoe_child_1', 'pulse_aoe_child_2'],
        isDuoBox: true,
        duoBoxTier: 2,
        shardId: 'pulse_aoe',
        duoSiblingId: 'manual_pulse',
        treeX: 350,
        treeY: 310,
        effect: function () {
            _recalcPulseSize();
            _recalcPulseMode();
        },
    },
    {
        id: 'manual_pulse_child_1',
        name: 'CHARGE BUFFER',
        icon: 'Skillicon14_10.png',
        description: '+1 max pulse charges',
        maxLevel: 3,
        baseCost: 20,
        costType: 'data',
        costScaling: 'linear',
        costStep: 20,
        costStepScaling: 20,
        parents: ['manual_pulse'],
        childIds: [],
        treeX: 200,
        treeY: 310,
        effect: function () {
            _recalcPulseCharges();
        },
    },
    {
        id: 'pulse_aoe_child_1',
        name: '...',
        description: 'Searching for extra data.',
        maxLevel: 1,
        baseCost: 1,
        costType: 'data',
        costScaling: 'static',
        parents: ['pulse_aoe'],
        childIds: [],
        treeX: 310,
        treeY: 230,
        effect: function () { },
    },
    {
        id: 'pulse_aoe_child_2',
        name: '...',
        description: 'Searching for extra data.',
        maxLevel: 1,
        baseCost: 1,
        costType: 'data',
        costScaling: 'static',
        parents: ['pulse_aoe'],
        childIds: [],
        treeX: 390,
        treeY: 230,
        effect: function () { },
    },
];
