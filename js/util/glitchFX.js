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
    let bgGrid = null;      // Background grid sprite
    let bgGridHigh = null;      // Background grid sprite
    let wave = null;        // Pooled central shockwave
    let blueLine = null;    // Pooled horizontal scan-sweep
    let scanFade1 = null;   // Pooled diagonal scan-line
    let scanFade2 = null;
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

        // Pre-create permanent background grid (for system scans etc)
        bgGrid = PhaserScene.add.image(GAME_CONSTANTS.halfWidth, GAME_CONSTANTS.halfHeight, 'backgrounds', 'black_grid.png');
        bgGrid.setDepth(-1);

        bgGridHigh = PhaserScene.add.image(GAME_CONSTANTS.halfWidth, GAME_CONSTANTS.halfHeight, 'backgrounds', 'black_grid.png');
        bgGridHigh.setDepth(GAME_CONSTANTS.DEPTH_TOWER - 1).setVisible(false);

        // Pre-allocate system scan assets (Pooling)
        wave = PhaserScene.add.image(0, 0, 'player', 'deathwave.png').setVisible(false).setBlendMode(Phaser.BlendModes.ADD);
        blueLine = PhaserScene.add.image(0, 0, 'white_pixel').setVisible(false).setDepth(-2).setBlendMode(Phaser.BlendModes.ADD).setOrigin(0.5, 0.5);
        scanFade1 = PhaserScene.add.image(0, 0, 'backgrounds', 'scan_line_fade.png').setVisible(false).setBlendMode(Phaser.BlendModes.MULTIPLY).setAngle(-45);
        scanFade2 = PhaserScene.add.image(0, 0, 'backgrounds', 'scan_line_fade.png').setVisible(false).setBlendMode(Phaser.BlendModes.ADD).setAngle(45);
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
    function triggerScanline(count = 2, duration = 50) {
        if (intensity <= 0) return;
        const usedCount = Math.min(count, scanlines.length);

        for (let i = 0; i < usedCount; i++) {
            const line = scanlines[i];
            const y = Math.random() * GAME_CONSTANTS.HEIGHT;
            const h = 2 + Math.random() * 4;
            let extraH = 0;
            if (Math.random() < 0.4) {
                extraH = 40 + Math.random() * 140;
            }
            const offsetX = (Math.random() - 0.5) * 20 * intensity;

            line.setPosition(offsetX, y);
            line.setDisplaySize(GAME_CONSTANTS.WIDTH + 40, h + extraH);
            line.setAlpha(0.25 * intensity);
            line.setTint(Math.random() > 0.5 ? _color1 : _color2);
            line.setVisible(true);

            if (extraH > 0) {
                PhaserScene.time.delayedCall(25, () => {
                    line.setDisplaySize(GAME_CONSTANTS.WIDTH + 40, h);
                });
            }

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
            delay: 30,
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

    /**
     * Vertical "scan" lines that sweep the whole screen top-to-bottom.
     * Dual layered: thin baseline and broad faint blue glow.
     * @param {number} [duration=1300] - Speed of the sweep.
     */
    function triggerSystemScan(duration = 1300) {
        if (intensity <= 0 || !bgGrid || !wave) return;

        // Reset and show permanent grid
        bgGrid.setVisible(true).setScale(1);
        bgGridHigh.setVisible(true).setScale(1).setAlpha(1.2);

        // 1. Central Deathwave Pulse
        wave.setPosition(GAME_CONSTANTS.halfWidth, GAME_CONSTANTS.halfHeight)
            .setVisible(true).setDepth(-2).setAlpha(0).setScale(0.1);

        // Wave Tweens
        PhaserScene.tweens.add({
            delay: 250,
            targets: wave,
            scale: 2.5,
            duration: duration,
            ease: 'Cubic.easeOut'
        });

        PhaserScene.tweens.add({
            delay: 200,
            targets: wave,
            alpha: 0.12,
            duration: 250,
            ease: 'Quad.easeOut',
            onComplete: () => {
                PhaserScene.tweens.add({
                    targets: wave,
                    alpha: 0,
                    duration: duration - 250,
                    ease: 'Linear',
                    onComplete: () => wave.setVisible(false)
                });
            }
        });

        // 2. Clear blueLine from scan (it's now for announcements)
        blueLine.setVisible(false);

        // 3. Scan Line Fades (from backgrounds atlas)
        scanFade1.setPosition(GAME_CONSTANTS.halfWidth, -100)
            .setVisible(true).setDepth(-2).setAlpha(0).setScale(1000, 1.9);

        scanFade2.setPosition(GAME_CONSTANTS.halfWidth, -100)
            .setVisible(true).setDepth(-2).setAlpha(0).setScale(1000, 1.9);

        const fxState = { alpha: 0, y: -100 };

        // 0b. Grid scaling (covers entrance + sweep + exit durations)
        const totalDuration = 250 + duration + 500;
        PhaserScene.tweens.add({
            targets: [bgGrid, bgGridHigh],
            scale: 1.06,
            duration: totalDuration * 0.48,
            yoyo: true,
            ease: 'Sine.easeInOut'
        });
        // Entrance flicker for all
        PhaserScene.tweens.add({
            targets: fxState,
            alpha: 1,
            duration: 250,
            ease: 'Cubic.easeOut',
            onUpdate: () => {
                scanFade1.setAlpha(0.5 * fxState.alpha);
                scanFade2.setAlpha(0.1 * fxState.alpha);
            },
            onComplete: () => {
                PhaserScene.tweens.add({
                    delay: 400,
                    targets: [bgGridHigh],
                    alpha: 0,
                    ease: 'Cubic.easeInOut',
                    duration: totalDuration - 300,
                });
                // Sweep all in sync
                PhaserScene.tweens.add({
                    targets: fxState,
                    y: GAME_CONSTANTS.HEIGHT + 400,
                    duration: duration,
                    ease: 'Quad.easeInOut',
                    onUpdate: () => {
                        const H = GAME_CONSTANTS.HEIGHT;
                        const progress = (fxState.y + 100) / (H + 500);
                        const drift = progress * 60 - 30; // 60px sym-drift

                        // Scan fades start 200 higher (-300) and end 300 lower (H + 700)
                        const fadeY = -300 + (progress * (H + 1000));
                        scanFade1.y = fadeY;
                        scanFade1.x = GAME_CONSTANTS.halfWidth + drift;
                        scanFade2.y = fadeY;
                        scanFade2.x = GAME_CONSTANTS.halfWidth - drift;
                    },
                    onComplete: () => {
                        // Exit fade
                        PhaserScene.tweens.add({
                            targets: fxState,
                            alpha: 0,
                            duration: 500,
                            onUpdate: () => {
                                scanFade1.setAlpha(0.5 * fxState.alpha);
                                scanFade2.setAlpha(0.1 * fxState.alpha);
                            },
                            onComplete: () => {
                                scanFade1.setVisible(false);
                                scanFade2.setVisible(false);
                                bgGridHigh.setVisible(false);
                            }
                        });
                    }
                });
            }
        });
    }

    /**
     * Shows a jittering blue glow at a specific position (used for announcements).
     * @param {number} x
     * @param {number} y
     * @param {number} [duration=1200]
     * @param {number} [overrideHeight=80]
     */
    function triggerAnnounceGlow(x, y, duration = 1200, overrideHeight = 80) {
        if (intensity <= 0 || !blueLine) return;

        const finalHeight = overrideHeight;
        const startHeight = finalHeight * 0.25;
        const halfDur = duration / 2;
        const state = { h: startHeight, alphaMult: 0.16 };

        blueLine.setPosition(x, y)
            .setVisible(true)
            .setDepth(GAME_CONSTANTS.DEPTH_HUD + 11)
            .setAlpha(0.04)
            .setDisplaySize(GAME_CONSTANTS.WIDTH, startHeight)
            .setTint(0x00f5ff)
            .setBlendMode(Phaser.BlendModes.ADD);

        // expansion + fade in tween
        PhaserScene.tweens.add({
            targets: state,
            h: finalHeight,
            alphaMult: 1,
            duration: halfDur,
            ease: 'Quart.easeOut', // Keep height ease but alpha is linear enough
            onComplete: () => {
                // shrink and fade tween
                PhaserScene.tweens.add({
                    targets: state,
                    h: 0,
                    alphaMult: 0,
                    duration: halfDur,
                    ease: 'Quad.easeOut'
                });
            }
        });

        // Shaking + Jittering logic
        const shakeTimer = PhaserScene.time.addEvent({
            delay: 20,
            repeat: Math.floor(duration / 20),
            callback: () => {
                const jitter = (0.75 + Math.random() * 0.5) * intensity;
                blueLine.x = x + (Math.random() - 0.5) * 20 * intensity;
                blueLine.y = y + (Math.random() - 0.5) * 8 * intensity;
                blueLine.displayHeight = state.h * jitter;
                blueLine.setAlpha((0.10 + 0.15 * Math.random()) * state.alphaMult);
            }
        });

        PhaserScene.time.delayedCall(duration, () => {
            shakeTimer.remove();
            blueLine.setVisible(false);
        });
    }

    /**
     * Momentarily shows the background grid for a death event.
     * @param {number} [duration=1000]
     */
    function triggerDeathGrid(duration = 1000) {
        if (!bgGrid) return;
        bgGrid.setVisible(true).setScale(1);
        PhaserScene.time.delayedCall(duration, () => {
            bgGrid.setVisible(false);
        });
    }

    return { init, setColors, setIntensity, triggerScanline, triggerFlicker, triggerGhost, triggerChromaticAberration, triggerSystemScan, triggerAnnounceGlow, triggerDeathGrid };
})();
