// Cross-file global collision check.
// Every script in index.html shares one global scope, so two files declaring the same
// top-level name either throw at load time (let/const/class: "Identifier has already been
// declared") or silently overwrite each other (var/function). ESLint lints one file at a
// time and can't see this, so it's checked here.
//
// Usage: node tools/check-globals.js   (exit code 1 on hard collisions)

const { getGameScripts, getTopLevelDeclarations } = require('./gameScripts');

const LEXICAL = new Set(['let', 'const', 'class']);
const byName = new Map();

for (const file of getGameScripts()) {
    let decls;
    try {
        decls = getTopLevelDeclarations(file);
    } catch (e) {
        console.error(`✗ ${file}: parse error: ${e.message}`);
        process.exitCode = 1;
        continue;
    }
    for (const d of decls) {
        if (!byName.has(d.name)) byName.set(d.name, []);
        byName.get(d.name).push({ file, ...d });
    }
}

const errors = [];
const warnings = [];
for (const [name, decls] of byName) {
    const files = new Set(decls.map(d => d.file));
    if (files.size < 2) continue;
    const declared = decls.filter(d => d.kind !== 'window');
    const where = decls.map(d => `${d.file}:${d.line} (${d.kind})`).join(', ');
    // A let/const/class clashing with any other top-level declaration throws at load time.
    if (declared.some(d => LEXICAL.has(d.kind)) && new Set(declared.map(d => d.file)).size > 1) {
        errors.push(`'${name}' declared in multiple files: ${where}`);
    } else if (new Set(declared.map(d => d.file)).size > 1) {
        warnings.push(`'${name}' redefined across files (later one wins): ${where}`);
    }
}

if (errors.length) {
    console.log(`Global collisions — will throw at load time (${errors.length}):`);
    errors.forEach(e => console.log('  ✗ ' + e));
}
if (warnings.length) {
    console.log(`Global redefinitions — last loaded file wins (${warnings.length}):`);
    warnings.forEach(w => console.log('  • ' + w));
}
if (!errors.length && !warnings.length) console.log('check-globals: no cross-file collisions.');
if (errors.length) process.exitCode = 1;
