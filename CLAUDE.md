# Axiom Zero - Idle Game

## Project Overview

Browser-based **hybrid incremental/tower-defense** game called "Axiom Zero" built with **Phaser.js**. No bundler or module system — all files are plain JS loaded via `<script>` tags in `index.html`. Load order matters.

The game starts immediately on load — there is no main menu. Gameplay alternates between an **upgrade phase** (between waves) and a **wave phase** (enemies active). All phase transitions are coordinated by `gameStateMachine` via the `messageBus`.

- **Game dimensions:** 1600 × 900
- **Version:** v.1.0
- **Dev server:** `runServer8124.exe` (port 8124)

## File Structure

```
index.html              # Entry point — defines script load order
flags.js                # Feature flags (loaded first — see Flags section)
gameConfig.js           # Game-specific constants that extend GAME_CONSTANTS (loaded after globals.js)
phaser.min.js           # Phaser game engine (do not modify)
sdkManager.js           # CrazyGames SDK integration
assets/
  audioFiles.js         # audioFiles[] — audio asset declarations
  imageFiles.js         # imageFilesPreload[], imageAtlases[] — image asset declarations
  fontFiles.js          # fontFiles[] — bitmap font declarations
  gameAnims.js          # Animation definitions
  audio/                # Audio files
  fonts/                # Font files
  preload/              # Images loaded during Phase 1 preload (white_pixel, black_pixel, bg)
  sprites/              # Texture atlases (.json + .png pairs)
js/
  main.js               # Phaser game config + MainScene (preload/create/update hooks only)
  loadingScreen.js      # Two-phase loading screen (preload UI + asset loading)
  uibuttons.js          # UI button definitions (mute buttons, etc.)
  gameStateMachine.js   # Phase state machine: UPGRADE_PHASE / COMBAT_PHASE / WAVE_COMPLETE / GAME_OVER
  waveManager.js        # Wave lifecycle: spawning, tower death sequence, END ITERATION
  upgradeManager.js     # Upgrade definitions and purchase logic (stub)
  node.js               # Node class — individual upgrade button in neural tree
  nodeDefs.js           # NODE_DEFS[] — centralized upgrade definitions (data + effects)
  neuralTree.js         # Neural Tree UI (left panel during UPGRADE_PHASE)
  gameHUD.js            # In-game HUD: health/EXP bars, currency, END ITERATION button
  gameInit.js           # Bootstrapper — subscribes to 'assetsLoaded', inits all systems
  util/                 # Utility modules (source files — see Build section)
    globals.js          # GAME_CONSTANTS, GAME_VARS, globalObjects
    loadingManager.js   # Asset loading with retry, stall detection, timeout
    gameState.js        # gameState object + get/set helpers
    messageBus.js       # Pub/sub event system
    button.js           # Button class (state machine)
    buttonManager.js    # Button lifecycle/input routing
    audioManager.js     # Sound/music management
    mouseManager.js     # Mouse input handling
    popupManager.js     # Popup dialogs (showPopup, showYesNoPopup)
    timeManager.js      # Time/timer utilities
    updateManager.js    # Per-frame update loop
    tweens.js           # Custom tween helpers (e.g. tweenTint)
    typewriterHelper.js # Typewriter text animation — defines the `helper` global
    effectPool.js       # Click effect object pooling — extends `helper`
    uiHelper.js         # Fullscreen, mobile detect, click blocker — extends `helper`
    textEffects.js      # Text effect utilities (CJK-aware word wrap)
  enemies/             # Enemy class hierarchy
    enemy.js           # Abstract base class for all enemies
    basic_enemy.js     # BasicEnemy — Phase 1 red-violet square
    miniboss.js        # Miniboss abstract base (spawn angle, knockback reduction)
    miniboss_1.js      # Miniboss1 — ranged attacker (MOVING / ATTACKING states)
  enemyManager.js      # Enemy spawning, pooling, movement, damage (includes miniboss logic)
  projectileManager.js # Tower projectile pooling and collision
  enemyBulletManager.js # Enemy bullet pooling and collision (miniboss/boss bullets)
  resourceManager.js   # Currency state (DATA, INSIGHT, SHARD) and DATA drops
```

## Script Load Order (`index.html`)

Order is critical — each file depends on globals defined by files above it:

1. `flags.js` — feature flags, must be first
2. `phaser.min.js` — Phaser engine
3. `rexbbcodetextplugin.min.js` — BBCode text plugin
4. CrazyGames SDK (external CDN)
5. `sdkManager.js`
6. `assets/audioFiles.js`, `imageFiles.js`, `gameAnims.js`, `fontFiles.js` — asset lists
7. `js/util/globals.js` — `GAME_CONSTANTS`, `GAME_VARS`, `globalObjects`
8. `js/util/loadingManager.js` — `loadingManager` singleton
9. `js/util/gameState.js` — `gameState`
10. `js/util/messageBus.js` — pub/sub event bus
11. `js/util/mouseManager.js` — mouse input handling
12. `js/util/audioManager.js` — sound/music management
13. `js/util/tweens.js` — custom tween helpers
14. `js/util/objectPool.js` — generic object pool
15. `js/util/button.js` — Button class
16. `js/util/buttonManager.js` — button lifecycle/input routing
17. `js/util/typewriterHelper.js` — typewriter text animation (defines `helper` global)
18. `js/util/effectPool.js` — click effect pooling (extends `helper`)
19. `js/util/uiHelper.js` — fullscreen, mobile detect, click blocker (extends `helper`)
20. `js/util/textEffects.js` — text effect utilities
21. `js/util/timeManager.js` — time/timer utilities
22. `js/util/updateManager.js` — per-frame update loop
23. `js/util/popupManager.js` — popup dialogs
24. `js/util/floatingText.js` — floating text
25. `js/util/virtualGroup.js` — virtual display-list grouping
26. `js/util/debugManager.js` — `initDebug`
27. `js/util/notificationManager.js` — `notificationManager` singleton
13. `js/uibuttons.js` — mute/SFX button factories
14. `js/gameStateMachine.js` — phase state machine
15. `js/waveManager.js` — wave logic (subscribes to `'phaseChanged'`)
16. `js/upgradeManager.js` — upgrade logic (subscribes to `'phaseChanged'`)
17. `js/node.js` — Node class for individual upgrades
18. `js/nodeDefs.js` — NODE_DEFS[] centralized upgrade data
19. `js/neuralTree.js` — neural tree UI manager
20. `js/gameHUD.js` — in-game UI (subscribes to `'phaseChanged'`)
21. `js/gameInit.js` — bootstrapper (subscribes to `'assetsLoaded'`, inits all systems)
22. `js/loadingScreen.js` — `loadingScreen` singleton
23. `js/main.js` — Phaser game boot (last)

## Util Source Files

All files in `js/util/` are loaded individually and can be edited directly.

> **Design intent**: `js/util/` is meant to be a **fully reusable, project-agnostic library** of Phaser helpers. Nothing in this folder should reference Axiom Zero–specific concepts (enemy types, currency names, phase names, etc.). Game-specific wiring belongs in `js/` root files.

Currently the following files contain game-specific code that partially violates this rule:

- **`gameState.js`** — `GAME_STATE_DEFAULTS` contains Axiom Zero gameplay fields (tower stats, resource types, upgrade schema). The persistence helpers are generic; only the schema needs to move.
- **`milestoneTracker.js`** — subscribes to game-specific messageBus topics and defines Axiom Zero achievement data. This is the most tightly coupled file; it should be moved to `js/` root or split into a generic engine + game data layer.

All other util files are clean and fully generic:

- **`typewriterHelper.js`** — defines the `helper` global; typewriter text animation
- **`effectPool.js`** — extends `helper`; click effect object pooling
- **`uiHelper.js`** — extends `helper`; fullscreen, mobile detect, global click blocker


## Feature Flags (`flags.js`)

Top-level switches edited directly in `flags.js` before deployment. Loaded before all other scripts.

| Flag | Default | Description |
|---|---|---|
| `FLAGS.USING_CRAZYGAMES_SDK` | `false` | Enables CrazyGames SDK init, mute sync, and settings listener |
| `FLAGS.IS_DESKTOP` | `false` | Marks build as desktop-targeted (input/UI scaling hints) |

## Key Globals & Singletons

All globals are available throughout the codebase after their respective files load:

| Global | Defined in | Description |
|---|---|---|
| `FLAGS` | `flags.js` | Feature flags (first to load) |
| `GAME_CONSTANTS` | `js/util/globals.js` | Static config: dimensions, timing, loading bar size, etc. |
| `GAME_VARS` | `js/util/globals.js` | Mutable runtime state: `timeScale`, mouse coords, canvas scale |
| `globalObjects` | `js/util/globals.js` | Shared object registry (e.g. `clickBlocker`, `timeManager`) |
| `PhaserScene` | `js/main.js` (set in `create()`) | Active Phaser scene reference |
| `messageBus` | `js/util/messageBus.js` | Global pub/sub event bus |
| `buttonManager` | `js/util/buttonManager.js` | Manages all Button instances |
| `updateManager` | `js/util/updateManager.js` | Per-frame update loop registry |
| `loadingManager` | `js/util/loadingManager.js` | Asset loading with retry/stall/timeout |
| `loadingScreen` | `js/loadingScreen.js` | Two-phase loading screen controller |

### `GAME_CONSTANTS` notable fields
`globals.js` defines only generic engine fields. `gameConfig.js` extends it with game-specific constants.
```js
// From globals.js (generic)
GAME_CONSTANTS.WIDTH        // 1600
GAME_CONSTANTS.HEIGHT       // 900
GAME_CONSTANTS.halfWidth    // 800 (derived)
GAME_CONSTANTS.halfHeight   // 450 (derived)
GAME_CONSTANTS.LOADING_BAR_WIDTH
GAME_CONSTANTS.LOADING_BAR_HEIGHT

// From gameConfig.js (Axiom Zero-specific)
GAME_CONSTANTS.PHASE_UPGRADE / PHASE_COMBAT / PHASE_WAVE_COMPLETE / PHASE_GAME_OVER
GAME_CONSTANTS.COLOR_BG / COLOR_FRIENDLY / COLOR_HOSTILE / COLOR_RESOURCE / COLOR_STRAY
GAME_CONSTANTS.DEPTH_*      // depth layer ordering
GAME_CONSTANTS.TOWER_*      // tower tuning
GAME_CONSTANTS.ENEMY_*      // enemy tuning
GAME_CONSTANTS.WAVE_DURATION / TRANSITION_DURATION
```

### `GAME_VARS` fields
```js
GAME_VARS.timeScale         // controls UpdateManager (< 0.01 = paused)
GAME_VARS.mouseposx / mouseposy
GAME_VARS.mousedown
GAME_VARS.canvasXOffset / canvasYOffset / gameScale   // for coordinate conversion
```

## Core Systems

### Loading Screen (`js/loadingScreen.js`)
Two-phase loader. Called from `MainScene` hooks in `main.js`.

```js
// Phase 1 — Phaser preload()
loadingScreen.preload(scene);   // loads imageFilesPreload, sets up stall detection

// Phase 2 — Phaser create()
loadingScreen.create(scene);    // builds UI, queues all assets, hooks loadingManager
```

`_onComplete()` fires when all assets finish loading (or timeout is reached).

### Button (`js/util/button.js`)
State machine UI element. States: `NORMAL`, `HOVER`, `PRESS`, `DISABLE` (string constants).

```js
const btn = new Button({
    scene: PhaserScene,       // optional, defaults to PhaserScene global
    normal:  { ref, x, y, ... },
    hover:   { ... },         // optional, falls back to normal
    press:   { ... },         // optional, falls back to normal
    disable: { ... },         // optional, falls back to normal
    onMouseUp:   () => {},
    onMouseDown: () => {},
    onHover:     () => {},
    onHoverOut:  () => {},
    isDraggable: false
});
btn.setState(DISABLE);
```

Buttons auto-register with `buttonManager` on construction. Use `buttonManager.removeButton(btn)` to clean up.

### MessageBus (`js/util/messageBus.js`)
Pub/sub event system. Topics are strings.

```js
const sub = messageBus.subscribe("topicName", callback, optionalThisContext);
sub.unsubscribe();

messageBus.subscribeOnce("topicName", callback);
messageBus.publish("topicName", ...args);
```

Built-in topics used by `buttonManager`: `"pointerUp"`, `"pointerMove"`, `"pointerDown"`.

### UpdateManager (`js/util/updateManager.js`)
Register functions to run every frame. Respects `GAME_VARS.timeScale` (paused when < 0.01).

```js
updateManager.addFunction(myUpdateFunc);    // myUpdateFunc(delta)
updateManager.removeFunction(myUpdateFunc);
```

### AudioManager (`js/util/audioManager.js`)
All audio functions live on the `audio` namespace object. Settings persist via `localStorage`.

```js
audio.play(key, volume, loop);          // play a sound effect
audio.playMusic(key, volume, loop);     // play music (auto cross-fades)
audio.swapMusic(key);                   // cross-fade to new track
audio.muteAll();   audio.unmuteAll();
audio.muteSFX(bool);   audio.muteMusic(bool);
audio.recheckMuteState();               // re-read mute state from localStorage
audio.fadeAway(soundObj, duration);
```

### Helper Utilities (`js/util/uiHelper.js`, `typewriterHelper.js`, `effectPool.js`)
The `helper` global is assembled from three source files:

```js
// Click blocker (uiHelper.js)
const blocker = helper.createGlobalClickBlocker(showPointer);
helper.hideGlobalClickBlocker();

// Typewriter text (typewriterHelper.js)
helper.typewriterText(textObj, str, delay, sfx);
helper.typewriterTextByWord(textObj, str, delay, sfx);
helper.clearTypewriterTimeouts();

// Click effect pool (effectPool.js) — call initClickEffectPool(scene) once on init
helper.initClickEffectPool(scene);
helper.createClickEffect(x, y);
```

## Game Loop

The game starts immediately after assets load — there is no main menu.

### Phase State Machine (`js/gameStateMachine.js`)

```js
gameStateMachine.goTo('UPGRADE_PHASE');   // transition to a phase
gameStateMachine.getPhase();              // returns current phase string
gameStateMachine.is('COMBAT_PHASE');       // boolean check
```

Phases: `'UPGRADE_PHASE'` → `'COMBAT_PHASE'` → `'WAVE_COMPLETE'` → `'UPGRADE_PHASE'` (or `'GAME_OVER'`)

Every transition publishes `messageBus.publish('phaseChanged', phase)`. Systems react to this topic — **they never call each other directly**.

### Startup Sequence

1. Phaser boots → `loadingScreen` handles two-phase asset load
2. `loadingScreen._onComplete()` publishes `'assetsLoaded'`
3. `gameInit.js` receives `'assetsLoaded'`, inits all systems, calls `gameStateMachine.goTo('UPGRADE_PHASE')`

### Key messageBus Topics

| Topic | Published by | Subscribed by | Payload |
|---|---|---|---|
| `'assetsLoaded'` | `loadingScreen` | `gameInit` | — |
| `'phaseChanged'` | `gameStateMachine` | all systems | phase string |
| `'enemyKilled'` | `enemyManager` | `resourceManager`, `gameHUD` | x, y |
| `'waveComplete'` | `waveManager` | — | — |
| `'upgradePurchased'` | `upgradeManager` | `tower`, `gameHUD` | upgrade id |
| `'healthChanged'` | `tower` | `gameHUD` | current, max |
| `'expChanged'` | `tower` | `gameHUD` | current, max |
| `'currencyChanged'` | `resourceManager` | `gameHUD` | type, amount |
| `'towerDied'` | `tower` | `waveManager` | — |
| `'towerDeathStarted'` | `waveManager` | `gameHUD` | — |
| `'towerShakeRequested'` | `waveManager` | `tower` | duration (ms) |
| `'towerShakeComplete'` | `tower` | `waveManager` (once) | — |
| `'freezeEnemies'` | `waveManager` | `enemyManager` | — |
| `'unfreezeEnemies'` | `waveManager` | `enemyManager` | — |
| `'endIterationRequested'` | `gameHUD` | `waveManager` | — |
| `'waveProgressChanged'` | `waveManager` | `gameHUD` | progress (0–1) |
| `'minibossSpawned'` | `enemyManager` | `waveManager` | — |
| `'minibossDefeated'` | `enemyManager` | `waveManager`, `resourceManager` | x, y |

## Conventions

- **No modules** — all code uses globals. Avoid `import`/`export`.
- **Script load order** is defined in `index.html` and is critical.
- **Constants** go in `js/util/globals.js` (`GAME_CONSTANTS`).
- **Feature flags** go in `flags.js` (`FLAGS`).
- **Per-frame logic** registers with `updateManager`, not Phaser's `update()` directly.
- **Events** between systems use `messageBus` topics, not direct references where possible.
- **localStorage** used for persisting user settings (audio mute state, etc.).
- Edit files in `js/util/` directly — all source files are loaded individually by `index.html`.
