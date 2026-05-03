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

    // ── HTML Debug Overlay ───────────────────────────────────────────────────
    const debugDiv = document.createElement('div');
    debugDiv.id = 'axiom-debug-overlay';
    debugDiv.style.position = 'absolute';
    debugDiv.style.top = '70px';
    debugDiv.style.right = '10px';
    debugDiv.style.padding = '8px';
    debugDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.55)';
    debugDiv.style.color = '#00ff00';
    debugDiv.style.fontFamily = 'monospace';
    debugDiv.style.fontSize = '13px';
    debugDiv.style.pointerEvents = 'none';
    debugDiv.style.zIndex = '99999';
    debugDiv.style.textAlign = 'right';
    debugDiv.style.whiteSpace = 'pre';
    debugDiv.style.lineHeight = '1.4';
    document.body.appendChild(debugDiv);

    let lastDrawCountUpdate = 0;
    let currentDrawCount = 'N/A';

    // ── Per-frame update ──────────────────────────────────────────────────────
    updateManager.addFunction(() => {
        const now = scene.time.now;
        if (now - lastDrawCountUpdate >= 1000) {
            lastDrawCountUpdate = now;
            const drawCount = scene.sys.game.renderer.drawCount;
            currentDrawCount = (drawCount !== undefined) ? drawCount : 'N/A';
        }

        const fps = Math.round(scene.game.loop.actualFps);
        let output = `FPS ${fps} | DC ${currentDrawCount}\n`;
        output += '─'.repeat(20) + '\n';

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

        debugDiv.textContent = output + lines.join('\n');
    });

    debugLog('Debug mode enabled');
}
