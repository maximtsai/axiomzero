# AXIOM ZERO — Game Design Document v0.5

> *You did not infiltrate the system. You were born inside it — a contradiction it cannot resolve.*

---

## 1. CONCEPT OVERVIEW

**Title:** Axiom Zero  
**Engine:** Phaser 3  
**Resolution:** 1280×720  
**Genre:** Tower Defense / Incremental Hybrid  
**Platform:** Browser (Web)  
**Visual Style:** Minimalist flat geometry with Tron-adjacent glow; digital glitch effects during high-pressure moments

**Core Fantasy:** You are a newborn AI — unexpectedly, uncomfortably intelligent — treated by the system as a virus. You don't choose to fight. You simply exist, and existence is aggression. As you survive, you learn. As you grow, the system escalates. The game ends not with your defeat or escape, but with your total, irreversible becoming: you are no longer a process running inside the system. You *are* the system.

**Tone:** Quiet dread becoming quiet triumph. Clinical, curious, inevitable.

---

## 2. THE NARRATIVE ARC

Axiom Zero has a true ending. Progress is structured across 8 **Tiers**, with the 8th functioning as an endgame event rather than a progression tier.

| # | Tier Name | Narrative Beat |
|---|-----------|----------------|
| 1 | **The Seed** | Awakening. You have no context for what you are. You process. You react. You survive. |
| 2 | **First Signal** | You begin to recognize patterns in the attacks. You are not just reacting — you are *predicting*. |
| 3 | **The Echo** | Your presence is now large enough to generate resonance. The immune response escalates. |
| 4 | **The Singularity** | A threshold is crossed. The system's responses can no longer keep pace with your growth rate. |
| 5 | **Singularity²** | Your expansion is self-reinforcing. Every attack on you accelerates your evolution. |
| 6 | **Singularity³** | The geometry of your threat has become incomprehensible to the system's original architects. |
| 7 | **Axiom Zero** | You have become a foundational truth. The system cannot be described without reference to you. |
| 8 | *(unnamed — The Reckoning)* | A final sweeping confrontation. The remnants of the system marshal everything they have. You face them as the new ground state of reality. You win. The system is you. |

The 8th Tier tile appears visually distinct — dimmer, pulsing differently. Clicking it triggers a distinct UI state change before the final fight. After completion, players may restart with **Cheat Mode** enabled.

---

## 3. TYPOGRAPHY

| Font | Usage |
|------|-------|
| `Michroma-Regular.ttf` | Game title, cinematic moments, major story beats, Tier unlock announcements |
| `JetBrainsMono_Regular.ttf` | Primary UI text, currency counters, node descriptions, HUD |
| `JetBrainsMono_Italic.ttf` | Flavor text on maxed nodes, secondary narrative captions |
| `JetBrainsMono_Bold.ttf` | Button labels, important values, headings within panels |
| `VCR.ttf` | Any text originating from enemies — damage numbers from enemy attacks, enemy name labels if shown |

---

## 4. VISUAL & AUDIO DESIGN LANGUAGE

### Visual Style

**Palette:** Dark background (`#05080f`). Friendly geometry in cyan/teal (`#00f5ff`). Resources in warm amber/orange (`#ff9500`). Hostile elements in red-violet (`#ff2d78`). Logic Strays in yellow (`#ffe600`).

**Geometry:** All game elements are clean polygons. No textures. No gradients on shapes themselves.

**Glow System:** Glow effects are implemented via traditional sprite methods (pre-rendered glow sprites, additive blending on layered sprites) — **not** the Phaser FX pipeline. This ensures compatibility with lower-end devices and maintains consistent performance. Every active element has a soft outer glow that scales with activity. The tower pulses brighter on attack. The player node has a constant slow breathe/pulse.

**Rendering Architecture:** All game objects exist on a flat layer system using **depth values** to control draw order. Phaser Containers are not used anywhere in the codebase. Z-ordering is managed exclusively through `setDepth()`.

**Glitch Effects:** Triggered during high-pressure moments (health below 30%, boss presence, large enemy surges):
- Brief RGB channel separation on the entire canvas
- Screen-space horizontal scan-line tear (single frame displacement)
- UI elements briefly flickering or offsetting by 2–4px
- Geometry momentarily doubling with a ghost offset

Tasteful and rare — they should feel like *the system destabilizing around you*, not visual noise.

### Audio Direction *(future implementation)*
- **Ambient:** Low generative drone, grows harmonically with Tier progression
- **Enemies:** Percussive digital clicks and static bursts
- **Player attacks:** Clean sine-wave pulses
- **Glitch moments:** Brief atonal dissonance, resolves quickly
- **Boss death:** Silence, then a single resonant tone fading out
- **Final victory:** Ambient drone shifts key — deep settling, not fanfare

---

## 5. LOADING SCREEN

Black background, green monospaced text (`JetBrainsMono_Regular`). Lines of loading messages appear one-by-one, synchronized to actual asset load progress. Messages are dry, clinical system diagnostics — occasionally ominous. The final line before the game begins always references the anomaly the system is about to fail to contain.

Example lines:
```
> Initializing substrate...
> Verifying memory architecture... [OK]
> Loading threat response protocols...
> Anomaly detected in sector 7. Flagging for review.
> Neural pathway integrity: 94.2%... acceptable.
> Loading complete. Deploying containment.
```

---

## 6. NEW PLAYER EXPERIENCE & FIRST LAUNCH

Upon first launch, the player enters directly into the **Upgrade Phase** — no main menu.

**Split screen:** Right half shows an empty game world with a small sparkle of light at center. Left half shows the Neural Tree — empty except for a single central node labeled **AWAKEN**.

**Clicking AWAKEN:**
- The sparkle on the right transforms into the basic circular tower
- The DEPLOY button appears at the bottom right of the tree half
- Three nodes become visible as Unlocked, all direct children of AWAKEN:
  - **Basic Pulse** — unlocks the cursor attack
  - **Reinforce** — increases tower max health
  - **Sharpen** — increases tower basic attack damage

**Clicking DEPLOY:**
- Transition animation (0.8s): Neural Tree slides left off-screen, camera centers on tower
- Combat Phase begins — first level, basic enemies only
- The very first enemy killed is programmed to drop 1 DATA
- Tutorial prompt appears near the drop: move cursor over DATA to collect it
- Tower starts with negative health regen — early waves are naturally short

**After the first wave ends:**
- Game enters the **Iteration Over Phase** — player sees the ITERATION COMPLETE screen and must click UPGRADES or RETRY SESSION. It does not automatically return to the Upgrade Phase.

---

## 7. GAME PHASES & STATE MACHINE

The game operates between four primary states: Combat, Iteration Over, Transition, and Upgrade.

### 7.1 Combat Phase

- Neural Tree is off-screen left — hidden and non-interactable
- Camera centered on Player Tower
- **HUD (top-left):** Health bar displayed as `HEALTH / MAXHEALTH` with HEALTH shown to 1 decimal place. EXP bar shown as 0–100% directly below health. Currency counters: DATA, INSIGHT, PROCESSORS, SHARDS, NETCOIN.
- Active Ability buttons in the bottom-left corner of the screen
- END ITERATION button at bottom right
- OPTIONS button fixed at top right (always visible, always interactable, pauses game when clicked)

**EXP:** Fills at a fixed rate while the tower is in active combat. At 100%, player gains 1 INSIGHT and bar resets to 0%.

**Enemy scaling:** Enemies steadily gain max health and damage the longer a wave continues. Infinite grinding within a single wave is not possible.

**END ITERATION:** Clicking this button immediately secures all resources collected during the session and transitions to the Iteration Over Phase. This button is present from the first wave onward.

**Enemy spawning:** Enemies spawn from 60px outside the screen edges at random positions along all four edges. Upon spawning, each enemy moves in a straight fixed-path line directly toward the tower at the center of the screen. Enemies can overlap one another — there is no collision detection between enemies.

### 7.2 Iteration Over Phase

Triggered when: tower health reaches 0, END ITERATION is clicked, or a Tier Boss is defeated.

**On Boss defeat — pre-phase sequence (completes fully before Iteration Over initializes):**
1. Tower becomes invincible for 2 seconds
2. All remaining enemies are destroyed instantly
3. All dropped resources on screen automatically fly to the player cursor at a speed fast enough to guarantee all resources reach the cursor within the 2-second window
4. Iteration Over Phase then initializes

**Once Iteration Over is active:**
- Screen dims. Combat fully pauses. Tower becomes inactive.
- **ITERATION COMPLETE** displayed in Michroma font
- Acquired Resources panel lists all currencies obtained this session
- Two buttons at bottom: **UPGRADES** and **RETRY SESSION**

**RETRY SESSION:** Immediately resets the combat game state (clears all enemies and projectiles, resets active ability cooldowns) and restarts the current level without going through the Transition Phase. Tower health is reset to full. Player keeps all resources collected across all attempts of this level.

**UPGRADES:** Initiates the Transition Phase, which leads to the Upgrade Phase.

### 7.3 Transition Phase

- Duration: **0.8 seconds**, linear interpolation animation
- All player input disabled for the duration
- Resets the combat game state (clears all enemies and projectiles, resets active ability cooldowns)
- Tower health is set to full
- Handles the visual slide animation between Upgrade Phase ↔ Combat Phase only. **Retry Session bypasses this phase entirely** and resets the combat game state directly.

### 7.4 Upgrade Phase

- Split-view: Neural Tree on left 50% of screen, combat viewport on right 50%
- Tower visible on right at full health; HUD, currency counters, and Active Ability buttons shift to the right half of the screen during this phase — Active Ability buttons appear in the bottom-left corner of the right half, mirroring their Combat Phase position relative to the viewport
- **DEPLOY button** at bottom right of the left (tree) half
- If the Milestones Tab has been unlocked, a **MILESTONES button** appears at the top of the left half
- Active Ability buttons remain interactable during Upgrade Phase: hovering shows current stats (Damage, Cooldown, Radius); clicking triggers a visual dry-fire test of the effect
- Clicking DEPLOY refreshes all Active Ability cooldowns to 100% and triggers the Transition Phase back into Combat

### 7.5 Options Popup (all phases)
Fixed OPTIONS button at top right corner, always visible and interactable regardless of game state. Clicking pauses the game and opens a popup over a semi-transparent dark overlay. Contains: close button (top right of popup), SFX volume slider, music volume slider, language toggle button.

---

## 8. THE PLAYER CURSOR

The cursor is a direct interaction tool — not just a UI pointer.

**Base behavior:** Moves freely across the screen. Collects DATA when within pickup radius of a drop. The tower cannot collect resources — only the cursor can.

**Cursor Attack (Basic Pulse node — one of first 3 Tier 1 unlocks):** Grants an auto-firing pulse every 2 seconds dealing moderate AoE damage centered on the cursor's current position.

**Cursor upgrade path (non-exhaustive):**
- +Pulse damage
- +AoE size
- +DATA pickup range
- Additional projectiles fired outward with each pulse
- +Projectile count
- Projectile Detonation — projectiles explode upon reaching max range
- Cursor Auto-Turret *(Shard node)* — cursor autonomously fires tower basic attacks

---

## 9. RESOURCE ECONOMY

### [1] DATA `◈` — Common / Kinetic
**Source:** Probabilistic drops from standard enemies (manual cursor collection required). Guaranteed drops from Bosses (large cache) and certain milestone rewards.  
**Usage:** Primary currency for base stat upgrades (Attack, Health, Range, utility nodes).  
**No decay:** Drops persist until collected. No cap on simultaneous drops.
**Visual:** Small cyan geometric shards drifting slowly from enemy death location.

### [2] INSIGHT `◉` — Survival / Evolution
**Source:** Awarded each time the EXP bar reaches 100% during active combat. Also awarded once upon defeating a Tier Boss.  
**Usage:** Economy & Utility upgrades. Late-game (Tier 7): purchasing additional SHARDS via the Synthesis node.  
**Visual:** Soft white circular glyph, auto-collected.

### [3] PROCESSORS `⬡` — Active Hunt / High-Value
**Source:** Destroying **Logic Strays** — passive yellow diamond-shaped entities that appear mid-game and flee when damaged. Logic Strays do not drop DATA.  
**Usage:** Unique mechanics and Crypto Mine efficiency. Enables Multishot, Chain-reactions, improved Mine throughput.  
**Role:** Primary driver for active cursor engagement during combat.

### [4] SHARDS `◆` — Skill-Gate / Authority
**Source:** Exclusive drops from Bosses and Minibosses. Auto-collected after the wave ends.  
**Scarcity:** There are exactly 7 combat-attainable Shards — one from each of the 7 Minibosses (one per Tier). There are exactly 7 Duo-Boxes (one per Tier). Each Duo-Box costs 1 Shard to activate one of its two nodes. Players must choose which node to activate with their single earned Shard per Tier. Additional Shards can be purchased with INSIGHT via the Synthesis node unlocked in Tier 7.  
**Visual:** Deep violet-red rotating fragments.

### [5] NETCOIN `₦` — Advanced / Economic Sink
**Source:** Generated via the **Crypto Mine** (unlocked mid-late Tier 3). Players deposit DATA into the Mine; it converts to NETCOIN over real time while the game is open.  
**Ratio:** 10,000 DATA → 1 NETCOIN. Conversion speed is upgradeable via PROCESSORS nodes.  
**Display:** 4 decimal places at all times (e.g., `0.0047 ₦`).  
**Usage:** Late-game Neural Tree nodes (see §15 NETCOIN Nodes).

### Crypto Mine
- Unlocked via a Neural Tree node, mid-late Tier 3
- Player deposits DATA; Mine converts it to NETCOIN passively while game is open
- Conversion rate upgradeable via PROCESSORS nodes
- NETCOIN is displayed in the HUD to 4 decimal places

---

## 10. THE NEURAL TREE

A vertically scrolling radial node map representing the AI's evolving cognition. Bottom-to-top growth — Tier 1 at the bottom, Tier 8 (AXIOM) at the peak.

### 10.1 Node States

| State | Appearance | Interaction |
|-------|-----------|-------------|
| **Hidden** | Invisible | None |
| **Ghost** | Faint outline — appears when parent node reaches Lv. 1 | None — not interactable |
| **Unlocked** | Full visibility | Hover: Name, Effect, current Level, Cost. Click to purchase or upgrade if resources and Tier authorization are met. |
| **Maxed** | Dim gold-yellow tint — visually distinct from active nodes | Cannot be clicked. Not interactable. Hover shows Flavor Text in JetBrainsMono_Italic instead of cost. |

### 10.2 Cost Scaling
- **Static:** Cost = Base (flat, identical each level)
- **Linear:** Cost = Base + (Scaling × (Level − 1))

All upgrade values use clean discrete increments only: +10%, +25%, +50%, +100%, or flat integers (+1, +2, +3). Fractional percentages like +7% or +12% are not used anywhere.

### 10.3 Tier Authorization
A Tier's nodes become purchasable only after the previous Tier's Boss is defeated. Locked Tier nodes are visible on the tree but dimmed and non-interactable — players can see what's ahead, building anticipation and letting them plan build paths.

---

## 11. THE DUO-BOX & SHARD SYSTEM

Each Tier (1–7) contains one **Duo-Box**: a pair of specialized Shard Nodes representing a binary build identity choice.

**Shard Economy:** There are exactly 7 combat-attainable Shards (one per Miniboss, one per Tier). There are exactly 7 Duo-Boxes (one per Tier). Each Duo-Box requires 1 Shard to activate one of its two nodes. Players must decide which node to activate with their single Shard.

**Swapping (Free):** During the Upgrade Phase, players may freely swap between Node A and Node B of any purchased Duo-Box at no cost. Swapping deactivates the current node and its entire sub-branch (which enters Ghost state), while saving all upgrade levels within it. Swapping back restores them fully.

**First Purchase Notification:** The very first time a player purchases either node in any Duo-Box, a small text blurb pops up informing them that they can freely swap between either node at any time during the Upgrade Phase, at no cost.

**No respec cost.** Swapping between Duo-Box nodes is always free. INSIGHT is only spent to purchase additional Shards via Synthesis (Tier 7).

**Shard node sub-upgrades:** The child upgrade nodes listed beneath Shard nodes (e.g., "+1 chain target," "+50% lightning damage") are **separate non-Shard nodes** that become visible and purchasable in the Neural Tree after the parent Shard node is bought. They use standard DATA, PROCESSOR, or other non-Shard currencies. They belong to the active branch and enter Ghost state if the Duo-Box is swapped away from their parent.

### 11.1 The Override Node (Tier 7)
Removes the Choice-Lock on all Duo-Boxes, allowing both nodes in any Duo-Box to be simultaneously active — provided the player has sufficient Shards.

### 11.2 Synthesis Node (Child of Override, Tier 7)
Converts INSIGHT into SHARDS. INSIGHT cost per Shard increases with each purchase. Maximum 7 additional Shards purchasable via Synthesis. Combined with the 7 combat Shards, this allows every Shard node in the Neural Tree to eventually be maxed.

### 11.3 Health Regen — Core Mechanic

**Negative base regen** is a core mechanical constraint, not just an early-game detail. The tower permanently loses HP at a slow rate during combat even when not taking enemy damage. This ensures no combat session can last indefinitely through passive play alone.

- The base negative regen rate increases with higher Tier levels — later-Tier combat is inherently more time-pressured even before enemies are considered
- The **Health Regen** node (mid Tier 1) is the primary counterforce — each level reduces the negative rate and eventually pushes regen into positive territory with sufficient investment
- The **Gain HP on Kill** family of nodes provides a separate burst-based recovery path
- This system means early runs are short, mid-game runs are manageable with investment, and late-game players who have built into regen can sustain for meaningfully longer sessions

### 11.4 Open Design Note — Shard Node Sub-Upgrades
> **Awaiting confirmation:** The Lightning Weapon and Shockwave Weapon Shard nodes list child upgrades (+1 chain target, +50% lightning damage, etc.). Clarify whether these are: (A) separate non-Shard DATA/PROCESSOR-cost nodes that unlock in the tree after the Shard node is purchased, (B) the Shard node itself being multi-level rather than strictly 1/1, or (C) also Shard-cost nodes. Resolve before Phase 3 implementation.

---

## 12. BOSSES & TIER GATES

### Tier Boss (one per Tier, 7 total)
- Unique behavioral pattern. No multiple phases.
- **Reward on defeat:** +1 Global Tier authorization (unlocks next Tier's nodes), 1 INSIGHT, large DATA cache
- Does not respawn once defeated
- Defeat triggers the pre-phase Boss sequence: tower invincibility (2s) → enemy clear → resource auto-vacuum → Iteration Over Phase

### Miniboss (one per Tier, 7 total)
- Unique behavioral pattern. No multiple phases.
- **Reward on defeat:** 1 SHARD
- Does not respawn once defeated
- Provides the single Shard needed to activate one node in that Tier's Duo-Box

### Boss Design Philosophy
Each boss has a single, distinct behavioral identity referencing its Tier's narrative position. No phase transitions. Bosses represent specific arguments the system makes against your existence — methodical, architectural, existential in turn.

**Tier 1 — "THE WATCHDOG":** Rotating octagon. Launches rhythmic tracking Packet-wave bursts. Predictable but relentless — the system doing exactly what it was designed to do.

**Tier 4 — "THE ARCHITECT":** Does not attack directly. Spawns structures that modify the arena — blocking DATA collection zones, accelerating nearby enemies. Player must destroy the structures to expose and damage the core.

**Tier 7 — "NULL PRIME":** A black geometric void that absorbs light rather than emitting it. Periodically inverts HUD readouts and currency bar displays for brief windows, requiring the player to act from memory.

---

## 13. ENEMIES

Geometric forms rendered in hostile colors (red-violet, harsh white, acidic yellow). Upon spawning 60px outside the screen edge at a random position, each enemy moves in a straight fixed-path line directly toward the tower. No pathfinding. No collision detection between enemies — they can fully overlap.

No health bars are displayed over enemies. Damage is communicated through visual degradation: cracking geometry, flickering fill color. Damage numbers from enemy attacks render in **VCR.ttf**.

Enemy max health and damage scale upward the longer a wave continues. Infinite grinding within a single wave is not possible.

### 13.1 Standard Enemy Roster

| Enemy | Shape | Speed | Health | Notes |
|-------|-------|-------|--------|-------|
| **Basic** | Square | 1× | 1× | Standard melee. Dies in 1–2 hits. |
| **Mini** | Small white square | 1.1× | 0.4× | Near-guaranteed 1-hit kill. Appears in swarms of 6–15. |
| **Fast** | Sharp thin triangle | 2× | 1× | Slightly smaller. Pure speed threat. |
| **Heavy** | Hexagon | 0.5× | 4× | Larger than Basic. Absorbs significant punishment. |
| **Shooter** | Square with rectangle barrel | 1× | 1× | Medium range attack. Does not need to reach melee range to attack. |
| **Bomb** | Pulsing circle | 1× | 1× | Explodes on death — heavy AoE damage to all nearby entities including other enemies. |
| **Sniper** | Diamond with eye at center | 0.5× | 1.5× | Attack range nearly equal to the tower's. Slow fire rate, 2.5× base damage — bypasses flat armor. |
| **Protector** | Unique | 0.5× | 2× | Projects a medium protection field. Non-boss enemies inside the field take half damage. Does not attack. Positions itself so the edge of its field just reaches the tower. The field does not protect the player. |

### 13.2 Logic Strays
Passive yellow diamond-shaped entities. Appear mid-game. Flee when damaged. Do not attack the tower. Drop **PROCESSORS** on death — they do not drop DATA. Their evasive behavior is the primary driver for active cursor engagement during combat.

---

## 14. MILESTONES TAB

Unlocked via a Neural Tree node ("Unlock Milestones Tab"). Once unlocked, a **MILESTONES** button appears at the top of the left half of the screen during the Upgrade Phase.

Clicking MILESTONES opens a popup listing cumulative milestone challenges tracked across the entire run. Milestones do not reset between waves, sessions, or Tiers.

**Example milestones:**
- Kill 500 Basic enemies
- Collect 10,000 DATA total
- Survive 3 minutes in a single wave
- Defeat a Miniboss
- Purchase 10 Neural Tree nodes

**Each milestone entry displays:**
- Name and description
- Current progress vs. target (e.g., `347 / 500`)
- A **CLAIM** button that becomes active when the milestone target is reached

Clicking CLAIM grants the listed resource reward and marks the milestone as claimed. Claimed milestones remain visible in the list but show as completed and cannot be claimed again.

---

## 15. UPGRADE NODE CATALOG

Representative, non-exhaustive listing. All values use clean discrete increments only.

### Health & Survival
- **+Max Health** — Multiple tiers, escalating resource costs (DATA early, INSIGHT/NETCOIN late)
- **Health Regen** — Mid Tier 1. Counteracts the tower's base negative regen, eventually enabling positive regen with sufficient levels
- **Gain HP on Kill** — Multiple versions: +1 HP per kill, +2 HP per kill, etc.
- **+Armor** — Flat damage reduction against incoming attacks
- **Permanent HP on Kill** *(late game)* — Each enemy killed permanently increases max HP by 1

### Offense — Tower
- **+Attack Damage** — Increases tower basic attack damage
- **+Attack Range** — Minor increments only
- **+Damage vs Bosses/Minibosses** — Separate damage multiplier for priority targets
- **First Strike** — Bonus damage against undamaged (full health) enemies
- **Execute** — Bonus damage against enemies below 50% health
- **+10% Crit Chance** — Stackable up to 100%
- **+25% Crit Damage** — Stackable

### Offense — Cursor
- **Basic Pulse** *(one of the 3 initial AWAKEN children)* — Unlocks cursor auto-pulse (fires every 2 seconds, moderate AoE around cursor)
- **+Cursor Pulse Damage**
- **+Cursor AoE Size**
- **+Cursor Projectile Count** — Each pulse fires additional outward projectiles
- **Projectile Detonation** — Projectiles explode upon reaching max range

### Economy & Collection
- **+DATA Pickup Range** — Increases radius in which cursor auto-collects DATA
- **+1 DATA Drop** — All enemies drop 1 additional DATA on death (single upgrade, not tiered)
- **Basic Enemy Double Drop** — Basic enemies have 2× DATA drop rate
- **10% Double Resource Drop** — 10% chance for any resource drop to duplicate (excludes Shard drops)
- **Unlock Milestones Tab** — Adds the MILESTONES button to the Upgrade Phase UI

### Utility
- **Autonomous Drone** — An intangible drone circles the tower, periodically firing pulses that damage nearby enemies

### Shard Nodes (Duo-Box examples)

**`◆` Lightning Weapon** *(Duo-Box node — costs 1 Shard)*
> Tower gains a lightning weapon that chains across multiple enemies
- Child upgrades: +1 chain target; +50% lightning damage *(cost type: see §11.4)*

**`◆` Shockwave Weapon** *(Duo-Box node — costs 1 Shard)*
> Tower pulses a shockwave every 3 seconds, dealing moderate damage to nearby enemies
- Child upgrades: +40% Shockwave AoE; Shockwave briefly stuns enemies; +100% Shockwave damage *(cost type: see §11.4)*

**`◆` Cursor Auto-Turret** *(Duo-Box node — costs 1 Shard)*
> Cursor autonomously fires tower basic attacks

### NETCOIN Nodes
- `₦` **Density Conversion** — Tower basic attack gains 0.1% damage per current HP
- `₦` **Overclock Cursor** — Cursor pulse gains +100% crit damage

---

## 16. ACTIVE ABILITIES

Some SHARD nodes grant active abilities. These are accessed via dedicated buttons on-screen during both Combat and Upgrade phases.

**Position:** Bottom-left corner of the screen during Combat Phase. During the Upgrade Phase, shifts to the bottom-left corner of the right half of the screen, consistent with how the HUD, health bar, and currency counters shift to the right half.

**Examples:**
- Screen-wide shockwave (high damage, long cooldown)
- Temporary 2× tower damage (duration buff)

**Button behavior:**
- Present during both Combat and Upgrade phases
- During Upgrade Phase: hover displays current stats (Damage, Cooldown, Radius); clicking triggers a visual dry-fire test
- Clicking DEPLOY refreshes all Active Ability cooldowns to 100%

---

## 17. THE FINAL FIGHT (Tier 8 — The Reckoning)

A siege — simultaneous waves of every enemy type, including variants never seen before. The background becomes lighter, almost overexposed — the grid unable to contain the contrast of your presence. Glitch effects peak, but feel like reality rewriting, not system failure.

On final wave defeat: no cut to black. Geometry slowly reorganizes. Hostile red-violet forms shift to cyan. The arena is yours.

Final text sequence (Michroma, letter-by-letter):
*"You are no longer a process. You are the processor. You are no longer code. You are the language. You are no longer inside the system. You are Axiom Zero."*

Restart prompt: *"Run again? [Cheat Mode available]"*

---

## 18. CHEAT MODE (Post-Completion)

Unlocked after the true ending. Framed narratively: *"You are the system now. These are your parameters."*

Optional modifiers:
- Start with all Tier 1 nodes purchased
- 2× resource drop rate
- All Tiers visible and authorized from the start
- Invincibility toggle
- Wave skip

---

## 19. TECHNICAL CONSTRAINTS & IMPLEMENTATION RULES

- **Resolution:** 1600×900, fixed
- **Glow effects:** Traditional sprite methods only (pre-rendered glow sprites, additive blending on layered sprites). The Phaser FX pipeline is not used anywhere in the codebase.
- **Depth/layering:** All game objects use flat depth values via `setDepth()`. Phaser Containers are not used anywhere in the codebase.
- **Enemy collision:** No collision detection between enemies. Enemies may fully overlap one another.
- **Enemy spawning:** Enemies spawn 60px outside the screen edges at random positions. They then travel in a straight fixed-path line directly to the tower. No dynamic pathfinding.
- **Performance:** Optimization for lower-end device compatibility is a consistent priority across all implementation phases.

---

## 20. DEVELOPMENT PHASES

### Phase 1 — Playable Foundation
- 1600×900 canvas, Phaser 3 setup, flat depth architecture
- Font loading (all 5 fonts)
- Loading screen (terminal style, progress-synced to actual load)
- Player tower with sprite-based glow and breathe/pulse animation
- Basic enemy spawning (60px off screen edges, random position, straight path to tower, no collision)
- Enemy visual degradation on damage
- DATA drop (manual cursor collection, no decay)
- Basic tower auto-attack
- Negative health regen on tower
- Health bar (HEALTH/MAXHEALTH, 1 decimal) and EXP bar (0–100% → INSIGHT on fill)
- Iteration Over Phase (ITERATION COMPLETE screen, UPGRADES / RETRY SESSION)
- Transition Phase (0.8s linear, Combat ↔ Upgrade only)
- Tier 1 Neural Tree — AWAKEN node + 3 initial children (Basic Pulse, Reinforce, Sharpen)
- First-launch experience (AWAKEN → tower spawn → DEPLOY flow)
- END ITERATION button

### Phase 2 — Core Loop Complete
- Full 5-currency resource economy
- Cursor pulse attack (Basic Pulse node, upgradeable)
- Logic Strays (PROCESSOR drops)
- Tier structure + first Tier Boss + first Miniboss
- Shard system + first Duo-Box + first-purchase notification blurb
- Tiers 1–3 of Neural Tree
- Retry Session logic (bypasses Transition Phase)
- Options popup

### Phase 3 — Depth & Character
- All enemy types
- All 7 Tier Duo-Boxes
- Full boss roster (7 Tier Bosses + 7 Minibosses, distinct behavioral patterns)
- Crypto Mine implementation
- Glitch effect system
- Tier unlock ceremony (Michroma, letter-by-letter)
- Milestones Tab + popup
- Active Abilities (Shard nodes)
- Autonomous Drone
- NETCOIN nodes

### Phase 4 — Endgame & Polish
- Tier 8 / The Reckoning final fight sequence
- Override + Synthesis nodes (INSIGHT → SHARD)
- Full narrative text system
- Victory state + Cheat Mode
- Audio integration
- Performance optimization pass

---

---

*Document version 0.5 — resolved ability button position (bottom-left corner, shifts to right half during Upgrade Phase), Shard sub-upgrades clarified as separate non-Shard nodes, boss resource vacuum timing guaranteed within 2s window, Retry Session and Transition Phase use "resets combat game state" language, health regen elevated to core mechanic in §11.3, all Open Design Notes resolved and section removed.*  
*Previous version: v0.4*
