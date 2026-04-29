/**
 * @fileoverview Debug overlay — FPS counter and GAME_VARS inspector.
 * Only activates when FLAGS.DEBUG is true.
 * Call initDebug(scene) once from MainScene.create().
 * @module debugManager
 */

/**
 * Initialize the debug overlay (FPS text + GAME_VARS inspector).
 * No-ops if FLAGS.DEBUG is false.
 * @param {Phaser.Scene} scene
 */
function initDebug(scene) {
    if (!FLAGS.DEBUG) return;

    // ── FPS counter ───────────────────────────────────────────────────────────
    const fpsText = scene.add.text(GAME_CONSTANTS.WIDTH - 10, 58, '', {
        fontFamily: 'monospace',
        fontSize: 17,
        color: '#00ff00',
        backgroundColor: '#00000088',
        padding: { x: 4, y: 2 },
    }).setOrigin(1, 0).setDepth(9999).setScrollFactor(0);

    // ── GAME_VARS inspector ───────────────────────────────────────────────────
    const inspectorBg = scene.add.rectangle(GAME_CONSTANTS.WIDTH - 5, 58 + 25, 10, 10, 0x000000, 0.72)
        .setOrigin(1, 0).setDepth(9998).setScrollFactor(0);

    const inspectorText = scene.add.text(GAME_CONSTANTS.WIDTH - 10, 58 + 30, '', {
        fontFamily: 'monospace',
        fontSize: 13,
        color: '#88ff88',
        align: 'right',
        lineSpacing: 2,
    }).setOrigin(1, 0).setDepth(9999).setScrollFactor(0);

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
        inspectorBg.width = inspectorText.width + 8;
        inspectorBg.height = inspectorText.height + 8;
    });

    debugLog('Debug mode enabled');
}
