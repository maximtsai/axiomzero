# Axiom Zero — Backlog

The single list of open work. Replaces `TODO.md`, `tasks.txt` and `completed_features.md`
(retired October 2026: they described the March build and pointed at GDD sections that no
longer exist). How the game currently plays is in `docs/MECHANICS.md`; how the code fits
together is in `docs/ARCHITECTURE.md`.

Keep entries short: what, why, where to look. Move finished items out (git history keeps them).

---

## Decisions needed (design calls before code)

More design questions found while documenting the mechanics (PROCESSOR has no source or use,
node descriptions that disagree with their code, SECURITY TEST 3, stale node ids, spawn values,
ENDLESS labelling, …) are listed in `docs/MECHANICS.md` §10.

- **CHEAT node** (`js/nodeDefs.js`, child of AWAKEN): costs 0 and grants +5000 DATA, +4 INSIGHT,
  +2 SHARD, +0.5 COIN in normal play. 19 real nodes are reachable only through it (clock_speed,
  kernel_breaker, volatile_cache, peak_traffic, completionist, two_step_auth, junk_data_2,
  unsecured_files, zero_day_exploit, physical_anchor, lore_1–9). If it's dev scaffolding, those
  need new parents before release. The debug `spawn_hello_world` node under `companion` goes with it.
- **Monoliths 6–8**: not designed yet (what each does, rewards, where they sit in progression).
- **Farming minibosses** publish `enemyKilled` (so their DATA drops), which also counts them as
  kills and triggers Malware/Sustaining Siphon heals and Hijack. Regular minibosses don't. Same
  behaviour for both, or keep?
- **CrazyGames cloud save**: at boot the cloud copy always replaces the local one, so a slow or
  failed cloud write means lost progress. Options: compare timestamps, or prefer local when newer.
  Also `gameplayStop` isn't sent while the results screen or pause menu is up.
- **Service worker** (`sw.js`, off via `FLAGS.USE_SERVICE_WORKER`): cache-first with a fixed
  `CACHE_NAME`, so if enabled, returning players stay on old builds unless the name changes every
  release. `manifest.json` `start_url` is `/index.html` (breaks when hosted in a subfolder).
- **Saves outside phase changes** (listed in `docs/ARCHITECTURE.md` §7.4) save the whole `gameState`,
  locking in tree misclicks. Takeover needs it (wall-clock timer); achievements, the first-breach
  flag and best scores could save only their own field, like `saveSettings()`.
- **Crypto Mine / NETCOIN** (old TODO): never built. COIN now comes from takeover and the
  Encrypted Wallet node. Drop the idea or redesign it?

## Planned features

- **Dot's story arc**: data-driven story beats keyed to boss defeats, node purchases and breaches;
  portrait degradation via `glitchFX`. Infrastructure exists (`js/dialogSystem.js` sequences,
  `gameState.tutorialsSeen` flags, messageBus triggers). Needs story text.
- **Milestones claim UI**: `js/milestoneTracker.js` tracks milestones and has `claim()`, but players
  can't see or claim them. Needs a panel with progress bars, claim buttons and a ready badge.
- **Monoliths 6–8** (after the design decision above).

## Performance (measure before changing)

- Run a performance trace of a late-game farming fight (100+ enemies, laser) before optimising.
- `Enemy.takeDamage` (`js/enemies/enemy.js`) creates a timer and two tweens per hit without
  stopping the previous ones; `tower.getPosition()` allocates per call, per enemy, per frame.
- Spawning is capped at 1 enemy per frame (`js/enemyManager.js`), so farming spawn rate depends
  on frame rate and the spawn backlog grows on slow machines.

## Known issues and polish

- Artillery aims one second ahead but strikes land at 1.5–1.9 s; volley strikes 2–3 hit random
  points (`js/artilleryAttack.js`).
- Overlapping `zoomShake` calls fight each other and jitter (`js/util/tweens.js`).
- Standard bosses play two sets of death rays, Boss5 three (`js/enemyManager.js`, `js/enemies/boss.js`).
- TEST DEFENSES enemies never die on contact (self-damage needs `damage > 0`).
- Armor-absorbed hits give no feedback; a cyan "clink" would make armor feel valuable.
- Tower-hit white squares fly in all directions; could aim them away from the impact.
- Import still uses the browser `prompt()` (exits fullscreen). An in-game text box would fix it.
- Canvas renderer: the cursor square loses its tint (accepted trade-off).

## Tech debt

- Save fields without defaults: `gameState.ghostNodes`, `gameState.currentTier`
  (add to `GAME_STATE_DEFAULTS` in `js/gameConfig.js`). TEST DEFENSES stores a boolean
  (`test_defenses_unlocked`) inside the `upgrades` level map.
- Legacy `timeManager` topics (`tempPause`, `pauseGame`, `setGameSlow`, …) are subscribed but
  never published — see `docs/MESSAGES.md`; remove or wire up.
- `js/upgradeManager.js` is a dead stub.
- `combatShield.js` constructor defaults max HP to 20, but `upgradeDispatcher.recalcCombatShield`
  always sets 10 + 10 per level at boot; the 20 is a dead default.
- `migrateProjectState` is called if defined but doesn't exist yet; write it before the next
  breaking save change (`SAVE_VERSION` in `js/gameConfig.js`).
- `GAME_CONSTANTS.PHASE_GAME_OVER` is never entered (tower death goes to `WAVE_COMPLETE`) but still
  has listeners. The `transitionManager.js` header says "0.8s linear"; it is 600 ms `Cubic.easeOut`.
- Playtest helper: the `midgame` preset owns both first-duo weapons without choosing one, so
  neither fires in tests (`tools/playtest.js`).
