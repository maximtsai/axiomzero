/**
 * @fileoverview Sprite-based glitch visual effects.
 * No Phaser FX pipeline — uses only sprites and tweens per GDD §19.
 * Effects: scanline tear, UI flicker, geometry ghosting.
 * @module glitchFX
 *
 * Usage:
 *   glitchFX.init();
 *   glitchFX.triggerScanline();
 *   glitchFX.triggerFlicker([sprite1, sprite2], 300);
 *   glitchFX.autoTrigger(true);  // auto-fires when health < 30%
 */
const glitchFX = (() => {
    let intensity = 1;     // 0–1 global multiplier
    let autoEnabled = false;
    let scanlines = [];
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

        messageBus.subscribe('healthChanged', _onHealthChanged);
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
            line.setTint(Math.random() > 0.5 ? 0xff2d78 : 0x00f5ff);
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
            .setTint(0xff2d78)
            .setBlendMode(Phaser.BlendModes.ADD)
            .setScrollFactor(target.scrollFactorX, target.scrollFactorY);

        PhaserScene.time.delayedCall(duration, () => {
            ghost.destroy();
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

    /**
     * Enable/disable auto-triggering based on tower health.
     * When enabled, glitch effects fire when health drops below 30%.
     * @param {boolean} enabled
     */
    function autoTrigger(enabled) {
        autoEnabled = enabled;
    }

    function _onHealthChanged(current, max) {
        if (!autoEnabled || intensity <= 0) return;
        const ratio = current / max;
        if (ratio < 0.3 && Math.random() < 0.15) {
            triggerScanline(1 + Math.floor(Math.random() * 2), 60 + Math.random() * 60);
        }
    }

    return { init, triggerScanline, triggerFlicker, triggerGhost, setIntensity, autoTrigger };
})();
