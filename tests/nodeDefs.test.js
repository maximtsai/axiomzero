// Upgrade tree data checks (js/nodeDefs.js + js/loreDefs.js): unique ids, parent/child links
// that agree both ways, valid cost types, and no two nodes on the same grid spot (an overlap
// makes one of them unclickable).

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');

function loadDefs() {
    const ctx = {
        console,
        GAME_CONSTANTS: { COLOR_HOSTILE: 0, COLOR_FRIENDLY: 0, COLOR_RESOURCE: 0, halfWidth: 800, halfHeight: 450, WIDTH: 1600, HEIGHT: 900 },
        t: (ns, key) => `${ns}.${key}`,
        gameState: {},
    };
    vm.createContext(ctx);
    for (const f of ['js/nodeDefs.js', 'js/loreDefs.js']) {
        vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
    }
    return vm.runInContext('NODE_DEFS', ctx);
}

const defs = loadDefs();
const byId = new Map(defs.map(d => [d.id, d]));

describe('upgrade tree definitions', () => {
    it('has unique ids', () => {
        assert.equal(byId.size, defs.length);
    });

    it('lists every parent/child link on both nodes', () => {
        const problems = [];
        for (const d of defs) {
            // Placeholder duo nodes list both choices as children only to group them in the UI
            for (const c of d.isPlaceholder ? [] : d.childIds || []) {
                if (!byId.has(c)) problems.push(`${d.id}: child ${c} does not exist`);
                else if (!(byId.get(c).parents || []).includes(d.id)) problems.push(`${d.id} -> ${c}, but ${c}.parents lacks ${d.id}`);
            }
            for (const p of d.parents || []) {
                if (!byId.has(p)) problems.push(`${d.id}: parent ${p} does not exist`);
                else if (!(byId.get(p).childIds || []).includes(d.id)) problems.push(`${d.id} <- ${p}, but ${p}.childIds lacks ${d.id}`);
            }
        }
        assert.deepEqual(problems, []);
    });

    it('uses real currencies', () => {
        const valid = new Set(['data', 'insight', 'shard', 'processor', 'coin']);
        // Spread into a local array: arrays made inside the vm context fail deepEqual
        const bad = [...defs.filter(d => !d.isPlaceholder && !valid.has(d.costType)).map(d => `${d.id}: ${d.costType}`)];
        assert.deepEqual(bad, []);
    });

    it('never puts two nodes on the same grid spot', () => {
        const seen = new Map();
        const overlaps = [];
        for (const d of defs) {
            const key = `${Math.round(d.treeX)},${Math.round(d.treeY)}`;
            if (seen.has(key)) overlaps.push(`${seen.get(key)} and ${d.id} at (${key})`);
            else seen.set(key, d.id);
        }
        assert.deepEqual(overlaps, []);
    });
});
