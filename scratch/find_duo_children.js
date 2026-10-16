const fs = require('fs');
const path = require('path');

const content = fs.readFileSync('js/nodeDefs.js', 'utf8');

// Simple parser for NODE_DEFS
function parseNodeDefs(jsContent) {
    const nodes = [];
    const nodeRegex = /\{\s*id:\s*'([^']+)'(?:.|\n)*?childIds:\s*\[([^\]]*)\]/g;
    let match;
    while ((match = nodeRegex.exec(jsContent)) !== null) {
        const id = match[1];
        const childIds = match[2].split(',').map(s => s.trim().replace(/'/g, '').replace(/"/g, '')).filter(s => s.length > 0);
        nodes.push({ id, childIds });
    }
    return nodes;
}

const allNodes = parseNodeDefs(content);
const nodeMap = new Map();
allNodes.forEach(n => nodeMap.set(n.id, n.childIds));

function getDescendants(startIds) {
    const descendants = new Set();
    const queue = [...startIds];
    while (queue.length > 0) {
        const id = queue.shift();
        const children = nodeMap.get(id) || [];
        children.forEach(cid => {
            if (!descendants.has(cid)) {
                descendants.add(cid);
                queue.push(cid);
            }
        });
    }
    return Array.from(descendants);
}

const duoNodes = ['lightning_weapon', 'shockwave_weapon', 'manual_protocol', 'broadcast_protocol', 'laser', 'artillery'];
const duoChildren = getDescendants(duoNodes);

console.log(JSON.stringify(duoChildren, null, 2));
