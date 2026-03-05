/**
 * @fileoverview Generic ProgressBar component for Phaser 3.
 * Supports background container, fill bar, and optional text label.
 */

class ProgressBar {
    /**
     * @param {Phaser.Scene} scene - The Phaser Scene.
     * @param {Object} config - Configuration object.
     * @param {number} config.x - X position (center).
     * @param {number} config.y - Y position (center).
     * @param {number} config.width - Total width.
     * @param {number} config.height - Total height.
     * @param {number} [config.padding=2] - Padding between container and fill.
     * @param {number} [config.bgColor=0x333333] - Background color.
     * @param {number} [config.fillColor=0x00f5ff] - Fill color.
     * @param {number} [config.depth=1000] - Rendering depth.
     */
    constructor(scene, config) {
        this.scene = scene;
        this.x = config.x;
        this.y = config.y;
        this.width = config.width;
        this.height = config.height;
        this.padding = config.padding !== undefined ? config.padding : 2;
        this.bgColor = config.bgColor || 0x333333;
        this.fillColor = config.fillColor || 0x00f5ff;
        this.depth = config.depth || 1000;

        this.value = 0; // 0 to 1

        this._create();
    }

    _create() {
        // Container (the "tray")
        this.bg = this.scene.add.image(this.x, this.y, 'white_pixel');
        this.bg.setDisplaySize(this.width, this.height);
        this.bg.setTint(this.bgColor);
        this.bg.setDepth(this.depth);
        this.bg.setScrollFactor(0);

        // The Fill bar
        // We use origin (0, 0.5) to scale from the left
        const fillWidth = this.width - (this.padding * 2);
        const fillHeight = this.height - (this.padding * 2);

        this.fill = this.scene.add.image(this.x - this.width / 2 + this.padding, this.y, 'white_pixel');
        this.fill.setOrigin(0, 0.5);
        this.fill.setDisplaySize(0, fillHeight); // Start at scale 0
        this.fill.setTint(this.fillColor);
        this.fill.setDepth(this.depth + 1);
        this.fill.setScrollFactor(0);

        this.fullWidth = fillWidth;
    }

    /**
     * Set the progress value.
     * @param {number} val - Value between 0 and 1.
     */
    setProgress(val) {
        this.value = Math.max(0, Math.min(1, val));
        this.fill.setDisplaySize(this.fullWidth * this.value, this.fill.displayHeight);
    }

    /**
     * Set the fill color.
     * @param {number} color - Hex color code.
     */
    setFillColor(color) {
        this.fillColor = color;
        this.fill.setTint(color);
    }

    /**
     * Set the visibility of the whole component.
     * @param {boolean} visible 
     */
    setVisible(visible) {
        this.bg.setVisible(visible);
        this.fill.setVisible(visible);
    }

    /**
     * Set the alpha of the whole component.
     * @param {number} alpha - Value between 0 and 1.
     */
    setAlpha(alpha) {
        this.bg.setAlpha(alpha);
        this.fill.setAlpha(alpha);
    }

    /**
     * Clean up game objects.
     */
    destroy() {
        if (this.bg) this.bg.destroy();
        if (this.fill) this.fill.destroy();
    }
}
