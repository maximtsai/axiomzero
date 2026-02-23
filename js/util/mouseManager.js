class InternalMouseManager {
    setup(scene) {
        scene.input.on('pointermove', (pointer) => {
            GAME_VARS.mouseposx = pointer.x;
            GAME_VARS.mouseposy = pointer.y;
            GAME_VARS.wasTouch  = (pointer.pointerType === 'touch');
            messageBus.publish('pointerMove', pointer.x, pointer.y);
        });

        scene.input.on('pointerdown', (pointer) => {
            GAME_VARS.mouseposx       = pointer.x;
            GAME_VARS.mouseposy       = pointer.y;

            helper.createClickEffect(pointer.x, pointer.y);
            GAME_VARS.mousedown       = true;
            GAME_VARS.mouseJustDowned = true;
            GAME_VARS.wasTouch        = (pointer.pointerType === 'touch');
            GAME_VARS.lastmousedown.x = pointer.x;
            GAME_VARS.lastmousedown.y = pointer.y;
            messageBus.publish('pointerDown', pointer.x, pointer.y);
        });

        scene.input.on('pointerup', (pointer) => {
            GAME_VARS.mouseposx      = pointer.x;
            GAME_VARS.mouseposy      = pointer.y;
            GAME_VARS.mousedown      = false;
            GAME_VARS.mouseJustUpped = true;
            GAME_VARS.wasTouch       = (pointer.pointerType === 'touch');
            messageBus.publish('pointerUp', pointer.x, pointer.y);
        });
    }
}

const mouseManager = new InternalMouseManager();

function setupMouseInteraction(scene) {
    mouseManager.setup(scene);
}
