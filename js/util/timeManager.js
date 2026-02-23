/**
 * Controls passage of game time, lets you pause and unpause stuff
 **/
 class TimeManager {
    constructor() {
        messageBus.subscribe("tempPause", this.setTempPause.bind(this));
        messageBus.subscribe("pauseGame", this.setPermPause.bind(this));
        messageBus.subscribe("setGameSlow", this.setGameSlow.bind(this));
        messageBus.subscribe("clearGameSlow", this.clearGameSlow.bind(this));
        messageBus.subscribe("unpauseGame", this.setUnpause.bind(this));
    }

    setTempPause(dur = 100, magnitude) {
        GAME_VARS.timeScale = magnitude || 0.5;
        PhaserScene.tweens.timeScale = magnitude || 0.6;
        PhaserScene.time.timeScale = magnitude || 0.5;
        PhaserScene.anims.globalTimeScale = magnitude || 0.6;
        if (this.currTimeoutAmt) {
            if (GAME_VARS.timeScale > this.currTimeoutAmt) {
                return;
            }
        }

        this.currTimeoutAmt = GAME_VARS.timeScale;
        if (this.currTimeoutPause) {
            clearTimeout(this.currTimeoutPause);
        }
        this.currTimeoutPause = setTimeout(() => {
            GAME_VARS.timeScale = GAME_VARS.gameManualSlowSpeed || 1;
            PhaserScene.tweens.timeScale = GAME_VARS.gameManualSlowSpeed || 1;
            PhaserScene.time.timeScale = GAME_VARS.gameManualSlowSpeed || 1;
            PhaserScene.anims.globalTimeScale = GAME_VARS.gameManualSlowSpeed || 1;
            this.currTimeoutAmt = null;
        }, dur)
    }

    setPermPause(amt = 0.002) {
        GAME_VARS.permTimeScale = amt;
        GAME_VARS.timeScale = amt;
        PhaserScene.tweens.timeScale = amt;
        PhaserScene.time.timeScale = amt;
        PhaserScene.anims.globalTimeScale = amt;
    }

    setUnpause() {
        GAME_VARS.timeScale = GAME_VARS.gameManualSlowSpeed || 1;
        GAME_VARS.permTimeScale = GAME_VARS.timeScale;

        PhaserScene.tweens.timeScale = GAME_VARS.gameManualSlowSpeed || 1;
        PhaserScene.time.timeScale = GAME_VARS.gameManualSlowSpeed || 1;
        PhaserScene.anims.globalTimeScale = GAME_VARS.gameManualSlowSpeed || 1;
    }

    setGameSlow(amt) {
        GAME_VARS.gameManualSlowSpeed = amt;
        GAME_VARS.gameManualSlowSpeedInverse = 1 / GAME_VARS.gameManualSlowSpeed;
        GAME_VARS.timeScale = GAME_VARS.gameManualSlowSpeed;
        PhaserScene.tweens.timeScale = GAME_VARS.gameManualSlowSpeed;
        PhaserScene.time.timeScale = GAME_VARS.gameManualSlowSpeed;
        PhaserScene.anims.globalTimeScale = GAME_VARS.gameManualSlowSpeed;
    }

    clearGameSlow() {
        GAME_VARS.gameManualSlowSpeed = 1;
        GAME_VARS.gameManualSlowSpeedInverse = 1;
        GAME_VARS.timeScale = GAME_VARS.gameManualSlowSpeed;
        PhaserScene.tweens.timeScale = GAME_VARS.gameManualSlowSpeed;
        PhaserScene.time.timeScale = GAME_VARS.gameManualSlowSpeed;
        PhaserScene.anims.globalTimeScale = GAME_VARS.gameManualSlowSpeed;
    }

}
