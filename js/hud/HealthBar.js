// HealthBar.js
// Manages the visual health bar: background, fill, flare, and numeric text.
// Handles logarithmic scaling based on max health.

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
        this.y = config.y;
        this.baseW = config.width;
        this.h = config.height;
        this.depth = config.depth;

        this.lastHealth = -1;

        this._createElements();
    }

    _createElements() {
        // ── Background ──
        this.bg = PhaserScene.add.image(this.baseX, this.y, 'white_pixel');
        this.bg.setOrigin(0, 0).setDisplaySize(this.baseW, this.h).setTint(GAME_CONSTANTS.HEALTH_BAR_TINT).setDepth(this.depth).setScrollFactor(0);

        // ── Damage Flare ──
        this.flare = PhaserScene.add.image(this.baseX, this.y + this.h / 2, 'ui', 'white_vertical_line.png');
        this.flare.setOrigin(0.5, 0.5).setScale(1, 0.75).setTint(0xffffff).setDepth(this.depth + 1).setScrollFactor(0);
        this.flare.setAlpha(0);

        // ── Fill ──
        this.fill = PhaserScene.add.image(this.baseX, this.y, 'white_pixel');
        this.fill.setOrigin(0, 0).setDisplaySize(this.baseW, this.h).setTint(0x00ff66).setDepth(this.depth + 2).setScrollFactor(0);

        // ── Text ──
        this.text = PhaserScene.add.text(this.baseX + this.baseW + 8, this.y - 4, '', {
            fontFamily: 'JetBrainsMono_Regular',
            fontSize: helper.isMobileDevice() ? '30px' : '26px',
            color: GAME_CONSTANTS.COLOR_NEUTRAL,
        }).setOrigin(0, 0).setDepth(this.depth + 2).setScrollFactor(0);
    }

    /**
     * Updates the health bar visuals.
     * @param {number} current 
     * @param {number} max 
     */
    update(current, max) {
        // Logarithmic scaling: expands as max health increases
        const logBase = Math.log10(GAME_CONSTANTS.TOWER_BASE_HEALTH);
        const dynamicW = Math.max(this.baseW, this.baseW + 222.3 * (Math.log10(max) - logBase));

        const ratio = Math.max(0, current / max);

        this.bg.setDisplaySize(dynamicW, this.h);
        this.fill.setDisplaySize(dynamicW * ratio, this.h);

        // Reposition text to the right of the dynamic bar
        this.text.x = this.bg.x + dynamicW + 8;

        // Color shift: cyan → orange → red as health drops
        if (ratio > 0.5) {
            this.fill.setTint(0x00ff66);
        } else if (ratio > 0.25) {
            this.fill.setTint(GAME_CONSTANTS.COLOR_RESOURCE);
        } else {
            this.fill.setTint(GAME_CONSTANTS.COLOR_HOSTILE);
        }

        // Damage flare positioning
        this.flare.x = this.bg.x + dynamicW * ratio;

        // Play damage flare if health dropped significantly
        if (this.lastHealth !== -1 && (this.lastHealth - current) >= 0.5) {
            this.playFlareEffect();
        }

        this.lastHealth = current;
        this.text.setText(current.toFixed(1) + ' / ' + max.toFixed(0));
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
        this.flare.setAlpha(alpha);
        this.text.setAlpha(alpha);
    }

    addToGroup(group) {
        if (!group) return;
        group.add(this.bg);
        group.add(this.fill);
        group.add(this.flare);
        group.add(this.text);
    }

    destroy() {
        this.bg.destroy();
        this.fill.destroy();
        this.flare.destroy();
        this.text.destroy();
    }
}
