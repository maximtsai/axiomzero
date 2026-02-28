// customEmitters.js
// Named Phaser 3.60+ particle emitter effects.
//
// Adding a new emitter with dynamic angle:
//   1. let _myFxAngle = 0;  (module-scoped slot for angle)
//   2. const _getMyFx = _make(texture, config, depth);
//      — use angle: { onEmit: () => _myFxAngle + Phaser.Math.Between(-spread, spread) } for cone
//   3. function _myFx(angle) { _myFxAngle = angle; return _getMyFx(); }
//   4. function myEffect(x, y, angle) { _myFx(angle).explode(count, x, y); }
//   5. Add myEffect to the return object.

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

    // ── Sprite pool for basicStrikeManual ─────────────────────────────────────
    const strikeSpritePool = new ObjectPool(
        () => {
            const sprite = PhaserScene.add.sprite(0, 0, 'pixels', 'blue_pixel.png');
            sprite.setActive(false);
            sprite.setVisible(false);
            return sprite;
        },
        (sprite) => {
            sprite.setActive(false);
            sprite.setVisible(false);
            sprite.setScale(1);
            sprite.setAlpha(1);
            sprite.setRotation(0);
            sprite.x = 0;
            sprite.y = 0;
        },
        50
    );

    // ── basicStrike ──────────────────────────────────────────────────────────
    // Angle slot — set before explode() so the onEmit callback reads the correct value.
    let _strikeAngle = 0;

    const strikeParams = {
        frame:    'blue_pixel.png',
        speed:    { min: 80, max: 230, ease: 'Cubic.easeOut' },
        lifespan: { min: 200, max: 400 },
        scaleX:   { start: 12, end: 0, ease: 'Quad.easeIn' },
        scaleY:   2,
        alpha:    1,
        gravityY: 0,
        emitting: false,
        angle:    { min: -180, max: 180 },
    }

    const _strike = _make('pixels', strikeParams, GAME_CONSTANTS.DEPTH_ENEMIES + 2);

    /**
     * Short directional burst of blue pixels — used on projectile hit.
     * @param {number} x      World X
     * @param {number} y      World Y
     * @param {number} angle  Centre direction in degrees (0 = right, 90 = down)
     */
    function basicStrike(x, y, angle) {
        const count = Math.floor(Math.random() * 3) + 3; // 3, 4, or 5
        const e = _strike();
        let minAngle = angle - 60;
        let maxAngle = angle + 60;
        let newParams = strikeParams;
        newParams.angle = { min: minAngle, max: maxAngle }
        e.setConfig(newParams)
        //e.setAngle({min: minAngle, max: maxAngle});
        e.explode(count, x, y);
    }

    // ── basicStrikeManual ─────────────────────────────────────────────────────
    // Sprite-based version using ObjectPool — matches basicStrike behavior.
    function basicStrikeManual(x, y, angle) {
        const count = Math.floor(Math.random() * 3) + 3;
        const minAngle = angle - 60;
        const maxAngle = angle + 60;
        const depth = GAME_CONSTANTS.DEPTH_ENEMIES + 2;

        for (let i = 0; i < count; i++) {
            const sprite = strikeSpritePool.get();
            sprite.setPosition(x, y);
            sprite.setDepth(depth);
            sprite.setVisible(true);
            sprite.setActive(true);

            const emitAngle = Phaser.Math.Between(minAngle, maxAngle);
            const radians = Phaser.Math.DegToRad(emitAngle);
            const lifespan = Phaser.Math.Between(80, 380);

            sprite.setRotation(radians);
            sprite.setOrigin(0, 0.5);
            sprite.setScale(lifespan * 0.05 + Phaser.Math.Between(1, 2), 2);
            sprite.setAlpha(1);

            const dist = lifespan * 0.17 + 15;
            const targetX = x + Math.cos(radians) * dist;
            const targetY = y + Math.sin(radians) * dist;

            PhaserScene.tweens.add({
                targets: sprite,
                x: targetX,
                y: targetY,
                duration: lifespan + 70,
                ease: 'Cubic.easeOut',
            });
            PhaserScene.tweens.add({
                targets: sprite,
                scaleX: 0,
                duration: lifespan,
                completeDelay: 100,
                onComplete: () => {
                    sprite.setActive(false);
                    sprite.setVisible(false);
                    strikeSpritePool.release(sprite);
                }
            });
        }
    }

    // ── public API ───────────────────────────────────────────────────────────
    return { basicStrike, basicStrikeManual };
})();
