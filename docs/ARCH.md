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

## 4. Development Guidelines

1. **Strict Phaser Separation**: Keep core logic mathematically pure; pass visual updates to View classes.
2. **Audio First**: When adding actions (clicks, kills, drops), wire up tactile audio feedback.
3. **Responsive UI**: Interactive elements must provide visual (tint/scale) and audio feedback explicitly.
4. **Performance**: Assume 600+ drops or 100+ enemies can exist. Use pools and avoid heavy operations loop per-frame.
