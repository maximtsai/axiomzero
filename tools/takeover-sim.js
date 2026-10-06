// Takeover / Financial Breach balance simulator.
// Runs the real js/takeoverTargets.js in a Node sandbox and reports what the
// generator actually produces, plus how a player would fare with a few simple
// target-picking strategies.
//
// Usage:
//   node tools/takeover-sim.js                      # 20k rolls, seed 1
//   node tools/takeover-sim.js --rolls 50000 --seed 7 --speed 1.5 --attacks 200
//   node tools/takeover-sim.js --json               # machine-readable output
//
// --speed   hacking speed multiplier (1.5 = Shell Contracts owned)
// --attacks attacks per strategy in the session simulation

const { createSandbox } = require('./gameSandbox');

const args = process.argv.slice(2);
const arg = (name, def) => {
    const i = args.indexOf('--' + name);
    return i >= 0 ? Number(args[i + 1]) : def;
};
const ROLLS = arg('rolls', 20000);
const SEED = arg('seed', 1);
const SPEED = arg('speed', 1);
const ATTACKS = arg('attacks', 100);
const JSON_OUT = args.includes('--json');

function newModule(seed, extra = {}) {
    const sb = createSandbox({
        seed,
        hackingSpeed: SPEED,
        resources: { data: 1e12 },
        gameState: { takeoverState: { targets: [null, null, null], hasCompletedFirstTutorial: true } },
        ...extra,
    }).load('js/takeoverTargets.js');
    const tt = sb.get('takeoverTargets');
    tt.init();
    return { sb, tt };
}

// ── 1. Generator output ────────────────────────────────────────────────────
// Note: consecutive rolls without attacking keep DATA targets available, so this
// slightly over-represents DATA vs. real play (see the session sim for that).

const { tt: gen } = newModule(SEED);
const all = [];
for (let i = 0; i < ROLLS; i++) all.push(...gen.rollTargets().map(t => ({ ...t })));

const groups = {};
for (const t of all) {
    const key = `${t.security}/${t.rewardType}`;
    (groups[key] ||= []).push(t);
}

const avg = (xs, f) => xs.reduce((s, x) => s + f(x), 0) / xs.length;
const genRows = Object.entries(groups)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, ts]) => {
        const durMin = avg(ts, t => t.duration) / 60 / SPEED;
        const payout = avg(ts, t => t.rewardAmount);
        const cost = avg(ts, t => t.cost);
        return {
            group: key,
            share: ts.length / all.length,
            avgCost: cost,
            avgMinutes: durMin,
            avgPayout: payout,
            payoutPerDataSpent: payout / cost,
            payoutPerMinute: payout / durMin,
        };
    });

// ── 2. Session simulation by strategy ──────────────────────────────────────

const STRATEGIES = {
    // Always attack the first card.
    first: (targets) => 0,
    // Cheapest DATA cost.
    cheapest: (targets) => targets.reduce((bi, t, i) => (t.cost < targets[bi].cost ? i : bi), 0),
    // Fastest to finish.
    fastest: (targets) => targets.reduce((bi, t, i) => (t.duration < targets[bi].duration ? i : bi), 0),
    // Prefer INSIGHT, then COIN with the best payout/minute.
    greedyCoin: (targets) => {
        const ins = targets.findIndex(t => t.rewardType === 'insight');
        if (ins >= 0) return ins;
        const score = (t) => (t.rewardType === 'coin' ? t.rewardAmount / t.duration : -1);
        return targets.reduce((bi, t, i) => (score(t) > score(targets[bi]) ? i : bi), 0);
    },
};

const sessionRows = Object.entries(STRATEGIES).map(([name, pick]) => {
    const { sb, tt } = newModule(SEED);
    const startData = sb.resources.data;
    let minutes = 0;
    const picked = { coin: 0, data: 0, insight: 0 };
    for (let i = 0; i < ATTACKS; i++) {
        const targets = tt.getTargets();
        const idx = pick(targets);
        if (!tt.startAttack(idx)) throw new Error(`strategy ${name}: startAttack(${idx}) failed`);
        const ms = Math.ceil(tt.getActiveAttack().duration); // real Date.now() is integer ms
        minutes += ms / 60000;
        sb.clock.advance(ms);
        tt.checkCompletion();
        picked[tt.collectReward().rewardType]++;
    }
    const netData = sb.resources.data - startData;
    return {
        strategy: name,
        attacks: ATTACKS,
        hours: minutes / 60,
        netData,
        coin: sb.resources.coin / 100,           // displayed units
        insight: sb.resources.insight,
        coinPerHour: sb.resources.coin / 100 / (minutes / 60),
        dataCostPerCoin: sb.resources.coin ? -Math.min(0, netData) / (sb.resources.coin / 100) : null,
        picked,
    };
});

// ── Output ─────────────────────────────────────────────────────────────────

if (JSON_OUT) {
    console.log(JSON.stringify({ rolls: ROLLS, seed: SEED, speed: SPEED, generator: genRows, sessions: sessionRows }, null, 2));
    process.exit(0);
}

const f = (n, d = 1) => (n === null || n === undefined ? '-' : Number(n).toFixed(d));
const pad = (s, n) => String(s).padStart(n);

console.log(`\nTakeover generator — ${ROLLS} rolls (${all.length} targets), seed ${SEED}, speed x${SPEED}\n`);
console.log(['group'.padEnd(15), pad('share', 7), pad('cost', 7), pad('min', 6), pad('payout', 7), pad('pay/DATA', 9), pad('pay/min', 8)].join(' '));
for (const r of genRows) {
    console.log([r.group.padEnd(15), pad(f(r.share * 100) + '%', 7), pad(f(r.avgCost, 0), 7), pad(f(r.avgMinutes), 6),
        pad(f(r.avgPayout), 7), pad(f(r.payoutPerDataSpent, 3), 9), pad(f(r.payoutPerMinute, 2), 8)].join(' '));
}
console.log('\n(coin payouts are internal units: 100 = 1.00 COIN on screen)');

console.log(`\nSession simulation — ${ATTACKS} attacks per strategy\n`);
console.log(['strategy'.padEnd(11), pad('hours', 6), pad('net DATA', 9), pad('COIN', 7), pad('INSIGHT', 8), pad('COIN/h', 7), pad('DATA/COIN', 10), '  picks (coin/data/insight)'].join(' '));
for (const r of sessionRows) {
    console.log([r.strategy.padEnd(11), pad(f(r.hours), 6), pad(r.netData, 9), pad(f(r.coin, 2), 7), pad(r.insight, 8),
        pad(f(r.coinPerHour, 2), 7), pad(f(r.dataCostPerCoin, 0), 10), `  ${r.picked.coin}/${r.picked.data}/${r.picked.insight}`].join(' '));
}
console.log('');
