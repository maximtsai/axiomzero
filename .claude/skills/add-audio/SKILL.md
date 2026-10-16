---
name: add-audio
description: Add a sound effect or music track to Axiom Zero and wire it into gameplay. Use when the user wants a new sound, wants to hook an existing mp3 up to an action, or asks why a sound isn't playing.
---

# Adding audio

1. **File**: put the `.mp3` in `assets/audio/` (snake_case filename).
2. **Register**: add `{ name: 'key', src: 'audio/file.mp3' }` to the `audioFiles` array in `assets/audioFiles.js`. Keys must be unique. `audioManager.js` loads every entry from `'assets/' + src`.
3. **Play** it through the global `audio` (`js/util/audioManager.js`):
   - SFX: `audio.play('key', volume = 1, loop = false, isMusic = false, pan = 0)`
   - Music: `audio.playMusic('key', volume, loop = true)`; crossfade with `audio.swapMusic('key')`
   - Music must respect `gameState.settings.musicMuted`. Look at the existing call sites (`grep -rn "audio.playMusic" js`) and copy how they guard and clean up, especially boss music across phase transitions.
4. **Feedback rule** (docs/ARCH.md): every new player action (click, kill, purchase, drop) should get a sound. `Button` already plays `click` on press, so don't add a second one.
5. **High-frequency sounds** (hits, pickups): check how nearby code throttles or varies volume/pan before adding a call that may fire 100x per second.
6. **Verify**: run `node .claude/skills/asset-audit/audit.js` and confirm there are no audio errors. Then use the `playtest` skill to trigger the action. The preview can't be heard, but there must be no `audio` warnings in the console.
