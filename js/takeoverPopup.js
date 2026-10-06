/**
 * @fileoverview Financial Breach terminal: split-console popup for the takeover system.
 *
 *   ┌ header: title, live status line, DATA / COIN balances, close ───────────┐
 *   │ target list (select)      │ context pane                                │
 *   │                           │   detail  - dossier, stats, INITIATE BREACH │
 *   │                           │   hacking - firewall layers, countdown,     │
 *   │                           │             live intrusion log, ABORT       │
 *   │                           │   success - payout, CLAIM REWARD            │
 *   └───────────────────────────┴─────────────────────────────────────────────┘
 *
 * Game logic lives in takeoverTargets.js and drawing primitives in infiltrationUI.js.
 * The popup compares its view against the logic state every frame and re-renders on
 * any mismatch, so breaches finishing (or being changed from elsewhere) never leave
 * stale UI behind.
 */
const takeoverPopup = (() => {
    const UI = infiltrationUI;
    const { THEME, FONT } = UI;

    // ── Layout ───────────────────────────────────────────────────────────────

    const W = 1100;
    const H = 660;
    const L = GAME_CONSTANTS.halfWidth - W / 2;
    const T = GAME_CONSTANTS.halfHeight - H / 2;
    const LIST = { x: L + 24, y: T + 86, w: 430 };
    const PANE = { x: L + 474, y: T + 86, w: 602, h: 556 };
    const ROW_H = 160;
    const ROW_GAP = 14;
    const ROWS_Y = LIST.y + 34;
    const LOG_ROWS = 7;
    const DEPTH = GAME_CONSTANTS.DEPTH_POPUPS + 2000;
    const D = DEPTH + 2; // content base depth

    // ── State ────────────────────────────────────────────────────────────────

    let isVisible = false;
    let overlay = null;
    let updateFn = null;
    let view = 'closed';        // 'closed' | 'detail' | 'hacking' | 'success'
    let selectedIndex = 0;
    let busy = false;           // an animated transition is running; ignore input
    let toast = null;           // { text, color, until } — temporary status line message

    const layers = { frame: [], list: [], pane: [] };
    let currentLayer = 'frame';
    let fref = {};              // live frame objects (status, balances, scan bar)
    let pref = {};              // live pane objects (timer, firewall, log...)

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
        try { fn(); } finally { currentLayer = prev; }
    }

    function clearLayer(name) {
        for (const o of layers[name]) {
            if (o.scene) PhaserScene.tweens.killTweensOf(o);
            if (o.destroy) o.destroy();
        }
        layers[name] = [];
    }

    const txt = (x, y, str, opts) => add(UI.text(PhaserScene, x, y, str, opts));
    const gfx = (depth) => add(PhaserScene.add.graphics().setDepth(depth));
    const hexStr = (n) => '#' + n.toString(16).padStart(6, '0');
    const fmtInt = (n) => Math.floor(n).toLocaleString('en-US');

    /** Fade objects in from 0 to their current alpha (optionally sliding from the left). */
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

    function logicView() {
        if (tt().getPendingReward()) return 'success';
        if (tt().getActiveAttack()) return 'hacking';
        return 'detail';
    }

    function activeIndex() {
        const a = tt().getActiveAttack();
        if (!a) return -1;
        return tt().getTargets().findIndex(t => t && t.name === a.target.name);
    }

    function firstTargetIndex() {
        const i = tt().getTargets().findIndex(Boolean);
        return i < 0 ? 0 : i;
    }

    const securityColor = (sec) => UI.toHex(tt().getSecurityColor(sec));
    const pipCount = (sec) => ({ LOW: 1, MEDIUM: 2, HIGH: 3 }[sec] || 1);
    const rewardStr = (type, amount) => tt().formatReward(type, amount);

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
        PhaserScene.tweens.add({ targets: overlay, alpha: 0.8, duration: 160 });

        const blocker = helper.createGlobalClickBlocker(false).setDepth(DEPTH + 0.5);
        if (typeof upgradeTree !== 'undefined' && upgradeTree.assignToUICamera) upgradeTree.assignToUICamera(blocker);

        selectedIndex = firstTargetIndex();
        buildFrame();
        render(true);

        if (!updateFn) {
            updateFn = update;
            updateManager.addFunction(updateFn);
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
        clearLayer('pane');
        clearLayer('list');
        clearLayer('frame');
        fref = {};
        pref = {};

        if (overlay) {
            PhaserScene.tweens.killTweensOf(overlay);
            overlay.destroy();
            overlay = null;
            helper.hideGlobalClickBlocker();
        }
        if (typeof messageBus !== 'undefined') messageBus.publish('takeoverPopupClosed');
    }

    // ── Frame (static chrome) ────────────────────────────────────────────────

    function buildFrame() {
        clearLayer('frame');
        inLayer('frame', () => {
            const g = gfx(DEPTH + 1);
            UI.fillChamfer(g, L, T, W, H, 22, THEME.BG, 0.97);
            UI.scanlines(g, L + 2, T + 2, W - 4, H - 4, 0.025);
            g.fillStyle(THEME.CYAN, 0.035);
            g.fillRect(L + 1, T + 1, W - 24, 71);
            g.lineStyle(1, THEME.CYAN, 0.18);
            g.lineBetween(L + 24, T + 72, L + W - 24, T + 72);
            g.lineStyle(2, THEME.CYAN, 0.9);
            g.lineBetween(L + 24, T + 72, L + 200, T + 72);
            g.lineStyle(1, THEME.CYAN, 0.1);
            g.lineBetween(PANE.x - 10, PANE.y + 8, PANE.x - 10, PANE.y + PANE.h - 8);

            // Title glyph: three slanted bars
            for (let i = 0; i < 3; i++) {
                g.fillStyle(THEME.CYAN, 1 - i * 0.3);
                const bx = L + 26 + i * 8;
                g.fillPoints([{ x: bx + 4, y: T + 20 }, { x: bx + 9, y: T + 20 }, { x: bx + 5, y: T + 40 }, { x: bx, y: T + 40 }], true);
            }

            const fg = gfx(DEPTH + 1.2);
            UI.glowChamfer(fg, L, T, W, H, 22, THEME.CYAN, 0.5, 1);
            UI.brackets(fg, L - 7, T - 7, W + 14, H + 14, 30, THEME.CYAN, 0.9, 2);

            txt(L + 60, T + 30, t('takeover', 'title'), { font: FONT.BOLD, size: 24, spacing: 3 }).setDepth(D);
            fref.status = txt(L + 60, T + 56, '', { size: 12, color: THEME.MUTED, spacing: 1 }).setDepth(D);
            fref.cursor = add(PhaserScene.add.image(0, T + 56, 'buttons', 'white_pixel.png').setDisplaySize(7, 12).setDepth(D));
            helper.setTint(fref.cursor, THEME.CYAN);

            // Balances
            const balance = (x, label, color) => {
                txt(x, T + 22, label, { size: 10, color: THEME.DIM, origin: [1, 0.5], spacing: 2 }).setDepth(D);
                return txt(x, T + 45, '', { font: FONT.BOLD, size: 20, color, origin: [1, 0.5] }).setDepth(D);
            };
            fref.coin = balance(L + W - 230, t('takeover', 'balance_coin'), tt().getRewardColor('coin'));
            fref.data = balance(L + W - 92, t('takeover', 'balance_data'), THEME.CYAN_STR);
            fref.lastCoin = fref.lastData = null;

            const closeBtn = new Button({
                normal: { ref: 'close_button_normal.png', atlas: 'buttons', x: L + W - 42, y: T + 36 },
                hover: { ref: 'close_button_hover.png', atlas: 'buttons' },
                press: { ref: 'close_button_press.png', atlas: 'buttons' },
                onMouseUp: () => {
                    audio.play('click', 1.0);
                    hide();
                },
            });
            closeBtn.setDepth(D + 1);
            closeBtn.setScale(0.6);
            add(closeBtn);

            // Slow scan bar sweeping the panel
            fref.scan = add(PhaserScene.add.image(GAME_CONSTANTS.halfWidth, T, 'buttons', 'white_pixel.png')
                .setDisplaySize(W - 8, 90).setDepth(DEPTH + 1.1).setAlpha(0.03));
            helper.setBlendMode(fref.scan, Phaser.BlendModes.ADD);
        });

        // Power-on flicker
        for (const o of layers.frame) {
            if (o instanceof Button || o.alpha === undefined || o === fref.scan) continue;
            const a = o.alpha;
            o.setAlpha(0);
            PhaserScene.tweens.add({ targets: o, alpha: a, duration: 200, ease: 'Stepped', easeParams: [4] });
        }
        updateBalances(true);
    }

    function updateBalances(force = false) {
        if (!fref.data) return;
        const data = gameState.data;
        const coin = gameState.coin;
        if (force || data !== fref.lastData) {
            if (!force && fref.lastData !== null) bump(fref.data);
            fref.data.setText(fmtInt(data));
            fref.lastData = data;
        }
        if (force || coin !== fref.lastCoin) {
            if (!force && fref.lastCoin !== null) bump(fref.coin);
            fref.coin.setText((coin * 0.01).toFixed(2));
            fref.lastCoin = coin;
        }
    }

    function bump(textObj) {
        PhaserScene.tweens.killTweensOf(textObj);
        textObj.setScale(1.18);
        PhaserScene.tweens.add({ targets: textObj, scale: 1, duration: 260, ease: 'Back.easeOut' });
    }

    function setToast(text, color, ms = 2600) {
        toast = { text, color, until: performance.now() + ms };
    }

    function statusLine() {
        if (toast && performance.now() < toast.until) return [toast.text, toast.color];
        toast = null;
        const speed = tt().getHackingSpeed().toFixed(1);
        if (view === 'hacking') return [t('takeover', 'status_breaching', [speed]), THEME.CYAN_STR];
        if (view === 'success') return [t('takeover', 'status_complete'), THEME.GREEN_STR];
        if (tt().isTutorial()) return [t('takeover', 'status_tutorial'), THEME.GREEN_STR];
        const online = tt().getTargets().filter(Boolean).length;
        return [t('takeover', 'status_idle', [online, speed]), THEME.MUTED];
    }

    function updateStatus() {
        if (!fref.status) return;
        const [text, color] = statusLine();
        if (fref.status.text !== text) {
            fref.status.setText(text);
            fref.cursor.x = fref.status.x + fref.status.width + 8;
        }
        if (fref.status.style.color !== color) fref.status.setColor(color);
    }

    // ── Render ───────────────────────────────────────────────────────────────

    function render(intro = false) {
        view = logicView();
        const targets = tt().getTargets();
        if (view === 'detail' && !targets[selectedIndex]) selectedIndex = firstTargetIndex();
        if (view !== 'detail') selectedIndex = activeIndex();
        renderList(intro);
        renderPane(intro);
        updateStatus();
    }

    // ── Target list ──────────────────────────────────────────────────────────

    function renderList(intro) {
        clearLayer('list');
        inLayer('list', () => {
            txt(LIST.x + 4, LIST.y + 14, t('takeover', 'targets'), { size: 11, color: THEME.DIM, spacing: 3 }).setDepth(D);
            const g = gfx(D);
            g.lineStyle(1, THEME.LINE, 1);
            g.lineBetween(LIST.x + 90, LIST.y + 14, LIST.x + LIST.w, LIST.y + 14);

            const targets = tt().getTargets();
            const busyIdx = view === 'detail' ? -1 : activeIndex();
            for (let i = 0; i < 3; i++) {
                const y = ROWS_Y + i * (ROW_H + ROW_GAP);
                const objs = targets[i] ? targetRow(i, targets[i], y, busyIdx) : offlineRow(y);
                if (intro) fadeIn(objs, { delay: 80 + i * 70, slide: 18 });
            }
        });
    }

    function targetRow(i, target, y, busyIdx) {
        const objs = [];
        const push = (o) => { objs.push(o); return o; };
        const x = LIST.x, w = LIST.w, h = ROW_H;
        const sec = target.security;
        const color = securityColor(sec);
        const selected = view === 'detail' ? i === selectedIndex : i === busyIdx;
        const locked = busyIdx !== -1 && i !== busyIdx;
        const affordable = resourceManager.canAfford('data', target.cost);

        const g = push(gfx(D + 0.1));
        const draw = (hover) => {
            g.clear();
            UI.fillChamfer(g, x, y, w, h, 14, THEME.ROW, 0.92);
            if (selected) {
                UI.fillChamfer(g, x, y, w, h, 14, color, 0.07);
                UI.glowChamfer(g, x, y, w, h, 14, color, 0.95, 0.8);
                UI.brackets(g, x - 6, y - 6, w + 12, h + 12, 14, color, 0.85, 1.5);
                g.fillStyle(color, 0.95);
                g.fillTriangle(x + w + 9, y + h / 2 - 8, x + w + 17, y + h / 2, x + w + 9, y + h / 2 + 8);
            } else {
                UI.strokeChamfer(g, x, y, w, h, 14, color, hover ? 0.65 : 0.22, 1.2);
            }
            g.fillStyle(color, selected ? 0.95 : 0.45);
            g.fillRect(x + 1, y + 16, 3, h - 32);
            g.lineStyle(1, THEME.LINE, 1);
            g.lineBetween(x + 20, y + 92, x + w - 20, y + 92);
        };
        draw(false);

        UI.hexIcon(push(gfx(D + 0.2)), x + 50, y + 48, 24, target.rewardType, color);
        push(txt(x + 88, y + 34, target.name, { font: FONT.BOLD, size: 19 }).setDepth(D + 0.2));
        UI.pips(push(gfx(D + 0.2)), x + 90, y + 62, pipCount(sec), 3, color);
        push(txt(x + 130, y + 62, t('takeover', 'security_' + sec), { font: FONT.BOLD, size: 12, color: hexStr(color), spacing: 1 }).setDepth(D + 0.2));

        // Top-right tag
        let tag = null;
        if (i === busyIdx) {
            tag = view === 'success' ? [t('takeover', 'tag_ready'), THEME.GREEN_STR] : [t('takeover', 'tag_live'), THEME.CYAN_STR];
        } else if (tt().isTutorial() && i === firstTargetIndex()) {
            tag = [t('takeover', 'recommended'), THEME.GREEN_STR];
        }
        if (tag) {
            const tagText = push(txt(x + w - 20, y + 22, tag[0], { font: FONT.BOLD, size: 11, color: tag[1], origin: [1, 0.5], spacing: 2 }).setDepth(D + 0.2));
            if (i === busyIdx) PhaserScene.tweens.add({ targets: tagText, alpha: 0.35, duration: 600, yoyo: true, repeat: -1, delay: 300 });
        }

        // Metrics
        const cols = [
            [x + 24, t('takeover', 'cost'), `${target.cost} DATA`, affordable ? THEME.CYAN_STR : THEME.RED_STR],
            [x + 152, t('takeover', 'payout'), rewardStr(target.rewardType, target.rewardAmount), tt().getRewardColor(target.rewardType)],
            [x + 318, t('takeover', 'time'), helper.formatTime(Math.ceil(tt().getEffectiveDuration(target))), THEME.TEXT],
        ];
        for (const [cx, label, value, c] of cols) {
            push(txt(cx, y + 114, label, { size: 11, color: THEME.DIM, spacing: 2 }).setDepth(D + 0.2));
            push(txt(cx, y + 136, value, { font: FONT.BOLD, size: 16, color: c }).setDepth(D + 0.2));
        }

        if (!locked && view === 'detail') {
            const zone = push(add(PhaserScene.add.zone(x + w / 2, y + h / 2, w, h).setInteractive({ useHandCursor: true }).setDepth(D + 0.5)));
            zone.on('pointerover', () => {
                if (i === selectedIndex) return;
                draw(true);
                audio.play('click', 0.25);
            });
            zone.on('pointerout', () => { if (i !== selectedIndex) draw(false); });
            zone.on('pointerup', () => select(i));
        }
        if (locked) objs.forEach(o => o.setAlpha && o.setAlpha(0.28));
        return objs;
    }

    function offlineRow(y) {
        const g = gfx(D + 0.1);
        UI.dashedRect(g, LIST.x, y, LIST.w, ROW_H, THEME.DISABLED, 0.6);
        const label = txt(LIST.x + LIST.w / 2, y + ROW_H / 2, t('takeover', 'offline'), { font: FONT.BOLD, size: 13, color: THEME.DIM, origin: [0.5, 0.5], spacing: 2 }).setDepth(D + 0.2);
        PhaserScene.tweens.add({ targets: label, alpha: 0.35, duration: 1000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        return [g, label];
    }

    function select(i) {
        if (busy || view !== 'detail' || i === selectedIndex) return;
        selectedIndex = i;
        audio.play('click', 0.8);
        renderList(false);
        renderPane(true);
    }

    // ── Context pane ─────────────────────────────────────────────────────────

    function renderPane(intro) {
        clearLayer('pane');
        pref = {};
        inLayer('pane', () => {
            if (view === 'hacking') paneHacking();
            else if (view === 'success') paneSuccess();
            else paneDetail();
        });
        if (intro) fadeIn(layers.pane, { duration: 200 });
    }

    function paneChrome(color) {
        const g = gfx(D);
        UI.strokeChamfer(g, PANE.x, PANE.y, PANE.w, PANE.h, 16, color, 0.18, 1);
        UI.brackets(g, PANE.x - 4, PANE.y - 4, PANE.w + 8, PANE.h + 8, 16, color, 0.6, 1.5);
        return g;
    }

    function paneHeader(label, color, blink) {
        const x = PANE.x + 24;
        if (blink) {
            const dot = gfx(D + 0.2);
            dot.fillStyle(UI.toHex(color), 1);
            dot.fillCircle(x + 4, PANE.y + 22, 4);
            PhaserScene.tweens.add({ targets: dot, alpha: 0.2, duration: 500, yoyo: true, repeat: -1 });
        }
        txt(blink ? x + 16 : x, PANE.y + 22, label, { font: FONT.BOLD, size: 11, color, spacing: 3 }).setDepth(D + 0.2);
    }

    function paneDetail() {
        const target = tt().getTargets()[selectedIndex];
        if (!target) return;
        const P = PANE, x = P.x + 24, cx = P.x + P.w / 2;
        const color = securityColor(target.security);
        const affordable = resourceManager.canAfford('data', target.cost);
        pref.affordable = affordable;

        paneChrome(color);
        paneHeader(t('takeover', 'dossier'), THEME.DIM, false);
        txt(x, P.y + 58, target.name, { font: FONT.BOLD, size: 30 }).setDepth(D + 0.2);
        UI.pips(gfx(D + 0.2), x + 2, P.y + 94, pipCount(target.security), 3, color);
        const secLabel = txt(x + 42, P.y + 94, t('takeover', 'security_' + target.security), { font: FONT.BOLD, size: 13, color: hexStr(color), spacing: 1 }).setDepth(D + 0.2);
        txt(secLabel.x + secLabel.width + 14, P.y + 94, '//  ' + t('takeover', 'layers', [tt().getFirewallLayers(target.security)]), { size: 13, color: THEME.MUTED, spacing: 1 }).setDepth(D + 0.2);
        txt(x, P.y + 128, target.flavor, { font: FONT.ITALIC, size: 17, color: THEME.MUTED, wrap: P.w - 48 }).setDepth(D + 0.2);

        // Dossier
        const d = UI.dossier(target);
        const rows = [
            [t('takeover', 'host'), d.host],
            [t('takeover', 'route'), t('takeover', 'route_value', [d.hops])],
            [t('takeover', 'cipher'), d.cipher],
        ];
        rows.forEach(([label, value], k) => {
            txt(x, P.y + 172 + k * 24, label, { size: 11, color: THEME.DIM, spacing: 2 }).setDepth(D + 0.2);
            txt(x + 96, P.y + 172 + k * 24, value, { size: 14, color: '#9fb3c8', spacing: 1 }).setDepth(D + 0.2);
        });

        // Stat boxes
        const speed = tt().getHackingSpeed();
        const net = target.rewardType === 'data' ? target.rewardAmount - target.cost : null;
        const boxes = [
            [t('takeover', 'cost'), `${target.cost} DATA`, affordable ? THEME.CYAN_STR : THEME.RED_STR,
                affordable ? '' : t('takeover', 'insufficient'), THEME.RED_STR],
            [t('takeover', 'payout'), rewardStr(target.rewardType, target.rewardAmount), tt().getRewardColor(target.rewardType),
                net !== null ? t('takeover', 'net', [net]) : '', THEME.GREEN_STR],
            [t('takeover', 'time'), helper.formatTime(Math.ceil(tt().getEffectiveDuration(target))), THEME.TEXT,
                speed > 1 ? t('takeover', 'sped_up', [speed.toFixed(1)]) : '', THEME.CYAN_STR],
        ];
        const bw = 174, bh = 92, by = P.y + 252;
        const bg = gfx(D + 0.1);
        boxes.forEach(([label, value, valueColor, sub, subColor], k) => {
            const bx = x + k * (bw + 16);
            UI.fillChamfer(bg, bx, by, bw, bh, 10, THEME.ROW, 0.9);
            UI.strokeChamfer(bg, bx, by, bw, bh, 10, THEME.LINE, 1, 1);
            bg.fillStyle(color, 0.9);
            bg.fillRect(bx, by + 10, 2, 18);
            txt(bx + 14, by + 20, label, { size: 11, color: THEME.DIM, spacing: 2 }).setDepth(D + 0.2);
            txt(bx + 14, by + 50, value, { font: FONT.BOLD, size: 21, color: valueColor }).setDepth(D + 0.2);
            if (sub) txt(bx + 14, by + 76, sub, { size: 11, color: subColor, spacing: 1 }).setDepth(D + 0.2);
        });

        pref.initBtn = UI.button(PhaserScene, add, {
            x: cx, y: P.y + 424, w: 440, h: 66, depth: D + 0.3,
            label: affordable ? t('takeover', 'initiate') : t('takeover', 'insufficient'),
            sub: affordable ? t('takeover', 'debit', [target.cost]) : t('takeover', 'need_have', [target.cost, fmtInt(gameState.data)]),
            color: THEME.CYAN, enabled: affordable, chevrons: true,
            onClick: initiate, onDenied: deny,
        });
        txt(cx, P.y + 500, t('takeover', 'abort_hint'), { size: 11, color: THEME.DIM, origin: [0.5, 0.5], spacing: 1 }).setDepth(D + 0.2);
    }

    function paneHacking() {
        const a = tt().getActiveAttack();
        const target = a.target;
        const P = PANE, x = P.x + 24, cx = P.x + P.w / 2, right = P.x + P.w - 24;
        const color = securityColor(target.security);
        pref.color = color;
        pref.layers = tt().getFirewallLayers(target.security);

        paneChrome(THEME.CYAN);
        paneHeader(t('takeover', 'in_progress'), THEME.CYAN_STR, true);
        txt(x, P.y + 58, target.name, { font: FONT.BOLD, size: 30 }).setDepth(D + 0.2);
        txt(right, P.y + 58, rewardStr(target.rewardType, target.rewardAmount), { font: FONT.BOLD, size: 16, color: tt().getRewardColor(target.rewardType), origin: [1, 0.5] }).setDepth(D + 0.2);

        txt(x, P.y + 100, t('takeover', 'firewall'), { size: 11, color: THEME.DIM, spacing: 3 }).setDepth(D + 0.2);
        pref.layerText = txt(right, P.y + 100, '', { font: FONT.BOLD, size: 11, color: hexStr(color), origin: [1, 0.5], spacing: 2 }).setDepth(D + 0.2);
        pref.fw = gfx(D + 0.2);

        pref.timer = txt(x, P.y + 168, '', { font: FONT.BOLD, size: 52 }).setDepth(D + 0.2);
        pref.pct = txt(right, P.y + 176, '', { font: FONT.BOLD, size: 26, color: THEME.CYAN_STR, origin: [1, 0.5] }).setDepth(D + 0.2);
        pref.bar = gfx(D + 0.2);

        buildLogBox(P.y + 236, LOG_ROWS);
        if (log.target !== target.name) resetLog(target, true);

        pref.abortBtn = UI.button(PhaserScene, add, {
            x: cx, y: P.y + 484, w: 360, h: 58, depth: D + 0.3,
            label: t('takeover', 'abort'), sub: t('takeover', 'refund', [tt().getRefundAmount()]),
            color: THEME.RED, onClick: abort,
        });
        updateHacking(true);
    }

    function paneSuccess() {
        const a = tt().getActiveAttack();
        const pr = tt().getPendingReward();
        const P = PANE, x = P.x + 24, cx = P.x + P.w / 2, right = P.x + P.w - 24;
        const rewardColor = tt().getRewardColor(pr.rewardType);

        paneChrome(THEME.GREEN);
        paneHeader(t('takeover', 'complete'), THEME.GREEN_STR, true);
        txt(x, P.y + 58, pr.targetName, { font: FONT.BOLD, size: 30 }).setDepth(D + 0.2);

        // Firewall: fully breached
        const layersN = tt().getFirewallLayers(a ? a.target.security : 'LOW'); // activeAttack stays set until claimed
        txt(x, P.y + 100, t('takeover', 'firewall'), { size: 11, color: THEME.DIM, spacing: 3 }).setDepth(D + 0.2);
        txt(right, P.y + 100, t('takeover', 'all_layers'), { font: FONT.BOLD, size: 11, color: THEME.GREEN_STR, origin: [1, 0.5], spacing: 2 }).setDepth(D + 0.2);
        drawFirewall(gfx(D + 0.2), layersN, layersN, 0, THEME.GREEN, true);

        // Payout, centred as icon + amount
        txt(cx, P.y + 150, t('takeover', 'payout'), { size: 11, color: THEME.DIM, origin: [0.5, 0.5], spacing: 3 }).setDepth(D + 0.2);
        const amount = txt(0, P.y + 196, rewardStr(pr.rewardType, pr.rewardAmount), { font: FONT.BOLD, size: 44, color: rewardColor }).setDepth(D + 0.2);
        const total = 64 + 18 + amount.width;
        const start = cx - total / 2;
        UI.hexIcon(gfx(D + 0.2), start + 32, P.y + 196, 30, pr.rewardType, UI.toHex(rewardColor));
        amount.x = start + 64 + 18;
        pref.reward = amount;

        buildLogBox(P.y + 236 + 24, LOG_ROWS - 1);
        if (log.target !== pr.targetName) resetLog({ name: pr.targetName }, false);
        const hasDoneLines = log.lines.some(l => l.done) || log.queue.some(l => l.done) || (log.typing && log.typing.done);
        if (!hasDoneLines) {
            queueLog(t('takeover', 'log_done'), THEME.GREEN_STR, true);
            queueLog(t('takeover', 'log_exfil'), THEME.GREEN_STR, true);
            queueLog(t('takeover', 'log_await'), THEME.GREEN_STR, true);
        }

        pref.claimBtn = UI.button(PhaserScene, add, {
            x: cx, y: P.y + 484, w: 440, h: 62, depth: D + 0.3,
            label: t('takeover', 'claim'), sub: rewardStr(pr.rewardType, pr.rewardAmount),
            color: THEME.GREEN, chevrons: true, onClick: claim,
        });
        pref.claimBtn.pulse();
    }

    // ── Hacking visuals ──────────────────────────────────────────────────────

    function drawFirewall(g, total, done, partial, color, blinkOn) {
        const x = PANE.x + 24, y = PANE.y + 114, w = PANE.w - 48, h = 22, gap = 8;
        const segW = (w - gap * (total - 1)) / total;
        g.clear();
        for (let k = 0; k < total; k++) {
            const sx = x + k * (segW + gap);
            if (k < done) {
                g.fillStyle(color, 0.85);
                g.fillRect(sx, y, segW, h);
            } else if (k === done) {
                g.fillStyle(color, 0.12);
                g.fillRect(sx, y, segW, h);
                g.fillStyle(color, 0.45);
                g.fillRect(sx, y, segW * partial, h);
                g.lineStyle(1.5, color, blinkOn ? 1 : 0.45);
                g.strokeRect(sx, y, segW, h);
            } else {
                g.lineStyle(1, THEME.DISABLED, 0.6);
                g.strokeRect(sx, y, segW, h);
            }
        }
    }

    function drawProgress(g, p) {
        const x = PANE.x + 24, y = PANE.y + 206, w = PANE.w - 48, h = 6;
        g.clear();
        g.fillStyle(THEME.LINE, 1);
        g.fillRect(x, y, w, h);
        g.fillStyle(THEME.CYAN, 1);
        g.fillRect(x, y, Math.max(1, w * p), h);
        g.fillStyle(THEME.CYAN, 0.25);
        g.fillRect(x, y - 3, Math.max(1, w * p), h + 6);
        g.fillStyle(THEME.BG, 1);
        for (let k = 1; k < 10; k++) g.fillRect(x + (w * k) / 10 - 1, y, 2, h);
    }

    function updateHacking(force = false) {
        if (!pref.timer) return;
        const p = tt().getProgress();
        const N = pref.layers;
        const done = Math.min(N, Math.floor(p * N));
        const blinkOn = Math.floor(performance.now() / 350) % 2 === 0;

        const timeStr = helper.formatTime(tt().getRemainingSeconds());
        if (pref.timer.text !== timeStr) pref.timer.setText(timeStr);
        const pctStr = Math.floor(p * 100) + '%';
        if (pref.pct.text !== pctStr) pref.pct.setText(pctStr);
        const layerStr = t('takeover', 'layer', [Math.min(done + 1, N), N]);
        if (pref.layerText.text !== layerStr) pref.layerText.setText(layerStr);

        drawFirewall(pref.fw, N, done, p * N - done, pref.color, blinkOn);
        drawProgress(pref.bar, p);

        if (done > log.layersDone) {
            for (let k = log.layersDone + 1; k <= done; k++) {
                queueLog(t('takeover', 'log_layer', [k]), hexStr(pref.color));
            }
            if (!force) audio.play('click2', 0.5);
            log.layersDone = done;
        }
    }

    // ── Intrusion log ────────────────────────────────────────────────────────

    function buildLogBox(y, rows) {
        const x = PANE.x + 24, w = PANE.w - 48, h = rows * 24 + 16;
        const g = gfx(D + 0.1);
        UI.fillChamfer(g, x, y, w, h, 10, 0x03060b, 0.9);
        UI.strokeChamfer(g, x, y, w, h, 10, THEME.LINE, 1, 1);
        UI.scanlines(g, x + 2, y + 2, w - 4, h - 4, 0.03, 3);
        pref.logTexts = [];
        for (let k = 0; k < rows; k++) {
            pref.logTexts.push(txt(x + 16, y + 20 + k * 24, '', { size: 14, color: '#5fd4e0', spacing: 1 }).setDepth(D + 0.2));
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
        log.lines.push({ text: t('takeover', 'log_start', [target.name]), color: THEME.CYAN_STR });
        if (prefill && target.security) {
            const N = tt().getFirewallLayers(target.security);
            const done = Math.min(N, Math.floor(Math.max(0, tt().getProgress()) * N));
            for (let k = 1; k <= done; k++) {
                log.lines.push({ text: UI.randomLogLine(), color: '#5fd4e0' });
                log.lines.push({ text: t('takeover', 'log_layer', [k]), color: hexStr(securityColor(target.security)) });
            }
            log.layersDone = done;
            log.lines.push({ text: UI.randomLogLine(), color: '#5fd4e0' });
        }
    }

    function queueLog(text, color = '#5fd4e0', done = false) {
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
            visible[visible.length - 1] = { ...last, text: last.text + (view === 'success' ? cursor : '') };
        }
        for (let k = 0; k < rows; k++) {
            const line = visible[k] || { text: '', color: '#5fd4e0' };
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
        flashPane(THEME.CYAN);
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
        setToast(t('takeover', 'status_denied'), THEME.RED_STR, 2000);
        if (pref.initBtn) pref.initBtn.shake();
        updateStatus();
    }

    function abort() {
        if (busy || view !== 'hacking') return;
        const refund = tt().getRefundAmount();
        if (!tt().cancelAttack()) return;
        audio.play('click', 1.0);
        setToast(t('takeover', 'status_aborted', [refund]), THEME.CYAN_STR);
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
            PhaserScene.tweens.add({ targets: pref.reward, scale: 1.3, alpha: 0, y: pref.reward.y - 40, duration: 380, ease: 'Cubic.easeIn' });
        }
        flashPane(THEME.GREEN);
        PhaserScene.time.delayedCall(380, () => {
            busy = false;
            const reward = tt().collectReward();
            if (!isVisible) return;
            if (reward) {
                setToast(t('takeover', 'status_claimed', [rewardStr(reward.rewardType, reward.rewardAmount).replace(/^\+/, '')]),
                    tt().getRewardColor(reward.rewardType));
            }
            resetLog(null);
            selectedIndex = firstTargetIndex();
            render(true);
        });
    }

    function flashPane(color) {
        const f = add(PhaserScene.add.image(PANE.x + PANE.w / 2, PANE.y + PANE.h / 2, 'buttons', 'white_pixel.png')
            .setDisplaySize(PANE.w, PANE.h).setDepth(D + 0.6).setAlpha(0.22));
        helper.setTint(f, color);
        helper.setBlendMode(f, Phaser.BlendModes.ADD);
        PhaserScene.tweens.add({ targets: f, alpha: 0, duration: 320, ease: 'Cubic.easeOut', onComplete: () => f.setVisible(false) });
    }

    // ── Per-frame update ─────────────────────────────────────────────────────

    let lastFrame = 0;

    function update() {
        if (!isVisible) return;
        const now = performance.now();
        const dt = lastFrame ? Math.min(100, now - lastFrame) : 16;
        lastFrame = now;

        if (fref.scan) {
            const span = H - 90;
            fref.scan.y = T + 45 + ((now / 5000) % 1) * span;
        }
        if (fref.cursor) fref.cursor.setVisible(Math.floor(now / 530) % 2 === 0);
        updateBalances();
        updateStatus();

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
