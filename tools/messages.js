// Generates docs/MESSAGES.md from the code: every messageBus topic, the payload each
// publish call sends, and which files publish / subscribe to it.
//
//   node tools/messages.js          rewrite docs/MESSAGES.md
//   node tools/messages.js --check  exit 1 if docs/MESSAGES.md is out of date
//
// Topics are read from the game scripts in index.html (parsed with espree, so multi-line
// calls and GAME_CONSTANTS.EVENTS.* constants resolve). The "Notes" column is hand-written:
// it is carried over from the existing doc on every regeneration.

const fs = require('fs');
const path = require('path');
const espree = require('espree');
const { ROOT, getGameScripts } = require('./gameScripts');

const DOC = path.join(ROOT, 'docs', 'MESSAGES.md');
const PUBLISH_WRAPPERS = new Set(['_publish']); // local helpers that forward to messageBus.publish

function parse(relPath) {
    const src = fs.readFileSync(path.join(ROOT, relPath), 'utf8');
    return { src, ast: espree.parse(src, { ecmaVersion: 'latest', sourceType: 'script', range: true, loc: true }) };
}

/** Recursively visit every node of an ESTree AST. */
function walk(node, visit) {
    if (!node || typeof node.type !== 'string') return;
    visit(node);
    for (const key of Object.keys(node)) {
        if (key === 'parent') continue;
        const child = node[key];
        if (Array.isArray(child)) child.forEach(c => walk(c, visit));
        else if (child && typeof child.type === 'string') walk(child, visit);
    }
}

/** GAME_CONSTANTS.EVENTS = { NAME: 'topic', ... } from js/gameConfig.js. */
function readEventConstants() {
    const { ast } = parse('js/gameConfig.js');
    const events = {};
    walk(ast, (n) => {
        if (n.type !== 'AssignmentExpression' || n.right.type !== 'ObjectExpression') return;
        const l = n.left;
        if (l.type === 'MemberExpression' && l.property.name === 'EVENTS' && l.object.name === 'GAME_CONSTANTS') {
            for (const p of n.right.properties) {
                if (p.key && p.value && p.value.type === 'Literal') events[p.key.name || p.key.value] = p.value.value;
            }
        }
    });
    return events;
}

function topicOf(arg, events) {
    if (!arg) return null;
    if (arg.type === 'Literal' && typeof arg.value === 'string') return arg.value;
    if (arg.type === 'TemplateLiteral' && arg.expressions.length === 0) return arg.quasis[0].value.cooked;
    // GAME_CONSTANTS.EVENTS.NAME
    if (arg.type === 'MemberExpression' && arg.object.type === 'MemberExpression'
        && arg.object.property.name === 'EVENTS' && arg.object.object.name === 'GAME_CONSTANTS') {
        return events[arg.property.name] || null;
    }
    return null; // dynamic topic (variable) — not documentable statically
}

function collect() {
    const events = readEventConstants();
    const topics = new Map(); // topic -> { payloads:Set, pub:Set, sub:Set }
    const get = (t) => {
        if (!topics.has(t)) topics.set(t, { payloads: new Set(), pub: new Set(), sub: new Set() });
        return topics.get(t);
    };

    for (const file of getGameScripts()) {
        if (file.endsWith('js/util/messageBus.js')) continue;
        const { src, ast } = parse(file);
        walk(ast, (n) => {
            if (n.type !== 'CallExpression') return;
            const c = n.callee;
            let kind = null;
            if (c.type === 'MemberExpression' && !c.computed && c.object.type === 'Identifier' && c.object.name === 'messageBus') {
                if (c.property.name === 'publish') kind = 'pub';
                else if (c.property.name === 'subscribe' || c.property.name === 'subscribeOnce') kind = 'sub';
            } else if (c.type === 'Identifier' && PUBLISH_WRAPPERS.has(c.name)) {
                kind = 'pub';
            }
            if (!kind) return;
            const topic = topicOf(n.arguments[0], events);
            if (!topic) return;
            const entry = get(topic);
            const where = file.replace(/^js\//, '');
            if (kind === 'pub') {
                entry.pub.add(where);
                const args = n.arguments.slice(1).map(a => src.slice(a.range[0], a.range[1]).replace(/\s+/g, ' '));
                entry.payloads.add(args.length ? args.join(', ') : '—');
            } else {
                entry.sub.add(where);
            }
        });
    }
    return topics;
}

/** Notes column of the existing doc, keyed by topic, so hand-written notes survive. */
function readExistingNotes() {
    const notes = {};
    if (!fs.existsSync(DOC)) return notes;
    for (const line of fs.readFileSync(DOC, 'utf8').split('\n')) {
        const m = line.match(/^\| `([^`]+)` \|.*\| ([^|]*) \|$/);
        if (m && m[2].trim()) notes[m[1]] = m[2].trim();
    }
    return notes;
}

const cell = (s) => s.replace(/\|/g, '\\|');
const truncate = (s, n = 70) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

function render(topics, notes) {
    const names = [...topics.keys()].sort((a, b) => a.localeCompare(b));
    const rows = names.map((t) => {
        const e = topics.get(t);
        const payload = e.pub.size ? [...e.payloads].slice(0, 2).map(p => '`' + cell(truncate(p)) + '`').join('<br>') : '';
        const pub = [...e.pub].sort().join(', ') || '—';
        const sub = [...e.sub].sort().join(', ') || '—';
        return `| \`${t}\` | ${payload} | ${pub} | ${sub} | ${cell(notes[t] || '')} |`;
    });
    const orphanPub = names.filter(t => topics.get(t).pub.size && !topics.get(t).sub.size);
    const orphanSub = names.filter(t => topics.get(t).sub.size && !topics.get(t).pub.size);
    const list = (arr) => (arr.length ? arr.map(t => `- \`${t}\``).join('\n') : '- none');

    return [
        '# MessageBus Topics',
        '',
        '<!-- Generated by `npm run docs:messages` (tools/messages.js). Edit only the Notes column;',
        '     everything else is rebuilt from the code. `npm test` fails when this file is stale. -->',
        '',
        'Systems talk through `messageBus.publish(topic, ...args)` / `subscribe(topic, fn)` (`js/util/messageBus.js`).',
        'Many topics have a named constant in `GAME_CONSTANTS.EVENTS` (`js/gameConfig.js`).',
        '"Payload" is the argument list of a publish call (up to two distinct shapes). File paths are relative to `js/`.',
        '',
        `## Topics (${names.length})`,
        '',
        '| Topic | Payload | Published by | Subscribed by | Notes |',
        '|---|---|---|---|---|',
        ...rows,
        '',
        '## Published but never subscribed',
        '',
        list(orphanPub),
        '',
        '## Subscribed but never published',
        '',
        list(orphanSub),
        '',
    ].join('\n');
}

function generate() {
    return render(collect(), readExistingNotes());
}

if (require.main === module) {
    const out = generate();
    if (process.argv.includes('--check')) {
        const current = fs.existsSync(DOC) ? fs.readFileSync(DOC, 'utf8') : '';
        if (current !== out) {
            console.error('docs/MESSAGES.md is out of date. Run: npm run docs:messages');
            process.exit(1);
        }
        console.log('docs/MESSAGES.md is up to date.');
    } else {
        fs.writeFileSync(DOC, out);
        console.log('Wrote docs/MESSAGES.md');
    }
}

module.exports = { generate, DOC };
