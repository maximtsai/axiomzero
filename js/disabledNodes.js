/**
 * @fileoverview Collection of nodes that are not active in the main tree by default.
 * These can be dynamically moved or activated at runtime.
 */

const DISABLED_NODES = [
    {
        id: 'hello_world',
        name: 'Hello World',
        description: 'This is a test node to verify dynamic node placement and persistence.',
        maxLevel: 1,
        baseCost: 0,
        costType: 'data',
        costScaling: 'static',
        parents: [],
        childIds: [],
        treeX: 400, // Default center (gridX(0) roughly)
        treeY: 740, // Default start (gridY(0) roughly)
        effect: function() {
            console.log("Hello World node activated!");
        }
    }
];
