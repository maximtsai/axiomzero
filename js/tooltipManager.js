/**
 * @fileoverview Hover tooltip system. Shows a floating info panel near a target position.
 * Re-uses a single set of Phaser GameObjects for all tooltips.
 * @module tooltipManager
 *
 * Usage:
 *   tooltipManager.init();
 *   tooltipManager.show(x, y, [
 *     { text: 'Damage', style: 'bold' },
 *     { text: '25 → 30' },
 *   ]);
 *   tooltipManager.hide();
 */
const tooltipManager = (() => {
    const PADDING = 12;
    const LINE_GAP = 4;
    const MAX_WIDTH = 330;
    const DEPTH = 120000;  // above popups

    let bg = null;
    let outline = null;
    let textObjects = [];
    let visible = false;

    // Font presets
    const bodySize = helper.isMobileDevice() ? '30px' : '26px';
    const titleSize = helper.isMobileDevice() ? '32px' : '28px';

    const FONTS = {
        normal: { fontFamily: 'VCR', fontSize: bodySize, color: '#cccccc' },
        bold: { fontFamily: 'VCR', fontSize: bodySize, color: '#ffffff' },
        title: { fontFamily: 'VCR', fontSize: titleSize, color: '#00f5ff' },
        warn: { fontFamily: 'VCR', fontSize: bodySize, color: '#ff4444' },
        ok: { fontFamily: 'VCR', fontSize: bodySize, color: '#00ff88' },
    };

    function init() {
        // Background panel
        bg = PhaserScene.add.image(0, 0, 'white_pixel');
        bg.setOrigin(0, 0)
            .setTint(0x111122)
            .setAlpha(0)
            .setDepth(DEPTH)
            .setScrollFactor(0);

        outline = PhaserScene.add.nineslice(0, 0, 'ui', 'white_outline.png', 10, 10, 8, 8, 8, 8);
        outline.setOrigin(0, 0)
            .setAlpha(0)
            .setDepth(DEPTH + 0.5)
            .setScrollFactor(0);
    }

    /**
     * Show tooltip near the given screen position.
     * @param {number} x - Screen X
     * @param {number} y - Screen Y (tooltip appears above this point by default)
     * @param {{ text: string, style?: string }[]} lines - Lines to display.
     * @param {number} [customWidth] - Optional override width.
     */
    function show(x, y, lines, customWidth) {
        hide(); // clear previous

        if (!lines || lines.length === 0) return;

        const useWidth = customWidth || MAX_WIDTH;
        let currentY = 0;
        let maxW = 0;

        // Create text objects
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const font = FONTS[line.style] || FONTS.normal;
            const t = PhaserScene.add.rexBBCodeText(0, currentY, line.text, {
                ...font,
                wrap: { mode: 'word', width: useWidth - PADDING * 2 },
            })
                .setOrigin(0, 0)
                .setDepth(DEPTH + 1)
                .setScrollFactor(0);

            if (line.color) t.setColor(line.color);

            textObjects.push(t);
            currentY += t.height + LINE_GAP;
            if (t.width > maxW) maxW = t.width;
        }

        // Size background
        const bgW = maxW + PADDING * 2;
        const bgH = currentY - LINE_GAP + PADDING * 2;

        // Position: try above the target, flip below if off-screen
        let posX = x - bgW / 2;
        let posY = y;

        // Clamp to screen bounds
        if (posX < 4) posX = 4;
        if (posX + bgW > GAME_CONSTANTS.WIDTH - 4) posX = GAME_CONSTANTS.WIDTH - 4 - bgW;
        if (posY < 4) posY = y + 8; // flip below

        bg.setPosition(posX, posY);
        bg.setDisplaySize(bgW, bgH);
        bg.setAlpha(0.92);

        outline.setPosition(posX - 6, posY - 6);
        outline.setSize(bgW + 12, bgH + 12);
        outline.setAlpha(0.4);

        // Position text lines inside the panel
        for (let i = 0; i < textObjects.length; i++) {
            textObjects[i].setPosition(
                posX + PADDING,
                posY + PADDING + textObjects[i].y  // y was pre-computed as offset
            );
        }

        visible = true;
    }

    /** Hide and destroy all tooltip elements. */
    function hide() {
        if (!visible && textObjects.length === 0) return;
        for (let i = 0; i < textObjects.length; i++) {
            textObjects[i].destroy();
        }
        textObjects.length = 0;
        if (bg) bg.setAlpha(0);
        if (outline) outline.setAlpha(0);
        visible = false;
    }

    /** @returns {boolean} Whether the tooltip is currently visible. */
    function isVisible() {
        return visible;
    }

    return { init, show, hide, isVisible };
})();
