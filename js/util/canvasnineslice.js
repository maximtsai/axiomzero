class CanvasNineSlice extends Phaser.GameObjects.Container {
    constructor(scene, x, y, texture, frame, width, height, left, right, top, bottom) {
        super(scene, x, y);

        this.textureKey = texture;
        this.frameKey = frame;
        this.leftWidth = left;
        this.rightWidth = right;
        this.topHeight = top;
        this.bottomHeight = bottom;

        this._width = width;
        this._height = height;
        this._originX = 0.5;
        this._originY = 0.5;

        // Get frame info
        const frameObj = scene.textures.getFrame(texture, frame);
        const fw = frameObj.width;
        const fh = frameObj.height;
        this.fw = fw;
        this.fh = fh;

        this.slices = [];
        // Create 9 images
        for (let i = 0; i < 9; i++) {
            const img = scene.add.image(0, 0, texture, frame);
            this.add(img);
            this.slices.push(img);
        }

        // Apply crops
        this.slices[0].setCrop(0, 0, left, top);
        this.slices[1].setCrop(left, 0, fw - left - right, top);
        this.slices[2].setCrop(fw - right, 0, right, top);

        this.slices[3].setCrop(0, top, left, fh - top - bottom);
        this.slices[4].setCrop(left, top, fw - left - right, fh - top - bottom);
        this.slices[5].setCrop(fw - right, top, right, fh - top - bottom);

        this.slices[6].setCrop(0, fh - bottom, left, bottom);
        this.slices[7].setCrop(left, fh - bottom, fw - left - right, bottom);
        this.slices[8].setCrop(fw - right, fh - bottom, right, bottom);

        this.updateSlices();

        scene.add.existing(this);
    }

    get width() { return this._width; }
    set width(value) {
        this._width = value;
        this.updateSlices();
    }

    get height() { return this._height; }
    set height(value) {
        this._height = value;
        this.updateSlices();
    }

    setSize(width, height) {
        this._width = width;
        this._height = height;
        this.updateSlices();
        return this;
    }

    setOrigin(x, y = x) {
        this._originX = x;
        this._originY = y;
        this.updateSlices();
        return this;
    }

    setTint(color) {
        // No-op for canvas fallback
        return this;
    }

    setTintFill(color) {
        // No-op for canvas fallback
        return this;
    }

    clearTint() {
        // No-op for canvas fallback
        return this;
    }

    setBlendMode(mode) {
        // No-op for canvas fallback
        return this;
    }

    updateSlices() {
        const W = this._width;
        const H = this._height;
        const LW = this.leftWidth;
        const RW = this.rightWidth;
        const TH = this.topHeight;
        const BH = this.bottomHeight;
        const fw = this.fw;
        const fh = this.fh;

        const left = -W * this._originX;
        const top = -H * this._originY;

        // Compute exact cell boundaries (no independent rounding per-slice).
        const x0 = left;
        const x1 = left + LW;
        const x2 = left + W - RW;
        const x3 = left + W;

        const y0 = top;
        const y1 = top + TH;
        const y2 = top + H - BH;
        const y3 = top + H;

        // Source crop regions for each cell: [cx, cy, cw, ch]
        const src = [
            [0, 0, LW, TH],  // 0 TL
            [LW, 0, fw - LW - RW, TH],  // 1 TC
            [fw - RW, 0, RW, TH],  // 2 TR
            [0, TH, LW, fh - TH - BH],  // 3 ML
            [LW, TH, fw - LW - RW, fh - TH - BH],  // 4 MC
            [fw - RW, TH, RW, fh - TH - BH],  // 5 MR
            [0, fh - BH, LW, BH],  // 6 BL
            [LW, fh - BH, fw - LW - RW, BH],  // 7 BC
            [fw - RW, fh - BH, RW, BH],  // 8 BR
        ];

        // Destination bounding boxes for each cell: [dstX0, dstY0, dstW, dstH]
        const dst = [
            [x0, y0, x1 - x0, y1 - y0],  // TL
            [x1, y0, x2 - x1, y1 - y0],  // TC
            [x2, y0, x3 - x2, y1 - y0],  // TR
            [x0, y1, x1 - x0, y2 - y1],  // ML
            [x1, y1, x2 - x1, y2 - y1],  // MC
            [x2, y1, x3 - x2, y2 - y1],  // MR
            [x0, y2, x1 - x0, y3 - y2],  // BL
            [x1, y2, x2 - x1, y3 - y2],  // BC
            [x2, y2, x3 - x2, y3 - y2],  // BR
        ];

        for (let i = 0; i < 9; i++) {
            const slice = this.slices[i];
            const [cx, cy, cw, ch] = src[i];
            const [dx, dy, dw, dh] = dst[i];

            // Scale so the crop region fills the destination cell exactly.
            const scaleX = dw / cw;
            const scaleY = dh / ch;
            slice.setScale(scaleX, scaleY);

            // Position: the slice's origin (0.5, 0.5) refers to the full
            // frame center. Adjust so the crop's center lands at the cell center.
            const cropCenterX = cx + cw / 2;
            const cropCenterY = cy + ch / 2;
            const offsetX = (cropCenterX - fw / 2) * scaleX;
            const offsetY = (cropCenterY - fh / 2) * scaleY;
            slice.setPosition(dx + dw / 2 - offsetX, dy + dh / 2 - offsetY);
        }
    }
}

window.CanvasNineSlice = CanvasNineSlice;
