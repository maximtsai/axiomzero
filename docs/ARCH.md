# Axiom Zero - Architecture Reference (ARCH.md)

This document serves as the source of truth for the project's architectural patterns, core systems, and development guidelines. The AI assistant should reference this document to ensure new code adheres to established standards.

## 1. Core Systems

### Internal Message Bus (`messageBus`)
The game relies heavily on a publish/subscribe pattern to decouple systems. 
- **Usage**: Use `messageBus.subscribe('topic', callback)` and `messageBus.publish('topic', args)`.
- **Common Topics**: 
  - `phaseChanged`: Fired when transitioning phases (e.g., COMBAT, UPGRADE).
  - `enemyKilled`: Fired when an enemy dies, triggering drops.
  - `currencyChanged`: Fired when data, insight, or shards update.
  - `pointerDown`, `pointerUp`, `pointerMove`: Global input events.

### Resource Management (`resourceManager.js`)
Handles the spawning, physics (flying to cursor), and collection of dropped resources.
- Uses `ObjectPool` to recycle drop sprites and avoid memory leaks.
- Emits `currencyChanged` when resources are added to the player's total.

### Global Audio System (`audioFiles.js` & `utilities.js`)
All audio must be pre-registered and triggered via the global helper.
- **Registration**: Add assets to `assets/audioFiles.js`.
- **Playback**: Use `audio.play('id', volume)` or `audio.playMusic('id')`.
- **UI Feedback**: The base `Button` class automatically plays a `click` sound on `PRESS`.

### Level Configuration (`levelConfig.js`)
Centralized data structure (`LEVEL_CONFIG`) that defines settings per level.
- **Usage**: Use `getCurrentLevelConfig()` to safely fetch the configuration for `gameState.currentLevel`.
- **Features**: Modifies enemy spawn rates (`spawnInterval`), specific enemy type spawn probabilities (`enemyProbabilities`), miniboss types, global stat modifiers (`levelScalingModifier`), and drop multipliers (`dataDropMultiplier`).

### Animation & Visual Effects (`gameAnims.js`)
Animations are centralized and pooled for performance.
- **Centralization**: All global animations are defined in `gameAnims.js`.
- **Performance**: High-frequency effects (hit impacts, sparks) must use an `ObjectPool` in their respective managers to avoid GC stutter.
- **Feedback**: Use the `animationcomplete` event to automatically recycle sprites back into the pool.

## 2. UI and Interaction

### Button Component (`utilities.js`)
The standard interactive element. Never reinvent a clickable element; always instantiate `new Button(config)`.
- **States**: `NORMAL`, `HOVER`, `PRESS`, `DISABLE`.
- **Properties**: Handles text rendering, tinting, scaling, and hover/click event callbacks (`onMouseDown`, `onMouseUp`, `onHover`).
- **Depth**: Properly handles Phaser depths to ensure UI sits above gameplay.

### Object Pooling
Whenever creating short-lived entities (projectiles, text popups, resource drops, click effects), use the `ObjectPool` class in `utilities.js`.
- Instantiate with a factory function and a reset function.
- Prevents garbage collection stutter during combat phases.

## 3. Structural Patterns

### Model-View-Controller (MVC)
The project is iteratively refactoring towards MVC, particularly for towers and attacks (e.g., `pulseAttack.js`, `tower.js`).
- **Model**: Contains raw state (damage, health, timers, limits) and logic calculations. Independent of Phaser.
- **View**: Handles Phaser Sprites, tweens, particles, and rendering.
- **Controller**: Binds input/game loop to the Model, and dictates updates to the View.

### Phase Management (`gameStateMachine`)
The game loop cycles through distinct phases defined in `globals.js` (`GAME_CONSTANTS.PHASE_*`).
- **Phases**: Combat, Upgrade, Wave Complete, Game Over.
- **Transitions**: Controlled by `transitionManager.js`, which handles camera slides and UI messages (e.g., the TYPEWRITER effect for anomalies).

## 4. Asset Standards

### Pixel Textures
The project uses `white_pixel` and `black_pixel` textures for geometry and overlays.
- **Dimensions**: All "pixel" sprites are **2x2 pixels**.
- **Sizing Rule**: Sizing via **`.setScale()`** is preferred. However, because the base texture is **2x2**, the scale factor must be **50% of the target pixel dimension** (e.g., for a 250px width, use `.setScale(125)`).
- **Reasoning**: This maintains consistency with standard Phaser scaling patterns while accounting for the non-1x1 asset dimensions.

## 5. Development Guidelines

1. **Strict Phaser Separation**: Keep core logic mathematically pure; pass visual updates to View classes.
2. **Audio First**: When adding actions (clicks, kills, drops), wire up tactile audio feedback.
3. **Responsive UI**: Interactive elements must provide visual (tint/scale) and audio feedback explicitly.
4. **Performance**: Assume 600+ drops or 100+ enemies can exist. Use pools and avoid heavy operations loop per-frame.

## 5. Developer Preferences & Agent Autonomy

### Command Permissions
- **Search & Analysis Autonomy**: AI agents have explicit permission to auto-run discovery and analysis tools (`Get-ChildItem`, `grep`, `wc`, `find`) as well as scripting runtimes (`python`, `node`) and build utilities (`uglifyjs`) without manual approval.
- **Workflow Automation**: Use the `.agents/workflows/` directory for task-specific automation. Always include `// turbo-all` for scripts intended for full autonomy.
- **Source of Truth**: Reference [PERMISSIONS.md](file:///c:/Users/maxim/Desktop/maxgames/idle/.agents/PERMISSIONS.md) for detailed permission logs.

