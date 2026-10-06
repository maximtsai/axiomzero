# Axiom Zero

Browser-based hybrid incremental / tower-defense game built on Phaser 3. Plain JavaScript, no bundler, no modules.

## Reference docs (read before larger changes)

- `PROJECT_STRUCTURE.md` — globals table, core managers, entity inheritance, game flow
- `docs/ARCH.md` — patterns: messageBus, Button, ObjectPool, 2x2 pixel textures, MVC direction
- `docs/MESSAGES.md` — messageBus topics
- `docs/UPGRADE_TREE_LAYOUT.md` — tree grid layout rules
- `axiom-zero-gdd.md` — game design doc (source of truth for intended mechanics)
- `completed_features.md` — what is actually implemented. `TODO.md` / `tasks.txt` are partly stale; verify in code before trusting them.

## How the code is wired

- **Load order is everything.** Every file is a `<script>` tag in `index.html` and shares one global scope. A new file must be added to `index.html` *after* everything it depends on. Never use `import`/`export`.
- **Top-level `const`/`let`/`class` names are global across files.** Declaring the same name in two files throws at load time. `npm run lint` checks for this.
- Most systems are IIFE singletons: `const fooManager = (() => { ...; return { init, ... }; })();`. Match that shape for new managers.
- Systems talk through `messageBus.publish/subscribe` (`js/util/messageBus.js`). Prefer an event over a direct cross-system call.
- Phases: `gameStateMachine.goTo(GAME_CONSTANTS.PHASE_*)`, but UI-driven phase changes go through `transitionManager.transitionTo(...)` so the camera slide and click blocker run.
- `js/util/` holds generic, project-agnostic helpers; game-specific code goes in `js/`. Util files are loaded individually — there is no `utilities.js` bundle anymore (the old `/build` command is obsolete).
- Constants: `GAME_CONSTANTS` / `GAME_VARS` in `js/util/globals.js`, extended in `js/gameConfig.js`. Per-level tuning lives in `js/levelConfig.js`.
- `debugLog(...)` only prints when `FLAGS.DEBUG` is true (`flags.js`).

## Data definitions

- Upgrade tree nodes: `NODE_DEFS` in `js/nodeDefs.js` (`id`, `parents`, `childIds`, `maxLevel`, `baseCost`, `costType`, `costScaling`, `treeX/treeY` via `gridX()/gridY()`, `effect`). Effects route through `upgradeDispatcher.js`. `js/upgradeManager.js` is a dead stub.
- Duo-box (choice) nodes: `js/duoNode.js`; state in `gameState.activeShards` / `duoBoxPurchased`.
- Enemies: `js/enemies/*.js` extend `Enemy` (`enemy.js`), `Miniboss`, or `Boss`; register in `enemyManager.js` and `index.html`.
- Takeover / Financial Breach: `takeoverTargets.js` (logic, state in `gameState.takeoverState`, publishes `takeover*` messageBus events), `takeoverPopup.js` (split-console terminal) + `infiltrationUI.js` (helpers). Unlocked by the `financial_breach` node. Tests: `tests/takeover.test.js`; balance: `node tools/takeover-sim.js`; in-game: the `test-takeover` skill.
- Terminal visuals are baked, not drawn: `mockups/infiltration-terminal.html` is the source of truth → `npm run export-terminal-assets` writes `raw/infiltration/*.png` (+ `raw/infiltration_layout.json` with exact positions) → republish `raw/infiltration.tps` in TexturePacker (trim off) → `takeoverPopup.js` places the frames at the mock's coordinates. Every colour variant is its own frame (no runtime tint, canvas-safe). To change the look, edit the mock and re-export rather than drawing in Phaser.
- Lore: `loreDefs.js`, `lore.txt`, `maxed_node_lore.txt`.

## Conventions

- **All player-facing text goes through localization:** add keys to `js/localization/en.js` and read them with `t('namespace', 'key')`. Don't hardcode UI strings.
- Clickables use `new Button({...})` (`js/util/button.js`); don't hand-roll interactive sprites. Give every interaction tint/scale + audio feedback.
- Short-lived entities (projectiles, drops, floating text, effects) use `ObjectPool`. Assume 600+ drops / 100+ enemies on screen.
- `white_pixel` / `black_pixel` are 2x2 textures: `setScale(targetPx / 2)`.
- Audio: register in `assets/audioFiles.js`, play with `audio.play('key', vol)` / `audio.playMusic('key')`.
- Persistent state lives on `gameState` (`js/util/gameState.js`), defaults + `SAVE_KEY`/`SAVE_VERSION` in `js/gameConfig.js`. New saved fields need a default in `GAME_STATE_DEFAULTS`; breaking changes need a `migrateProjectState` step.
- Style: 4-space indent, single quotes, `// ── Section ──` divider comments, JSDoc `@fileoverview` headers on files.

## Commands

- Run the game: preview server "Game Server (port 8124)" in `.claude/launch.json` (serves the repo root at http://localhost:8124).
- Lint: `npm run lint` (ESLint over every script in `index.html`, plus a cross-file duplicate-global check). Run `npm install` once first.
- Tests: `npm test` (Node's built-in runner over `tests/**/*.test.js`). `tools/gameSandbox.js` loads a game script into a vm context with a fake clock, seeded RNG and stubbed managers, so pure-logic modules can be tested without Phaser.
- Takeover balance: `npm run takeover-sim`.
- Production build: `node build_prod.js` → `dist/` (concatenates every local script tag in `index.html` except the `SKIP_BUNDLE` list).
- `mockups/` holds standalone HTML design mocks (not shipped). Open them via the preview server, e.g. http://localhost:8124/mockups/infiltration-terminal.html.

## Verifying changes

Use the `playtest` skill (`.claude/skills/playtest/`) to load a known save state and jump straight to the phase or popup you changed, then screenshot it. For the takeover terminal use the `test-takeover` skill (scenarios + end-to-end flows). Don't stop at reading the code for visible changes.
