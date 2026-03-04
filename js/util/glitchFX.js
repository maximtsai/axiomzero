/**
 * @fileoverview Sprite-based glitch visual effects.
 * No Phaser FX pipeline — uses only sprites and tweens.
 * Effects: scanline tear, UI flicker, geometry ghosting.
 * @module glitchFX
 *
 * Usage:
 *   glitchFX.init();
 *   glitchFX.setColors(0xff2d78, 0x00f5ff);  // optional — set scanline/ghost tints
 *   glitchFX.triggerScanline();
 *   glitchFX.triggerFlicker([sprite1, sprite2], 300);
 *   glitchFX.triggerGhost(sprite);
 */
const glitchFX = (() => {
    let intensity = 1;     // 0–1 global multiplier
    let scanlines = [];
    let _color1 = 0xffffff;  // primary scanline tint
    let _color2 = 0xaaaaaa;  // secondary scanline tint
    let _ghostTint = 0xffffff;  // ghost overlay tint
    const SCANLINE_DEPTH = 150000;  // above everything

    function init() {
        // Pre-create a small pool of scanline sprites (reused)
        for (let i = 0; i < 4; i++) {
            const line = PhaserScene.add.image(0, 0, 'white_pixel');
            line.setOrigin(0, 0)
                .setDepth(SCANLINE_DEPTH)
                .setScrollFactor(0)
                .setVisible(false)
                .setBlendMode(Phaser.BlendModes.ADD);
            scanlines.push(line);
        }
    }

    /**
     * Set the tint colors used by scanline and ghost effects.
     * Call this after init() to customize the look for your game.
     * @param {number} color1 - Primary scanline tint (hex color).
     * @param {number} color2 - Secondary scanline tint (hex color).
     * @param {number} [ghostTint] - Ghost overlay tint. Defaults to color1.
     */
    function setColors(color1, color2, ghostTint) {
        _color1 = color1;
        _color2 = color2;
        _ghostTint = ghostTint !== undefined ? ghostTint : color1;
    }

    // ── Scanline tear ────────────────────────────────────────────────────

    /**
     * Brief horizontal scanline displacement across the screen.
     * @param {number} [count=2] - Number of scanline strips.
     * @param {number} [duration=80] - Duration in ms.
     */
    function triggerScanline(count = 2, duration = 80) {
        if (intensity <= 0) return;
        const usedCount = Math.min(count, scanlines.length);

        for (let i = 0; i < usedCount; i++) {
            const line = scanlines[i];
            const y = Math.random() * GAME_CONSTANTS.HEIGHT;
            const h = 2 + Math.random() * 4;
            const offsetX = (Math.random() - 0.5) * 20 * intensity;

            line.setPosition(offsetX, y);
            line.setDisplaySize(GAME_CONSTANTS.WIDTH + 40, h);
            line.setAlpha(0.3 * intensity);
            line.setTint(Math.random() > 0.5 ? _color1 : _color2);
            line.setVisible(true);

            PhaserScene.time.delayedCall(duration, () => {
                line.setVisible(false);
            });
        }
    }

    // ── UI flicker ───────────────────────────────────────────────────────

    /**
     * Briefly offset targets by 2–4px, then snap back.
     * @param {Phaser.GameObjects.GameObject[]} targets - Sprites/texts to flicker.
     * @param {number} [duration=200] - Total flicker duration in ms.
     */
    function triggerFlicker(targets, duration = 200) {
        if (intensity <= 0 || !targets || targets.length === 0) return;

        const offsets = [];
        for (let i = 0; i < targets.length; i++) {
            const t = targets[i];
            if (!t || !t.active) continue;
            const ox = t.x;
            const oy = t.y;
            offsets.push({ target: t, ox, oy });

            // Random offset
            const dx = (2 + Math.random() * 2) * (Math.random() > 0.5 ? 1 : -1) * intensity;
            const dy = (1 + Math.random() * 2) * (Math.random() > 0.5 ? 1 : -1) * intensity;
            t.x += dx;
            t.y += dy;
        }

        PhaserScene.time.delayedCall(duration, () => {
            for (let i = 0; i < offsets.length; i++) {
                const o = offsets[i];
                if (o.target && o.target.active) {
                    o.target.x = o.ox;
                    o.target.y = o.oy;
                }
            }
        });
    }

    // ── Geometry ghost ───────────────────────────────────────────────────

    /**
     * Briefly duplicate a sprite at a slight offset with reduced alpha.
     * @param {Phaser.GameObjects.Sprite} target - Sprite to ghost.
     * @param {number} [duration=150] - Ghost visibility duration ms.
     */
    function triggerGhost(target, duration = 150) {
        if (intensity <= 0 || !target || !target.active) return;

        const dx = (3 + Math.random() * 5) * (Math.random() > 0.5 ? 1 : -1) * intensity;
        const dy = (2 + Math.random() * 4) * (Math.random() > 0.5 ? 1 : -1) * intensity;

        const ghost = PhaserScene.add.image(target.x + dx, target.y + dy, target.texture.key);
        if (target.frame && target.frame.name) {
            ghost.setFrame(target.frame.name);
        }
        ghost.setOrigin(target.originX, target.originY)
            .setScale(target.scaleX, target.scaleY)
            .setRotation(target.rotation)
            .setAlpha(0.35 * intensity)
            .setDepth(target.depth - 1)
            .setTint(_ghostTint)
            .setBlendMode(Phaser.BlendModes.ADD)
            .setScrollFactor(target.scrollFactorX, target.scrollFactorY);

        PhaserScene.time.delayedCall(duration, () => {
            ghost.destroy();
        });
    }

    // ── Chromatic Aberration ─────────────────────────────────────────────

    /**
     * Briefly duplicate target with red/cyan tints and a jittering offset.
     * @param {Phaser.GameObjects.GameObject} target - Sprite or Text object.
     * @param {number} [duration=400] - Total effect duration in ms.
     */
    function triggerChromaticAberration(target, duration = 400, effectIntensity = 1) {
        if (intensity <= 0 || !target || !target.active) return;

        const combinedIntensity = intensity * effectIntensity;

        let redCopy, cyanCopy;
        if (target.type === 'Text') {
            redCopy = PhaserScene.add.text(target.x - 3, target.y + 2, target.text, target.style);
            cyanCopy = PhaserScene.add.text(target.x + 3, target.y + 2, target.text, target.style);
            redCopy.setOrigin(target.originX, target.originY);
            cyanCopy.setOrigin(target.originX, target.originY);

            // Keep text in sync if the original is still typewriting
            const syncTimer = PhaserScene.time.addEvent({
                delay: 16, loop: true,
                callback: () => {
                    if (target.active && redCopy.active && cyanCopy.active) {
                        redCopy.setText(target.text);
                        cyanCopy.setText(target.text);
                    }
                }
            });
            PhaserScene.time.delayedCall(duration, () => syncTimer.remove());
        } else {
            redCopy = PhaserScene.add.image(target.x - 2, target.y + 1, target.texture.key, target.frame.name);
            cyanCopy = PhaserScene.add.image(target.x + 2, target.y + 1, target.texture.key, target.frame.name);
            redCopy.setOrigin(target.originX, target.originY).setScale(target.scaleX, target.scaleY).setRotation(target.rotation);
            cyanCopy.setOrigin(target.originX, target.originY).setScale(target.scaleX, target.scaleY).setRotation(target.rotation);
        }

        const alphaMult = 0.8 * combinedIntensity;
        redCopy.setDepth(target.depth - 1).setAlpha(target.alpha * alphaMult).setTint(0xff0000).setBlendMode(Phaser.BlendModes.ADD);
        cyanCopy.setDepth(target.depth - 1).setAlpha(target.alpha * alphaMult).setTint(0x00ffff).setBlendMode(Phaser.BlendModes.ADD);

        const shakeTimer = PhaserScene.time.addEvent({
            delay: 40,
            repeat: Math.floor(duration / 40) - 1,
            callback: () => {
                if (!target.active) return;
                const rx = (Math.random() - 0.5) * 9 * combinedIntensity;
                const ry = (Math.random() - 0.5) * 6 * combinedIntensity;
                redCopy.setPosition(target.x - 2 + rx, target.y + 1 + ry);
                cyanCopy.setPosition(target.x + 2 - rx, target.y + 1 - ry);
            }
        });

        PhaserScene.time.delayedCall(duration, () => {
            if (redCopy.active) redCopy.destroy();
            if (cyanCopy.active) cyanCopy.destroy();
        });
    }

    // ── Intensity control ────────────────────────────────────────────────

    /**
     * Set global effect intensity multiplier.
     * @param {number} level - 0 (off) to 1 (full).
     */
    function setIntensity(level) {
        intensity = Math.max(0, Math.min(1, level));
    }

    return { init, setColors, setIntensity, triggerScanline, triggerFlicker, triggerGhost, triggerChromaticAberration };
})();
