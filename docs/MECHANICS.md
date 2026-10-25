# Axiom Zero: Mechanics as Implemented

The mechanics reference, derived from the code (October 2026). The code wins on any conflict; re-check cited numbers there before balance work.
`axiom-zero-gdd.md` now covers only concept, narrative, typography and visuals; the pre-June intent ("old GDD") is in `git show ad56a13^:axiom-zero-gdd.md`.
Divergences from it are marked **GDD Δ**; likely bugs or unclear intent are marked **⚠** and collected in [§10](#10-open-questions).

---

## 1. Core loop

### Phases

Phase names, flow and transitions: `docs/ARCHITECTURE.md` §4.

| Step | What happens | Code |
|---|---|---|
| Boot | Always lands in `UPGRADE_PHASE`. On a fresh save, only **AWAKEN** is visible. Buying AWAKEN spawns the tower, unlocks the cursor pulse and shows DEPLOY. | `gameInit.js`, `nodeDefs.js` (`awaken`) |
| DEPLOY | If `levelsDefeated >= 1`, opens **level select**. Otherwise goes straight to combat on level 1. Either way it runs through `transitionManager` (camera slide). | `upgradeTree.js` `_onDeployClicked`, `treePopups.js` |
| Combat | Wave timer, spawns, tower and weapons. See §3, §5 and §6. | `waveManager.js`, `enemyManager.js` |
| Results | The "iteration over" screen shows the session's DATA, INSIGHT, SHARD and PROCESSOR totals and an EXP bar animation. It also shows a weapon damage report if DIAGNOSTICS is owned. | `iterationOverScreen.js` |
| UPGRADES | Clears the field, resets the tower and transitions to the tree. | `iterationOverScreen.js` `_onUpgradesClicked` |
| RETRY | Restarts combat on the same level with no transition. **Disabled after a boss kill.** | `_onRetryClicked` |

### What ends a run

There are three ways. Each one goes to `WAVE_COMPLETE`.

- **Tower death** (`waveManager._onTowerDied`): enemies freeze, "SIGNAL LOST", results about 1.5 s later. Ignored if the boss already died (victory wins).
- **END WAVE** (HUD button → `endIterationRequested` → `waveManager.endIteration`): available all fight, disabled once the boss dies.
- **Boss kill:** `levelsDefeated = max(levelsDefeated, currentLevel)` (`waveManager.js` ~326), `stats.bossDef++` (`milestoneTracker.js` ~68), tower invincible 2.8 s (`tower.js` ~1601). After the scan cinematic the remaining non-boss enemies are killed and still drop DATA (`boss.js` ~68; waveManager's own call is commented out). Drops are vacuumed to the cursor ~2.65 s after the kill; `WAVE_COMPLETE {bossKill:true}` fires at 5.15 s (6.75 s on level 5+).

When a run ends (`resourceManager.clearDrops`), **resting DATA drops are lost**. Drops already flying to the cursor
are credited, and so is a dropped shard whether or not it was collected.

### Normal vs farming (endless)

Farming mode means `levelsDefeated >= currentLevel`: the player is replaying a level whose boss is
already beaten (`waveManager._startWave`). In farming mode:

- There is no progress bar, no boss and no regular miniboss. A survival timer is shown instead.
- The level uses its late spawn weights and tempo from the start.
- Farming minibosses spawn on a timer (§5).
- EXP gain is ×0.5.
- The run ends only by death or END WAVE.
- The best time per level is stored in `gameState.localBestScores` by `util/scoreManager.js`. Level select shows it. It is excluded from cloud sync.

### Persists vs resets

| Persists (on `gameState`) | Resets each combat start |
|---|---|
| All currencies, EXP progress (`exp`), upgrade levels | Tower HP (refilled), Backup Server and Failsafe "used" flags |
| `permanentHpBonus`, `leakPenalty` | Bomb charges, manual pulse charges (start at `ceil(max/2)`), combat shield HP |
| `levelsDefeated`, `minibossLevelsDefeated` | Enemy time scaling (`scaleFactor` restarts at 1), spawn timers |
| Duo choices (`activeShards`), revealed or unlocked nodes | Session totals (`resourceManager.resetSession`) |
| Lifetime stats, `takeoverState`, best scores, settings | DATA drop fractional accumulator is **not** reset (module-level) |

There is no prestige or wipe; every run adds to one save.

**GDD Δ:** the old GDD had negative base regen ("health drain") as the core time pressure, and it is
gone: `tower.js` `recalcStats` has the decay term commented out. Runs are now limited only by
enemy scaling. The old GDD also had "Tier Authorization", where boss kills gate tree tiers. That is
not implemented. `gameState.currentTier` is never advanced, and the tree has no boss gates.

---

## 2. Currencies

COIN is stored ×100 and displayed ÷100: `resourceManager.addCoin(30)` shows as **+0.3 COIN**, and a
node with `baseCost: 25, costType: 'coin'` costs 0.25 COIN (`nodeTooltip._formatValue`). HUD order is
DATA, INSIGHT, SHARD, COIN, PROCESSOR (`hud/CurrencyCluster.js`).

| Currency | Earned from | Spent on |
|---|---|---|
| **DATA** | Enemy drops (below). Passive sources: Packet Sniffer +1 every 2 s and Data Daemon +1 every 1 s, both during combat only. Boss hits with Memory Leak (cursor) or Data Mining (tower). Error Handling (tower hit by an enemy). Node grants: CHEAT +5000, Two-Step Auth +100, Unsecured Files +15 per level, Junk Data +10 per level, Completionist +20 per max-out. Bypass refunds. Takeover DATA targets. | Most nodes. Takeover breach costs. |
| **INSIGHT** | EXP: +1 per 100 EXP (§3). Takeover INSIGHT targets (always 1). CHEAT +4. | 14 one-INSIGHT nodes (e.g. COMPANION, MAGNETISM, ZIP STREAM, GLOBAL BACKDOOR, MEMORY LEAK, DATA DAEMON) |
| **SHARD** | 1 per **first** kill of each level's miniboss (`minibossDefeated` → `resourceManager.spawnShardDrop`), 5 in total. CHEAT +2. | Duo-box nodes, 1 each, 5 tiers |
| **COIN** | Takeover COIN targets. ENCRYPTED WALLET node +0.3 once. BLACK MARKET +0.1 per level (5 levels, 100/200/…/500 DATA). CHEAT +0.5. | 10 nodes at 0.10–0.40 (Backup Server, Auto-Restore, Overclock, Recursive Array, Fiber Optics, …) |
| **PROCESSOR** | Only Logic Strays drop it, and their spawn weight is 0 on every level. | Nothing. ⚠ (§10.5) |

**GDD Δ:**
- PROCESSOR was meant to fund unique mechanics.
- NETCOIN and the Crypto Mine (DATA→coin over time) were never built. COIN from Takeover replaced them.
- Bosses were meant to give 1 INSIGHT and a large DATA cache. No boss gives any currency now.

### DATA drops (`resourceManager._onEnemyKilled`)

- Every non-`test` `enemyKilled` adds this to a **fractional accumulator**:
  `baseResourceDrop × levelMult × 1.2 (ZIP STREAM) × 1.4 (PEAK TRAFFIC, wave time ≥ 20 s) + 1 (DIRECT EXTRACTION, cursor kills only)`.
  Each whole unit spawns one 1-DATA pickup, and the remainder carries over to the next kill.
- `baseResourceDrop` per type is in §5.
- `levelMult` is the level's `dataDropMultiplier` (§6).
- Cache enemies get 1.5× the level *bonus*. For example, ×1.5 becomes ×1.75.
- **Collection:** the cursor picks up drops within `75 × (1 + 0.4·magnet)` px, +20 px on mobile (`_recalcPickupRadius`).
  - Picked-up drops fly to the cursor and are credited on arrival.
  - New drops are locked for about 160 ms plus a slice of their spawn tween.
  - Shards are locked for 1.65 s, then fly to the cursor on their own ~2.5 s after dropping.
  - Drops never expire during a fight.
- **Vacuum:** `triggerResourceVacuum`, published only after a boss kill, sends every resting drop to the cursor.

---

## 3. The tower and weapons

### Core stats (`tower.js` `recalcStats`, `getDamage`; constants in `gameConfig.js`)

| Stat | Formula / value | Modified by |
|---|---|---|
| Max HP | `10 + 5·integrity + 20·system_redundancy_new + 40·physical_anchor + permanentHpBonus` | INTEGRITY (×4), SYS REDUNDANCY, PURCHASE SERVERS, TRIAL & ERROR |
| Damage | 0 until AUTO DEFENSE; then `5 + 2·intensity`, ×(1 + 0.05·owned leaky nodes) with VOLATILE CACHE | FIREPOWER (×3), PEAK PERFORMANCE (+4 above 89.5% HP), PARALLEL PROCESSING (+2), KERNEL BREAKER (+25% per level vs bosses) |
| Range | 0 until AUTO DEFENSE; then `230 × (1 + 0.2·coverage + 0.2·farsight)` | COVERAGE, FARSIGHT |
| Attack cooldown | `1000 × (1 − 0.05·clock_speed) × 0.9 (fiber_optics)` ms | CLOCK SPEED (×4), FIBER OPTICS; ×2 attack speed under 50% HP with EMERGENCY OVERCLOCK |
| Regen | `0.4·regen` HP/s, never negative | AUTO-RESTORE (0.20 COIN) |
| Armor | flat −`armor` per hit, then ×0.9 with PROXY ROUTING ⚠ (§10.9) | ARMOR (×2) |

Notes:

- **Auto-attack:** fires at the nearest enemy in range. While nothing is in range, the timer is held ready, so the first enemy to arrive is shot at once.
- **Shot variants** (duo tier 5):
  - ASSAULT: bursts of `3 + clip_size` shots, each at `dmg − 2`.
  - ROCKET: an area blast of radius 100, or 130 with HE COMPOUND. CHAINED BLAST adds a 16-damage secondary blast on kill.
- **RECURSIVE ARRAY** (`prismatic_array`, under FARSIGHT): 40% chance of an extra core shot.
- **EXP → INSIGHT:**
  - EXP accrues only while the tower is alive in combat, at `0.62 × boost` per second, and 100 EXP = 1 INSIGHT. That is about 161 s per INSIGHT.
  - The boost depends on lifetime `stats.insightEarn`: ×1.4 at 0, ×1.2 at 1, ×1.1 at 2 ⚠ (§10.12). Farming mode applies ×0.5 on top.
  - No node changes the rate.
- **Heals:**
  - MALWARE SIPHON: +0.5 per death near the tower.
  - SUSTAINING SIPHON: +1 per resonance kill.
  - HARVEST: +1 per scythe kill.
  - ROLLBACK POINT (`threat_response`): heals to 50% when a boss or miniboss spawns.
  - TRIAL & ERROR: +2 max HP on death or backup trigger, up to +4 per wave, permanently.
- **Low-HP warning:** the first survived hit per wave that drops HP below 20% (50% with OVERCLOCK or FAILSAFE) triggers a shockwave visual and a brief slow-mo. A red vignette shows whenever HP is at or below 25%.
- **FAILSAFE:** fires on that same warning. Enemies within 800 px are pushed back and slowed.
- **BACKUP SERVER:** once per wave, a lethal hit leaves the tower at 1 HP (40% with RESTORE POINT). It gets 3 s of invincibility and pushes back enemies within 350 px.
- **Death:** `towerDied` fires, then the sequence in §1.
- **GDD Δ:** `tower.js` still reads the GDD's AUX POWER (`base_hp_boost`, which it applies as +4 tower damage per level), `focus_range_2` and `focus_range_3`; none exist in `NODE_DEFS` ⚠ (§10.8).

### Cursor pulse and bomb (`cursorAttack.js`, `upgradeDispatcher.recalcPulse*`)

- **Pulse:**
  - Unlocked by AWAKEN. It hits a square area centred on the cursor.
  - Damage is `4 + 2·focus + 2·parallel_processing`.
  - Size is `100 × (1 + 0.25·signal_boost + 0.3·broadcast + 0.5·colossal)`.
  - Interval is 2000 ms; ×0.75 with FAST RELOAD, ×0.9 with FIBER OPTICS.
- **Modes** (duo tier 2):
  - Default and **BROADCAST** auto-fire every interval wherever the cursor is.
  - **MANUAL CONTROL** fires on click instead. It gains 1 charge per interval, holds `2 + charge_buffer` charges, and starts each wave with half.
- **Modifiers:**
  - ISOLATION (+50% per level vs a single target)
  - SATURATION (+1 per extra enemy hit)
  - REPEAT EXPLOIT (+1 per successive hit)
  - IMPULSE (+50% vs full HP)
  - INSTABILITY (marks the enemy; the next non-cursor hit does +10)
  - AFTERSHOCK (a second, larger hit for 4 or 8 damage)
  - **RESONANCE:** every 4th pulse does ×2 damage (×3 with AMPLITUDE); CRESCENDO makes it +100 px larger ⚠ (§10.9).
- **Bomb:**
  - BOMB and BOMB 2 give one charge each. Charges refill on every phase change.
  - Arm with **Space** or the HUD button, then click or press Space to detonate at the cursor. Cancelling refunds the charge.
  - Damage is `pulseDamage + 40 (+30 LETHAL EXPLOSIVE)` in a square of side `size + 500`, and it slows enemies.
  - Arming during the upgrade phase starts the combat-test sandbox, where charges are unlimited.

### Shard weapons and abilities

Shard cooldowns are reduced by 500 ms below 50% HP with STRESS CALIBRATION, then ×0.9 with FIBER OPTICS
(`upgradeDispatcher.getShardCooldown`).

| Weapon (file) | Unlock | Behaviour | Modifiers |
|---|---|---|---|
| Lightning (`lightningAttack.js`) | duo tier 1 | 12 damage to the nearest on-screen enemy every 3 s. Chains to 2 enemies total (jumps up to 130 px). | FORK +2 chain targets; INITIAL SHOCK +4 per level vs ≥80% HP |
| Shockwave (`shockwaveAttack.js`) | duo tier 1 | 12 damage in a 135 px radius around the tower every 3 s, plus a slow and a small knockback | AMPLIFIER ×1.25 radius; DESTABILIZE `+floor(missingHP/12)` per level |
| Laser (`laserAttack.js`) | duo tier 3 | An orbiting turret fires a 1000 px piercing beam for 4 s, then cools down for 4 s. 3 damage per 200 ms tick, ramping up per enemy. | APERTURE +15 half-width; TWIN BEAMS (a second beam on the opposite side) |
| Artillery (`artilleryAttack.js`) | duo tier 3 | Every 6 s, a 432 px square strike for 20 damage, landing 1.5 s after it is called at a predicted enemy position | TRIPLE VOLLEY +2 strikes; FIRST STRIKE +20 per level vs >80% HP |
| Sword (`swordAttack.js`) | duo tier 4 | Every 2 s, stabs a 225×60 line toward the nearest enemy within 320 px for 25 damage | LUNGE ×1.25 length; FLURRY +2 side stabs at 60% damage |
| Scythe (`scytheAttack.js`) | duo tier 4 | Every 2 s, a 110° arc at 190–330 px for 20 damage, aimed at the densest angle | LETHALITY +10 per level vs <50% HP; HARVEST +1 HP per kill |
| Combat shield (`combatShield.js`) | COMBAT SHIELD (50 DATA) | Follows the mouse direction and blocks hits within ±50° of its facing. Refills each combat start. | REINFORCED PLATING +10 HP per level (×3) |
| Hijack (`Hijack.js`) | HIJACK (200 DATA) | Resonance kills of non-bosses spawn homing missiles (count is `hijacksSpawned` per enemy type). Each deals `6 × scale × lsm` in a 90 px radius. | RECURSION: missile kills spawn more missiles |

---

## 4. Upgrade tree

Defined by `NODE_DEFS` in `js/nodeDefs.js` (110 nodes) plus `LORE_DEFS` in `js/loreDefs.js` (9, pushed
into `NODE_DEFS`), 119 in total. Logic is in `js/treeNode.js` (`Node`) and `js/duoNode.js`; effects
route through `js/upgradeDispatcher.js`.

### Node model

- **Cost** (`Node.getCost`):
  - `static`: `baseCost`.
  - `linear`: `baseCost + costStep·level + costStepScaling·level(level+1)/2`.
  - `custom`: `customCost[level]` (unused).
  - Then `+ leakPenalty` if the node is leaky.
  - Then −30 for DATA-cost nodes once GLOBAL BACKDOOR is owned (floor 0).
- **Cost types:** `data`, `insight`, `shard`, `coin` (`processor` is supported but unused).
- **Prerequisites:**
  - Default: *any* parent at level 1 or higher.
  - With `requiresMaxParent`: *all* parents must be maxed. For example, BOMB needs both COVERAGE and SIGNAL BOOST maxed.
  - Parents on an inactive duo branch don't count.
- **States** (`NODE_STATE`):
  - `HIDDEN`: the parent is hidden or unbought.
  - `GHOST`: shown faded. Used when the parent is bought but requirements aren't met yet, for nodes revealed by an event, and for **purchased nodes on an inactive duo branch**.
  - `UNLOCKED`: purchasable.
  - `MAXED`.
- `gameState.revealedNodes` / `unlockedNodes` / `ghostNodes` force those states from events.
- **Placeholders** (`placeholder_duo_N`) auto-max once tier N's duo box is bought. They gate post-duo branches.

### Duo boxes (choice nodes)

There are 5 tiers, each costing 1 SHARD:

| Tier | Choice | Parent |
|---|---|---|
| 1 | SHOCKWAVE / LIGHTNING | AUTO DEFENSE |
| 2 | BROADCAST / MANUAL CONTROL | REPEAT EXPLOIT |
| 3 | LASER / ARTILLERY | DIAGNOSTICS |
| 4 | SWORD / SCYTHE | STRESS CALIBRATION |
| 5 | ASSAULT / ROCKET | PEAK PERFORMANCE |

How a purchase works:

- Buying either side sets **both** siblings to level 1 and records `activeShards[tier]` (`_handleDuoBoxPurchase`).
- Clicking the inactive side later is a **free swap** (`_handleDuoSwap`). The old side's sub-branch turns GHOST: levels are kept, and `getLevel` returns 0 for them.
- The first duo purchase ever shows the "swapping is free" tutorial.

**GDD Δ:** the old GDD planned 7 tiers plus Override and Synthesis (INSIGHT→SHARD). Neither exists ⚠ (§10.6).

### Leaky nodes

Nodes with `leaky: N`: SYS REDUNDANCY 5, IMPULSE 5, ACCESS INTERNET 10, TROJAN PAYLOAD 10, BYPASS 10,
BYPASS 2 10, TRIAL & ERROR 20 and CRESCENDO 20.

- Buying one adds N to `gameState.leakPenalty` (`Node.purchase`) and plays a short "system shock" glitch.
- The penalty is added to the cost of every other leaky node. It does nothing else; there is no combat effect.
- VOLATILE CACHE turns the count of owned leaky nodes into +5% damage each.

### Special nodes

| Node | Effect |
|---|---|
| AWAKEN | Free. Cutscene, then spawns the tower and the pulse, and shows DEPLOY. Purchase is finalised after the animation (`delayActualPurchase`). |
| REVEAL MAP (40 DATA, after the tier-1 duo) | Cutscene. Enables the full-view tree slide and the currency HUD, and reveals REPEAT EXPLOIT, ARMOR, DIAGNOSTICS and GLOBAL BACKDOOR as ghosts. |
| BYPASS (75), BYPASS 2 (150), SECURITY TEST 3 (1000) | Refund `lastPaidCost` in full. These are gates: you must hold the DATA, but they are free net of the leak penalty they add. SECURITY TEST 3 has no children ⚠ (§10.7). |
| COMPLETIONIST (1 INSIGHT) | +20 DATA whenever any node is maxed. |
| FINANCIAL BREACH (400 DATA, parents PROXY ROUTING / FIBER OPTICS) | Shows the TAKEOVER button in the tree (§7). Children: SHELL CONTRACTS (breaches ×1.5 speed) and DATA DAEMON. |
| SANDBOX (`test_defenses`, 10 DATA) | Adds the COMBAT TEST button to the upgrade phase. It spawns `5 + levelsDefeated` test enemies that give no rewards. |
| COMPANION (1 INSIGHT) | Plays Dot's intro dialog (§8). Its child DEBUG SPAWN (`spawn_hello_world`) attaches a test node from `disabledNodes.js` ⚠ (§10.1). |
| **CHEAT** (free, child of AWAKEN) | +5000 DATA, +4 INSIGHT, +2 SHARD, +0.5 COIN, heals 10. It has no `FLAGS.DEBUG` gate, so it is purchasable right after AWAKEN. It is the only parent of **18 real nodes** (ancestor of 19): VOLATILE CACHE, KERNEL BREAKER, PEAK TRAFFIC, CLOCK SPEED, COMPLETIONIST, TWO-STEP AUTH, JUNK DATA, UNSECURED FILES, ZERO-DAY EXPLOIT, PURCHASE SERVERS and ARCHIVE I–III, V–IX ⚠ (§10.1). |
| Lore nodes (`loreDefs.js`, 1 DATA each) | ARCHIVE I–IX. Buying one swaps its description for a log entry (the dev's diary of the AI's escape). All are under CHEAT; ARCHIVE IV is under ARCHIVE III. Source text is in `lore.txt`; `maxed_node_lore.txt` is a writing doc and is not read by code. |

### Branches (roughly, bottom-up from AWAKEN)

- **Tower offense:**
  - AUTO DEFENSE → FIREPOWER → COVERAGE → DIRECT EXTRACTION → TROJAN PAYLOAD (exploders; VOLATILE PAYLOAD).
  - Late: INSTABILITY → PEAK PERFORMANCE → duo 5 / DATA MINING → FARSIGHT → RECURSIVE ARRAY (`prismatic_array`).
- **Cursor:**
  - FOCUS → SIGNAL BOOST → BOMB (also needs COVERAGE) → RESONANCE → CRESCENDO / AMPLITUDE / SUSTAINING SIPHON → HIJACK → MEMORY LEAK → BYPASS 2 → PARALLEL PROCESSING.
  - IMPULSE / TROJAN → REPEAT EXPLOIT → duo 2.
- **Survival:**
  - INTEGRITY → ERROR HANDLING → TRIAL & ERROR.
  - REVEAL MAP → SYS REDUNDANCY → ARMOR / COMBAT SHIELD → AUTO-RESTORE, DIAGNOSTICS → ZIP STREAM → FAILSAFE → RESTORE POINT.
  - BOMB 2 → PACKET SNIFFER → STRESS CALIBRATION → BACKUP SERVER (→ ROLLBACK POINT), EMERGENCY OVERCLOCK, duo 4.
- **Economy / network:**
  - AUTO DEFENSE → MAGNETISM → SANDBOX → BYPASS → BOMB 2.
  - REVEAL MAP → ACCESS INTERNET (cache enemies) / ENCRYPTED WALLET → GLOBAL BACKDOOR → FIBER OPTICS, BLACK MARKET, PROXY ROUTING → FINANCIAL BREACH.

Layout rules are in `docs/UPGRADE_TREE_LAYOUT.md`.

---

## 5. Enemies

Scaling notation:
- `s = scaleFactor × lsm`, where `scaleFactor = 1.07^floor(t/6)` and `lsm` is the level's `levelScalingModifier`.
- HP scales by `s`.
- Contact damage scales by `1 + (s−1)·0.5` (`ENEMY_DAMAGE_SCALING_EFFICIENCY`).
- Speed does not scale with time; it is multiplied by the level's `speedMultiplier`.
- Base values (`gameConfig.js`): HP 6, damage 2, speed 31 px/s.

**Contact:**
- An enemy within `15 + size×1.1` px of the tower stops and deals its damage every 2.0 s.
- After each hit the tower survives, the enemy takes `selfDamage`.
- An enemy killed this way publishes `enemyKilled` and drops DATA (`enemyManager.js` ~1067 → `_killEnemy`).

| Type (file) | HP | DATA | Behaviour |
|---|---|---|---|
| Basic (`basic_enemy.js`) | 6s | 0.8 | Walks straight in and dies on first contact. |
| Fast (`fast_enemy.js`) | 6s | 1.5 | 2.5× speed, 1.25× damage, survives one contact. A fast roll starts a pack: later basic rolls turn fast at 60% each until there are 3, then a 5 s cooldown (4 s if the pack breaks after 2 or more). |
| Heavy (`heavy_enemy.js`) | 30s | 3 | 0.75× speed, 1.5× damage, survives 4 contacts, reduced knockback. |
| Swarmer (`swarmer_enemy.js`) | 3s | 0.4 | 1.25× speed. Spawns in arcs of `swarmerGroupSize`. |
| Shooter (`shooter_enemy.js`) | 6s | 1.5 | Stops at 160 px and fires a 2-damage bullet every 2.5 s. |
| Sniper (`sniper_enemy.js`) | 12s | 4 | Stops at 250 px and fires a 4-damage bullet every 5 s. No knockback. |
| Protector (`protector_enemy.js`) | 15s | 3 | No contact damage. Parks at 210 px; other non-boss enemies within 210 px take 50% damage. |
| Exploder (`exploder.js`) | 6s | 1 | Only from TROJAN PAYLOAD: after at least 4 spawns, a 9.2% roll converts the next basic. On death it deals 1.25× its max HP to nearby *enemies* (radius ×1.5 with VOLATILE PAYLOAD) ⚠ (§10.9). |
| Cache / "loot goblin" (`cache_enemy.js`) | 21s | 12 | Needs ACCESS INTERNET, which also gives basics a 10% chance to become caches until the first cache spawns ⚠ (§10.14). Flies past the tower, speeds up when hit, and drops 2 DATA per hit. Escapes beyond 1250 px. Soft cap of 1 (`enemyManager.js` ~293): a cache roll becomes basic 80% of the time while one is active, 40% while none is. |
| Logic Stray (`logic_stray_enemy.js`) | 12s | 0 | Flees when hit and drops 1 PROCESSOR. **Weight 0 on every level**, so it never spawns ⚠ (§10.5). |
| Shell (`shell_enemy.js`) | 12·lsm | 0 | Fast projectile-enemy, only spawned by Boss Defender's bombard. |
| Test (`test_enemy.js`) | 6·lsm | 0 | Sandbox target. Kills are ignored by rewards and stats. |

### Minibosses (`miniboss_*.js`, `bossManager.js`)

- Spawn at 50% wave progress, only while `minibossLevelsDefeated < currentLevel`.
- Wave progress **pauses** until the miniboss dies.
- Reward: 1 SHARD and `minibossLevelsDefeated = level`. There is no DATA and no `enemyKilled`, so no kill stat.

| | Level | HP | Behaviour |
|---|---|---|---|
| MB1 | 1 | 70 | Stops at 230 px and fires a 5-damage bullet every 4 s. |
| MB2 | 2 | 250 | Repeated lunges for 8 damage, sticking 2 s each time. Freezes the shield. Spawns with 2 fast escorts. |
| MB3 | 3 | 560 | Slow, size 98. Slams for 6 damage at contact every 2.5 s. |
| MB4 | 4, 5 | 260 | Stops at 425 px and fires a charged 15-damage bullet every 6 s. |

**Farming minibosses** (`enemyManager.js` ~949):
- First at 30 s, then every 60 s.
- 85% MB1, 15% MB3.
- HP is `60·lsm·2.2^(n−1)`, ×3 for MB3.
- No shard. They *do* publish `enemyKilled`, worth 10 or 30 DATA ⚠ (§10.3).

### Bosses (`enemies/boss*.js`, `bossManager.js`)

- Spawn at 100% progress on an unbeaten level.
- Boss HP is fixed; it does not scale with time.
- Regular spawning continues, +225 ms per alive boss and miniboss (§6).

| Level | Boss | HP | Behaviour |
|---|---|---|---|
| 1 | BossCircle | 260 | Approaches to about 225 px, then a cycle of back-off, lunge and a 25-damage hit. |
| 2 | BossDefender | 295 | Orbits at 265 px firing 2.5-damage bullet pairs. Every 3 pairs it flanks and bombards with 2 Shell enemies. |
| 3 | BossLegion | 6 × 333 | Six shards in a ring. Every 3 s they share HP with weaker neighbours. Shared attack starts at 7 damage and gains +1 per hit. |
| 4 | Boss4 "EXECUTE" | 1050 | Traces a line, then rockets in for a 24-damage hit with slow-mo, grinds, and retreats. |
| 5 | Boss5 | 1500 | Slam for 15 damage every 3 s. Lingers at 1 HP for 1.5 s before dying. |
| — | BossSquare | 200 | Fallback only; no level uses it. |

**GDD Δ:** the old GDD planned 7 tier bosses plus a "Reckoning" (Monoliths 0x01–0x08). The code has
5 levels ⚠ (§10.2).

---

## 6. Levels, spawning, difficulty (`levelConfig.js`, `enemyManager.js`, `waveManager.js`)

- **Level select** (`treePopups.js`):
  - Shown on DEPLOY once a boss is beaten.
  - Shows levels 1 to `min(levelsDefeated + 1, 5)`.
  - Shows "(ENDLESS)" for beaten levels ⚠ (§10.11), "+N% DATA" and the best farming time.
  - Levels above 5 fall back to level 5's config.
- **Wave length:** 50 s, or 46 s if the level's miniboss is already beaten. Progress pauses during a miniboss.
- **Spawn interval:**
  - Starts from `spawnInterval`, which switches to `lateSpawnInterval` after 9.5% progress.
  - ÷`1.02^floor(t/6)`.
  - ×1.75 if the player owns 1 or fewer nodes.
  - ×`0.92^(1+floor(t/60))` in farming mode.
  - +225 ms while a boss is alive and another +225 ms while a miniboss is alive (they stack).
  - In the "opening rush", enemies spawn and move at ×27 for about the first 1 s of each fight (until `combatTime` 5.05), then ramp back to ×1 over 1.25 s.
  - A spawn pause of `spawnPauseDuration` (default 3000 ms) follows each 6 s scale step ⚠ (§10.10).
- **Weights:** `initialWeights` until 50.5% progress; `lateWeights` merged over them after that, or always once the miniboss or level is beaten.
- **`ENEMY_SPAWN_RULES`** sets a minimum `combatTime` per type (swarmer, sniper 6; protector 7; fast, cache 8). `combatTime` starts at 4 and pauses while a boss or miniboss is alive, so 8 means about 4 s into the fight.

| Lvl | Boss / MB | DATA× | lsm | speed× | Interval early → late (ms) | Pool (late changes) |
|---|---|---|---|---|---|---|
| 1 | Circle / MB1 | 1.0 | 1 | 1 | 1075 → 600 | basic, swarmer (late: +shooter, cache) |
| 2 | Defender / MB2 | 1.25 | 1.5 | 1 | 550 → 450 | basic, shooter, swarmer (late: +fast, cache, −shooter) |
| 3 | Legion / MB3 | 1.5 | 2 | 1 | 475 → 125 | basic, fast, shooter, swarmer, cache (late: +heavy, −shooter) |
| 4 | Boss4 / MB4 | 1.8 | 3 | 1 | 450 → 475 | basic, swarmer, heavy, cache, protector (late: +shooter, sniper) |
| 5 | Boss5 / MB4 | 2.2 | 4.2 | 1.1 | 475 | as level 4 |

⚠ Interval outliers: §10.10.

---

## 7. Takeover / Financial Breach (`takeoverTargets.js`, UI in `takeoverPopup.js`)

- Unlocked by FINANCIAL BREACH. The TAKEOVER button is in the upgrade phase only.
- The terminal offers **3 targets**, and one breach runs at a time.
- Starting a breach pays DATA up front.
- Breaches run on wall-clock `Date.now()`, so they **progress offline and during combat**. Completion is checked on load (`_loadState`) and while the tree is open.
- A finished breach waits as a pending reward until claimed. Claiming re-rolls the targets.
- **Abort** refunds `floor(75%)` of the cost and also re-rolls.

| Security (roll weight) | DATA cost | Duration | COIN payout | DATA payout (ROI on cost) |
|---|---|---|---|---|
| LOW (50%) | 25–75 | 45–60 s | 5–15 (0.05–0.15) | ×1.20–1.40 |
| MEDIUM (35%) | 75–200 | 60–120 s | ×2.5 | ×1.35–1.55 |
| HIGH (15%) | 200–500 | 60–270 s | ×5 | ×1.50–1.70 |

- **Reward type:** 60% COIN, 30% DATA, 10% INSIGHT.
  - No DATA targets are offered right after the player picked a DATA target.
  - At most one INSIGHT target per roll, then none for the next 2 rolls.
  - INSIGHT targets pay exactly 1 INSIGHT for 200–300 DATA.
- **Net effect:** DATA targets always profit. COIN costs about 400–750 DATA per COIN (`npm run takeover-sim`).
- **Speed:** SHELL CONTRACTS divides durations by 1.5.
- **Tutorial:** the first-ever roll shows 2 fixed cards: a 4-second breach for 10 DATA → 15 DATA, and a 45-second breach for 25 DATA → 0.15 COIN. It ends on the first claim or abort.
- The first claim triggers Dot's `first_breach` dialog (§8).
- Tests: `tests/takeover.test.js`. In-game: the `test-takeover` skill.

---

## 8. Companion, dialogs, tutorials, milestones, achievements

- **Dot (companion)** (`dialogSystem.js`):
  - Exists only as dialog; there are no combat effects.
  - The intended companion nodes (Uninstall, Sharp Teeth, Data Scavenger, Reinstall) sit unused in `disabledNodes.js`.
  - Dialogs play only in the upgrade phase. They are typewriter sequences with a portrait, defined in `DIALOG_SEQUENCES`.
  - Two sequences exist: `companion_online` (bought COMPANION) and `first_breach` (first claimed takeover, only if COMPANION is owned, flagged in `tutorialsSeen.first_breach`).
  - **GDD Δ:** Dot's broader "malicious compliance" arc is planned but has no story beats yet.
- **Tutorials** (`tutorialManager.js`): one-shot text popups.

  | Popup | When it shows |
  |---|---|
  | "CONTROLS: MOUSE ONLY" | Desktop, no nodes bought |
  | Cursor-damage hint | First combat with only AWAKEN |
  | "Collect DATA" | First combat with only AWAKEN; spawning is paused 6 s for it |
  | "Spend DATA" | Back in the tree with DATA and only AWAKEN |
  | "Unlock with ♦" | First time the player holds a shard |
  | "Swapping is free" | First duo purchase |
  | Bomb hint (Space, or click on mobile) | Until the first bomb is detonated |

- **Milestones** (`milestoneTracker.js`):
  - 10 milestones on lifetime stats: kills 100/500/2000, DATA 1k/10k, waves 10/50, nodes 5/15, 1 boss. Rewards are DATA or INSIGHT.
  - `claim()` exists but has no UI ⚠ (§10.4).
  - The stat tracker is live: `gameState.stats`, aggregated at each run end.
- **Achievements** (`achievementManager.js`):
  - Exe builds only (`FLAGS.IS_EXE`), silent, intended for Steam.
  - FIRST_ITERATION, HEAVY_HITTER (a hit of 100 or more), BOSS_SLAYER_1, CENTURION (100 kills).

---

## 9. Settings, controls, saving (player's view)

- **Options** (`uibuttons.js`), opened by the top-right button or Esc. Opening it pauses the game (`gamePaused`).
  - Music and SFX volume sliders (default 0.85)
  - Chromatic aberration, damage numbers, big font, fullscreen
  - Particles FULL / MINIMAL
  - A controls list, which takes the language slot until a second language ships
  - EXPORT / IMPORT save, RESET PROGRESS (with a confirm step)
- **Hotkeys** (`hotkeys.js`, plus Space in `cursorAttack.js`):

  | Key | Action |
  |---|---|
  | Esc | Closes the top popup (reset confirm → Options → level select), otherwise opens Options. Ignored while the takeover terminal is open, which handles Esc itself. |
  | P | Toggles pause, combat only |
  | M | Mutes or unmutes music and SFX together |
  | Space | Arms or detonates the bomb. In the full tree view, slides back. |

- **Auto-pause:** in combat, hiding the tab or blurring the window opens Options.
- **Saving** (`util/gameState.js`): progress saves on phase changes only, so reloading undoes a tree misclick; settings save immediately via `saveSettings()`.
  Mid-phase exceptions: §10.13. Format, export/import, reset and cloud mirroring: `docs/ARCHITECTURE.md` §7.4.

---

## 10. Open questions

1. **CHEAT node:** free +5000 DATA / +4 INSIGHT / +2 SHARD / +0.5 COIN, available in normal play right after AWAKEN. It is the sole parent of 18 real nodes (19 counting ARCHIVE IV), including all lore. Is it dev scaffolding (those nodes need new parents) or the GDD's post-game "Cheat Mode"? `spawn_hello_world` (DEBUG SPAWN under COMPANION) belongs with this decision.
2. **Monoliths 6–8** (and the final fight) are undesigned. The code has 5 levels.
3. **Farming minibosses** publish `enemyKilled`, so they drop DATA, count as kills, and trigger Malware/Sustaining Siphon and Hijack. Regular minibosses don't. Should both behave the same?
4. **Milestone claim UI is missing.** Milestones track progress, but nothing can grant their rewards.
5. **PROCESSOR** has no source (Logic Stray weight is 0 on every level) and no sink.
6. **Surplus SHARDs:** CHEAT's +2 have nothing to buy, because Override and Synthesis were not built.
7. **SECURITY TEST 3** (1000 DATA, refunded) has no children; it gates nothing.
8. **Missing nodes still read in code:**
   - `base_hp_boost` (+4 tower damage per level), `focus_range_2`, `focus_range_3` (`tower.js`)
   - `laser_disintegration`, `artillery_stun` (`upgradeDispatcher.js`)
9. **Descriptions that disagree with code:**
   - PROXY ROUTING says 20%; the code does 10%.
   - TROJAN PAYLOAD says 7%; the code is a 9.2% roll gated by 4 spawns.
   - CRESCENDO says "+100% size"; the code adds +100 px.
10. **Spawn tuning:**
    - The spawn-pause modulo (`currentScaleLevel % 1`) is always true, so the pause comes every 6 s rather than the commented ~12 s.
    - Level 3's late interval of 125 ms is an outlier.
    - Level 4's late interval is slower than its early one.
    - Level 5 has no late interval.
11. **Level select** doesn't label level 5 "(ENDLESS)" once every level is beaten, though it plays as farming (`treePopups.js`: `isEndless = selected < maxDisplayLevel`).
12. **EXP first-run boost:** the ×1.4 boost reads `stats.insightEarn`, which only updates at run end. It therefore lasts the whole first run, not just until the first INSIGHT.
13. **Mid-phase `saveGame()` calls** (takeover start/abort/completion/claim, achievement unlocks, the first-breach dialog flag, a new farming best score) also persist unconfirmed tree purchases. That weakens the "reload undoes a misclick" rule.
14. **ACCESS INTERNET cache boost** (basics 10% → cache) is one-shot by design: set on purchase (`nodeDefs.js` ~1727), cleared by the first cache spawn (`enemyManager.js` ~449) and not saved. Intended?

More notes on engineering, balance and performance are in `BACKLOG.md`.
