// spatialGridUtils.js
// Specialized spatial hashing for high-performance enemy proximity queries.

const spatialGridUtils = (() => {
    const CELL_SIZE = 150;
    const GRID_PADDING = 60; // Padding to account for max enemy collision radius

    let spatialGrid = {};       // Map of cellKey -> array of enemies
    let activeCellKeys = [];    // Tracks cells that were populated this frame for efficient clearing
    let spatialGridFrame = 0;   // monotonically increasing ID for frame-based synchronization
    let specialEnemies = [];    // List of "special" large-scale enemies (bosses) that bypass the grid

    function init() {
        clear();
    }

    /** 
     * Converts a (cx, cy) grid cell coordinate to a unique integer key. 
     * Offset to handle negative coordinates reliably.
     */
    function getGridKey(cx, cy) {
        return (cx + 5000) * 10000 + (cy + 5000);
    }

    /** Resets grid state completely. */
    function clear() {
        // Zero-garbage clear of populated cells
        for (let i = 0; i < activeCellKeys.length; i++) {
            const key = activeCellKeys[i];
            if (spatialGrid[key]) spatialGrid[key].length = 0;
        }
        activeCellKeys.length = 0;
        specialEnemies.length = 0;
        spatialGridFrame = 0;
    }

    /** Prepares the grid for a new frame's worth of insertions. */
    function resetForFrame() {
        spatialGridFrame++;
        for (let i = 0; i < activeCellKeys.length; i++) {
            const key = activeCellKeys[i];
            if (spatialGrid[key]) spatialGrid[key].length = 0;
        }
        activeCellKeys.length = 0;
        specialEnemies.length = 0;
    }

    function insert(e) {
        if (e.model.isBoss || e.model.isMiniboss) {
            specialEnemies.push(e);
        } else {
            const cx = Math.floor(e.model.x / CELL_SIZE);
            const cy = Math.floor(e.model.y / CELL_SIZE);
            const key = getGridKey(cx, cy);

            let cell = spatialGrid[key];
            if (!cell) {
                cell = [];
                cell.lastUpdateFrame = -1;
                spatialGrid[key] = cell;
            }

            if (cell.lastUpdateFrame !== spatialGridFrame) {
                cell.lastUpdateFrame = spatialGridFrame;
                activeCellKeys.push(key);
            }

            cell.push(e);
        }
    }

    function getNearestEnemy(x, y, range) {
        let best = null;
        let bestEffectiveDist = range;

        // 1. Check special large enemies (usually bosses)
        for (let i = 0; i < specialEnemies.length; i++) {
            const e = specialEnemies[i];
            const maxDR = bestEffectiveDist + (e.model.size || 0);
            const dx = e.model.x - x;
            const dy = e.model.y - y;
            const d2 = dx * dx + dy * dy;

            if (d2 < maxDR * maxDR) {
                const dist = Math.sqrt(d2);
                const effectiveDist = dist - (e.model.size || 0);
                if (effectiveDist < bestEffectiveDist) {
                    bestEffectiveDist = effectiveDist;
                    best = e;
                }
            }
        }

        // 2. Query spatial grid cells within the range
        const minCellX = Math.floor((x - range - GRID_PADDING) / CELL_SIZE);
        const maxCellX = Math.floor((x + range + GRID_PADDING) / CELL_SIZE);
        const minCellY = Math.floor((y - range - GRID_PADDING) / CELL_SIZE);
        const maxCellY = Math.floor((y + range + GRID_PADDING) / CELL_SIZE);

        for (let cx = minCellX; cx <= maxCellX; cx++) {
            for (let cy = minCellY; cy <= maxCellY; cy++) {
                const arr = spatialGrid[getGridKey(cx, cy)];
                if (arr) {
                    for (let i = 0; i < arr.length; i++) {
                        const e = arr[i];
                        const maxDR = bestEffectiveDist + (e.model.size || 0);
                        const dx = e.model.x - x;
                        const dy = e.model.y - y;
                        const d2 = dx * dx + dy * dy;

                        if (d2 < maxDR * maxDR) {
                            const dist = Math.sqrt(d2);
                            const effectiveDist = dist - (e.model.size || 0);
                            if (effectiveDist < bestEffectiveDist) {
                                bestEffectiveDist = effectiveDist;
                                best = e;
                            }
                        }
                    }
                }
            }
        }
        return best;
    }

    function getEnemiesInSquareRange(cx, cy, halfSize, out) {
        const result = out || [];
        result.length = 0;

        for (let i = 0; i < specialEnemies.length; i++) {
            const e = specialEnemies[i];
            const reach = halfSize + (e.model.size || 0);
            if (Math.abs(e.model.x - cx) <= reach && Math.abs(e.model.y - cy) <= reach) {
                result.push(e);
            }
        }

        const minCellX = Math.floor((cx - halfSize - GRID_PADDING) / CELL_SIZE);
        const maxCellX = Math.floor((cx + halfSize + GRID_PADDING) / CELL_SIZE);
        const minCellY = Math.floor((cy - halfSize - GRID_PADDING) / CELL_SIZE);
        const maxCellY = Math.floor((cy + halfSize + GRID_PADDING) / CELL_SIZE);

        for (let x = minCellX; x <= maxCellX; x++) {
            for (let y = minCellY; y <= maxCellY; y++) {
                const arr = spatialGrid[getGridKey(x, y)];
                if (arr) {
                    for (let i = 0; i < arr.length; i++) {
                        const e = arr[i];
                        const reach = halfSize + (e.model.size || 0);
                        if (Math.abs(e.model.x - cx) <= reach && Math.abs(e.model.y - cy) <= reach) {
                            result.push(e);
                        }
                    }
                }
            }
        }
        return result;
    }

    function getEnemiesInDiamondRange(cx, cy, radius, ignoreEnemy = null, out) {
        const result = out || [];
        result.length = 0;

        for (let i = 0; i < specialEnemies.length; i++) {
            const e = specialEnemies[i];
            if (e === ignoreEnemy) continue;
            const dx = Math.abs(e.model.x - cx);
            const dy = Math.abs(e.model.y - cy);
            if (dx + dy <= radius + (e.model.size || 0)) {
                result.push(e);
            }
        }

        const minCellX = Math.floor((cx - radius - GRID_PADDING) / CELL_SIZE);
        const maxCellX = Math.floor((cx + radius + GRID_PADDING) / CELL_SIZE);
        const minCellY = Math.floor((cy - radius - GRID_PADDING) / CELL_SIZE);
        const maxCellY = Math.floor((cy + radius + GRID_PADDING) / CELL_SIZE);

        for (let x = minCellX; x <= maxCellX; x++) {
            for (let y = minCellY; y <= maxCellY; y++) {
                const arr = spatialGrid[getGridKey(x, y)];
                if (arr) {
                    for (let i = 0; i < arr.length; i++) {
                        const e = arr[i];
                        if (e === ignoreEnemy) continue;
                        const dx = Math.abs(e.model.x - cx);
                        const dy = Math.abs(e.model.y - cy);
                        if (dx + dy <= radius + (e.model.size || 0)) {
                            result.push(e);
                        }
                    }
                }
            }
        }
        return result;
    }

    function getEnemiesInRange(cx, cy, radius, out) {
        const result = out || [];
        result.length = 0;

        for (let i = 0; i < specialEnemies.length; i++) {
            const e = specialEnemies[i];
            const dx = e.model.x - cx;
            const dy = e.model.y - cy;
            const reach = radius + (e.model.size || 0);
            if (dx * dx + dy * dy <= reach * reach) {
                result.push(e);
            }
        }

        const minCellX = Math.floor((cx - radius - GRID_PADDING) / CELL_SIZE);
        const maxCellX = Math.floor((cx + radius + GRID_PADDING) / CELL_SIZE);
        const minCellY = Math.floor((cy - radius - GRID_PADDING) / CELL_SIZE);
        const maxCellY = Math.floor((cy + radius + GRID_PADDING) / CELL_SIZE);

        for (let x = minCellX; x <= maxCellX; x++) {
            for (let y = minCellY; y <= maxCellY; y++) {
                const arr = spatialGrid[getGridKey(x, y)];
                if (arr) {
                    for (let i = 0; i < arr.length; i++) {
                        const e = arr[i];
                        const dx = e.model.x - cx;
                        const dy = e.model.y - cy;
                        const reach = radius + (e.model.size || 0);
                        if (dx * dx + dy * dy <= reach * reach) {
                            result.push(e);
                        }
                    }
                }
            }
        }
        return result;
    }

    return {
        init,
        clear,
        resetForFrame,
        insert,
        getNearestEnemy,
        getEnemiesInSquareRange,
        getEnemiesInDiamondRange,
        getEnemiesInRange
    };
})();
