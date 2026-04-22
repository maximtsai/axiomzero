/**
 * @fileoverview Draggable horizontal slider UI component.
 * Uses Button for the hit area and Phaser's native input for drag tracking.
 * @module slider
 *
 * Usage:
 *   const s = new Slider(x, y, width, height, 'knob.png', 'buttons', val => { ... }, 0.5);
 */
class Slider {
    constructor(x, y, width, height, sprite, atlas, onChange, initialValue = 0, depth = 10000, trackSprite = 'slider_glow.png') {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.onChange = onChange;
        this.depth = depth;
        this.baseFrame = sprite;
        this.atlas = atlas;

        this.minX = x - width / 2;
        this.maxX = x + width / 2;

        // Background guide line
        this.guide = PhaserScene.add.image(x, y, 'pixels', 'tan_pixel.png');
        this.guide.setDepth(depth);
        this.guide.setScrollFactor(0);
        this.guide.setDisplaySize(width, 4);

        // Progress fill (slider_glow.png)
        if (trackSprite) {
            this.track = PhaserScene.add.image(this.minX, y, atlas, trackSprite);
            this.track.setOrigin(0, 0.5);
            this.track.setDepth(depth + 1);
            this.track.setScrollFactor(0);
            this.track.height = 10;

            // Left edge cap (slider_glow_edge.png)
            this.edge = PhaserScene.add.image(this.minX, y, atlas, 'slider_glow_edge.png');
            this.edge.setOrigin(1, 0.5);
            this.edge.setDepth(depth + 1);
            this.edge.setScrollFactor(0);
            this.edge.height = 10;
        }

        this.hitArea = new Button({
            normal: {
                ref: 'black_pixel.png',
                atlas: 'pixels',
                x: x,
                y: y,
                alpha: 0.001,
                scaleX: width * 0.6,
                scaleY: height * 0.5,
                depth: depth // Fix: Assign depth so buttonManager sees it at the correct layer
            },
            onMouseDown: (mx, my) => {
                this._startDrag(mx);
                this._updateKnobTexture('press');
            },
            onMouseUp: (mx, my) => {
                this._endDrag();
                this._updateKnobTexture('hover');
            },
            onHover: () => {
                if (!this.isDragging) this._updateKnobTexture('hover');
            },
            onHoverOut: () => {
                if (!this.isDragging) this._updateKnobTexture('normal');
            }
        });
        this.hitArea.setScrollFactor(0);

        this.knob = PhaserScene.add.sprite(this.minX + initialValue * width, y, atlas, sprite);
        this.knob.setDepth(depth + 2);
        this.knob.setScrollFactor(0);

        this.isDragging = false;

        // Bind once so we can cleanly add/remove Phaser input listeners
        this._boundMove = (pointer) => this._updateKnob(pointer.x);
        this._boundUp = () => {
            this._endDrag();
            this._updateKnobTexture('normal');
        };

        // Initial update to set fill scale
        this._updateKnob(this.knob.x);
    }

    _updateKnobTexture(state) {
        if (!this.knob || !this.knob.active) return;

        // Ensure the atlas contains the normal, _hover, and _press.png
        // Our button naming is usually my_button.png -> my_button_hover.png
        let frame = this.baseFrame;
        if (state === 'hover') {
            frame = this.baseFrame.replace('.png', '_hover.png');
        } else if (state === 'press') {
            frame = this.baseFrame.replace('.png', '_press.png');
        }

        // Because a generic sprite might not have hover/press, we wrap this in a fast check or just setFrame
        // with fallback if we had access to the list. Phaser's setFrame logs a warning if missing, but it is fine.
        this.knob.setFrame(frame);
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

        const value = (this.knob.x - this.minX) / this.width;

        // Update fill width
        if (this.track) {
            const progressWidth = clampedX - this.minX;
            this.track.displayWidth = Math.max(1, progressWidth);

            if (this.edge) {
                this.edge.visible = (value > 0);
            }
        }

        if (this.onChange) this.onChange(value);
    }

    _endDrag() {
        if (!this.isDragging) return;
        this.isDragging = false;
        PhaserScene.input.off('pointermove', this._boundMove);
        PhaserScene.input.off('pointerup', this._boundUp);
    }

    destroy() {
        if (this.guide) this.guide.destroy();
        if (this.track) this.track.destroy();
        if (this.edge) this.edge.destroy();
        if (this.knob) this.knob.destroy();
        if (this.hitArea) this.hitArea.destroy();
    }
}
