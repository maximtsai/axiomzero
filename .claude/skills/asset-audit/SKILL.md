---
name: asset-audit
description: Cross-check Axiom Zero's audio files, atlas frames and their registrations against code references. Use after adding/removing/renaming assets, before a release, or when a sound or sprite silently fails to show up.
---

# Asset audit

Run from the repo root:

```bash
node .claude/skills/asset-audit/audit.js
```

The script is read-only. It scans only the scripts `index.html` actually loads and reports:

**Errors (exit code 1, these break at runtime):**
- a key passed to `audio.play/playMusic/swapMusic(...)` that isn't in `assets/audioFiles.js`
- an `audioFiles` entry whose file is missing, or a key registered twice
- an atlas in `assets/imageFiles.js` whose JSON or page image is missing

**Warnings:**
- audio files on disk that aren't registered (dead weight in the build, or a forgotten registration)
- registered audio keys never referenced in code
- `'something.png'` frame literals not found in any atlas JSON. Frame names built at runtime (concatenation, template strings) can't be checked and are skipped.

## Interpreting results

- Missing frames usually mean either (a) a stale code path that's never reached, or (b) the sprite was added to `raw/<atlas>/` but the TexturePacker sheet (`raw/<atlas>.tps`) wasn't re-published to `assets/sprites/`. The user republishes atlases in TexturePacker; don't hand-edit atlas JSON.
- Before deleting an "unused" asset, grep for the bare name. Keys can be built dynamically, e.g. `` `bg_music${n}` ``.
- Report findings to the user and ask before deleting files.
