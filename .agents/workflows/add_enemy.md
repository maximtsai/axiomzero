---
description: Steps for adding a new enemy type
---

// turbo-all

1. Research existing enemy patterns
```powershell
Get-ChildItem -Path "./js/enemies" -Filter *.js
```

2. Checklist for registration:
- [ ] Create `js/enemies/NewEnemy.js` extending `Enemy`
- [ ] Add enemy constants to `js/gameConfig.js`
- [ ] Register in `enemyManager.js` spawn logic

3. Search for enemy registration points
```powershell
Get-ChildItem -Path "./js" -Recurse | Select-String -Pattern "BasicEnemy"
```
