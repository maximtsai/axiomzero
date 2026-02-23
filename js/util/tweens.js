// tweens.js - Custom tweening utilities for complex animations

/**
 * Tween an image's tint from current color to target color
 * Uses RGB component interpolation for smooth color transitions
 *
 * @param {Phaser.GameObjects.Image} image - The image to tint
 * @param {number} endTint - Target tint color as hex (e.g., 0xFF0000 for red)
 * @param {number} duration - Duration in milliseconds
 * @param {string} ease - Easing function (default: 'Linear')
 * @param {function} onComplete - Optional callback when complete
 * @returns {Phaser.Tweens.Tween} The tween object
 */
function tweenTint(image, endTint, duration, ease = 'Linear', onComplete = null) {
    if (!image || !image.setTint) {
        console.warn('tweenTint: Invalid image provided');
        return null;
    }

    // Get current tint (default to white if no tint applied)
    const currentTint = image.tintTopLeft || 0xFFFFFF;

    // Extract RGB components from current tint
    const startR = (currentTint >> 16) & 0xFF;
    const startG = (currentTint >> 8) & 0xFF;
    const startB = currentTint & 0xFF;

    // Extract RGB components from target tint
    const endR = (endTint >> 16) & 0xFF;
    const endG = (endTint >> 8) & 0xFF;
    const endB = endTint & 0xFF;

    // Create a proxy object to tween
    const colorProxy = {
        r: startR,
        g: startG,
        b: startB
    };

    // Create the tween
    let tween = PhaserScene.tweens.add({
        targets: colorProxy,
        r: endR,
        g: endG,
        b: endB,
        duration: duration,
        ease: ease,
        onUpdate: () => {
            // Convert RGB back to hex and apply tint
            const newTint = (Math.round(colorProxy.r) << 16) |
                           (Math.round(colorProxy.g) << 8) |
                            Math.round(colorProxy.b);
            image.setTint(newTint);
        },
        onComplete: onComplete
    });

    return tween;
}
