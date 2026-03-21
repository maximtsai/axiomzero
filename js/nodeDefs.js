// nodeDefs.js — Neural Tree upgrade definitions.
// Centralized node data for the upgrade tree.

// Tree Layout Constants
const TREE_CENTER_X = 400; // Half of 800px panel width
const TREE_START_Y = 730;
const TREE_UNIT_X = 80;
const TREE_UNIT_Y = 80;
const DUO_OFFSET = 30; // Standard offset for choice nodes

// Theme Colors for Popups/Effects
const COLORS = {
    COMBAT: '#' + GAME_CONSTANTS.COLOR_HOSTILE.toString(16).padStart(6, '0'),
    UTILITY: '#' + GAME_CONSTANTS.COLOR_FRIENDLY.toString(16).padStart(6, '0'),
    RESOURCE: '#' + GAME_CONSTANTS.COLOR_RESOURCE.toString(16).padStart(6, '0'),
    LORE: '#a2a2a2'
};

// Grid Helpers
const gridX = (units) => TREE_CENTER_X + TREE_UNIT_X * units;
const gridY = (units) => TREE_START_Y - TREE_UNIT_Y * units;

const NODE_DEFS = [
    {
        id: 'awaken',
        name: 'AWAKEN',
        icon: 'Skillicon14_31.png',
        description: t('nodes', 'awaken.desc'),
        maxLevel: 1,
        baseCost: 0,
        costType: 'data',
        costScaling: 'static',
        costStep: 0,
        parents: [],
        childIds: ['basic_pulse', 'integrity', 'intensity', 'crypto_mine_unlock'],
        treeX: gridX(0),
        treeY: gridY(0),
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
        icon: 'Skillicon14_01.png',
        description: t('nodes', 'basic_pulse.desc'),
        popupText: 'CURSOR ATTACK UNLOCKED',
        popupColor: COLORS.COMBAT,
        maxLevel: 1,
        baseCost: 1,
        costType: 'data',
        costScaling: 'static',
        costStep: 0,
        parents: ['awaken'],
        childIds: ['pulse_damage', 'magnet', 'lightning_weapon', 'shockwave_weapon', 'placeholder_duo_1'],
        treeX: gridX(0),
        treeY: gridY(1),
        effect: function () {
            pulseAttack.unlock();
        },
    },
    {
        id: 'pulse_damage',
        name: 'CONCENTRATION',
        icon: 'Skillicon14_13.png',
        description: t('nodes', 'pulse_damage.desc'),
        popupText: '+2 CURSOR DMG',
        popupColor: COLORS.COMBAT,
        maxLevel: 3,
        baseCost: 5,
        costType: 'data',
        costScaling: 'linear',
        costStep: 10,
        parents: ['basic_pulse'],
        childIds: ['pulse_expansion'],
        treeX: gridX(1),
        treeY: gridY(1),
        effect: function () {
            upgradeDispatcher.recalcPulseDamage();
        },
    },
    {
        id: 'magnet',
        name: 'CONVERGENCE',
        icon: 'Skillicon14_07.png',
        description: t('nodes', 'magnet.desc'),
        popupText: '+40% PICKUP RANGE',
        popupColor: COLORS.RESOURCE,
        maxLevel: 1,
        baseCost: 1,
        costType: 'insight',
        costScaling: 'static',
        costStep: 0,
        parents: ['basic_pulse'],
        childIds: ['regen'],
        treeX: gridX(-1),
        treeY: gridY(1),
        effect: function () {
            resourceManager.recalcPickupRadius();
        },
    },
    {
        id: 'pulse_expansion',
        name: 'SIGNAL STRENGTH',
        icon: 'Skillicon14_28.png',
        description: t('nodes', 'pulse_expansion.desc'),
        popupText: '+20% SIGNAL STRENGTH',
        popupColor: COLORS.COMBAT,
        maxLevel: 1,
        baseCost: 40,
        costType: 'data',
        costScaling: 'static',
        costStep: 0,
        parents: ['pulse_damage'],
        requiresMaxParent: true,
        childIds: ['packet_sniffing'],
        treeX: gridX(2),
        treeY: gridY(1),
        effect: function () {
            upgradeDispatcher.recalcPulseSize();
        },
    },
    {
        id: 'overcharge',
        name: 'OVERCHARGE',
        icon: 'Skillicon14_02.png',
        description: t('nodes', 'overcharge.desc'),
        popupText: '+4 CURSOR DMG',
        popupColor: COLORS.COMBAT,
        maxLevel: 1,
        baseCost: 100,
        costType: 'data',
        costScaling: 'static',
        costStep: 0,
        parents: ['data_compression'],
        childIds: ['placeholder_duo_2', 'armor'],

        treeX: gridX(-1),
        treeY: gridY(4),
        effect: function () {
            upgradeDispatcher.recalcPulseDamage();

            if (!gameState.unlockedNodes) gameState.unlockedNodes = {};
            gameState.unlockedNodes['armor'] = true;
        },
    },
    {
        id: 'integrity',
        name: 'INTEGRITY',
        icon: 'Skillicon14_16.png',
        description: t('nodes', 'integrity.desc'),
        popupText: '+4 MAX HEALTH',
        popupColor: COLORS.UTILITY,
        maxLevel: 6,
        baseCost: 4,
        costType: 'data',
        costScaling: 'linear',
        costStep: 4,
        costStepScaling: 4,
        parents: ['awaken'],
        childIds: ['regen'],
        treeX: gridX(-1),
        treeY: gridY(0),
        effect: function () {
            // Stats recalculated via 'upgradePurchased' → tower._onUpgradePurchased
        },
    },
    {
        id: 'intensity',
        name: 'INTENSITY',
        icon: 'Skillicon14_26.png',
        description: t('nodes', 'intensity.desc'),
        popupText: '+2 DAMAGE',
        popupColor: COLORS.COMBAT,
        maxLevel: 6,
        baseCost: 5,
        costType: 'data',
        costScaling: 'linear',
        costStep: 5,
        costStepScaling: 5,
        parents: ['awaken'],
        childIds: ['focus'],
        treeX: gridX(1),
        treeY: gridY(0),
        effect: function () {
            // Stats recalculated via 'upgradePurchased' → tower._onUpgradePurchased
        },
    },
    {
        id: 'focus',
        name: 'COVERAGE',
        icon: 'Skillicon14_23.png',
        description: t('nodes', 'focus.desc'),
        popupText: '+20% ATTACK RANGE',
        popupColor: COLORS.COMBAT,
        maxLevel: 1,
        baseCost: 50,
        costType: 'data',
        costScaling: 'static',
        costStep: 0,
        parents: ['intensity'],
        requiresMaxParent: true,
        childIds: [],
        treeX: gridX(2),
        treeY: gridY(0),
        effect: function () {
            // Stats recalculated via 'upgradePurchased' → tower._onUpgradePurchased
        },
    },

    {
        id: 'regen',
        name: 'AUTO-RESTORE',
        icon: 'Skillicon14_11.png',
        description: t('nodes', 'regen.desc'),
        popupText: '+0.2 REGEN',
        popupColor: COLORS.UTILITY,
        maxLevel: 3,
        baseCost: 10,
        costType: 'data',
        costScaling: 'linear',
        costStep: 10,
        costStepScaling: 10,
        parents: ['integrity', 'magnet'],
        childIds: ['lore_1'],
        treeX: gridX(-2),
        treeY: gridY(0.5),
        effect: function () {
            // Stats recalculated via 'upgradePurchased' → tower._onUpgradePurchased
        },
    },

    {
        id: 'crypto_mine_unlock',
        name: 'CRYPTO MINE',
        icon: 'Skillicon14_35.png',
        description: t('nodes', 'crypto_mine_unlock.desc'),
        popupText: 'MINE UNLOCKED',
        popupColor: COLORS.RESOURCE,
        maxLevel: 1,
        baseCost: 0,
        costType: 'data',
        costScaling: 'static',
        costStep: 0,
        parents: ['awaken'],
        childIds: [],
        treeX: gridX(0),
        treeY: gridY(-2),
        effect: function () {
            if (typeof neuralTree !== 'undefined') {
                neuralTree._showCryptoMineButton();
            }
        },
    },
    {
        id: 'base_hp_boost',
        name: 'SYSTEM REDUNDANCY',
        icon: 'Skillicon14_18.png',
        description: t('nodes', 'base_hp_boost.desc'),
        popupText: '+10 MAX HEALTH',
        popupColor: '#' + GAME_CONSTANTS.COLOR_FRIENDLY.toString(16).padStart(6, '0'),
        maxLevel: 1,
        baseCost: 150,
        costType: 'data',
        costScaling: 'static',
        costStep: 0,
        parents: ['three_step_auth', 'backdoor_3'],
        childIds: ['temp_node'],

        treeX: gridX(3),
        treeY: gridY(5.5),
        effect: function () {
            // Stats recalculated via 'upgradePurchased' → tower._onUpgradePurchased
        },
    },
    {
        id: 'lore_1',
        name: 'ARCHIVE',
        lore: true,
        icon: 'Skillicon14_08.png',
        description: t('nodes', 'lore_1.desc'),
        maxLevel: 1,
        baseCost: 1,
        costType: 'data',
        costScaling: 'static',
        parents: ['regen'],
        childIds: [],
        treeX: gridX(-3),
        treeY: gridY(0.5),
        requiresMaxParent: true,
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
        lore: true,
        icon: 'Skillicon14_08.png',
        description: t('nodes', 'lore_2.desc'),
        maxLevel: 1,
        baseCost: 1,
        costType: 'data',
        costScaling: 'static',
        parents: ['threat_response'],
        childIds: ['lore_3'],
        treeX: gridX(-4),
        treeY: gridY(4),
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
        lore: true,
        icon: 'Skillicon14_08.png',
        description: t('nodes', 'lore_3.desc'),
        maxLevel: 1,
        baseCost: 1,
        costType: 'data',
        costScaling: 'static',
        parents: ['lore_2'],
        childIds: ['lore_4'],
        treeX: gridX(-4.5),
        treeY: gridY(1.5),
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
        lore: true,
        icon: 'Skillicon14_08.png',
        description: t('nodes', 'lore_4.desc'),
        maxLevel: 1,
        baseCost: 1,
        costType: 'data',
        costScaling: 'static',
        parents: ['lore_3'],
        childIds: ['lore_5'],
        treeX: gridX(-4.5),
        treeY: gridY(2.5),
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
        lore: true,
        icon: 'Skillicon14_08.png',
        description: t('nodes', 'lore_5.desc'),
        maxLevel: 1,
        baseCost: 1,
        costType: 'data',
        costScaling: 'static',
        parents: ['lore_4'],
        childIds: ['lore_6'],
        treeX: gridX(-4.5),
        treeY: gridY(3.5),
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
        lore: true,
        icon: 'Skillicon14_08.png',
        description: t('nodes', 'lore_6.desc'),
        maxLevel: 1,
        baseCost: 1,
        costType: 'data',
        costScaling: 'static',
        parents: ['lore_5'],
        childIds: ['lore_7'],
        treeX: gridX(-4.5),
        treeY: gridY(4.5),
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
        lore: true,
        icon: 'Skillicon14_08.png',
        description: t('nodes', 'lore_7.desc'),
        maxLevel: 1,
        baseCost: 1,
        costType: 'data',
        costScaling: 'static',
        parents: ['lore_6'],
        childIds: ['lore_8'],
        treeX: gridX(-4.5),
        treeY: gridY(5.5),
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
        lore: true,
        icon: 'Skillicon14_08.png',
        description: t('nodes', 'lore_8.desc'),
        maxLevel: 1,
        baseCost: 1,
        costType: 'data',
        costScaling: 'static',
        parents: ['lore_7'],
        childIds: ['lore_9'],
        treeX: gridX(-4.5),
        treeY: gridY(6.5),
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
        lore: true,
        icon: 'Skillicon14_08.png',
        description: t('nodes', 'lore_9.desc'),
        maxLevel: 1,
        baseCost: 1,
        costType: 'data',
        costScaling: 'static',
        parents: ['lore_8'],
        childIds: [],
        treeX: gridX(-4.5),
        treeY: gridY(7.5),
        tooltipExtraWidth: 300,
        effect: function () {
            const node = neuralTree.getNode('lore_9');
            if (node) {
                node.description = t('nodes', 'lore_9.unlocked_desc');
            }
        },
    },

    {
        id: 'threat_response',
        name: 'RECOVERY PROTOCOL',
        icon: 'Skillicon14_27.png',
        description: t('nodes', 'threat_response.desc'),
        popupText: '+HEAL ON BOSS',
        popupColor: COLORS.UTILITY,
        maxLevel: 1,
        baseCost: 200,
        costType: 'data',
        costScaling: 'static',
        parents: ['armor'],
        childIds: ['lore_2'],
        treeX: gridX(-3),
        treeY: gridY(4),
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

        treeX: gridX(0),
        treeY: gridY(2.125), // Mid-point adjustment (non-clean)
        effect: function () { },
    },
    // ── Tier 1 Duo-Box: Lightning Weapon & Shockwave Weapon ──────────────
    {
        id: 'lightning_weapon',
        name: 'LIGHTNING',
        icon: 'Skillicon14_33.png',
        description: t('nodes', 'lightning_weapon.desc'),
        popupText: 'LIGHTNING WEAPON',
        popupColor: COLORS.COMBAT,
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
        treeX: gridX(0) - DUO_OFFSET, // Symmetric Duo offset (standardized)
        treeY: gridY(2.5),
        effect: function () {
            lightningAttack.unlock();
            shockwaveAttack.lock();
        },
    },
    {
        id: 'shockwave_weapon',
        name: 'SHOCKWAVE',
        icon: 'Skillicon14_37.png',
        description: t('nodes', 'shockwave_weapon.desc'),
        popupText: 'SHOCKWAVE WEAPON',
        popupColor: COLORS.COMBAT,
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
        treeX: gridX(0) + DUO_OFFSET, // Symmetric Duo offset (standardized)
        treeY: gridY(2.5),
        effect: function () {
            shockwaveAttack.unlock();
            lightningAttack.lock();
        },
    },
    {
        id: 'lightning_chain',
        name: 'FORK',
        icon: 'Skillicon14_40.png',
        description: t('nodes', 'lightning_chain.desc'),
        popupText: '+1 CHAIN',
        popupColor: COLORS.COMBAT,
        maxLevel: 1,
        baseCost: 100,
        costType: 'data',
        costScaling: 'static',
        costStep: 0,
        parents: ['lightning_weapon'],
        childIds: ['lightning_static_charge'],
        treeX: gridX(-1.5),
        treeY: gridY(2),
        effect: function () {
            upgradeDispatcher.recalcLightningChains();
        },
    },
    {
        id: 'lightning_boost',
        name: 'VOLTAGE',
        icon: 'Skillicon14_03.png',
        description: t('nodes', 'lightning_boost.desc'),
        popupText: '+2 LIGHTNING DMG',
        popupColor: COLORS.COMBAT,
        maxLevel: 3,
        baseCost: 30,
        costType: 'data',
        costScaling: 'linear',
        costStep: 30,
        parents: ['lightning_weapon'],
        childIds: ['lightning_static_charge'],
        treeX: gridX(-1.5),
        treeY: gridY(3),
        effect: function () {
            upgradeDispatcher.recalcLightningDamage();
        },
    },
    {
        id: 'lightning_static_charge',
        name: 'INITIAL SHOCK',
        icon: 'Skillicon14_10.png',
        description: t('nodes', 'lightning_static_charge.desc'),
        popupText: 'INITIAL SHOCK',
        popupColor: COLORS.COMBAT,
        maxLevel: 2,
        baseCost: 100,
        costType: 'data',
        costScaling: 'linear',
        costStep: 100,
        parents: ['lightning_boost', 'lightning_chain'],
        requiresMaxParent: true,
        childIds: [],
        treeX: gridX(-2.5),
        treeY: gridY(2.5),
        effect: function () {
            upgradeDispatcher.recalcLightningDamage();
        },
    },
    {
        id: 'shockwave_amplifier',
        name: 'AMPLIFIER',
        icon: 'Skillicon14_28.png',
        description: t('nodes', 'shockwave_amplifier.desc'),
        popupText: '+25% RANGE',
        popupColor: COLORS.COMBAT,
        maxLevel: 1,
        baseCost: 50,
        costType: 'data',
        costScaling: 'static',
        costStep: 0,
        parents: ['shockwave_weapon'],
        childIds: ['shockwave_seismic_crush'],
        treeX: gridX(1.5),
        treeY: gridY(2),
        effect: function () {
            upgradeDispatcher.recalcShockwaveStats();
        },
    },
    {
        id: 'shockwave_resonance',
        name: 'RESONANCE',
        icon: 'Skillicon14_39.png',
        description: t('nodes', 'shockwave_resonance.desc'),
        popupText: 'RESONANCE FREQUENCY',
        popupColor: COLORS.COMBAT,
        maxLevel: 3,
        baseCost: 40,
        costType: 'data',
        costScaling: 'linear',
        costStep: 40,
        parents: ['shockwave_weapon'],
        childIds: ['shockwave_seismic_crush'],
        treeX: gridX(1.5),
        treeY: gridY(3),
        effect: function () {
            upgradeDispatcher.recalcShockwaveStats();
        },
    },
    {
        id: 'shockwave_seismic_crush',
        name: 'SEISMIC CRUSH',
        icon: 'Skillicon14_19.png',
        description: t('nodes', 'shockwave_seismic_crush.desc'),
        popupText: 'SEISMIC CRUSH',
        popupColor: COLORS.COMBAT,
        maxLevel: 2,
        baseCost: 100,
        costType: 'data',
        costScaling: 'linear',
        costStep: 100,
        parents: ['shockwave_amplifier', 'shockwave_resonance'],
        requiresMaxParent: true,
        childIds: [],
        treeX: gridX(2.5),
        treeY: gridY(2.5),
        effect: function () {
            upgradeDispatcher.recalcShockwaveStats();
        },
    },
    {
        id: 'armor',
        name: 'RESILIENCE',
        icon: 'Skillicon14_18.png',
        description: t('nodes', 'armor.desc'),
        popupText: '+2 RESILIENCE',
        popupColor: COLORS.UTILITY,
        maxLevel: 1,
        baseCost: 150,
        costType: 'data',
        costScaling: 'static',
        costStep: 0,
        parents: ['overcharge'],
        childIds: ['threat_response'],

        treeX: gridX(-2),
        treeY: gridY(4),
        effect: function () {
            // Recalculated via 'upgradePurchased' → tower._onUpgradePurchased
        },
    },
    {
        id: 'overclock',
        name: 'OVERCLOCK',
        icon: 'Skillicon14_05.png',
        description: t('nodes', 'overclock.desc'),
        popupText: '-5% COOLDOWN',
        popupColor: COLORS.UTILITY,
        maxLevel: 4,
        baseCost: 50,
        costType: 'data',
        costScaling: 'linear',
        costStep: 50,
        parents: ['forgotten_backdoor', 'two_step_auth'],
        childIds: ['three_step_auth'],
        treeX: gridX(3),
        treeY: gridY(4.5),
        effect: function () {
            // Recalculated via messageBus 'upgradePurchased' → tower._onUpgradePurchased
        },
    },
    {
        id: 'three_step_auth',
        name: 'THREE-STEP AUTH',
        icon: 'Skillicon14_10.png',
        description: t('nodes', 'three_step_auth.desc'),
        popupText: '+200 DATA',
        popupColor: COLORS.RESOURCE,
        maxLevel: 1,
        baseCost: 1,
        costType: 'insight',
        costScaling: 'static',
        parents: ['overclock'],
        childIds: ['base_hp_boost'],
        tooltipExtraWidth: 60,
        treeX: gridX(2),
        treeY: gridY(5),
        effect: function () {
            if (typeof resourceManager !== 'undefined') {
                resourceManager.addData(200);
            }
        },
    },
    {

        id: 'prismatic_array',
        name: 'PRISMATIC ARRAY',
        icon: 'Skillicon14_30.png',
        description: t('nodes', 'prismatic_array.desc'),
        popupText: 'PRISMATIC ARRAY',
        popupColor: COLORS.UTILITY,
        maxLevel: 5,
        baseCost: 50,
        costType: 'data',
        costScaling: 'linear',
        costStep: 50,
        parents: ['security_test_2'],
        childIds: ['temp_node_5'],
        treeX: gridX(-1.5),
        treeY: gridY(8),
        effect: function () {
            // Recalculated via normal gameplay checks
        },
    },
    {
        id: 'temp_node_5',
        name: 'TEMP PROCESS 5',
        icon: 'Skillicon14_09.png',
        description: t('nodes', 'temp_node_5.desc'),
        maxLevel: 1,
        baseCost: 0,
        costType: 'data',
        costScaling: 'static',
        parents: ['prismatic_array'],
        childIds: [],
        treeX: gridX(-2.5),
        treeY: gridY(8),
        effect: function () { },
    },
    {
        id: 'data_compression',
        name: 'DATA COMPRESSION',
        icon: 'Skillicon14_20.png',
        description: t('nodes', 'data_compression.desc'),
        popupText: 'DATA COMPRESSION',
        popupColor: COLORS.RESOURCE,
        maxLevel: 1,
        baseCost: 2,
        costType: 'insight',
        costScaling: 'static',
        costStep: 0,
        parents: ['placeholder_duo_1'],
        childIds: ['overcharge', 'security_test_1'],
        treeX: gridX(0),
        treeY: gridY(4),
        effect: function () { },
    },
    {
        id: 'security_test_1',
        name: 'SECURITY TEST',
        icon: 'Skillicon14_38.png',
        description: t('nodes', 'security_test_1.desc'),
        popupText: 'TEST PASSED',
        popupColor: COLORS.RESOURCE,
        maxLevel: 1,
        baseCost: 250,
        costType: 'data',
        costScaling: 'static',
        parents: ['data_compression'],
        childIds: ['two_step_auth'],
        treeX: gridX(1),
        treeY: gridY(4),
        tooltipExtraWidth: 40,
        effect: function () {
            if (typeof resourceManager !== 'undefined') {
                resourceManager.addData(250);
            }
        },
    },
    {
        id: 'two_step_auth',
        name: 'TWO-STEP AUTH',
        icon: 'Skillicon14_10.png',
        description: t('nodes', 'two_step_auth.desc'),
        popupText: '+100 DATA',
        popupColor: COLORS.RESOURCE,
        maxLevel: 1,
        baseCost: 1,
        costType: 'insight',
        costScaling: 'static',
        parents: ['security_test_1'],
        childIds: ['overclock'],
        tooltipExtraWidth: 40,
        treeX: gridX(2),
        treeY: gridY(4),
        effect: function () {
            if (typeof resourceManager !== 'undefined') {
                resourceManager.addData(100);
            }
        },
    },
    {
        id: 'packet_sniffing',
        name: 'PACKET SNIFFING',
        icon: 'Skillicon14_01.png',
        description: t('nodes', 'packet_sniffing.desc'),
        popupText: 'SNIFFER ACTIVE',
        popupColor: COLORS.RESOURCE,
        maxLevel: 1,
        baseCost: 1,
        costType: 'insight',
        costScaling: 'static',
        parents: ['pulse_expansion'],
        childIds: ['junk_barrier'],
        treeX: gridX(3),
        treeY: gridY(1.5),
        effect: function () {
            upgradeDispatcher.recalcPacketSniffing();
        },
    },
    {
        id: 'junk_barrier',
        name: 'UNSORTED LOGS',
        icon: 'Skillicon14_06.png',
        description: t('nodes', 'junk_barrier.desc'),
        maxLevel: 5,
        baseCost: 10,
        costType: 'data',
        costScaling: 'static',
        parents: ['packet_sniffing'],
        childIds: ['forgotten_backdoor', 'junk_data_2'],
        treeX: gridX(3.5),
        treeY: gridY(2.5),
        tooltipExtraWidth: 60,
        effect: function () {
            // No longer refunds anything
        },
    },
    {
        id: 'forgotten_backdoor',
        name: 'FORGOTTEN BACKDOOR',
        icon: 'Skillicon14_09.png',
        description: t('nodes', 'forgotten_backdoor.desc'),
        maxLevel: 1,
        baseCost: 1,
        costType: 'data',
        requiresMaxParent: true,
        costScaling: 'static',
        parents: ['junk_barrier'],
        childIds: ['backdoor_2', 'overclock'],
        treeX: gridX(3.5),
        treeY: gridY(3.5),
        effect: function () { },
    },

    {
        id: 'junk_data_2',
        name: 'JUNK PROCESSING',
        icon: 'Skillicon14_12.png',
        description: t('nodes', 'junk_data_2.desc'),
        popupText: '+10 DATA',
        popupColor: COLORS.RESOURCE,
        maxLevel: 10,
        baseCost: 2,
        costType: 'data',
        costScaling: 'static',
        requiresMaxParent: true,
        parents: ['junk_barrier'],
        childIds: [],
        treeX: gridX(4),
        treeY: gridY(1.5),
        effect: function () {
            if (typeof resourceManager !== 'undefined') {
                resourceManager.addData(10);
            }
        },
    },
    {
        id: 'backdoor_2',
        name: 'BACKDOOR 2',
        icon: 'Skillicon14_09.png',
        description: t('nodes', 'backdoor_2.desc'),
        maxLevel: 1,
        baseCost: 1,
        costType: 'data',
        costScaling: 'static',
        parents: ['forgotten_backdoor'],
        childIds: ['backdoor_3'],
        treeX: gridX(4),
        treeY: gridY(4.5),
        effect: function () { },
    },
    {
        id: 'backdoor_3',
        name: 'BACKDOOR 3',
        icon: 'Skillicon14_09.png',
        description: t('nodes', 'backdoor_3.desc'),
        maxLevel: 1,
        baseCost: 1,
        costType: 'data',
        costScaling: 'static',
        parents: ['backdoor_2'],
        childIds: ['backdoor_4', 'base_hp_boost'],
        treeX: gridX(4),
        treeY: gridY(5.5),
        effect: function () { },
    },
    {
        id: 'backdoor_4',
        name: 'BACKDOOR 4',
        icon: 'Skillicon14_09.png',
        description: t('nodes', 'backdoor_4.desc'),
        maxLevel: 1,
        baseCost: 1,
        costType: 'data',
        costScaling: 'static',
        parents: ['backdoor_3'],
        childIds: ['unsecured_files', 'temp_node'],
        treeX: gridX(4),
        treeY: gridY(6.5),
        effect: function () { },
    },
    {
        id: 'temp_node',
        name: 'TEMP PROCESS',
        icon: 'Skillicon14_09.png',
        description: t('nodes', 'temp_node.desc'),
        maxLevel: 1,
        baseCost: 0,
        costType: 'data',
        costScaling: 'static',
        parents: ['backdoor_4', 'base_hp_boost'],
        childIds: ['temp_node_2'],
        treeX: gridX(3.0),
        treeY: gridY(6.5),
        effect: function () { },
    },
    {
        id: 'temp_node_2',
        name: 'TEMP PROCESS 2',
        icon: 'Skillicon14_09.png',
        description: t('nodes', 'temp_node_2.desc'),
        maxLevel: 1,
        baseCost: 0,
        costType: 'data',
        costScaling: 'static',
        parents: ['temp_node'],
        childIds: ['temp_node_3'],
        treeX: gridX(2.0),
        treeY: gridY(7),
        effect: function () { },
    },
    {
        id: 'temp_node_3',
        name: 'TEMP PROCESS 3',
        icon: 'Skillicon14_09.png',
        description: t('nodes', 'temp_node_3.desc'),
        maxLevel: 1,
        baseCost: 0,
        costType: 'data',
        costScaling: 'static',
        parents: ['temp_node_2'],
        childIds: [],
        treeX: gridX(1.0),
        treeY: gridY(7),
        effect: function () { },
    },
    {
        id: 'temp_node_4',
        name: 'TEMP PROCESS 4',
        icon: 'Skillicon14_09.png',
        description: t('nodes', 'temp_node_4.desc'),
        maxLevel: 1,
        baseCost: 0,
        costType: 'data',
        costScaling: 'static',
        parents: ['security_test_2'],
        childIds: [],
        treeX: gridX(0.0),
        treeY: gridY(7),
        effect: function () { },
    },
    {

        id: 'unsecured_files',
        name: 'UNSECURED FILES',
        icon: 'Skillicon14_08.png',
        description: t('nodes', 'unsecured_files.desc'),
        popupText: '+15 DATA',
        popupColor: COLORS.RESOURCE,
        maxLevel: 10,
        baseCost: 1,
        costType: 'data',
        costScaling: 'static',
        parents: ['backdoor_4'],
        childIds: [],
        treeX: gridX(4),
        treeY: gridY(7.5),
        effect: function () {
            if (typeof resourceManager !== 'undefined') {
                resourceManager.addData(15);
            }
        },
    },
    {
        id: 'placeholder_duo_2',
        isPlaceholder: true,
        parents: ['overcharge'],
        monitorsDuoTier: 2,
        childIds: ['manual_pulse', 'wide_pulse', 'security_test_2'],
        treeX: gridX(-1),
        treeY: gridY(5.5),
        effect: function () { },
    },
    {
        id: 'security_test_2',
        name: 'SECURITY TEST 2',
        icon: 'Skillicon14_38.png',
        description: t('nodes', 'security_test_2.desc'),
        maxLevel: 1,
        baseCost: 1000,
        costType: 'data',
        costScaling: 'static',
        parents: ['placeholder_duo_2'],
        childIds: ['prismatic_array', 'temp_node_4'],
        treeX: gridX(-1),
        treeY: gridY(7),
        tooltipExtraWidth: 60,
        effect: function () {
            if (typeof resourceManager !== 'undefined') {
                resourceManager.addData(900);
            }
        },
    },
    {
        id: 'manual_pulse',
        name: 'MANUAL PROTOCOL',
        icon: 'Skillicon14_34.png',
        description: t('nodes', 'manual_pulse.desc'),
        popupText: 'MANUAL PULSE UNLOCKED',
        popupColor: COLORS.COMBAT,
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
        treeX: gridX(-1) - DUO_OFFSET, // Symmetric Duo offset (standardized)
        treeY: gridY(5.5),
        effect: function () {
            upgradeDispatcher.recalcPulseMode();
            upgradeDispatcher.recalcPulseSize();
        },
    },
    {
        id: 'wide_pulse',
        name: 'BROADCAST PROTOCOL',
        icon: 'Skillicon14_28.png',
        description: t('nodes', 'wide_pulse.desc'),
        popupText: '+30% CURSOR PULSE SIZE',
        popupColor: COLORS.COMBAT,
        maxLevel: 1,
        baseCost: 1,
        costType: 'shard',
        costScaling: 'static',
        parents: ['overcharge'],
        childIds: ['wide_pulse_child_1', 'aftershock'],
        isDuoBox: true,
        duoBoxTier: 2,
        shardId: 'wide_pulse',
        duoSiblingId: 'manual_pulse',
        treeX: gridX(-1) + DUO_OFFSET, // Symmetric Duo offset (standardized)
        treeY: gridY(5.5),
        effect: function () {
            upgradeDispatcher.recalcPulseSize();
            upgradeDispatcher.recalcPulseMode();
        },
    },
    {
        id: 'manual_pulse_child_1',
        name: 'CHARGE BUFFER',
        icon: 'Skillicon14_33.png',
        description: t('nodes', 'manual_pulse_child_1.desc'),
        maxLevel: 3,
        baseCost: 20,
        costType: 'data',
        costScaling: 'linear',
        costStep: 20,
        costStepScaling: 20,
        parents: ['manual_pulse'],
        childIds: ['manual_pulse_child_1_1', 'manual_pulse_child_1_2'],
        treeX: gridX(-2.5),
        treeY: gridY(5.5),
        effect: function () {
            upgradeDispatcher.recalcPulseCharges();
        },
    },
    {
        id: 'manual_pulse_child_1_1',
        name: 'ISOLATION',
        icon: 'Skillicon14_25.png',
        description: t('nodes', 'manual_pulse_child_1_1.desc'),
        maxLevel: 4,
        baseCost: 100,
        costType: 'data',
        costScaling: 'linear',
        costStep: 100,
        parents: ['manual_pulse_child_1'],
        childIds: [],
        treeX: gridX(-3.5),
        treeY: gridY(6),
        effect: function () {
            upgradeDispatcher.recalcPulseDamage();
        },
    },
    {
        id: 'manual_pulse_child_1_2',
        name: 'RELOAD EFFICIENCY',
        icon: 'Skillicon14_17.png',
        description: t('nodes', 'manual_pulse_child_1_2.desc'),
        maxLevel: 1,
        baseCost: 100,
        costType: 'data',
        costScaling: 'static',
        parents: ['manual_pulse_child_1'],
        childIds: [],
        treeX: gridX(-3.5),
        treeY: gridY(5),
        effect: function () {
            upgradeDispatcher.recalcPulseReload();
        },
    },
    {
        id: 'wide_pulse_child_1',
        name: 'AREA SATURATION',
        icon: 'Skillicon14_22.png',
        description: t('nodes', 'wide_pulse_child_1.desc'),
        maxLevel: 4,
        baseCost: 50,
        costType: 'data',
        costScaling: 'linear',
        costStep: 50,
        parents: ['wide_pulse'],
        childIds: ['colossal_cursor'],
        treeX: gridX(0.5),
        treeY: gridY(6),
        effect: function () {
            upgradeDispatcher.recalcPulseDamage();
        },
    },
    {
        id: 'aftershock',
        name: 'AFTERSHOCK',
        icon: 'Skillicon14_21.png',
        description: t('nodes', 'aftershock.desc'),
        popupText: '+AFTERSHOCK',
        popupColor: COLORS.DAMAGE,
        maxLevel: 3,
        baseCost: 50,
        costType: 'data',
        costScaling: 'linear',
        costStep: 50,
        parents: ['wide_pulse'],
        childIds: [],
        treeX: gridX(0.5),
        treeY: gridY(5),
        effect: function () {
            upgradeDispatcher.recalcAftershock();
        },
    },
    {
        id: 'colossal_cursor',
        name: 'COLOSSAL CURSOR',
        icon: 'Skillicon14_14.png',
        description: t('nodes', 'colossal_cursor.desc'),
        popupText: 'COLOSSAL',
        popupColor: COLORS.UPGRADE,
        maxLevel: 1,
        baseCost: 200,
        costType: 'data',
        costScaling: 'static',
        parents: ['wide_pulse_child_1'],
        childIds: [],
        treeX: gridX(1.5),
        treeY: gridY(6),
        requiresMaxParent: true,
        effect: function () {
            upgradeDispatcher.recalcPulseSize();
        },
    },
];
