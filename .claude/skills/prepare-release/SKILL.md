---
name: prepare-release
description: Pre-release checklist for an Axiom Zero web/CrazyGames/exe build — flags, debug output, lint, asset audit, production bundle and a smoke test. Use when the user is about to ship, upload a build, or asks "is this ready to release?".
---

# Prepare a release

Report each step's result to the user. Don't silently "fix" release flags. Ask which target they're shipping (web, CrazyGames, exe), because the right `FLAGS` differ.

1. **Flags** (`flags.js`):
   - `DEBUG` must be `false`. It grants free resources on a fresh save (`js/util/gameState.js`) and shows the FPS overlay.
   - `USING_CRAZYGAMES_SDK`: `true` only for CrazyGames uploads.
   - `IS_EXE`: `true` only for the standalone exe.
   - `USE_SERVICE_WORKER` / `ANALYTICS_ENABLED`: confirm with the user. If the service worker is on, bump `CACHE_NAME` in `sw.js`, or returning players keep the old build (it serves cache-first).
2. **Debug leftovers** (report only, don't mass-delete):
   - `grep -rn "console\.log" js --include=*.js`: flag ones not behind `debugLog()` or `FLAGS.DEBUG`.
   - `grep -rnE "TODO|FIXME|XXX" js --include=*.js`
   - Temporary test tweaks: boosted spawn weights in `levelConfig.js`, hardcoded resources, disabled nodes in `disabledNodes.js`. `git diff` against the last release tag/commit is the fastest way to spot them.
3. **Lint and tests**: `npm run lint` and `npm test`. Zero errors and failures required.
4. **Assets**: `npm run audit-assets`. Zero errors required; review the warnings with the user.
5. **Save compatibility**: if `GAME_STATE_DEFAULTS` changed shape since the last release, confirm `SAVE_VERSION` was bumped and old saves are migrated. `migrateProjectState(fromVersion, data)` is called by `js/util/gameState.js` if it exists, but it isn't defined yet: write it (in `js/gameConfig.js`) for the first breaking change.
6. **Build**: `node build_prod.js` → `dist/`. Check the log for `Warning: File not found`.
7. **Weight**: list the largest files in `dist/` and `assets/`:
   `find dist assets -type f -printf '%s %p\n' | sort -rn | head -15`
8. **Smoke test the built output**: use the `playtest` skill against the dev server first, then load `dist/index.html` in the preview (serve `dist/`) and confirm boot, upgrade phase, one combat wave, no console errors.
