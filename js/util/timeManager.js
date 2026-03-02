/**
 * @fileoverview Controls passage of game time via GAME_VARS.timeScale.
 * Subscribes to messageBus topics: tempPause, pauseGame, setGameSlow, clearGameSlow, unpauseGame.
 * @module timeManager
 */
class TimeManager {
    constructor() {
        messageBus.subscribe("tempPause", this.setTempPause.bind(this));
        messageBus.subscribe("pauseGame", this.setPermPause.bind(this));
        messageBus.subscribe("setGameSlow", this.setGameSlow.bind(this));
        messageBus.subscribe("clearGameSlow", this.clearGameSlow.bind(this));
        messageBus.subscribe("unpauseGame", this.setUnpause.bind(this));
    }

    /** Apply a timeScale value to all Phaser time systems and GAME_VARS. */
    _applyTimeScale(val) {
        GAME_VARS.timeScale = val;
        PhaserScene.tweens.timeScale = val;
        PhaserScene.time.timeScale = val;
        PhaserScene.anims.globalTimeScale = val;
    }

    /**
     * Briefly slow game time, then auto-restore.
     * @param {number} [dur=100] - Pause duration in ms.
     * @param {number} [magnitude] - timeScale during pause (default 0.5).
     */
    setTempPause(dur = 100, magnitude) {
        this._applyTimeScale(magnitude || 0.5);
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
            this._applyTimeScale(GAME_VARS.gameManualSlowSpeed || 1);
            this.currTimeoutAmt = null;
        }, dur)
    }

    /** Pause the game until explicitly unpaused. @param {number} [amt=0.002] */
    setPermPause(amt = 0.002) {
        GAME_VARS.permTimeScale = amt;
        this._applyTimeScale(amt);
    }

    /** Restore normal game speed (respects manual slow if active). */
    setUnpause() {
        const speed = GAME_VARS.gameManualSlowSpeed || 1;
        GAME_VARS.permTimeScale = speed;
        this._applyTimeScale(speed);
    }

    /** Set a persistent slow-motion speed. @param {number} amt - timeScale value. */
    setGameSlow(amt) {
        GAME_VARS.gameManualSlowSpeed = amt;
        GAME_VARS.gameManualSlowSpeedInverse = 1 / amt;
        this._applyTimeScale(amt);
    }

    /** Remove slow-motion and restore normal speed. */
    clearGameSlow() {
        GAME_VARS.gameManualSlowSpeed = 1;
        GAME_VARS.gameManualSlowSpeedInverse = 1;
        this._applyTimeScale(1);
    }

}
