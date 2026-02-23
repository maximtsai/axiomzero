const config = {
    type: Phaser.AUTO,
    width: GAME_CONSTANTS.WIDTH,
    height: GAME_CONSTANTS.HEIGHT,
    backgroundColor: '#000000',
    scene: MainScene,
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    }
};

class MainScene extends Phaser.Scene {
    constructor() {

    }


    init() {

    }

    preload() {
        let gameDiv = document.getElementById('preload-notice');
        gameDiv.innerHTML = "";
    }

    create() {
        window.PhaserScene = PhaserScene;
        onPreloadComplete(this);
    }

    onPreloadComplete (scene)
    {
        try {
            showHTMLBackground();
            globalObjects.tempBG = scene.add.sprite(0, 0, 'blackPixel').setScale(CONSTANTS.BACKGROUND_SCALE, CONSTANTS.BACKGROUND_SCALE).setDepth(-1);

            setupMouseInteraction(scene);
            setupLoadingBar(scene);

            loadFileList(scene, audioFiles, 'audio');
            loadFileList(scene, imageAtlases, 'atlas');
            loadFileList(scene, imageFiles, 'image');
            loadFileList(scene, fontFiles, 'bitmap_font');
            loadFileList(scene, videoFiles, 'video');

            scene.load.start();
        } catch (error) {
            console.error('Error in onPreloadComplete:', error);
            // Try to continue anyway
            setTimeout(() => {
                onLoadComplete(scene);
            }, CONSTANTS.LARGE_TIMEOUT);
        }
    }

    onLoadComplete(scene) {
        
    }

    update(_time, delta) {

    }
}

function isAllowedRuntimeHost() {
    const host = (window.location.hostname || '').toLowerCase();
    const referrer = (document.referrer || '').toLowerCase();

    const isLocalhost = host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]';
    const isCrazyGamesHost = host === 'crazygames.com' || host.endsWith('.crazygames.com');
    const isItchHost = host.endsWith('.itch.io') || host.endsWith('.itch.zone') || host.endsWith('.hwcdn.net');
    const hasItchReferrer = /https?:\/\/([a-z0-9-]+\.)*itch\.io\//.test(referrer);

    return isLocalhost || isCrazyGamesHost || isItchHost || hasItchReferrer;
}

function onloadFunc() {
}

function applyCrazyGamesMuteSetting(settings) {
    if (!settings || typeof settings.muteAudio !== 'boolean') {
        return;
    }

    if (settings.muteAudio) {
        if (typeof muteAll === 'function') {
            muteAll();
        }
    } else {
        if (typeof unmuteAll === 'function') {
            unmuteAll();
        }
    }
}

async function initSdkSettings() {
    if (typeof sdkInit !== 'function') {
        return;
    }

    try {
        await sdkInit();

        if (typeof sdk.getSettings === 'function') {
            const initialSettings = await sdk.getSettings();
            applyCrazyGamesMuteSetting(initialSettings);
        }

        if (typeof sdk.addSettingsChangeListener === 'function') {
            sdk.addSettingsChangeListener(function(newSettings) {
                applyCrazyGamesMuteSetting(newSettings);
            });
        }
    } catch (error) {
        console.warn('SDK init skipped:', error);
    }
}

if (isAllowedRuntimeHost()) {
    (async function() {
        await initSdkSettings();
        new Phaser.Game(config);
    })();
} else {
    document.body.insertAdjacentHTML('beforeend', '<div style="color:#fff;background:#111;padding:18px 20px;border:1px solid #333;font-family:Comfortaa, sans-serif;max-width:520px;margin:40px auto;text-align:center;">This build is only allowed on localhost, crazygames.com, or itch.io.</div>');
}
