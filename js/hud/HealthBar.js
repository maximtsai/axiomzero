// HealthBar.js
// Manages the visual health bar: background, fill, flare, and numeric text.
// Handles logarithmic scaling based on max health.

const HEALTH_BAR_GAP = 14;

class HealthBar {
    /**
     * @param {Object} config
     * @param {number} config.x
     * @param {number} config.y
     * @param {number} config.width
     * @param {number} config.height
     * @param {number} config.depth
     */
    constructor(config) {
        this.baseX = config.x;
        this.baseY = config.y;
        this.baseW = config.width + 18;
        this.h = config.height + 17;
        this.depth = config.depth;

        this.lastHealth = -1;

        this.offsetX = 0;
        this.offsetY = 0;

        this._createElements();

        messageBus.subscribe('settingChanged_bigFont', () => this.refreshFontSize());
    }

    get x() { return this.baseX + this.offsetX; }
    set x(val) { this.setOffset(val - this.baseX, this.offsetY); }

    get y() { return this.baseY + this.offsetY; }
    set y(val) { this.setOffset(this.offsetX, val - this.baseY); }

    _createElements() {
        // ── Background ──
        this.bg = helper.createNineSlice(this.baseX - 11, this.y - 9, 'buttons', 'health_nineslice.png', this.baseW, this.h, 12, 12, 12, 12);
        this.bg.setOrigin(0, 0).setDepth(this.depth).setScrollFactor(0);

        // ── Damage Flare ──
        this.flare = PhaserScene.add.image(this.baseX - 11, this.y + this.h / 2 - 9, 'buttons', 'white_vertical_line.png');
        this.flare.setOrigin(0.5, 0.5).setScale(1, 0.75).setDepth(this.depth + 1).setScrollFactor(0);
        this.flare.setAlpha(0);

        // ── Fill ──
        this.fill = PhaserScene.add.image(this.baseX + HEALTH_BAR_GAP - 11, this.y + HEALTH_BAR_GAP - 9, 'buttons', 'green_pixel.png');
        this.fill.setOrigin(0, 0).setDisplaySize(this.baseW - HEALTH_BAR_GAP * 2, this.h - HEALTH_BAR_GAP * 2).setDepth(this.depth + 2).setScrollFactor(0);

        // ── Text ──
        const baseFontSize = helper.isMobileDevice() ? 33 : 26;
        const finalFontSize = baseFontSize + (gameState.settings.bigFont ? 3 : 0);
        this.text = PhaserScene.add.text(this.baseX + this.baseW - 6, this.y + 11, '', {
            fontFamily: 'Rajdhani-Medium',
            fontSize: finalFontSize + 'px', 
            color: GAME_CONSTANTS.COLOR_NEUTRAL,
        }).setOrigin(0, 0.5).setDepth(this.depth + 2).setScrollFactor(0);
    }

    /**
     * Updates the health bar visuals.
     * @param {number} current 
     * @param {number} max 
     */
    update(current, max) {
        // Logarithmic scaling: expands as max health increases
        const logBase = Math.log10(GAME_CONSTANTS.TOWER_BASE_HEALTH);
        const dynamicW = Math.max(this.baseW, this.baseW + GAME_CONSTANTS.HEALTH_BAR_SCALING_FACTOR * (Math.log10(max) - logBase));

        const ratio = Math.max(0, current / max);

        if (this.bg.width !== dynamicW) {
            this.bg.width = dynamicW;
        }
        this.fill.setDisplaySize((dynamicW - HEALTH_BAR_GAP * 2) * ratio, this.h - HEALTH_BAR_GAP * 2);

        // Reposition text to the right of the dynamic bar (compensated for background shift)
        this.text.x = this.bg.x + dynamicW + 4;

        // Color shift: change frames (green -> orange -> red) as health drops
        // NOTE: setFrame resets origin to 0.5, so we re-apply setOrigin(0,0)
        if (ratio > 0.5) {
            this.fill.setFrame('green_pixel.png').setOrigin(0, 0);
            helper.clearTint(this.fill);
        } else if (ratio > 0.25) {
            this.fill.setFrame('orange_pixel.png').setOrigin(0, 0);
            helper.clearTint(this.fill);
        } else {
            this.fill.setFrame('hostile_pixel.png').setOrigin(0, 0);
            helper.clearTint(this.fill);
        }

        // Damage flare positioning
        this.flare.x = this.bg.x + HEALTH_BAR_GAP + (dynamicW - HEALTH_BAR_GAP * 2) * ratio;

        // Play damage flare if health dropped significantly
        if (this.lastHealth !== -1 && (this.lastHealth - current) >= 0.5) {
            this.playFlareEffect();
        }

        this.lastHealth = current;

        this.text.setText(current.toFixed(1) + ' / ' + max.toFixed(0));
    }

    refreshFontSize() {
        if (!this.text) return;
        const baseFontSize = helper.isMobileDevice() ? 33 : 26;
        const targetSize = (baseFontSize + (gameState.settings.bigFont ? 3 : 0)) + 'px';
        if (this.text.style.fontSize !== targetSize) {
            this.text.setFontSize(targetSize);
        }
    }

    playFlareEffect() {
        this.flare.setAlpha(1);
        this.flare.scaleY = 2;
        PhaserScene.tweens.killTweensOf(this.flare);
        PhaserScene.tweens.add({
            targets: this.flare,
            scaleY: 0.85,
            ease: 'Quad.easeOut',
            duration: 500,
        });
        PhaserScene.tweens.add({
            targets: this.flare,
            alpha: 0,
            duration: 500,
        });
    }

    setVisible(vis) {
        this.bg.setVisible(vis);
        this.fill.setVisible(vis);
        this.flare.setVisible(vis);
        this.text.setVisible(vis);
    }

    setAlpha(alpha) {
        this.bg.setAlpha(alpha);
        this.fill.setAlpha(alpha);
        this.text.setAlpha(alpha);
    }

    setOffset(ox, oy) {
        this.offsetX = ox || 0;
        this.offsetY = oy || 0;
        const x = this.baseX + this.offsetX;
        const y = this.baseY + this.offsetY;

        this.bg.setPosition(x - 11, y - 9);
        this.flare.setPosition(x - 11, y + this.h / 2 - 9);
        this.fill.setPosition(x + HEALTH_BAR_GAP - 11, y + HEALTH_BAR_GAP - 9);
        // text.x/y is updated in update() too, but we set it here for immediate feedback
        this.text.setPosition(this.bg.x + this.bg.width + 4, y + 11);

        // If we are in a virtual group, we MUST update its offsets immediately
        // so that the next _syncChildren doesn't snap us back.
        if (typeof upgradeTree !== 'undefined' && upgradeTree.getGroup) {
            const treeGroup = upgradeTree.getGroup();
            if (treeGroup && treeGroup.recalculateOffsets) treeGroup.recalculateOffsets();
        }
    }

    addToGroup(group) {
        if (!group) return;
        group.add(this.bg);
        group.add(this.fill);
        group.add(this.flare);
        group.add(this.text);
    }

    assignToUICamera() {
        if (typeof upgradeTree === 'undefined' || !upgradeTree.assignToUICamera) return;
        upgradeTree.assignToUICamera(this.bg);
        upgradeTree.assignToUICamera(this.fill);
        upgradeTree.assignToUICamera(this.flare);
        upgradeTree.assignToUICamera(this.text);
    }

    destroy() {
        this.bg.destroy();
        this.fill.destroy();
        this.flare.destroy();
        this.text.destroy();
    }
}
