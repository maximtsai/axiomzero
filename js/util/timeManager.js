/**
 * @fileoverview Controls passage of game time via GAME_VARS.timeScale.
 * Subscribes to messageBus topics: tempPause, pauseGame, setGameSlow, clearGameSlow, unpauseGame,
 * gamePaused, gameResumed.
 * @module timeManager
 */
class TimeManager {
    constructor() {
        messageBus.subscribe("tempPause", this.setTempPause.bind(this));
        messageBus.subscribe("pauseGame", this.setPermPause.bind(this));
        messageBus.subscribe("setGameSlow", this.setGameSlow.bind(this));
        messageBus.subscribe("clearGameSlow", this.clearGameSlow.bind(this));
        messageBus.subscribe("unpauseGame", this.setUnpause.bind(this));
        messageBus.subscribe("gamePaused", this.freezeWorld.bind(this));
        messageBus.subscribe("gameResumed", this.unfreezeWorld.bind(this));
        this._frozen = null;
        this._slows = new Set();
    }

    /**
     * Freeze every tween, timer event and sprite animation that is running right now.
     * Managers stop their own update loops on 'gamePaused', but boss attack chains,
     * delayed hits and effects run on Phaser tweens/timers and would keep going.
     * Anything created while frozen (the pause menu itself) runs normally.
     */
    freezeWorld() {
        if (this._frozen || typeof PhaserScene === 'undefined') return;
        const tweens = PhaserScene.tweens.getTweens().filter(tw => !tw.paused);
        tweens.forEach(tw => tw.pause());

        const clock = PhaserScene.time;
        const events = [...(clock._active || []), ...(clock._pendingInsertion || [])].filter(ev => !ev.paused);
        events.forEach(ev => { ev.paused = true; });

        PhaserScene.anims.pauseAll();
        this._frozen = { tweens, events };
        // Everything running is paused, so the pause menu can run at normal speed even if a
        // slow-mo (e.g. the boss-death ramp) was active. _applySlows restores it on resume.
        this.applyTimeScale(1);
    }

    /** Resume exactly what freezeWorld() paused. */
    unfreezeWorld() {
        if (!this._frozen) return;
        this._frozen.tweens.forEach(tw => {
            if (!(tw.isDestroyed && tw.isDestroyed())) tw.resume();
        });
        this._frozen.events.forEach(ev => { ev.paused = false; });
        PhaserScene.anims.resumeAll();
        this._frozen = null;
        this._applySlows();
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
     * @param {number} [dur=100] - Duration in ms (real time).
     * @param {number} [magnitude] - timeScale during the slow-down (default 0.5).
     */
    setTempPause(dur = 100, magnitude) {
        this.slowFor(dur, magnitude || 0.5);
    }

    // ── Slow-motion requests ─────────────────────────────────────────────
    // Effects request slow-motion here instead of writing the time scale themselves, so
    // overlapping effects (bomb blast, artillery impact, hitstop, boss death) can't end each
    // other's slow-mo early: the slowest active request wins until it ends.

    /**
     * Start an open-ended slow-mo. Pass the returned handle to endSlow().
     * @param {number} scale - timeScale while active.
     * @param {boolean} [applyToTweens=true] - false keeps tweens at normal speed (explosions stay fluid).
     */
    beginSlow(scale, applyToTweens = true) {
        const req = { scale, applyToTweens };
        this._slows.add(req);
        this._applySlows();
        return req;
    }

    /** End a slow-mo started with beginSlow(). Safe to call twice or with null. */
    endSlow(req) {
        if (req && this._slows.delete(req)) this._applySlows();
    }

    /** Slow-mo for `dur` ms of real time. */
    slowFor(dur, scale, applyToTweens = true) {
        const req = this.beginSlow(scale, applyToTweens);
        setTimeout(() => this.endSlow(req), dur);
        return req;
    }

    /** Slow-mo that eases back to normal speed over `duration` ms (boss death). */
    slowRamp(fromScale, duration, ease = 'Linear') {
        const req = this.beginSlow(fromScale);
        PhaserScene.tweens.add({
            targets: req,
            scale: 1,
            duration,
            ease,
            onUpdate: () => this._applySlows(),
            onComplete: () => this.endSlow(req),
        });
        return req;
    }

    /** Drop every slow-mo request (phase changes, results screen). */
    clearSlows() {
        this._slows.clear();
        this._applySlows();
    }

    _applySlows() {
        if (this._frozen) return; // paused: normal speed for the menu; re-applied on resume
        const base = GAME_VARS.gameManualSlowSpeed || 1;
        let scale = base;
        let tweenScale = base;
        this._slows.forEach(req => {
            if (req.scale < scale) scale = req.scale;
            if (req.applyToTweens && req.scale < tweenScale) tweenScale = req.scale;
        });
        this.applyTimeScale(scale, false);
        if (typeof PhaserScene !== 'undefined' && PhaserScene.tweens) PhaserScene.tweens.timeScale = tweenScale;
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
        this._applySlows();
    }

    /** Remove slow-motion and restore normal speed. */
    clearGameSlow() {
        GAME_VARS.gameManualSlowSpeed = 1;
        GAME_VARS.gameManualSlowSpeedInverse = 1;
        this._applySlows();
    }


}

const timeManager = new TimeManager();
