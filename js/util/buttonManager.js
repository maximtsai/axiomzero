class InternalButtonManager {
    constructor() {
        this.buttonList = [];
        this.lastHovered = null;
        this.lastClickedButton = null;
        this.draggedObj = null;

        this.updateInterval = 25;
        this.updateCounter = 0;

        messageBus.subscribe("pointerUp", this.onPointerUp.bind(this));
        messageBus.subscribe("pointerMove", this.onPointerMove.bind(this));
        messageBus.subscribe("pointerDown", this.onPointerDown.bind(this));
    }

    update(delta) {
        let handX = gameVars.mouseposx;
        let handY = gameVars.mouseposy;
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
        if (this.lastHovered && this.lastHovered !== currentHovered && this.lastHovered.getState() !== DISABLE) {
            this.lastHovered.setState(NORMAL);
            this.lastHovered.onHoverOut();
        }
        if (newHovered) {
            newHovered.onHover();
        }

        this.lastHovered = currentHovered;
    }

    onPointerUp(mouseX, mouseY) {
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
            this.draggedObj.setPos(mouseX, mouseY);
            if (this.draggedObj.onDrag) {
                this.draggedObj.onDrag(mouseX, mouseY);
            }
        }
    }

    onPointerDown(mouseX, mouseY) {
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
}

const buttonManager = new InternalButtonManager();
