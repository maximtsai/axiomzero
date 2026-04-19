# Axiom Zero: Project Structure & Architecture

This document serves as a high-level technical map for the Axiom Zero codebase. It tracks global systems, core managers, and inheritance patterns to assist in development and debugging.

---

## ─── Global State & Systems ───

Available globally across all scripts (loaded in `index.html`):

- **`GAME_CONSTANTS`**: Static configuration (dimensions, depth layers, tuning). Defined in `js/util/globals.js` and extended in `js/gameConfig.js`.
- **`GAME_VARS`**: Volatile runtime state (mouse position, time scale, active flags like `testingDefenses`). Defined in `js/util/globals.js`.
- **`gameState`**: Persistent user progress (currencies, purchased upgrades, levels defeated). Managed via `js/util/gameState.js`.
- **`audio`**: AudioManager instance for all SFX and music. Defined in `js/util/audioManager.js`. Keys registered in `assets/audioFiles.js`.
- **`messageBus`**: Centralized Pub/Sub system for decoupling logic. Defined in `js/util/messageBus.js`.
- **`FLAGS`**: Feature toggles (e.g., `DEBUG`, `USE_SERVICE_WORKER`). Defined in `flags.js`.

---

## ─── Core Managers (The Engine) ───

- **`enemyManager.js`**: Tracks active enemies, handles spawning logic, and manages the enemy object pool.
- **`bossManager.js`**: Specialized logic for Boss/Miniboss states and phase transitions.
- **`waveManager.js`**: Manages the combat timer, wave progress, and farming mode transitions.
- **`resourceManager.js`**: Handles currency acquisition (+1 Data/Shard logic) and temporary resource drops.
- **`upgradeDispatcher.js`**: The bridge between the Upgrade Tree and game logic. Applies purchased upgrades to specific systems.
- **`tutorialManager.js`**: Manages the triggered sequences for new player guidance.

---

## ─── Entity Inheritance ───

### Enemies
- **`Enemy` (`js/enemies/enemy.js`)**: Base class for all hostile units. Handles health, movement, and status effects.
- **`Miniboss` / `Boss`**: Intermediate base classes for larger entities with complex phases.
- **Controllers**: Specific behaviors for `boss_2.js`, `bossCircle.js`, etc.

### Attacks
- **`pulseAttack` (`js/cursorAttack.js`)**: The primary player-driven weapon system (Logic Pulse & Bombs).
- **Secondary Systems**: `lightningAttack.js`, `shockwaveAttack.js`, `laserAttack.js`, `artilleryAttack.js`.

---

## ─── UI / HUD Structure ───

- **`gameHUD.js`**: Primary container for in-game UI (Buttons, progress bars, active HUD).
- **`upgradeTree.js`**: The central interface for player progression. Relies on `nodeDefs.js` for data.
- **`CurrencyCluster.js`**: Unified display for all currency types in the top-right.
- **`HealthBar.js`**: Segmented health display for the Tower.

---

## ─── Key Event Registry (MessageBus) ───

Key events to watch for when debugging system interactions:

- `currencyChanged`: Fired when Data/Insight/Shards are adjusted.
- `enemyKilled`: Fired by `enemyManager` upon enemy destruction.
- `testingDefensesStarted` / `testingDefensesEnded`: Sandbox mode lifecycle.
- `phaseChanged`: Transitions between `COMBAT_PHASE` and `UPGRADE_PHASE`.
- `bombUsesChanged`: Updates for the Bomb button UI.
- `endIterationRequested`: Triggered by the main menu button.
