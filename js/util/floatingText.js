const floatingText = (() => {
    let _scene = null;
    let _pool = null;
    let _activeTexts = [];
    let _frameCounter = 0;
    const MAX_ACTIVE = 200; // Hard cap on simultaneous damage numbers
    const MAX_PER_FRAME = 15; // Limit to prevent spikes from DoT or AoE events

    function init(scene) {
        _scene = scene;
        _pool = new ObjectPool(_factory, _reset, 200).preAllocate(50);
        updateManager.addFunction(_update);
    }

    function _factory() {
        const t = _scene.add.text(0, 0, '', {
            fontFamily: 'JetBrainsMono_Regular',
            fontSize: '22px',
            color: '#ffffff',
        });
        t.setOrigin(0.5, 0.5);
        t.setAlpha(0);
        t.setVisible(false);
        t.setScale(1, 1);
        // Cache current styles on the object to avoid redundant setStyle calls
        t._cachedStyles = {
            fontFamily: 'JetBrainsMono_Regular',
            fontSize: '22px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 0
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
        if (_frameCounter >= MAX_PER_FRAME) return;
        _frameCounter++;

        opts = opts || {};
        const fontSize = opts.fontSize !== undefined ? opts.fontSize : 22;
        const fontFamily = opts.fontFamily || 'JetBrainsMono_Regular';
        const color = opts.color || '#ffffff';
        const stroke = opts.stroke || '#000000';
        const strokeThickness = opts.strokeThickness !== undefined ? opts.strokeThickness : 0;
        const depth = opts.depth !== undefined ? opts.depth : 9999;
        const duration = opts.duration !== undefined ? opts.duration : 1200;
        const travel = opts.travel !== undefined ? opts.travel : 85;
        const scaleX = opts.scaleX !== undefined ? opts.scaleX : 1;
        const scaleY = opts.scaleY !== undefined ? opts.scaleY : 1;

        const t = _pool.get();
        t.setText(text);

        // Style Caching: Only update if something changed
        const fontStr = fontSize + 'px';
        if (t._cachedStyles.fontFamily !== fontFamily ||
            t._cachedStyles.fontSize !== fontStr ||
            t._cachedStyles.color !== color ||
            t._cachedStyles.stroke !== stroke ||
            t._cachedStyles.strokeThickness !== strokeThickness) {

            t.setStyle({ fontFamily, fontSize: fontStr, color, stroke, strokeThickness });
            t._cachedStyles.fontFamily = fontFamily;
            t._cachedStyles.fontSize = fontStr;
            t._cachedStyles.color = color;
            t._cachedStyles.stroke = stroke;
            t._cachedStyles.strokeThickness = strokeThickness;
        }

        t.setPosition(x, y);
        t.setAlpha(1);
        t.setDepth(depth);
        t.setVisible(true);
        t.setScale(scaleX, scaleY);

        // Custom state for manual update loop (avoids Tween overhead)
        t._floatY = y;
        t._startTime = 0; // Will be set on first update call or here
        t._elapsed = 0;
        t._totalDuration = duration;
        t._startY = y;
        // Travel distance is fixed regardless of duration for consistency
        t._targetTravel = travel;
        t._baseScaleX = scaleX;
        t._baseScaleY = scaleY;

        _activeTexts.push(t);
    }

    function _update(delta) {
        _frameCounter = 0; // Reset every frame
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

            // Scale down: last 250ms, Cubic.easeIn to 0.45
            const scaleAnimDuration = 250;
            const scaleStartTime = t._totalDuration - scaleAnimDuration;
            if (t._elapsed > scaleStartTime) {
                const scaleProgress = Math.min(1, (t._elapsed - scaleStartTime) / scaleAnimDuration);
                const easedScale = 1 - (Math.pow(scaleProgress, 3) * 0.55);
                t.setScale(t._baseScaleX * easedScale, t._baseScaleY * easedScale);
            } else {
                t.setScale(t._baseScaleX, t._baseScaleY);
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

