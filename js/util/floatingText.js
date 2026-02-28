// floatingText.js — Pooled floating text effects.
// Text spawns at (x, y), floats up 100px linearly over 2 seconds,
// and fades out starting at 1.5s over 0.5s (Quad.easeIn).
//
// Usage:
//   floatingText.init(scene);                    // call once on init
//   floatingText.show(x, y, 'text', { ...opts }); // spawn a label
//
// Options (all optional):
//   fontSize   {number}  default 18
//   fontFamily {string}  default 'Arial'
//   color      {string}  default '#ffffff'
//   depth      {number}  default 9999

const floatingText = (() => {
    let _scene = null;
    let _pool  = null;

    function init(scene) {
        _scene = scene;
        _pool  = new ObjectPool(_factory, _reset, 20);
    }

    function _factory() {
        const t = _scene.add.text(0, 0, '', {
            fontFamily: 'Arial',
            fontSize:   '18px',
            color:      '#ffffff',
        });
        t.setOrigin(0.5, 0.5);
        t.setAlpha(0);
        t.setVisible(false);
        return t;
    }

    function _reset(t) {
        _scene.tweens.killTweensOf(t);
        t.setAlpha(0);
        t.setVisible(false);
    }

    function show(x, y, text, opts) {
        if (!_pool) return;

        opts = opts || {};
        const fontSize   = opts.fontSize   !== undefined ? opts.fontSize   : 18;
        const fontFamily = opts.fontFamily || 'Arial';
        const color      = opts.color      || '#ffffff';
        const depth      = opts.depth      !== undefined ? opts.depth      : 9999;

        const t = _pool.get();
        t.setText(text);
        t.setStyle({ fontFamily: fontFamily, fontSize: fontSize + 'px', color: color });
        t.setPosition(x, y);
        t.setAlpha(1);
        t.setDepth(depth);
        t.setVisible(true);

        // Float up 100px linearly over 3 seconds
        _scene.tweens.add({
            targets:  t,
            y:        y - 90,
            duration: 2400,
            ease:     'Quad.easeOut',
        });

        // Fade to alpha 0 starting at 2.5s, over 0.5s (Quad.easeIn)
        _scene.tweens.add({
            targets:  t,
            alpha:    0,
            duration: 500,
            delay:    1900,
            ease:     'Quad.easeIn',
            onComplete: () => {
                _pool.release(t);
            },
        });
    }

    return { init, show };
})();
