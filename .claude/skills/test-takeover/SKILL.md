---
name: test-takeover
description: Test the Financial Breach / Takeover (infiltration) mechanic. Covers the logic unit tests, the balance simulator, and in-game scenarios with end-to-end flows through the real terminal UI. Use after changing js/takeoverTargets.js, js/takeoverPopup.js or js/infiltrationUI.js, when tuning takeover economy numbers, or when the user asks to see or verify the takeover/breach terminal.
---

# Testing the takeover mechanic

Three layers, cheapest first. Run the ones that match what changed.

| Changed | Run |
|---|---|
| `takeoverTargets.js` logic, rules, persistence | `npm test` (layer 1) |
| economy numbers (costs, payouts, durations, weights) | `npm test` + `npm run takeover-sim` (layer 2) |
| terminal UI (`takeoverPopup.js`, `infiltrationUI.js`, strings) | layer 3 in the browser, plus layer 1 if logic changed |

## Layer 1: logic tests (Node, ~1 s)

```bash
npm test
```

`tests/takeover.test.js` runs the real `js/takeoverTargets.js` inside `tools/gameSandbox.js`: a vm context with a fake clock (`sb.clock.advance(ms)`), seeded `Math.random`, and stubs for `resourceManager`, `upgradeDispatcher`, `messageBus` and `saveGame`. It covers:
- the tutorial targets
- the attack lifecycle (start, complete, claim, abort/refund)
- persistence and offline completion
- the generation rules (ranges, INSIGHT cooldown, no DATA right after DATA, DATA always profitable)
- the events published on messageBus

When you change a rule, change the test that pins it in the same edit. Objects returned from the sandbox have a foreign prototype, so compare them with `assert.deepEqual({ ...obj }, expected)`.

## Layer 2: balance simulator

```bash
npm run takeover-sim
node tools/takeover-sim.js --rolls 50000 --seed 7 --speed 1.5 --attacks 200 --json
```

Prints what the generator produces, broken down by security level and reward type: share, average cost, minutes, payout, payout per DATA and payout per minute. It also simulates four target-picking strategies over N attacks (COIN per hour, net DATA, picks). `--speed 1.5` models Shell Contracts. Report before/after tables to the user when tuning.

## Layer 3: in-game (browser)

Set up per the `playtest` skill (800x450 viewport, inject `tools/playtest.js`, `await AZT.waitForBoot(30000)`). `AZT.takeover` is loaded automatically.

**Scenarios.** Each writes a save and reloads, so re-inject afterwards:

| `AZT.takeover.load(name, opts)` | state |
|---|---|
| `idle` | 3 fixed targets: LOW/coin, MEDIUM/data, HIGH/insight (`{ targets: [...] }` to override) |
| `tutorial` | never opened: 2 sandbox cards + offline slot, RECOMMENDED tag, tip in status line |
| `attacking` | `{ slot, progress \| remainingSec }` breach running |
| `pending` | `{ slot }` reward ready to claim |
| `offline` | breach started `offlineSec` (1 h) ago, completes during boot (offline progress) |
| `broke` | 0 DATA: red costs, INSUFFICIENT DATA button |
| `extremes` | longest names/flavor, largest numbers (layout stress) |
| `firstBreach` | first-ever reward pending + Dot installed: claim then close to see her reaction |
| `locked` | no `financial_breach`: BREACH button hidden |

**Live controls (no reload):**
- `status()`
- `setTargets([{ rewardType: 'insight', security: 'HIGH' }, ...])`
- `start(i)`
- `fastForward(sec)`
- `finishIn(sec)` (watch completion live)
- `completeNow()`

**UI drivers (real clicks):**
- `openViaButton()` / `open()` / `close()`
- `select(i)`, `initiate()`, `abort()`, `claim()`
- `ui()` → `{ view: 'closed'|'detail'|'hacking'|'success', selected, texts }`
- `checkLayout()` → overlapping / out-of-panel text

**End-to-end flows** return `{ passed, steps: [{ step, ok, detail }] }` and stop at the first failure:

```js
await AZT.takeover.flow('all')          // breach on each reward type + abort + select (needs 'idle'-like state)
await AZT.takeover.flow('breach', { slot: 2 })
await AZT.takeover.flow('resume')       // close/reopen mid-breach, progress keeps counting
await AZT.takeover.flow('unaffordable') // needs DATA < cost: nothing spent, denial shown
await AZT.takeover.flow('tutorial')     // needs load('tutorial')
```

For visual changes, screenshot each view: detail, hacking (use `finishIn`/`fastForward` to reach mid-progress), success. Run `checkLayout()` on the `extremes` scenario in all three views. Finish with `AZT.restore()` and `resize_window` preset `desktop`.

## Design reference

`mockups/infiltration-terminal.html` is a standalone HTML mock of the terminal (no Phaser) with the same rules. It includes ideas not yet in the game (route trace, hold-to-abort, live row countdown). Open it at `http://localhost:8124/mockups/infiltration-terminal.html`; `window.mockState` exposes its state.
