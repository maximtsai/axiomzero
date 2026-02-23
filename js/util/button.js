const NORMAL = "normal";
const HOVER = "hover";
const PRESS = "press";
const DISABLE = "disable";

class Button {
    /**
     * Create a button with some parameters
     *
     * data = {normal: ..., press: ...}
     *
     * Possible parameters: scene, normal, hover, press, disable, onMouseUp, onHover, onDrop, isDraggable
     */
    constructor(data) {
        this.scene = data.scene || PhaserScene;
        this.state = NORMAL;
        this.normal = data.normal;
        this.hover = data.hover || data.normal;
        this.press = data.press || data.normal;
        this.disable = data.disable || data.normal;
        this.onMouseDownFunc = data.onMouseDown;
        this.onMouseUpFunc = data.onMouseUp;
        this.onDragFunc = data.onDrag;
        this.onHoverFunc = data.onHover || null;
        this.onHoverOutFunc = data.onHoverOut || null;
        this.onDropFunc = data.onDrop || null;
        this.cursorInteractive = data.cursorInteractive;
        this.destructibles = [];
        this.imageRefs = {};
        this.oldImageRef = null;
        this.currImageRef = null;
        buttonManager.addToButtonList(this);

        this.handlePreload();
        this.setState(NORMAL);

        this.isDraggable = data.isDraggable || false;
        this.depth = 0;
    }

    setState(newState) {
        let stateData;
        switch(newState) {
            case NORMAL:
                stateData = this.normal;
                break;
            case HOVER:
                stateData = this.hover;
                break;
            case PRESS:
                stateData = this.press;
                break;
            case DISABLE:
                stateData = this.disable;
                break;
            default:
                console.error("Invalid state ", newState);
                return;
        }
        this.state = newState;
        if (stateData.ref) {
            this.oldImageRef = this.currImageRef;
            this.currImageRef = stateData.ref;
            // hide old
            if (this.imageRefs[this.oldImageRef]) {
                this.imageRefs[this.oldImageRef].visible = false;
            }
            let newImage = this.imageRefs[stateData.ref];
            if (!newImage) {
                if (stateData.atlas) {
                    newImage = this.scene.add.sprite(0, 0, stateData.atlas, stateData.ref);
                } else {
                    newImage = this.scene.add.sprite(0, 0, stateData.ref);
                }
                let oldImage = this.imageRefs[this.oldImageRef];
                if (oldImage) {
                    newImage.setOrigin(oldImage.originX, oldImage.originY);
                    newImage.scrollFactorX = oldImage.scrollFactorX;
                    newImage.scrollFactorY = oldImage.scrollFactorY;
                }
                newImage.setDepth(this.depth);
                this.imageRefs[stateData.ref] = newImage;
            }
            if (!this.forceInvis) {
                newImage.visible = true;
            }
        } else {
            stateData.ref = this.normal.ref;
        }
        let oldImage = this.imageRefs[this.oldImageRef];
        if (!oldImage) {
            // handle edge case when starting out
            oldImage = this.imageRefs[this.currImageRef];
        }
        if (stateData.x === undefined) {
            this.imageRefs[stateData.ref].x = oldImage.x || 0;
        } else {
            this.imageRefs[stateData.ref].x = stateData.x;
            if (this.text) {
                this.text.x = this.imageRefs[stateData.ref].x;
                if (this.text.offsetX) {
                    this.text.x += this.text.offsetX;
                }
            }
        }
        if (stateData.y === undefined) {
            this.imageRefs[stateData.ref].y = oldImage.y || 0;
        } else {
            this.imageRefs[stateData.ref].y = stateData.y;
            if (this.text) {
                this.text.y = this.imageRefs[stateData.ref].y;
                if (this.text.offsetY) {
                    this.text.y += this.text.offsetY;
                }
            }
        }
        if (stateData.alpha === undefined) {
            this.imageRefs[stateData.ref].alpha = oldImage.alpha || 1;
        } else {
            this.imageRefs[stateData.ref].alpha = stateData.alpha;
            if (this.text) {
                this.text.alpha = this.imageRefs[stateData.ref].alpha;
            }
        }
        if (stateData.scaleX === undefined) {
            this.imageRefs[stateData.ref].scaleX = oldImage.scaleX || 1;
        } else {
            this.imageRefs[stateData.ref].scaleX = stateData.scaleX;
        }
        if (stateData.scaleY === undefined) {
            this.imageRefs[stateData.ref].scaleY = oldImage.scaleY || 1;
        } else {
            this.imageRefs[stateData.ref].scaleY = stateData.scaleY;
        }
        if (stateData.origin !== undefined) {
            this.setOrigin(stateData.origin.x, stateData.origin.y);
        }
        if (stateData.rotation !== undefined) {
            this.setRotation(stateData.rotation);
        }

        if (stateData.tint === undefined) {
            this.imageRefs[stateData.ref].setTint(oldImage.tint) || 0xFFFFFF;
        } else {
            this.imageRefs[stateData.ref].setTint(stateData.tint);
        }
    }

    setVisible(vis = true) {
        Object.keys(this.imageRefs).forEach(key => {
            this.imageRefs[key].setVisible(vis);
        });
        this.forceInvis = !vis;
    }

    checkCoordOver(valX, valY) {
        if (this.state === DISABLE) {
            return false;
        }
        let scrollFactorX = this.normal.scrollFactorX !== undefined ? this.normal.scrollFactorX : 1;
        let scrollFactorY = this.normal.scrollFactorY !== undefined ? this.normal.scrollFactorY : 1;
        let x = valX + PhaserScene.cameras.main.scrollX * scrollFactorX;
        let y = valY + PhaserScene.cameras.main.scrollY * scrollFactorY;
        let currImage = this.imageRefs[this.currImageRef];
        let width = currImage.width * Math.abs(currImage.scaleX);
        let height = currImage.height * Math.abs(currImage.scaleY);
        let leftMost = currImage.x - currImage.originX * width;
        let rightMost = currImage.x + (1 - currImage.originX) * width;
        if (x < leftMost || x > rightMost) {
            return false;
        }
        let topMost = currImage.y - currImage.originY * height;
        let botMost = currImage.y + (1 - currImage.originY) * height;
        if (y < topMost || y > botMost) {
            return false;
        }
        return true;
    }

    onHover() {
        if (this.state === NORMAL) {
            this.setState(HOVER);
        }
        if (this.onHoverFunc) {
            this.onHoverFunc();
        }
    }

    onHoverOut() {
        if (this.onHoverOutFunc) {
            this.onHoverOutFunc();
        }
        this.setState(NORMAL);
    }

    onMouseDown(x, y) {
        if (this.state !== DISABLE) {
            this.setState(PRESS);
            if (this.onMouseDownFunc) {
                this.onMouseDownFunc(x, y);
            }
            if (this.isDraggable) {
                if (!this.isDragged) {
                    this.setPos(GAME_VARS.mouseposx + PhaserScene.cameras.main.scrollX, GAME_VARS.mouseposy + PhaserScene.cameras.main.scrollY);
                    this.isDragged = true;
                    let oldDraggedObj = buttonManager.getDraggedObj();
                    if (oldDraggedObj && oldDraggedObj.onDrop) {
                        oldDraggedObj.onDrop(x, y);
                    }
                    buttonManager.setDraggedObj(this);
                }
            }
        }
    }

    onDrag(x, y) {
        if (this.onDragFunc) {
            this.onDragFunc(x, y);
        }
    }

    // Force click but only if button isn't disabled
    clickMouseUp() {
        if (this.state !== DISABLE) {
            if (this.onMouseUpFunc) {
                this.onMouseUpFunc();
            }
        }
    }

    onMouseUp(x, y) {
        if (this.state === PRESS) {
            this.setState(HOVER);
            if (this.onMouseUpFunc) {
                this.onMouseUpFunc(x, y);
            }
        }
    }

    onDrop(x, y) {
        this.isDragged = false;
        buttonManager.setDraggedObj();
        if (this.onDropFunc) {
            this.onDropFunc(x, y);
        }
    }

    setDepth(depth = 0) {
        this.depth = depth;
        if (this.text) {
            this.text.setDepth(depth + 1);
        }
        Object.keys(this.imageRefs).forEach(key => {
            this.imageRefs[key].setDepth(depth);
        });
    }

    setRotation(rot) {
        this.normal.rotation = rot;
        this.hover.rotation = rot;
        this.press.rotation = rot;
        this.disable.rotation = rot;
        Object.keys(this.imageRefs).forEach(key => {
            this.imageRefs[key].setRotation(rot);
        });
        if (this.text) {
            this.text.setRotation(rot);
        }
    }

    getPosX() {
        return this.getXPos();
    }

    getPosY() {
        return this.getYPos();
    }

    getScaleX() {
        return this.imageRefs[this.currImageRef].scaleX;
    }

    getScaleY() {
        return this.imageRefs[this.currImageRef].scaleY;
    }

    getXPos() {
        return this.normal.x;
    }

    getYPos() {
        return this.normal.y;
    }

    getWidth() {
        return this.imageRefs[this.currImageRef].width * this.imageRefs[this.currImageRef].scaleX;
    }

    getHeight() {
        return this.imageRefs[this.currImageRef].height * this.imageRefs[this.currImageRef].scaleY;
    }

    getState() {
        return this.state;
    }

    getIsDragged() {
        return this.isDragged && this.state !== DISABLE;
    }

    getIsInteracted() {
        return this.state === HOVER || this.isDragged || this.state === PRESS;
    }

    getIsHovered() {
        return this.state === HOVER;
    }

    setOnMouseDownFunc(func) {
        this.onMouseDownFunc = func;
    }

    setOnMouseUpFunc(func) {
        this.onMouseUpFunc = func;
    }

    setOnHoverFunc(func) {
        this.onHoverFunc = func;
    }

    setOnHoverOutFunc(func) {
        this.onHoverOutFunc = func;
    }

    setNormalRef(ref) {
        this.normal.ref = ref;
        if (this.state === NORMAL) {
            this.setState(NORMAL);
        }
    }

    setHoverRef(ref) {
        this.hover.ref = ref;
        if (this.state === HOVER) {
            this.setState(HOVER);
        }
    }

    setHoverAlpha(alpha) {
        this.hover.alpha = alpha;
    }

    setPressRef(ref) {
        this.press.ref = ref;
        if (this.state === PRESS) {
            this.setState(PRESS);
        }
    }

    setDisableRef(ref) {
        this.disable.ref = ref;
        if (this.state === DISABLE) {
            this.setState(DISABLE);
        }
    }

    setAllRef(ref) {
        this.normal.ref = ref;
        this.hover.ref = ref;
        this.press.ref = ref;
        this.disable.ref = ref;
        this.setState(this.state);
    }

    setPos(x, y) {
        if (x !== undefined) {
            this.normal.x = x;
            this.hover.x = x;
            this.press.x = x;
            this.disable.x = x;
            Object.keys(this.imageRefs).forEach(key => {
                this.imageRefs[key].x = x;
            });
        }
        if (y !== undefined) {
            this.normal.y = y;
            this.hover.y = y;
            this.press.y = y;
            this.disable.y = y;
            Object.keys(this.imageRefs).forEach(key => {
                this.imageRefs[key].y = y;
            });
        }
    }

    // Agnostic to window's position
    setScrollFactor(x, y) {
        if (x !== undefined) {
            this.normal.scrollFactorX = x;
            this.hover.scrollFactorX = x;
            this.press.scrollFactorX = x;
            this.disable.scrollFactorX = x;
            Object.keys(this.imageRefs).forEach(key => {
                this.imageRefs[key].scrollFactorX = x;
            });
        }
        if (y !== undefined) {
            this.normal.scrollFactorY = y;
            this.hover.scrollFactorY = y;
            this.press.scrollFactorY = y;
            this.disable.scrollFactorY = y;
            Object.keys(this.imageRefs).forEach(key => {
                this.imageRefs[key].scrollFactorY = y;
            });
        }
        if (this.text) {
            this.text.scrollFactorX = x;
            this.text.scrollFactorY = y;
        }
    }

    setAlpha(alpha = 1) {
        Object.keys(this.imageRefs).forEach(key => {
            this.imageRefs[key].alpha = alpha;
        });
        if (this.text) {
            this.text.setAlpha(alpha);
        }
    }

    setScale(scaleX, scaleY) {
        if (scaleY === undefined) {
            scaleY = scaleX;
        }
        Object.keys(this.imageRefs).forEach(key => {
            this.imageRefs[key].scaleX = scaleX;
            this.imageRefs[key].scaleY = scaleY;
        });
    }

    setOrigin(origX, origY) {
        Object.keys(this.imageRefs).forEach(key => {
            this.imageRefs[key].setOrigin(origX, origY);
        });
        return this;
    }

    _applyRussianTextScale() {
        if (language === 'ru') {
            this.text.setScale(0.72, 0.77);
        } else {
            this.text.setScale(1);
        }
    }

    addText(text, font) {
        let depth = this.normal.depth ? this.normal.depth + 1 : 1;
        this.text = this.scene.add.text(this.normal.x, this.normal.y, text, font).setAlpha(this.normal.alpha).setOrigin(0.5, 0.5).setDepth(depth);
        this._applyRussianTextScale();
        return this.text;
    }

    setTextColor(color) {
        if (this.text) {
            this.text.setColor(color);
        }
    }

    setTextOffset(x, y) {
        this.text.offsetX = x;
        this.text.offsetY = y;
        this.text.x = this.imageRefs[this.currImageRef].x + this.text.offsetX;
        this.text.y = this.imageRefs[this.currImageRef].y + this.text.offsetY;
    }

    setStroke(color, width) {
        if (this.text) {
            this.text.setStroke(color, width);
        }
    }

    getText() {
        return this.text;
    }

    setText(text) {
        if (this.text) {
            this.text.setText(text);
        }
        if (language === 'ru') {
            this.text.setScale(0.77, 0.84);
        } else {
            this.text.setScale(1);
        }
        return this.text;
    }

    tweenToPos(x, y, duration, ease, onUpdate) {
        let tweenObj = {
            targets: this.imageRefs[this.currImageRef],
            ease: ease,
            duration: duration,
            onUpdate: onUpdate,
            onComplete: () => {
                this.setPos(x, y);
            }
        };
        if (x !== undefined) {
            tweenObj.x = x;
        }
        if (y !== undefined) {
            tweenObj.y = y;
        }
        this.scene.tweens.add(tweenObj);
    }

    tweenToScale(x, y, duration, ease, onUpdate, onComplete) {
        let tweenObj = {
            targets: this.imageRefs[this.currImageRef],
            ease: ease,
            easeParams: [2.5],
            duration: duration,
            onUpdate: onUpdate,
            onComplete: () => {
                this.setScale(x, y);
                if (onComplete) {
                    onComplete();
                }
            }
        };
        if (x !== undefined) {
            tweenObj.scaleX = x;
        }
        if (y !== undefined) {
            tweenObj.scaleY = y;
        }
        this.scene.tweens.add(tweenObj);
    }

    tweenToAlpha(alpha, duration, ease, onComplete) {
        let tweenObj = {
            targets: this.imageRefs[this.currImageRef],
            ease: ease,
            duration: duration,
            alpha: alpha,
            onComplete: () => {
                this.setAlpha(alpha);
                if (onComplete) {
                    onComplete();
                }
            }
        };
        if (this.text) {
            let textTweenObj = {
                targets: this.text,
                ease: ease,
                duration: duration,
                alpha: alpha,
                onComplete: () => {
                    this.setAlpha(alpha);
                }
            };
            this.scene.tweens.add(textTweenObj);
        }
        this.scene.tweens.add(tweenObj);
    }

    // Special case where we want the button to fully initialize asap
    handlePreload() {
        if (this.hover.preload) {
            this.setState(HOVER);
        }
        if (this.press.preload) {
            this.setState(PRESS);
        }
        if (this.disable.preload) {
            this.setState(DISABLE);
        }
    }

    addToDestructibles(item) {
        this.destructibles.push(item);
    }

    destroy() {
        if (this.isDestroyed) {
            return;
        }
        this.isDestroyed = true;
        if (this.destructibles.length > 0) {
            for (let i = 0; i < this.destructibles.length; i++) {
                this.destructibles[i].destroy();
            }
        }
        this.destructibles = [];
        buttonManager.removeButton(this);
        if (this.text) {
            this.text.destroy();
        }

        Object.keys(this.imageRefs).forEach(key => {
            this.imageRefs[key].destroy();
        });
    }
}
