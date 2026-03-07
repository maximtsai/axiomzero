---
description: Steps for adding and playing audio assets
---

// turbo-all

1. **Place the audio file**
   Add your `.mp3` or `.wav` file to the `assets/audio/` directory.

2. **Register the asset**
   Add an entry to the `audioFiles` array in `assets/audioFiles.js`.
   ```javascript
   { name: 'your_sound_key', src: 'audio/your_file.mp3' },
   ```

3. **Play the audio in code**
   Use the global `audio` manager to play sounds or music.
   - **Sound Effect**: `audio.play('your_sound_key', volume, loop);`
   - **Music**: `audio.playMusic('your_sound_key', volume, loop);`
   - **Cross-fade Music**: `audio.swapMusic('new_music_key');`

4. **Useful Search Commands**
   Find where music is started:
   ```powershell
   Get-ChildItem -Path "./js" -Recurse | Select-String -Pattern "audio.playMusic"
   ```
   Find where specific sounds are used:
   ```powershell
   Get-ChildItem -Path "./js" -Recurse | Select-String -Pattern "audio.play('whoosh')"
   ```
