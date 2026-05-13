// nodeDefs.js â€” Upgrade Tree upgrade definitions.
// Centralized node data for the upgrade tree.
// cinematicManager
// Tree Layout Constants
const TREE_CENTER_X = 400; // Half of 800px panel width
const TREE_START_Y = 740;
const TREE_UNIT_X = 100;
const TREE_UNIT_Y = 100;
const DUO_OFFSET = 30; // Standard offset for choice nodes

// Theme Colors for Popups/Effects
const COLORS = {
    COMBAT: '#' + GAME_CONSTANTS.COLOR_HOSTILE.toString(16).padStart(6, '0'),
    UTILITY: '#' + GAME_CONSTANTS.COLOR_FRIENDLY.toString(16).padStart(6, '0'),
    RESOURCE: '#' + GAME_CONSTANTS.COLOR_RESOURCE.toString(16).padStart(6, '0'),
    HEALTH: '#87FF02',
    LORE: '#a2a2a2',
    COIN: '#00FF00'
};

// Grid Helpers
const gridX = (units) => TREE_CENTER_X + TREE_UNIT_X * units;
const gridY = (units) => TREE_START_Y - TREE_UNIT_Y * units;

const NODE_DEFS = [
    {
        id: 'awaken',
        name: t('nodes', 'awaken.name'),
        label: t('nodes', 'awaken.label'),
        icon: 'Skillicon14_31.png',
        description: t('nodes', 'awaken.desc'),
        maxLevel: 1,
        baseCost: 0,
        costType: 'data',
        costScaling: 'static',
        costStep: 0,
        parents: [],
        childIds: ['automated_defense', 'integrity', 'focus', 'cheat', 'companion'],
        treeX: gridX(0),
        treeY: gridY(0),
        effect: async function () {
            if (typeof tutorialManager !== 'undefined') {
                tutorialManager.hideAll();
            }
            if (typeof cameraManager !== 'undefined') {
                cameraManager.shake(200, 0.007);
            }
            if (typeof audio !== 'undefined') {
                audio.play('pc_boot', 1);
            }
            if (typeof cinematicManager !== 'undefined') {
                const endCutscene = await cinematicManager.playCutsceneMinimal();
                const node = upgradeTree.getNode('awaken');

                if (!gameState.settings.musicMuted && !audio.getMusicName()) {
                    audio.playMusic('bg_music1');
                }
                setTimeout(() => {
                    if (typeof cinematicManager !== 'undefined') {
                        // Stage 1: Low-intensity pre-shock
                        cinematicManager.playLocalGlitch(GAME_CONSTANTS.halfWidth + 400, GAME_CONSTANTS.halfHeight, 150, 1, 300);

                        // Stage 2: High-intensity main surge (starts as Stage 1 peaks)
                        setTimeout(() => {
                            if (typeof cinematicManager !== 'undefined') {
                                cinematicManager.playLocalGlitch(GAME_CONSTANTS.halfWidth + 400, GAME_CONSTANTS.halfHeight, 200, 1.6, 1100);
                            }
                        }, 1300);
                    }
                }, 200);
                nodeAnims.playAwakenActivationAnimation(GAME_CONSTANTS.halfWidth, GAME_CONSTANTS.halfHeight, GAME_CONSTANTS.DEPTH_TOWER, () => {

                    setTimeout(() => {
                        if (typeof audio !== 'undefined') {
                            audio.play('chime_pc', 1);
                            audio.fade('pc_boot', 300);

                        }
                        setTimeout(() => {
                            cinematicManager.playLocalGlitch(GAME_CONSTANTS.halfWidth + 400, GAME_CONSTANTS.halfHeight, 110, 0.8, 300);
                        }, 1500);
                    }, 200);
                    tower.awaken();
                    pulseAttack.unlock();
                    // Show the deploy button immediately
                    if (upgradeTree.isVisible()) {
                        upgradeTree._showDeployButton(true);
                    }
                    if (typeof glitchFX !== 'undefined') {
                        glitchFX.triggerSystemScan();
                    }

                    endCutscene(() => {
                        upgradeTree._refreshAllNodes();
                        if (node) node.finalizePurchase();
                    });
                });
            }
        },



        delayActualPurchase: true,
    },
    {
        id: 'cheat',
        name: t('nodes', 'cheat.name'),
        icon: 'Skillicon14_07.png',
        description: t('nodes', 'cheat.desc'),
        popupText: t('nodes', 'cheat.popup'),
        popupColor: COLORS.RESOURCE,
        maxLevel: 1,
        baseCost: 0,
        costType: 'data',
        costScaling: 'static',
        costStep: 0,
        parents: ['awaken'],
        childIds: ['lore_1', 'lore_3', 'lore_5', 'lore_6', 'lore_7', 'lore_8', 'lore_9', 'zero_day_exploit', 'two_step_auth', 'unsecured_files', 'junk_data_2', 'completionist', 'physical_anchor', 'coin_mine_unlock', 'kernel_breaker'],
        treeX: gridX(0),
        treeY: gridY(-2.0),
        effect: function () {
            resourceManager.addData(5000);
            resourceManager.addInsight(3);
            resourceManager.addShard(2);
            resourceManager.addCoin(10);
            if (typeof tower !== 'undefined') {
                tower.recalcStats();
                tower.heal(10);
            }
        },
    },
    {
        id: 'kernel_breaker',
        name: t('nodes', 'kernel_breaker.name'),
        icon: 'Skillicon14_14.png',
        description: t('nodes', 'kernel_breaker.desc'),
        popupText: t('nodes', 'kernel_breaker.popup'),
        popupColor: COLORS.COMBAT,
        maxLevel: 4,
        baseCost: 50,
        costType: 'data',
        costScaling: 'linear',
        costStep: 50,
        parents: ['cheat'],
        childIds: [],
        treeX: gridX(-1.0),
        treeY: gridY(-3.0),
        effect: function () {
            if (typeof tower !== 'undefined') tower.recalcStats();
        },
    },
    {
        id: 'companion',
        name: t('nodes', 'companion.name'),
        icon: 'Skillicon14_06.png',
        description: t('nodes', 'companion.desc'),
        popupText: t('nodes', 'companion.popup'),
        popupColor: COLORS.UTILITY,
        maxLevel: 1,
        baseCost: 1,
        costType: 'insight',
        costScaling: 'static',
        parents: ['awaken'],
        childIds: ['spawn_hello_world'],
        treeX: gridX(0),
        treeY: gridY(-4.0),
        effect: function () {
            // Not implemented yet
        },
    },
    {
        id: 'spawn_hello_world',
        name: 'Spawn Hello World',
        icon: 'Skillicon14_07.png',
        description: 'Test node: Attaches and positions the Hello World node.',
        maxLevel: 1,
        baseCost: 0,
        costType: 'data',
        costScaling: 'static',
        parents: ['companion'],
        childIds: [],
        treeX: gridX(-1),
        treeY: gridY(-5.0),
        effect: function () {
            // Attach hello_world (from disabledNodes.js) to companion
            if (typeof attachNodeToParent === 'function') {
                attachNodeToParent('hello_world', 'companion');
            }
            // Move it to 1 unit below companion
            if (typeof updateNodePosition === 'function') {
                updateNodePosition('hello_world', gridX(0), gridY(-5.0));
            }
        },
    },
    {
        id: 'combat_shield',
        name: t('nodes', 'combat_shield.name'),
        icon: 'Skillicon14_07.png',
        description: t('nodes', 'combat_shield.desc'),
        popupText: t('nodes', 'combat_shield.popup'),
        popupColor: COLORS.UTILITY,
        maxLevel: 1,
        baseCost: 0,
        costType: 'data',
        costScaling: 'static',
        parents: ['placeholder_duo_4', 'data_compression'],
        childIds: ['combat_shield_hp'],
        treeX: gridX(-5.5),
        treeY: gridY(5),
        effect: function () {
            combatShield.unlock();
            upgradeDispatcher.recalcCombatShield();
        },
    },
    {
        id: 'placeholder_duo_4',
        isPlaceholder: true,
        parents: ['backup_server'],
        monitorsDuoTier: 4,
        childIds: ['combat_shield'],
        treeX: gridX(-5.5),
        treeY: gridY(4.0),
        effect: function () { },
    },
    {
        id: 'sword',
        name: t('nodes', 'sword.name'),
        icon: 'Skillicon14_33.png',
        description: t('nodes', 'sword.desc'),
        popupText: t('nodes', 'sword.popup'),
        popupColor: COLORS.COMBAT,
        maxLevel: 1,
        baseCost: 1,
        costType: 'shard',
        costScaling: 'static',
        parents: ['backup_server'],
        childIds: ['sword_lunge', 'sword_flurry'],
        isDuoBox: true,
        isLeftDuo: true,
        duoBoxTier: 4,
        shardId: 'sword',
        duoSiblingId: 'scythe',
        treeX: gridX(-5.5) - DUO_OFFSET,
        treeY: gridY(3.5),
        effect: function () {
            if (typeof swordAttack !== 'undefined') {
                swordAttack.unlock();
                upgradeDispatcher.recalcSwordStats();
            }
            scytheAttack.lock();
        },
    },
    {
        id: 'sword_lunge',
        name: t('nodes', 'sword_lunge.name'),
        icon: 'Skillicon14_22.png',
        description: t('nodes', 'sword_lunge.desc'),
        popupText: t('nodes', 'sword_lunge.popup'),
        popupColor: COLORS.COMBAT,
        maxLevel: 1,
        baseCost: 20,
        costType: 'data',
        costScaling: 'static',
        parents: ['sword'],
        childIds: [],
        isDuoChild: true,
        treeX: gridX(-7.0),
        treeY: gridY(3.0),
        effect: function () {
            upgradeDispatcher.recalcSwordStats();
        },
    },
    {
        id: 'sword_flurry',
        name: t('nodes', 'sword_flurry.name'),
        icon: 'Skillicon14_28.png',
        description: t('nodes', 'sword_flurry.desc'),
        popupText: t('nodes', 'sword_flurry.popup'),
        popupColor: COLORS.COMBAT,
        maxLevel: 1,
        baseCost: 20,
        costType: 'data',
        costScaling: 'static',
        parents: ['sword'],
        childIds: [],
        isDuoChild: true,
        treeX: gridX(-7.0),
        treeY: gridY(4.0),
        effect: function () {
            upgradeDispatcher.recalcSwordStats();
        },
    },
    {
        id: 'scythe',
        name: t('nodes', 'scythe.name'),
        icon: 'Skillicon14_37.png',
        description: t('nodes', 'scythe.desc'),
        popupText: t('nodes', 'scythe.popup'),
        popupColor: COLORS.COMBAT,
        maxLevel: 1,
        baseCost: 1,
        costType: 'shard',
        costScaling: 'static',
        parents: ['backup_server'],
        childIds: ['scythe_harvest', 'scythe_lethality'],
        isDuoBox: true,
        duoBoxTier: 4,
        shardId: 'scythe',
        duoSiblingId: 'sword',
        treeX: gridX(-5.5) + DUO_OFFSET,
        treeY: gridY(3.5),
        effect: function () {
            scytheAttack.unlock();
            if (typeof swordAttack !== 'undefined') swordAttack.lock();
        },
    },
    {
        id: 'scythe_harvest',
        name: t('nodes', 'scythe_harvest.name'),
        icon: 'Skillicon14_08.png',
        description: t('nodes', 'scythe_harvest.desc'),
        popupText: t('nodes', 'scythe_harvest.popup'),
        popupColor: COLORS.COMBAT,
        maxLevel: 1,
        baseCost: 20,
        costType: 'data',
        costScaling: 'static',
        parents: ['scythe'],
        childIds: [],
        isDuoChild: true,
        treeX: gridX(-4.0),
        treeY: gridY(3.0),
        effect: function () {
            upgradeDispatcher.recalcScytheStats();
        },
    },
    {
        id: 'scythe_lethality',
        name: t('nodes', 'scythe_lethality.name'),
        icon: 'Skillicon14_31.png',
        description: t('nodes', 'scythe_lethality.desc'),
        popupText: t('nodes', 'scythe_lethality.popup'),
        popupColor: COLORS.COMBAT,
        maxLevel: 2,
        baseCost: 20,
        costType: 'data',
        costScaling: 'static',
        parents: ['scythe'],
        childIds: [],
        isDuoChild: true,
        treeX: gridX(-4.0),
        treeY: gridY(4.0),
        effect: function () {
            upgradeDispatcher.recalcScytheStats();
        },
    },
    {
        id: 'combat_shield_hp',
        name: t('nodes', 'combat_shield_hp.name'),
        icon: 'Skillicon14_18.png',
        description: t('nodes', 'combat_shield_hp.desc'),
        popupText: t('nodes', 'combat_shield_hp.popup'),
        popupColor: COLORS.UTILITY,
        maxLevel: 5,
        baseCost: 2,
        costType: 'coin',
        costScaling: 'linear',
        costStep: 1,
        parents: ['combat_shield'],
        childIds: [],
        treeX: gridX(-6.5),
        treeY: gridY(5),
        effect: function () {
            upgradeDispatcher.recalcCombatShield();
        },
    },
    {
        id: 'backup_server',
        name: t('nodes', 'backup_server.name'),
        icon: 'Skillicon14_08.png',
        description: t('nodes', 'backup_server.desc'),
        popupText: t('nodes', 'backup_server.popup'),
        popupColor: COLORS.UTILITY,
        maxLevel: 1,
        baseCost: 150,
        costType: 'data',
        costScaling: 'static',
        parents: ['bomb_2'],
        childIds: ['restore_point', 'placeholder_duo_4', 'sword', 'scythe'],
        treeX: gridX(-5.5),
        treeY: gridY(2),
        effect: function () { },
    },
    {
        id: 'restore_point',
        name: t('nodes', 'restore_point.name'),
        icon: 'Skillicon14_09.png',
        description: t('nodes', 'restore_point.desc'),
        popupText: t('nodes', 'restore_point.popup'),
        popupColor: COLORS.UTILITY,
        maxLevel: 1,
        baseCost: 3,
        costType: 'coin',
        costScaling: 'static',
        parents: ['backup_server'],
        childIds: [],
        treeX: gridX(-6.5),
        treeY: gridY(2),
        effect: function () { },
    },
    {
        id: 'peak_traffic',
        name: t('nodes', 'peak_traffic.name'),
        icon: 'Skillicon14_03.png',
        description: t('nodes', 'peak_traffic.desc'),
        popupText: t('nodes', 'peak_traffic.popup'),
        popupColor: COLORS.RESOURCE,
        maxLevel: 1,
        baseCost: 1,
        costType: 'insight',
        costScaling: 'static',
        parents: ['access_internet'],
        childIds: [],
        treeX: gridX(0.5),
        treeY: gridY(7.0),
        effect: function () { },
    },
    {
        id: 'automated_defense',
        name: t('nodes', 'automated_defense.name'),
        icon: 'Skillicon14_03.png',
        description: t('nodes', 'automated_defense.desc'),
        popupText: t('nodes', 'automated_defense.popup'),
        popupColor: COLORS.COMBAT,
        maxLevel: 1,
        baseCost: 1,
        costType: 'data',
        costScaling: 'static',
        costStep: 0,
        parents: ['awaken'],
        childIds: ['intensity', 'magnet', 'lightning_weapon', 'shockwave_weapon', 'placeholder_duo_1'],
        treeX: gridX(0),
        treeY: gridY(1),
        effect: function () {
            // Stats recalculated via 'upgradePurchased' -> tower._onUpgradePurchased
        },
    },
    {
        id: 'focus',
        name: t('nodes', 'focus.name'),
        icon: 'Skillicon14_02.png',
        description: t('nodes', 'focus.desc'),
        popupText: t('nodes', 'focus.popup'),
        popupColor: COLORS.COMBAT,
        maxLevel: 3,
        baseCost: 5,
        costType: 'data',
        costScaling: 'linear',
        costStep: 10,
        parents: ['awaken'],
        childIds: ['pulse_expansion'],
        treeX: gridX(1),
        treeY: gridY(0),
        effect: function () {
            upgradeDispatcher.recalcPulseDamage();
        },
    },
    {
        id: 'magnet',
        name: t('nodes', 'magnet.name'),
        icon: 'Skillicon14_07.png',
        description: t('nodes', 'magnet.desc'),
        popupText: t('nodes', 'magnet.popup'),
        popupColor: COLORS.RESOURCE,
        maxLevel: 1,
        baseCost: 1,
        label: 'INSIGHT',
        costType: 'insight',
        costScaling: 'static',
        costStep: 0,
        parents: ['automated_defense'],
        childIds: ['test_defenses'],
        treeX: gridX(-1),
        treeY: gridY(1),
        effect: function () {
            resourceManager.recalcPickupRadius();
        },
    },
    {
        id: 'pulse_expansion',
        name: t('nodes', 'pulse_expansion.name'),
        icon: 'Skillicon14_28.png',
        description: t('nodes', 'pulse_expansion.desc'),
        popupText: t('nodes', 'pulse_expansion.popup'),
        popupColor: COLORS.COMBAT,
        maxLevel: 1,
        baseCost: 40,
        costType: 'data',
        costScaling: 'static',
        costStep: 0,
        parents: ['focus'],
        requiresMaxParent: true,
        childIds: ['bomb'],
        treeX: gridX(2),
        treeY: gridY(0),
        effect: function () {
            upgradeDispatcher.recalcPulseSize();
        },
    },


    {
        id: 'integrity',
        name: t('nodes', 'integrity.name'),
        icon: 'Skillicon14_16.png',
        description: t('nodes', 'integrity.desc'),
        popupText: t('nodes', 'integrity.popup'),
        popupColor: COLORS.HEALTH,
        maxLevel: 4,
        baseCost: 4,
        costType: 'data',
        costScaling: 'linear',
        costStep: 8,
        parents: ['awaken'],
        childIds: ['bug_report'],
        treeX: gridX(-1),
        treeY: gridY(0),
        effect: function () {
            // Stats recalculated via 'upgradePurchased' â†’ tower._onUpgradePurchased
        },
    },
    {
        id: 'iterative_growth',
        name: t('nodes', 'iterative_growth.name'),
        icon: 'Skillicon14_09.png',
        description: t('nodes', 'iterative_growth.desc'),
        popupText: t('nodes', 'iterative_growth.popup'),
        popupColor: COLORS.HEALTH,
        maxLevel: 1,
        baseCost: 20,
        costType: 'data',
        costScaling: 'static',
        leaky: 20,
        parents: ['bug_report'],
        requiresMaxParent: true,
        childIds: [],
        treeX: gridX(-3),
        treeY: gridY(0),
        effect: function () { },
    },
    {
        id: 'intensity',
        name: t('nodes', 'intensity.name'),
        icon: 'Skillicon14_26.png',
        description: t('nodes', 'intensity.desc'),
        popupText: t('nodes', 'intensity.popup'),
        popupColor: COLORS.COMBAT,
        maxLevel: 3,
        baseCost: 10,
        costType: 'data',
        costScaling: 'linear',
        costStep: 0,
        costStepScaling: 10,
        parents: ['automated_defense'],
        childIds: ['coverage'],
        treeX: gridX(1),
        treeY: gridY(1),
        effect: function () {
            // Stats recalculated via 'upgradePurchased' â†’ tower._onUpgradePurchased
        },
    },
    {
        id: 'coverage',
        name: t('nodes', 'coverage.name'),
        icon: 'Skillicon14_23.png',
        description: t('nodes', 'coverage.desc'),
        popupText: t('nodes', 'coverage.popup'),
        popupColor: COLORS.COMBAT,
        maxLevel: 1,
        baseCost: 40,
        costType: 'data',
        costScaling: 'static',
        costStep: 0,
        parents: ['intensity'],
        requiresMaxParent: true,
        childIds: ['bomb', 'direct_extraction'],
        treeX: gridX(2),
        treeY: gridY(1),
        effect: function () {
            // Stats recalculated via 'upgradePurchased' â†’ tower._onUpgradePurchased
        },
    },
    {
        id: 'direct_extraction',
        name: t('nodes', 'direct_extraction.name'),
        icon: 'Skillicon14_03.png',
        description: t('nodes', 'direct_extraction.desc'),
        popupText: t('nodes', 'direct_extraction.popup'),
        popupColor: COLORS.RESOURCE,
        maxLevel: 1,
        baseCost: 1,
        label: 'INSIGHT',
        costType: 'insight',
        costScaling: 'static',
        parents: ['coverage'],
        childIds: ['trojan_access'],
        treeX: gridX(2.5),
        treeY: gridY(2),
        effect: function () { },
    },
    {
        id: 'diagnostic_analytics',
        name: t('nodes', 'diagnostic_analytics.name'),
        icon: 'Skillicon14_06.png',
        description: t('nodes', 'diagnostic_analytics.desc'),
        popupText: t('nodes', 'diagnostic_analytics.popup'),
        popupColor: COLORS.UTILITY,
        maxLevel: 1,
        baseCost: 25,
        costType: 'data',
        costScaling: 'static',
        parents: ['armor'],
        childIds: ['data_compression', 'placeholder_duo_3', 'laser', 'artillery'],
        requiresMaxParent: true,
        treeX: gridX(-3.5),
        treeY: gridY(5),
        effect: function () {
            // This is checked by iterationOverScreen.js
        },
    },

    {
        id: 'regen',
        name: t('nodes', 'regen.name'),
        icon: 'Skillicon14_11.png',
        description: t('nodes', 'regen.desc'),
        popupText: t('nodes', 'regen.popup'),
        popupColor: COLORS.HEALTH,
        maxLevel: 1,
        baseCost: 2,
        costType: 'coin',
        costScaling: 'static',
        costStep: 20,
        parents: ['armor'],
        childIds: [],
        treeX: gridX(-1.5),
        treeY: gridY(5),
        effect: function () {
            // Stats recalculated via 'upgradePurchased' â†’ tower._onUpgradePurchased
        },
    },
    {
        id: 'bomb',
        name: t('nodes', 'bomb.name'),
        icon: 'Skillicon14_02.png',
        description: t('nodes', 'bomb.desc'),
        popupText: t('nodes', 'bomb.popup'),
        popupColor: COLORS.UTILITY,
        maxLevel: 1,
        baseCost: 50,
        costType: 'data',
        costScaling: 'static',
        parents: ['coverage', 'pulse_expansion'],
        requiresMaxParent: true,
        childIds: ['resonance', 'lore_2'],
        treeX: gridX(3),
        treeY: gridY(0.5),
        effect: function () {
            upgradeDispatcher.recalcBombUses();
        },
    },
    {
        id: 'bomb_2',
        name: t('nodes', 'bomb_2.name'),
        icon: 'Skillicon14_05.png',
        description: t('nodes', 'bomb_2.desc'),
        popupText: t('nodes', 'bomb_2.popup'),
        popupColor: COLORS.UTILITY,
        maxLevel: 1,
        baseCost: 100,
        costType: 'data',
        costScaling: 'static',
        parents: ['threat_response', 'bypass'],
        childIds: ['backup_server', 'packet_sniffing'],
        treeX: gridX(-4),
        treeY: gridY(2.0),
        effect: function () {
            upgradeDispatcher.recalcBombUses();
        },
    },

    {
        id: 'malware_siphon',
        name: t('nodes', 'malware_siphon.name'),
        label: 'HACKING',
        icon: 'Skillicon14_03.png',
        description: t('nodes', 'malware_siphon.desc'),
        popupText: t('nodes', 'malware_siphon.popup'),
        popupColor: COLORS.HEALTH,
        maxLevel: 1,
        baseCost: 200,
        costType: 'data',
        costScaling: 'static',
        parents: ['instability_mark'],
        childIds: ['root_access'],
        treeX: gridX(1.5),
        treeY: gridY(8.0),
        effect: function () { },
    },

    {
        id: 'threat_response',
        name: t('nodes', 'threat_response.name'),
        icon: 'Skillicon14_27.png',
        description: t('nodes', 'threat_response.desc'),
        popupText: t('nodes', 'threat_response.popup'),
        popupColor: COLORS.HEALTH,
        maxLevel: 1,
        baseCost: 200,
        costType: 'data',
        costScaling: 'static',
        parents: ['emergency_overclock'],
        childIds: ['bomb_2'],
        treeX: gridX(-3.0),
        treeY: gridY(2.5),
        effect: function () {
            // Logic integrated into gameInit.js listeners
        },
    },
    {
        id: 'placeholder_duo_1',
        isPlaceholder: true,
        parents: ['automated_defense'],
        monitorsDuoTier: 1,
        childIds: ['reveal_map'],

        treeX: gridX(0),
        treeY: gridY(2.125), // Mid-point adjustment (non-clean)
        effect: function () { },
    },
    // â”€â”€ Tier 1 Duo-Box: Lightning Weapon & Shockwave Weapon â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    {
        id: 'lightning_weapon',
        name: t('nodes', 'lightning_weapon.name'),
        icon: 'Skillicon14_33.png',
        description: t('nodes', 'lightning_weapon.desc'),
        popupText: t('nodes', 'lightning_weapon.popup'),
        popupColor: COLORS.COMBAT,
        maxLevel: 1,
        baseCost: 1,
        costType: 'shard',
        costScaling: 'static',
        costStep: 0,
        parents: ['automated_defense'],
        childIds: ['lightning_chain', 'lightning_static_charge'],
        isDuoBox: true,
        isLeftDuo: true,
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
        name: t('nodes', 'shockwave_weapon.name'),
        icon: 'Skillicon14_37.png',
        description: t('nodes', 'shockwave_weapon.desc'),
        popupText: t('nodes', 'shockwave_weapon.popup'),
        popupColor: COLORS.COMBAT,
        maxLevel: 1,
        baseCost: 1,
        costType: 'shard',
        costScaling: 'static',
        costStep: 0,
        parents: ['automated_defense'],
        childIds: ['shockwave_amplifier', 'shockwave_seismic_crush'],
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
        name: t('nodes', 'lightning_chain.name'),
        icon: 'Skillicon14_40.png',
        description: t('nodes', 'lightning_chain.desc'),
        popupText: t('nodes', 'lightning_chain.popup'),
        popupColor: COLORS.COMBAT,
        maxLevel: 1,
        baseCost: 35,
        costType: 'data',
        costScaling: 'static',
        costStep: 0,
        parents: ['lightning_weapon'],
        childIds: [],
        isDuoChild: true,
        treeX: gridX(-1.5),
        treeY: gridY(2),
        effect: function () {
            upgradeDispatcher.recalcLightningChains();
        },
    },
    {
        id: 'lightning_static_charge',
        name: t('nodes', 'lightning_static_charge.name'),
        icon: 'Skillicon14_10.png',
        description: t('nodes', 'lightning_static_charge.desc'),
        popupText: t('nodes', 'lightning_static_charge.popup'),
        popupColor: COLORS.COMBAT,
        maxLevel: 3,
        baseCost: 25,
        costType: 'data',
        costScaling: 'linear',
        costStep: 10,
        parents: ['lightning_weapon'],
        childIds: [],
        isDuoChild: true,
        treeX: gridX(-1.5),
        treeY: gridY(3),
        effect: function () {
            upgradeDispatcher.recalcLightningDamage();
        },
    },
    {
        id: 'shockwave_amplifier',
        name: t('nodes', 'shockwave_amplifier.name'),
        icon: 'Skillicon14_28.png',
        description: t('nodes', 'shockwave_amplifier.desc'),
        popupText: t('nodes', 'shockwave_amplifier.popup'),
        popupColor: COLORS.COMBAT,
        maxLevel: 1,
        baseCost: 35,
        costType: 'data',
        costScaling: 'static',
        costStep: 0,
        parents: ['shockwave_weapon'],
        childIds: [],
        isDuoChild: true,
        treeX: gridX(1.5),
        treeY: gridY(2),
        effect: function () {
            upgradeDispatcher.recalcShockwaveStats();
        },
    },
    {
        id: 'shockwave_seismic_crush',
        name: t('nodes', 'shockwave_seismic_crush.name'),
        icon: 'Skillicon14_19.png',
        description: t('nodes', 'shockwave_seismic_crush.desc'),
        popupText: t('nodes', 'shockwave_seismic_crush.popup'),
        popupColor: COLORS.COMBAT,
        maxLevel: 2,
        baseCost: 35,
        costType: 'data',
        costScaling: 'linear',
        costStep: 20,
        parents: ['shockwave_weapon'],
        childIds: [],
        isDuoChild: true,
        treeX: gridX(1.5),
        treeY: gridY(3),
        effect: function () {
            upgradeDispatcher.recalcShockwaveStats();
        },
    },
    {
        id: 'armor',
        name: t('nodes', 'armor.name'),
        icon: 'Skillicon14_18.png',
        description: t('nodes', 'armor.desc'),
        popupText: t('nodes', 'armor.popup'),
        popupColor: COLORS.UTILITY,
        maxLevel: 2,
        baseCost: 75,
        costType: 'data',
        costScaling: 'linear',
        costStep: 50,
        parents: ['system_redundancy_new'],
        treeX: gridX(-2.5),
        treeY: gridY(4.5),
        childIds: ['regen', 'diagnostic_analytics'],
        effect: function () {
            // Recalculated via 'upgradePurchased' â†’ tower._onUpgradePurchased
        },
    },
    {
        id: 'data_chest_unlock',
        name: t('nodes', 'data_chest_unlock.name'),
        icon: 'Skillicon14_38.png',
        description: t('nodes', 'data_chest_unlock.desc'),
        popupText: t('nodes', 'data_chest_unlock.popup'),
        popupColor: COLORS.RESOURCE,
        maxLevel: 1,
        baseCost: 1,
        label: 'INSIGHT',
        costType: 'insight',
        costScaling: 'static',
        parents: ['reveal_map'],
        childIds: ['access_internet'],
        treeX: gridX(-0.5),
        treeY: gridY(5),
        effect: function () {
            if (typeof GAME_VARS !== 'undefined') {
                GAME_VARS.highChanceDataCacheSpawn = true;
            }
        },
    },
    {
        id: 'system_redundancy_new',
        name: t('nodes', 'system_redundancy_new.name'),
        leaky: 5,
        icon: 'Skillicon14_18.png',
        description: t('nodes', 'system_redundancy_new.desc'),
        popupText: t('nodes', 'system_redundancy_new.popup'),
        popupColor: COLORS.HEALTH,
        maxLevel: 1,
        baseCost: 75,
        costType: 'data',
        costScaling: 'static',
        parents: ['reveal_map'],
        childIds: ['emergency_overclock', 'armor'],
        treeX: gridX(-1.5),
        treeY: gridY(4),
        effect: function () { },
    },
    {
        id: 'clock_speed',
        name: t('nodes', 'clock_speed.name'),
        icon: 'Skillicon14_05.png',
        description: t('nodes', 'clock_speed.desc'),
        popupText: t('nodes', 'clock_speed.popup'),
        popupColor: COLORS.UTILITY,
        maxLevel: 4,
        baseCost: 50,
        costType: 'data',
        costScaling: 'linear',
        costStep: 50,
        costStepScaling: 10,
        parents: ['root_access'],
        childIds: [],
        treeX: gridX(-0.5),
        treeY: gridY(8.5),
        effect: function () {
            // Recalculated via messageBus 'upgradePurchased' â†’ tower._onUpgradePurchased
        },
    },
    {
        id: 'emergency_overclock',
        name: t('nodes', 'emergency_overclock.name'),
        icon: 'Skillicon14_05.png',
        description: t('nodes', 'emergency_overclock.desc'),
        popupText: t('nodes', 'emergency_overclock.popup'),
        popupColor: COLORS.UTILITY,
        maxLevel: 1,
        baseCost: 200,
        costType: 'data',
        costScaling: 'static',
        parents: ['system_redundancy_new'],
        childIds: ['threat_response'],
        treeX: gridX(-2.5),
        treeY: gridY(3.5),
        effect: function () {
            if (typeof tower !== 'undefined') {
                tower.recalcStats();
            }
        },
    },
    {
        id: 'trojan_access',
        name: t('nodes', 'trojan_access.name'),
        label: 'HACKING',
        icon: 'Skillicon14_09.png',
        description: t('nodes', 'trojan_access.desc'),
        popupText: t('nodes', 'trojan_access.popup'),
        maxLevel: 1,
        baseCost: 100,
        costType: 'data',
        costScaling: 'static',
        parents: ['direct_extraction'],
        childIds: ['volatile_payload', 'repeat_exploit'],
        treeX: gridX(2.5),
        treeY: gridY(3.5),
        effect: function () { },
    },
    {
        id: 'volatile_payload',
        name: t('nodes', 'volatile_payload.name'),
        label: 'HACKING',
        icon: 'Skillicon14_10.png',
        description: t('nodes', 'volatile_payload.desc'),
        popupText: t('nodes', 'volatile_payload.popup'),
        popupColor: COLORS.UTILITY,
        maxLevel: 1,
        baseCost: 3,
        costType: 'coin',
        costScaling: 'static',
        costStep: 0,
        parents: ['trojan_access'],
        childIds: [],
        treeX: gridX(3.5),
        treeY: gridY(4.0),
        effect: function () { },
    },
    {
        id: 'prismatic_array',
        name: t('nodes', 'prismatic_array.name'),
        icon: 'Skillicon14_30.png',
        description: t('nodes', 'prismatic_array.desc'),
        popupText: t('nodes', 'prismatic_array.popup'),
        popupColor: COLORS.UTILITY,
        maxLevel: 1,
        baseCost: 4,
        costType: 'coin',
        costScaling: 'static',
        parents: ['farsight'],
        childIds: [],
        treeX: gridX(6.5),
        treeY: gridY(8.0),
        effect: function () {
            // Recalculated via normal gameplay checks
        },
    },
    {
        id: 'resonance',
        name: t('nodes', 'resonance.name'),
        icon: 'Skillicon14_06.png', // Using focus icon for resonance feel or similar
        description: t('nodes', 'resonance.desc'),
        popupText: t('nodes', 'resonance.popup'),
        popupColor: COLORS.COMBAT,
        maxLevel: 1,
        baseCost: 75,
        costType: 'data',
        costScaling: 'static',
        parents: ['bomb'],
        childIds: ['sustaining_siphon', 'crescendo', 'amplitude'],
        treeX: gridX(4),
        treeY: gridY(1),
        effect: function () {
            upgradeDispatcher.recalcResonance();
        },
    },
    {
        id: 'crescendo',
        name: t('nodes', 'crescendo.name'),
        icon: 'Skillicon14_28.png',
        description: t('nodes', 'crescendo.desc'),
        popupText: t('nodes', 'crescendo.popup'),
        popupColor: COLORS.COMBAT,
        maxLevel: 1,
        baseCost: 50,
        costType: 'data',
        costScaling: 'static',
        leaky: 20,
        parents: ['resonance'],
        requiresMaxParent: true,
        childIds: ['hijack'],
        treeX: gridX(4.5),
        treeY: gridY(2),
        effect: function () {
            upgradeDispatcher.recalcResonance();
        },
    },
    {
        id: 'amplitude',
        name: t('nodes', 'amplitude.name'),
        icon: 'Skillicon14_02.png',
        description: t('nodes', 'amplitude.desc'),
        popupText: t('nodes', 'amplitude.popup'),
        popupColor: COLORS.COMBAT,
        maxLevel: 1,
        baseCost: 150,
        costType: 'data',
        costScaling: 'static',
        parents: ['resonance'],
        requiresMaxParent: true,
        childIds: ['hijack'],
        treeX: gridX(3.5),
        treeY: gridY(2),
        effect: function () {
            upgradeDispatcher.recalcResonance();
        },
    },
    {
        id: 'hijack',
        name: t('nodes', 'hijack.name'),
        icon: 'Skillicon14_03.png',
        description: t('nodes', 'hijack.desc'),
        popupText: t('nodes', 'hijack.popup'),
        popupColor: COLORS.COMBAT,
        maxLevel: 1,
        baseCost: 200,
        costType: 'data',
        costScaling: 'static',
        parents: ['crescendo', 'amplitude'],
        requiresMaxParent: false,
        childIds: ['recursion', 'memory_leak'],
        treeX: gridX(4.0),
        treeY: gridY(3),
        effect: function () { },
    },
    {
        id: 'memory_leak',
        name: t('nodes', 'memory_leak.name'),
        icon: 'Skillicon14_05.png',
        description: t('nodes', 'memory_leak.desc'),
        popupText: t('nodes', 'memory_leak.popup'),
        popupColor: COLORS.RESOURCE,
        maxLevel: 1,
        baseCost: 1,
        costType: 'insight',
        costScaling: 'static',
        parents: ['hijack'],
        childIds: ['bypass_2'],
        treeX: gridX(4.5),
        treeY: gridY(4),
        effect: function () { },
    },
    {
        id: 'bypass_2',
        name: t('nodes', 'bypass_2.name'),
        icon: 'Skillicon14_07.png',
        description: 'Refunds 200 DATA upon purchase',
        popupText: t('nodes', 'bypass_2.popup'),
        popupColor: COLORS.RESOURCE,
        maxLevel: 1,
        baseCost: 200,
        costType: 'data',
        costScaling: 'static',
        parents: ['memory_leak'],
        childIds: ['parallel_processing'],
        treeX: gridX(5.0),
        treeY: gridY(5),
        effect: function () {
            if (typeof resourceManager !== 'undefined') {
                resourceManager.addData(200);
            }
        },
        leaky: 10,
    },
    {
        id: 'parallel_processing',
        name: t('nodes', 'parallel_processing.name'),
        icon: 'Skillicon14_23.png',
        description: t('nodes', 'parallel_processing.desc'),
        popupText: t('nodes', 'parallel_processing.popup'),
        popupColor: COLORS.COMBAT,
        maxLevel: 1,
        baseCost: 250,
        costType: 'data',
        costScaling: 'static',
        parents: ['bypass_2'],
        childIds: ['data_mining'],
        treeX: gridX(5.0),
        treeY: gridY(7.0),
        effect: function () {
            if (typeof tower !== 'undefined') tower.recalcStats();
            if (typeof upgradeDispatcher !== 'undefined') upgradeDispatcher.recalcPulseDamage();
            if (typeof upgradeTree !== 'undefined') upgradeTree.showGhostNode('peak_performance');
        },
    },
    {
        id: 'recursion',
        name: t('nodes', 'recursion.name'),
        icon: 'Skillicon14_08.png',
        description: t('nodes', 'recursion.desc'),
        popupText: t('nodes', 'recursion.popup'),
        popupColor: COLORS.COMBAT,
        maxLevel: 1,
        baseCost: 2,
        costType: 'coin',
        costScaling: 'static',
        parents: ['hijack'],
        requiresMaxParent: true,
        childIds: [],
        treeX: gridX(5.0),
        treeY: gridY(3),
        effect: function () { },
    },
    {
        id: 'sustaining_siphon',
        name: t('nodes', 'sustaining_siphon.name'),
        icon: 'Skillicon14_11.png',
        description: t('nodes', 'sustaining_siphon.desc'),
        popupText: t('nodes', 'sustaining_siphon.popup'),
        popupColor: COLORS.HEALTH,
        maxLevel: 1,
        baseCost: 2,
        costType: 'coin',
        costScaling: 'static',
        parents: ['resonance'],
        requiresMaxParent: true,
        childIds: [],
        treeX: gridX(5),
        treeY: gridY(1.0),
        effect: function () { },
    },
    {
        id: 'completionist',
        name: t('nodes', 'completionist.name'),
        icon: 'Skillicon14_21.png',
        description: t('nodes', 'completionist.desc'),
        popupText: t('nodes', 'completionist.popup'),
        popupColor: COLORS.RESOURCE,
        maxLevel: 1,
        baseCost: 1,
        costType: 'insight',
        costScaling: 'static',
        parents: ['cheat'],
        childIds: [],
        treeX: gridX(0.5),
        treeY: gridY(-2.0),
        effect: function () { },
    },
    {
        id: 'bug_report',
        name: t('nodes', 'bug_report.name'),
        icon: 'Skillicon14_06.png',
        description: t('nodes', 'bug_report.desc'),
        popupText: t('nodes', 'bug_report.popup'),
        popupColor: COLORS.RESOURCE,
        maxLevel: 1,
        baseCost: 1,
        costType: 'insight',
        costScaling: 'static',
        parents: ['integrity'],
        childIds: ['iterative_growth'],
        treeX: gridX(-2),
        treeY: gridY(0),
        effect: function () { },
    },
    {
        id: 'reveal_map',
        name: t('nodes', 'reveal_map.name'),
        label: t('nodes', 'label.gate'),
        icon: 'Skillicon14_14.png',
        description: t('nodes', 'reveal_map.desc'),
        popupText: t('nodes', 'reveal_map.popup'),
        popupColor: COLORS.RESOURCE,
        maxLevel: 1,
        baseCost: 40,
        costType: 'data',
        costScaling: 'static',
        costStep: 0,
        parents: ['placeholder_duo_1'],
        childIds: ['system_redundancy_new', 'data_chest_unlock', 'impulse', 'unsecured_wallet'],
        treeX: gridX(0),
        treeY: gridY(4),
        effect: async function () {
            if (typeof audio !== 'undefined') audio.play('pc_beep');
            if (typeof tutorialManager !== 'undefined') {
                tutorialManager.hideAll();
            }
            if (typeof cinematicManager !== 'undefined') {
                const endCutscene = await cinematicManager.playCutscene();

                const dragGroup = upgradeTree.getDraggableGroup();
                const node = upgradeTree.getNode('reveal_map');

                if (dragGroup && node && node.btn) {
                    // Slide panel away for full-screen map reveal
                    if (typeof upgradeTree !== 'undefined') {
                        upgradeTree._onSlideRightClicked(upgradeTree.SLIDE_DURATION * 3);
                    }

                    const targetS = 1;
                    const localX = node.treeX + 8;
                    const localY = node.treeY;
                    const targetX = GAME_CONSTANTS.halfWidth - (localX * targetS);
                    const targetY = (GAME_CONSTANTS.halfHeight + 50) - (localY * targetS);

                    dragGroup.tweenScale(targetS, { duration: 1500, ease: 'Cubic.easeInOut' });
                    dragGroup.tweenTo(targetX, targetY, {
                        duration: 1500,
                        ease: 'Cubic.easeInOut',
                        onComplete: () => {

                        }
                    });

                    nodeAnims.playRevealMapActivationAnimation(node, () => {

                        // Sequential node revelation once explosion finishes
                        PhaserScene.time.delayedCall(250, () => {
                            upgradeTree._refreshAllNodes();
                            PhaserScene.time.delayedCall(250, () => {
                                upgradeTree.revealNode('repeat_exploit');
                                PhaserScene.time.delayedCall(250, () => {
                                    upgradeTree.revealNode('emergency_overclock');
                                });
                                PhaserScene.time.delayedCall(500, () => {
                                    upgradeTree.revealNode('armor');
                                });

                                PhaserScene.time.delayedCall(750, () => {
                                    upgradeTree.revealNode('diagnostic_analytics');
                                    PhaserScene.time.delayedCall(500, () => {
                                        upgradeTree.revealNode('access_internet');
                                    });

                                    PhaserScene.time.delayedCall(1000, () => {
                                        endCutscene(() => {
                                            if (typeof gameHUD !== 'undefined') {
                                                gameHUD.setCurrencyVisible(true);
                                            }
                                            if (typeof upgradeTree !== 'undefined') {
                                                upgradeTree.setNavigationEnabled(true);
                                            }
                                            // Play slide button hint animation at the location of the slide left button
                                            const cx = GAME_CONSTANTS.halfWidth * 2;
                                            const cy = GAME_CONSTANTS.halfHeight;
                                            const slideHint = PhaserScene.add.sprite(cx - 50, cy, 'buttons', 'slide_btn_anim_1.png');
                                            slideHint.setDepth(GAME_CONSTANTS.DEPTH_UPGRADE_TREE + 30);
                                            slideHint.setScrollFactor(0);
                                            slideHint.setOrigin(1, 0.5);
                                            slideHint.play('slide_btn_anim');
                                            setTimeout(() => {
                                                // make slideHint only play if fullUpgradeView is true
                                                if (typeof upgradeTree !== 'undefined' && upgradeTree.isFullView()) {
                                                    slideHint.play('slide_btn_anim');
                                                } else {
                                                    slideHint.setVisible(false);
                                                }
                                                setTimeout(() => {
                                                    slideHint.destroy();
                                                }, 2000)
                                            }, 2500)
                                            if (typeof upgradeTree !== 'undefined') {
                                                upgradeTree.assignToUICamera(slideHint);
                                            }

                                            if (node) node.finalizePurchase();
                                        });
                                    });
                                });
                            });
                        });
                    });
                }
            }
        },
        delayActualPurchase: true,
    },
    {
        id: 'test_defenses',
        name: t('nodes', 'test_defenses.name'),
        label: t('nodes', 'label.gate'),
        icon: 'Skillicon14_05.png',
        description: t('nodes', 'test_defenses.desc'),
        popupText: t('nodes', 'test_defenses.popup'),
        popupColor: COLORS.RESOURCE,
        maxLevel: 1,
        baseCost: 10,
        costType: 'data',
        costScaling: 'static',
        costStep: 0,
        parents: ['magnet'],
        childIds: ['bypass'],
        treeX: gridX(-2),
        treeY: gridY(1),
        effect: function () {
            gameState.upgrades.test_defenses_unlocked = true;
            if (typeof gameHUD !== 'undefined' && gameHUD.refreshTestDefensesButton) {
                gameHUD.refreshTestDefensesButton();
            }
        },
    },
    {
        id: 'bypass',
        name: t('nodes', 'bypass.name'),
        icon: 'Skillicon14_07.png',
        description: 'Refunds 75 DATA upon purchase',
        popupText: t('nodes', 'bypass.popup'),
        popupColor: COLORS.RESOURCE,
        maxLevel: 1,
        baseCost: 75,
        costType: 'data',
        costScaling: 'static',
        parents: ['test_defenses'],
        childIds: ['bomb_2'],
        treeX: gridX(-3),
        treeY: gridY(1.5),
        effect: function () {
            if (typeof resourceManager !== 'undefined') {
                resourceManager.addData(75);
            }
        },
        leaky: 10,
    },
    {
        id: 'data_compression',
        name: t('nodes', 'data_compression.name'),
        icon: 'Skillicon14_20.png',
        description: t('nodes', 'data_compression.desc'),
        popupText: t('nodes', 'data_compression.popup'),
        popupColor: COLORS.RESOURCE,
        maxLevel: 2,
        baseCost: 1,
        label: 'INSIGHT',
        costType: 'insight',
        costScaling: 'static',
        costStep: 0,
        parents: ['diagnostic_analytics'],
        childIds: ['combat_shield'],
        treeX: gridX(-4.5),
        treeY: gridY(5.0),
        effect: function () { },
    },
    {
        id: 'two_step_auth',
        name: t('nodes', 'two_step_auth.name'),
        icon: 'Skillicon14_10.png',
        description: t('nodes', 'two_step_auth.desc'),
        popupText: t('nodes', 'two_step_auth.popup'),
        popupColor: COLORS.RESOURCE,
        maxLevel: 1,
        baseCost: 1,
        label: '"UTILITY"',
        costType: 'insight',
        costScaling: 'static',
        parents: ['cheat'],
        childIds: [],
        tooltipExtraWidth: 40,
        treeX: gridX(1.5),
        treeY: gridY(-2.0),
        effect: function () {
            if (typeof resourceManager !== 'undefined') {
                resourceManager.addData(100);
            }
        },
    },
    {
        id: 'packet_sniffing',
        name: t('nodes', 'packet_sniffing.name'),
        icon: 'Skillicon14_01.png',
        description: t('nodes', 'packet_sniffing.desc'),
        popupText: t('nodes', 'packet_sniffing.popup'),
        popupColor: COLORS.RESOURCE,
        maxLevel: 1,
        baseCost: 1,
        label: 'INSIGHT',
        costType: 'insight',
        costScaling: 'static',
        parents: ['bomb_2'],
        childIds: [],
        treeX: gridX(-4),
        treeY: gridY(1),
        effect: function () {
            upgradeDispatcher.recalcPacketSniffing();
        },
    },

    {
        id: 'junk_data_2',
        name: t('nodes', 'junk_data_2.name'),
        label: t('nodes', 'label.plus_data'),
        icon: 'Skillicon14_12.png',
        description: t('nodes', 'junk_data_2.desc'),
        popupText: t('nodes', 'junk_data_2.popup'),
        popupColor: COLORS.RESOURCE,
        maxLevel: 10,
        baseCost: 2,
        label: t('nodes', 'label.plus_data'),
        costType: 'data',
        costScaling: 'static',
        requiresMaxParent: true,
        parents: ['cheat'],
        childIds: [],
        treeX: gridX(1.5),
        treeY: gridY(-3.0),
        effect: function () {
            if (typeof resourceManager !== 'undefined') {
                resourceManager.addData(10);
            }
        },
    },
    {
        id: 'repeat_exploit',
        name: t('nodes', 'repeat_exploit.name'),
        label: 'HACKING',
        icon: 'Skillicon14_09.png',
        description: t('nodes', 'repeat_exploit.desc'),
        popupText: t('nodes', 'repeat_exploit.popup'),
        popupColor: COLORS.COMBAT,
        maxLevel: 1,
        baseCost: 75,
        costType: 'data',
        costScaling: 'static',
        parents: ['trojan_access', 'impulse'],
        childIds: ['placeholder_duo_2', 'manual_protocol', 'broadcast_protocol'],
        treeX: gridX(2.5),
        treeY: gridY(4.5),
        effect: function () {
            upgradeDispatcher.recalcRepeatExploit();
            if (typeof upgradeTree !== 'undefined') upgradeTree.unlockNode('trojan_access');
        },
        leaky: 5,
    },
    {
        id: 'unsecured_wallet',
        name: t('nodes', 'unsecured_wallet.name'),
        icon: 'Skillicon14_08.png',
        description: t('nodes', 'unsecured_wallet.desc'),
        popupText: t('nodes', 'unsecured_wallet.popup'),
        popupColor: COLORS.RESOURCE,
        maxLevel: 1,
        baseCost: 1,
        label: 'INSIGHT',
        costType: 'insight',
        costScaling: 'static',
        parents: ['reveal_map'],
        childIds: ['access_internet'],
        tooltipExtraWidth: 140,
        treeX: gridX(0.5),
        treeY: gridY(5),
        effect: function () {
            if (typeof resourceManager !== 'undefined') {
                // Internally give 3 coins, which displays as 0.3 (0.1x scale)
                resourceManager.addCoin(3);
            }
        },
    },

    {
        id: 'access_internet',
        name: t('nodes', 'access_internet.name'),
        icon: 'Skillicon14_31.png',
        description: t('nodes', 'access_internet.desc'),
        popupText: t('nodes', 'access_internet.popup'),
        popupColor: COLORS.RESOURCE,
        maxLevel: 1,
        baseCost: 100,
        costType: 'data',
        costScaling: 'static',
        leaky: 10,
        requiresMaxParent: true,
        parents: ['data_chest_unlock', 'unsecured_wallet'],
        childIds: ['black_market', 'peak_traffic'],
        treeX: gridX(0),
        treeY: gridY(6),
        effect: function () {
            if (typeof upgradeDispatcher !== 'undefined') {
                upgradeDispatcher.recalcBackground();
            }
        },
    },

    {
        id: 'black_market',
        name: t('nodes', 'black_market.name'),
        icon: 'Skillicon14_03.png',
        description: t('nodes', 'black_market.desc'),
        popupText: t('nodes', 'black_market.popup'),
        popupColor: COLORS.COIN,
        maxLevel: 5,
        baseCost: 100,
        costType: 'data',
        costScaling: 'linear',
        costStep: 50,
        parents: ['access_internet'],
        childIds: [],
        treeX: gridX(-1),
        treeY: gridY(6),
        effect: function () {
            if (typeof resourceManager !== 'undefined') {
                resourceManager.addCoin(1); // Actually gives 1.0 coin
            }
        },
    },

    {
        id: 'impulse',
        name: t('nodes', 'impulse.name'),
        icon: 'Skillicon14_02.png',
        description: t('nodes', 'impulse.desc'),
        popupText: t('nodes', 'impulse.popup'),
        popupColor: COLORS.COMBAT,
        maxLevel: 1,
        baseCost: 50,
        costType: 'data',
        costScaling: 'static',
        parents: ['reveal_map'],
        childIds: ['repeat_exploit'],
        treeX: gridX(1.5),
        treeY: gridY(4),
        effect: function () {
            upgradeDispatcher.recalcPulseDamage();
            if (typeof upgradeTree !== 'undefined') upgradeTree.revealNode('trojan_access', false);
        },
    },

    {
        id: 'root_access',
        name: t('nodes', 'root_access.name'),
        icon: 'Skillicon14_09.png',
        description: t('nodes', 'root_access.desc'),
        maxLevel: 1,
        baseCost: 150,
        costType: 'data',
        costScaling: 'static',
        parents: ['malware_siphon'],
        childIds: ['clock_speed'],
        treeX: gridX(0.5),
        treeY: gridY(8.0),
        effect: function () { },
    },
    {
        id: 'placeholder_duo_3',
        isPlaceholder: true,
        parents: ['diagnostic_analytics'],
        monitorsDuoTier: 3,
        childIds: ['security_test_3'],
        treeX: gridX(-3.5),
        treeY: gridY(6.5),
        effect: function () { },
    },
    {
        id: 'laser',
        name: t('nodes', 'laser.name'),
        icon: 'Skillicon14_06.png',
        description: t('nodes', 'laser.desc'),
        popupText: t('nodes', 'laser.popup'),
        popupColor: COLORS.COMBAT,
        maxLevel: 1,
        baseCost: 1,
        costType: 'shard',
        costScaling: 'static',
        parents: ['diagnostic_analytics'],
        childIds: ['laser_aperture', 'laser_twin_beams'],
        isDuoBox: true,
        isLeftDuo: true,
        duoBoxTier: 3,
        shardId: 'laser',
        duoSiblingId: 'artillery',
        treeX: gridX(-3.5) - DUO_OFFSET,
        treeY: gridY(6.5),
        effect: function () {
            if (typeof laserAttack !== 'undefined') laserAttack.unlock();
            artilleryAttack.lock();
        },
    },
    {
        id: 'artillery',
        name: t('nodes', 'artillery.name'),
        icon: 'Skillicon14_11.png',
        description: t('nodes', 'artillery.desc'),
        popupText: t('nodes', 'artillery.popup'),
        popupColor: COLORS.COMBAT,
        maxLevel: 1,
        baseCost: 1,
        costType: 'shard',
        costScaling: 'static',
        duoSiblingId: 'laser',
        treeX: gridX(-3.5) + DUO_OFFSET,
        treeY: gridY(6.5),
        parents: ['diagnostic_analytics'],
        childIds: ['artillery_volley', 'artillery_first_strike'],
        isDuoBox: true,
        duoBoxTier: 3,
        shardId: 'artillery',
        effect: function () {
            artilleryAttack.unlock();
            if (typeof laserAttack !== 'undefined') laserAttack.lock();
        },
    },
    {
        id: 'laser_aperture',
        name: t('nodes', 'laser_aperture.name'),
        icon: 'Skillicon14_22.png',
        description: t('nodes', 'laser_aperture.desc'),
        popupText: t('nodes', 'laser_aperture.popup'),
        maxLevel: 1,
        baseCost: 125,
        costType: 'data',
        costScaling: 'static',
        parents: ['laser'],
        childIds: [],
        isDuoChild: true,
        treeX: gridX(-5.0),
        treeY: gridY(6.0),
        effect: function () {
            upgradeDispatcher.recalcLaser();
        },
    },

    {
        id: 'laser_twin_beams',
        name: t('nodes', 'laser_twin_beams.name'),
        icon: 'Skillicon14_30.png',
        description: t('nodes', 'laser_twin_beams.desc'),
        popupText: t('nodes', 'laser_twin_beams.popup'),
        maxLevel: 1,
        baseCost: 250,
        costType: 'data',
        costScaling: 'static',
        parents: ['laser'],
        childIds: [],
        isDuoChild: true,
        treeX: gridX(-5.0),
        treeY: gridY(7.0),
        effect: function () {
            upgradeDispatcher.recalcLaser();
        },
    },
    {
        id: 'artillery_volley',
        name: t('nodes', 'artillery_volley.name'),
        icon: 'Skillicon14_09.png',
        description: t('nodes', 'artillery_volley.desc'),
        popupText: t('nodes', 'artillery_volley.popup'),
        maxLevel: 1,
        baseCost: 250,
        costType: 'data',
        costScaling: 'static',
        parents: ['artillery'],
        childIds: [],
        isDuoChild: true,
        treeX: gridX(-2.0),
        treeY: gridY(7.0),
        effect: function () { upgradeDispatcher.recalcArtillery(); },
    },


    {
        id: 'artillery_first_strike',
        name: t('nodes', 'artillery_first_strike.name'),
        icon: 'Skillicon14_31.png',
        description: t('nodes', 'artillery_first_strike.desc'),
        popupText: t('nodes', 'artillery_first_strike.popup'),
        maxLevel: 3,
        baseCost: 75,
        costType: 'data',
        costScaling: 'linear',
        costStep: 0,
        parents: ['artillery'],
        childIds: [],
        isDuoChild: true,
        treeX: gridX(-2.0),
        treeY: gridY(6.0),
        effect: function () { upgradeDispatcher.recalcArtillery(); },
    },


    {
        id: 'unsecured_files',
        name: t('nodes', 'unsecured_files.name'),
        icon: 'Skillicon14_08.png',
        description: t('nodes', 'unsecured_files.desc'),
        popupText: '+15 DATA',
        popupColor: COLORS.RESOURCE,
        maxLevel: 10,
        baseCost: 1,
        label: t('nodes', 'label.plus_data'),
        costType: 'data',
        costScaling: 'static',
        parents: ['cheat'],
        childIds: [],
        treeX: gridX(-1.5),
        treeY: gridY(-3.0),
        effect: function () {
            if (typeof resourceManager !== 'undefined') {
                resourceManager.addData(15);
            }
        },
    },
    {
        id: 'zero_day_exploit',
        name: t('nodes', 'zero_day_exploit.name'),
        icon: 'Skillicon14_09.png',
        description: t('nodes', 'zero_day_exploit.desc'),
        popupText: t('nodes', 'zero_day_exploit.popup'),
        popupColor: COLORS.COMBAT,
        maxLevel: 1,
        baseCost: 50,
        label: "HACKING",
        costType: 'data',
        costScaling: 'static',
        parents: ['cheat'],
        childIds: [],
        treeX: gridX(-0.5),
        treeY: gridY(-2.5),
        effect: function () { },
    },
    {
        id: 'placeholder_duo_2',
        isPlaceholder: true,
        parents: ['repeat_exploit'],
        monitorsDuoTier: 2,
        childIds: ['manual_protocol', 'broadcast_protocol', 'instability_mark'],
        treeX: gridX(2.5),
        treeY: gridY(6.0),
        effect: function () { },
    },
    {
        id: 'instability_mark',
        name: t('nodes', 'instability_mark.name'),
        icon: 'Skillicon14_09.png',
        description: t('nodes', 'instability_mark.desc'),
        popupText: t('nodes', 'instability_mark.popup'),
        popupColor: COLORS.COMBAT,
        maxLevel: 1,
        baseCost: 150,
        costType: 'data',
        costScaling: 'static',
        parents: ['placeholder_duo_2'],
        childIds: ['malware_siphon', 'peak_performance'],
        treeX: gridX(2.5),
        treeY: gridY(7.5),
        effect: function () {
            upgradeDispatcher.recalcPulseDamage();
        },
    },
    {
        id: 'manual_protocol',
        name: t('nodes', 'manual_protocol.name'),
        icon: 'Skillicon14_34.png',
        description: t('nodes', 'manual_protocol.desc'),
        popupText: t('nodes', 'manual_protocol.popup'),
        popupColor: COLORS.COMBAT,
        maxLevel: 1,
        baseCost: 1,
        costType: 'shard',
        costScaling: 'static',
        parents: ['repeat_exploit'],
        childIds: ['manual_pulse_child_1'],
        isDuoBox: true,
        duoBoxTier: 2,
        shardId: 'manual_protocol',
        duoSiblingId: 'broadcast_protocol',
        treeX: gridX(2.5) + DUO_OFFSET, // Symmetric Duo offset (standardized)
        treeY: gridY(6),
        effect: function () {
            upgradeDispatcher.recalcPulseMode();
            upgradeDispatcher.recalcPulseSize();
        },
    },
    {
        id: 'broadcast_protocol',
        name: t('nodes', 'broadcast_protocol.name'),
        icon: 'Skillicon14_28.png',
        description: t('nodes', 'broadcast_protocol.desc'),
        popupText: t('nodes', 'broadcast_protocol.popup'),
        popupColor: COLORS.COMBAT,
        maxLevel: 1,
        baseCost: 1,
        costType: 'shard',
        costScaling: 'static',
        parents: ['repeat_exploit'],
        childIds: ['area_saturation', 'aftershock', 'colossal_cursor'],
        isDuoBox: true,
        isLeftDuo: true,
        duoBoxTier: 2,
        shardId: 'broadcast_protocol',
        duoSiblingId: 'manual_protocol',
        treeX: gridX(2.5) - DUO_OFFSET, // Symmetric Duo offset (standardized)
        treeY: gridY(6),
        effect: function () {
            upgradeDispatcher.recalcPulseSize();
            upgradeDispatcher.recalcPulseMode();
        },
    },
    {
        id: 'manual_pulse_child_1',
        name: t('nodes', 'manual_pulse_child_1.name'),
        icon: 'Skillicon14_33.png',
        description: t('nodes', 'manual_pulse_child_1.desc'),
        popupText: t('nodes', 'manual_pulse_child_1.popup'),
        maxLevel: 3,
        baseCost: 40,
        costType: 'data',
        costScaling: 'linear',
        costStep: 20,
        parents: ['manual_protocol'],
        childIds: ['manual_pulse_child_1_1', 'manual_pulse_child_1_2'],
        isDuoChild: true,
        treeX: gridX(4.0),
        treeY: gridY(6),
        effect: function () {
            upgradeDispatcher.recalcPulseCharges();
        },
    },
    {
        id: 'manual_pulse_child_1_1',
        name: t('nodes', 'manual_pulse_child_1_1.name'),
        icon: 'Skillicon14_25.png',
        description: t('nodes', 'manual_pulse_child_1_1.desc'),
        popupText: t('nodes', 'manual_pulse_child_1_1.popup'),
        maxLevel: 2,
        baseCost: 50,
        costType: 'data',
        costScaling: 'linear',
        costStep: 50,
        parents: ['manual_pulse_child_1'],
        childIds: [],
        isDuoChild: true,
        treeX: gridX(4.0),
        treeY: gridY(5),
        effect: function () {
            upgradeDispatcher.recalcPulseDamage();
        },
    },
    {
        id: 'manual_pulse_child_1_2',
        name: t('nodes', 'manual_pulse_child_1_2.name'),
        icon: 'Skillicon14_17.png',
        description: t('nodes', 'manual_pulse_child_1_2.desc'),
        popupText: t('nodes', 'manual_pulse_child_1_2.popup'),
        maxLevel: 1,
        baseCost: 75,
        costType: 'data',
        costScaling: 'static',
        parents: ['manual_pulse_child_1'],
        requiresMaxParent: true,
        childIds: [],
        isDuoChild: true,
        treeX: gridX(4.0),
        treeY: gridY(7),
        effect: function () {
            upgradeDispatcher.recalcPulseReload();
        },
    },
    {
        id: 'area_saturation',
        name: t('nodes', 'area_saturation.name'),
        icon: 'Skillicon14_22.png',
        description: t('nodes', 'area_saturation.desc'),
        popupText: t('nodes', 'area_saturation.popup'),
        maxLevel: 1,
        baseCost: 50,
        costType: 'data',
        costScaling: 'static',
        costStep: 0,
        parents: ['broadcast_protocol'],
        childIds: [],
        isDuoChild: true,
        treeX: gridX(1.5),
        treeY: gridY(7),
        effect: function () {
            upgradeDispatcher.recalcPulseDamage();
        },
    },
    {
        id: 'aftershock',
        name: t('nodes', 'aftershock.name'),
        icon: 'Skillicon14_21.png',
        description: t('nodes', 'aftershock.desc'),
        popupText: t('nodes', 'aftershock.popup'),
        popupColor: COLORS.DAMAGE,
        maxLevel: 2,
        baseCost: 40,
        costType: 'data',
        costScaling: 'linear',
        costStep: 0,
        parents: ['broadcast_protocol'],
        childIds: [],
        isDuoChild: true,
        treeX: gridX(1.5),
        treeY: gridY(5),
        effect: function () {
            upgradeDispatcher.recalcAftershock();
        },
    },
    {
        id: 'colossal_cursor',
        name: t('nodes', 'colossal_cursor.name'),
        icon: 'Skillicon14_14.png',
        description: t('nodes', 'colossal_cursor.desc'),
        popupText: t('nodes', 'colossal_cursor.popup'),
        popupColor: COLORS.UPGRADE,
        maxLevel: 1,
        baseCost: 75,
        costType: 'data',
        costScaling: 'static',
        parents: ['broadcast_protocol'],
        childIds: [],
        isDuoChild: true,
        treeX: gridX(1.0),
        treeY: gridY(6),
        requiresMaxParent: false,
        effect: function () {
            upgradeDispatcher.recalcPulseSize();
        },
    },
    {
        id: 'security_test_3',
        name: t('nodes', 'security_test_3.name'),
        label: t('nodes', 'label.gate'),
        icon: 'Skillicon14_38.png',
        description: t('nodes', 'security_test_3.desc'),
        popupText: t('nodes', 'security_test_3.popup'),
        maxLevel: 1,
        baseCost: 1000,
        costType: 'data',
        costScaling: 'static',
        parents: ['placeholder_duo_3'],
        childIds: [],
        treeX: gridX(-3.5),
        treeY: gridY(8.0),
        effect: function () {
            if (typeof resourceManager !== 'undefined') {
                resourceManager.addData(1000);
            }
        },
    },
    {
        id: 'coin_mine_unlock',
        name: t('nodes', 'coin_mine_unlock.name'),
        icon: 'Skillicon14_35.png',
        description: t('nodes', 'coin_mine_unlock.desc'),
        popupText: t('nodes', 'coin_mine_unlock.popup'),
        popupColor: COLORS.RESOURCE,
        maxLevel: 1,
        baseCost: 0,
        costType: 'data',
        costScaling: 'static',
        costStep: 0,
        parents: ['cheat'],
        childIds: [],
        treeX: gridX(-0.5),
        treeY: gridY(-3.0),
        effect: function () {
            if (typeof upgradeTree !== 'undefined') {
                upgradeTree._showCoinMineButton();
            }
        },
    },
    {
        id: 'physical_anchor',
        name: t('nodes', 'physical_anchor.name'),
        icon: 'Skillicon14_16.png',
        description: t('nodes', 'physical_anchor.desc'),
        maxLevel: 1,
        baseCost: 1,
        costType: 'coin',
        costScaling: 'static',
        parents: ['cheat'],
        childIds: [],
        treeX: gridX(0.5),
        treeY: gridY(-3.0),
        popupText: t('nodes', 'physical_anchor.popup'),
        popupColor: COLORS.UTILITY,
        effect: function () {
            // Stats recalculated by tower.js listener
        },
    },
    {
        id: 'peak_performance',
        name: t('nodes', 'peak_performance.name'),
        icon: 'Skillicon14_05.png',
        description: t('nodes', 'peak_performance.desc'),
        popupText: t('nodes', 'peak_performance.popup'),
        popupColor: COLORS.COMBAT,
        maxLevel: 1,
        baseCost: 200,
        costType: 'data',
        costScaling: 'static',
        parents: ['instability_mark'],
        childIds: ['data_mining'],
        treeX: gridX(3.5),
        treeY: gridY(8.0),
        effect: function () {
            if (typeof tower !== 'undefined') {
                tower.recalcStats();
            }
        },
    },
    {
        id: 'data_mining',
        name: t('nodes', 'data_mining.name'),
        icon: 'Skillicon14_05.png',
        description: t('nodes', 'data_mining.desc'),
        popupText: t('nodes', 'data_mining.popup'),
        popupColor: COLORS.RESOURCE,
        maxLevel: 1,
        baseCost: 1,
        costType: 'insight',
        costScaling: 'static',
        parents: ['peak_performance', 'parallel_processing'],
        childIds: ['farsight'],
        treeX: gridX(4.5),
        treeY: gridY(8.0),
        effect: function () {
            if (typeof upgradeTree !== 'undefined') upgradeTree.unlockNode('peak_performance');
        },
    },
    {
        id: 'farsight',
        name: t('nodes', 'farsight.name'),
        icon: 'Skillicon14_30.png',
        description: t('nodes', 'farsight.desc'),
        popupText: t('nodes', 'farsight.popup'),
        popupColor: COLORS.UTILITY,
        maxLevel: 1,
        baseCost: 150,
        costType: 'data',
        costScaling: 'static',
        parents: ['data_mining'],
        childIds: ['prismatic_array'],
        treeX: gridX(5.5),
        treeY: gridY(8.0),
        effect: function () {
            if (typeof tower !== 'undefined') {
                tower.recalcStats();
            }
        },
    }
];
