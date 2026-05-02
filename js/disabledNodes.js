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
    }
];
