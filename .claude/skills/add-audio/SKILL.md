---
name: add-audio
description: Add a sound effect or music track to Axiom Zero and wire it into gameplay. Use when the user wants a new sound, wants to hook an existing mp3 up to an action, or asks why a sound isn't playing.
---

# Adding audio

1. **File**: put the `.mp3` in `assets/audio/` (snake_case filename).
2. **Register**: add `{ name: 'key', src: 'audio/file.mp3' }` to the `audioFiles` array in `assets/audioFiles.js`. Keys must be unique. Keys containing `music` (e.g. `bg_music2`) load on the loading screen; everything else loads in the background after boot (`audio.startBackgroundLoading`), and `audio.play` on a not-yet-loaded key plays nothing.
3. **Play** it through the global `audio` (`js/util/audioManager.js`):
   - SFX: `audio.play('key', volume = 1, loop = false, isMusic = false, pan = 0)`
   - Music: `audio.playMusic('key', volume, loop = true)`; crossfade with `audio.swapMusic('key')`
   - Muting is handled inside `audio`. Copy the existing call sites (`grep -rn "audio.playMusic" js`) for cleanup, especially boss music across phase transitions.
4. **Feedback rule**: every new player action (click, kill, purchase, drop) should get a sound. `Button` plays no sound itself; add one in its `onHover`/`onMouseUp` callbacks (see `createOptionsButton` in `js/uibuttons.js` for the usual hover `click`).
5. **High-frequency sounds** (hits, pickups): check how nearby code throttles or varies volume/pan before adding a call that may fire 100x per second.
6. **Verify**: run `npm run audit-assets` and confirm there are no audio errors. Then use the `playtest` skill to trigger the action. The preview can't be heard, but there must be no `audio` warnings in the console.
