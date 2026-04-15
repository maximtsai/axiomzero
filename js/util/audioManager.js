/**
 * @fileoverview Sound and music management singleton.
 * All audio functions live on the `audio` namespace object.
 * Settings (mute state, volumes) persist via gameState.
 *
 * Depends on: PhaserScene (global), gameState
 * @module audioManager
 */

const AUDIO_CONSTANTS = {
    LONG_SOUND_THRESHOLD: 3.5,
    FADE_AWAY_DURATION: 650,
    FADE_IN_DURATION: 1000,
    FADE_IN_DELAY: 100,
    MUSIC_START_VOLUME: 0.1,
    DEFAULT_MUSIC_VOLUME: 0.85,
};

let soundList = {};
let globalVolume = 1;
let globalMusicVol = 1;
let globalMusic = null;
let globalTempMusic = null;
let lastLongSound = null;
let lastLongSound2 = null;
let useSecondLongSound = false;
let isMuted = false;
let isSFXMuted = false;
let isMusicMuted = false;
let filterNode = null;

const audio = {
    /** Re-read mute flags from gameState (call after external settings change). */
    recheckMuteState: function () {
        isSFXMuted = gameState.settings.sfxMuted;
        isMusicMuted = gameState.settings.musicMuted;
    },

    /** Mute all audio (music + SFX). */
    muteAll: function () {
        isMuted = true;
        if (globalMusic) globalMusic.setVolume(0);
        if (globalTempMusic) globalTempMusic.setVolume(0);
        if (lastLongSound) lastLongSound.setVolume(0);
        if (lastLongSound2) lastLongSound2.setVolume(0);
    },

    /** Unmute all audio, restoring previous volumes. */
    unmuteAll: function () {
        isMuted = false;
        if (globalMusic) globalMusic.volume = globalMusic.fullVolume * globalMusicVol;
        if (globalTempMusic) globalTempMusic.volume = globalTempMusic.fullVolume * globalMusicVol;
        if (lastLongSound) lastLongSound.volume = lastLongSound.fullVolume * globalMusicVol;
        if (lastLongSound2) lastLongSound2.volume = lastLongSound2.fullVolume * globalMusicVol;
    },

    /** Pause all currently playing audio (for ad breaks). Does not alter mute state. */
    pauseAll: function () {
        if (typeof PhaserScene !== 'undefined' && PhaserScene.sound) {
            PhaserScene.sound.pauseAll();
        }
    },

    /** Resume all audio paused by pauseAll. */
    resumeAll: function () {
        if (typeof PhaserScene !== 'undefined' && PhaserScene.sound) {
            PhaserScene.sound.resumeAll();
            // Reapply mute states just in case resumeAll overrides volume to 1
            if (isMuted || isMusicMuted) {
                if (globalMusic) globalMusic.setVolume(0);
                if (globalTempMusic) globalTempMusic.setVolume(0);
            }
        }
    },

    /** @param {boolean} shouldMute - Mute/unmute SFX; persists to gameState. */
    muteSFX: function (shouldMute) {
        isSFXMuted = shouldMute;
        gameState.settings.sfxMuted = shouldMute;
        saveGame();
        for (let i in soundList) {
            if (!soundList[i].isMusic && soundList[i].isPlaying) {
                soundList[i].setVolume(shouldMute ? 0 : soundList[i].fullVolume * globalVolume);
            }
        }
    },

    /** @param {boolean} shouldMute - Mute/unmute music; persists to gameState. */
    muteMusic: function (shouldMute) {
        isMusicMuted = shouldMute;
        gameState.settings.musicMuted = shouldMute;
        saveGame();
        if (shouldMute) {
            if (globalMusic) globalMusic.setVolume(0);
            if (globalTempMusic) globalTempMusic.setVolume(0);
        } else {
            if (globalMusic) globalMusic.volume = globalMusic.fullVolume * globalMusicVol;
            if (globalTempMusic) globalTempMusic.volume = globalTempMusic.fullVolume * globalMusicVol;
        }
    },

    /** Initialize audio system — reads persisted volume/mute settings from gameState. */
    init: function (scene) {
        globalVolume = gameState.settings.globalVolume;
        globalMusicVol = gameState.settings.globalMusicVol;
        isSFXMuted = gameState.settings.sfxMuted;
        isMusicMuted = gameState.settings.musicMuted;

        // Initialize Low-Pass Filter (Disabled for testing)
        /*
        if (PhaserScene.sound.context && !filterNode) {
            filterNode = PhaserScene.sound.context.createBiquadFilter();
            filterNode.type = 'lowpass';
            filterNode.frequency.value = 22000;
            filterNode.connect(PhaserScene.sound.context.destination);
        }
        */
    },
    /**
     * Play a sound or music track. Auto-creates the Phaser sound if needed.
     * @param {string} name - Asset key.
     * @param {number} [volume=1]
     * @param {boolean} [loop=false]
     * @param {boolean} [isMusic=false] - If true, becomes the global music track.
     * @param {number} [pan=0] - Stereo pan (-1.0 to 1.0).
     * @returns {Phaser.Sound.BaseSound}
     */
    play: function (name, volume = 1, loop = false, isMusic = false, pan = 0) {
        if (!soundList[name]) {
            soundList[name] = PhaserScene.sound.add(name);
        }
        const s = soundList[name];
        s.fullVolume = volume;
        s.volume = s.fullVolume * (isMusic ? globalMusicVol : globalVolume);
        s.loop = loop;
        s.isMusic = isMusic;

        if (s.currTween) {
            s.currTween.stop();
            s.currTween = null;
        }

        if (isMusic) {
            if (globalMusic) audio.fadeAway(globalMusic);
            globalMusic = s;
            globalMusic.volume = AUDIO_CONSTANTS.MUSIC_START_VOLUME * volume * globalMusicVol;
            if (isMusicMuted || isMuted) {
                globalMusic.volume = 0;
            } else {
                audio.fadeIn(globalMusic, volume);
            }
        }

        if (!isMusic && s.duration > AUDIO_CONSTANTS.LONG_SOUND_THRESHOLD) {
            if (useSecondLongSound) {
                lastLongSound2 = s;
            } else {
                lastLongSound = s;
            }
            useSecondLongSound = !useSecondLongSound;
        }

        if (isMuted || (!isMusic && isSFXMuted) || (isMusic && isMusicMuted)) {
            s.volume = 0;
        }

        s.pan = pan;

        // Route music through the low-pass filter if active (Disabled for testing)
        /*
        if (s.isMusic && filterNode) {
            s.on('play', () => {
                if (s.source) {
                    s.source.disconnect();
                    s.source.connect(filterNode);
                }
            });
        }
        */

        s.play();
        return s;
    },

    /** Shorthand for play() with isMusic=true. */
    playMusic: function (name, volume = AUDIO_CONSTANTS.DEFAULT_MUSIC_VOLUME, loop = true) {
        return audio.play(name, volume, loop, true);
    },

    /** Play a temporary background track (not tracked as globalMusic). */
    playFakeBGMusic: function (name, volume = 1, loop = false) {
        if (!soundList[name]) {
            soundList[name] = PhaserScene.sound.add(name);
        }
        const s = soundList[name];
        globalTempMusic = s;
        s.fullVolume = volume;
        s.volume = s.fullVolume * globalMusicVol;
        s.loop = loop;
        s.isMusic = true;

        if (s.currTween) {
            s.currTween.stop();
            s.currTween = null;
        }

        if (isMuted || (s.isMusic && isMusicMuted)) s.volume = 0;

        s.stop();
        s.play();
        return s;
    },

    /** Set global SFX volume (0–1). Persists to gameState. */
    setVolume: function (newVol = 1) {
        globalVolume = newVol;
        gameState.settings.globalVolume = newVol;
        saveGame();
        for (let i in soundList) {
            if (soundList[i].isPlaying && !soundList[i].isMusic) {
                soundList[i].volume = soundList[i].fullVolume * globalVolume;
            }
        }
    },

    /** Set global music volume (0–1). Persists to gameState. */
    setMusicVolume: function (newVol = 1) {
        globalMusicVol = newVol;
        gameState.settings.globalMusicVol = newVol;
        saveGame();
        // Cancel any active fade tweens before overriding volume, so they
        // don't race against and undo the value we are about to set.
        if (globalMusic) {
            if (globalMusic.currTween) {
                globalMusic.currTween.stop();
                globalMusic.currTween = null;
            }
            globalMusic.volume = globalMusic.fullVolume * newVol;
        }
        if (globalTempMusic) {
            if (globalTempMusic.currTween) {
                globalTempMusic.currTween.stop();
                globalTempMusic.currTween = null;
            }
            globalTempMusic.volume = globalTempMusic.fullVolume * newVol;
        }
        if (lastLongSound) lastLongSound.volume = lastLongSound.fullVolume * newVol;
        if (lastLongSound2) lastLongSound2.volume = lastLongSound2.fullVolume * newVol;
    },

    /** Set volume on a specific sound, optionally tweened over duration (ms). */
    setSoundVolume: function (sound, volume = 0, duration) {
        let globalToUse = sound.isMusic ? globalMusicVol : globalVolume;
        sound.fullVolume = volume;

        let targetVolume = sound.fullVolume * globalToUse;
        if (isMuted || (sound.isMusic && isMusicMuted) || (!sound.isMusic && isSFXMuted)) {
            targetVolume = 0;
        }

        if (!duration) {
            sound.volume = targetVolume;
        } else {
            PhaserScene.tweens.add({
                targets: sound,
                volume: targetVolume,
                duration
            });
        }
    },

    /**
     * Executes a complex audio transition (e.g., boss music swap).
     * @param {Object} config - Transition parameters.
     */
    playComplexTransition: function (config) {
        if (!config || isMuted || (config.isMusic !== false && isMusicMuted)) return;

        // 1. Fade out current music
        if (globalMusic) {
            audio.fadeAway(globalMusic, config.fadeOutDuration || 1000, config.fadeOutEase || 'Linear');
        }

        // 2. Start new track after delay
        PhaserScene.time.delayedCall(config.fadeInDelay || 0, () => {
            globalTempMusic = audio.playFakeBGMusic(config.assetKey, 0.01, config.loop !== false);
            audio.setSoundVolume(globalTempMusic, config.targetVolume || AUDIO_CONSTANTS.DEFAULT_MUSIC_VOLUME, config.fadeInDuration || 1000);
        });
    },

    /**
     * Stops a complex transition and restores background music.
     * @param {Object} config - Restore parameters.
     */
    stopComplexTransition: function (config) {
        if (!globalTempMusic) return;

        // 1. Fade out the temporary track
        audio.fadeAway(globalTempMusic, config.fadeOutDuration || 750, config.fadeOutEase || 'Linear', () => {
            globalTempMusic = null;
        });

        // 2. Restore main music
        if (globalMusic && !isMuted && !isMusicMuted) {
            if (globalMusic.currTween) {
                globalMusic.currTween.stop();
                globalMusic.currTween = null;
            }
            globalMusic.stop();
            globalMusic.play();

            globalMusic.fullVolume = 0.01;
            globalMusic.volume = 0.01 * globalMusicVol;

            PhaserScene.time.delayedCall(config.restoreDelay || 300, () => {
                audio.setSoundVolume(globalMusic, config.targetVolume || AUDIO_CONSTANTS.DEFAULT_MUSIC_VOLUME, config.restoreDuration || 600);
            });
        }
    },

    /** Cross-fade to a new music track (no-ops if already playing). */
    swapMusic: function (newMusic, volume = AUDIO_CONSTANTS.DEFAULT_MUSIC_VOLUME, loop = true) {
        if (newMusic !== audio.getMusicName()) {
            globalMusic = audio.playMusic(newMusic, volume, loop);
        }
    },

    /** @returns {string} Asset key of the current music track, or ''. */
    getMusicName: function () {
        return globalMusic ? globalMusic.key : '';
    },

    /** Fade a sound to silence and stop it. */
    fadeAway: function (sound, duration = AUDIO_CONSTANTS.FADE_AWAY_DURATION, ease, onComplete) {
        const originalVolume = sound.fullVolume;
        sound.fullVolume = 0;
        sound.currTween = PhaserScene.tweens.add({
            targets: sound,
            volume: 0,
            ease,
            duration,
            onComplete: function () {
                sound.stop();
                sound.fullVolume = originalVolume;
                if (onComplete) onComplete();
            }
        });
    },

    /** Fade a sound in from current volume to target volume. */
    fadeIn: function (sound, volume = 1, duration = AUDIO_CONSTANTS.FADE_IN_DURATION) {
        const globalToUse = sound.isMusic ? globalMusicVol : globalVolume;
        // Stop any in-flight tween so this one becomes the authoritative fade.
        if (sound.currTween) {
            sound.currTween.stop();
            sound.currTween = null;
        }
        sound.currTween = PhaserScene.tweens.add({
            delay: AUDIO_CONSTANTS.FADE_IN_DELAY,
            targets: sound,
            volume: volume * globalToUse,
            duration,
            ease: 'Quad.easeIn',
            onComplete: () => { sound.currTween = null; }
        });
        return sound.currTween;
    },

    /**
     * Smoothly transitions the music low-pass filter frequency.
     * @param {number} freq - Cutoff frequency in Hz (e.g. 600 for muffled, 22000 for full).
     * @param {number} [duration=500] - Transition duration in ms.
     */
    setLowPass: function (freq, duration = 500) {
        // Disabled for testing
    }
};
