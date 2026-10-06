---
name: playtest
description: Run Axiom Zero in the browser preview, load a known save state (fresh, early, midgame, takeover, maxed or custom), jump to a phase or popup, spawn enemies, click real UI, and screenshot the result. Use after any change that's visible in the game, or when the user asks to see, test or reproduce something in-game.
---

# Playtesting Axiom Zero

The game runs in the built-in browser pane. `tools/playtest.js` is a dev-only helper. It isn't in `index.html`, so it never ships. It's injected at runtime, exposes a global `AZT`, and auto-loads mechanic extensions such as `tools/playtest-takeover.js` → `AZT.takeover` (see the `test-takeover` skill).

## 1. Start the game

- `preview_start` with name `Game Server (port 8124)` (from `.claude/launch.json`).
- `resize_window` to **800x450**. The pane scales larger viewports down, so 800x450 makes the screenshot map 1:1 onto the canvas and keeps text legible. (`zoom` isn't supported in the pane.) Reset with preset `desktop` when you're done.

## 2. Inject the helper

Run this with `javascript_tool` after **every** page load. The DOMContentLoaded guard covers calls made right after a reload, before `<head>` exists:

```js
await new Promise(r => { const go = () => { const s = document.createElement('script'); s.src = '/tools/playtest.js?' + Date.now(); s.onload = r; document.head.appendChild(s); }; document.head ? go() : document.addEventListener('DOMContentLoaded', go); });
await AZT.waitForBoot(30000)   // also waits for extensions (AZT.takeover, ...)
```

**If boot stalls on "Load error, run game anyways?" (or `waitForBoot` times out)**, the game tab was probably not rendering during load: the pane was hidden, or another tab was in front. Both pause `requestAnimationFrame`, and Phaser's loader only advances inside the game loop, so the loading screen's 25 s timeout fires. That's not a code bug. Check `tabs_context`, `tabs_select` the game tab, and reload. To confirm, `PhaserScene.load.totalFailed` should be 0.

## 3. Load a state

`AZT.loadPreset(name, overrides?)` reloads the page. The javascript_tool call reports "the page navigated"; that's expected. Re-inject (step 2) after it.

| preset | what you get |
|---|---|
| `fresh` | no save, AWAKEN-only tree (first-launch flow) |
| `early` | AWAKEN owned, 300 DATA |
| `midgame` | bottom 4 tree rows owned, level 3, lots of every currency |
| `takeover` | `financial_breach` path owned, so the BREACH button is visible (for takeover work, prefer `AZT.takeover.load(...)`) |
| `maxed` | every node at max level, level 5 (late-game visuals and performance) |

For custom states: `AZT.loadSave({ currentLevel: 4, data: 9999, upgrades: AZT.unlockPath(['laser_aperture', 'armor']) })`. This takes a partial `gameState` merged over `GAME_STATE_DEFAULTS`. `AZT.nodes('laser')` finds node ids.

**Save safety:** the first load backs up the existing save to `axiomzero_save__playtest_backup`. Later loads don't overwrite that backup. **Always finish with `AZT.restore()`**, which puts the original save back, removes the backup and reloads.

## 4. Drive it

Game state:
- `AZT.state()`: phase, level, resources, tower HP, enemy count, boss, takeover state
- `await AZT.combat()` / `await AZT.upgrades()`: real phase transition (camera slide included)
- `AZT.spawn('heavy', 5)`: spawn around the tower; type = any `enemyManager` pool key (`basic`, `fast`, `heavy`, `swarmer`, `shooter`, `sniper`, `logic_stray`, `exploder`, `shell`, `protector`, `cache`)
- `AZT.spawnMiniboss('Miniboss2')` / `AZT.spawnBoss()`
- `AZT.god(true)`: tower stays at full HP; `AZT.speed(3)`: game time scale
- `AZT.grant({ data: 5000, shard: 3 })`: live currency through `resourceManager`
- `await AZT.wait(ms)`: let animations and tweens settle

Real input. These dispatch DOM mouse events on the canvas, so clicks go through Phaser input, mouseManager, messageBus and buttonManager exactly like a player's. Coordinates are game space (1600x900):
- `await AZT.clickAt(x, y)` / `await AZT.hoverAt(x, y)`
- `await AZT.clickText('ABORT BREACH')` / `await AZT.clickFrame('close_button_')`: click the topmost visible text or atlas frame (string = substring/prefix, or a RegExp; `{ minDepth }` restricts to a popup layer)
- `AZT.findTexts(match)` / `AZT.findFrames(match)`: positions, sizes and depths of what's on screen
- `AZT.screenTexts(minDepth)`: every visible text, top to bottom. A cheap text "screenshot" for asserting UI state.

For anything else, call the game's globals directly (`gameStateMachine`, `upgradeTree`, `enemyManager`, `tower`, ...). See `PROJECT_STRUCTURE.md`.

## 5. Check and show

- `read_console_messages` with `onlyErrors: true` after every interaction. A single `ERR_CONNECTION_CLOSED` is the external analytics/SDK script tags and can be ignored; anything else is real.
- Prefer real clicks over calling functions directly. The direct calls skip the input path.
- `computer` → `screenshot` for visual changes, and share the final one with the user as proof. If something looks wrong, fix the source, reload, re-inject and re-check.

## Adding an extension for another mechanic

Create `tools/playtest-<mechanic>.js` as an IIFE that attaches `AZT.<mechanic> = {...}` (copy the structure of `tools/playtest-takeover.js`: scenarios that build a save, live controls, UI drivers, flows that return step logs). Add its path to `EXTENSIONS` in `tools/playtest.js`. The ESLint config already treats `tools/playtest*.js` as browser scripts.
