// Shared helpers for dev tooling: the game's own scripts (in index.html load order)
// and the top-level names each one declares into the shared global scope.

const fs = require('fs');
const path = require('path');
const espree = require('espree');

const ROOT = path.resolve(__dirname, '..');

/** Local, non-minified script paths from index.html, in load order (repo-relative). */
function getGameScripts() {
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    return [...html.matchAll(/<script\s+[^>]*src="([^"]+)"/g)]
        .map(m => m[1].trim().replace(/^\.\//, ''))
        .filter(src => !/^https?:/.test(src) && !/\.min\.js$/.test(src))
        .filter(src => fs.existsSync(path.join(ROOT, src)));
}

/**
 * Top-level declarations of a classic script.
 * @returns {{name: string, kind: 'var'|'let'|'const'|'function'|'class'|'window', line: number}[]}
 */
function getTopLevelDeclarations(relPath) {
    const src = fs.readFileSync(path.join(ROOT, relPath), 'utf8');
    const ast = espree.parse(src, { ecmaVersion: 'latest', sourceType: 'script', loc: true });
    const out = [];
    const addPattern = (node, kind) => {
        if (!node) return;
        if (node.type === 'Identifier') out.push({ name: node.name, kind, line: node.loc.start.line });
        else if (node.type === 'ObjectPattern') node.properties.forEach(p => addPattern(p.value || p.argument, kind));
        else if (node.type === 'ArrayPattern') node.elements.forEach(e => addPattern(e, kind));
        else if (node.type === 'AssignmentPattern') addPattern(node.left, kind);
        else if (node.type === 'RestElement') addPattern(node.argument, kind);
    };
    for (const stmt of ast.body) {
        if (stmt.type === 'VariableDeclaration') stmt.declarations.forEach(d => addPattern(d.id, stmt.kind));
        else if (stmt.type === 'FunctionDeclaration' && stmt.id) out.push({ name: stmt.id.name, kind: 'function', line: stmt.loc.start.line });
        else if (stmt.type === 'ClassDeclaration' && stmt.id) out.push({ name: stmt.id.name, kind: 'class', line: stmt.loc.start.line });
    }
    // `window.foo = ...` anywhere in the file also creates a global.
    for (const m of src.matchAll(/\bwindow\.([A-Za-z_$][\w$]*)\s*=[^=]/g)) {
        out.push({ name: m[1], kind: 'window', line: src.slice(0, m.index).split('\n').length });
    }
    return out;
}

module.exports = { ROOT, getGameScripts, getTopLevelDeclarations };
