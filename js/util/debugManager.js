// debugLog — drop-in replacement for console.log gated on FLAGS.DEBUG.
// Safe to call anywhere; no-ops silently when debug is off.
function debugLog(...args) {
    if (!FLAGS.DEBUG) return;
    console.log('[DEBUG]', ...args);
}

// initDebug — call once from MainScene.create().
// Creates a live FPS counter pinned to the top-left corner of the camera.
function initDebug(scene) {
    if (!FLAGS.DEBUG) return;

    const fpsText = scene.add.text(8, 8, '', {
        fontFamily:      'monospace',
        fontSize:        14,
        color:           '#00ff00',
        backgroundColor: '#00000088',
        padding:         { x: 4, y: 2 },
    }).setDepth(9999).setScrollFactor(0);

    updateManager.addFunction(() => {
        fpsText.setText('FPS ' + Math.round(scene.game.loop.actualFps));
    });

    debugLog('Debug mode enabled');
}
