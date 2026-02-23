class InternalMouseManager {
    constructor() {
    }

    onPointerMove(pointer) {
        GAME_VARS.wasTouch = pointer.wasTouch || pointer.pointerType === "touch";
        let handPos = mouseToHand(pointer.x, pointer.y, true);
        GAME_VARS.mouseposx = handPos.x;
        GAME_VARS.mouseposy = handPos.y;
        messageBus.publish("pointerMove", handPos.x, handPos.y);
    }

    onPointerDown(pointer) {
        GAME_VARS.wasTouch = pointer.wasTouch;
        GAME_VARS.mousedown = true;
        GAME_VARS.mouseJustDowned = true;
        let handPos = mouseToHand(pointer.x, pointer.y);
        GAME_VARS.mouseposx = handPos.x;
        GAME_VARS.mouseposy = handPos.y;

        GAME_VARS.lastmousedown.x = handPos.x;
        GAME_VARS.lastmousedown.y = handPos.y;
        messageBus.publish("pointerDown", handPos.x, handPos.y);
    }

    onPointerDownAlt(pointer) {
        let handPos = mouseToHand(pointer.x, pointer.y, true);
        GAME_VARS.wasTouch = pointer.wasTouch || (pointer.wasTouch === undefined);
        GAME_VARS.mousedown = true;
        GAME_VARS.mouseJustDowned = true;
        GAME_VARS.mouseposx = handPos.x;
        GAME_VARS.mouseposy = handPos.y;

        GAME_VARS.lastmousedown.x = handPos.x;
        GAME_VARS.lastmousedown.y = handPos.y;
        messageBus.publish("pointerDown", handPos.x, handPos.y);
    }

    onPointerUpAlt(pointer) {
        let handPos = mouseToHand(pointer.x, pointer.y, true);
        GAME_VARS.wasTouch = pointer.pointerType;
        GAME_VARS.mousedown = false;
        GAME_VARS.mouseJustUpped = true;
        messageBus.publish("pointerUp", handPos.x, handPos.y);

        GAME_VARS.mouseposx = handPos.x;
        GAME_VARS.mouseposy = handPos.y;
    }
}

const mouseManager = new InternalMouseManager();

// Converts position of mouse into position of hand
function mouseToHand(x, y, convertFromWindow = false) {
    let inGameX = x;
    let inGameY = y;
    if (convertFromWindow) {
        inGameX = (inGameX - GAME_VARS.canvasXOffset) / GAME_VARS.gameScale;
        inGameY = (inGameY - GAME_VARS.canvasYOffset) / GAME_VARS.gameScale;
    }

    let bufferDist = 0;
    let xRatio = GAME_CONSTANTS.halfWidth / (GAME_CONSTANTS.halfWidth - bufferDist);
    let yRatio = GAME_CONSTANTS.halfHeight / (GAME_CONSTANTS.halfHeight - bufferDist);
    let handX = GAME_CONSTANTS.halfWidth + xRatio * (inGameX - GAME_CONSTANTS.halfWidth);
    let handY = GAME_CONSTANTS.halfHeight + yRatio * (inGameY - GAME_CONSTANTS.halfHeight);
    handX = Math.min(Math.max(0, handX), GAME_CONSTANTS.width - 1);
    handY = Math.min(Math.max(0, handY), GAME_CONSTANTS.height - 1);
    return {x: handX, y: handY};
}

function setupMouseInteraction(scene) {
    let baseTouchLayer = scene.make.image({
        x: 0, y: 0, key: 'white_pixel', add: true, scale: {x: GAME_CONSTANTS.width, y: GAME_CONSTANTS.height}, alpha: 0.001});
    baseTouchLayer.setInteractive();
    baseTouchLayer.on('pointerdown', mouseManager.onPointerDown, scene);
    baseTouchLayer.scrollFactorX = 0;
    baseTouchLayer.scrollFactorY = 0;

    window['onpointermove'] = (pointer) => {
        mouseManager.onPointerMove(pointer);
    };
    window['onpointerup'] = (pointer) => {
        mouseManager.onPointerUpAlt(pointer);
    };
}
