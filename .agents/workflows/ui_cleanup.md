---
description: Remove debug logs and markers
---

// turbo-all

1. Search for console.log statements
```powershell
Get-ChildItem -Path "./js" -Recurse -Filter *.js | Select-String -Pattern "console\.log"
```

2. Search for common TODO markers
```powershell
Get-ChildItem -Path "./js" -Recurse -Filter *.js | Select-String -Pattern "TODO|DEBUG|FIXME"
```

3. Remove console.logs (DANGEROUS: Review first)
```powershell
# (Manual step recommended for deletion)
```
