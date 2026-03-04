---
description: Project discovery and file search workflow
---

// turbo-all

This workflow helps in quickly finding files and strings within the project.

1. List all JavaScript files in the project
```powershell
Get-ChildItem -Path "." -Filter *.js -Recurse | Select-Object FullName
```

2. Search for a specific pattern in JS files (replace PATTERN)
```powershell
Get-ChildItem -Path "./js" -Filter *.js -Recurse | Select-String -Pattern "PATTERN"
```

3. List all audio assets
```powershell
Get-ChildItem -Path "./assets/audio" -Recurse
```
