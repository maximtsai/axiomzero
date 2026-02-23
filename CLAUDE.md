# Axiom Zero - Idle Game

## Project Overview

Browser-based **hybrid incremental/tower-defense** game called "Axiom Zero" built with **Phaser.js**. No bundler or module system — all files are plain JS loaded via `<script>` tags in `index.html`. Load order matters.

The game starts immediately on load — there is no main menu. Gameplay alternates between an **upgrade phase** (between waves) and a **wave phase** (enemies active). All phase transitions are coordinated by `gameStateMachine` via the `messageBus`.

- **Game dimensions:** 1280 × 720
- **Version:** v.1.0
- **Dev server:** `runServer8124.exe` (port 8124)

## File Structure

```
index.html              # Entry point — defines script load order
flags.js                # Feature flags (loaded first — see Flags section)
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
  gameStateMachine.js   # Phase state machine: UPGRADE_PHASE / WAVE_ACTIVE / WAVE_COMPLETE / GAME_OVER
  waveManager.js        # Wave spawning, enemy logic, win/fail detection (stub)
  upgradeManager.js     # Upgrade definitions and purchase logic (stub)
  gameHUD.js            # All in-game Phaser UI (stub)
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
    popupManager.js     # Popup dialogs
    timeManager.js      # Time/timer utilities
    updateManager.js    # Per-frame update loop
    tweens.js           # Custom tween helpers (e.g. tweenTint)
    helperFunction.js   # Misc helpers (typewriter, fullscreen, mobile detect)
    textEffects.js      # Text effect utilities
    utilities.js        # BUILD OUTPUT — minified bundle of the above (do not edit directly)
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
10. `js/util/utilities.js` — all other util singletons (`messageBus`, `buttonManager`, etc.)
11. `js/util/debugManager.js` — `initDebug` (loaded separately; not bundled)
12. `js/util/notificationManager.js` — `notificationManager` singleton (loaded separately; not bundled)
13. `js/uibuttons.js` — mute/SFX button factories
14. `js/gameStateMachine.js` — phase state machine
15. `js/waveManager.js` — wave logic (subscribes to `'phaseChanged'`)
16. `js/upgradeManager.js` — upgrade logic (subscribes to `'phaseChanged'`)
17. `js/gameHUD.js` — in-game UI (subscribes to `'phaseChanged'`)
18. `js/gameInit.js` — bootstrapper (subscribes to `'assetsLoaded'`, inits all systems)
19. `js/loadingScreen.js` — `loadingScreen` singleton
20. `js/main.js` — Phaser game boot (last)

## Build Process

The `util/` source files get minified and combined into `util/utilities.js` using UglifyJS:

```sh
# Run from the js/util/ directory
uglifyjs messageBus.js mouseManager.js audioManager.js tweens.js button.js buttonManager.js helperFunction.js timeManager.js updateManager.js hoverText.js popupManager.js -o utilities.js -c -m
```

`js/util/utilities.js` is the file loaded by `index.html` — **do not edit it directly**. Edit the individual source files in `js/util/` and rebuild.

Note: `globals.js`, `loadingManager.js`, and `gameState.js` are loaded separately (not bundled), so they can be edited directly. `debugManager.js` and `notificationManager.js` are also loaded separately (after `utilities.js`) so they are NOT part of the bundle.

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
| `messageBus` | `js/util/utilities.js` | Global pub/sub event bus |
| `buttonManager` | `js/util/utilities.js` | Manages all Button instances |
| `updateManager` | `js/util/utilities.js` | Per-frame update loop registry |
| `loadingManager` | `js/util/loadingManager.js` | Asset loading with retry/stall/timeout |
| `loadingScreen` | `js/loadingScreen.js` | Two-phase loading screen controller |

### `GAME_CONSTANTS` notable fields
```js
GAME_CONSTANTS.WIDTH        // 1280
GAME_CONSTANTS.HEIGHT       // 720
GAME_CONSTANTS.halfWidth    // 640 (derived)
GAME_CONSTANTS.halfHeight   // 360 (derived)
GAME_CONSTANTS.LOADING_BAR_WIDTH
GAME_CONSTANTS.LOADING_BAR_HEIGHT
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

### Click Blocker (`js/util/helperFunction.js`)
Full-screen transparent button to block input:

```js
const blocker = helper.createGlobalClickBlocker(showPointer);
helper.hideGlobalClickBlocker();
```

## Game Loop

The game starts immediately after assets load — there is no main menu.

### Phase State Machine (`js/gameStateMachine.js`)

```js
gameStateMachine.goTo('UPGRADE_PHASE');   // transition to a phase
gameStateMachine.getPhase();              // returns current phase string
gameStateMachine.is('WAVE_ACTIVE');       // boolean check
```

Phases: `'UPGRADE_PHASE'` → `'WAVE_ACTIVE'` → `'WAVE_COMPLETE'` → `'UPGRADE_PHASE'` (or `'GAME_OVER'`)

Every transition publishes `messageBus.publish('phaseChanged', phase)`. Systems react to this topic — **they never call each other directly**.

### Startup Sequence

1. Phaser boots → `loadingScreen` handles two-phase asset load
2. `loadingScreen._onComplete()` publishes `'assetsLoaded'`
3. `gameInit.js` receives `'assetsLoaded'`, inits all systems, calls `gameStateMachine.goTo('UPGRADE_PHASE')`

### Key messageBus Topics

| Topic | Published by | Payload |
|---|---|---|
| `'assetsLoaded'` | `loadingScreen` | — |
| `'phaseChanged'` | `gameStateMachine` | phase string |
| `'enemyKilled'` | `waveManager` | — |
| `'waveComplete'` | `waveManager` | — |
| `'upgradePurchased'` | `upgradeManager` | upgrade id |

## Conventions

- **No modules** — all code uses globals. Avoid `import`/`export`.
- **Script load order** is defined in `index.html` and is critical.
- **Constants** go in `js/util/globals.js` (`GAME_CONSTANTS`).
- **Feature flags** go in `flags.js` (`FLAGS`).
- **Per-frame logic** registers with `updateManager`, not Phaser's `update()` directly.
- **Events** between systems use `messageBus` topics, not direct references where possible.
- **localStorage** used for persisting user settings (audio mute state, etc.).
- After editing files in `js/util/`, rebuild `utilities.js` with the uglifyjs command above.
