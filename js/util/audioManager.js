// audiomanager
const AUDIO_CONSTANTS = {
    LONG_SOUND_THRESHOLD: 3.5,
    FADE_AWAY_DURATION: 650,
    FADE_IN_DURATION: 1000,
    FADE_IN_DELAY: 100,
    MUSIC_START_VOLUME: 0.1,
    DEFAULT_MUSIC_VOLUME: 0.85,
};

let soundList = {};  // Fixed: Changed from [] to {} since we use string keys
let globalVolume = 1;  // Fixed: Added 'let' declaration
let globalMusicVol = 1;  // Fixed: Added 'let' declaration
let globalMusic = null;
let globalTempMusic = null;
let lastLongSound = null;
let lastLongSound2 = null;
let useSecondLongSound = false;
let isMuted = false;
let isSFXMuted = localStorage.getItem('sfxMuted') === 'true';
let isMusicMuted = localStorage.getItem('musicMuted') === 'true';

function recheckMuteState() {
    isSFXMuted = localStorage.getItem('sfxMuted') === 'true';
    isMusicMuted = localStorage.getItem('musicMuted') === 'true';
}

function muteAll() {
    isMuted = true;
    if (globalMusic) {
        globalMusic.setVolume(0);
    }
    if (globalTempMusic) {
        globalTempMusic.setVolume(0);
    }
    if (lastLongSound) {
        lastLongSound.setVolume(0);
    }
    if (lastLongSound2) {
        lastLongSound2.setVolume(0);
    }
}

function unmuteAll() {
    isMuted = false;
    if (globalMusic) {
        globalMusic.volume = globalMusic.fullVolume * globalMusicVol;
    }
    if (globalTempMusic) {
        globalTempMusic.volume = globalTempMusic.fullVolume * globalMusicVol;
    }
    if (lastLongSound) {
        lastLongSound.volume = lastLongSound.fullVolume * globalMusicVol;
    }
    if (lastLongSound2) {
        lastLongSound2.volume = lastLongSound2.fullVolume * globalMusicVol;
    }
}

function muteSFX(shouldMute) {
    isSFXMuted = shouldMute;
    localStorage.setItem('sfxMuted', shouldMute.toString());

    if (shouldMute) {
        // Mute all non-music sounds
        for (let i in soundList) {
            if (!soundList[i].isMusic && soundList[i].isPlaying) {
                soundList[i].setVolume(0);
            }
        }
    } else {
        // Restore volume for all non-music sounds
        for (let i in soundList) {
            if (!soundList[i].isMusic && soundList[i].isPlaying) {
                soundList[i].volume = soundList[i].fullVolume * globalVolume;
            }
        }
    }
}

function muteMusic(shouldMute) {
    isMusicMuted = shouldMute;
    localStorage.setItem('musicMuted', shouldMute.toString());

    if (shouldMute) {
        if (globalMusic) {
            globalMusic.setVolume(0);
        }
        if (globalTempMusic) {
            globalTempMusic.setVolume(0);
        }
    } else {
        if (globalMusic) {
            globalMusic.volume = globalMusic.fullVolume * globalMusicVol;
        }
        if (globalTempMusic) {
            globalTempMusic.volume = globalTempMusic.fullVolume * globalMusicVol;
        }
    }
}

function initializeSounds(scene) {
    globalVolume = sdkGetItem("globalVolume") || 1;
    globalMusicVol = sdkGetItem("globalMusicVol") || 1;

    // Initialize mute states from localStorage
    isSFXMuted = localStorage.getItem('sfxMuted') === 'true';
    isMusicMuted = localStorage.getItem('musicMuted') === 'true';
}

function playSound(name, volume = 1, loop = false, isMusic = false) {
    if (!soundList[name]) {
        soundList[name] = PhaserScene.sound.add(name);
    }

    soundList[name].fullVolume = volume;
    soundList[name].volume = soundList[name].fullVolume * globalVolume;
    soundList[name].loop = loop;
    soundList[name].isMusic = isMusic;

    if (soundList[name].currTween) {
        soundList[name].currTween.stop();
        soundList[name].currTween = null;
    }

    if (isMusic) {
        if (globalMusic) {
            fadeAwaySound(globalMusic);  // Fixed: Removed unnecessary temp variable
        }
        globalMusic = soundList[name];
        globalMusic.volume = AUDIO_CONSTANTS.MUSIC_START_VOLUME * volume * globalMusicVol;
        if (isMusicMuted || isMuted) {
            globalMusic.volume = 0;
        } else {
            fadeInSound(globalMusic, volume * globalMusicVol);
        }
    }

    if (!isMusic && soundList[name].duration > AUDIO_CONSTANTS.LONG_SOUND_THRESHOLD) {
        if (useSecondLongSound) {
            lastLongSound2 = soundList[name];
        } else {
            lastLongSound = soundList[name];
        }
        useSecondLongSound = !useSecondLongSound;
    }

    if (isMuted || (!isMusic && isSFXMuted) || (isMusic && isMusicMuted)) {
        soundList[name].volume = 0;
    }

    soundList[name].detune = 0;
    soundList[name].pan = 0;
    soundList[name].play();
    return soundList[name];
}

function playMusic(name, volume = AUDIO_CONSTANTS.DEFAULT_MUSIC_VOLUME, loop = true) {
    return playSound(name, volume, loop, true);  // Fixed: Removed 'this.' - it was undefined
}

function playFakeBGMusic(name, volume = 1, loop = false) {
    if (!soundList[name]) {
        soundList[name] = PhaserScene.sound.add(name);
    }
    globalTempMusic = soundList[name];

    soundList[name].fullVolume = volume;
    soundList[name].volume = soundList[name].fullVolume * globalMusicVol;
    soundList[name].loop = loop;

    if (soundList[name].currTween) {
        soundList[name].currTween.stop();
        soundList[name].currTween = null;
    }

    if (isMuted) {
        soundList[name].volume = 0;
    }

    soundList[name].isMusic = true;
    soundList[name].play();
    return soundList[name];
}

function updateGlobalVolume(newVol = 1) {
    globalVolume = newVol;
    sdkSetItem("globalVolume", newVol.toString());  // Fixed: Added semicolon

    for (let i in soundList) {
        if (soundList[i].isPlaying) {
            if (soundList[i] !== globalMusic) {
                soundList[i].volume = soundList[i].fullVolume * globalVolume;
            }
        }
    }
}

function updateGlobalMusicVolume(newVol = 1) {
    globalMusicVol = newVol;
    sdkSetItem("globalMusicVol", newVol.toString());  // Fixed: Added semicolon

    if (globalMusic) {
        globalMusic.volume = globalMusic.fullVolume * newVol;
    }

    if (globalTempMusic) {
        globalTempMusic.volume = globalTempMusic.fullVolume * newVol;  // Fixed: Now correctly applies fullVolume multiplier
    }

    // Fixed: Added null checks for lastLongSound variables
    if (lastLongSound) {
        lastLongSound.volume = lastLongSound.fullVolume * newVol;
    }

    if (lastLongSound2) {
        lastLongSound2.volume = lastLongSound2.fullVolume * newVol;
    }
}

function setVolume(sound, volume = 0, duration) {
    let globalToUse = sound.isMusic ? globalMusicVol : globalVolume;
    sound.fullVolume = volume;

    if (!duration) {
        sound.volume = sound.fullVolume * globalToUse;
    } else {
        PhaserScene.tweens.add({
            targets: sound,
            volume: sound.fullVolume * globalToUse,
            duration: duration
        });
    }
}

function swapMusic(newMusic, volume = AUDIO_CONSTANTS.DEFAULT_MUSIC_VOLUME, loop = true) {
    let name = getGlobalMusicName();
    if (newMusic !== name) {
        globalMusic = playMusic(newMusic, volume, loop);
    }
}

function getGlobalMusicName() {
    if (globalMusic) {
        return globalMusic.key;
    } else {
        return "";
    }
}

function fadeAwayMusic(duration = AUDIO_CONSTANTS.FADE_AWAY_DURATION, ease, onComplete) {
    let sound = globalMusic;
    const originalVolume = sound.fullVolume;  // Fixed: Store original volume before modifying
    sound.fullVolume = 0;

    sound.currTween = PhaserScene.tweens.add({
        targets: sound,
        volume: sound.fullVolume,
        ease: ease,
        duration: duration,
        onComplete: () => {
            sound.stop();
            sound.fullVolume = originalVolume;  // Fixed: Restore original volume after fade
            if (onComplete) {
                onComplete();
            }
        }
    });
}

function fadeAwaySound(sound, duration = AUDIO_CONSTANTS.FADE_AWAY_DURATION, ease, onComplete) {
    const originalVolume = sound.fullVolume;  // Fixed: Store original volume before modifying
    sound.fullVolume = 0;

    sound.currTween = PhaserScene.tweens.add({
        targets: sound,
        volume: sound.fullVolume,
        ease: ease,
        duration: duration,
        onComplete: () => {
            sound.stop();
            sound.fullVolume = originalVolume;  // Fixed: Restore original volume after fade
            if (onComplete) {
                onComplete();
            }
        }
    });
}

function fadeInSound(sound, volume = 1, duration = AUDIO_CONSTANTS.FADE_IN_DURATION) {
    let globalToUse = sound.isMusic ? globalMusicVol : globalVolume;
    let goalVol = volume * globalToUse;

    return PhaserScene.tweens.add({
        delay: AUDIO_CONSTANTS.FADE_IN_DELAY,
        targets: sound,
        volume: goalVol,
        duration: duration,
        ease: 'Quad.easeIn'
    });
}
