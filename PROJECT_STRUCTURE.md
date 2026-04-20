# Axiom Zero: Project Structure & Architecture

Axiom Zero is a browser-based **hybrid incremental/tower-defense** game built with **Phaser.js**. 

This document serves as a high-level technical map for the codebase, tracking global systems, core managers, and inheritance patterns to assist in development and debugging.

---

## ─── Core Architecture ───

The project uses a **no-bundler approach**. All files are plain JavaScript loaded via `<script>` tags in `index.html`. 

### Key Implications:
- **Load Order is Critical**: Each file depends on globals defined by files loaded before it.
- **Global Namespace**: Almost all major systems are available globally (e.g., `messageBus`, `audio`, `enemyManager`).
- **No Modules**: Avoid using `import` or `export` statements.

---

## ─── Script Load Order (`index.html`) ───

The following is the high-level load order defined in `index.html`. Modifying this sequence can break system dependencies.

1.  **`flags.js`**: Feature flags and debug toggles (must be first).
2.  **External Libraries**: `phaser.min.js`, `rexbbcodetextplugin.min.js`, CrazyGames SDK.
3.  **Asset Declarations**: `assets/audioFiles.js`, `imageFiles.js`, `gameAnims.js`, `fontFiles.js`.
4.  **Utilities (`js/util/`)**: Generic, project-agnostic helpers (MessageBus, LoadingManager, AudioManager, etc.).
5.  **Game Configuration**: `js/util/globals.js` and `js/gameConfig.js`.
6.  **Game Managers**: Phase management, wave logic, enemy/resource/spatial management.
7.  **UI & HUD**: Tree nodes, tooltips, HUD, and the Upgrade Tree.
8.  **Entry Point**: `js/main.js` (Final bootstrapper).

---

## ─── Global State & Systems ───

Available globally across all scripts:

| Global | Defined in | Description |
| :--- | :--- | :--- |
| **`FLAGS`** | `flags.js` | Feature toggles (e.g., `DEBUG`, `USE_SERVICE_WORKER`, `USING_CRAZYGAMES_SDK`). |
| **`GAME_CONSTANTS`** | `js/util/globals.js` | Static config: dimensions, depth layers, tuning. Extended in `js/gameConfig.js`. |
| **`GAME_VARS`** | `js/util/globals.js` | Mutable runtime state: `timeScale`, mouse position, canvas scale. |
| **`gameState`** | `js/util/gameState.js` | Generic save/load engine for persistent user progress. |
| **`messageBus`** | `js/util/messageBus.js` | Centralized Pub/Sub system for decoupling logic. |
| **`audio`** | `js/util/audioManager.js` | Sound/music management. Keys registered in `assets/audioFiles.js`. |
| **`updateManager`** | `js/util/updateManager.js` | Per-frame update loop registry. Respects `GAME_VARS.timeScale`. |
| **`loadingScreen`** | `js/loadingScreen.js` | Two-phase loading screen controller. |
| **`spatialGridUtils`** | `js/spatialGridUtils.js` | High-performance spatial hashing for enemy proximity/collision queries. |
| **`helper`** | `js/util/typewriterHelper.js` | Assembled global helper for UI effects, click blockers, and pooled effects. |

---

## ─── Core Managers ───

- **`gameStateMachine.js`**: Orchestrates phase transitions (`UPGRADE_PHASE`, `COMBAT_PHASE`, `WAVE_COMPLETE`, `GAME_OVER`).
- **`waveManager.js`**: Manages the combat timer, wave progress, spawning lifecycle, and "End Iteration" sequences.
- **`enemyManager.js`**: Tracks active enemies, handles spawning logic, and manages enemy object pooling.
- **`bossManager.js`**: Specialized logic for Boss/Miniboss states and phase transitions.
- **`resourceManager.js`**: Handles currency acquisition (Data, Insight, Shards) and temporary resource drops.
- **`upgradeDispatcher.js`**: Bridge between the Upgrade Tree and game logic; applies purchased upgrades to systems.
- **`tutorialManager.js`**: Manages triggered sequences for new player guidance.
- **`cooldownManager.js`**: Tracks and updates global skill/attack cooldowns.
- **`announcementManager.js`**: Handles on-screen text notifications and combat messages.
- **`cinematicManager.js`**: Facilitates scripted camera movements and UI focus sequences.
- **`tower.js`**: Centrally tracks the player's core health, stats, and leveling.
- **`projectileManager` / `enemyBulletManager`**: Centralized pooling and collision for all projectiles.

---

## ─── Entity Inheritance ───

### Enemies
- **`Enemy` (`js/enemies/enemy.js`)**: Base class for all hostile units. Handles health, movement, and status effects.
- **`Miniboss` / `Boss`**: Intermediate base classes for larger entities with complex phases.
- **Common Types**: `swarmer_enemy.js`, `protector_enemy.js`, `sniper_enemy.js`, `shell_enemy.js`, `exploder.js`.
- **Boss Controllers**: `boss_2.js` (Legion), `bossCircle.js`, `bossSquare.js`.

### Attacks
- **`pulseAttack` (`js/cursorAttack.js`)**: The primary player-driven weapon system (Logic Pulse & Bombs).
- **Secondary Systems**: `lightningAttack.js`, `shockwaveAttack.js`, `laserAttack.js`, `artilleryAttack.js`.

---

## ─── UI / HUD Structure ───

- **`gameHUD.js`**: Primary container for in-game UI (Buttons, progress bars, active HUD).
- **`upgradeTree.js`**: The central interface for player progression. Relies on `nodeDefs.js` and `treeNode.js`.
- **`iterationOverScreen.js`**: Summary and rewards screen shown after a tower destruction or manual reset.
- **`towerStatsUI.js`**: Panel display for current tower statistics and attribute bonuses.
- **`nodeTooltip.js` / `tooltipManager.js`**: Dynamic tooltip system for upgrade nodes and UI elements.
- **`CurrencyCluster.js` / `HealthBar.js`**: Specialized components for resource tracking and survival.

---

## ─── Game Flow ───

The game operates on a cyclic phase system managed by `gameStateMachine`:

1.  **`UPGRADE_PHASE`**: Enemies are inactive. Player can browse the Upgrade Tree and purchase improvements.
2.  **`COMBAT_PHASE`**: Waves spawn. Player defends the Tower using weapons and cursor interaction.
3.  **`WAVE_COMPLETE`**: Brief transition phase after a wave is cleared.
4.  **`GAME_OVER`**: Triggered when tower health reaches zero. Transitions to `iterationOverScreen`.

Transitions are published via the `messageBus` topic `phaseChanged`.

---

## ─── Key Event Registry (MessageBus) ───

Key topics used for decoupling systems. **Systems should generally communicate via these events rather than direct references.**

| Topic | Triggered by | Usage |
| :--- | :--- | :--- |
| `phaseChanged` | `gameStateMachine` | Notifies systems to enable/disable UI or logic based on current phase. |
| `currencyChanged` | `resourceManager` | Updates HUD displays for Data, Insight, and Shards. |
| `upgradePurchased` | `upgradeManager` | Notifies `tower` or `upgradeDispatcher` to apply new stats/effects. |
| `enemyKilled` | `enemyManager` | Triggers resource drops and updates mission progress. |
| `healthChanged` | `tower` | Animates the Tower health bar and checks for death. |
| `waveComplete` | `waveManager` | Moves the game into the `WAVE_COMPLETE` phase. |
| `endIterationRequested` | `gameHUD` | Triggers the game reset/prestige workflow. |

---

## ─── Development Conventions ───

- **Constants**: Defined in `js/util/globals.js` (`GAME_CONSTANTS`). Extended in `js/gameConfig.js`.
- **Data Definitions**: `nodeDefs.js` (Upgrades), `loreDefs.js` (Unlockable content), `levelConfig.js` (Wave data).
- **Visuals & Effects**: `customEmitters.js` (Particle FX), `nodeAnims.js` (UI Tweens), `transitionManager.js` (Phase wipes).
- **Localization**: Key-value pairs in `js/localization/en.js`, accessed via `translations.js`.
- **Performance**: Use `spatialGridUtils` for proximity queries and `objectPool.js` for high-frequency entities (projectiles, floating text).
- **Edit Utils Directly**: Files in `js/util/` are generic; game-specific code belongs in `js/` root.
