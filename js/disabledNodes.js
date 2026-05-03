/**
 * @fileoverview Collection of nodes that are not active in the main tree by default.
 * These can be dynamically moved or activated at runtime.
 */

const DISABLED_NODES = [
    {
        id: 'hello_world',
        name: 'Hello World',
        description: 'This is a test node to verify dynamic node placement and persistence.',
        icon: 'Skillicon14_07.png',
        maxLevel: 1,
        baseCost: 0,
        costType: 'data',
        costScaling: 'static',
        parents: [],
        childIds: [],
        treeX: gridX(0),
        treeY: gridY(0),
        effect: function () {
            console.log("Hello World node activated!");
        }
    },
    {
        id: 'uninstall_companion',
        name: t('nodes', 'uninstall_companion.name'),
        description: t('nodes', 'uninstall_companion.desc'),
        icon: 'Skillicon14_10.png',
        maxLevel: 1,
        baseCost: 0,
        costType: 'data',
        costScaling: 'static',
        parents: [],
        childIds: [],
        treeX: gridX(1),
        treeY: gridY(0),
        effect: function () {
            console.log("Companion uninstalled. It chirps a final, hopeful note, wishing you well.");
        }
    },
    {
        id: 'sharp_teeth',
        name: t('nodes', 'sharp_teeth.name'),
        description: t('nodes', 'sharp_teeth.desc'),
        icon: 'Skillicon14_11.png',
        maxLevel: 5,
        baseCost: 250,
        costType: 'data',
        costScaling: 'linear',
        parents: [],
        childIds: [],
        treeX: gridX(2),
        treeY: gridY(0),
        effect: function () {
            console.log("Sharp Teeth upgraded. The companion's combat sub-routines are becoming more aggressive.");
        }
    },
    {
        id: 'companion_collector',
        name: t('nodes', 'companion_collector.name'),
        description: t('nodes', 'companion_collector.desc'),
        icon: 'Skillicon14_08.png',
        maxLevel: 1,
        baseCost: 500,
        costType: 'data',
        costScaling: 'static',
        parents: [],
        childIds: [],
        treeX: gridX(3),
        treeY: gridY(0),
        effect: function () {
            console.log("Data Scavenger activated. The companion is now prioritizing uncollected data drops.");
        }
    },
    {
        id: 'reinstall_companion',
        name: t('nodes', 'reinstall_companion.name'),
        description: t('nodes', 'reinstall_companion.desc'),
        icon: 'Skillicon14_31.png',
        maxLevel: 1,
        baseCost: 0,
        costType: 'data',
        costScaling: 'static',
        parents: [],
        childIds: [],
        treeX: gridX(4),
        treeY: gridY(0),
        effect: function () {
            console.log("Companion reinstalled. It chirps a happy welcome back!");
        }
    }
];
