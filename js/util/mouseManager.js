class InternalMouseManager {
    constructor() {
    }

    onPointerMove(pointer) {
        gameVars.wasTouch = pointer.wasTouch || pointer.pointerType === "touch";
        let handPos = mouseToHand(pointer.x, pointer.y, true);
        gameVars.mouseposx = handPos.x;
        gameVars.mouseposy = handPos.y;
        messageBus.publish("pointerMove", handPos.x, handPos.y);
    }

    onPointerDown(pointer) {
        gameVars.wasTouch = pointer.wasTouch;
        gameVars.mousedown = true;
        gameVars.mouseJustDowned = true;
        let handPos = mouseToHand(pointer.x, pointer.y);
        gameVars.mouseposx = handPos.x;
        gameVars.mouseposy = handPos.y;

        gameVars.lastmousedown.x = handPos.x;
        gameVars.lastmousedown.y = handPos.y;
        messageBus.publish("pointerDown", handPos.x, handPos.y);
    }

    onPointerDownAlt(pointer) {
        let handPos = mouseToHand(pointer.x, pointer.y, true);
        gameVars.wasTouch = pointer.wasTouch || (pointer.wasTouch === undefined);
        gameVars.mousedown = true;
        gameVars.mouseJustDowned = true;
        gameVars.mouseposx = handPos.x;
        gameVars.mouseposy = handPos.y;

        gameVars.lastmousedown.x = handPos.x;
        gameVars.lastmousedown.y = handPos.y;
        messageBus.publish("pointerDown", handPos.x, handPos.y);
    }

    onPointerUpAlt(pointer) {
        let handPos = mouseToHand(pointer.x, pointer.y, true);
        gameVars.wasTouch = pointer.pointerType;
        gameVars.mousedown = false;
        gameVars.mouseJustUpped = true;
        messageBus.publish("pointerUp", handPos.x, handPos.y);

        gameVars.mouseposx = handPos.x;
        gameVars.mouseposy = handPos.y;
    }
}

const mouseManager = new InternalMouseManager();

// Converts position of mouse into position of hand
function mouseToHand(x, y, convertFromWindow = false) {
    let inGameX = x;
    let inGameY = y;
    if (convertFromWindow) {
        inGameX = (inGameX - gameVars.canvasXOffset) / gameVars.gameScale;
        inGameY = (inGameY - gameVars.canvasYOffset) / gameVars.gameScale;
    }

    let bufferDist = 0;
    let xRatio = gameConsts.halfWidth / (gameConsts.halfWidth - bufferDist);
    let yRatio = gameConsts.halfHeight / (gameConsts.halfHeight - bufferDist);
    let handX = gameConsts.halfWidth + xRatio * (inGameX - gameConsts.halfWidth);
    let handY = gameConsts.halfHeight + yRatio * (inGameY - gameConsts.halfHeight);
    handX = Math.min(Math.max(0, handX), gameConsts.width - 1);
    handY = Math.min(Math.max(0, handY), gameConsts.height - 1);
    return {x: handX, y: handY};
}

function setupMouseInteraction(scene) {
    let baseTouchLayer = scene.make.image({
        x: 0, y: 0, key: 'whitePixel', add: true, scale: {x: gameConsts.width, y: gameConsts.height}, alpha: 0.001});
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
