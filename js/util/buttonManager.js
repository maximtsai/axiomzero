/**
 * @fileoverview Manages all Button instances and input routing
 * @module buttonManager
 */

/**
 * Internal button manager - routes pointer events to Button instances
 * @class
 * @singleton
 */
class InternalButtonManager {
    constructor() {
        this.buttonList = [];
        this.lastHovered = null;
        this.lastClickedButton = null;
        this.draggedObj = null;
        this.updateInterval = 25;
        this.updateCounter = 0;
        this.isBlocked = false;

        messageBus.subscribe("pointerUp", this.onPointerUp.bind(this));
        messageBus.subscribe("pointerMove", this.onPointerMove.bind(this));
        messageBus.subscribe("pointerDown", this.onPointerDown.bind(this));
    }

    setBlocked(val) {
        this.isBlocked = val;
        if (val && this.lastHovered) {
            this.lastHovered.onHoverOut();
            this.lastHovered = null;
        }
    }

    update(delta) {
        if (this.isBlocked) return;
        let handX = GAME_VARS.mouseposx;
        let handY = GAME_VARS.mouseposy;
        // check hovering
        let hasHovered = false;
        let currentHovered = null;
        let newHovered = null;

        for (let i = this.buttonList.length - 1; i >= 0; i--) {
            let buttonObj = this.buttonList[i];
            if (buttonObj && buttonObj.checkCoordOver(handX, handY)) {
                if (this.lastHovered !== buttonObj) {
                    newHovered = buttonObj;
                }
                hasHovered = true;
                currentHovered = buttonObj;
                break;
            }
        }
        let oldHovered = this.lastHovered;
        this.lastHovered = currentHovered;

        if (oldHovered && oldHovered !== currentHovered) {
            oldHovered.onHoverOut();
        }
        if (newHovered) {
            newHovered.onHover();
        }
    }

    onPointerUp(mouseX, mouseY) {
        if (this.isBlocked) return;
        let buttonObj = this.getLastClickedButton();
        if (buttonObj && buttonObj.checkCoordOver(mouseX, mouseY)) {
            buttonObj.onMouseUp(mouseX, mouseY);
        }
        if (this.draggedObj) {
            if (this.draggedObj.onDrop) {
                this.draggedObj.onDrop(mouseX, mouseY);
            }
            this.draggedObj = null;
        }
    }

    onPointerMove(mouseX, mouseY) {
        if (this.draggedObj) {
            if (this.draggedObj.isDraggable) {
                this.draggedObj.setPos(mouseX, mouseY);
            }
            if (this.draggedObj.onDrag) {
                this.draggedObj.onDrag(mouseX, mouseY);
            }
        }
    }

    onPointerDown(mouseX, mouseY) {
        if (this.isBlocked) return;
        for (let i = this.buttonList.length - 1; i >= 0; i--) {
            let buttonObj = this.buttonList[i];
            if (buttonObj.checkCoordOver(mouseX, mouseY)) {
                buttonObj.onMouseDown(mouseX, mouseY);
                this.lastClickedButton = buttonObj;
                break;
            }
        }
    }

    addToButtonList(button) {
        this.buttonList.push(button);
    }

    getLastClickedButton() {
        return this.lastClickedButton;
    }

    removeButton(button) {
        const index = this.buttonList.indexOf(button);
        if (index !== -1) {
            this.buttonList.splice(index, 1);
        }
    }

    bringButtonToTop(button) {
        this.removeButton(button);
        this.addToButtonList(button);
    }

    getDraggedObj() {
        return this.draggedObj;
    }

    setDraggedObj(newObj = null) {
        this.draggedObj = newObj;
    }

    /**
     * Immediate check if a coordinate is over any registered button.
     * Useful for bailing out of world-space input listeners.
     */
    isAnyButtonHovered(x, y) {
        for (let i = this.buttonList.length - 1; i >= 0; i--) {
            const btn = this.buttonList[i];
            if (btn && btn.checkCoordOver(x, y)) return true;
        }
        return false;
    }

    /**
     * Returns the top-most button at the given coordinates, or null.
     */
    getHoveredButton(x, y) {
        for (let i = this.buttonList.length - 1; i >= 0; i--) {
            const btn = this.buttonList[i];
            if (btn && btn.checkCoordOver(x, y)) return btn;
        }
        return null;
    }
}

const buttonManager = new InternalButtonManager();
