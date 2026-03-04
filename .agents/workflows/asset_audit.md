---
description: Audit physical assets against registration files
---

// turbo-all

This workflow helps ensure all audio and image files are registered in the codebase.

1. List physical audio files vs audioFiles.js
```powershell
Write-Host "--- Physical Audio Files ---"
Get-ChildItem -Path "./assets/audio" -Recurse -File | Select-Object Name
Write-Host "--- Registered in audioFiles.js ---"
Get-Content "./assets/audioFiles.js" | Select-String -Pattern "src:"
```

2. List physical image files vs imageFiles.js
```powershell
Write-Host "--- Physical Image Files ---"
Get-ChildItem -Path "./assets/images" -Recurse -File | Select-Object Name
Write-Host "--- Registered in imageFiles.js ---"
Get-Content "./assets/imageFiles.js" | Select-String -Pattern "src:"
```
