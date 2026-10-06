// Bake the Financial Breach terminal mock into flat PNGs for the Phaser atlas.
//
// Renders mockups/infiltration-terminal.html in headless Chrome/Edge, isolates each
// visual piece (text hidden — text stays live in Phaser) and saves it at 1x with a
// transparent background. Every colour variant is baked separately (no runtime tint,
// so the game stays canvas-renderer compatible).
//
// Outputs (dev-only, never part of the release build):
//   raw/infiltration/*.png            → pack with raw/infiltration.tps (TexturePacker)
//   raw/infiltration_layout.json      → text positions/styles + piece boxes, per view
//   mockups/reference/terminal_*.png  → full-view screenshots for side-by-side checks
//
// Usage: start the dev server (port 8124), then
//   node tools/export-terminal-assets.js [--url http://localhost:8124/mockups/infiltration-terminal.html]
// Set CHROME_PATH if Chrome/Edge isn't in a standard location.

/* global document, window, NodeFilter, getComputedStyle -- used inside page.evaluate() callbacks, which run in the browser */

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'raw', 'infiltration');
const LAYOUT_OUT = path.join(ROOT, 'raw', 'infiltration_layout.json');
const REF_OUT = path.join(ROOT, 'mockups', 'reference');
const urlArg = process.argv.indexOf('--url');
const URL = urlArg > 0 ? process.argv[urlArg + 1] : 'http://localhost:8124/mockups/infiltration-terminal.html';

const BROWSERS = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
].filter(Boolean);

// Hides the mock's backdrop/controls, freezes animation, and provides isolation modes:
//   .iso   → only the element tagged .cap (and its children) is visible
//   .notext→ text inside the captured element is transparent (layout is preserved)
const EXPORT_CSS = `
html.export, html.export body, html.export #stage { background: transparent !important; }
html.export .backdrop, html.export .dim, html.export .mock, html.export #breachBtn, html.export .flyer { display: none !important; }
html.export *, html.export *::before, html.export *::after { animation: none !important; transition: none !important; }
html.export .terminal { opacity: 1 !important; }
html.export #fx { position: absolute; left: 0; top: 0; width: 1600px; height: 900px; }
html.export #fx > * { position: absolute; left: 200px; top: 200px; margin: 0; }
html.export #fx svg { overflow: visible; }
html.iso * { visibility: hidden !important; }
html.iso .cap, html.iso .cap * { visibility: visible !important; }
html.iso .cap .hide, html.iso .cap .hide * { visibility: hidden !important; }
html.notext .cap, html.notext .cap * { color: transparent !important; -webkit-text-fill-color: transparent !important; }
html.notext .cap text { fill: transparent !important; }
`;

const manifest = [];

async function main() {
    const executablePath = BROWSERS.find(p => fs.existsSync(p));
    if (!executablePath) throw new Error('No Chrome/Edge found — set CHROME_PATH');
    try {
        const res = await fetch(URL);
        if (!res.ok) throw new Error(res.status);
    } catch (e) {
        throw new Error(`Can't reach ${URL} — start the dev server first (${e.message})`);
    }

    fs.mkdirSync(OUT, { recursive: true });
    fs.mkdirSync(REF_OUT, { recursive: true });
    for (const f of fs.readdirSync(OUT)) if (f.endsWith('.png')) fs.unlinkSync(path.join(OUT, f));

    const browser = await puppeteer.launch({
        executablePath,
        headless: true,
        defaultViewport: { width: 1600, height: 900, deviceScaleFactor: 1 },
    });
    try {
        const page = await browser.newPage();
        await page.goto(URL, { waitUntil: 'networkidle0' });
        await page.evaluate(() => document.fonts.ready);
        await page.mouse.move(1, 1);

        await referenceShots(page);
        await page.addStyleTag({ content: EXPORT_CSS });
        await page.evaluate(() => {
            document.documentElement.classList.add('export');
            const fx = document.createElement('div');
            fx.id = 'fx';
            document.getElementById('stage').appendChild(fx);
        });

        const layout = await dumpLayout(page);
        fs.writeFileSync(LAYOUT_OUT, JSON.stringify(layout, null, 2));

        await exportChrome(page);
        await exportRows(page);
        await exportIcons(page);
        await exportRoute(page);
        await exportButtons(page);
        await exportBoxes(page);
        await exportSmall(page);
    } finally {
        // Chrome on Windows can hang on close(); give it 5s, then kill the process.
        await Promise.race([browser.close(), new Promise(r => setTimeout(r, 5000))]);
        const proc = browser.process();
        if (proc && proc.exitCode === null) proc.kill();
    }

    console.log(`\nExported ${manifest.length} pieces to ${path.relative(ROOT, OUT)}/`);
    for (const m of manifest) console.log(`  ${m.name.padEnd(28)} ${String(m.w).padStart(4)}x${m.h}`);
    console.log(`Layout: ${path.relative(ROOT, LAYOUT_OUT)}\nReference shots: ${path.relative(ROOT, REF_OUT)}/`);
}

// ── Capture helpers ────────────────────────────────────────────────────────

/**
 * Screenshot one element (selector + index) in isolation.
 * opts: pad (px around the element box), hide (descendant selectors), notext, hover, press,
 *       box (fixed {w,h} clip centred on the element — keeps a family of sprites the same size)
 */
async function cap(page, name, selector, opts = {}) {
    const { pad = 8, hide = [], notext = true, hover = false, press = false, index = 0, box = null } = opts;
    await page.evaluate((sel, idx, hide, notext) => {
        document.querySelectorAll('.cap').forEach(e => e.classList.remove('cap'));
        document.querySelectorAll('.hide').forEach(e => e.classList.remove('hide'));
        const el = document.querySelectorAll(sel)[idx];
        if (!el) throw new Error('no element for ' + sel + '[' + idx + ']');
        el.classList.add('cap');
        hide.forEach(h => el.querySelectorAll(h).forEach(x => x.classList.add('hide')));
        document.documentElement.classList.add('iso');
        document.documentElement.classList.toggle('notext', notext);
    }, selector, index, hide, notext);

    if (hover || press) {
        const handles = await page.$$(selector);
        await handles[index].hover();
        if (press) await page.mouse.down();
    }
    const r = await page.evaluate((sel, idx) => {
        const b = document.querySelectorAll(sel)[idx].getBoundingClientRect();
        return { x: b.x, y: b.y, w: b.width, h: b.height };
    }, selector, index);

    const clip = box
        ? { x: Math.round(r.x + r.w / 2 - box.w / 2), y: Math.round(r.y + r.h / 2 - box.h / 2), width: box.w, height: box.h }
        : { x: Math.floor(r.x - pad), y: Math.floor(r.y - pad), width: Math.ceil(r.w + pad * 2), height: Math.ceil(r.h + pad * 2) };
    await page.screenshot({ path: path.join(OUT, name + '.png'), omitBackground: true, clip });

    if (press) await page.mouse.up();
    if (hover || press) await page.mouse.move(1, 1);
    await page.evaluate(() => document.documentElement.classList.remove('iso', 'notext'));
    manifest.push({ name, w: clip.width, h: clip.height });
}

/** Put a fixture element into #fx and return its selector. */
async function fixture(page, html) {
    await page.evaluate((html) => { document.getElementById('fx').innerHTML = html; }, html);
    return '#fx > *';
}

async function setState(page, fn, arg) {
    await page.evaluate(fn, arg);
    await new Promise(r => setTimeout(r, 60));
}

const T = (name, security, rewardType = 'coin', extra = {}) => ({
    name, security, flavor: 'Draining corporate bank accounts', cost: 135, duration: 90, rewardType,
    rewardAmount: rewardType === 'insight' ? 1 : rewardType === 'data' ? 195 : 25, ...extra,
});

// ── Pieces ─────────────────────────────────────────────────────────────────

async function exportChrome(page) {
    await setState(page, (targets) => {
        const S = window.mockState;
        Object.assign(S, { attack: null, pending: null, tutorial: false, data: 50000, targets, selected: 0 });
        window.mockApi.render();
    }, [T('A', 'LOW'), T('B', 'MEDIUM'), T('C', 'HIGH')]);

    // Main panel: frame, glow, brackets, header band + separators, title glyph, list-head rule.
    await cap(page, 'panel', '.terminal', { pad: 24, hide: ['.targets', '.pane', '.balances', '.close', '.status .cursor', '.scanbar'] });
    await cap(page, 'close_normal', '.close', { pad: 2, notext: false });
    await cap(page, 'close_hover', '.close', { pad: 2, notext: false, hover: true });
}

async function exportRows(page) {
    for (const sec of ['LOW', 'MEDIUM', 'HIGH']) {
        await setState(page, (targets) => {
            const S = window.mockState;
            Object.assign(S, { attack: null, pending: null, tutorial: false, data: 50000, targets, selected: 0 });
            window.mockApi.render();
        }, [T('A', sec), T('B', sec), T('C', sec)]);
        const hide = ['.hex', '.pips', '.tag', '.key', '.row-progress'];
        const s = sec.toLowerCase();
        await cap(page, `row_${s}_selected`, '.row', { index: 0, pad: 26, hide });
        await cap(page, `row_${s}_normal`, '.row', { index: 1, pad: 26, hide });
        await cap(page, `row_${s}_hover`, '.row', { index: 2, pad: 26, hide, hover: true });
    }
    await setState(page, (targets) => {
        const S = window.mockState;
        Object.assign(S, { attack: null, pending: null, tutorial: true, targets, selected: 0 });
        window.mockApi.render();
    }, [T('A', 'LOW'), T('B', 'LOW'), null]);
    await cap(page, 'row_offline', '.offline', { pad: 2 });
}

async function exportIcons(page) {
    const colors = { low: 'var(--low)', medium: 'var(--medium)', high: 'var(--high)' };
    for (const type of ['coin', 'data', 'insight']) {
        for (const [key, color] of [...Object.entries(colors), ['reward', `var(--${type})`]]) {
            const sel = await fixture(page, await page.evaluate((t, c) => window.mockApi.hexIcon(t, c, 64), type, color));
            await cap(page, `icon_${type}_${key}`, sel, { box: { w: 72, h: 72 }, notext: false });
        }
    }
    for (const sec of ['LOW', 'MEDIUM', 'HIGH']) {
        const html = await page.evaluate((s) => `<div style="--sec:var(--${s.toLowerCase()})">${window.mockApi.pipsHtml(s)}</div>`, sec);
        await fixture(page, html);
        await cap(page, `pips_${sec.toLowerCase()}`, '#fx .pips', { pad: 3, notext: false });
    }
}

async function exportRoute(page) {
    const piece = (inner, sec = 'low') =>
        `<div class="route" style="--sec:var(--${sec});height:auto"><svg viewBox="-20 -20 40 40" width="40" height="40">${inner}</svg></div>`;
    const gate = (cls) => `<g class="gate ${cls}"><rect x="-11" y="-14" width="22" height="28"/><path d="M-4 -2v-4a4 4 0 0 1 8 0v4M-6 -2h12v9h-12z"/></g>`;
    const shots = [
        ['route_core', piece('<polygon class="core-node" points="0,-9 8,-4.5 8,4.5 0,9 -8,4.5 -8,-4.5"/>')],
        ['route_hop_dim', piece('<rect class="hop" x="-5" y="-5" width="10" height="10" transform="rotate(45)"/>')],
        ['route_hop_lit', piece('<rect class="hop lit" x="-5" y="-5" width="10" height="10" transform="rotate(45)"/>')],
        ['route_gate_locked', piece(gate(''))],
        ['route_vault_dim', piece('<rect class="vault" x="-12" y="-12" width="24" height="24"/><circle r="5" fill="none" stroke="var(--off)" stroke-width="1.5"/>')],
        ['route_vault_lit', piece('<rect class="vault lit" x="-12" y="-12" width="24" height="24"/><circle r="5" fill="none" stroke="var(--green)" stroke-width="1.5"/>')],
    ];
    for (const sec of ['low', 'medium', 'high']) {
        shots.push([`route_gate_active_${sec}`, piece(gate('active'), sec)]);
        shots.push([`route_gate_broken_${sec}`, piece(gate('broken'), sec)]);
    }
    shots.push(['route_gate_broken_green', piece(gate('broken'), 'green')]);
    for (const [name, html] of shots) {
        await fixture(page, html);
        await cap(page, name, '#fx svg', { pad: 0, notext: false });
    }
}

async function exportButtons(page) {
    const btn = (cls, extra = '', inner = '<span class="bg"></span>') => `<button class="cta ${cls}" style="${extra}">${inner}</button>`;
    const variants = [['cyan', ''], ['red', 'red'], ['green', 'green']];
    for (const [name, cls] of variants) {
        const sel = await fixture(page, btn(cls));
        await cap(page, `btn_${name}_normal`, sel, { pad: 18, notext: false });
        await cap(page, `btn_${name}_hover`, sel, { pad: 18, notext: false, hover: true });
        await cap(page, `btn_${name}_press`, sel, { pad: 18, notext: false, press: true });
    }
    await cap(page, 'btn_denied', await fixture(page, btn('denied')), { pad: 18, notext: false });
    await cap(page, 'btn_red_holdfill', await fixture(page, btn('red', '--hold:1', '<span class="hold-fill"></span>')), { pad: 18, notext: false });
    await cap(page, 'btn_green_glow', await fixture(page, btn('green', 'filter: drop-shadow(0 0 14px rgba(68,255,68,.55))')), { pad: 18, notext: false });
    for (const [name, cls] of [['cyan', ''], ['green', 'green']]) {
        await fixture(page, btn(cls, '', '<span class="chev"><i></i><i></i></span>'));
        await cap(page, `chev_${name}`, '#fx .chev', { pad: 2, notext: false });
    }
}

async function exportBoxes(page) {
    // 9-slice pane borders (margins 28 in Phaser): one per accent colour.
    for (const c of ['cyan', 'green', 'low', 'medium', 'high']) {
        const sel = await fixture(page, `<div class="pane" style="width:128px;height:128px;--accent:var(--${c})"><div class="border"></div><div class="brackets"></div></div>`);
        await cap(page, `pane_${c}`, sel, { pad: 4, notext: false });
    }
    for (const s of ['low', 'medium', 'high']) {
        await cap(page, `stat_${s}`, await fixture(page, `<div class="stat" style="width:174px;--sec:var(--${s})"></div>`), { pad: 0, notext: false });
    }
    await cap(page, 'log_tall', await fixture(page, '<div class="log" style="width:554px;height:136px"></div>'), { pad: 0, notext: false });
    await cap(page, 'log_short', await fixture(page, '<div class="log" style="width:554px;height:108px"></div>'), { pad: 0, notext: false });
    // Progress bars: track and fill share a frame size so the fill can be setCrop()'d over the track.
    await cap(page, 'bar_track', await fixture(page, '<div class="bar" style="width:554px"><div class="fill" style="width:0"></div><div class="ticks"></div></div>'), { pad: 12, notext: false });
    await cap(page, 'bar_fill', await fixture(page, '<div class="bar" style="width:554px;background:none"><div class="fill" style="width:100%"></div><div class="ticks"></div></div>'), { pad: 12, notext: false });
    const rowBar = (w) => `<div class="row-progress" style="position:absolute;left:200px;right:auto;bottom:auto;width:386px"><i style="width:${w}"></i></div>`;
    await cap(page, 'rowbar_track', await fixture(page, rowBar('0')), { pad: 8, notext: false });
    await cap(page, 'rowbar_fill', await fixture(page, rowBar('100%').replace('class="row-progress" style="', 'class="row-progress" style="background:none;')), { pad: 8, notext: false });
    await cap(page, 'scanbar', await fixture(page, '<div class="scanbar" style="position:absolute;left:200px;right:auto;width:1092px"></div>'), { pad: 0, notext: false });
}

async function exportSmall(page) {
    for (const c of ['cyan', 'green']) {
        await fixture(page, `<div class="eyebrow ${c}"><span class="dot"></span></div>`);
        await cap(page, `dot_${c}`, '#fx .dot', { pad: 10, notext: false });
    }
    await fixture(page, '<p class="status"><i class="cursor"></i></p>');
    await cap(page, 'cursor', '#fx .cursor', { pad: 0, notext: false });
    // Solid 4x4 swatches, scaled in Phaser for lines, bars, flashes and the gate fill.
    const swatches = { cyan: '#00f5ff', green: '#44ff44', red: '#ff5555', medium: '#ffcc00', high: '#ff4444', line: '#1e2c3c' };
    for (const [name, hex] of Object.entries(swatches)) {
        await cap(page, `px_${name}`, await fixture(page, `<div style="width:4px;height:4px;background:${hex}"></div>`), { pad: 0, notext: false });
    }
    await fixture(page, '');
}

// ── Layout + reference shots ───────────────────────────────────────────────

const VIEWS = {
    detail: (T) => {
        const S = window.mockState;
        Object.assign(S, { attack: null, pending: null, tutorial: false, data: 50000, targets: T, selected: 1 });
        window.mockApi.render();
    },
    hacking: (T) => {
        const S = window.mockState;
        Object.assign(S, { pending: null, tutorial: false, data: 50000, targets: T, selected: 1 });
        S.attack = { index: 1, target: { ...T[1] }, start: S.clock - 45000, duration: 90000 };
        window.mockApi.render();
    },
    success: (T) => {
        const S = window.mockState;
        Object.assign(S, { tutorial: false, data: 50000, targets: T, selected: 1 });
        S.attack = { index: 1, target: { ...T[1] }, start: S.clock - 90000, duration: 90000 };
        S.pending = { rewardType: T[1].rewardType, rewardAmount: T[1].rewardAmount, name: T[1].name };
        window.mockApi.render();
    },
};
const VIEW_TARGETS = [
    T('ORBITAL BANK', 'LOW', 'coin', { cost: 50, duration: 50, rewardAmount: 12 }),
    T('SILICON TRUST', 'MEDIUM', 'data'),
    T('SYNAPSE CAPITAL', 'HIGH', 'insight', { cost: 250, duration: 240 }),
];

async function referenceShots(page) {
    for (const [view, fn] of Object.entries(VIEWS)) {
        await setState(page, fn, VIEW_TARGETS);
        await new Promise(r => setTimeout(r, 900)); // let entry animations and the log settle
        await page.screenshot({ path: path.join(REF_OUT, `terminal_${view}.png`), clip: { x: 226, y: 96, width: 1148, height: 708 } });
    }
}

/** Text runs (exact glyph boxes + font style) and key element boxes for each view, in game coords. */
async function dumpLayout(page) {
    const out = { note: 'Game coordinates (1600x900). Text boxes are glyph-run bounds; x/y = top-left.', views: {} };
    for (const [view, fn] of Object.entries(VIEWS)) {
        await setState(page, fn, VIEW_TARGETS);
        out.views[view] = await page.evaluate(() => {
            const term = document.querySelector('.terminal');
            const r4 = (b) => ({ x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) });
            const pathOf = (el) => {
                const parts = [];
                for (let e = el; e && e !== term; e = e.parentElement) {
                    let p = e.tagName.toLowerCase();
                    if (e.id) p += '#' + e.id;
                    else if (e.classList.length) p += '.' + [...e.classList].join('.');
                    parts.unshift(p);
                }
                return parts.join(' > ');
            };
            const texts = [];
            const walker = document.createTreeWalker(term, NodeFilter.SHOW_TEXT);
            for (let n = walker.nextNode(); n; n = walker.nextNode()) {
                const str = n.nodeValue.replace(/\s+/g, ' ').trim();
                if (!str) continue;
                const el = n.parentElement;
                const cs = getComputedStyle(el);
                if (cs.visibility === 'hidden' || cs.display === 'none') continue;
                const range = document.createRange();
                range.selectNodeContents(n);
                const b = range.getBoundingClientRect();
                if (!b.width) continue;
                texts.push({
                    text: str, path: pathOf(el), ...r4(b),
                    font: `${cs.fontStyle === 'italic' ? 'italic ' : ''}${cs.fontWeight} ${cs.fontSize}`,
                    color: el.tagName === 'text' ? cs.fill : cs.color,
                    letterSpacing: cs.letterSpacing, align: cs.textAnchor !== 'start' && el.tagName === 'text' ? cs.textAnchor : cs.textAlign,
                });
            }
            const boxes = {};
            const keys = ['.terminal', '.t-head', '.close', '.balances', '.targets', '.row', '.offline', '.row .hex', '.row .pips', '.pane',
                '.pane .route svg', '.stat', '.cta', '.bar', '.log', '.payout .amount svg', '.eyebrow .dot', '.row-progress'];
            for (const k of keys) {
                const els = [...document.querySelectorAll(k)].filter(e => e.getBoundingClientRect().width);
                if (els.length) boxes[k] = els.map(e => r4(e.getBoundingClientRect()));
            }
            return { texts, boxes };
        });
    }
    return out;
}

main().then(() => process.exit(0), (e) => {
    console.error('Export failed:', e.message);
    process.exit(1);
});
