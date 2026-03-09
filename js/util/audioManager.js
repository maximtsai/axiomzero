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
    },

    /**
     * Play a sound or music track. Auto-creates the Phaser sound if needed.
     * @param {string} name - Asset key.
     * @param {number} [volume=1]
     * @param {boolean} [loop=false]
     * @param {boolean} [isMusic=false] - If true, becomes the global music track.
     * @returns {Phaser.Sound.BaseSound}
     */
    play: function (name, volume = 1, loop = false, isMusic = false) {
        if (!soundList[name]) {
            soundList[name] = PhaserScene.sound.add(name);
        }
        const s = soundList[name];
        s.fullVolume = volume;
        s.volume = s.fullVolume * globalVolume;
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
                audio.fadeIn(globalMusic, volume * globalMusicVol);
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

        s.detune = 0;
        s.pan = 0;
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

        if (isMuted) s.volume = 0;

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
            if (soundList[i].isPlaying && soundList[i] !== globalMusic) {
                soundList[i].volume = soundList[i].fullVolume * globalVolume;
            }
        }
    },

    /** Set global music volume (0–1). Persists to gameState. */
    setMusicVolume: function (newVol = 1) {
        globalMusicVol = newVol;
        gameState.settings.globalMusicVol = newVol;
        saveGame();
        if (globalMusic) globalMusic.volume = globalMusic.fullVolume * newVol;
        if (globalTempMusic) globalTempMusic.volume = globalTempMusic.fullVolume * newVol;
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

    /** Starts the boss music, fading out the main music concurrently. */
    playBossMusic: function (bossMusicName = 'boss_music') {
        if (!globalMusic || isMuted || isMusicMuted) return;

        // Fade out main background music over 1.2 seconds and stop it
        audio.fadeAway(globalMusic, 1200, 'Linear');

        // Start boss music loop at 0.01 volume and fade it in over 1 seconds after a 0.75 second delay
        globalTempMusic = audio.playFakeBGMusic(bossMusicName, 0.01, true);
        PhaserScene.time.delayedCall(800, () => {
            audio.setSoundVolume(globalTempMusic, AUDIO_CONSTANTS.DEFAULT_MUSIC_VOLUME, 800);
        });
    },

    /** Stops the boss music and fades the main background music back in. */
    stopBossMusic: function () {
        if (!globalTempMusic) return;

        // Fade out boss music over 0.75 seconds then stop
        audio.fadeAway(globalTempMusic, 750, 'Linear', () => {
            globalTempMusic = null;
        });

        if (globalMusic && !isMuted && !isMusicMuted) {
            if (globalMusic.currTween) {
                globalMusic.currTween.stop();
                globalMusic.currTween = null;
            }
            globalMusic.stop();
            globalMusic.play();
            // Bring back bg_music1 from 0.01 to full over 0.6 seconds
            globalMusic.fullVolume = 0.01;
            globalMusic.volume = 0.01 * globalMusicVol;
            PhaserScene.time.delayedCall(300, () => {
                audio.setSoundVolume(globalMusic, AUDIO_CONSTANTS.DEFAULT_MUSIC_VOLUME, 600);
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
        return PhaserScene.tweens.add({
            delay: AUDIO_CONSTANTS.FADE_IN_DELAY,
            targets: sound,
            volume: volume * globalToUse,
            duration,
            ease: 'Quad.easeIn'
        });
    }
};
