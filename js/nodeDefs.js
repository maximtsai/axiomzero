// nodeDefs.js — Neural Tree upgrade definitions.
// Centralized node data for the upgrade tree.
// Tree center X is at 400 (half of 800px panel width)

/** Recalculates total cursor damage from all pulse upgrade nodes. */
function _recalcPulseDamage() {
    const ups = gameState.upgrades || {};
    const ampLv = ups.pulse_damage || 0;
    const overchargeLv = ups.overcharge || 0;

    let base = 4 + 2 * ampLv + 4 * overchargeLv;

    // Apply Kinetic Amplifier bonus (manual_pulse_child_1_1)
    if (ups.manual_pulse_child_1_1) {
        base *= 1.5;
    }

    pulseAttack.setDamage(base);
}

/** Recalculates pulse recharge interval. */
function _recalcPulseRecharge() {
    const ups = gameState.upgrades || {};
    const intervalBonus = ups.manual_pulse_child_1_2 ? 0.75 : 1.0;
    pulseAttack.setFireInterval(2000 * intervalBonus);
}

/** Recalculates total pulse size from all pulse upgrade nodes. */
function _recalcPulseSize() {
    const ups = gameState.upgrades || {};
    const expansionLv = ups.pulse_expansion || 0;

    // Only apply Resonance Area size bonus if it is the active selection for Duo Tier 2
    const aoeActive = (gameState.activeShards && gameState.activeShards[2] === 'wide_pulse');
    const aoeBonus = aoeActive ? (ups.wide_pulse || 0) : 0;

    pulseAttack.setSize(100 * (1 + 0.2 * expansionLv + 0.3 * aoeBonus));
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

/** Recalculates packet sniffing state. */
function _recalcPacketSniffing() {
    const ups = gameState.upgrades || {};
    const hasSniffing = (ups.packet_sniffing || 0) > 0;
    resourceManager.setPacketSniffing(hasSniffing);
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

/** Recalculates threat response healing on boss spawn. */
function _recalcThreatResponse() {
    // Subscription handled in gameInit.js
}

const NODE_DEFS = [
    {
        id: 'awaken',
        name: 'AWAKEN',
        icon: 'Skillicon14_01.png',
        description: t('nodes', 'awaken.desc'),
        maxLevel: 1,
        baseCost: 0,
        costType: 'data',
        costScaling: 'static',
        costStep: 0,
        parents: [],
        childIds: ['basic_pulse', 'integrity', 'intensity', 'crypto_mine_unlock'],
        treeX: 400,
        treeY: 730,
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
        description: t('nodes', 'basic_pulse.desc'),
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
        treeY: 650,
        effect: function () {
            pulseAttack.unlock();
        },
    },
    {
        id: 'pulse_damage',
        name: 'CONCENTRATION',
        icon: 'Skillicon14_06.png',
        description: t('nodes', 'pulse_damage.desc'),
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
        treeY: 650,
        effect: function () {
            _recalcPulseDamage();
        },
    },
    {
        id: 'magnet',
        name: 'CONVERGENCE',
        icon: 'Skillicon14_10.png',
        description: t('nodes', 'magnet.desc'),
        popupText: '+40% PICKUP RANGE',
        popupColor: '#' + GAME_CONSTANTS.COLOR_RESOURCE.toString(16).padStart(6, '0'),
        maxLevel: 1,
        baseCost: 1,
        costType: 'insight',
        costScaling: 'static',
        costStep: 0,
        parents: ['basic_pulse'],
        childIds: ['regen'],
        treeX: 320,
        treeY: 650,
        effect: function () {
            resourceManager.recalcPickupRadius();
        },
    },
    {
        id: 'pulse_expansion',
        name: 'EXPANSION',
        icon: 'Skillicon14_07.png',
        description: t('nodes', 'pulse_expansion.desc'),
        popupText: '+20% CURSOR PULSE SIZE',
        popupColor: '#' + GAME_CONSTANTS.COLOR_HOSTILE.toString(16).padStart(6, '0'),
        maxLevel: 1,
        baseCost: 20,
        costType: 'data',
        costScaling: 'static',
        costStep: 0,
        parents: ['pulse_damage'],
        requiresMaxParent: true,
        childIds: ['packet_sniffing', 'farsight'],
        treeX: 560,
        treeY: 650,
        effect: function () {
            _recalcPulseSize();
        },
    },
    {
        id: 'overcharge',
        name: 'OVERCHARGE',
        icon: 'Skillicon14_08.png',
        description: t('nodes', 'overcharge.desc'),
        popupText: '+4 CURSOR DMG',
        popupColor: '#' + GAME_CONSTANTS.COLOR_HOSTILE.toString(16).padStart(6, '0'),
        maxLevel: 2,
        baseCost: 10,
        costType: 'data',
        costScaling: 'linear',
        costStep: 5,
        parents: ['armor', 'data_compression'],
        childIds: ['placeholder_duo_2'],

        treeX: 320,
        treeY: 410,
        effect: function () {
            _recalcPulseDamage();

            if (!gameState.unlockedNodes) gameState.unlockedNodes = {};
            gameState.unlockedNodes['armor'] = true;
        },
    },
    {
        id: 'integrity',
        name: 'INTEGRITY',
        icon: 'Skillicon14_03.png',
        description: t('nodes', 'integrity.desc'),
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
        treeY: 730,
        effect: function () {
            // Stats recalculated via 'upgradePurchased' → tower._onUpgradePurchased
        },
    },
    {
        id: 'intensity',
        name: 'INTENSITY',
        icon: 'Skillicon14_04.png',
        description: t('nodes', 'intensity.desc'),
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
        treeY: 730,
        effect: function () {
            // Stats recalculated via 'upgradePurchased' → tower._onUpgradePurchased
        },
    },
    {
        id: 'focus',
        name: 'INFLUENCE',
        icon: 'Skillicon14_15.png',
        description: t('nodes', 'focus.desc'),
        popupText: '+20% ATTACK RANGE',
        popupColor: '#' + GAME_CONSTANTS.COLOR_HOSTILE.toString(16).padStart(6, '0'),
        maxLevel: 1,
        baseCost: 50,
        costType: 'data',
        costScaling: 'static',
        costStep: 0,
        parents: ['intensity'],
        requiresMaxParent: true,
        childIds: ['farsight'],
        treeX: 560,
        treeY: 730,
        effect: function () {
            // Stats recalculated via 'upgradePurchased' → tower._onUpgradePurchased
        },
    },

    {
        id: 'farsight',
        name: 'FARSIGHT',
        icon: 'Skillicon14_12.png',
        description: t('nodes', 'farsight.desc'),
        maxLevel: 1,
        baseCost: 1,
        costType: 'insight',
        costScaling: 'static',
        parents: ['focus', 'pulse_expansion'],
        requiresMaxParent: true,
        childIds: [],
        treeX: 640,
        treeY: 690,
        effect: function () { },
    },
    {
        id: 'regen',
        name: 'RECOVERY',
        icon: 'Skillicon14_05.png',
        description: t('nodes', 'regen.desc'),
        popupText: '+0.2 REGEN',
        popupColor: '#' + GAME_CONSTANTS.COLOR_FRIENDLY.toString(16).padStart(6, '0'),
        maxLevel: 3,
        baseCost: 10,
        costType: 'data',
        costScaling: 'linear',
        costStep: 10,
        costStepScaling: 10,
        parents: ['integrity', 'magnet'],
        childIds: ['base_hp_boost', 'junk_data_3'],
        treeX: 240,
        treeY: 690,
        effect: function () {
            // Stats recalculated via 'upgradePurchased' → tower._onUpgradePurchased
        },
    },
    {
        id: 'junk_data_3',
        name: 'SLACK BITS',
        icon: 'Skillicon14_04.png',
        description: t('nodes', 'junk_data_3.desc'),
        popupText: '+1 DAMAGE',
        popupColor: '#' + GAME_CONSTANTS.COLOR_HOSTILE.toString(16).padStart(6, '0'),
        maxLevel: 1,
        baseCost: 15,
        costType: 'data',
        costScaling: 'static',
        parents: ['regen'],
        childIds: [],
        treeX: 200,
        treeY: 770,
        effect: function () {
            // Recalculated via 'upgradePurchased' → tower._onUpgradePurchased
        },
    },
    {
        id: 'crypto_mine_unlock',
        name: 'CRYPTO MINE',
        icon: 'Skillicon14_09.png',
        description: t('nodes', 'crypto_mine_unlock.desc'),
        popupText: 'MINE UNLOCKED',
        popupColor: '#' + GAME_CONSTANTS.COLOR_RESOURCE.toString(16).padStart(6, '0'),
        maxLevel: 1,
        baseCost: 0,
        costType: 'data',
        costScaling: 'static',
        costStep: 0,
        parents: ['awaken'],
        childIds: [],
        treeX: 400,
        treeY: 890,
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
        description: t('nodes', 'base_hp_boost.desc'),
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
        treeY: 610,
        effect: function () {
            // Stats recalculated via 'upgradePurchased' → tower._onUpgradePurchased
        },
    },
    {
        id: 'lore_1',
        name: 'ARCHIVE',
        icon: 'Skillicon14_09.png',
        description: t('nodes', 'lore_1.desc'),
        maxLevel: 1,
        baseCost: 1,
        costType: 'data',
        costScaling: 'static',
        parents: ['base_hp_boost'],
        childIds: ['lore_2'],
        treeX: 120,
        treeY: 690,
        tooltipExtraWidth: 300,
        effect: function () {
            const node = neuralTree.getNode('lore_1');
            if (node) {
                node.description = t('nodes', 'lore_1.unlocked_desc');
            }
        },
    },
    {
        id: 'lore_2',
        name: 'ARCHIVE II',
        icon: 'Skillicon14_09.png',
        description: t('nodes', 'lore_2.desc'),
        maxLevel: 1,
        baseCost: 1,
        costType: 'data',
        costScaling: 'static',
        parents: ['lore_1'],
        childIds: ['lore_3'],
        treeX: 40,
        treeY: 690,
        tooltipExtraWidth: 300,
        effect: function () {
            const node = neuralTree.getNode('lore_2');
            if (node) {
                node.description = t('nodes', 'lore_2.unlocked_desc');
            }
        },
    },
    {
        id: 'lore_3',
        name: 'ARCHIVE III',
        icon: 'Skillicon14_09.png',
        description: t('nodes', 'lore_3.desc'),
        maxLevel: 1,
        baseCost: 1,
        costType: 'data',
        costScaling: 'static',
        parents: ['lore_2'],
        childIds: ['lore_4'],
        treeX: 40,
        treeY: 610,
        tooltipExtraWidth: 300,
        effect: function () {
            const node = neuralTree.getNode('lore_3');
            if (node) {
                node.description = t('nodes', 'lore_3.unlocked_desc');
            }
        },
    },
    {
        id: 'lore_4',
        name: 'ARCHIVE IV',
        icon: 'Skillicon14_09.png',
        description: t('nodes', 'lore_4.desc'),
        maxLevel: 1,
        baseCost: 1,
        costType: 'data',
        costScaling: 'static',
        parents: ['lore_3'],
        childIds: ['lore_5'],
        treeX: 40,
        treeY: 530,
        tooltipExtraWidth: 300,
        effect: function () {
            const node = neuralTree.getNode('lore_4');
            if (node) {
                node.description = t('nodes', 'lore_4.unlocked_desc');
            }
        },
    },
    {
        id: 'lore_5',
        name: 'ARCHIVE V',
        icon: 'Skillicon14_09.png',
        description: t('nodes', 'lore_5.desc'),
        maxLevel: 1,
        baseCost: 1,
        costType: 'data',
        costScaling: 'static',
        parents: ['lore_4'],
        childIds: ['lore_6'],
        treeX: 40,
        treeY: 450,
        tooltipExtraWidth: 300,
        effect: function () {
            const node = neuralTree.getNode('lore_5');
            if (node) {
                node.description = t('nodes', 'lore_5.unlocked_desc');
            }
        },
    },
    {
        id: 'lore_6',
        name: 'ARCHIVE VI',
        icon: 'Skillicon14_09.png',
        description: t('nodes', 'lore_6.desc'),
        maxLevel: 1,
        baseCost: 1,
        costType: 'data',
        costScaling: 'static',
        parents: ['lore_5'],
        childIds: ['lore_7'],
        treeX: 40,
        treeY: 370,
        tooltipExtraWidth: 300,
        effect: function () {
            const node = neuralTree.getNode('lore_6');
            if (node) {
                node.description = t('nodes', 'lore_6.unlocked_desc');
            }
        },
    },
    {
        id: 'lore_7',
        name: 'ARCHIVE VII',
        icon: 'Skillicon14_09.png',
        description: t('nodes', 'lore_7.desc'),
        maxLevel: 1,
        baseCost: 1,
        costType: 'data',
        costScaling: 'static',
        parents: ['lore_6'],
        childIds: ['lore_8'],
        treeX: 40,
        treeY: 290,
        tooltipExtraWidth: 300,
        effect: function () {
            const node = neuralTree.getNode('lore_7');
            if (node) {
                node.description = t('nodes', 'lore_7.unlocked_desc');
            }
        },
    },
    {
        id: 'lore_8',
        name: 'ARCHIVE VIII',
        icon: 'Skillicon14_09.png',
        description: t('nodes', 'lore_8.desc'),
        maxLevel: 1,
        baseCost: 1,
        costType: 'data',
        costScaling: 'static',
        parents: ['lore_7'],
        childIds: ['lore_9'],
        treeX: 40,
        treeY: 210,
        tooltipExtraWidth: 300,
        effect: function () {
            const node = neuralTree.getNode('lore_8');
            if (node) {
                node.description = t('nodes', 'lore_8.unlocked_desc');
            }
        },
    },
    {
        id: 'lore_9',
        name: 'ARCHIVE IX',
        icon: 'Skillicon14_09.png',
        description: t('nodes', 'lore_9.desc'),
        maxLevel: 1,
        baseCost: 1,
        costType: 'data',
        costScaling: 'static',
        parents: ['lore_8'],
        childIds: [],
        treeX: 40,
        treeY: 130,
        tooltipExtraWidth: 300,
        effect: function () {
            const node = neuralTree.getNode('lore_9');
            if (node) {
                node.description = t('nodes', 'lore_9.unlocked_desc');
            }
        },
    },
    {
        id: 'resource_gate',
        name: 'FIREWALL',
        icon: 'Skillicon14_14.png',
        description: t('nodes', 'resource_gate.desc'),
        maxLevel: 1,
        baseCost: 200,
        costType: 'data',
        parents: ['base_hp_boost'],
        childIds: ['threat_response', 'junk_data_1'],
        treeX: 120,
        treeY: 530,
        tooltipExtraWidth: 60,
        effect: function () {
            resourceManager.addData(180);
        },
    },
    {
        id: 'threat_response',
        name: 'THREAT ADAPTATION',
        icon: 'Skillicon14_05.png',
        description: t('nodes', 'threat_response.desc'),
        popupText: 'THREAT ADAPTATION',
        popupColor: '#00ff66',
        maxLevel: 1,
        baseCost: 150,
        costType: 'data',
        costScaling: 'static',
        parents: ['resource_gate'],
        childIds: ['armor'],
        treeX: 160,
        treeY: 450,
        effect: function () {
            // Logic integrated into gameInit.js listeners
        },
    },
    {
        id: 'placeholder_duo_1',
        isPlaceholder: true,
        parents: ['basic_pulse'],
        monitorsDuoTier: 1,
        childIds: ['data_compression'],

        treeX: 400,
        treeY: 560,
        effect: function () { },
    },
    // ── Tier 1 Duo-Box: Lightning Weapon & Shockwave Weapon ──────────────
    {
        id: 'lightning_weapon',
        name: 'LIGHTNING',
        icon: 'Skillicon14_17.png',
        description: t('nodes', 'lightning_weapon.desc'),
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
        treeY: 530,
        effect: function () {
            lightningAttack.unlock();
            shockwaveAttack.lock();
        },
    },
    {
        id: 'shockwave_weapon',
        name: 'SHOCKWAVE',
        icon: 'Skillicon14_20.png',
        description: t('nodes', 'shockwave_weapon.desc'),
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
        treeY: 530,
        effect: function () {
            shockwaveAttack.unlock();
            lightningAttack.lock();
        },
    },
    {
        id: 'lightning_chain',
        name: 'FORK',
        icon: 'Skillicon14_17.png',
        description: t('nodes', 'lightning_chain.desc'),
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
        treeY: 570,
        effect: function () {
            _recalcLightningChains();
        },
    },
    {
        id: 'lightning_boost',
        name: 'VOLTAGE',
        icon: 'Skillicon14_18.png',
        description: t('nodes', 'lightning_boost.desc'),
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
        treeY: 490,
        effect: function () {
            _recalcLightningDamage();
        },
    },
    {
        id: 'lightning_static_charge',
        name: 'STATIC CHARGE',
        icon: 'Skillicon14_06.png',
        description: t('nodes', 'lightning_static_charge.desc'),
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
        treeY: 530,
        effect: function () {
            _recalcLightningDamage();
        },
    },
    {
        id: 'shockwave_amplifier',
        name: 'AMPLIFIER',
        icon: 'Skillicon14_21.png',
        description: t('nodes', 'shockwave_amplifier.desc'),
        popupText: '+30% RANGE',
        popupColor: '#' + GAME_CONSTANTS.COLOR_HOSTILE.toString(16).padStart(6, '0'),
        maxLevel: 1,
        baseCost: 40,
        costType: 'data',
        costScaling: 'static',
        costStep: 0,
        parents: ['shockwave_weapon'],
        childIds: ['shockwave_seismic_crush'],
        treeX: 520,
        treeY: 570,
        effect: function () {
            _recalcShockwaveStats();
        },
    },
    {
        id: 'shockwave_resonance',
        name: 'RESONANCE',
        icon: 'Skillicon14_22.png',
        description: t('nodes', 'shockwave_resonance.desc'),
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
        treeY: 490,
        effect: function () {
            _recalcShockwaveStats();
        },
    },
    {
        id: 'shockwave_seismic_crush',
        name: 'SEISMIC CRUSH',
        icon: 'Skillicon14_06.png',
        description: t('nodes', 'shockwave_seismic_crush.desc'),
        popupText: 'SEISMIC CRUSH',
        popupColor: '#' + GAME_CONSTANTS.COLOR_HOSTILE.toString(16).padStart(6, '0'),
        maxLevel: 2,
        baseCost: 100,
        costType: 'data',
        costScaling: 'linear',
        costStep: 100,
        parents: ['shockwave_amplifier', 'shockwave_resonance'],
        requiresMaxParent: true,
        childIds: [],
        treeX: 600,
        treeY: 530,
        effect: function () {
            _recalcShockwaveStats();
        },
    },
    {
        id: 'armor',
        name: 'SECURITY',
        icon: 'Skillicon14_11.png',
        description: t('nodes', 'armor.desc'),
        popupText: '+2 ARMOR',
        popupColor: '#' + GAME_CONSTANTS.COLOR_FRIENDLY.toString(16).padStart(6, '0'),
        maxLevel: 1,
        baseCost: 50,
        costType: 'data',
        costScaling: 'static',
        costStep: 0,
        parents: ['threat_response'],
        childIds: ['overcharge'],

        treeX: 240,
        treeY: 410,
        effect: function () {
            // Recalculated via 'upgradePurchased' → tower._onUpgradePurchased
        },
    },
    {
        id: 'overclock',
        name: 'OVERCLOCK',
        icon: 'Skillicon14_04.png',
        description: t('nodes', 'overclock.desc'),
        popupText: '-25% COOLDOWN',
        popupColor: '#' + GAME_CONSTANTS.COLOR_FRIENDLY.toString(16).padStart(6, '0'),
        maxLevel: 1,
        baseCost: 100,
        costType: 'data',
        costScaling: 'static',
        costStep: 0,
        parents: ['data_compression'],
        childIds: ['prismatic_array'],
        treeX: 480,
        treeY: 410,
        effect: function () {
            // Recalculated via messageBus 'upgradePurchased' → tower._onUpgradePurchased
        },
    },
    {
        id: 'prismatic_array',
        name: 'PRISMATIC ARRAY',
        icon: 'Skillicon14_12.png',
        description: t('nodes', 'prismatic_array.desc'),
        popupText: 'PRISMATIC ARRAY',
        popupColor: '#' + GAME_CONSTANTS.COLOR_FRIENDLY.toString(16).padStart(6, '0'),
        maxLevel: 4,
        baseCost: 50,
        costType: 'data',
        costScaling: 'linear',
        costStep: 50,
        parents: ['overclock'],
        childIds: [],
        treeX: 560,
        treeY: 410,
        effect: function () {
            // Recalculated via normal gameplay checks
        },
    },
    {
        id: 'data_compression',
        name: 'DATA COMPRESSION',
        icon: 'Skillicon14_19.png',
        description: t('nodes', 'data_compression.desc'),
        popupText: 'DATA COMPRESSION',
        popupColor: '#' + GAME_CONSTANTS.COLOR_RESOURCE.toString(16).padStart(6, '0'),
        maxLevel: 1,
        baseCost: 2,
        costType: 'insight',
        costScaling: 'static',
        costStep: 0,
        parents: ['placeholder_duo_1'],
        childIds: ['overcharge', 'overclock'],
        treeX: 400,
        treeY: 410,
        effect: function () {
            if (!gameState.revealedNodes) gameState.revealedNodes = {};
            gameState.revealedNodes['armor'] = true;
        },
    },
    {
        id: 'packet_sniffing',
        name: 'PACKET SNIFFING',
        icon: 'Skillicon14_13.png',
        description: t('nodes', 'packet_sniffing.desc'),
        popupText: 'SNIFFER ACTIVE',
        popupColor: '#' + GAME_CONSTANTS.COLOR_RESOURCE.toString(16).padStart(6, '0'),
        maxLevel: 1,
        baseCost: 1,
        costType: 'insight',
        costScaling: 'static',
        parents: ['pulse_expansion'],
        childIds: ['resource_gate_2', 'test_reveal_1'],
        treeX: 640,
        treeY: 610,
        effect: function () {
            _recalcPacketSniffing();
        },
    },
    {
        id: 'resource_gate_2',
        name: 'FIREWALL',
        icon: 'Skillicon14_14.png',
        description: t('nodes', 'resource_gate_2.desc'),
        maxLevel: 1,
        baseCost: 200,
        costType: 'data',
        parents: ['packet_sniffing'],
        childIds: ['test_reveal_2', 'junk_data_2'],
        treeX: 680,
        treeY: 530,
        tooltipExtraWidth: 60,
        effect: function () {
            resourceManager.addData(180);
        },
    },
    {
        id: 'test_reveal_1',
        name: 'TEST REVEAL 1',
        icon: 'Skillicon14_01.png',
        description: t('nodes', 'test_reveal_1.desc'),
        maxLevel: 1,
        baseCost: 1,
        costType: 'data',
        costScaling: 'static',
        parents: ['packet_sniffing'],
        childIds: [],
        treeX: 720,
        treeY: 610,
        effect: function () { },
    },
    {
        id: 'test_reveal_2',
        name: 'TEST REVEAL 2',
        icon: 'Skillicon14_01.png',
        description: t('nodes', 'test_reveal_2.desc'),
        maxLevel: 1,
        baseCost: 1,
        costType: 'data',
        costScaling: 'static',
        parents: ['resource_gate_2'],
        childIds: ['test_reveal_3'],
        treeX: 640,
        treeY: 450,
        effect: function () { },
    },
    {
        id: 'junk_data_1',
        name: 'FRAGMENT SALVAGE',
        icon: 'Skillicon14_10.png',
        description: t('nodes', 'junk_data_1.desc'),
        popupText: '+40 DATA RECOVERED',
        popupColor: '#' + GAME_CONSTANTS.COLOR_RESOURCE.toString(16).padStart(6, '0'),
        maxLevel: 1,
        baseCost: 10,
        costType: 'data',
        costScaling: 'static',
        parents: ['resource_gate'],
        childIds: [],
        treeX: 80,
        treeY: 450,
        effect: function () {
            resourceManager.addData(40);
        },
    },
    {
        id: 'junk_data_2',
        name: 'STALE CACHE',
        icon: 'Skillicon14_11.png',
        description: t('nodes', 'junk_data_2.desc'),
        popupText: '+2 MAX HEALTH',
        popupColor: '#' + GAME_CONSTANTS.COLOR_FRIENDLY.toString(16).padStart(6, '0'),
        maxLevel: 1,
        baseCost: 17,
        costType: 'data',
        costScaling: 'static',
        parents: ['resource_gate_2'],
        childIds: [],
        treeX: 720,
        treeY: 450,
        effect: function () {
            // Recalculated via 'upgradePurchased' → tower._onUpgradePurchased
        },
    },
    {
        id: 'test_reveal_3',
        name: 'TEST REVEAL 3',
        icon: 'Skillicon14_01.png',
        description: t('nodes', 'test_reveal_3.desc'),
        maxLevel: 1,
        baseCost: 1,
        costType: 'data',
        costScaling: 'static',
        parents: ['test_reveal_2'],
        childIds: ['test_reveal_4'],
        treeX: 680,
        treeY: 370,
        effect: function () { },
    },
    {
        id: 'test_reveal_4',
        name: 'TEST REVEAL 4',
        icon: 'Skillicon14_01.png',
        description: t('nodes', 'test_reveal_4.desc'),
        maxLevel: 1,
        baseCost: 1,
        costType: 'data',
        costScaling: 'static',
        parents: ['test_reveal_3'],
        childIds: [],
        treeX: 680,
        treeY: 290,
        effect: function () { },
    },
    {
        id: 'placeholder_duo_2',
        isPlaceholder: true,
        parents: ['overcharge'],
        monitorsDuoTier: 2,
        childIds: ['manual_pulse', 'wide_pulse'],
        treeX: 320,
        treeY: 320,
        effect: function () { },
    },
    {
        id: 'manual_pulse',
        name: 'MANUAL PROTOCOL',
        icon: 'Skillicon14_02.png',
        description: t('nodes', 'manual_pulse.desc'),
        popupText: 'MANUAL PULSE UNLOCKED',
        popupColor: '#' + GAME_CONSTANTS.COLOR_HOSTILE.toString(16).padStart(6, '0'),
        maxLevel: 1,
        baseCost: 1,
        costType: 'shard',
        costScaling: 'static',
        parents: ['overcharge'],
        childIds: ['manual_pulse_child_1'],
        isDuoBox: true,
        duoBoxTier: 2,
        shardId: 'manual_pulse',
        duoSiblingId: 'wide_pulse',
        treeX: 290,
        treeY: 290,
        effect: function () {
            _recalcPulseMode();
            _recalcPulseSize();
        },
    },
    {
        id: 'wide_pulse',
        name: 'RESONANCE AREA',
        icon: 'Skillicon14_07.png',
        description: t('nodes', 'wide_pulse.desc'),
        popupText: '+30% CURSOR PULSE SIZE',
        popupColor: '#' + GAME_CONSTANTS.COLOR_HOSTILE.toString(16).padStart(6, '0'),
        maxLevel: 1,
        baseCost: 1,
        costType: 'shard',
        costScaling: 'static',
        parents: ['overcharge'],
        childIds: ['wide_pulse_child_1', 'wide_pulse_child_2'],
        isDuoBox: true,
        duoBoxTier: 2,
        shardId: 'wide_pulse',
        duoSiblingId: 'manual_pulse',
        treeX: 350,
        treeY: 290,
        effect: function () {
            _recalcPulseSize();
            _recalcPulseMode();
        },
    },
    {
        id: 'manual_pulse_child_1',
        name: 'CHARGE BUFFER',
        icon: 'Skillicon14_10.png',
        description: t('nodes', 'manual_pulse_child_1.desc'),
        maxLevel: 3,
        baseCost: 20,
        costType: 'data',
        costScaling: 'linear',
        costStep: 20,
        costStepScaling: 20,
        parents: ['manual_pulse'],
        childIds: ['manual_pulse_child_1_1', 'manual_pulse_child_1_2'],
        treeX: 200,
        treeY: 290,
        effect: function () {
            _recalcPulseCharges();
        },
    },
    {
        id: 'manual_pulse_child_1_1',
        name: 'KINETIC AMPLIFIER',
        icon: 'Skillicon14_08.png',
        description: t('nodes', 'manual_pulse_child_1_1.desc'),
        maxLevel: 1,
        baseCost: 100,
        costType: 'data',
        costScaling: 'static',
        parents: ['manual_pulse_child_1'],
        childIds: [],
        treeX: 120,
        treeY: 250,
        effect: function () {
            _recalcPulseDamage();
        },
    },
    {
        id: 'manual_pulse_child_1_2',
        name: 'RECHARGE EFFICIENCY',
        icon: 'Skillicon14_04.png',
        description: t('nodes', 'manual_pulse_child_1_2.desc'),
        maxLevel: 1,
        baseCost: 100,
        costType: 'data',
        costScaling: 'static',
        parents: ['manual_pulse_child_1'],
        childIds: [],
        treeX: 120,
        treeY: 330,
        effect: function () {
            _recalcPulseRecharge();
        },
    },
    {
        id: 'wide_pulse_child_1',
        name: '...',
        description: t('nodes', 'wide_pulse_child_1.desc'),
        maxLevel: 1,
        baseCost: 1,
        costType: 'data',
        costScaling: 'static',
        parents: ['wide_pulse'],
        childIds: [],
        treeX: 310,
        treeY: 210,
        effect: function () { },
    },
    {
        id: 'wide_pulse_child_2',
        name: '...',
        description: t('nodes', 'wide_pulse_child_2.desc'),
        maxLevel: 1,
        baseCost: 1,
        costType: 'data',
        costScaling: 'static',
        parents: ['wide_pulse'],
        childIds: [],
        treeX: 390,
        treeY: 210,
        effect: function () { },
    },
];
