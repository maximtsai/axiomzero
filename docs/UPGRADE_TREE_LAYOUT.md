# Upgrade Tree Layout

Node positions in `js/nodeDefs.js` (and lore nodes in `js/loreDefs.js`) use grid helpers, not pixels:

```js
treeX: gridX(1),    // TREE_CENTER_X + TREE_UNIT_X * units  → 400 + 100 * 1
treeY: gridY(-2),   // TREE_START_Y - TREE_UNIT_Y * units   → 740 - 100 * -2
```

- One grid unit is **100px**. `gridX(0)` is the panel centre (x = 400); `gridY(0)` is AWAKEN's row (y = 740).
- **Positive `gridY` goes up** (deeper into the tree); negative goes below AWAKEN.
- Half steps (`gridX(1.5)`) are used where a cluster is dense. Keep at least one full unit between unrelated nodes.

## Landmarks

| Node | Position | Notes |
|---|---|---|
| AWAKEN | (0, 0) | Root |
| INTEGRITY | (-1, 0) | Health branch (left) |
| FOCUS | (1, 0) | Cursor branch (right) |
| AUTOMATED DEFENSE | (0, 1) | Tower attack; most of the tree grows upward from here |
| CHEAT | (0, -2) | Cluster below AWAKEN (lore, clock speed, junk data, …) |
| COMPANION | (0, -4) | Dot |

## Rules for new nodes

1. **Theme by side**: health, defence and utility on the left; damage and cursor/attack upgrades on the right.
2. **No overlaps**: two nodes on the same spot makes one unclickable. `npm test` (`tests/nodeDefs.test.js`) fails on overlaps.
3. **Links both ways**: list the node in its parents' `childIds` and the parents in its `parents`. The same test checks this.
4. Duo-box (choice) nodes sit as a pair; their placeholder node (`placeholder_duo_*`) groups them.
