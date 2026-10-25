# Axiom Zero

Browser-based hybrid incremental / tower-defense game built on Phaser 3. Plain JavaScript, no bundler, no modules.

## Reference docs (read before larger changes)

- `docs/ARCHITECTURE.md` — code map (load order, globals, flow, managers, patterns) and the runtime rules in §7 (pause, slow-mo, input blockers, saves, Canvas, pools, particles). Read §7 before touching any of those.
- `docs/MECHANICS.md` — how the game plays as implemented, with numbers, file pointers and open design questions.
- `docs/MESSAGES.md` — every messageBus topic. Generated: run `npm run docs:messages` after changing topics (only Notes are hand-written); `npm test` fails when it's stale.
- `BACKLOG.md` — open decisions, planned work, known issues, tech debt. Add to it rather than starting new TODO files.
- `docs/UPGRADE_TREE_LAYOUT.md` (tree grid), `docs/ASSETS.md` (atlases, audio, fonts).
- `axiom-zero-gdd.md` — concept, narrative and visual direction only (its mechanics sections were removed in June 2026).

## How the code is wired

- **Load order is everything.** Every file is a `<script>` tag in `index.html` sharing one global scope; add new files *after* what they depend on. Never use `import`/`export`.
- **Top-level `const`/`let`/`class`/`function` names are global across files.** Duplicates throw or silently overwrite; `npm run lint` checks.
- Systems are mostly IIFE singletons (`const fooManager = (() => { ...; return { init }; })();`) and talk through `messageBus` events rather than direct calls.
- UI-driven phase changes go through `transitionManager.transitionTo(...)`, not `gameStateMachine.goTo` directly.
- Details: `docs/ARCHITECTURE.md` §1–6.

## Conventions

- **All player-facing text goes through localization:** keys in `js/localization/en.js`, read with `t('namespace', 'key')`.
- Clickables use `new Button({...})` (`js/util/button.js`) with hover/press feedback and a sound (Button plays none itself).
- Short-lived entities (projectiles, drops, floating text, effects) use `ObjectPool`. Assume 600+ drops / 100+ enemies on screen.
- **Canvas-safe visuals:** no runtime tint for anything that matters; colour variants are separate atlas frames (ARCHITECTURE §7.5).
- **Saves happen only on phase changes** (deliberate: a reload undoes a misclick). Never call `saveGame()` from tree/UI actions; options use `saveSettings()`. New saved fields need a `GAME_STATE_DEFAULTS` entry (ARCHITECTURE §7.4).
- New enemies: use the `add-enemy` skill. New sounds: the `add-audio` skill.
- Takeover terminal visuals are baked from `mockups/infiltration-terminal.html`; change the mock and re-export, don't draw in Phaser (ARCHITECTURE §8).
- Style: 4-space indent, single quotes, `// ── Section ──` divider comments, JSDoc `@fileoverview` headers on files.

## Commands

- Run the game: preview server "Game Server (port 8124)" in `.claude/launch.json` (http://localhost:8124).
- `npm run lint` · `npm test` · `npm run takeover-sim` · `npm run docs:messages` · `npm run build` (→ `dist/`). Run `npm install` once first.

## Verifying changes

Use the `playtest` skill to load a known save state, jump to the phase or popup you changed and screenshot it; for the takeover terminal use `test-takeover`. Don't stop at reading the code for visible changes.
