// tweens.js - Custom tweening utilities for complex animations

/**
 * Tween an image's tint from its current color to a target color.
 * Uses RGB component interpolation for smooth color transitions.
 *
 * @param {Phaser.GameObjects.Image} image
 * @param {number} endTint - Target tint as hex (e.g. 0xFF0000)
 * @param {number} duration - Duration in ms
 * @param {string} ease
 * @param {function} onComplete
 * @returns {Phaser.Tweens.Tween}
 */
function tweenTint(image, endTint, duration, ease = 'Linear', onComplete = null) {
    if (!image || !image.setTint) {
        console.warn('tweenTint: invalid image');
        return null;
    }
    const cur  = image.tintTopLeft || 0xFFFFFF;
    const sR = (cur >> 16) & 0xFF, sG = (cur >> 8) & 0xFF, sB = cur & 0xFF;
    const eR = (endTint >> 16) & 0xFF, eG = (endTint >> 8) & 0xFF, eB = endTint & 0xFF;
    const proxy = { r: sR, g: sG, b: sB };
    return PhaserScene.tweens.add({
        targets: proxy,
        r: eR, g: eG, b: eB,
        duration, ease,
        onUpdate: () => {
            image.setTint(
                (Math.round(proxy.r) << 16) |
                (Math.round(proxy.g) << 8)  |
                 Math.round(proxy.b)
            );
        },
        onComplete
    });
}

/**
 * Scale a target up to a peak and back down (pulse).
 *
 * @param {Phaser.GameObjects.GameObject} target
 * @param {number} scale - Peak scale multiplier (default 1.2)
 * @param {number} duration - Total duration in ms (default 300)
 * @param {string} ease
 * @param {function} onComplete
 * @returns {Phaser.Tweens.Tween}
 */
function tweenPulse(target, scale = 1.2, duration = 300, ease = 'Sine.easeInOut', onComplete = null) {
    if (!target) return null;
    const ox = target.scaleX || 1;
    const oy = target.scaleY || 1;
    return PhaserScene.tweens.add({
        targets:  target,
        scaleX:   ox * scale,
        scaleY:   oy * scale,
        duration: duration / 2,
        ease,
        yoyo: true,
        onComplete: () => {
            target.scaleX = ox;
            target.scaleY = oy;
            if (onComplete) onComplete();
        }
    });
}

/**
 * Shake a target horizontally.
 *
 * @param {Phaser.GameObjects.GameObject} target
 * @param {number} intensity - Shake distance in pixels (default 6)
 * @param {number} duration - Total duration in ms (default 400)
 * @param {function} onComplete
 * @returns {Phaser.Tweens.Tween}
 */
function tweenShake(target, intensity = 6, duration = 400, onComplete = null) {
    if (!target) return null;
    const ox = target.x;
    return PhaserScene.tweens.add({
        targets:  target,
        x:        ox + intensity,
        duration: duration / 8,
        ease:     'Sine.easeInOut',
        yoyo:     true,
        repeat:   3,
        onComplete: () => {
            target.x = ox;
            if (onComplete) onComplete();
        }
    });
}

/**
 * Bounce a target up and back to its original Y position.
 *
 * @param {Phaser.GameObjects.GameObject} target
 * @param {number} bounceHeight - Pixels to rise (default 20)
 * @param {number} duration - Total duration in ms (default 500)
 * @param {function} onComplete
 * @returns {Phaser.Tweens.Tween}
 */
function tweenBounce(target, bounceHeight = 20, duration = 500, onComplete = null) {
    if (!target) return null;
    const oy = target.y;
    return PhaserScene.tweens.add({
        targets:  target,
        y:        oy - bounceHeight,
        duration: duration / 2,
        ease:     'Sine.easeOut',
        yoyo:     true,
        onComplete: () => {
            target.y = oy;
            if (onComplete) onComplete();
        }
    });
}

/**
 * Zoom camera to a value and tween back to 1x zoom (impact punch effect).
 *
 * @param {number} val - Zoom multiplier (default 1.015)
 * @param {function} onComplete
 * @returns {Phaser.Tweens.Tween}
 */
function zoomShake(val = 1.015, onComplete = null) {
    if (!PhaserScene || !PhaserScene.cameras.main) return null;
    const camera = PhaserScene.cameras.main;
    camera.setZoom(val);
    return PhaserScene.tweens.add({
        targets:  camera,
        zoom:     1,
        duration: 250,
        ease:     'Cubic.easeOut',
        onComplete: () => {
            camera.setZoom(1);
            if (onComplete) onComplete();
        }
    });
}
