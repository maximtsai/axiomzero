// Asset audit — cross-checks asset files, their registrations, and code references.
// Usage (from repo root): node .claude/skills/asset-audit/audit.js
// Read-only: prints a report, never modifies files. Exit code 1 if any hard error is found.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '../../..');

// ── Load registration arrays by evaluating the asset declaration files ─────
function loadDecls(file, names) {
    const ctx = {};
    vm.createContext(ctx);
    const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
    vm.runInContext(src + '\n;' + names.map(n => `this.${n} = typeof ${n} !== 'undefined' ? ${n} : undefined;`).join(''), ctx);
    return ctx;
}

const { audioFiles } = loadDecls('assets/audioFiles.js', ['audioFiles']);
const { imageFilesPreload, imageAtlases } = loadDecls('assets/imageFiles.js', ['imageFilesPreload', 'imageAtlases']);

// ── Gather game source (only scripts actually loaded by index.html) ────────
const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const scriptSrcs = [...indexHtml.matchAll(/<script\s+[^>]*src="([^"]+)"/g)]
    .map(m => m[1])
    .filter(s => !/^https?:/.test(s) && !/\.min\.js$/.test(s));
const sources = scriptSrcs
    .filter(s => fs.existsSync(path.join(ROOT, s)))
    .map(s => ({ file: s, text: fs.readFileSync(path.join(ROOT, s), 'utf8') }));
const allCode = sources.map(s => s.text).join('\n') + '\n' + indexHtml;

function findRefs(regex) {
    const out = [];
    for (const { file, text } of sources) {
        const lines = text.split('\n');
        lines.forEach((line, i) => {
            const t = line.trim();
            if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return;   // skip commented-out code
            for (const m of line.matchAll(regex)) out.push({ key: m[1], at: `${file}:${i + 1}` });
        });
    }
    return out;
}

const errors = [];
const warnings = [];

// ── Audio ──────────────────────────────────────────────────────────────────
const audioDir = path.join(ROOT, 'assets/audio');
const audioOnDisk = new Set(fs.readdirSync(audioDir).filter(f => /\.(mp3|ogg|wav|m4a)$/i.test(f)));
const registeredAudio = new Map(audioFiles.map(a => [a.name, a.src]));
const registeredAudioFiles = new Set(audioFiles.map(a => path.basename(a.src)));

const dupNames = audioFiles.map(a => a.name).filter((n, i, arr) => arr.indexOf(n) !== i);
dupNames.forEach(n => errors.push(`audio: key '${n}' registered more than once in assets/audioFiles.js`));

for (const [name, src] of registeredAudio) {
    if (!fs.existsSync(path.join(ROOT, 'assets', src))) errors.push(`audio: '${name}' points to missing file assets/${src}`);
}
for (const f of audioOnDisk) {
    if (!registeredAudioFiles.has(f)) warnings.push(`audio: assets/audio/${f} is on disk but not registered`);
}

const audioCalls = findRefs(/audio\.(?:play|playMusic|swapMusic|playSound|stop|stopMusic)\(\s*['"]([\w-]+)['"]/g);
for (const r of audioCalls) {
    if (!registeredAudio.has(r.key)) errors.push(`audio: '${r.key}' played at ${r.at} but not registered`);
}
for (const name of registeredAudio.keys()) {
    if (!new RegExp(`['"\`]${name}['"\`]`).test(allCode)) warnings.push(`audio: '${name}' is registered but never referenced in code`);
}

// ── Images / atlases ───────────────────────────────────────────────────────
const frames = new Set();
for (const atlas of imageAtlases) {
    const jsonPath = path.join(ROOT, 'assets', atlas.src);
    if (!fs.existsSync(jsonPath)) { errors.push(`atlas: '${atlas.name}' points to missing assets/${atlas.src}`); continue; }
    const json = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    const textures = json.textures || [{ frames: json.frames, image: json.meta && json.meta.image }];
    for (const tex of textures) {
        if (tex.image && !fs.existsSync(path.join(path.dirname(jsonPath), tex.image))) {
            errors.push(`atlas: '${atlas.name}' references missing page image ${tex.image}`);
        }
        const fr = Array.isArray(tex.frames) ? tex.frames.map(f => f.filename) : Object.keys(tex.frames || {});
        fr.forEach(f => frames.add(f));
    }
}
for (const img of imageFilesPreload) {
    if (!fs.existsSync(path.join(ROOT, 'assets', img.src))) errors.push(`image: '${img.name}' points to missing assets/${img.src}`);
}

// Frame names are referenced as string literals ending in .png/.webp. Literals built
// dynamically (template strings, concatenation) can't be checked and are skipped.
const frameRefs = findRefs(/['"]([\w\-./]+\.(?:png|webp))['"]/g)
    .filter(r => !r.key.includes('/'))    // paths like 'preload/x.png' are file loads, not frames
    .filter(r => !/^[_-]/.test(r.key));   // suffix fragments like '_hover.png' are concatenated at runtime
const missingFrames = new Map();
for (const r of frameRefs) {
    if (!frames.has(r.key)) {
        if (!missingFrames.has(r.key)) missingFrames.set(r.key, []);
        missingFrames.get(r.key).push(r.at);
    }
}
for (const [frame, ats] of missingFrames) {
    warnings.push(`frame: '${frame}' not found in any atlas (${ats.slice(0, 3).join(', ')}${ats.length > 3 ? `, +${ats.length - 3} more` : ''})`);
}

// ── Report ─────────────────────────────────────────────────────────────────
console.log(`Scanned ${sources.length} scripts, ${registeredAudio.size} audio keys, ${frames.size} atlas frames.\n`);
if (errors.length) {
    console.log(`ERRORS (${errors.length}) — will break at runtime:`);
    errors.forEach(e => console.log('  ✗ ' + e));
    console.log();
}
if (warnings.length) {
    console.log(`WARNINGS (${warnings.length}) — unused or unverifiable:`);
    warnings.forEach(w => console.log('  • ' + w));
    console.log();
}
if (!errors.length && !warnings.length) console.log('All assets consistent.');
process.exit(errors.length ? 1 : 0);
