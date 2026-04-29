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
        this.list.forEach(child => {
            if (typeof child.setTint === 'function') {
                child.setTint(color);
            }
        });
        return this;
    }

    setTintFill(color) {
        this.list.forEach(child => {
            if (typeof child.setTintFill === 'function') {
                child.setTintFill(color);
            }
        });
        return this;
    }

    setBlendMode(mode) {
        this.list.forEach(child => {
            if (typeof child.setBlendMode === 'function') {
                child.setBlendMode(mode);
            }
        });
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

        const TL = this.slices[0];
        const TC = this.slices[1];
        const TR = this.slices[2];
        const ML = this.slices[3];
        const MC = this.slices[4];
        const MR = this.slices[5];
        const BL = this.slices[6];
        const BC = this.slices[7];
        const BR = this.slices[8];

        const scaleTC_X = (W - LW - RW) / (fw - LW - RW);
        const scaleML_Y = (H - TH - BH) / (fh - TH - BH);
        const scaleMC_X = scaleTC_X;
        const scaleMC_Y = scaleML_Y;

        const alignSlice = (slice, cx, cy, cw, ch, destX, destY, scaleX, scaleY) => {
            const offsetX = (cx + cw / 2) - fw / 2;
            const offsetY = (cy + ch / 2) - fh / 2;
            slice.setScale(scaleX, scaleY);
            slice.setPosition(destX - offsetX * scaleX, destY - offsetY * scaleY);
        };

        // 1. TL
        alignSlice(TL, 0, 0, LW, TH, left + LW / 2, top + TH / 2, 1, 1);

        // 2. TC
        alignSlice(TC, LW, 0, fw - LW - RW, TH, left + LW + (W - LW - RW) / 2, top + TH / 2, scaleTC_X, 1);

        // 3. TR
        alignSlice(TR, fw - RW, 0, RW, TH, left + W - RW / 2, top + TH / 2, 1, 1);

        // 4. ML
        alignSlice(ML, 0, TH, LW, fh - TH - BH, left + LW / 2, top + TH + (H - TH - BH) / 2, 1, scaleML_Y);

        // 5. MC
        alignSlice(MC, LW, TH, fw - LW - RW, fh - TH - BH, left + LW + (W - LW - RW) / 2, top + TH + (H - TH - BH) / 2, scaleMC_X, scaleMC_Y);

        // 6. MR
        alignSlice(MR, fw - RW, TH, RW, fh - TH - BH, left + W - RW / 2, top + TH + (H - TH - BH) / 2, 1, scaleML_Y);

        // 7. BL
        alignSlice(BL, 0, fh - BH, LW, BH, left + LW / 2, top + H - BH / 2, 1, 1);

        // 8. BC
        alignSlice(BC, LW, fh - BH, fw - LW - RW, BH, left + LW + (W - LW - RW) / 2, top + H - BH / 2, scaleTC_X, 1);

        // 9. BR
        alignSlice(BR, fw - RW, fh - BH, RW, BH, left + W - RW / 2, top + H - BH / 2, 1, 1);
    }
}

window.CanvasNineSlice = CanvasNineSlice;
