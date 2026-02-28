// customEmitters.js
// Named Phaser 3.60+ particle emitter effects.
//
// Adding a new emitter:
//   1. const _myFx = _make(texture, config, depth);
//   2. function myEffect(x, y, ...) { const e = _myFx(); e.setAngle(...); e.explode(n, x, y); }
//   3. Add myEffect to the return object.

const customEmitters = (() => {

    // ── Lazy emitter factory ──────────────────────────────────────────────────
    // Returns a getter fn. The Phaser emitter is created on first call,
    // guaranteeing PhaserScene is ready without needing an explicit init().
    function _make(texture, config, depth) {
        let emitter = null;
        return function() {
            if (!emitter) {
                emitter = PhaserScene.add.particles(0, 0, texture, config);
                emitter.setDepth(depth);
            }
            return emitter;
        };
    }

    // ── basicStrike ──────────────────────────────────────────────────────────
    const _strike = _make('pixels', {
        frame:    'blue_pixel.png',
        speed:    { min: 30, max: 60 },
        lifespan: 250,
        scale:    { start: 4, end: 0 },
        alpha:    1,
        gravityY: 0,
        emitting: false,
    }, GAME_CONSTANTS.DEPTH_PROJECTILES);

    /**
     * Short directional burst of blue pixels — used on projectile hit.
     * @param {number} x      World X
     * @param {number} y      World Y
     * @param {number} angle  Centre direction in degrees (0 = right, 90 = down)
     */
    function basicStrike(x, y, angle) {
        const count = Math.floor(Math.random() * 3) + 3; // 3, 4, or 5
        const e = _strike();
        e.setAngle({ min: angle - 60, max: angle + 60 });
        e.explode(count, x, y);
    }

    // ── public API ───────────────────────────────────────────────────────────
    return { basicStrike };
})();
