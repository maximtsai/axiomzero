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
    applyTimeScale(val, applyToTweens = true) {
        GAME_VARS.timeScale = val;
        if (applyToTweens) {
            PhaserScene.tweens.timeScale = val;
        }
        PhaserScene.time.timeScale = val;
        PhaserScene.anims.globalTimeScale = val;
    }

    /**
     * Briefly slow game time, then auto-restore.
     * @param {number} [dur=100] - Pause duration in ms.
     * @param {number} [magnitude] - timeScale during pause (default 0.5).
     */
    setTempPause(dur = 100, magnitude) {
        this.applyTimeScale(magnitude || 0.5);
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
            this.applyTimeScale(GAME_VARS.gameManualSlowSpeed || 1);
            this.currTimeoutAmt = null;
        }, dur)
    }

    /** Pause the game until explicitly unpaused. @param {number} [amt=0.002] */
    setPermPause(amt = 0.002) {
        GAME_VARS.permTimeScale = amt;
        this.applyTimeScale(amt);
    }

    /** Restore normal game speed (respects manual slow if active). */
    setUnpause() {
        const speed = GAME_VARS.gameManualSlowSpeed || 1;
        GAME_VARS.permTimeScale = speed;
        this.applyTimeScale(speed);
    }

    /** Set a persistent slow-motion speed. @param {number} amt - timeScale value. */
    setGameSlow(amt) {
        GAME_VARS.gameManualSlowSpeed = amt;
        GAME_VARS.gameManualSlowSpeedInverse = 1 / amt;
        this.applyTimeScale(amt);
    }

    /** Remove slow-motion and restore normal speed. */
    clearGameSlow() {
        GAME_VARS.gameManualSlowSpeed = 1;
        GAME_VARS.gameManualSlowSpeedInverse = 1;
        this.applyTimeScale(1);
    }

    /**
     * Tween the game timeScale to a target value.
     * @param {number} targetScale - Target timeScale value.
     * @param {number} duration - Duration in ms.
     * @param {string} [ease='Linear'] - Easing function.
     * @param {boolean} [applyToTweens=true] - Whether to apply scaling to Phaser tweens.
     * @param {function} [onComplete] - Callback on finish.
     */
    tweenTimeScale(targetScale, duration, ease = 'Linear', applyToTweens = true, onComplete = null) {
        // Kill any existing timeScale tweens on GAME_VARS to prevent clashing
        if (PhaserScene.tweens) {
            PhaserScene.tweens.killTweensOf(GAME_VARS, 'timeScale');
        }

        PhaserScene.tweens.add({
            targets: GAME_VARS,
            timeScale: targetScale,
            duration,
            ease,
            onUpdate: () => {
                this.applyTimeScale(GAME_VARS.timeScale, applyToTweens);
            },
            onComplete: () => {
                this.applyTimeScale(targetScale, applyToTweens);
                if (onComplete) onComplete();
            }
        });
    }

}

const timeManager = new TimeManager();
