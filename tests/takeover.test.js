// Logic tests for the Financial Breach / Takeover system (js/takeoverTargets.js).
// Runs the real module in a Node sandbox with a fake clock and seeded randomness.
// Run: npm test   (or: node --test tests/takeover.test.js)

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { createSandbox } = require('../tools/gameSandbox');

const SEC = 1000;

/** Fresh sandbox with the takeover module loaded and initialised. */
function setup(opts = {}) {
    const sb = createSandbox({ resources: { data: 10_000 }, ...opts }).load('js/takeoverTargets.js');
    const tt = sb.get('takeoverTargets');
    tt.init();
    return { sb, tt };
}

/** Sandbox already past the tutorial (3 random targets). */
function setupPostTutorial(opts = {}) {
    const ctx = setup({
        ...opts,
        gameState: { takeoverState: { targets: [null, null, null], hasCompletedFirstTutorial: true, ...(opts.takeoverState || {}) } },
    });
    ctx.tt.getTargets(); // rolls 3 fresh targets
    return ctx;
}

/** Run a full attack on slot `i` to completion and collect it. */
function runAttack(sb, tt, i) {
    assert.equal(tt.startAttack(i), true, `startAttack(${i}) should succeed`);
    sb.clock.advance(Math.ceil(tt.getActiveAttack().duration)); // real Date.now() is integer ms
    assert.equal(tt.checkCompletion(), true);
    return tt.collectReward();
}

// ── Tutorial ────────────────────────────────────────────────────────────────

describe('first-time tutorial', () => {
    it('offers exactly two fixed low-risk targets and an empty third slot', () => {
        const { tt } = setup();
        const [a, b, c] = tt.getTargets();
        assert.deepEqual(
            { cost: a.cost, duration: a.duration, rewardType: a.rewardType, rewardAmount: a.rewardAmount, security: a.security },
            { cost: 10, duration: 4, rewardType: 'data', rewardAmount: 15, security: 'LOW' },
        );
        assert.deepEqual(
            { cost: b.cost, duration: b.duration, rewardType: b.rewardType, rewardAmount: b.rewardAmount },
            { cost: 25, duration: 45, rewardType: 'coin', rewardAmount: 15 },
        );
        assert.notEqual(a.name, b.name);
        assert.equal(c, null);
    });

    it('persists tutorial targets so a reload shows the same cards', () => {
        const { sb, tt } = setup();
        const first = tt.getTargets().map(t => t && t.name);
        assert.deepEqual(sb.gameState.takeoverState.targets.map(t => t && t.name), first);
        assert.equal(sb.gameState.takeoverState.hasCompletedFirstTutorial, false);
    });

    it('ends after the first collected reward and switches to three random targets', () => {
        const { sb, tt } = setup();
        tt.getTargets();
        runAttack(sb, tt, 0);
        const next = tt.getTargets();
        assert.equal(next.length, 3);
        assert.ok(next.every(Boolean), 'all three slots filled');
        assert.equal(sb.gameState.takeoverState.hasCompletedFirstTutorial, true);
    });

    it('also ends when the tutorial attack is aborted', () => {
        const { sb, tt } = setup();
        tt.getTargets();
        tt.startAttack(1);
        tt.cancelAttack();
        assert.ok(tt.getTargets().every(Boolean));
        assert.equal(sb.gameState.takeoverState.hasCompletedFirstTutorial, true);
    });

    it('treats legacy saves without the tutorial flag but with 3 targets as post-tutorial', () => {
        const legacy = { targets: [
            { name: 'A', security: 'LOW', flavor: '', cost: 30, duration: 50, rewardType: 'coin', rewardAmount: 10 },
            { name: 'B', security: 'LOW', flavor: '', cost: 30, duration: 50, rewardType: 'coin', rewardAmount: 10 },
            { name: 'C', security: 'LOW', flavor: '', cost: 30, duration: 50, rewardType: 'coin', rewardAmount: 10 },
        ] };
        const { sb, tt } = setup({ gameState: { takeoverState: legacy } });
        runAttack(sb, tt, 0);
        assert.equal(sb.gameState.takeoverState.hasCompletedFirstTutorial, true);
        assert.ok(tt.getTargets().every(Boolean), 'rerolled to 3 targets, not the tutorial pair');
    });
});

// ── Attack lifecycle ────────────────────────────────────────────────────────

describe('attack lifecycle', () => {
    it('deducts the DATA cost and moves idle → attacking → reward_pending', () => {
        const { sb, tt } = setup();
        const target = tt.getTargets()[0];
        assert.equal(tt.getButtonState(), 'idle');
        assert.equal(tt.startAttack(0), true);
        assert.equal(sb.resources.data, 10_000 - target.cost);
        assert.equal(tt.getButtonState(), 'attacking');
        assert.equal(tt.isAttacking(), true);

        sb.clock.advance(target.duration * SEC - 1);
        assert.equal(tt.checkCompletion(), false, 'not done 1ms early');
        sb.clock.advance(1);
        assert.equal(tt.checkCompletion(), true);
        assert.equal(tt.getButtonState(), 'reward_pending');
        assert.equal(tt.isAttacking(), false);
        assert.equal(tt.checkCompletion(), false, 'completion only reported once');
    });

    it('reports progress and remaining seconds from the wall clock', () => {
        const { sb, tt } = setup();
        tt.getTargets();
        assert.equal(tt.getProgress(), -1);
        assert.equal(tt.getRemainingSeconds(), -1);
        tt.startAttack(1); // 45s tutorial coin target
        assert.equal(tt.getProgress(), 0);
        assert.equal(tt.getRemainingSeconds(), 45);
        sb.clock.advance(15 * SEC);
        assert.ok(Math.abs(tt.getProgress() - 1 / 3) < 1e-9);
        assert.equal(tt.getRemainingSeconds(), 30);
        sb.clock.advance(60 * SEC);
        assert.equal(tt.getProgress(), 1, 'clamped at 1');
        assert.equal(tt.getRemainingSeconds(), 0);
    });

    it('applies the hacking speed multiplier to the duration', () => {
        const { tt } = setup({ hackingSpeed: 1.5 });
        tt.getTargets();
        tt.startAttack(1); // 45s base
        assert.equal(tt.getActiveAttack().duration, 30 * SEC);
    });

    it('refuses to start when unaffordable, already busy, or the slot is empty', () => {
        const poor = setup({ resources: { data: 5 } });
        poor.tt.getTargets();
        assert.equal(poor.tt.startAttack(0), false, 'cost 10 > 5 DATA');
        assert.equal(poor.sb.resources.data, 5, 'nothing deducted');

        const { sb, tt } = setup();
        tt.getTargets();
        assert.equal(tt.startAttack(2), false, 'tutorial slot 3 is empty');
        assert.equal(tt.startAttack(0), true);
        assert.equal(tt.startAttack(1), false, 'already attacking');
        sb.clock.advance(4 * SEC);
        tt.checkCompletion();
        assert.equal(tt.startAttack(1), false, 'reward still pending');
    });

    it('grants the pending reward of each type exactly once', () => {
        for (const [rewardType, field] of [['coin', 'coin'], ['data', 'data'], ['insight', 'insight']]) {
            const target = { name: 'X', security: 'LOW', flavor: '', cost: 10, duration: 5, rewardType, rewardAmount: 7 };
            const { sb, tt } = setup({ gameState: { takeoverState: { targets: [target, null, null], hasCompletedFirstTutorial: true } } });
            const before = sb.resources[field];
            const reward = runAttack(sb, tt, 0);
            assert.deepEqual({ ...reward }, { rewardType, rewardAmount: 7, targetName: 'X' }); // spread: sandbox objects have a foreign prototype
            const spent = rewardType === 'data' ? 10 : 0;
            assert.equal(sb.resources[field], before + 7 - spent, `${rewardType} credited`);
            assert.equal(tt.collectReward(), null, 'second collect is a no-op');
            assert.equal(tt.getButtonState(), 'idle');
        }
    });

    it('aborting refunds floor(75%) of the cost and rerolls targets', () => {
        const target = { name: 'X', security: 'MEDIUM', flavor: '', cost: 115, duration: 90, rewardType: 'coin', rewardAmount: 20 };
        const { sb, tt } = setup({ gameState: { takeoverState: { targets: [target, null, null], hasCompletedFirstTutorial: true } } });
        tt.startAttack(0);
        assert.equal(sb.resources.data, 10_000 - 115);
        assert.equal(tt.cancelAttack(), true);
        assert.equal(sb.resources.data, 10_000 - 115 + 86); // floor(86.25)
        assert.equal(tt.getButtonState(), 'idle');
        assert.ok(tt.getTargets().every(Boolean), 'rerolled to 3 targets');
        const ev = sb.published.find(p => p.topic === 'takeoverAborted');
        assert.deepEqual({ ...ev.args[0] }, { targetName: 'X', refund: 86 });
        assert.equal(tt.cancelAttack(), false, 'nothing left to cancel');
    });

    it('saves the game at every state transition', () => {
        const { sb, tt } = setup();
        tt.getTargets();
        const n0 = sb.saves.length;
        tt.startAttack(0);
        assert.equal(sb.saves.length, n0 + 1, 'save on start');
        sb.clock.advance(4 * SEC);
        tt.checkCompletion();
        assert.equal(sb.saves.length, n0 + 2, 'save on completion');
        tt.collectReward();
        assert.equal(sb.saves.length, n0 + 3, 'save on collect');
    });
});

// ── Persistence ─────────────────────────────────────────────────────────────

describe('persistence', () => {
    it('restores an in-progress attack after reload', () => {
        const a = setup();
        a.tt.getTargets();
        a.tt.startAttack(1);
        a.sb.clock.advance(10 * SEC);
        const saved = a.sb.saves.at(-1);

        const b = setup({ gameState: saved, now: a.sb.clock.now });
        assert.equal(b.tt.getButtonState(), 'attacking');
        assert.equal(b.tt.getRemainingSeconds(), 35);
        assert.equal(b.tt.getActiveAttack().target.name, a.tt.getActiveAttack().target.name);
    });

    it('completes attacks that finished while the game was closed', () => {
        const a = setup();
        a.tt.getTargets();
        a.tt.startAttack(1);
        const saved = a.sb.saves.at(-1);

        const b = setup({ gameState: saved, now: a.sb.clock.now + 2 * 60 * 60 * SEC }); // 2h later
        assert.equal(b.tt.getButtonState(), 'reward_pending', 'completed during init');
        assert.equal(b.tt.getPendingReward().rewardType, 'coin');
    });

    it('round-trips generator state (insight cooldown, last-picked-data)', () => {
        const a = setupPostTutorial({ takeoverState: { insightCooldown: 2, lastPickedWasData: true } });
        a.tt.startAttack(0);
        const saved = a.sb.saves.at(-1).takeoverState;
        assert.equal(typeof saved.insightCooldown, 'number');
        assert.equal(typeof saved.lastPickedWasData, 'boolean');
    });
});

// ── Target generation rules ─────────────────────────────────────────────────

describe('target generation', () => {
    const RANGES = {
        LOW: { cost: [25, 75], dur: [45, 60], mult: 1 },
        MEDIUM: { cost: [75, 200], dur: [60, 120], mult: 2.5 },
        HIGH: { cost: [200, 500], dur: [60, 270], mult: 5 },
    };
    const BASE_COIN = [5, 15];
    const DATA_ROI = { LOW: [1.2, 1.4], MEDIUM: [1.35, 1.55], HIGH: [1.5, 1.7] };
    const roundTo5 = (n) => Math.round(n / 5) * 5;

    function rollMany(n, seed = 7) {
        const { tt } = setupPostTutorial({ seed });
        const rolls = [];
        for (let i = 0; i < n; i++) rolls.push(tt.rollTargets().map(t => ({ ...t })));
        return rolls;
    }

    it('always produces 3 targets with unique corporation names', () => {
        for (const roll of rollMany(2000)) {
            assert.equal(roll.length, 3);
            assert.equal(new Set(roll.map(t => t.name)).size, 3);
        }
    });

    it('keeps cost, duration and payout inside the configured ranges', () => {
        for (const roll of rollMany(2000)) {
            for (const t of roll) {
                const r = RANGES[t.security];
                assert.ok(r, `known security ${t.security}`);
                assert.ok(t.duration >= r.dur[0] && t.duration <= r.dur[1], `duration ${t.duration} in ${t.security}`);
                assert.equal(t.cost % 5, 0, 'cost rounded to 5');
                if (t.rewardType === 'insight') {
                    assert.equal(t.rewardAmount, 1);
                    assert.ok(t.cost >= 200 && t.cost <= 300, `insight cost ${t.cost}`);
                } else if (t.rewardType === 'data') {
                    assert.ok(t.cost >= r.cost[0] && t.cost <= r.cost[1], `cost ${t.cost} in ${t.security}`);
                    const [lo, hi] = DATA_ROI[t.security];
                    assert.ok(t.rewardAmount >= roundTo5(t.cost * lo) && t.rewardAmount <= roundTo5(t.cost * hi),
                        `data payout ${t.rewardAmount} for cost ${t.cost} in ${t.security}`);
                    assert.equal(t.rewardAmount % 5, 0, 'data payout rounded to 5');
                } else {
                    assert.ok(t.cost >= r.cost[0] && t.cost <= r.cost[1], `cost ${t.cost} in ${t.security}`);
                    assert.ok(t.rewardAmount >= Math.round(BASE_COIN[0] * r.mult) && t.rewardAmount <= Math.round(BASE_COIN[1] * r.mult),
                        `coin payout ${t.rewardAmount} in ${t.security}`);
                }
                assert.ok(t.flavor && t.flavor.length > 0, 'has flavor text');
            }
        }
    });

    it('offers at most one INSIGHT target per roll, then blocks INSIGHT for the next 2 rolls', () => {
        const rolls = rollMany(3000);
        let sawInsight = false;
        rolls.forEach((roll, i) => {
            const count = roll.filter(t => t.rewardType === 'insight').length;
            assert.ok(count <= 1, `roll ${i} has ${count} insight targets`);
            if (count === 1) {
                sawInsight = true;
                for (let k = 1; k <= 2 && i + k < rolls.length; k++) {
                    assert.ok(!rolls[i + k].some(t => t.rewardType === 'insight'), `insight again ${k} roll(s) after roll ${i}`);
                }
            }
        });
        assert.ok(sawInsight, 'insight targets appear at all');
    });

    it('hides DATA targets right after the player attacked a DATA target', () => {
        const { sb, tt } = setupPostTutorial({ seed: 3, resources: { data: 1e9 } });
        let checked = 0;
        for (let i = 0; i < 400; i++) {
            const targets = tt.getTargets();
            const dataIdx = targets.findIndex(t => t.rewardType === 'data');
            const idx = dataIdx >= 0 ? dataIdx : 0;
            const pickedData = targets[idx].rewardType === 'data';
            runAttack(sb, tt, idx);
            if (pickedData) {
                checked++;
                assert.ok(!tt.getTargets().some(t => t.rewardType === 'data'), 'no DATA targets after a DATA attack');
            }
        }
        assert.ok(checked > 20, `exercised the rule (${checked} times)`);
    });

    it('makes every DATA breach pay back more than it costs, with higher security paying more', () => {
        const data = rollMany(4000, 5).flat().filter(t => t.rewardType === 'data');
        assert.ok(data.length > 500);
        for (const t of data) assert.ok(t.rewardAmount > t.cost, `${t.security} DATA breach: pays ${t.rewardAmount} for ${t.cost}`);
        const roi = (sec) => {
            const ts = data.filter(t => t.security === sec);
            return ts.reduce((a, t) => a + t.rewardAmount / t.cost, 0) / ts.length;
        };
        assert.ok(roi('LOW') < roi('MEDIUM') && roi('MEDIUM') < roi('HIGH'), `ROI rises with security: ${roi('LOW')}, ${roi('MEDIUM')}, ${roi('HIGH')}`);
    });

    it('roughly matches the documented security and reward weights', () => {
        const rolls = rollMany(5000, 11).flat();
        const share = (pred) => rolls.filter(pred).length / rolls.length;
        assert.ok(Math.abs(share(t => t.security === 'LOW') - 0.50) < 0.03);
        assert.ok(Math.abs(share(t => t.security === 'MEDIUM') - 0.35) < 0.03);
        assert.ok(Math.abs(share(t => t.security === 'HIGH') - 0.15) < 0.03);
        assert.ok(share(t => t.rewardType === 'coin') > share(t => t.rewardType === 'data'), 'COIN more common than DATA');
    });
});

// ── UI helpers and events ───────────────────────────────────────────────────

describe('derived values and events', () => {
    it('reports the effective duration after hacking-speed upgrades', () => {
        const { tt } = setup({ hackingSpeed: 1.5 });
        assert.equal(tt.getHackingSpeed(), 1.5);
        assert.equal(tt.getEffectiveDuration({ duration: 90 }), 60);
    });

    it('maps security to firewall layers', () => {
        const { tt } = setup();
        assert.deepEqual(['LOW', 'MEDIUM', 'HIGH', 'BOGUS'].map(tt.getFirewallLayers), [3, 4, 5, 3]);
    });

    it('exposes the refund for the running breach', () => {
        const target = { name: 'X', security: 'MEDIUM', flavor: '', cost: 115, duration: 90, rewardType: 'coin', rewardAmount: 20 };
        const { tt } = setup({ gameState: { takeoverState: { targets: [target, null, null], hasCompletedFirstTutorial: true } } });
        assert.equal(tt.getRefundAmount(), 0);
        tt.startAttack(0);
        assert.equal(tt.getRefundAmount(), 86);
    });

    it('tracks tutorial mode and lifetime breaches, persisting the count', () => {
        const { sb, tt } = setup();
        tt.getTargets();
        assert.equal(tt.isTutorial(), true);
        runAttack(sb, tt, 0);
        assert.equal(tt.isTutorial(), false);
        runAttack(sb, tt, 0);
        assert.equal(tt.getTotalBreaches(), 2);
        assert.equal(sb.gameState.takeoverState.totalBreaches, 2);

        const reloaded = setup({ gameState: sb.saves.at(-1), now: sb.clock.now });
        assert.equal(reloaded.tt.getTotalBreaches(), 2);
    });

    it('publishes started → completed → claimed for a breach, and aborted on cancel', () => {
        const { sb, tt } = setup();
        tt.getTargets();
        runAttack(sb, tt, 0);
        tt.startAttack(0);
        tt.cancelAttack();
        const topics = sb.published.map(p => p.topic).filter(t => t.startsWith('takeover'));
        assert.deepEqual(topics, ['takeoverStarted', 'takeoverCompleted', 'takeoverClaimed', 'takeoverStarted', 'takeoverAborted']);
        const claimed = sb.published.find(p => p.topic === 'takeoverClaimed').args[0];
        assert.equal(claimed.totalBreaches, 1);
        assert.equal(claimed.rewardType, 'data');
    });
});
