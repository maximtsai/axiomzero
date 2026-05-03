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

        TL.setPosition(left + LW/2, top + TH/2);
        TL.setDisplaySize(LW, TH);

        TC.setPosition(left + LW + (W - LW - RW)/2, top + TH/2);
        TC.setDisplaySize(W - LW - RW, TH);

        TR.setPosition(left + W - RW/2, top + TH/2);
        TR.setDisplaySize(RW, TH);

        ML.setPosition(left + LW/2, top + TH + (H - TH - BH)/2);
        ML.setDisplaySize(LW, H - TH - BH);

        MC.setPosition(left + LW + (W - LW - RW)/2, top + TH + (H - TH - BH)/2);
        MC.setDisplaySize(W - LW - RW, H - TH - BH);

        MR.setPosition(left + W - RW/2, top + TH + (H - TH - BH)/2);
        MR.setDisplaySize(RW, H - TH - BH);

        BL.setPosition(left + LW/2, top + H - BH/2);
        BL.setDisplaySize(LW, BH);

        BC.setPosition(left + LW + (W - LW - RW)/2, top + H - BH/2);
        BC.setDisplaySize(W - LW - RW, BH);

        BR.setPosition(left + W - RW/2, top + H - BH/2);
        BR.setDisplaySize(RW, BH);
    }
}

window.CanvasNineSlice = CanvasNineSlice;
