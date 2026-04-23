/**
 * @fileoverview Button component for UI interactions
 * @module button
 */

/** @type {string} */
const NORMAL = "normal";
/** @type {string} */
const HOVER = "hover";
/** @type {string} */
const PRESS = "press";
/** @type {string} */
const DISABLE = "disable";

/**
 * Button state constants
 * @readonly
 * @enum {string}
 */
const ButtonState = {
    NORMAL: "normal",
    HOVER: "hover",
    PRESS: "press",
    DISABLE: "disable"
};

/**
 * @typedef {Object} ButtonStateData
 * @property {string} [ref] - Atlas or image reference
 * @property {string} [atlas] - Atlas name
 * @property {number} [x]
 * @property {number} [y]
 * @property {number} [alpha]
 * @property {number} [scaleX]
 * @property {number} [scaleY]
 * @property {number} [rotation]
 * @property {number} [depth]
 * @property {number} [originX]
 * @property {number} [originY]
 * @property {number} [tint]
 * @property {boolean} [preload]
 */

/**
 * @typedef {Object} ButtonConfig
 * @property {import('phaser').Scene} [scene] - Phaser scene
 * @property {ButtonStateData} normal - Normal state data
 * @property {ButtonStateData} [hover] - Hover state data
 * @property {ButtonStateData} [press] - Press state data
 * @property {ButtonStateData} [disable] - Disabled state data
 * @property {Function} [onMouseUp] - Click handler
 * @property {Function} [onMouseDown] - Mouse down handler
 * @property {Function} [onHover] - Hover enter handler
 * @property {Function} [onHoverOut] - Hover exit handler
 * @property {Function} [onDrag] - Drag handler
 * @property {Function} [onDrop] - Drop handler
 * @property {boolean} [isDraggable] - Enable drag
 * @property {boolean} [cursorInteractive] - Show cursor
 */

/**
 * Multi-state button component
 * @class
 */
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
        this.bgSprite = null;
        this.forceInvis = false;
        buttonManager.addToButtonList(this);

        this.depth = data.normal.depth || 0;
        this.handlePreload();

        // Create the single backing sprite
        let initialRef = this.normal.ref;
        if (this.normal.atlas) {
            this.bgSprite = this.scene.add.sprite(0, 0, this.normal.atlas, initialRef);
        } else {
            this.bgSprite = this.scene.add.sprite(0, 0, initialRef);
        }
        this.bgSprite.setDepth(this.depth);
        if (this.normal.origin) {
            this.bgSprite.setOrigin(this.normal.origin.x, this.normal.origin.y);
        }

        this.isDraggable = data.isDraggable || false;
        this.hoverWhileDisabled = data.hoverWhileDisabled || false;
        this._container = null;

        this.setState(NORMAL);
    }

    setState(newState) {
        if (this.isDestroyed || !this.bgSprite || !this.bgSprite.scene) return;
        // If transitioning to NORMAL but mouse is currently over, go to HOVER instead
        // ONLY if this button is explicitly the front-most hovered button managed by buttonManager
        if (newState === NORMAL && this.checkCoordOver(GAME_VARS.mouseposx, GAME_VARS.mouseposy)) {
            // Use window reference safely if buttonManager isn't available somehow
            const mgr = (typeof buttonManager !== 'undefined') ? buttonManager : null;
            if (!mgr || mgr.lastHovered === this) {
                newState = HOVER;
            }
        }

        let stateData;
        switch (newState) {
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

        // Fallback to normal ref if state data lacks one
        let targetRef = stateData.ref || this.normal.ref;
        let targetAtlas = stateData.atlas || this.normal.atlas;

        // Apply Texture swap with safety check
        if (targetAtlas) {
            if (this.scene.textures.exists(targetAtlas)) {
                this.bgSprite.setTexture(targetAtlas, targetRef);
            } else {
                console.warn(`Button: Atlas not found: ${targetAtlas}`);
                this.bgSprite.setTexture(targetRef); // try fallback to loose image
            }
        } else {
            if (this.scene.textures.exists(targetRef)) {
                this.bgSprite.setTexture(targetRef);
            } else {
                console.warn(`Button: Texture not found: ${targetRef}`);
            }
        }

        // Apply Position
        if (stateData.x !== undefined) {
            this.bgSprite.x = stateData.x;
            if (this.text) {
                this.text.x = this.bgSprite.x;
                if (this.text.offsetX) this.text.x += this.text.offsetX;
            }
        }
        if (stateData.y !== undefined) {
            this.bgSprite.y = stateData.y;
            if (this.text) {
                this.text.y = this.bgSprite.y;
                if (this.text.offsetY) this.text.y += this.text.offsetY;
            }
        }

        // Apply Visual properties dynamically only if explicitly authored in this state config
        if (stateData.alpha !== undefined) {
            this.bgSprite.alpha = stateData.alpha;
            if (this.text) this.text.alpha = stateData.alpha;
        }
        if (stateData.scaleX !== undefined) {
            this.bgSprite.scaleX = stateData.scaleX;
        }
        if (stateData.scaleY !== undefined) {
            this.bgSprite.scaleY = stateData.scaleY;
        }
        if (stateData.origin !== undefined) {
            this.setOrigin(stateData.origin.x, stateData.origin.y);
        }
        if (stateData.rotation !== undefined) {
            this.setRotation(stateData.rotation);
        }
        if (stateData.tint !== undefined) {
            this.bgSprite.setTint(stateData.tint);
        }
    }

    setVisible(vis = true) {
        if (this.isDestroyed || !this.bgSprite) return;
        if (vis) {
            this.forceInvis = false;
            this.bgSprite.setVisible(true);
        } else {
            this.bgSprite.setVisible(false);
            this.forceInvis = true;
        }
        if (this.text) {
            this.text.setVisible(vis);
        }
        return this;
    }

    getDepth() {
        return this.bgSprite ? this.bgSprite.depth : (this.normal.depth || 0);
    }

    checkCoordOver(valX, valY) {
        if (this.isDestroyed || !this.bgSprite || !this.bgSprite.visible || this.bgSprite.alpha <= 0) return false;
        if (this.state === DISABLE && !this.hoverWhileDisabled) {
            return false;
        }

        // Optional Hit Area Constraint (Screen Space)
        if (this.hitArea) {
            if (valX < this.hitArea.x || valX > this.hitArea.x + this.hitArea.w ||
                valY < this.hitArea.y || valY > this.hitArea.y + this.hitArea.h) {
                return false;
            }
        }

        let currImage = this.bgSprite;
        if (!currImage) return false;

        let scrollFactorX = this.normal.scrollFactorX !== undefined ? this.normal.scrollFactorX : 1;
        let scrollFactorY = this.normal.scrollFactorY !== undefined ? this.normal.scrollFactorY : 1;
        let cam = this.scene ? this.scene.cameras.main : PhaserScene.cameras.main;
        let x = valX + cam.scrollX * scrollFactorX;
        let y = valY + cam.scrollY * scrollFactorY;

        let width = currImage.width * Math.abs(currImage.scaleX);
        let leftMost = currImage.x - currImage.originX * width;
        let rightMost = leftMost + width;
        if (x < leftMost || x > rightMost) {
            return false;
        }

        let height = currImage.height * Math.abs(currImage.scaleY);
        let topMost = currImage.y - currImage.originY * height;
        let botMost = topMost + height;
        if (y < topMost || y > botMost) {
            return false;
        }
        return true;
    }

    onHover() {
        if (this.isDestroyed) return;
        if (this.state === NORMAL) {
            this.setState(HOVER);
        }
        if (this.onHoverFunc) {
            this.onHoverFunc();
        }
    }

    onHoverOut() {
        if (this.isDestroyed) return;
        if (this.onHoverOutFunc) {
            this.onHoverOutFunc();
        }
        if (this.state !== DISABLE) {
            this.setState(NORMAL);
        }
    }

    onMouseDown(x, y) {
        if (this.isDestroyed) return;
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

    removeDrag() {
        this.onDragFunc = null;
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
        if (this.isDestroyed) return;
        if (this.state === PRESS) {
            this.setState(HOVER);
            if (this.onMouseUpFunc) {
                this.onMouseUpFunc(x, y);
            }
        }
    }

    onDrop(x, y) {
        if (this.isDestroyed) return;
        this.isDragged = false;
        buttonManager.setDraggedObj();
        if (this.onDropFunc) {
            this.onDropFunc(x, y);
        }
    }

    setDepth(depth = 0) {
        if (this.isDestroyed || !this.bgSprite) return;
        this.normal.depth = depth;
        this.hover.depth = depth;
        this.press.depth = depth;
        this.disable.depth = depth;
        if (this.text) {
            this.text.setDepth(depth + 1);
        }
        this.bgSprite.setDepth(depth);
        return this;
    }

    setRotation(rot) {
        if (this.isDestroyed || !this.bgSprite) return;
        this.normal.rotation = rot;
        this.hover.rotation = rot;
        this.press.rotation = rot;
        this.disable.rotation = rot;
        this.bgSprite.setRotation(rot);
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
        return this.bgSprite.scaleX;
    }

    getScaleY() {
        return this.bgSprite.scaleY;
    }

    getXPos() {
        return this.bgSprite ? this.bgSprite.x : (this.normal.x || 0);
    }

    getYPos() {
        return this.bgSprite ? this.bgSprite.y : (this.normal.y || 0);
    }

    get x() {
        return this.getXPos();
    }

    set x(value) {
        this.setPos(value, undefined);
    }

    get y() {
        return this.getYPos();
    }

    set y(value) {
        this.setPos(undefined, value);
    }

    setX(x) {
        this.setPos(x, undefined);
        return this;
    }

    setY(y) {
        this.setPos(undefined, y);
        return this;
    }

    get rotation() {
        return this.normal.rotation || 0;
    }

    set rotation(value) {
        this.setRotation(value);
    }

    get alpha() {
        return this.getAlpha();
    }

    set alpha(value) {
        this.setAlpha(value);
    }

    get depth() {
        return this.getDepth();
    }

    set depth(value) {
        this.setDepth(value);
    }

    get scaleX() {
        return this.getScaleX();
    }

    set scaleX(value) {
        this.setScale(value, this.scaleY);
    }

    get scaleY() {
        return this.getScaleY();
    }

    set scaleY(value) {
        this.setScale(this.scaleX, value);
    }

    setPosition(x, y) {
        this.setPos(x, y);
        return this;
    }

    getSprite() {
        return this.bgSprite;
    }

    getWidth() {
        if (!this.bgSprite) return 0;
        return this.bgSprite.width * this.bgSprite.scaleX;
    }

    getHeight() {
        if (!this.bgSprite) return 0;
        return this.bgSprite.height * this.bgSprite.scaleY;
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
        if (this.isDestroyed || !this.bgSprite) return;
        if (x !== undefined) {
            this.normal.x = x;
            this.hover.x = x;
            this.press.x = x;
            this.disable.x = x;
            this.bgSprite.x = x;
            if (this.text) {
                this.updateTextPosition();
            }
        }
        if (y !== undefined) {
            this.normal.y = y;
            this.hover.y = y;
            this.press.y = y;
            this.disable.y = y;
            this.bgSprite.y = y;
            if (this.text) {
                this.updateTextPosition();
            }
        }
        return this;
    }

    // Agnostic to window's position
    setScrollFactor(x, y) {
        if (x !== undefined) {
            this.normal.scrollFactorX = x;
            this.hover.scrollFactorX = x;
            this.press.scrollFactorX = x;
            this.disable.scrollFactorX = x;
            this.bgSprite.scrollFactorX = x;
            if (this.text) {
                this.text.scrollFactorX = x;
            }
        }
        if (y !== undefined) {
            this.normal.scrollFactorY = y;
            this.hover.scrollFactorY = y;
            this.press.scrollFactorY = y;
            this.disable.scrollFactorY = y;
            this.bgSprite.scrollFactorY = y;
            if (this.text) {
                this.text.scrollFactorY = y;
            }
        }
        return this;
    }

    setAlpha(alpha = 1) {
        if (this.isDestroyed || !this.bgSprite) return;
        this.bgSprite.alpha = alpha;
        if (this.text) {
            this.text.setAlpha(alpha);
        }
        return this;
    }

    getAlpha() {
        return this.bgSprite ? this.bgSprite.alpha : 1;
    }

    setScale(scaleX, scaleY) {
        if (this.isDestroyed || !this.bgSprite) return;
        if (scaleY === undefined) {
            scaleY = scaleX;
        }
        this.normal.scaleX = scaleX;
        this.normal.scaleY = scaleY;
        this.hover.scaleX = scaleX;
        this.hover.scaleY = scaleY;
        this.press.scaleX = scaleX;
        this.press.scaleY = scaleY;
        this.disable.scaleX = scaleX;
        this.disable.scaleY = scaleY;

        this.bgSprite.setScale(scaleX, scaleY);
        return this;
    }

    getScaleX() {
        return this.bgSprite ? this.bgSprite.scaleX : 1;
    }

    getScaleY() {
        return this.bgSprite ? this.bgSprite.scaleY : 1;
    }

    setOrigin(origX, origY) {
        if (this.isDestroyed || !this.bgSprite) return this;

        // Persist to all states so it doesn't get "reset" on state changes
        this.normal.origin = { x: origX, y: origY };
        this.hover.origin = { x: origX, y: origY };
        this.press.origin = { x: origX, y: origY };
        this.disable.origin = { x: origX, y: origY };

        this.bgSprite.setOrigin(origX, origY);

        // Re-center text if it exists
        if (this.text) {
            this.updateTextPosition();
        }

        return this;
    }

    /** Helper to keep text centered relative to the sprite, accounting for origin/scale. */
    updateTextPosition() {
        if (!this.text || !this.bgSprite) return;

        const spr = this.bgSprite;
        const width = spr.width * spr.scaleX;
        const height = spr.height * spr.scaleY;

        // Calculate visual center offset from the registration point (x, y)
        const offsetX = (0.5 - spr.originX) * width;
        const offsetY = (0.5 - spr.originY) * height;

        this.text.x = spr.x + offsetX + (this.text.offsetX || 0);
        this.text.y = spr.y + offsetY + (this.text.offsetY || 0);
    }

    _applyRussianTextScale() {
        if (gameOptions.language === 'ru') {
            this.text.setScale(0.72, 0.77);
        } else {
            this.text.setScale(1);
        }
    }

    addText(text, font) {
        let depth = this.normal.depth ? this.normal.depth + 1 : 1;
        this.text = this.scene.add.text(this.normal.x, this.normal.y, text, font).setAlpha(this.normal.alpha).setOrigin(0.5, 0.5).setDepth(depth);
        if (this._mask) this.text.setMask(this._mask);
        if (this._container) this._container.add(this.text);
        this._applyRussianTextScale();
        return this.text;
    }

    addToContainer(container) {
        if (!container) return;
        this._container = container;
        this._container.add(this.bgSprite);
        if (this.text) {
            this._container.add(this.text);
        }
        // Native Container support for sorting; VirtualGroups do not have .sort()
        if (this._container.sort) {
            this._container.sort();
        }
    }

    removeFromContainer() {
        if (this._container) {
            // Polymorphic support for native Containers (.remove) and VirtualGroups (.removeChild)
            if (this._container.remove) {
                this._container.remove(this.bgSprite);
                if (this.text) this._container.remove(this.text);
            } else if (this._container.removeChild) {
                this._container.removeChild(this.bgSprite);
                if (this.text) this._container.removeChild(this.text);
            }
        }
        this._container = null;
    }

    setMask(mask) {
        this._mask = mask;
        this.bgSprite.setMask(mask);
        if (this.text) this.text.setMask(mask);
    }

    /**
     * Set a screen-space rectangle that restricts where this button can be clicked.
     * Useful for allowing interactions only within a specific panel/viewport.
     * @param {number} x 
     * @param {number} y 
     * @param {number} w 
     * @param {number} h 
     */
    setHitArea(x, y, w, h) {
        this.hitArea = { x, y, w, h };
        return this;
    }

    /** Remove the hit area constraint. */
    clearHitArea() {
        this.hitArea = null;
        return this;
    }

    clearMask() {
        this._mask = null;
        this.bgSprite.clearMask();
        if (this.text) this.text.clearMask();
    }

    setTextColor(color) {
        if (this.text) {
            this.text.setColor(color);
        }
    }

    setTextOffset(x, y) {
        this.text.offsetX = x;
        this.text.offsetY = y;
        this.text.x = this.bgSprite.x + this.text.offsetX;
        this.text.y = this.bgSprite.y + this.text.offsetY;
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
        if (this.isDestroyed) return null;
        if (this.text) {
            this.text.setText(text);
        } else {
            return null;
        }
        if (gameOptions.language === 'ru') {
            this.text.setScale(0.77, 0.84);
        } else {
            this.text.setScale(1);
        }
        return this.text;
    }

    tweenToPos(x, y, duration, ease, onUpdate) {
        if (this.isDestroyed || !this.bgSprite || !this.scene || !this.scene.tweens) return;
        let tweenObj = {
            targets: this.bgSprite,
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
        if (this.isDestroyed || !this.bgSprite || !this.scene || !this.scene.tweens) return;
        let tweenObj = {
            targets: this.bgSprite,
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
        if (this.isDestroyed || !this.bgSprite || !this.scene) return;
        let tweenObj = {
            targets: this.bgSprite,
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

        if (this.bgSprite) {
            this.bgSprite.destroy();
        }
    }
}
