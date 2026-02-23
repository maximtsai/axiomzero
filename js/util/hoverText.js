class InternalHoverTextManager {
    constructor() {
        this.hoverTextList = [];
        this.lastHovered   = null;

        messageBus.subscribe("pointerMove", this.onPointerMove.bind(this));
        messageBus.subscribe("pointerDown", this.onPointerDown.bind(this));
    }

    onPointerMove(mouseX, mouseY) {
        const handX = GAME_VARS.mouseposx;
        const handY = GAME_VARS.mouseposy;
        let currentHovered = null;

        for (let i = this.hoverTextList.length - 1; i >= 0; i--) {
            const hoverTextObj = this.hoverTextList[i];
            if (hoverTextObj && hoverTextObj.checkCoordOver(handX, handY)) {
                currentHovered = hoverTextObj;
                if (this.lastHovered !== currentHovered && currentHovered.onHover) {
                    currentHovered.onHover();
                }
                break;
            }
        }

        if (this.lastHovered && this.lastHovered !== currentHovered) {
            if (this.lastHovered.onHoverOut) {
                this.lastHovered.onHoverOut();
            }
        }

        this.lastHovered = currentHovered;
    }

    onPointerDown(mouseX, mouseY) {
        this.onPointerMove(mouseX, mouseY);
    }

    addToHoverTextList(button) {
        this.hoverTextList.push(button);
    }

    removeHoverText(button) {
        for (let i in this.hoverTextList) {
            if (this.hoverTextList[i] === button) {
                this.hoverTextList.splice(parseInt(i), 1);
                break;
            }
        }
    }
}

// Instantiate immediately — no PhaserScene needed at this stage.
globalObjects.hoverTextManager = new InternalHoverTextManager();

// ─── HoverDisplay ─────────────────────────────────────────────────────────────

class HoverDisplay {
    constructor(data) {
        this.hoverBacking = PhaserScene.add.sprite(-3, 0, 'pixels', 'semiblack_pixel.png');
        this.hoverBacking.visible = false;
        this.hoverBacking.setDepth(data.depth || 9992);

        this.hoverTextDisplay = PhaserScene.add.text(0, 0, ' ', {
            fontFamily: 'robotomedium',
            fontSize:   19,
            color:      '#FFFFBB',
            align:      'left'
        });
        this.hoverTextDisplay.visible = false;
        this.hoverTextDisplay.setDepth(data.depth || 9992);

        this.setOrigin(data.originX, data.originY);
        this.setPosition(data.x, data.y);
        this.hoverTextDisplay.setOrigin(data.originX, 0.5);
        this.stopAudioTemp = true;
    }

    addTween(tweenObj) {
        if (this.currTween) this.currTween.stop();
        this.currTween = PhaserScene.tweens.add({
            targets:  [this.hoverBacking, this.hoverTextDisplay],
            duration: 100,
            ...tweenObj
        });
    }

    isMultiLine() {
        return this.hoverBacking.scaleY > 20;
    }

    setPosition(x, y) {
        this.hoverBacking.x     = x - 3;
        this.hoverBacking.y     = y;
        this.hoverTextDisplay.x = this.hoverBacking.x + 3 * (1 - this.hoverBacking.originX * 2 - (this.hoverBacking.originX - 0.5) * 4);
        this.hoverTextDisplay.y = this.hoverBacking.y - this.hoverTextDisplay.height * 0.5 * (this.hoverBacking.originY * 2 - 1) - 3;
    }

    setOrigin(x = 0.5, y = 0.5) {
        this.hoverBacking.setOrigin(x, y);
        this.hoverTextDisplay.setOrigin(x, 0.5);
        if      (x === 0) this.hoverTextDisplay.setAlign('left');
        else if (x === 1) this.hoverTextDisplay.setAlign('right');
        else              this.hoverTextDisplay.setAlign('center');
    }

    getText()        { return this.hoverTextDisplay.text; }
    setAlign(align)  { this.hoverTextDisplay.setAlign(align); }
    stopNextAudio()  { this.stopAudioTemp = true; }

    getStopNextAudio() {
        if (this.stopAudioTemp) {
            this.stopAudioTemp = false;
            return true;
        }
        return false;
    }

    setText(text) {
        if (this.hoverTextDisplay.text === text) return;
        this.hoverTextDisplay.setText(text);

        const align = (gameOptions && gameOptions.infoBoxAlign) || 'center';
        if (align === 'left') {
            this.hoverTextDisplay.setFontSize(this.hoverTextDisplay.width > 170 ? 17 : 19);
        } else {
            this.hoverTextDisplay.setFontSize(text.length > 80 ? 18 : 19);
        }

        this.hoverTextDisplay.x = this.hoverBacking.x + 3 * (1 - this.hoverBacking.originX * 2 - (this.hoverBacking.originX - 0.5) * 4);
        this.hoverTextDisplay.y = this.hoverBacking.y - this.hoverTextDisplay.height * 0.5 * (this.hoverBacking.originY * 2 - 1) - 3;
        this.hoverBacking.setScale(
            (this.hoverTextDisplay.width  + 13) * 0.5 * this.hoverTextDisplay.scaleX + 3,
            (this.hoverTextDisplay.height +  4) * 0.5 * this.hoverTextDisplay.scaleY
        );
        this.setVisible(text.length > 0);
    }

    setAlpha(val) {
        this.hoverTextDisplay.alpha = val;
        this.hoverBacking.alpha     = 0.85 * val;
    }

    setVisible(val) {
        this.hoverTextDisplay.visible = val;
        this.hoverBacking.visible     = val;
    }
}

// ─── HoverText ────────────────────────────────────────────────────────────────

class HoverText {
    constructor(data) {
        this.origin  = { x: data.origin ? data.origin.x : 0.5, y: data.origin ? data.origin.y : 0.5 };
        this.width   = data.width;
        this.height  = data.height;
        this.x       = data.x - this.width  * this.origin.x;
        this.y       = data.y - this.height * this.origin.y;
        this.endX    = data.x + this.width  * (1 - this.origin.x);
        this.endY    = data.y + this.height * (1 - this.origin.y);
        this.text    = data.text || '...';
        this.onHover    = data.onHover;
        this.onHoverOut = data.onHoverOut;
        this.displayX   = data.displayX;
        this.displayY   = data.displayY;
        this.originX    = data.displayOrigin ? data.displayOrigin.x : 0;
        this.originY    = data.displayOrigin ? data.displayOrigin.y : 0;
        this.depth      = 0;

        globalObjects.hoverTextManager.addToHoverTextList(this);
    }

    checkCoordOver(x, y) {
        return x >= this.x && x <= this.endX && y >= this.y && y <= this.endY;
    }

    getPosX()    { return this.x; }
    getPosY()    { return this.y; }
    getXPos()    { return this.x; }
    getYPos()    { return this.y; }
    getWidth()   { return this.endX - this.x; }
    getHeight()  { return this.endY - this.y; }
    setText(text) { this.text = text; }

    setPos(x, y) {
        this.x    = x;
        this.y    = y;
        this.endX = x + this.width;
        this.endY = y + this.height;
    }

    bringToTop() {
        // No-op: HoverText has no Phaser display objects of its own.
    }

    setOrigin(origX, origY) {
        // No-op: origin is baked into x/y/endX/endY at construction time.
    }

    destroy() {
        if (this.isDestroyed) return;
        this.isDestroyed = true;
        globalObjects.hoverTextManager.removeHoverText(this);
    }
}
