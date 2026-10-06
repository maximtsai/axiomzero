/**
 * @fileoverview Playtest extension for the Financial Breach / Takeover system.
 * Loaded automatically by tools/playtest.js; attaches AZT.takeover. Dev-only, never shipped.
 *
 * Scenarios (write a save + reload — re-inject playtest.js afterwards):
 *   AZT.takeover.load('idle')                 → 3 fixed targets: LOW/coin, MEDIUM/data, HIGH/insight
 *   AZT.takeover.load('attacking', { slot: 1, progress: 0.8 })
 *   AZT.takeover.load('pending', { slot: 2 }) → reward ready to claim
 *   AZT.takeover.load('offline')              → breach finished while "closed"; completes during boot
 *   AZT.takeover.load('tutorial' | 'locked' | 'broke' | 'extremes' | 'firstBreach')
 *
 * Live controls (no reload):
 *   AZT.takeover.status()                     → button state, view, targets, active breach, resources
 *   AZT.takeover.setTargets([{ rewardType: 'insight' }, ...])   → exact cards (partials filled in)
 *   AZT.takeover.start(i) / fastForward(sec) / finishIn(sec) / completeNow()
 *
 * Real UI input (DOM mouse events through Phaser):
 *   openViaButton() / open() / close() / select(i) / initiate() / abort() / claim()
 *   ui()            → { view: 'closed'|'detail'|'hacking'|'success', selected, texts: [...] }
 *   checkLayout()   → overlapping / out-of-panel text in the terminal
 *
 * End-to-end flows (return a step-by-step pass/fail log):
 *   await AZT.takeover.flow('breach', { slot: 0 })   // open → select → initiate → hack → complete → claim → close
 *   await AZT.takeover.flow('abort' | 'select' | 'resume' | 'unaffordable' | 'tutorial')
 *   await AZT.takeover.flow('all')                   // every reward type + abort + select
 */
(() => {
    const AZT = window.AZT;
    const tt = () => takeoverTargets;
    const POPUP_DEPTH = () => GAME_CONSTANTS.DEPTH_POPUPS + 2000; // takeoverPopup's DEPTH
    const PANE_X = () => GAME_CONSTANTS.halfWidth - 550 + 474;     // takeoverPopup's PANE.x
    const wait = AZT.wait;

    // ── Target builders ──────────────────────────────────────────────────────

    const TARGET_DEFAULTS = {
        name: 'TEST CORP', security: 'LOW', flavor: 'Running a test breach',
        cost: 50, duration: 60, rewardType: 'coin', rewardAmount: 10,
    };

    function makeTarget(overrides = {}) {
        return { ...TARGET_DEFAULTS, ...overrides };
    }

    /** One card per security level and reward type, with readable values. */
    const STANDARD_TARGETS = () => [
        makeTarget({ name: 'ORBITAL BANK', security: 'LOW', flavor: 'Draining corporate bank accounts', cost: 50, duration: 50, rewardType: 'coin', rewardAmount: 10 }),
        makeTarget({ name: 'SILICON TRUST', security: 'MEDIUM', flavor: 'Downloading private customer emails', cost: 135, duration: 90, rewardType: 'data', rewardAmount: 195 }),
        makeTarget({ name: 'SYNAPSE CAPITAL', security: 'HIGH', flavor: 'Connecting dots across global databases', cost: 250, duration: 240, rewardType: 'insight', rewardAmount: 1 }),
    ];

    /** Longest names/flavor text and largest numbers the generator can produce — for layout checks. */
    const EXTREME_TARGETS = () => [
        makeTarget({ name: 'DATAVAULT INDUSTRIES', security: 'MEDIUM', flavor: 'Liquidating forgotten asset portfolios', cost: 200, duration: 120, rewardType: 'coin', rewardAmount: 38 }),
        makeTarget({ name: 'NEXUS FINANCIAL CORP', security: 'HIGH', flavor: 'Hijacking algorithmic trading profits', cost: 500, duration: 270, rewardType: 'data', rewardAmount: 850 }),
        makeTarget({ name: 'APEX DIGITAL ASSETS', security: 'HIGH', flavor: 'Finding hidden patterns in stolen records', cost: 300, duration: 270, rewardType: 'insight', rewardAmount: 1 }),
    ];

    // ── Scenarios (save + reload) ────────────────────────────────────────────

    function _takeoverState(targets, extra = {}) {
        return {
            targets: [...targets, null, null, null].slice(0, 3),
            activeAttack: null,
            pendingReward: null,
            hasCompletedFirstTutorial: true,
            insightCooldown: 0,
            lastPickedWasData: false,
            totalBreaches: 3,
            ...extra,
        };
    }

    /** activeAttack record as takeoverTargets.startAttack() would build it. */
    function _attack(target, { progress = 0.5, remainingSec = null, speed = 1, startedSecAgo = null } = {}) {
        const duration = (target.duration * 1000) / speed;
        let elapsed = duration * progress;
        if (remainingSec !== null) elapsed = duration - remainingSec * 1000;
        if (startedSecAgo !== null) elapsed = startedSecAgo * 1000;
        return { target: { ...target }, startTime: Date.now() - elapsed, duration, cost: target.cost };
    }

    const SCENARIOS = {
        // Financial Breach not owned → no BREACH button.
        locked: () => ({ upgrades: AZT.unlockPath('awaken'), takeoverState: null }),
        // Button unlocked, never opened → first-time tutorial cards on open.
        tutorial: () => ({ takeoverState: null }),
        // Post-tutorial with fixed cards (override with { targets: [...] }).
        idle: (o) => ({ takeoverState: _takeoverState(o.targets || STANDARD_TARGETS()) }),
        // Same cards but 0 DATA → red costs, INSUFFICIENT DATA button.
        broke: (o) => ({ data: 0, takeoverState: _takeoverState(o.targets || STANDARD_TARGETS()) }),
        // Worst-case text lengths and numbers.
        extremes: () => ({ takeoverState: _takeoverState(EXTREME_TARGETS()) }),
        // Breach running on `slot` at `progress` (0–1) or with `remainingSec` left.
        attacking: (o) => {
            const targets = o.targets || STANDARD_TARGETS();
            return { takeoverState: _takeoverState(targets, { activeAttack: _attack(targets[o.slot ?? 0], o) }) };
        },
        // Breach finished, reward waiting to be claimed.
        pending: (o) => {
            const targets = o.targets || STANDARD_TARGETS();
            const t = targets[o.slot ?? 0];
            return {
                takeoverState: _takeoverState(targets, {
                    activeAttack: _attack(t, { progress: 1 }),
                    pendingReward: { rewardType: t.rewardType, rewardAmount: t.rewardAmount, targetName: t.name },
                }),
            };
        },
        // Breach started `offlineSec` (default 1h) ago and never marked complete → completes in takeoverTargets.init().
        offline: (o) => {
            const targets = o.targets || STANDARD_TARGETS();
            return { takeoverState: _takeoverState(targets, { activeAttack: _attack(targets[o.slot ?? 0], { startedSecAgo: o.offlineSec ?? 3600 }) }) };
        },
        // First-ever breach ready to claim with Dot installed → her reaction plays after closing the terminal.
        firstBreach: (o) => {
            const targets = o.targets || STANDARD_TARGETS();
            const t = targets[0];
            return {
                upgrades: AZT.unlockPath(['financial_breach', 'companion']),
                tutorialsSeen: { bomb: true },
                takeoverState: _takeoverState(targets, {
                    totalBreaches: 0,
                    activeAttack: _attack(t, { progress: 1 }),
                    pendingReward: { rewardType: t.rewardType, rewardAmount: t.rewardAmount, targetName: t.name },
                }),
            };
        },
    };

    const BASE_SAVE = () => ({
        isFirstLaunch: false, data: 50000, insight: 50, shard: 20, processor: 50, coin: 500, levelsDefeated: 3,
        upgrades: AZT.unlockPath('financial_breach'),
    });

    /** Write a takeover scenario save and reload. `overrides` is a partial gameState applied last. */
    function load(name, opts = {}, overrides = {}) {
        if (!SCENARIOS[name]) throw new Error(`unknown scenario '${name}'. Available: ${Object.keys(SCENARIOS).join(', ')}`);
        return AZT.loadSave({ ...BASE_SAVE(), ...SCENARIOS[name](opts), ...overrides });
    }

    // ── Live controls ────────────────────────────────────────────────────────

    function status() {
        const t = tt();
        const a = t.getActiveAttack();
        const saved = gameState.takeoverState || {};
        return {
            button: t.getButtonState(),
            view: takeoverPopup.getView(),
            selected: takeoverPopup.getSelectedIndex(),
            unlocked: ((gameState.upgrades && gameState.upgrades.financial_breach) || 0) > 0,
            phase: gameStateMachine.getPhase(),
            tutorial: t.isTutorial(),
            totalBreaches: t.getTotalBreaches(),
            hackSpeed: t.getHackingSpeed(),
            savedInsightCooldown: saved.insightCooldown ?? 0,
            savedLastPickedWasData: !!saved.lastPickedWasData,
            targets: t.getTargets().map(x => x && `${x.security}/${x.rewardType} | ${x.name} | ${x.cost} DATA | ${x.duration}s | ${t.formatReward(x.rewardType, x.rewardAmount)}`),
            active: a ? {
                name: a.target.name,
                progress: +t.getProgress().toFixed(3),
                remainingSec: t.getRemainingSeconds(),
                durationSec: +(a.duration / 1000).toFixed(1),
                refund: t.getRefundAmount(),
            } : null,
            pending: t.getPendingReward(),
            resources: { data: gameState.data, coin: gameState.coin, insight: gameState.insight },
        };
    }

    function _active() {
        const a = tt().getActiveAttack();
        if (!a) throw new Error('no active breach — use start(i), the UI, or load("attacking")');
        return a;
    }

    function _mirrorSaved(a) {
        const s = gameState.takeoverState;
        if (s && s.activeAttack) s.activeAttack.startTime = a.startTime;
    }

    /** Move the running breach `sec` seconds forward (wall-clock timer, so this shifts startTime back). */
    function fastForward(sec) {
        const a = _active();
        a.startTime -= sec * 1000;
        _mirrorSaved(a);
        return status().active;
    }

    /** Make the running breach finish `sec` seconds from now. Watch it complete live with the terminal open. */
    function finishIn(sec) {
        const a = _active();
        a.startTime = Date.now() - (a.duration - sec * 1000);
        _mirrorSaved(a);
        return status().active;
    }

    /** Finish the running breach immediately (an open terminal flips to EXFILTRATION COMPLETE next frame). */
    function completeNow() {
        finishIn(0);
        tt().checkCompletion();
        return status();
    }

    /** Logic-level start (no UI). An open terminal picks the change up on its next frame. */
    function start(i = 0) {
        return tt().startAttack(i);
    }

    /** Replace the cards with exact targets (partials are filled with defaults; null = empty slot). */
    function setTargets(list) {
        const t = tt();
        if (t.getActiveAttack() || t.getPendingReward()) throw new Error('finish, claim or abort the active breach first');
        const next = [...list.map(x => x && makeTarget(x)), null, null, null].slice(0, 3);
        if (next.every(x => x === null)) throw new Error('need at least one target (all-null makes the game reroll)');
        const live = t.getTargets(); // the module's own array, returned by reference
        live.splice(0, 3, ...next);
        if (gameState.takeoverState) gameState.takeoverState.targets = live;
        refreshPopup();
        return status().targets;
    }

    function refreshPopup() {
        if (takeoverPopup.isOpen()) {
            takeoverPopup.hide();
            takeoverPopup.show();
        }
    }

    // ── UI (real input) ──────────────────────────────────────────────────────

    const _esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const _exact = (s) => new RegExp('^' + _esc(s) + '$');
    const _inPopup = () => ({ minDepth: POPUP_DEPTH() });
    const view = () => takeoverPopup.getView();

    /** Poll until `fn()` is truthy (or time out). Resolves to the final value. */
    async function until(fn, timeoutMs = 3000, stepMs = 50) {
        const t0 = Date.now();
        let v = fn();
        while (!v && Date.now() - t0 < timeoutMs) {
            await wait(stepMs);
            v = fn();
        }
        return v;
    }

    function ui() {
        return {
            view: view(),
            selected: takeoverPopup.getSelectedIndex(),
            texts: takeoverPopup.isOpen() ? AZT.screenTexts(POPUP_DEPTH()) : [],
        };
    }

    /** Click the upgrade-tree BREACH button like a player would. */
    async function openViaButton() {
        const label = _exact(t('ui', 'takeover'));
        if (!AZT.findTexts(label).length) throw new Error('BREACH button not visible (needs financial_breach + upgrade phase)');
        await AZT.clickText(label);
        await until(() => view() !== 'closed', 1000);
        await wait(250); // let the power-on flicker finish so text is visible to queries
        return view();
    }

    function open() {
        takeoverPopup.show();
        return view();
    }

    async function close() {
        await AZT.clickFrame('close_button_', _inPopup());
        await until(() => view() === 'closed', 1000);
        return view();
    }

    /** Click a target row in the list (by its name, on the list side of the terminal). */
    async function select(i) {
        const target = tt().getTargets()[i];
        if (!target) throw new Error(`no target in slot ${i}`);
        const hit = AZT.findTexts(_exact(target.name), _inPopup()).filter(h => h.x < PANE_X()).sort((a, b) => a.x - b.x)[0];
        if (!hit) throw new Error(`row for ${target.name} not visible`);
        await AZT.clickAt(hit.x, hit.y);
        await until(() => takeoverPopup.getSelectedIndex() === i, 800);
        await wait(250);
        return takeoverPopup.getSelectedIndex();
    }

    /** Click INITIATE BREACH (or the INSUFFICIENT DATA button) and wait for the hacking view. */
    async function initiate() {
        const label = AZT.findTexts(_exact(t('takeover', 'initiate')), _inPopup()).length
            ? t('takeover', 'initiate') : t('takeover', 'insufficient');
        await AZT.clickText(_exact(label), _inPopup());
        await until(() => view() === 'hacking', 1500);
        await wait(250);
        return view();
    }

    async function abort() {
        await AZT.clickText(_exact(t('takeover', 'abort')), _inPopup());
        await until(() => view() === 'detail', 1000);
        await wait(250);
        return view();
    }

    async function claim() {
        await AZT.clickText(_exact(t('takeover', 'claim')), _inPopup());
        await until(() => view() === 'detail', 2000);
        await wait(350);
        return view();
    }

    /** Text in the terminal that overlaps other text or spills outside the 1100x660 panel. */
    function checkLayout() {
        if (!takeoverPopup.isOpen()) throw new Error('open the terminal first');
        const cx = GAME_CONSTANTS.halfWidth, cy = GAME_CONSTANTS.halfHeight;
        const panel = { l: cx - 550, r: cx + 550, t: cy - 330, b: cy + 330 };
        const items = AZT.findTexts(/\S/, _inPopup())
            .filter(t => t.w > 0)
            .map(t => ({ text: t.text, l: t.x - t.w / 2, r: t.x + t.w / 2, t: t.y - t.h / 2, b: t.y + t.h / 2, depth: t.depth }));
        const outOfPanel = items.filter(i => i.l < panel.l || i.r > panel.r || i.t < panel.t || i.b > panel.b).map(i => i.text);
        const overlaps = [];
        for (let a = 0; a < items.length; a++) {
            for (let b = a + 1; b < items.length; b++) {
                const A = items[a], B = items[b];
                if (A.l < B.r && B.l < A.r && A.t < B.b && B.t < A.b) overlaps.push([A.text, B.text]);
            }
        }
        return { ok: !outOfPanel.length && !overlaps.length, outOfPanel, overlaps, texts: items.length };
    }

    // ── End-to-end flows ─────────────────────────────────────────────────────

    class FlowStop extends Error {}

    async function _run(name, fn) {
        const steps = [];
        const check = (step, ok, detail) => {
            steps.push(detail === undefined ? { step, ok: !!ok } : { step, ok: !!ok, detail });
            if (!ok) throw new FlowStop(step);
        };
        let passed = true;
        try {
            await fn(check);
        } catch (e) {
            passed = false;
            if (!(e instanceof FlowStop)) steps.push({ step: 'threw', ok: false, detail: e.message });
        }
        return { flow: name, passed, steps };
    }

    /** The header status line (left-aligned at T + 56 in takeoverPopup's layout). */
    const statusText = () => {
        const y = GAME_CONSTANTS.halfHeight - 330 + 56;
        const hit = AZT.findTexts(/\S/, _inPopup()).find(t => Math.abs(t.y - y) < 6 && t.x < GAME_CONSTANTS.halfWidth);
        return hit ? hit.text : '';
    };

    async function _ensureOpen(check) {
        if (takeoverPopup.isOpen()) return;
        const viaButton = AZT.findTexts(_exact(t('ui', 'takeover'))).length > 0;
        const v = viaButton ? await openViaButton() : open();
        if (!viaButton) await wait(250);
        check(viaButton ? 'open via BREACH button' : 'open terminal directly', v !== 'closed', v);
    }

    const FLOWS = {
        /** Full happy path for one target, through the real UI. */
        async breach(check, { slot = 0 } = {}) {
            check('precondition: no breach running', tt().getButtonState() === 'idle', tt().getButtonState());
            await _ensureOpen(check);
            check('detail view', view() === 'detail', ui());
            const target = tt().getTargets()[slot];
            check(`slot ${slot} has a target`, !!target);
            check(`affordable (${target.cost} DATA)`, gameState.data >= target.cost, gameState.data);
            const dataBefore = gameState.data;

            check('select row', await select(slot) === slot, ui().selected);
            check('pane shows the target', AZT.findTexts(_exact(target.name), _inPopup()).length === 2, ui().texts);
            check('initiate → hacking view', await initiate() === 'hacking', ui().texts);
            check('cost deducted', gameState.data === dataBefore - target.cost, { before: dataBefore, after: gameState.data });
            check('breaching the selected target', tt().getActiveAttack().target.name === target.name);
            check('countdown shown', ui().texts.some(s => /^\d\d:\d\d$/.test(s)), ui().texts);
            check('abort shows refund', ui().texts.includes(t('takeover', 'refund', [tt().getRefundAmount()])), ui().texts);

            finishIn(1);
            check('completes live → success view', await until(() => view() === 'success', 3000) && true, ui().texts);
            await wait(300);
            const rewardStr = tt().formatReward(target.rewardType, target.rewardAmount);
            check('claim button shows reward', ui().texts.includes(rewardStr), ui().texts);

            const field = target.rewardType;
            const before = gameState[field];
            check('claim → back to detail', await claim() === 'detail', ui().texts);
            check(`${field} credited`, gameState[field] === before + target.rewardAmount, { before, after: gameState[field], expected: target.rewardAmount });
            check('state idle with three fresh targets', tt().getButtonState() === 'idle' && tt().getTargets().every(Boolean), status().targets);
            check('status confirms extraction', statusText().includes('SECURED'), statusText());
            check('close → terminal closed', await close() === 'closed');
        },

        /** Start a breach, abort it, check the 75% refund. */
        async abort(check, { slot = 0 } = {}) {
            check('precondition: no breach running', tt().getButtonState() === 'idle', tt().getButtonState());
            await _ensureOpen(check);
            const target = tt().getTargets()[slot];
            const dataBefore = gameState.data;
            await select(slot);
            check('initiate → hacking', await initiate() === 'hacking', ui().texts);
            check('abort → back to detail', await abort() === 'detail', ui().texts);
            const refund = Math.floor(target.cost * 0.75);
            check(`refund ${refund} of ${target.cost}`, gameState.data === dataBefore - target.cost + refund, { before: dataBefore, after: gameState.data });
            check('state idle', tt().getButtonState() === 'idle');
            check('status confirms refund', statusText().includes(String(refund)), statusText());
            check('close', await close() === 'closed');
        },

        /** Clicking rows switches the detail pane without spending anything. */
        async select(check) {
            await _ensureOpen(check);
            const dataBefore = gameState.data;
            const targets = tt().getTargets();
            for (let i = 0; i < 3; i++) {
                if (!targets[i]) continue;
                check(`select row ${i}`, await select(i) === i, ui().selected);
                check(`pane shows ${targets[i].name}`, AZT.findTexts(_exact(targets[i].name), _inPopup()).length === 2, ui().texts);
            }
            check('no DATA spent', gameState.data === dataBefore);
            check('state idle', tt().getButtonState() === 'idle');
            check('close', await close() === 'closed');
        },

        /** Close and reopen during a breach: progress must persist and keep counting. */
        async resume(check) {
            if (tt().getButtonState() === 'idle') check('start a breach', start(0), status());
            check('state attacking', tt().getButtonState() === 'attacking');
            await _ensureOpen(check);
            check('hacking view', view() === 'hacking', ui().texts);
            const p1 = tt().getProgress();
            check('close', await close() === 'closed');
            await wait(1200);
            open();
            await wait(250);
            check('reopens on hacking view', view() === 'hacking');
            const p2 = tt().getProgress();
            check('progress kept counting while closed', p2 > p1, { before: p1, after: p2 });
            check('close', await close() === 'closed');
        },

        /** Try to start a target the player can't afford: nothing is spent or started, the player is told why. */
        async unaffordable(check, { slot = 0 } = {}) {
            await _ensureOpen(check);
            const target = tt().getTargets()[slot];
            check(`precondition: can't afford (${gameState.data} < ${target.cost})`, gameState.data < target.cost);
            await select(slot);
            check('button reads INSUFFICIENT DATA', ui().texts.includes(t('takeover', 'insufficient')), ui().texts);
            const dataBefore = gameState.data;
            await AZT.clickText(_exact(t('takeover', 'insufficient')), _inPopup());
            await wait(300);
            check('no breach started', tt().getButtonState() === 'idle', tt().getButtonState());
            check('no DATA spent', gameState.data === dataBefore);
            check('status explains denial', statusText() === t('takeover', 'status_denied'), statusText());
            check('close', await close() === 'closed');
        },

        /** First-time flow: two sandbox cards, the quick one recommended, then three real targets. */
        async tutorial(check) {
            check('precondition: tutorial state (load("tutorial"))', tt().isTutorial());
            await _ensureOpen(check);
            check('tip in status line', statusText() === t('takeover', 'status_tutorial'), statusText());
            check('quick target recommended', ui().texts.includes(t('takeover', 'recommended')), ui().texts);
            check('empty third slot', ui().texts.includes(t('takeover', 'offline')), ui().texts);
            check('initiate → hacking', await initiate() === 'hacking', ui().texts);
            check('4-second breach completes on its own', await until(() => view() === 'success', 6000) && true, ui().texts);
            await wait(300);
            check('claim → detail', await claim() === 'detail');
            check('tutorial over, three targets', !tt().isTutorial() && tt().getTargets().every(Boolean), status().targets);
            check('close', await close() === 'closed');
        },
    };

    /** Run a named flow. 'all' = breach on each reward type (fixed cards) + abort + select. */
    async function flow(name, opts = {}) {
        if (name === 'all') {
            const results = [];
            for (let slot = 0; slot < 3; slot++) {
                setTargets(STANDARD_TARGETS());
                results.push(await _run(`breach slot ${slot} (${STANDARD_TARGETS()[slot].rewardType})`, (c) => FLOWS.breach(c, { slot })));
            }
            setTargets(STANDARD_TARGETS());
            results.push(await _run('abort', (c) => FLOWS.abort(c, { slot: 1 })));
            results.push(await _run('select', (c) => FLOWS.select(c)));
            return { passed: results.every(r => r.passed), results: results.map(r => r.passed ? { flow: r.flow, passed: true, steps: r.steps.length } : r) };
        }
        if (!FLOWS[name]) throw new Error(`unknown flow '${name}'. Available: all, ${Object.keys(FLOWS).join(', ')}`);
        return _run(name, (c) => FLOWS[name](c, opts));
    }

    AZT.takeover = {
        load, scenarios: Object.keys(SCENARIOS),
        status, setTargets, makeTarget, standardTargets: STANDARD_TARGETS, extremeTargets: EXTREME_TARGETS,
        start, fastForward, finishIn, completeNow, refreshPopup, until,
        ui, openViaButton, open, close, select, initiate, abort, claim, checkLayout,
        flow, flows: ['all', ...Object.keys(FLOWS)],
    };
})();
