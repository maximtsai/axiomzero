# MCat - Idle Game

## Project Overview

Browser-based idle game called "MCat" built with **Phaser.js**. No bundler or module system — all files are plain JS loaded via `<script>` tags in `index.html`. Load order matters.

- **Game dimensions:** 1194 × 672
- **Version:** v.1.0
- **Dev server:** `runServer8124.exe` (port 8124)

## File Structure

```
index.html          # Entry point — defines script load order
phaser.min.js       # Phaser game engine (do not modify)
main.js             # Game entry point
sdkManager.js       # SDK/platform integration
audioFiles.js       # Audio asset declarations
imageFiles.js       # Image asset declarations
gameAnims.js        # Animation definitions
fontFiles.js        # Font asset declarations
textData1.js        # Game text/data
textData2.js        # Game text/data
scripts/
  mainmenu.js       # Main menu scene
  gameplaysetup.js  # Gameplay initialization
  uibuttons.js      # UI button definitions
  techtree.js       # Tech tree logic
util/               # Utility modules (source files — see Build section)
  constants.js      # GAME_CONSTANTS object
  messageBus.js     # Pub/sub event system
  button.js         # Button class (state machine)
  buttonManager.js  # Button lifecycle/input routing
  audioManager.js   # Sound/music management
  mouseManager.js   # Mouse input handling
  loadingManager.js # Asset loading
  videoManager.js   # Video playback
  hoverText.js      # Tooltip/hover text
  popupManager.js   # Popup dialogs
  timeManager.js    # Time/timer utilities
  updateManager.js  # Per-frame update loop
  tweens.js         # Custom tween helpers (e.g. tweenTint)
  wrappedtext.js    # Text wrapping utilities
  helperFunction.js # Misc helpers (typewriter, fullscreen, mobile detect)
  utilities.js      # BUILD OUTPUT — minified bundle of above (do not edit directly)
```

## Build Process

The `util/` source files get minified and combined into `util/utilities.js` using UglifyJS:

```sh
# Run from the util/ directory
uglifyjs messageBus.js mouseManager.js audioManager.js tween.js button.js buttonManager.js helperFunction.js timeManager.js updateManager.js hoverText.js popupManager.js -o utilities.js -c -m
```

`util/utilities.js` is the file loaded by `index.html` — **do not edit it directly**. Edit the individual source files in `util/` and rebuild.

## Key Globals & Singletons

These are global variables available throughout the codebase:

| Global | Type | Description |
|---|---|---|
| `PhaserScene` | `Phaser.Scene` | Active Phaser scene reference |
| `gameConsts` | object | Runtime constants (e.g. `halfWidth`, `halfHeight`) |
| `gameVars` | object | Runtime state (e.g. `timeScale`, `mouseposx`, `mouseposy`) |
| `globalObjects` | object | Shared game object references (e.g. `clickBlocker`) |
| `messageBus` | `InternalMessageBus` | Global pub/sub event bus |
| `buttonManager` | `InternalButtonManager` | Manages all Button instances |
| `updateManager` | `UpdateManager` | Per-frame update loop registry |
| `GAME_CONSTANTS` | object | Static config values (dimensions, timing, etc.) |

## Core Systems

### Button (`util/button.js`)
State machine UI element. States: `NORMAL`, `HOVER`, `PRESS`, `DISABLE` (constants).

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

### MessageBus (`util/messageBus.js`)
Pub/sub event system. Topics are strings.

```js
const sub = messageBus.subscribe("topicName", callback, optionalThisContext);
sub.unsubscribe();

messageBus.subscribeOnce("topicName", callback);
messageBus.publish("topicName", ...args);
```

Built-in topics used by `buttonManager`: `"pointerUp"`, `"pointerMove"`, `"pointerDown"`.

### UpdateManager (`util/updateManager.js`)
Register functions to run every frame. Respects `gameVars.timeScale` (paused when < 0.01).

```js
updateManager.addFunction(myUpdateFunc);    // myUpdateFunc(delta)
updateManager.removeFunction(myUpdateFunc);
```

### AudioManager (`util/audioManager.js`)
Audio settings persist via `localStorage` (`sfxMuted`, `musicMuted`).

```js
muteAll();
recheckMuteState();
playSound(sfxKey);
```

### Click Blocker (in `util/helperFunction.js`)
Full-screen transparent button to block input:

```js
const blocker = createGlobalClickBlocker(showPointer);
hideGlobalClickBlocker();
```

## Conventions

- **No modules** — all code uses globals. Avoid `import`/`export`.
- **Script load order** is defined in `index.html` and is critical. Utility globals (`messageBus`, `buttonManager`, etc.) must be loaded before game scripts.
- **Constants** go in `util/constants.js` (`GAME_CONSTANTS`).
- **Per-frame logic** registers with `updateManager`, not Phaser's `update()` directly.
- **Events** between systems use `messageBus` topics, not direct references where possible.
- **localStorage** used for persisting user settings (audio mute state, etc.).
- After editing files in `util/`, rebuild `utilities.js` with the uglifyjs command above.
