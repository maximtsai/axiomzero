---
description: Prepare project for production distribution
---

// turbo-all

1. Check for DEBUG flags in globals.js or gameConfig.js
```powershell
Select-String -Path "./js/gameConfig.js", "./js/util/globals.js" -Pattern "DEBUG|DEV"
```

2. Audit asset weights
```powershell
Get-ChildItem -Path "./assets" -Recurse | Sort-Object Length -Descending | Select-Object Name, @{Name="Size(MB)";Expression={$_.Length / 1MB}} -First 10
```

3. Final check for missing registrations
```powershell
# Use /asset_audit after this
```
