const floatingText = (() => {
    let _scene = null;
    let _pool = null;
    let _activeTexts = [];
    const MAX_ACTIVE = 120; // Hard cap on simultaneous damage numbers

    function init(scene) {
        _scene = scene;
        _pool = new ObjectPool(_factory, _reset, 30);
        updateManager.addFunction(_update);
    }

    function _factory() {
        const t = _scene.add.text(0, 0, '', {
            fontFamily: 'Arial',
            fontSize: '22px',
            color: '#ffffff',
        });
        t.setOrigin(0.5, 0.5);
        t.setAlpha(0);
        t.setVisible(false);
        // Cache current styles on the object to avoid redundant setStyle calls
        t._cachedStyles = {
            fontFamily: 'Arial',
            fontSize: '22px',
            color: '#ffffff'
        };
        return t;
    }

    function _reset(t) {
        t.setAlpha(0);
        t.setVisible(false);
    }

    function show(x, y, text, opts) {
        if (!_pool) return;

        // Safety cap: don't spawn more than MAX_ACTIVE to prevent frame spikes
        if (_activeTexts.length >= MAX_ACTIVE) return;

        opts = opts || {};
        const fontSize = opts.fontSize !== undefined ? opts.fontSize : 22;
        const fontFamily = opts.fontFamily || 'Arial';
        const color = opts.color || '#ffffff';
        const depth = opts.depth !== undefined ? opts.depth : 9999;
        const duration = opts.duration !== undefined ? opts.duration : 1200;

        const t = _pool.get();
        t.setText(text);

        // Style Caching: Only update if something changed
        const fontStr = fontSize + 'px';
        if (t._cachedStyles.fontFamily !== fontFamily ||
            t._cachedStyles.fontSize !== fontStr ||
            t._cachedStyles.color !== color) {

            t.setStyle({ fontFamily, fontSize: fontStr, color });
            t._cachedStyles.fontFamily = fontFamily;
            t._cachedStyles.fontSize = fontStr;
            t._cachedStyles.color = color;
        }

        t.setPosition(x, y);
        t.setAlpha(1);
        t.setDepth(depth);
        t.setVisible(true);

        // Custom state for manual update loop (avoids Tween overhead)
        t._floatY = y;
        t._startTime = 0; // Will be set on first update call or here
        t._elapsed = 0;
        t._totalDuration = duration;
        t._startY = y;
        // Travel distance is fixed regardless of duration for consistency
        t._targetTravel = 85;

        _activeTexts.push(t);
    }

    function _update(delta) {
        if (_activeTexts.length === 0) return;

        for (let i = _activeTexts.length - 1; i >= 0; i--) {
            const t = _activeTexts[i];
            t._elapsed += delta;

            const progress = Math.min(1, t._elapsed / t._totalDuration);

            // Movement: Quad.easeOut
            const movementProgress = 1 - Math.pow(1 - progress, 2);
            t.y = t._startY - (t._targetTravel * movementProgress);

            // Fade out: starts after 60% of duration, Quad.easeIn
            if (progress > 0.6) {
                const fadeProgress = (progress - 0.6) / 0.4;
                t.setAlpha(1 - (fadeProgress * fadeProgress));
            } else {
                t.setAlpha(1);
            }

            // Expiry Check
            if (progress >= 1) {
                _pool.release(t);
                _activeTexts[i] = _activeTexts[_activeTexts.length - 1];
                _activeTexts.pop();
            }
        }
    }

    return { init, show };
})();

