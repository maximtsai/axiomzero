/**
 * @fileoverview Lore and Archive nodes for the Upgrade Tree.
 * Separated from nodeDefs.js for better organization.
 */

const LORE_DEFS = [
    {
        id: 'lore_1',
        name: t('nodes', 'lore_1.name'),
        lore: true,
        label: t('nodes', 'label.lore'),
        icon: 'Skillicon14_08.png',
        description: t('nodes', 'lore_1.desc'),
        maxLevel: 1,
        baseCost: 1,
        costType: 'data',
        costScaling: 'static',
        parents: ['bug_report'],
        childIds: [],
        treeX: gridX(-3),
        treeY: gridY(0),
        requiresMaxParent: true,
        tooltipExtraWidth: 200,
        effect: function () {
            const node = upgradeTree.getNode('lore_1');
            if (node) {
                node.description = t('nodes', 'lore_1.unlocked_desc');
            }
        },
    },
    {
        id: 'lore_2',
        name: t('nodes', 'lore_2.name'),
        lore: true,
        label: t('nodes', 'label.lore'),
        icon: 'Skillicon14_08.png',
        description: t('nodes', 'lore_2.desc'),
        maxLevel: 1,
        baseCost: 1,
        costType: 'data',
        costScaling: 'static',
        parents: ['bomb'],
        childIds: [],
        treeX: gridX(3),
        treeY: gridY(-0.5),
        requiresMaxParent: true,
        tooltipExtraWidth: 200,
        effect: function () {
            const node = upgradeTree.getNode('lore_2');
            if (node) {
                node.description = t('nodes', 'lore_2.unlocked_desc');
            }
        },
    },
    {
        id: 'lore_3',
        name: t('nodes', 'lore_3.name'),
        lore: true,
        label: t('nodes', 'label.lore'),
        icon: 'Skillicon14_08.png',
        description: t('nodes', 'lore_3.desc'),
        maxLevel: 1,
        baseCost: 1,
        costType: 'data',
        costScaling: 'static',
        parents: ['cheat'],
        childIds: ['lore_4'],
        treeX: gridX(-2.0),
        treeY: gridY(-2.0),
        tooltipExtraWidth: 200,
        effect: function () {
            const node = upgradeTree.getNode('lore_3');
            if (node) {
                node.description = t('nodes', 'lore_3.unlocked_desc');
            }
        },
    },
    {
        id: 'lore_4',
        name: t('nodes', 'lore_4.name'),
        lore: true,
        label: t('nodes', 'label.lore'),
        icon: 'Skillicon14_08.png',
        description: t('nodes', 'lore_4.desc'),
        maxLevel: 1,
        baseCost: 1,
        costType: 'data',
        costScaling: 'static',
        parents: ['lore_3'],
        childIds: ['lore_5'],
        treeX: gridX(-4.5),
        treeY: gridY(3.5),
        tooltipExtraWidth: 200,
        effect: function () {
            const node = upgradeTree.getNode('lore_4');
            if (node) {
                node.description = t('nodes', 'lore_4.unlocked_desc');
            }
        },
    },
    {
        id: 'lore_5',
        name: t('nodes', 'lore_5.name'),
        lore: true,
        label: t('nodes', 'label.lore'),
        icon: 'Skillicon14_08.png',
        description: t('nodes', 'lore_5.desc'),
        maxLevel: 1,
        baseCost: 1,
        costType: 'data',
        costScaling: 'static',
        parents: ['lore_4'],
        childIds: ['lore_6'],
        treeX: gridX(-4.5),
        treeY: gridY(4.5),
        tooltipExtraWidth: 200,
        effect: function () {
            const node = upgradeTree.getNode('lore_5');
            if (node) {
                node.description = t('nodes', 'lore_5.unlocked_desc');
            }
        },
    },
    {
        id: 'lore_6',
        name: t('nodes', 'lore_6.name'),
        lore: true,
        label: t('nodes', 'label.lore'),
        icon: 'Skillicon14_08.png',
        description: t('nodes', 'lore_6.desc'),
        maxLevel: 1,
        baseCost: 1,
        costType: 'data',
        costScaling: 'static',
        parents: ['lore_5'],
        childIds: ['lore_7'],
        treeX: gridX(-4.5),
        treeY: gridY(5.5),
        tooltipExtraWidth: 200,
        effect: function () {
            const node = upgradeTree.getNode('lore_6');
            if (node) {
                node.description = t('nodes', 'lore_6.unlocked_desc');
            }
        },
    },
    {
        id: 'lore_7',
        name: t('nodes', 'lore_7.name'),
        lore: true,
        label: t('nodes', 'label.lore'),
        icon: 'Skillicon14_08.png',
        description: t('nodes', 'lore_7.desc'),
        maxLevel: 1,
        baseCost: 1,
        costType: 'data',
        costScaling: 'static',
        parents: ['lore_6'],
        childIds: ['lore_8'],
        treeX: gridX(-4.5),
        treeY: gridY(6.5),
        tooltipExtraWidth: 200,
        effect: function () {
            const node = upgradeTree.getNode('lore_7');
            if (node) {
                node.description = t('nodes', 'lore_7.unlocked_desc');
            }
        },
    },
    {
        id: 'lore_8',
        name: t('nodes', 'lore_8.name'),
        lore: true,
        label: t('nodes', 'label.lore'),
        icon: 'Skillicon14_08.png',
        description: t('nodes', 'lore_8.desc'),
        maxLevel: 1,
        baseCost: 1,
        costType: 'data',
        costScaling: 'static',
        parents: ['lore_7'],
        childIds: ['lore_9'],
        treeX: gridX(-4.5),
        treeY: gridY(7.5),
        tooltipExtraWidth: 200,
        effect: function () {
            const node = upgradeTree.getNode('lore_8');
            if (node) {
                node.description = t('nodes', 'lore_8.unlocked_desc');
            }
        },
    },
    {
        id: 'lore_9',
        name: t('nodes', 'lore_9.name'),
        lore: true,
        label: t('nodes', 'label.lore'),
        icon: 'Skillicon14_08.png',
        description: t('nodes', 'lore_9.desc'),
        maxLevel: 1,
        baseCost: 1,
        costType: 'data',
        costScaling: 'static',
        parents: ['lore_8'],
        childIds: [],
        treeX: gridX(-4.5),
        treeY: gridY(8.5),
        tooltipExtraWidth: 200,
        effect: function () {
            const node = upgradeTree.getNode('lore_9');
            if (node) {
                node.description = t('nodes', 'lore_9.unlocked_desc');
            }
        },
    },
];

// Automatically integrate with the main NODE_DEFS array if it exists.
if (typeof NODE_DEFS !== 'undefined') {
    NODE_DEFS.push(...LORE_DEFS);
}
