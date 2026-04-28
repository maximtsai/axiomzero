const fs = require('fs');
const path = require('path');

const projectDir = __dirname;
const distDir = path.join(projectDir, 'dist');

console.log('--- AXIOM ZERO: OPTION B BUNDLER ---');

// 1. Ensure dist folder exists
if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir);
}

// 2. Read index.html
const indexHtmlPath = path.join(projectDir, 'index.html');
if (!fs.existsSync(indexHtmlPath)) {
    console.error('Error: index.html not found in root directory!');
    process.exit(1);
}
let indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');

// 3. Separate <head> and <body> to safely bundle scripts
const parts = indexHtml.split('</head>');
if (parts.length < 2) {
    console.error('Error: Invalid HTML structure (missing </head>).');
    process.exit(1);
}
let headHtml = parts[0];
let bodyHtml = parts[1];

// 4. Extract local script paths from BOTH <head> and <body>
const scriptRegex = /<script\s+src="([^"]+)"><\/script>/g;
let match;
// Scripts to intentionally exclude from bundling — kept as separate <script> tags.
// Minified libraries (phaser, rex) must be excluded to prevent variable name collisions
// that cause "t is not a function" type errors when concatenated with other code.
const SKIP_BUNDLE = [
    'phaser.min.js',
    'rexbbcodetextplugin.min.js',
];

const headScripts = [];
const headScriptTagsToReplace = [];
const bodyScripts = [];
const bodyScriptTagsToReplace = [];

// Scan head
while ((match = scriptRegex.exec(headHtml)) !== null) {
    const src = match[1];
    const fullTag = match[0];
    if (src.startsWith('http://') || src.startsWith('https://')) continue;
    if (SKIP_BUNDLE.includes(src)) continue;
    headScripts.push(src);
    headScriptTagsToReplace.push(fullTag);
}

// Scan body (skip intentionally excluded scripts)
scriptRegex.lastIndex = 0;
while ((match = scriptRegex.exec(bodyHtml)) !== null) {
    const src = match[1];
    const fullTag = match[0];
    if (src.startsWith('http://') || src.startsWith('https://')) continue;
    if (SKIP_BUNDLE.includes(src)) continue;
    bodyScripts.push(src);
    bodyScriptTagsToReplace.push(fullTag);
}

const allScripts = [...headScripts, ...bodyScripts];
const scriptTagsToReplace = [...headScriptTagsToReplace, ...bodyScriptTagsToReplace];

console.log(`Found ${allScripts.length} local scripts to bundle (${headScripts.length} in <head>, ${bodyScripts.length} in <body>).`);

// 5. Concatenate script contents
let bundledJs = '';
allScripts.forEach(scriptPath => {
    const fullPath = path.join(projectDir, scriptPath);
    if (fs.existsSync(fullPath)) {
        console.log(`Bundling: ${scriptPath}`);
        const content = fs.readFileSync(fullPath, 'utf8');
        bundledJs += `\n/* --- BUNDLED FROM: ${scriptPath} --- */\n`;
        bundledJs += content + '\n';
    } else {
        console.warn(`Warning: File not found ${scriptPath}`);
    }
});

// 6. Write bundle.js to dist
fs.writeFileSync(path.join(distDir, 'bundle.js'), bundledJs, 'utf8');
console.log('Successfully created bundle.js in dist/');

// 7. Generate production index.html — replace all bundled script tags.
// Remove all bundled head script tags.
for (const tag of headScriptTagsToReplace) {
    headHtml = headHtml.replace(tag, '');
}

// Insert bundle.js AFTER the last SKIP_BUNDLE script tag so Phaser is defined first.
// If no SKIP_BUNDLE tags exist in head, append bundle before end of head.
let lastSkipTagEnd = -1;
for (const src of SKIP_BUNDLE) {
    const escaped = src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const tagRe = new RegExp(`<script\\s+src="${escaped}"><\/script>`);
    const m = tagRe.exec(headHtml);
    if (m && m.index + m[0].length > lastSkipTagEnd) {
        lastSkipTagEnd = m.index + m[0].length;
    }
}

if (lastSkipTagEnd !== -1) {
    headHtml = headHtml.slice(0, lastSkipTagEnd) +
        '\n  <script src="bundle.js"></script>' +
        headHtml.slice(lastSkipTagEnd);
} else {
    headHtml += '\n  <script src="bundle.js"></script>';
}

// Remove all bundled body script tags from the body
for (const tag of bodyScriptTagsToReplace) {
    bodyHtml = bodyHtml.replace(tag, '');
}

// Re-glue HTML together
let prodHtml = headHtml + '</head>' + bodyHtml;

// Remove leftover multiple blank lines
prodHtml = prodHtml.replace(/^\s*[\r\n]/gm, '');

fs.writeFileSync(path.join(distDir, 'index.html'), prodHtml, 'utf8');
console.log('Successfully created production index.html in dist/');

// 8. Copy static assets
function copyFolderSync(from, to) {
    if (!fs.existsSync(from)) return;
    if (!fs.existsSync(to)) fs.mkdirSync(to, { recursive: true });
    fs.readdirSync(from).forEach(element => {
        const stat = fs.lstatSync(path.join(from, element));
        if (stat.isFile()) {
            fs.copyFileSync(path.join(from, element), path.join(to, element));
        } else if (stat.isDirectory()) {
            copyFolderSync(path.join(from, element), path.join(to, element));
        }
    });
}

// Note: 'js' folder is still copied for reference, but only bundle.js is needed at runtime
const foldersToCopy = ['assets', 'audio'];
foldersToCopy.forEach(folder => {
    console.log(`Copying folder: ${folder}`);
    copyFolderSync(path.join(projectDir, folder), path.join(distDir, folder));
});

// Also copy any intentionally skipped scripts as standalone files
const filesToCopy = ['favicon.png', 'styles.css', 'sw.js', 'attribution.txt', 'icons.txt', 'lore.txt', ...SKIP_BUNDLE];
filesToCopy.forEach(file => {
    const fullPath = path.join(projectDir, file);
    const destPath = path.join(distDir, file);
    const destDir = path.dirname(destPath);
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
    if (fs.existsSync(fullPath)) {
        console.log(`Copying file: ${file}`);
        fs.copyFileSync(fullPath, path.join(distDir, file));
    }
});

console.log('\nBuild complete! Upload the entire "dist" folder contents to your host.');
