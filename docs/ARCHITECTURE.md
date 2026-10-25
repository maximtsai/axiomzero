# Axiom Zero — Architecture

Technical map of the codebase: load order, globals, boot and phase flow, managers, patterns, and the
runtime rules that keep it working. Companion docs: `docs/MESSAGES.md` (messageBus topics, generated),
`docs/MECHANICS.md` (how the game plays), `docs/UPGRADE_TREE_LAYOUT.md` (tree grid rules), `docs/ASSETS.md`,
`axiom-zero-gdd.md` (concept and visual direction), `BACKLOG.md` (open work). Workflow rules live in `CLAUDE.md`.

## 1. Overview

- Browser hybrid incremental / tower-defense: defend a central tower in timed combat waves, collect
  DATA and other currencies, spend them in a node-based upgrade tree, repeat ("iterations").
- Phaser 3.80.1 (`phaser.min.js`), single scene (`MainScene` in `js/main.js`), 1600x900 logical size, `Phaser.AUTO`
  (WebGL or Canvas; see §7.5).
- **No bundler, no modules.** Every file is a `<script>` in `index.html`; all share one global scope.
  `import`/`export` are never used.
- **Load order is the dependency graph.** A file may only reference, *at load time*, names from files above it.
  References inside functions resolve at call time, so later files are fine there.
- **Top-level `const`/`let`/`class`/`function` names are global.** Two files declaring the same name throw at load
  (`let/const/class`) or silently overwrite (`function/var`). `npm run lint` runs `tools/check-globals.js`
  to catch this, and ESLint's `no-undef` uses the same declaration list (`eslint.config.js`).

## 2. Script load order (`index.html`)

| # | Group | Files | Provides / why here |
|---|---|---|---|
| 1 | Flags | `flags.js` | `FLAGS` (`DEBUG`, `USING_CRAZYGAMES_SDK`, `IS_EXE`, `USE_SERVICE_WORKER`, `ANALYTICS_ENABLED`). Read by almost everything, incl. `debugLog`. |
| 2 | Libraries | `phaser.min.js`, `lz-string.min.js`, `rexbbcodetextplugin.min.js`, CrazyGames SDK (remote, `async`), `sdkManager.js` | `Phaser`, `LZString`, BBCode text plugin, `sdk` wrapper (no-op/localStorage fallback when the SDK flag is off). |
| 3 | Asset manifests | `assets/audioFiles.js`, `imageFiles.js`, `gameAnims.js`, `fontFiles.js` | `audioFiles`, `imageFilesPreload`, `imageAtlases`, `createAnimations()`, `fontFiles`. Data only. |
| 4 | Core config + localization | `js/util/globals.js`, `js/localization/en.js`, `js/translations.js`, `js/gameConfig.js` | `GAME_CONSTANTS`/`GAME_VARS`/`gameOptions`/`globalObjects`/`debugLog` and the localStorage fallback; then `TRANSLATIONS.en` and `t()`; then game constants, `SAVE_KEY`, `GAME_STATE_DEFAULTS`. `t()` must exist before any file that calls it at load (`nodeDefs.js` builds node names with `t()`). |
| 5 | Utilities (`js/util/`) | `loadingManager`, `gameState`, `scoreManager`, `statsTracker`, (`js/levelConfig.js`), `messageBus`, `mouseManager`, `audioManager`, `tweens`, `objectPool`, `button`, `buttonManager`, `typewriterHelper` → `effectPool` → `canvasnineslice` → `uiHelper`, `textEffects`, `timeManager`, `updateManager`, `popupManager`, `floatingText`, `virtualGroup`, `slider`, `debugManager`, `notificationManager`, `analyticsManager`, `cameraManager`, `cinematicManager`, `treeLineManager`, `glitchFX`, `dustParticles` | Generic engine pieces. `messageBus` precedes everything that subscribes in a constructor (`buttonManager`, `timeManager`). `typewriterHelper.js` defines `helper`; `effectPool.js` and `uiHelper.js` extend it with `Object.assign`. `levelConfig.js` sits here only because it needs `gameState` (call time). |
| 6 | Game managers | `js/uibuttons.js`, `milestoneTracker`, `achievementManager`, `gameStateMachine`, `cooldownManager`, `tooltipManager`, `progressBar` | Options/mute UI, phase machine, reusable `Cooldown`/`ProgressBar` classes. |
| 7 | Entities | `js/tower.js`, `js/enemies/enemy.js` → regular enemies → `miniboss.js` → `miniboss_1..4.js` → `boss.js` → `bossSquare`, `bossCircle`, `boss_defender`, `boss_legion`, `boss_4`, `boss_5` | Base classes must precede subclasses (`class X extends Enemy` evaluates at load). |
| 8 | Combat systems | `bossManager`, `spatialGridUtils`, `enemyManager`, `Hijack`, `projectileManager`, `enemyBulletManager`, `resourceManager` | Enemy pools are built from the classes above (in `init()`). |
| 9 | Attacks | `cursorAttack` (`pulseAttack`), `lightningAttack`, `shockwaveAttack`, `laserAttack`, `artilleryAttack`, `combatShield`, `customEmitters`, `scytheAttack`, `swordAttack` | Player weapons (MVC) and named particle effects. |
| 10 | Upgrade logic | `upgradeDispatcher`, `waveManager`, `upgradeManager` (dead stub) | Dispatcher before the tree so node effects can call it. |
| 11 | Tree | `nodeAnims`, `treeNode` (`Node`), `duoNode` (`DuoNode extends Node`), `nodeTooltip`, `secondaryTooltip`, `nodeDefs`, `nodeUtils`, `disabledNodes`, `loreDefs`, `treePopups` | Node classes, then data (`NODE_DEFS`, `DISABLED_NODES`, `LORE_DEFS`), then popups (level select). |
| 12 | Takeover | `takeoverTargets`, `infiltrationUI`, `takeoverPopup` | Logic, then terminal helpers, then the popup that uses both. |
| 13 | Tree UI + HUD | `upgradeTree`, `announcementManager`, `hud/HealthBar`, `hud/CurrencyCluster`, `gameHUD`, `iterationOverScreen`, `transitionManager`, `tutorialManager`, `dialogSystem`, `towerStatsUI` | HUD components before `gameHUD`, which composes them. |
| 14 | Input + boot | `hotkeys`, `gameInit`, `loadingScreen` | `gameInit.js` only subscribes to `assetsLoaded`, so it can sit near the end; `loadingScreen` is used by `MainScene`. |
| 15 | Entry (in `<body>`) | `js/main.js` | Defines `MainScene`, host guard, ad hooks, `new Phaser.Game(config)`. Must be last. An inline script after it calls `finalizeTranslations()` on `window.load` (deep-freezes `TRANSLATIONS`). |

Inline `<script>` blocks in `index.html` also handle the mobile fullscreen gate, a 10 s boot watchdog
(`AXIOM_BOOTSTRAP_COMPLETE`, one auto-retry, then an error panel) and optional service-worker registration (`sw.js`).

## 3. Globals

| Global | Defined in | Purpose |
|---|---|---|
| `FLAGS` | `flags.js` | Build/platform switches. |
| `GAME_CONSTANTS` | `js/util/globals.js`, extended in `js/gameConfig.js` | Dimensions, phases (`PHASE_*`), `EVENTS` topic names, colours, tuning, `DEPTH_*`, transition timing. |
| `GAME_VARS` | `js/util/globals.js` | Mutable runtime: `timeScale`, mouse pos/state, `wasTouch`, `gameManualSlowSpeed`, speed multipliers. |
| `gameOptions`, `saveGameOptions()` | `js/util/globals.js` | Device options (`language`, …) under `OPTIONS_KEY`; loaded by `gameConfig.js` once the key exists. |
| `globalObjects` | `js/util/globals.js` | Shared object registry (e.g. `globalObjects.clickBlocker`). |
| `debugLog()` | `js/util/globals.js` | `console.log` only when `FLAGS.DEBUG`. |
| `t()`, `tRaw()`, `hasTranslation()`, `setLanguage()`, `TRANSLATIONS` | `js/translations.js` (+ `js/localization/en.js`) | Localization; `{0}` placeholders. Language stored under `axiomzero-lang`. |
| `SAVE_KEY`, `OPTIONS_KEY`, `SAVE_VERSION`, `GAME_STATE_DEFAULTS` | `js/gameConfig.js` | Save keys/version and the default save shape. |
| `gameState`, `saveGame()`, `saveSettings()`, `loadGame()`, `clearSave()`, `exportSaveToString()`, `importSaveFromString()` | `js/util/gameState.js` | Persistent state + save engine (§7.4). |
| `LEVEL_CONFIG`, `getCurrentLevelConfig()` | `js/levelConfig.js` | Per-level spawn weights/intervals/multipliers. |
| `messageBus` | `js/util/messageBus.js` | Pub/sub. |
| `audio` | `js/util/audioManager.js` | SFX/music; `audio.play(key, vol)`, `audio.playMusic(key)`, boss music transitions. |
| `updateManager` | `js/util/updateManager.js` | Per-frame callbacks (`addFunction`/`removeFunction`), delta pre-scaled by `GAME_VARS.timeScale`; skipped entirely when `timeScale < 0.01`. |
| `timeManager` | `js/util/timeManager.js` | Time scale, slow-mo requests, pause freeze (§7.1–7.2). |
| `helper` | `js/util/typewriterHelper.js` + `effectPool.js` + `uiHelper.js` | Typewriter text, click-effect pool, click blockers, canvas-safe wrappers, formatting. |
| `Button`, `NORMAL/HOVER/PRESS/DISABLE` | `js/util/button.js` | Standard clickable. |
| `buttonManager` | `js/util/buttonManager.js` | Routes pointer events to Buttons. |
| `ObjectPool` | `js/util/objectPool.js` | Generic pool. |
| `PhaserScene`, `isCanvas` | `js/main.js` (`MainScene.create`) | The one scene; `true` when the Canvas renderer is active. Undefined until `create()`: never touch at load time. |
| `cameraManager` | `js/util/cameraManager.js` | Camera slide/shake/flash, tree cameras. |
| `sdk` | `sdkManager.js` | CrazyGames SDK wrapper (storage, ads, gameplay start/stop). |
| `pauseGameForAd` / `resumeGameFromAd` | `js/main.js` (`window.*`) | Ad-break hooks: pause scene + audio. |
| `Node` | `js/treeNode.js` | Tree node class. Note: shadows the DOM `Node` global. |

## 4. Boot and game flow

**Boot** (`js/main.js`, `js/loadingScreen.js`, `js/gameInit.js`):
1. `isAllowedRuntimeHost()` (localhost, CrazyGames, itch, maximtsai.com) → optional `sdkInit()` → `new Phaser.Game(config)`.
2. `MainScene.preload` → `loadingScreen.preload`: loads `imageFilesPreload` (pixels, loading bg).
3. `MainScene.create`: clears the boot watchdog, sets `window.PhaserScene`/`isCanvas`, `helper.initClickEffectPool`,
   `setupMouseInteraction` (pointer → `pointerDown/Move/Up` topics + `GAME_VARS`), `initDebug`, then
   `loadingScreen.create` queues atlases, bitmap fonts and **music only**; `loadingManager` handles retry/stall
   (slow warning at 15 s, RUN ANYWAYS at 25 s). Non-music SFX are loaded in the background by `audio.init()` →
   `audio.startBackgroundLoading()`.
4. Load complete → `messageBus.publish('assetsLoaded')`.
5. `gameInit.js` (`subscribeOnce('assetsLoaded')`): CrazyGames cloud pre-fetch (§7.4) → `initGameState()` →
   `restoreDynamicNodes()` → `audio.init` → `createAnimations` → `floatingText` → `tower`, `enemyManager`,
   `customEmitters`, `projectileManager`, `enemyBulletManager`, `resourceManager`, `hijackManager` → `waveManager` →
   `upgradeManager` (stub) → `upgradeTree` (creates the tree cameras) → `takeoverTargets`, `announcementManager`,
   `gameHUD`, `iterationOverScreen`, `tutorialManager`, `dialogSystem`, `notificationManager`, `hotkeys` →
   `cameraManager`, `transitionManager` → `tooltipManager`, `scoreManager`, `milestoneTracker`, `achievementManager`,
   `glitchFX`, `dustParticles` → weapons (`pulseAttack` etc., unlocked from `gameState.upgrades` / `activeShards`) →
   `upgradeDispatcher.recalcEverything()` → `createOptionsButton` → `tower.spawn()` → camera to upgrade view →
   `gameStateMachine.goTo(PHASE_UPGRADE)`.
6. Per frame: `MainScene.update` → `updateManager.update(delta)` and `buttonManager.update(delta)` (hover).

**Phases** (`js/gameStateMachine.js`): `goTo(phase, data)` publishes `phaseChanged(phase, data)`; entering
`WAVE_COMPLETE` also publishes `waveComplete(data)`. Systems react to `phaseChanged`; nothing polls.

| Phase | Entered from | What shows |
|---|---|---|
| `UPGRADE_PHASE` | boot; UPGRADES on the results screen (via `transitionManager`) | Tree panel on the left, tower on the right (camera `scrollX = -halfWidth/2`; full-tree view `-WIDTH*0.75`). HUD currencies, deploy / level select / BREACH buttons. |
| `COMBAT_PHASE` | DEPLOY (`upgradeTree.js`) or level select (`treePopups.js`) via `transitionManager`; RETRY (`iterationOverScreen.js`, direct `goTo`, no slide) | Tower centred (`scrollX = 0`), waves, weapons, drops, END WAVE button. |
| `WAVE_COMPLETE` | `waveManager`: tower death sequence, boss kill (`{ bossKill: true }`), or END WAVE (`endIterationRequested`) | `iterationOverScreen` results ("ITERATION COMPLETE", EXP bar) with UPGRADES / RETRY. |
| `GAME_OVER` | never entered | Constant and listeners remain (`milestoneTracker`, `resourceManager`, `gameInit`); tower death goes to `WAVE_COMPLETE`. |

**Transitions** (`js/transitionManager.js`): UI-driven phase changes call `transitionManager.transitionTo(phase)`, which
shows the global click blocker, calls `gameStateMachine.goTo` *first* (so logic/UI switch on), slides the camera
via `cameraManager.slideTo` (`TRANSITION_DURATION` 600 ms, +200 ms from full-tree view, `Cubic.easeOut`), then hides
the blocker and publishes `transitionComplete`. A failsafe ends the transition after duration + 1 s if the tween
callback never fires. Re-entrant calls are ignored while `isTransitioning()`.

**Upgrade-tree cameras** (`cameraManager.setupTreeCameras`, called from `upgradeTree.init`):

| Camera | Renders | Notes |
|---|---|---|
| `cameras.main` | The world (tower, enemies, HUD, most popups) | Scrolls between combat/upgrade views. Ignores the tree container. |
| `treeNodeCamera` | Only `treeMaskContainer` (nodes, lines) | Panel-width viewport = clipping. Objects join via `draggableGroup.add` → `_applyTreeMask`. |
| `uiCamera` | Only objects passed to `upgradeTree.assignToUICamera(obj)` | Full screen, never scrolls; draws over the other two. |

- At setup both tree cameras ignore every existing object; a scene `addedtoscene` hook then makes them ignore
  every new object unless it has `isTreeElement = true`. New objects therefore default to the main camera only.
- Cameras render in order main → treeNode → ui, so **depth only orders objects within one camera**. Anything that
  must appear over the tree panel (popups, tooltips, toasts, dialog, HUD pieces, Options) must be routed with
  `upgradeTree.assignToUICamera()` (wraps `cameraManager.assignToCamera`, recursing into Buttons, containers,
  virtual groups). `treeGroup.add()` does this automatically.

## 5. Manager catalogue

**Core / engine (`js/util/`)**: `loadingManager` (retry, stall, timeout for both load phases) · `gameState` (§7.4) ·
`messageBus` · `mouseManager` · `audioManager` (`audio`) · `tweens.js` (`tweenTint`, `tweenPulse`, `tweenShake`, …) ·
`objectPool` · `button` / `buttonManager` · `typewriterHelper` / `effectPool` / `uiHelper` (`helper`) ·
`canvasnineslice` (`CanvasNineSlice` fallback) · `textEffects` (`precomputeWrapText`) · `timeManager` ·
`updateManager` · `popupManager` (`showPopup`, `showNineSlicePopup`, `showYesNoPopup`) · `floatingText` (pooled
damage/pickup text) · `virtualGroup` (`createVirtualGroup`: logical group with shared position/alpha/scale) ·
`slider` (`Slider`) · `debugManager` (`initDebug`: FPS overlay when `FLAGS.DEBUG`) · `notificationManager` (toasts,
depth 99000) · `analyticsManager` (gtag wrapper; off on localhost and unless `FLAGS.ANALYTICS_ENABLED`) ·
`cameraManager` · `cinematicManager` (letterbox/cutscenes; uses `buttonManager.setBlocked`) · `treeLineManager`
(node connection lines) · `glitchFX` (sprite glitch effects) · `dustParticles` (ambient dust) · `scoreManager`
(best times on farming levels) · `statsTracker` (per-iteration combat stats).

**Combat**:
- `waveManager.js`: wave timer/progress, miniboss/boss pauses, farming mode, tower-death sequence, END WAVE → `WAVE_COMPLETE`.
- `enemyManager.js`: spawning (weights from `levelConfig`), per-type pools, movement, `damageEnemy`, kills/drops, `despawnEnemy`, range queries.
- `bossManager.js`: boss/miniboss spawning and layouts. `spatialGridUtils.js`: spatial hash (150 px cells) for proximity queries.
- `projectileManager.js` (tower shots), `enemyBulletManager.js` (boss/miniboss bullets), `Hijack.js` (`hijackManager`, homing missiles): pooled, per-frame collision.
- `resourceManager.js`: currencies (`currencyChanged`), DATA drops (pooled; drift, fly to cursor), pickup radius.
- `tower.js`: tower MVC (`TowerModel`/`TowerView`/`tower`): health, regen, EXP, auto-attack, hit feedback, death shake.
- Attacks (MVC, unlocked by nodes/shards): `cursorAttack.js` (`pulseAttack`, cursor AOE + bombs), `lightningAttack`, `shockwaveAttack`, `laserAttack`, `artilleryAttack`, `scytheAttack`, `swordAttack`, `combatShield`. `cooldownManager.js` provides the `Cooldown` class.
- `customEmitters.js`: named particle effects with lazy emitter creation (§7.7).

**Upgrade tree**:
- `upgradeTree.js`: panel, drag/zoom, full-view slide, deploy/level-select/BREACH buttons, camera routing.
- `treeNode.js` (`Node`; states HIDDEN/GHOST/UNLOCKED/MAXED, purchase → `upgradePurchased`), `duoNode.js` (`DuoNode`, shard choices; `gameState.activeShards`/`duoBoxPurchased`), `nodeTooltip.js` + `secondaryTooltip.js`, `nodeAnims.js` (purchase/maxed tweens), `treePopups.js` (level select), `nodeUtils.js` (dynamic nodes, `restoreDynamicNodes`), `disabledNodes.js`, `loreDefs.js`.
- `upgradeDispatcher.js`: `getLevel(id)` (0 if the branch is inactive) and `recalc*()` functions that push stats into weapons/tower; `NODE_DEFS[].effect` calls these; `recalcEverything()` at boot.
- `upgradeManager.js`: **dead stub** (empty `init`/`buy`, still initialised by `gameInit`). Purchases live in `treeNode.js`.

**Takeover / Financial Breach**: `takeoverTargets.js` (target generation, wall-clock attack timer, rewards; state in
`gameState.takeoverState`; publishes `takeover*`), `takeoverPopup.js` (split-console terminal at `DEPTH_POPUPS + 2000`),
`infiltrationUI.js` (helpers over the baked `infiltration` atlas).

**UI / meta**: `gameHUD.js` + `hud/HealthBar.js` + `hud/CurrencyCluster.js` (in-combat and upgrade HUD) ·
`iterationOverScreen.js` (results) · `transitionManager.js` · `announcementManager.js` (centred typewriter/glitch
announcements, `AnnounceText`) · `tooltipManager.js` (generic hover tooltip) · `towerStatsUI.js` (tower stat hover in
upgrade phase) · `progressBar.js` · `uibuttons.js` (Options popup, mute buttons, import/export/reset, `openOptionsPopup`,
`closeTopOptionsPopup`) · `hotkeys.js` (Esc, P, M; auto-pause on blur/tab hide during combat) · `dialogSystem.js`
(Companion AI dialog) · `tutorialManager.js` · `milestoneTracker.js` (lifetime stats, claimable milestones, phase-change
saves) · `achievementManager.js` (silent unlocks) · `loadingScreen.js` · `sdkManager.js` (`sdk`).

## 6. Patterns

- **IIFE singletons**: `const fooManager = (() => { let state; function init() {…} return { init, … }; })();`.
  A few utils are class singletons (`const buttonManager = new InternalButtonManager()`, `timeManager`, `updateManager`).
  Subscribe in `init()` (called from `gameInit.js`) unless the subscription is needed before boot.
- **MVC entities**: Model = plain state and maths (no Phaser), View = sprites/tweens, controller = wrapper.
  Enemies: `EnemyModel`/`EnemyView`/`Enemy` in `js/enemies/enemy.js`; each type subclasses all three
  (`BasicEnemyModel`/`BasicEnemyView`/`BasicEnemy`), the wrapper sets `this.model`/`this.view`. `Miniboss`/`Boss`
  add intermediate model/wrapper classes. Tower and weapons follow the same split (`TowerModel`/`TowerView`/`tower`,
  `PulseAttackModel`/`PulseAttackView`/`pulseAttack`). Adding an enemy: `add-enemy` skill.
- **messageBus**: `subscribe(topic, cb)` returns `{ unsubscribe }`; `subscribeOnce`; `publish(topic, ...args)`.
  Subscribers run in subscription order; an exception in one is logged and the others still run. Topic names in
  `GAME_CONSTANTS.EVENTS` where defined. Full topic table: `docs/MESSAGES.md`, generated by `tools/messages.js`
  (`npm run docs:messages`; `tests/messages.test.js` fails when it is stale). Prefer an event over a direct call.
- **Button + buttonManager**: `new Button({ normal, hover, press, disable, onMouseUp, onHover, onHoverOut, … })`
  registers itself with `buttonManager`. Hit-testing walks `buttonList` from the end: **the most recently created
  (or `bringButtonToTop`'d) Button wins, regardless of depth.** `setDepth` only changes drawing. Button plays no
  sound by itself: give every interaction tint/scale and an `audio.play` in its callbacks.
- **ObjectPool**: `new ObjectPool(factory, reset, maxSize | { maxSize, onAcquire, destroy })`; `get()`, `release()`
  (reset runs on release), `preAllocate(n)`, `releaseAll()`, `clear()`; guards double-release and wrong-pool release.
- **Pixel textures**: `white_pixel` / `black_pixel` (also frames in the `buttons` atlas) are 2x2: `setScale(px / 2)`.
- **Data definitions**: `NODE_DEFS` (`js/nodeDefs.js`: `id`, `parents`, `childIds`, `maxLevel`, `baseCost`, `costType`,
  `costScaling`, `treeX/treeY` via `gridX()/gridY()` (`docs/UPGRADE_TREE_LAYOUT.md`), `effect`, routed through
  `upgradeDispatcher.js`), `LEVEL_CONFIG` + `getCurrentLevelConfig()` (`js/levelConfig.js`), `LORE_DEFS` (`js/loreDefs.js`,
  texts in `lore.txt` / `maxed_node_lore.txt`), `DISABLED_NODES`.
- **Localization**: every player-facing string is a key in `js/localization/en.js`, read with
  `t('namespace', 'key', [args])` (`{0}`, `{1}` placeholders; missing keys render as `[ns.key]`). Strings resolved at
  load time (e.g. `NODE_DEFS` names) are fixed for the session.

## 7. Runtime rules and invariants

### 7.1 Pause (`js/uibuttons.js`, `js/util/timeManager.js`)
- Opening Options publishes `gamePaused`; closing publishes `gameResumed`. Hotkeys (P, Esc, blur/tab hide in combat) go through `openOptionsPopup`.
- Managers set a `paused` flag and skip their update loops (`enemyManager`, `waveManager`, `projectileManager`, `enemyBulletManager`, `resourceManager`, `Hijack`, `cameraManager` shake, every weapon).
- `timeManager.freezeWorld()` additionally pauses every running tween, timer event and sprite animation (boss attack chains, delayed hits) and records exactly those; `unfreezeWorld()` resumes only them. Options publishes `gamePaused` *before* creating its own tweens, so the menu animates normally.
- While frozen, time scale is forced to 1 (pause menu at normal speed); active slow-mo is re-applied on resume.
- `tower.takeDamage` returns early while paused, so late `setTimeout`/tween hits can't land (`js/tower.js`).
- New loops must subscribe to `gamePaused`/`gameResumed`; `setTimeout` is *not* frozen, so guard its callback.

### 7.2 Slow motion (`js/util/timeManager.js`)
- Never write `PhaserScene.time.timeScale`, `tweens.timeScale`, `anims.globalTimeScale` or `GAME_VARS.timeScale` directly.
- Use `timeManager.beginSlow(scale, applyToTweens)` / `endSlow(handle)`, `slowFor(ms, scale)`, `slowRamp(from, ms, ease)`, `clearSlows()` (phase changes, results screen). The slowest active request wins, so overlapping effects can't cancel each other early. `applyToTweens = false` keeps tweens (explosions) fluid.
- `setGameSlow`/`clearGameSlow` set a persistent manual speed that slows stack under. Their messageBus topics are legacy (never published; see `BACKLOG.md`).

### 7.3 Input ownership (`js/util/uiHelper.js`, `js/util/buttonManager.js`)
- **Global blocker**: one shared full-screen Button (`globalObjects.clickBlocker`). `helper.createGlobalClickBlocker()` re-enables it and moves it to the top of the hit list; `helper.hideGlobalClickBlocker()` disables it. Used by Options, `popupManager`, transitions, the takeover terminal, level select, tree full-view slides and the death sequence. Buttons created after it sit above it in the list, which is how a popup's own buttons stay clickable.
- **Local blocker**: `helper.createLocalClickBlocker()` returns a private blocker the caller destroys. Used by the companion dialog (`dialogSystem.js`), the reset confirm and the import flow (`uibuttons.js`).
- **A popup opened over another popup must use a local blocker**: reusing the global one and hiding it on close would unblock the popup underneath.
- `helper.isInputBlocked()` is true for the global blocker, any live local blocker, or `buttonManager.isBlocked` (cinematics). Keyboard (`hotkeys.js`), wheel/drag (`upgradeTree.js`), cursor bombs (`cursorAttack.js`) and hint/dialog timing must check it. Raw `PhaserScene.input` handlers bypass Buttons entirely.

### 7.4 Saves (`js/util/gameState.js`, `js/milestoneTracker.js`, `js/gameInit.js`)
- Progress saves on phase changes (`milestoneTracker` `phaseChanged` handler → `saveGame()`). Deliberate: a reload undoes a misclick. **Never call `saveGame()` from tree/UI actions.** Existing exceptions: achievement unlocks, takeover start/abort/complete/claim (wall-clock timer), the companion's `first_breach` flag, farming best scores, import.
- Options toggles/sliders call `saveSettings()`: rewrites only `data.settings` of the stored save.
- Format: `{ version, data }` under `SAVE_KEY`. Load: `_migrateState` (+ optional `migrateProjectState` hook, not currently defined) then `_applySaveData`, which merges nested defaults via `_withDefaults` (old saves gain new keys; numeric `null`/NaN fall back to defaults; `__proto__` keys skipped). New saved fields need a default in `GAME_STATE_DEFAULTS`.
- An unreadable save is copied to `<SAVE_KEY>_unreadable` before the fresh game overwrites it.
- A save containing only `settings` (Options touched before any progress, or after Reset) still starts a fresh game (debug start, legacy migration) and keeps those settings.
- CrazyGames (`FLAGS.USING_CRAZYGAMES_SDK`): at boot the cloud save is fetched, LZ-decompressed and injected into localStorage only if it parses; cloud options are merged into `gameOptions`. Writes go to localStorage plus the cloud (LZ-compressed, `localBestScores` stripped); if the cloud write fails `sdk.setItem` stores the compressed payload locally, which `_readStoredSave` also accepts. Reset/import wait for the cloud write (max 4 s, `CLOUD_WAIT_MS`) before reloading.
- `js/util/globals.js` swaps in an in-memory `localStorage` when storage throws (sandboxed iframe, blocked site data): the game runs, nothing persists.
- Export/import: `exportSaveToString` / `importSaveFromString` (LZ + checksum, settings excluded, newer versions rejected).

### 7.5 Canvas compatibility (`js/util/uiHelper.js`)
- The game must look right on the Canvas renderer (`window.isCanvas`). Canvas has no tint: `helper.setTint`/`setTintFill`/`clearTint` are no-ops there, so never rely on runtime tint for important visuals.
- Colour variants are separate atlas frames (e.g. the baked `infiltration` atlas, tower hit flash sprites).
- Use `helper.createNineSlice` (falls back to `CanvasNineSlice`) and `helper.setBlendMode` (NORMAL on Canvas).
- `Graphics` and runtime `CanvasTexture`s (`textures.createCanvas`, e.g. the tower hurt vignette) work on both.

### 7.6 Pools and entity lifetime (`js/util/objectPool.js`, `js/enemyManager.js`)
- Releasing into a full pool destroys the object (default `ObjectPool.destroyObject`: `obj.destroy()`, else `obj.img.destroy()`); an orphaned Phaser object would stay on the display list forever. Give a custom `destroy` option if neither fits.
- Bosses and minibosses are not pooled: created per spawn, `destroy()`ed 6 s (`BOSS_DESTROY_DELAY`) after removal so death effects can still read the view.
- Enemies that leave the play area on their own (cache, logic stray) must call `enemyManager.despawnEnemy(enemy)`, which removes them from `activeEnemies`/`typeCounts` and releases them; `deactivate()` alone leaks.

### 7.7 Particles (`js/customEmitters.js`)
- Phaser sets particle speed only at emit; a speed ease does nothing. To decelerate, spread `..._brake(shed)` into the emitter config (acceleration opposite the particle's velocity; `shed` = share of speed lost over its life).

### 7.8 Tweens on shared sprites (`js/nodeAnims.js`)
- Don't `tweens.killTweensOf(sprite)` without checking what else animates it. `playMaxedAnimation` once killed the purchase fade-out on `fadeoutSprite`, freezing it opaque and blanking maxed nodes. Prefer storing and stopping your own tween handle.

### 7.9 Depth bands (`js/gameConfig.js`)

| Constant | Value | Use |
|---|---|---|
| `DEPTH_BG` | -3 | Background |
| `DEPTH_GLOW` / `DEPTH_ENEMIES` / `DEPTH_TOWER` / `DEPTH_PROJECTILES` / `DEPTH_RESOURCES` | 50 / 100 / 200 / 300 / 400 | World |
| `DEPTH_HUD` | 1000 | HUD |
| `DEPTH_UPGRADE_TREE` | 2000 | Tree panel |
| `DEPTH_DEATH_OVERLAY` / `DEPTH_DEATH_TOWER` | 3000 / 3500 | Death flash, tower above it |
| `DEPTH_DIALOG` | 4500 | Companion dialog (above tree + HUD, below transitions) |
| `DEPTH_TRANSITION` | 5000 | Transition effects |
| `DEPTH_ITERATION_OVER` | 6000 | Results screen |
| `DEPTH_POPUPS` | 10000 | Popups (level select +1000, takeover terminal +2000) |

Outside the bands: Options button 7000, toasts 99000, Options / `popupManager` overlay 110900, click blockers 999999 (`popupManager` re-depths the global one to 110900–111000).
Depth never overrides camera order (§4) or Button hit order (§6).

## 8. Tooling

| Tool | What it does |
|---|---|
| `npm run lint` | `tools/check-globals.js` (cross-file duplicate top-level names) then ESLint (`eslint.config.js`; known globals computed from every script in `index.html` via `tools/gameScripts.js`). `npm install` once first. |
| `npm test` | `node --test "tests/**/*.test.js"`: `gameState.test.js` (save/load/merge/import), `takeover.test.js`, `messages.test.js` (MESSAGES.md up to date), `nodeDefs.test.js` (unique ids, parent/child links, no grid overlaps). `tools/gameSandbox.js` loads a game script into a `vm` context with a fake clock, seeded RNG and stubbed managers. |
| `npm run takeover-sim` | `tools/takeover-sim.js`: runs the real `takeoverTargets.js` in the sandbox; `--rolls --seed --speed --attacks --json`. |
| `npm run docs:messages` | `tools/messages.js`: regenerates `docs/MESSAGES.md` from code. |
| `npm run audit-assets` | `.claude/skills/asset-audit/audit.js`: audio files / atlas frames vs code references. |
| `tools/playtest.js` | Dev-only, injected into a running page: global `AZT` (`state`, `loadPreset`, `grant`, `combat`/`upgrades`, `spawn`, `god`, `speed`, `clickText`, …). `tools/playtest-takeover.js` adds `AZT.takeover` scenarios and flows. Never shipped. |
| `.claude/skills/` | `playtest`, `test-takeover`, `add-enemy`, `add-audio`, `asset-audit`, `prepare-release`. |
| `node build_prod.js` (`npm run build`) | Concatenates every local `<script>` in `index.html` except `SKIP_BUNDLE` (`flags.js`, `phaser.min.js`, `rexbbcodetextplugin.min.js`) into `dist/bundle.js`, writes `dist/index.html`, copies `assets/` and loose files. Bundling is plain concatenation, so the one-global-scope rules still apply. |
| `mockups/` + `npm run export-terminal-assets` | Standalone HTML design mocks (not shipped). `mockups/infiltration-terminal.html` is baked by `tools/export-terminal-assets.js` (headless Chrome) into `raw/infiltration/*.png` + `raw/infiltration_layout.json`, packed via `raw/infiltration.tps` (TexturePacker, **trim off**); `takeoverPopup.js` places frames at the mock's coordinates. The mock is the source of truth: to change the look, edit it, run `npm run export-terminal-assets`, republish the `.tps`, and update moved coordinates from `raw/infiltration_layout.json` — don't draw the terminal in Phaser. Every colour variant is its own frame (Canvas-safe). Open mocks at http://localhost:8124/mockups/…. |
| Preview server | "Game Server (port 8124)" in `.claude/launch.json` serves the repo root at http://localhost:8124. |
