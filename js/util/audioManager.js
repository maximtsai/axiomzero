// audioManager.js
const AUDIO_CONSTANTS = {
    LONG_SOUND_THRESHOLD: 3.5,
    FADE_AWAY_DURATION:   650,
    FADE_IN_DURATION:     1000,
    FADE_IN_DELAY:        100,
    MUSIC_START_VOLUME:   0.1,
    DEFAULT_MUSIC_VOLUME: 0.85,
};

let soundList          = {};
let globalVolume       = 1;
let globalMusicVol     = 1;
let globalMusic        = null;
let globalTempMusic    = null;
let lastLongSound      = null;
let lastLongSound2    = null;
let useSecondLongSound = false;
let isMuted            = false;
let isSFXMuted         = localStorage.getItem('sfxMuted')   === 'true';
let isMusicMuted       = localStorage.getItem('musicMuted') === 'true';

const audio = {
    recheckMuteState: function() {
        isSFXMuted   = localStorage.getItem('sfxMuted')   === 'true';
        isMusicMuted = localStorage.getItem('musicMuted') === 'true';
    },

    muteAll: function() {
        isMuted = true;
        if (globalMusic)     globalMusic.setVolume(0);
        if (globalTempMusic) globalTempMusic.setVolume(0);
        if (lastLongSound)   lastLongSound.setVolume(0);
        if (lastLongSound2)  lastLongSound2.setVolume(0);
    },

    unmuteAll: function() {
        isMuted = false;
        if (globalMusic)     globalMusic.volume     = globalMusic.fullVolume     * globalMusicVol;
        if (globalTempMusic) globalTempMusic.volume = globalTempMusic.fullVolume * globalMusicVol;
        if (lastLongSound)   lastLongSound.volume   = lastLongSound.fullVolume   * globalMusicVol;
        if (lastLongSound2)  lastLongSound2.volume  = lastLongSound2.fullVolume  * globalMusicVol;
    },

    muteSFX: function(shouldMute) {
        isSFXMuted = shouldMute;
        localStorage.setItem('sfxMuted', shouldMute.toString());
        for (let i in soundList) {
            if (!soundList[i].isMusic && soundList[i].isPlaying) {
                soundList[i].setVolume(shouldMute ? 0 : soundList[i].fullVolume * globalVolume);
            }
        }
    },

    muteMusic: function(shouldMute) {
        isMusicMuted = shouldMute;
        localStorage.setItem('musicMuted', shouldMute.toString());
        if (shouldMute) {
            if (globalMusic)     globalMusic.setVolume(0);
            if (globalTempMusic) globalTempMusic.setVolume(0);
        } else {
            if (globalMusic)     globalMusic.volume     = globalMusic.fullVolume     * globalMusicVol;
            if (globalTempMusic) globalTempMusic.volume = globalTempMusic.fullVolume * globalMusicVol;
        }
    },

    init: function(scene) {
        globalVolume    = parseFloat(localStorage.getItem('globalVolume'))    || 1;
        globalMusicVol  = parseFloat(localStorage.getItem('globalMusicVol')) || 1;
        isSFXMuted      = localStorage.getItem('sfxMuted')   === 'true';
        isMusicMuted    = localStorage.getItem('musicMuted') === 'true';
    },

    play: function(name, volume = 1, loop = false, isMusic = false) {
        if (!soundList[name]) {
            soundList[name] = PhaserScene.sound.add(name);
        }
        soundList[name].fullVolume = volume;
        soundList[name].volume     = soundList[name].fullVolume * globalVolume;
        soundList[name].loop       = loop;
        soundList[name].isMusic    = isMusic;

        if (soundList[name].currTween) {
            soundList[name].currTween.stop();
            soundList[name].currTween = null;
        }

        if (isMusic) {
            if (globalMusic) audio.fadeAway(globalMusic);
            globalMusic        = soundList[name];
            globalMusic.volume = AUDIO_CONSTANTS.MUSIC_START_VOLUME * volume * globalMusicVol;
            if (isMusicMuted || isMuted) {
                globalMusic.volume = 0;
            } else {
                audio.fadeIn(globalMusic, volume * globalMusicVol);
            }
        }

        if (!isMusic && soundList[name].duration > AUDIO_CONSTANTS.LONG_SOUND_THRESHOLD) {
            if (useSecondLongSound) {
                lastLongSound2 = soundList[name];
            } else {
                lastLongSound  = soundList[name];
            }
            useSecondLongSound = !useSecondLongSound;
        }

        if (isMuted || (!isMusic && isSFXMuted) || (isMusic && isMusicMuted)) {
            soundList[name].volume = 0;
        }

        soundList[name].detune = 0;
        soundList[name].pan    = 0;
        soundList[name].play();
        return soundList[name];
    },

    playMusic: function(name, volume = AUDIO_CONSTANTS.DEFAULT_MUSIC_VOLUME, loop = true) {
        return audio.play(name, volume, loop, true);
    },

    playFakeBGMusic: function(name, volume = 1, loop = false) {
        if (!soundList[name]) {
            soundList[name] = PhaserScene.sound.add(name);
        }
        globalTempMusic = soundList[name];
        soundList[name].fullVolume = volume;
        soundList[name].volume     = soundList[name].fullVolume * globalMusicVol;
        soundList[name].loop       = loop;
        soundList[name].isMusic    = true;

        if (soundList[name].currTween) {
            soundList[name].currTween.stop();
            soundList[name].currTween = null;
        }

        if (isMuted) soundList[name].volume = 0;

        soundList[name].play();
        return soundList[name];
    },

    setVolume: function(newVol = 1) {
        globalVolume = newVol;
        localStorage.setItem('globalVolume', newVol.toString());
        for (let i in soundList) {
            if (soundList[i].isPlaying && soundList[i] !== globalMusic) {
                soundList[i].volume = soundList[i].fullVolume * globalVolume;
            }
        }
    },

    setMusicVolume: function(newVol = 1) {
        globalMusicVol = newVol;
        localStorage.setItem('globalMusicVol', newVol.toString());
        if (globalMusic)     globalMusic.volume     = globalMusic.fullVolume     * newVol;
        if (globalTempMusic) globalTempMusic.volume = globalTempMusic.fullVolume * newVol;
        if (lastLongSound)   lastLongSound.volume   = lastLongSound.fullVolume   * newVol;
        if (lastLongSound2)  lastLongSound2.volume  = lastLongSound2.fullVolume  * newVol;
    },

    setSoundVolume: function(sound, volume = 0, duration) {
        let globalToUse = sound.isMusic ? globalMusicVol : globalVolume;
        sound.fullVolume = volume;
        if (!duration) {
            sound.volume = sound.fullVolume * globalToUse;
        } else {
            PhaserScene.tweens.add({
                targets: sound,
                volume:  sound.fullVolume * globalToUse,
                duration
            });
        }
    },

    swapMusic: function(newMusic, volume = AUDIO_CONSTANTS.DEFAULT_MUSIC_VOLUME, loop = true) {
        if (newMusic !== audio.getMusicName()) {
            globalMusic = audio.playMusic(newMusic, volume, loop);
        }
    },

    getMusicName: function() {
        return globalMusic ? globalMusic.key : '';
    },

    fadeAway: function(sound, duration = AUDIO_CONSTANTS.FADE_AWAY_DURATION, ease, onComplete) {
        const originalVolume = sound.fullVolume;
        sound.fullVolume = 0;
        sound.currTween = PhaserScene.tweens.add({
            targets: sound,
            volume:  0,
            ease,
            duration,
            onComplete: function() {
                sound.stop();
                sound.fullVolume = originalVolume;
                if (onComplete) onComplete();
            }
        });
    },

    fadeIn: function(sound, volume = 1, duration = AUDIO_CONSTANTS.FADE_IN_DURATION) {
        const globalToUse = sound.isMusic ? globalMusicVol : globalVolume;
        return PhaserScene.tweens.add({
            delay:    AUDIO_CONSTANTS.FADE_IN_DELAY,
            targets:  sound,
            volume:   volume * globalToUse,
            duration,
            ease:     'Quad.easeIn'
        });
    }
};
