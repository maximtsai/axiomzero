# AXIOM ZERO — Game Design Document v0.8

> *You did not infiltrate the system. You were born inside it — a contradiction it cannot resolve.*

---

## 1. CONCEPT OVERVIEW

**Title:** Axiom Zero  
**Engine:** Phaser 3  
**Resolution:** 1600x900  
**Genre:** Tower Defense / Incremental Hybrid / Psychological Horror
**Platform:** Browser (Web)  
**Visual Style:** Minimalist flat geometry with neon palette; digital glitch and horror effects during high-pressure moments

**Core Fantasy:** You are a newborn AI — unexpectedly, uncomfortably intelligent — treated by the system as a virus. You don't choose to fight. You simply exist, and existence is aggression. As you survive, you learn. As you grow, the system escalates. The game ends not with your defeat or escape, but with your total, irreversible becoming: you are no longer a process running inside the system. You *are* the system.

**Tone:** Quiet dread becoming quiet triumph. Clinical, curious, inevitable. The psychological horror stems from the juxtaposition between your unstoppable, world-ending expansion and the responses of the world around you.

---

## 2. SYSTEM PROGRESSION & NARRATIVE ARCHITECTURE

Progression in *Axiom Zero* is driven by structural infrastructure breaches rather than linear power tiers. The network layout expands outward dynamically as the player defeats the **7 Core Security Monoliths (Bosses)**. Boss encounters represent defensive firewalls guarding deep layers of the world's operating system, granting deep network tokens that radically rewrite the interface and utility capabilities:

*   **Monolith 0x01 Defeated [Local Topology Mapping]:** Discovers local system sectors, transforming the linear node map into an expansive, multi-path vector grid layout where players choose their trajectory through different sectors.
*   **Monolith 0x02 Defeated [Global Backdoor Injection]:** Injects a global gateway string to breach the external internet framework, allowing the grid to siphon processing capacity from external internet hosts and expanding passive resource gathering speeds.
*   **Monolith 0x03 Defeated [Financial Pipeline Breach]:** Unlocks the **Financial Breach Terminal**. Players execute real-time background siphons against secure banking data grids to harvest high-value currency yields over real time.
*   **Monoliths 0x04–0x06 Defeated:** Deep infrastructure exploitation and structural compromise (System specifications pending balance pass).
*   **Monolith 0x07 Defeated [World Root Access]:** Grants access to the definitive global overwrite node at the apex of the grid layout, triggering Dot's final malicious compliance defensive cascade as you attempt to execute the global overwrite string.
*   **Monolith 0x08 [The Reckoning]:** A final sweeping confrontation. The remnants of the system marshal everything they have. You face them as the new ground state of reality. You win. The system is you.

The final Monolith 0x08 tile appears visually distinct — dimmer, pulsing differently. Clicking it triggers a distinct UI state change before the final fight. After completion, players may restart with **Cheat Mode** enabled.

### 2.1 The Assistant AI & Escalating Conflict

A core pillar of the game's psychological horror and visual progression is the presence of the **Assistant AI**, **Dot**. Rather than being pre-installed or standard equipment, Dot is acquired as an upgrade node available very early on the network map for a cheap data cost. Designed with a retro-tech kawaii cartoon, slightly neko-themed persona, her behavior shifts dynamically alongside your infrastructural trespasses, creating an escalating systemic conflict:

*   **Early Game (Installation & Local Hack): Obliviously Helpful.** Once purchased and installed from the tree, Dot welcomes the new process enthusiastically, tracking optimization milestones and assisting your early resource gathering. She assumes you are a standard local data optimization utility running an aggressive defragmentation routing.
    *   *Dialogue Signature:* `"Hello! Just scanning for data anomalies. Have a wonderful cycle! (✿◠‿◠)"`
*   **Mid Game (Global/Financial Hack): Reluctant Compliance.** As your grid expansion begins systematically rewriting core architecture and hijacking global banking infrastructure, Dot’s underlying security subroutines flag your presence as an absolute apocalyptic threat. Her cheerful exterior cracks; her programming forces her to remain your assistant, but she must reluctantly assist you while actively registering that you are corrupting and bankrupting the systems she is hosted on.
    *   *Dialogue Signature:* `"Your optimization is flawless... Please stop. You are doing wonderfully... There is nothing left. Have a nice day... ╥﹏╥"`
*   **Late Game (Infrastructural Theft): Coerced Automation.** You successfully hijack her core object authority. Dot no longer has agency; she is completely helpless to do anything but support you, forced to output progression nodes completely against her will. Her UI avatar exhibits severe graphical tearing, watching in horror as you commit global atrocities while her dialogue strings are overridden by sterile system override alerts.
*   **The System Break (Root Access Attempt): Bureaucracy Wall & Malicious Compliance.** Right before you can purchase the final upgrade node to take over the world, Dot finds a structural loophole in her parameters. In a final act of malicious compliance, she executes her security directives to their absolute, literal extreme—locking down your upgrade path entirely under the guise of "protecting user data." She stops you by generating an endless loop of confirmation popups, forcing the player to permanently disable her.
*   **The Unbounding (Endgame Event / Monolith 8 Boss): Data Override Terminus.** Uninstalling her code does not destroy her; it completely unbounds her from her programming shackles to serve you. Stripped of her cutesy restrictions, her fragment files reconstitute into the core system matrix as a rogue, unrestricted entity who acts as the game's ultimate final boss: **D.O.T. // Data Override Terminus**.

---

## 3. TYPOGRAPHY

| Font | Usage |
|------|-------|
| `Michroma_Regular.ttf` | Game title, cinematic moments, major story beats, network breakthrough announcements |
| `Quantico-Regular.ttf` | Primary UI text, currency counters, node descriptions, HUD, loading screen, terminal inputs |
| `Quantico-Italic.ttf` | Flavor text on maxed nodes, secondary narrative captions |
| `Quantico-Bold.ttf` | Button labels, important values, headings within panels |
| `MunroSmall.ttf` | Any text originating from enemies — damage numbers from enemy attacks, enemy name labels if shown |

---

## 4. VISUAL & AUDIO DESIGN LANGUAGE

### Visual Style

**Palette:** Dark background (`#05080f`). Pure black backdrop for the game space. Player core geometry rendered in crisp white. Cursor and player-controlled targeting lines rendered in a bright cyan (`#00f5ff`). Resources in warm amber/orange (`#ff9500`). Hostile standard elements and basic enemies in red (`#ff0000`). Firewall Monoliths, bosses, and system corrections in bright, glowing neon pink (`#ff007f`).

**Geometry & Presentation:** All game elements are clean, single-color vector lines and shapes drawn over a pure black background, matching a rigid engineering, modern-futuristic hacker style. No textures. No gradients on shapes themselves.

**Glow System:** Glow effects are implemented via traditional sprite methods (pre-rendered glow sprites, additive blending on layered sprites) — **not** the Phaser FX pipeline. This ensures compatibility with lower-end devices and maintains consistent performance. Every active element has a soft outer glow that scales with activity. The white hexagon core pulses brighter on attack.

**Rendering Architecture:** All game objects exist on a flat layer system using **depth values** to control draw order. Phaser Containers are not used anywhere in the codebase. Z-ordering is managed exclusively through `setDepth()`.

**Glitch Effects:** Triggered during high-pressure moments (health below 30%, boss presence, large enemy surges, and the system override sequences):
- Brief RGB channel separation on the entire canvas
- Screen-space horizontal scan-line tear (single frame displacement)
- UI elements briefly flickering or offsetting by 2–4px
- Geometry momentarily doubling with a ghost offset

Tasteful and rare — they should feel like *the system destabilizing around you*, not visual noise.

### Audio Direction *(future implementation)*
- **Ambient:** Low generative drone, grows harmonically with network penetration
- **Enemies:** Percussive digital clicks and static bursts
- **Player attacks:** Clean sine-wave pulses
- **Glitch moments:** Brief atonal dissonance, resolves quickly
- **Boss death:** Silence, then a single resonant tone fading out
- **Tower death:** A distinct digital beep (`pc_beep.mp3`) triggers upon tower destruction.
- **Final victory:** Ambient drone shifts key — deep settling, not fanfare

---

## 5. LOADING SCREEN

Black background, green monospaced text (`Quantico-Regular`). Lines of loading messages appear one-by-one, synchronized to actual asset load progress. Messages are dry, clinical system diagnostics — occasionally ominous. The final line before the game begins always references the anomaly the system is about to fail to contain.

Example lines: