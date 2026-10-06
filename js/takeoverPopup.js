/**
 * @fileoverview Financial Breach terminal: split-console popup for the takeover system.
 *
 *   ┌ header: title, status line, INSIGHT / COIN / DATA balances, close ──────┐
 *   │ target list (select)      │ context pane                                │
 *   │                           │   detail  - route preview, stats, INITIATE  │
 *   │                           │   hacking - route trace, countdown, log,    │
 *   │                           │             HOLD TO ABORT                   │
 *   │                           │   success - payout, CLAIM REWARD            │
 *   └───────────────────────────┴─────────────────────────────────────────────┘
 *
 * Visual source of truth: mockups/infiltration-terminal.html. Its pieces are baked into
 * the 'infiltration' atlas (tools/export-terminal-assets.js → raw/infiltration.tps), and
 * every coordinate below is the mock's, taken from raw/infiltration_layout.json. Only
 * text, numbers and animation are live here; nothing is tinted at runtime.
 *
 * Game logic lives in takeoverTargets.js. The popup compares its view with the logic
 * state every frame and re-renders on any mismatch, so it never shows stale state.
 */
const takeoverPopup = (() => {
    const UI = infiltrationUI;
    const { ATLAS, COLOR, FONT, SECURITY } = UI;
    const F = UI.frame;

    // ── Layout (mock coordinates: the terminal's top-left is 250,120) ────────

    const L = GAME_CONSTANTS.halfWidth - 550;
    const T = GAME_CONSTANTS.halfHeight - 330;
    const M = (x) => x - 250 + L;          // mock x → game x
    const MY = (y) => y - 120 + T;         // mock y → game y
    const ROW_TOP = (i) => MY(240 + i * 174);
    const ROW_CX = M(489);
    const PANE_CX = M(1025);
    const PANE = { x: M(724), y: MY(206), w: 602, h: 556 };
    const DEPTH = GAME_CONSTANTS.DEPTH_POPUPS + 2000;
    const D = DEPTH + 2; // content base depth

    // Per-view vertical positions (mock y).
    const ROUTE = {
        detail: { y: 387, label: 413.5 },
        hacking: { y: 335, label: 361.5 },
        success: { y: 334, label: 360.5 },
    };

    // ── State ────────────────────────────────────────────────────────────────

    let isVisible = false;
    let overlay = null;
    let updateFn = null;
    let keyHandler = null;
    let view = 'closed';        // 'closed' | 'detail' | 'hacking' | 'success'
    let selectedIndex = 0;
    let busy = false;           // an animated transition is running; ignore input
    let toast = null;           // { text, color, until }

    const layers = { frame: [], list: [], pane: [], route: [] };
    let currentLayer = 'frame';
    let fref = {};              // live frame objects (status, balances, scan bar)
    let pref = {};              // live pane objects (timer, route, log...)
    let liveRow = null;         // { time, fill } on the active target's row
    const shown = { data: null, coin: null, insight: null };

    const log = { target: null, lines: [], queue: [], typing: null, nextAt: 0, layersDone: 0 };

    // ── Object bookkeeping ───────────────────────────────────────────────────

    function add(obj) {
        layers[currentLayer].push(obj);
        if (obj.setScrollFactor) obj.setScrollFactor(0);
        if (typeof upgradeTree !== 'undefined' && upgradeTree.assignToUICamera) upgradeTree.assignToUICamera(obj);
        return obj;
    }

    function inLayer(name, fn) {
        const prev = currentLayer;
        currentLayer = name;
        try { return fn(); } finally { currentLayer = prev; }
    }

    function clearLayer(name) {
        for (const o of layers[name]) {
            if (o.scene) PhaserScene.tweens.killTweensOf(o);
            if (o.destroy) o.destroy();
        }
        layers[name] = [];
    }

    const txt = (x, y, str, opts) => add(UI.text(PhaserScene, x, y, str, opts));
    const img = (x, y, name, depth) => add(PhaserScene.add.image(x, y, ATLAS, F(name)).setDepth(depth));
    const swatch = (name, depth) => add(PhaserScene.add.image(0, 0, ATLAS, F(name)).setDepth(depth));
    const fmtInt = (n) => Math.floor(n).toLocaleString('en-US');

    /** Fade objects in to their current alpha (optionally sliding from the left). */
    function fadeIn(objs, { delay = 0, slide = 0, duration = 240 } = {}) {
        for (const o of objs) {
            if (o.alpha === undefined || o.type === 'Zone' || PhaserScene.tweens.isTweening(o)) continue;
            const a = o.alpha;
            const x = o.x;
            o.setAlpha(0);
            if (slide) o.x = x - slide;
            PhaserScene.tweens.add({ targets: o, alpha: a, x, duration, delay, ease: 'Cubic.easeOut' });
        }
    }

    // ── Logic helpers ────────────────────────────────────────────────────────

    const tt = () => takeoverTargets;
    const sec = (target) => SECURITY[target.security] || SECURITY.LOW;
    const rewardStr = (type, amount) => tt().formatReward(type, amount);
    const timeStr = (target) => helper.formatTime(Math.ceil(tt().getEffectiveDuration(target)));

    function logicView() {
        if (tt().getPendingReward()) return 'success';
        if (tt().getActiveAttack()) return 'hacking';
        return 'detail';
    }

    function activeIndex() {
        const a = tt().getActiveAttack();
        if (!a) return -1;
        return tt().getTargets().findIndex(x => x && x.name === a.target.name);
    }

    function firstTargetIndex() {
        const i = tt().getTargets().findIndex(Boolean);
        return i < 0 ? 0 : i;
    }

    // ── Show / hide ──────────────────────────────────────────────────────────

    function show() {
        if (isVisible) return;
        isVisible = true;
        busy = false;
        toast = null;
        audio.play('retro1', 1.0);

        overlay = PhaserScene.add.image(GAME_CONSTANTS.halfWidth, GAME_CONSTANTS.halfHeight, 'buttons', 'black_pixel.png')
            .setDisplaySize(GAME_CONSTANTS.WIDTH, GAME_CONSTANTS.HEIGHT)
            .setScrollFactor(0)
            .setDepth(DEPTH)
            .setAlpha(0);
        if (typeof upgradeTree !== 'undefined' && upgradeTree.assignToUICamera) upgradeTree.assignToUICamera(overlay);
        PhaserScene.tweens.add({ targets: overlay, alpha: 0.82, duration: 160 });

        const blocker = helper.createGlobalClickBlocker(false).setDepth(DEPTH + 0.5);
        if (typeof upgradeTree !== 'undefined' && upgradeTree.assignToUICamera) upgradeTree.assignToUICamera(blocker);

        selectedIndex = firstTargetIndex();
        shown.data = shown.coin = shown.insight = null;
        buildFrame();
        render(true);
        inLayer('frame', () => UI.glitchText(PhaserScene, add, fref.title));

        if (!updateFn) {
            updateFn = update;
            updateManager.addFunction(updateFn);
        }
        if (PhaserScene.input.keyboard && !keyHandler) {
            keyHandler = onKey;
            PhaserScene.input.keyboard.on('keydown', keyHandler);
        }
    }

    function hide() {
        if (!isVisible) return;
        isVisible = false;
        view = 'closed';

        if (updateFn) {
            updateManager.removeFunction(updateFn);
            updateFn = null;
        }
        if (keyHandler && PhaserScene.input.keyboard) {
            PhaserScene.input.keyboard.off('keydown', keyHandler);
            keyHandler = null;
        }
        clearLayer('route');
        clearLayer('pane');
        clearLayer('list');
        clearLayer('frame');
        fref = {};
        pref = {};
        liveRow = null;

        if (overlay) {
            PhaserScene.tweens.killTweensOf(overlay);
            overlay.destroy();
            overlay = null;
            helper.hideGlobalClickBlocker();
        }
        if (typeof messageBus !== 'undefined') messageBus.publish('takeoverPopupClosed');
    }

    function onKey(e) {
        if (!isVisible) return;
        if (e.key === 'Escape') hide();
        else if (e.key === '1' || e.key === '2' || e.key === '3') select(Number(e.key) - 1);
        else if (e.key === 'Enter') {
            if (view === 'detail') initiate();
            else if (view === 'success') claim();
        }
    }

    // ── Frame (static chrome) ────────────────────────────────────────────────

    function buildFrame() {
        clearLayer('frame');
        inLayer('frame', () => {
            img(GAME_CONSTANTS.halfWidth, GAME_CONSTANTS.halfHeight, 'panel', DEPTH + 1);
            fref.scan = img(GAME_CONSTANTS.halfWidth, T + 45, 'scanbar', DEPTH + 1.1);

            fref.title = txt(M(312), MY(144.5), t('takeover', 'title'), { font: FONT.BOLD, size: 24, spacing: 3 }).setDepth(D);
            fref.status = txt(M(312), MY(173.5), '', { size: 12, color: COLOR.MUTED, spacing: 1 }).setDepth(D);
            fref.cursor = img(0, MY(174), 'cursor', D);

            // Balances, laid out right-to-left in layoutBalances()
            fref.bal = ['data', 'coin', 'insight'].map(key => ({
                key,
                label: txt(0, MY(139.5), t('takeover', 'balance_' + key), { size: 10, color: COLOR.DIM, origin: [1, 0.5], spacing: 2 }).setDepth(D),
                value: txt(0, MY(165), '', { font: FONT.BOLD, size: 20, origin: [1, 0.5], color: { data: COLOR.CYAN, coin: '#00ff00', insight: COLOR.WHITE }[key] }).setDepth(D),
            }));

            const closeBtn = new Button({
                normal: { ref: 'close_normal.png', atlas: ATLAS, x: M(1306), y: MY(156) },
                hover: { ref: 'close_hover.png', atlas: ATLAS },
                press: { ref: 'close_hover.png', atlas: ATLAS },
                onMouseUp: () => {
                    audio.play('click', 1.0);
                    hide();
                },
            });
            closeBtn.setDepth(D + 1);
            add(closeBtn);

            txt(M(274), MY(220), t('takeover', 'targets'), { size: 11, color: COLOR.DIM, spacing: 3 }).setDepth(D);
        });

        // Power-on flicker
        for (const o of layers.frame) {
            if (o instanceof Button || o.alpha === undefined) continue;
            const a = o.alpha;
            o.setAlpha(0);
            PhaserScene.tweens.add({ targets: o, alpha: a, duration: 200, ease: 'Stepped', easeParams: [4] });
        }
        updateBalances(true);
    }

    /** Count balances toward their real values and keep the three columns right-aligned. */
    function updateBalances(force = false) {
        if (!fref.bal) return;
        let changed = force;
        for (const b of fref.bal) {
            const real = gameState[b.key] || 0;
            if (shown[b.key] === null || force) shown[b.key] = real;
            const diff = real - shown[b.key];
            if (diff !== 0) {
                const step = Math.sign(diff) * Math.max(1, Math.ceil(Math.abs(diff) * 0.16));
                shown[b.key] = Math.abs(step) >= Math.abs(diff) ? real : shown[b.key] + step;
                if (b.value.scale === 1) bump(b.value);
            }
            const str = b.key === 'coin' ? (shown[b.key] * 0.01).toFixed(2) : fmtInt(shown[b.key]);
            if (b.value.text !== str) {
                b.value.setText(str);
                changed = true;
            }
        }
        if (!changed) return;
        let right = M(1264);
        for (const b of fref.bal) {
            b.label.x = right;
            b.value.x = right;
            right -= Math.max(b.label.width, b.value.width) + 34;
        }
    }

    function bump(textObj) {
        PhaserScene.tweens.killTweensOf(textObj);
        textObj.setScale(1.15);
        PhaserScene.tweens.add({ targets: textObj, scale: 1, duration: 240, ease: 'Back.easeOut' });
    }

    function setToast(text, color, ms = 2600) {
        toast = { text, color, until: performance.now() + ms };
    }

    function statusLine() {
        if (toast && performance.now() < toast.until) return [toast.text, toast.color];
        toast = null;
        const speed = tt().getHackingSpeed();
        const boost = speed > 1 ? t('takeover', 'status_speed', [speed.toFixed(1)]) : '';
        if (view === 'hacking') return [t('takeover', 'status_breaching') + boost, COLOR.CYAN];
        if (view === 'success') return [t('takeover', 'status_complete'), COLOR.GREEN];
        if (tt().isTutorial()) return [t('takeover', 'status_tutorial'), COLOR.GREEN];
        return [t('takeover', 'status_idle') + boost, COLOR.MUTED];
    }

    function updateStatus() {
        if (!fref.status) return;
        const [str, color] = statusLine();
        if (fref.status.text !== str) {
            fref.status.setText(str);
            fref.cursor.x = fref.status.x + fref.status.width + 11;
        }
        if (fref.status.style.color !== color) fref.status.setColor(color);
    }

    // ── Render ───────────────────────────────────────────────────────────────

    function render(intro = false) {
        const prev = view;
        view = logicView();
        const targets = tt().getTargets();
        if (view === 'detail' && !targets[selectedIndex]) selectedIndex = firstTargetIndex();
        if (view !== 'detail') selectedIndex = activeIndex();
        renderList(intro);
        renderPane(intro);
        updateStatus();
        if (prev === 'hacking' && view === 'success' && pref.name) {
            inLayer('pane', () => UI.glitchText(PhaserScene, add, pref.name));
        }
    }

    // ── Target list ──────────────────────────────────────────────────────────

    function renderList(intro) {
        clearLayer('list');
        liveRow = null;
        inLayer('list', () => {
            const targets = tt().getTargets();
            const busyIdx = view === 'detail' ? -1 : activeIndex();
            for (let i = 0; i < 3; i++) {
                const objs = targets[i] ? targetRow(i, targets[i], ROW_TOP(i), busyIdx) : offlineRow(ROW_TOP(i));
                if (intro) fadeIn(objs, { delay: 80 + i * 70, slide: 18 });
            }
        });
    }

    function targetRow(i, target, top, busyIdx) {
        const objs = [];
        const push = (o) => { objs.push(o); return o; };
        const s = sec(target);
        const selected = view === 'detail' ? i === selectedIndex : i === busyIdx;
        const locked = busyIdx !== -1 && i !== busyIdx;
        const live = i === busyIdx && view === 'hacking';
        const affordable = resourceManager.canAfford('data', target.cost);
        const rowY = top + 80;

        const bg = push(img(ROW_CX, rowY, `row_${s.key}_${selected ? 'selected' : 'normal'}`, D));
        push(img(M(324), top + 48, `icon_${target.rewardType}_${s.key}`, D + 0.1).setScale(52 / 64));
        push(txt(M(364), top + 36.5, target.name, { font: FONT.BOLD, size: 19, spacing: 0.5 }).setDepth(D + 0.1));
        push(img(M(376), top + 65, `pips_${s.key}`, D + 0.1));
        push(txt(M(398), top + 65.5, t('takeover', 'security_' + target.security), { font: FONT.BOLD, size: 12, color: s.color, spacing: 1 }).setDepth(D + 0.1));

        let tag = null;
        if (i === busyIdx) tag = view === 'success' ? [t('takeover', 'tag_ready'), COLOR.GREEN] : [t('takeover', 'tag_live'), COLOR.CYAN];
        else if (tt().isTutorial() && i === firstTargetIndex()) tag = [t('takeover', 'recommended'), COLOR.GREEN];
        if (tag) {
            const tagText = push(txt(M(684), top + 24, tag[0], { font: FONT.BOLD, size: 11, color: tag[1], origin: [1, 0.5], spacing: 2 }).setDepth(D + 0.1));
            if (i === busyIdx) PhaserScene.tweens.add({ targets: tagText, alpha: 0.3, duration: view === 'success' ? 450 : 600, yoyo: true, repeat: -1 });
        }

        const cols = [
            [M(298), t('takeover', 'cost'), `${target.cost} DATA`, affordable ? COLOR.CYAN : COLOR.RED],
            [M(426), t('takeover', 'payout'), rewardStr(target.rewardType, target.rewardAmount), tt().getRewardColor(target.rewardType)],
            [M(592), t('takeover', live ? 'left' : 'time'), timeStr(target), live ? COLOR.CYAN : COLOR.TEXT],
        ];
        let timeText = null;
        for (const [cx, label, value, color] of cols) {
            push(txt(cx, top + 115, label, { size: 11, color: COLOR.DIM, spacing: 2 }).setDepth(D + 0.1));
            timeText = push(txt(cx, top + 140.5, value, { font: FONT.BOLD, size: 16, color }).setDepth(D + 0.1));
        }

        if (live) {
            push(img(M(491), top + 154, 'rowbar_track', D + 0.1));
            const fill = push(img(M(491), top + 154, 'rowbar_fill', D + 0.15));
            liveRow = { time: timeText, fill };
        }

        if (!locked && view === 'detail') {
            const zone = push(add(PhaserScene.add.zone(ROW_CX, rowY, 430, 160).setInteractive({ useHandCursor: true }).setDepth(D + 0.5)));
            zone.on('pointerover', () => {
                if (i === selectedIndex) return;
                bg.setFrame(F(`row_${s.key}_hover`));
                audio.play('click', 0.25);
            });
            zone.on('pointerout', () => { if (i !== selectedIndex) bg.setFrame(F(`row_${s.key}_normal`)); });
            zone.on('pointerup', () => select(i));
        }
        if (locked) objs.forEach(o => o.setAlpha && o.setAlpha(0.28));
        return objs;
    }

    function offlineRow(top) {
        const bg = img(ROW_CX, top + 80, 'row_offline', D);
        const label = txt(ROW_CX, top + 80, t('takeover', 'offline'), { font: FONT.BOLD, size: 13, color: COLOR.DIM, origin: [0.5, 0.5], spacing: 2 }).setDepth(D + 0.1);
        PhaserScene.tweens.add({ targets: [bg, label], alpha: 0.4, duration: 1000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        return [bg, label];
    }

    function select(i) {
        if (busy || view !== 'detail' || i === selectedIndex || !tt().getTargets()[i]) return;
        selectedIndex = i;
        audio.play('click', 0.8);
        renderList(false);
        renderPane(true);
    }

    // ── Context pane ─────────────────────────────────────────────────────────

    function renderPane(intro) {
        clearLayer('route');
        clearLayer('pane');
        pref = {};
        inLayer('pane', () => {
            if (view === 'hacking') paneHacking();
            else if (view === 'success') paneSuccess();
            else paneDetail();
        });
        if (intro) fadeIn([...layers.pane, ...layers.route], { duration: 200 });
    }

    function paneChrome(accentKey) {
        const ns = add(helper.createNineSlice(PANE_CX, PANE.y + PANE.h / 2, ATLAS, F('pane_' + accentKey), PANE.w + 8, PANE.h + 8, 28, 28, 28, 28));
        ns.setDepth(D);
        return ns;
    }

    function eyebrow(label, color, dotFrame) {
        const dot = img(M(752), MY(229), dotFrame, D + 0.1);
        PhaserScene.tweens.add({ targets: dot, alpha: 0.25, duration: 500, yoyo: true, repeat: -1 });
        txt(M(766), MY(229), label, { font: FONT.BOLD, size: 11, color, spacing: 3 }).setDepth(D + 0.1);
    }

    function paneDetail() {
        const target = tt().getTargets()[selectedIndex];
        if (!target) return;
        const s = sec(target);
        const affordable = resourceManager.canAfford('data', target.cost);
        pref.affordable = affordable;

        paneChrome(s.key);
        pref.name = txt(M(748), MY(250.5), target.name, { font: FONT.BOLD, size: 30, spacing: 0.5 }).setDepth(D + 0.1);
        img(M(760), MY(287.5), `pips_${s.key}`, D + 0.1);
        txt(M(782), MY(287.5), t('takeover', 'security_' + target.security), { font: FONT.BOLD, size: 13, color: s.color, spacing: 1 }).setDepth(D + 0.1);
        txt(M(748), MY(321), target.flavor, { font: FONT.ITALIC, size: 17, color: COLOR.MUTED }).setDepth(D + 0.1);

        drawRoute(target, 'preview', 0, ROUTE.detail);

        const speed = tt().getHackingSpeed();
        const net = target.rewardType === 'data' ? target.rewardAmount - target.cost : null;
        const stats = [
            [t('takeover', 'cost'), `${target.cost} DATA`, affordable ? COLOR.CYAN : COLOR.RED, '', ''],
            [t('takeover', 'payout'), rewardStr(target.rewardType, target.rewardAmount), tt().getRewardColor(target.rewardType),
                net !== null ? t('takeover', 'net', [net]) : '', COLOR.GREEN],
            [t('takeover', 'time'), timeStr(target), COLOR.TEXT, speed > 1 ? t('takeover', 'sped_up', [speed.toFixed(1)]) : '', COLOR.CYAN],
        ];
        stats.forEach(([label, value, valueColor, sub, subColor], k) => {
            const bx = M(748 + k * 190);
            img(bx + 87, MY(493), `stat_${s.key}`, D + 0.05);
            txt(bx + 14, MY(471), label, { size: 11, color: COLOR.DIM, spacing: 2 }).setDepth(D + 0.1);
            txt(bx + 14, MY(502), value, { font: FONT.BOLD, size: 21, color: valueColor }).setDepth(D + 0.1);
            if (sub) txt(bx + 14, MY(531), sub, { size: 11, color: subColor, spacing: 1 }).setDepth(D + 0.1);
        });

        pref.initBtn = UI.button(PhaserScene, add, {
            x: PANE_CX, y: MY(700), w: 440, h: 64, depth: D + 0.2,
            base: 'btn_cyan', deniedFrame: 'btn_denied', chevron: 'chev_cyan', labelColor: COLOR.CYAN,
            label: affordable ? t('takeover', 'initiate') : t('takeover', 'insufficient'),
            sub: affordable ? t('takeover', 'debit', [target.cost]) : t('takeover', 'need', [target.cost]),
            enabled: affordable,
            onClick: initiate, onDenied: deny,
        });
    }

    function paneHacking() {
        const a = tt().getActiveAttack();
        const target = a.target;
        const s = sec(target);
        pref.sec = s;
        pref.layers = tt().getFirewallLayers(target.security);

        paneChrome('cyan');
        eyebrow(t('takeover', 'in_progress'), COLOR.CYAN, 'dot_cyan');
        pref.name = txt(M(748), MY(264.5), target.name, { font: FONT.BOLD, size: 30, spacing: 0.5 }).setDepth(D + 0.1);
        txt(M(1303), MY(269.5), rewardStr(target.rewardType, target.rewardAmount), { font: FONT.BOLD, size: 16, color: tt().getRewardColor(target.rewardType), origin: [1, 0.5] }).setDepth(D + 0.1);

        pref.layerText = txt(M(1302), MY(393), '', { font: FONT.BOLD, size: 11, color: s.color, origin: [1, 0.5], spacing: 2 }).setDepth(D + 0.1);
        pref.timer = txt(M(748), MY(429), '', { font: FONT.BOLD, size: 52, spacing: 1 }).setDepth(D + 0.1);
        pref.pct = txt(M(1302), MY(438), '', { font: FONT.BOLD, size: 26, color: COLOR.CYAN, origin: [1, 0.5] }).setDepth(D + 0.1);
        img(PANE_CX, MY(472), 'bar_track', D + 0.1);
        pref.barFill = img(PANE_CX, MY(472), 'bar_fill', D + 0.15);

        buildLog('log_tall', MY(559), MY(511), 6);
        if (log.target !== target.name) resetLog(target, true);

        pref.abortBtn = UI.button(PhaserScene, add, {
            x: PANE_CX, y: MY(675), w: 360, h: 58, depth: D + 0.2,
            base: 'btn_red', holdFrame: 'btn_red_holdfill', holdMs: 800, labelColor: COLOR.RED,
            label: t('takeover', 'abort'), sub: t('takeover', 'refund', [tt().getRefundAmount()]),
            onClick: abort,
        });
        txt(PANE_CX, MY(724), t('takeover', 'bg_hint'), { size: 11, color: COLOR.DIM, origin: [0.5, 0.5], spacing: 1 }).setDepth(D + 0.1);

        pref.routeDone = -1;
        updateHacking(true);
    }

    function paneSuccess() {
        const a = tt().getActiveAttack();       // stays set until the reward is claimed
        const pr = tt().getPendingReward();
        const rewardColor = tt().getRewardColor(pr.rewardType);

        paneChrome('green');
        eyebrow(t('takeover', 'complete'), COLOR.GREEN, 'dot_green');
        pref.name = txt(M(748), MY(264.5), pr.targetName, { font: FONT.BOLD, size: 30, spacing: 0.5 }).setDepth(D + 0.1);
        drawRoute(a ? a.target : { name: pr.targetName, security: 'LOW' }, 'done', 1, ROUTE.success);

        txt(PANE_CX, MY(392), t('takeover', 'payout'), { size: 11, color: COLOR.DIM, origin: [0.5, 0.5], spacing: 3 }).setDepth(D + 0.1);
        const amount = txt(0, MY(438.5), rewardStr(pr.rewardType, pr.rewardAmount), { font: FONT.BOLD, size: 44, color: rewardColor }).setDepth(D + 0.1);
        const start = PANE_CX - (64 + 18 + amount.width) / 2;
        img(start + 32, MY(438), `icon_${pr.rewardType}_reward`, D + 0.1);
        amount.x = start + 82;
        pref.reward = amount;
        PhaserScene.tweens.add({ targets: amount, scale: { from: 0.6, to: 1 }, alpha: { from: 0, to: 1 }, duration: 500, ease: 'Back.easeOut' });

        buildLog('log_short', MY(540), MY(506), 4);
        if (log.target !== pr.targetName) resetLog({ name: pr.targetName }, false);
        const hasDone = log.lines.some(l => l.done) || log.queue.some(l => l.done) || (log.typing && log.typing.done);
        if (!hasDone) {
            queueLog(t('takeover', 'log_done'), COLOR.GREEN, true);
            queueLog(t('takeover', 'log_await'), COLOR.GREEN, true);
        }

        pref.claimBtn = UI.button(PhaserScene, add, {
            x: PANE_CX, y: MY(700), w: 440, h: 64, depth: D + 0.2,
            base: 'btn_green', glowFrame: 'btn_green_glow', chevron: 'chev_green', labelColor: COLOR.GREEN,
            label: t('takeover', 'claim'), sub: rewardStr(pr.rewardType, pr.rewardAmount),
            onClick: claim,
        });
        pref.claimBtn.pulse();
    }

    // ── Route trace: CORE → proxy hops → firewall gates → VAULT ───────────────

    /** mode: 'preview' | 'hacking' | 'done'. Rebuilds the route layer. */
    function drawRoute(target, mode, progress, pos) {
        clearLayer('route');
        inLayer('route', () => {
            const Y = MY(pos.y);
            const hops = UI.routeHops(target);
            const gates = tt().getFirewallLayers(target.security);
            const s = sec(target);
            const nodes = ['core', ...Array(hops).fill('hop'), ...Array(gates).fill('gate'), 'vault'];
            const step = 514 / (nodes.length - 1);
            const xs = nodes.map((_, i) => M(768) + i * step);
            const done = mode === 'done' ? gates : Math.min(gates, Math.floor(progress * gates));
            const firstGate = 1 + hops;
            const reach = mode === 'preview' ? 0 : mode === 'done' ? nodes.length - 1 : firstGate + done;

            for (let i = 0; i < nodes.length - 1; i++) {
                swatch(i < reach ? 'px_cyan' : 'px_line', D + 0.1).setOrigin(0, 0.5).setPosition(xs[i], Y).setDisplaySize(step, 2);
            }
            pref.route = { Y, x0: xs[0], xReach: xs[reach], gateXs: xs.slice(firstGate, firstGate + gates), activeGate: null, gateFill: null };

            nodes.forEach((n, i) => {
                const x = xs[i];
                if (n === 'core') img(x, Y, 'route_core', D + 0.2);
                else if (n === 'hop') img(x, Y, mode === 'preview' ? 'route_hop_dim' : 'route_hop_lit', D + 0.2);
                else if (n === 'vault') {
                    const v = img(x, Y, mode === 'done' ? 'route_vault_lit' : 'route_vault_dim', D + 0.2);
                    if (mode === 'done') PhaserScene.tweens.add({ targets: v, alpha: 0.35, duration: 500, yoyo: true, repeat: -1 });
                } else {
                    const g = i - firstGate;
                    let state = 'route_gate_locked';
                    if (mode === 'done') state = 'route_gate_broken_green';
                    else if (g < done) state = `route_gate_broken_${s.key}`;
                    else if (mode === 'hacking' && g === done) state = `route_gate_active_${s.key}`;
                    const gate = img(x, Y, state, D + 0.2);
                    if (mode === 'hacking' && g === done) {
                        pref.route.activeGate = gate;
                        pref.route.gateFill = swatch(s.swatch, D + 0.2).setOrigin(0, 0.5).setPosition(x - 11, Y + 19.5).setAlpha(0.45);
                    }
                }
            });
            txt(xs[0], MY(pos.label), t('takeover', 'route_core'), { size: 10, color: COLOR.DIM, origin: [0.5, 0.5], spacing: 1.5 }).setDepth(D + 0.1);
            txt(xs[xs.length - 1], MY(pos.label), t('takeover', 'route_vault'), { size: 10, color: COLOR.DIM, origin: [0.5, 0.5], spacing: 1.5 }).setDepth(D + 0.1);

            // Packets flowing along the lit part of the route
            pref.packets = [];
            if (reach > 0) {
                const count = Math.max(1, Math.floor((xs[reach] - xs[0]) / 14));
                for (let k = 0; k < count; k++) {
                    pref.packets.push(add(PhaserScene.add.image(0, Y, 'buttons', 'white_pixel.png').setDisplaySize(2, 2).setDepth(D + 0.15).setAlpha(0.85)));
                }
            }
        });
    }

    function updateRoute(now) {
        const r = pref.route;
        if (!r) return;
        const span = r.xReach - r.x0;
        pref.packets.forEach((p, k) => { p.x = r.x0 + ((k * 14 + now * 0.0233) % span); });
        if (r.activeGate) r.activeGate.setAlpha(Math.floor(now / 350) % 2 === 0 ? 1 : 0.45);
    }

    function burstGate(x, y) {
        inLayer('route', () => {
            const b = add(PhaserScene.add.image(x, y, 'buttons', 'white_pixel.png').setDisplaySize(30, 36).setDepth(D + 0.3).setAlpha(0.95));
            PhaserScene.tweens.add({ targets: b, alpha: 0, duration: 550, ease: 'Cubic.easeOut', onComplete: () => b.setVisible(false) });
        });
    }

    // ── Hacking per-frame ────────────────────────────────────────────────────

    function updateHacking(force = false) {
        if (!pref.timer) return;
        const p = Math.max(0, tt().getProgress());
        const N = pref.layers;
        const done = Math.min(N, Math.floor(p * N));
        const remaining = tt().getRemainingSeconds();

        const timeText = helper.formatTime(remaining);
        if (pref.timer.text !== timeText) pref.timer.setText(timeText);
        const finalSecs = remaining <= 10 && Math.floor(performance.now() / 250) % 2 === 0;
        pref.timer.setColor(finalSecs ? COLOR.CYAN : COLOR.TEXT);
        const pctStr = Math.floor(p * 100) + '%';
        if (pref.pct.text !== pctStr) pref.pct.setText(pctStr);
        const layerStr = t('takeover', 'layer', [Math.min(done + 1, N), N]);
        if (pref.layerText.text !== layerStr) pref.layerText.setText(layerStr);
        pref.barFill.setCrop(0, 0, 12 + 554 * p, pref.barFill.frame.height);

        if (liveRow) {
            if (liveRow.time.text !== timeText) liveRow.time.setText(timeText);
            liveRow.fill.setCrop(0, 0, 8 + 386 * p, liveRow.fill.frame.height);
        }

        if (done !== pref.routeDone) {
            const a = tt().getActiveAttack();
            drawRoute(a.target, 'hacking', p, ROUTE.hacking);
            if (!force && done > 0 && pref.route.gateXs[done - 1] !== undefined) {
                burstGate(pref.route.gateXs[done - 1], pref.route.Y);
                audio.play('click2', 0.5);
            }
            pref.routeDone = done;
        }
        if (pref.route && pref.route.gateFill) pref.route.gateFill.setDisplaySize(Math.max(0.01, 22 * (p * N - done)), 3);

        if (done > log.layersDone) {
            for (let k = log.layersDone + 1; k <= done; k++) queueLog(t('takeover', 'log_layer', [k]), pref.sec.color);
            log.layersDone = done;
        }
    }

    // ── Intrusion log ────────────────────────────────────────────────────────

    function buildLog(boxFrame, boxY, firstLineY, rows) {
        img(PANE_CX, boxY, boxFrame, D + 0.05);
        pref.logTexts = [];
        for (let k = 0; k < rows; k++) {
            pref.logTexts.push(txt(M(764), firstLineY + k * 21, '', { size: 14, color: COLOR.LOG, spacing: 1 }).setDepth(D + 0.1));
        }
        pref.logSig = [];
        renderLog();
    }

    /** Start a fresh log for `target`. With `prefill`, reconstruct lines for layers already breached. */
    function resetLog(target, prefill) {
        log.target = target ? target.name : null;
        log.lines = [];
        log.queue = [];
        log.typing = null;
        log.layersDone = 0;
        log.nextAt = performance.now() + 900;
        if (!target) return;
        log.lines.push({ text: t('takeover', 'log_start', [target.name]), color: COLOR.CYAN });
        if (prefill && target.security) {
            const N = tt().getFirewallLayers(target.security);
            const done = Math.min(N, Math.floor(Math.max(0, tt().getProgress()) * N));
            for (let k = 1; k <= done; k++) {
                log.lines.push({ text: UI.randomLogLine(), color: COLOR.LOG });
                log.lines.push({ text: t('takeover', 'log_layer', [k]), color: sec(target).color });
            }
            log.layersDone = done;
        }
    }

    function queueLog(text, color = COLOR.LOG, done = false) {
        log.queue.push({ text, color, done });
    }

    function updateLog(dtMs) {
        if (!pref.logTexts) return;
        const now = performance.now();
        if (!log.typing && log.queue.length) {
            log.typing = { ...log.queue.shift(), shown: 0 };
            if (view === 'hacking') audio.play('digital_typewriter_short', 0.15);
        }
        if (log.typing) {
            log.typing.shown += dtMs * 0.07; // ~70 chars/s
            if (log.typing.shown >= log.typing.text.length) {
                log.lines.push({ text: log.typing.text, color: log.typing.color, done: log.typing.done });
                if (log.lines.length > 40) log.lines.shift();
                log.typing = null;
            }
        } else if (view === 'hacking' && now >= log.nextAt) {
            queueLog(UI.randomLogLine());
            log.nextAt = now + 1300 + Math.random() * 1500;
        }
        renderLog();
    }

    function renderLog() {
        const rows = pref.logTexts.length;
        const cursor = Math.floor(performance.now() / 450) % 2 === 0 ? '_' : ' ';
        const visible = log.lines.slice(-(log.typing ? rows - 1 : rows));
        if (log.typing) {
            visible.push({ text: log.typing.text.slice(0, Math.floor(log.typing.shown)) + cursor, color: log.typing.color });
        } else if (visible.length) {
            const last = visible[visible.length - 1];
            visible[visible.length - 1] = { ...last, text: last.text + cursor };
        }
        for (let k = 0; k < rows; k++) {
            const line = visible[k] || { text: '', color: COLOR.LOG };
            const sig = line.text + '|' + line.color;
            if (pref.logSig[k] === sig) continue;
            pref.logSig[k] = sig;
            const o = pref.logTexts[k];
            o.setText(line.text);
            o.setColor(line.color);
            o.setAlpha(0.4 + 0.6 * ((k + 1) / Math.max(1, visible.length)));
        }
    }

    // ── Actions ──────────────────────────────────────────────────────────────

    function initiate() {
        if (busy || view !== 'detail') return;
        const i = selectedIndex;
        const target = tt().getTargets()[i];
        if (!target) return;
        if (!resourceManager.canAfford('data', target.cost)) {
            deny();
            return;
        }
        busy = true;
        audio.play('upgrade', 0.9);
        if (pref.initBtn) pref.initBtn.setLabel(t('takeover', 'initiating'), t('takeover', 'debit', [target.cost]));
        flashPane('px_cyan');
        PhaserScene.time.delayedCall(420, () => {
            busy = false;
            if (!isVisible) return;
            if (tt().startAttack(i)) {
                resetLog(target, false);
                render(true);
            } else {
                deny();
                renderPane(false);
            }
        });
    }

    function deny() {
        audio.play('glitch_medium', 0.35);
        setToast(t('takeover', 'status_denied'), COLOR.RED, 2000);
        if (pref.initBtn) pref.initBtn.shake();
        updateStatus();
    }

    function abort() {
        if (busy || view !== 'hacking') return;
        const refund = tt().getRefundAmount();
        if (!tt().cancelAttack()) return;
        audio.play('click', 1.0);
        setToast(t('takeover', 'status_aborted', [refund]), COLOR.CYAN);
        resetLog(null);
        selectedIndex = firstTargetIndex();
        render(true);
    }

    function claim() {
        if (busy || view !== 'success') return;
        const pr = tt().getPendingReward();
        if (!pr) return;
        busy = true;
        audio.play(pr.rewardType === 'coin' ? 'coin_gain' : 'upgrade_max', 0.7);
        if (pref.reward) {
            PhaserScene.tweens.killTweensOf(pref.reward);
            PhaserScene.tweens.add({ targets: pref.reward, scale: 1.3, alpha: 0, y: pref.reward.y - 40, duration: 380, ease: 'Cubic.easeIn' });
        }
        flashPane('px_green');
        PhaserScene.time.delayedCall(380, () => {
            busy = false;
            const reward = tt().collectReward();
            if (!isVisible) return;
            if (reward) {
                setToast(t('takeover', 'status_claimed', [rewardStr(reward.rewardType, reward.rewardAmount)]),
                    tt().getRewardColor(reward.rewardType));
            }
            resetLog(null);
            selectedIndex = firstTargetIndex();
            render(true);
        });
    }

    function flashPane(swatchFrame) {
        inLayer('pane', () => {
            const f = img(PANE_CX, PANE.y + PANE.h / 2, swatchFrame, D + 0.6).setDisplaySize(PANE.w, PANE.h).setAlpha(0.22);
            helper.setBlendMode(f, Phaser.BlendModes.ADD);
            PhaserScene.tweens.add({ targets: f, alpha: 0, duration: 320, ease: 'Cubic.easeOut', onComplete: () => f.setVisible(false) });
        });
    }

    // ── Per-frame update ─────────────────────────────────────────────────────

    let lastFrame = 0;

    function update() {
        if (!isVisible) return;
        const now = performance.now();
        const dt = lastFrame ? Math.min(100, now - lastFrame) : 16;
        lastFrame = now;

        if (fref.scan) fref.scan.y = T + 45 + ((now / 5000) % 1) * 570;
        if (fref.cursor) fref.cursor.setVisible(Math.floor(now / 530) % 2 === 0);
        updateBalances();
        updateStatus();
        updateRoute(now);
        if (pref.abortBtn) pref.abortBtn.tick();

        if (busy) return;

        // Logic advanced (breach completed) or changed elsewhere → rebuild.
        if (view === 'hacking') tt().checkCompletion();
        const v = logicView();
        if (v !== view) {
            if (v === 'success') audio.play('chime_pc', 0.6);
            render(v === 'detail');
            return;
        }
        if (view === 'detail' && pref.initBtn) {
            const target = tt().getTargets()[selectedIndex];
            if (target && resourceManager.canAfford('data', target.cost) !== pref.affordable) {
                renderList(false);
                renderPane(false);
            }
        }
        if (view === 'hacking') updateHacking();
        updateLog(dt);
    }

    // ── Public ───────────────────────────────────────────────────────────────

    return {
        show,
        hide,
        isOpen: () => isVisible,
        /** 'closed' | 'detail' | 'hacking' | 'success' */
        getView: () => view,
        getSelectedIndex: () => selectedIndex,
    };
})();
