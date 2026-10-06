---
name: add-enemy
description: Add a new enemy type (regular, miniboss or boss) to Axiom Zero, including model/view class, pooling, spawn weights and registration. Use when the user asks for a new enemy, enemy variant, miniboss or boss.
---

# Adding an enemy

Enemies use an MVC split. Read `js/enemies/enemy.js` (base `EnemyModel`, `EnemyView`, `Enemy`) and the closest existing enemy first. `heavy_enemy.js` is a small, clean template; `logic_stray_enemy.js` has custom movement; `shooter_enemy.js` / `sniper_enemy.js` fire bullets via `enemyBulletManager`.

## Checklist

1. **Class file** `js/enemies/<name>_enemy.js` with three classes:
   - `<Name>EnemyModel extends EnemyModel`: set `this.size`, `this.type = '<name>'` (the spawn key), `baseResourceDrop`, `knockBackModifier`, and override `getHitFeedbackConfig()` if needed. Keep it Phaser-free.
   - `<Name>EnemyView extends EnemyView`: `super(Enemy.TEX_KEY, '<name>.png', '<name>_hp.png', depth)`.
   - `<Name>Enemy extends Enemy`: assign `this.model` / `this.view`.
   - Header comment in the same style as the other enemies (behaviour bullet list).
2. **Constants**: `GAME_CONSTANTS.ENEMY_SIZE_<NAME>` and other tuning in `js/gameConfig.js`, not magic numbers in the class.
3. **Script tag** in `index.html`: after `enemy.js` and before `miniboss.js` / `bossManager.js` / `enemyManager.js`.
4. **Pool + spawn** in `js/enemyManager.js`:
   - add `<name>: {}` to the pools map,
   - `pools.<name> = new ObjectPool(() => new <Name>Enemy(), resetFn, POOL_SIZE).preAllocate(n)`,
   - add a `chosenType === '<name>'` branch in the spawn chain.
5. **Spawn weights**: add `<name>: 0` to every `enemyProbabilities` block in `js/levelConfig.js`, then set non-zero weights only for the levels where it should appear.
6. **Art**: frames `<name>.png` and `<name>_hp.png` must exist in the `enemies` atlas. If they don't, tell the user. They add the art to `raw/enemies/` and republish `raw/enemies.tps` in TexturePacker. Never hand-edit atlas JSON.
7. **Text**: any player-facing name or description goes in `js/localization/en.js`.
8. **Minibosses / bosses** extend `Miniboss` / `Boss` and are driven by `bossManager.js` and level config (the `miniboss` field, e.g. `'Miniboss1'`), not the regular spawn pool. Follow `miniboss_1.js` / `bossSquare.js`.

## Verify

- `npm run lint` (catches missing script tags and undefined globals)
- `node .claude/skills/asset-audit/audit.js` (catches missing frames)
- `playtest` skill: load a save at a level whose `enemyProbabilities` includes the new type, start combat, screenshot it. For a quick look, temporarily raise its weight; revert that before finishing.
