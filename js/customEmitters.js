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
            const lifespan = Phaser.Math.Between(30, 250) + Phaser.Math.Between(30, 100);

            sprite.setRotation(radians);
            sprite.setOrigin(0, 0.5);
            sprite.setAlpha(1);

            const dist = (lifespan * 0.2 + 20) * (0.4 + Math.random() * 0.6);
            let startScale = dist * (0.2 + Math.random() * 0.3) + 2;
            sprite.setScale(startScale, 2);

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

    // tower death 
    const towerDeathParams = {
        frame:    'white_pixel.png',
        speed:    { min: 50, max: 250, ease: 'Cubic.easeOut' },
        lifespan: { min: 400, max: 1400 },
        scale:   { start: 25, end: 5, ease: 'Quad.easeIn' },
        alpha:    { start: 0.4, end: 0, ease: 'Quad.easeIn' },
        gravityY: 0,
        emitting: false,
    }

    const _towerDeath = _make('pixels', towerDeathParams, GAME_CONSTANTS.DEPTH_TOWER + 2);

    function towerDeath(x, y) {
        const count = 7;
        const e = _towerDeath();
        e.explode(count, x, y);
    }

    // ── public API ───────────────────────────────────────────────────────────
    return { basicStrike, basicStrikeManual, towerDeath };
})();
