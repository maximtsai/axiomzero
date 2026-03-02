/**
 * @fileoverview Draggable horizontal slider UI component.
 * Uses Button for the hit area and Phaser's native input for drag tracking.
 * @module slider
 *
 * Usage:
 *   const s = new Slider(x, y, width, height, 'knob.png', 'buttons', val => { ... }, 0.5);
 */
class Slider {
    constructor(x, y, width, height, sprite, atlas, onChange, initialValue = 0, depth = 10000) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.onChange = onChange;
        this.depth = depth;

        this.minX = x - width / 2;
        this.maxX = x + width / 2;

        this.hitArea = new Button({
            normal: { ref: 'black_pixel', atlas: 'buttons', x: x, y: y, alpha: 0.001, scaleX: width, scaleY: height },
            onMouseDown: (mx, my) => this._startDrag(mx),
            onMouseUp: (mx, my) => this._endDrag(),
        });
        this.hitArea.setScrollFactor(0);

        this.knob = PhaserScene.add.sprite(this.minX + initialValue * width, y, atlas, sprite);
        this.knob.setDepth(depth);
        this.knob.setScrollFactor(0);

        this.isDragging = false;

        // Bind once so we can cleanly add/remove Phaser input listeners
        this._boundMove = (pointer) => this._updateKnob(pointer.x);
        this._boundUp = () => this._endDrag();
    }

    _startDrag(mx) {
        this.isDragging = true;
        this._updateKnob(mx);
        PhaserScene.input.on('pointermove', this._boundMove);
        PhaserScene.input.on('pointerup', this._boundUp);
    }

    _updateKnob(mx) {
        const clampedX = Math.max(this.minX, Math.min(this.maxX, mx));
        this.knob.x = clampedX;
    }

    _endDrag() {
        if (!this.isDragging) return;
        this.isDragging = false;
        PhaserScene.input.off('pointermove', this._boundMove);
        PhaserScene.input.off('pointerup', this._boundUp);
        const value = (this.knob.x - this.minX) / this.width;
        if (this.onChange) this.onChange(value);
    }
}
