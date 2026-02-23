// debugManager.js
// initDebug — call once from MainScene.create().
// debugLog is defined in globals.js for early availability before utilities.js loads.

function initDebug(scene) {
    if (!FLAGS.DEBUG) return;

    // ── FPS counter ───────────────────────────────────────────────────────────
    const fpsText = scene.add.text(8, 8, '', {
        fontFamily:      'monospace',
        fontSize:        14,
        color:           '#00ff00',
        backgroundColor: '#00000088',
        padding:         { x: 4, y: 2 },
    }).setDepth(9999).setScrollFactor(0);

    // ── GAME_VARS inspector ───────────────────────────────────────────────────
    const inspectorBg = scene.add.rectangle(4, 28, 10, 10, 0x000000, 0.72)
        .setOrigin(0, 0).setDepth(9998).setScrollFactor(0);

    const inspectorText = scene.add.text(8, 32, '', {
        fontFamily:  'monospace',
        fontSize:    11,
        color:       '#88ff88',
        lineSpacing: 2,
    }).setDepth(9999).setScrollFactor(0);

    // ── Per-frame update ──────────────────────────────────────────────────────
    updateManager.addFunction(() => {
        fpsText.setText('FPS ' + Math.round(scene.game.loop.actualFps));

        const lines = Object.entries(GAME_VARS).map(([k, v]) => {
            let val;
            if (typeof v === 'number') {
                val = Number.isInteger(v) ? v : v.toFixed(3);
            } else if (v !== null && typeof v === 'object') {
                val = JSON.stringify(v);
            } else {
                val = String(v);
            }
            return `${k}: ${val}`;
        });
        inspectorText.setText(lines.join('\n'));
        inspectorBg.width  = inspectorText.width  + 8;
        inspectorBg.height = inspectorText.height + 8;
    });

    debugLog('Debug mode enabled');
}
