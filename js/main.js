// ─── Game startup ───────────────────────────────────────────────────────────

console.log('%c Axiom Zero ' + GAME_CONSTANTS.VERSION + ' ', 'background: #222; color: #bada55; font-size: 14px; padding: 5px 10px;');

class MainScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MainScene' });
    }

    preload() {
        try {
            loadingScreen.preload(this);
        } catch (error) {
            console.error('[MainScene] preload error:', error);
        }
    }

    create() {
        try {
            window.PhaserScene = this;
            helper.initClickEffectPool(this);
            setupMouseInteraction(this);
            initDebug(this);
            loadingScreen.create(this);
            this.load.start();
        } catch (error) {
            console.error('[MainScene] create error:', error);
        }
    }

    update(_time, delta) {
        try {
            updateManager.update(delta);
            buttonManager.update(delta);
        } catch (error) {
            console.error('[MainScene] update error:', error);
        }
    }
}

// ─── Game config ─────────────────────────────────────────────────────────────

const config = {
    type: Phaser.AUTO,
    width: GAME_CONSTANTS.WIDTH,
    height: GAME_CONSTANTS.HEIGHT,
    backgroundColor: '#000000',
    scene: MainScene,
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        forceOrientation: true,
        orientation: Phaser.Scale.Orientation.LANDSCAPE
    },
    plugins: {
        global: [{
            key: 'rexBBCodeTextPlugin',
            plugin: window.rexbbcodetextplugin,
            start: true
        }]
    }
};

// ─── Global Ad Hooks ──────────────────────────────────────────────────────────

window.pauseGameForAd = function () {
    console.log('[Ad Break] Pausing game and audio...');
    if (typeof PhaserScene !== 'undefined') {
        PhaserScene.scene.pause();
    }
    if (typeof audio !== 'undefined') {
        audio.pauseAll();
    }
};

window.resumeGameFromAd = function () {
    console.log('[Ad Break] Resuming game and audio...');
    if (typeof PhaserScene !== 'undefined') {
        PhaserScene.scene.resume();
    }
    if (typeof audio !== 'undefined') {
        audio.resumeAll();
    }
};

// ─── Host guard ───────────────────────────────────────────────────────────────

function isAllowedRuntimeHost() {
    const host = (window.location.hostname || '').toLowerCase();
    const referrer = (document.referrer || '').toLowerCase();

    const isLocalhost = host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]';
    const isCrazyGamesHost = host === 'crazygames.com' || host.endsWith('.crazygames.com');
    const isItchHost = host.endsWith('.itch.io') || host.endsWith('.itch.zone') || host.endsWith('.hwcdn.net');
    const isPersonalHost = host === 'maximtsai.com' || host.endsWith('.maximtsai.com');

    return isLocalhost || isCrazyGamesHost || isItchHost || isPersonalHost;
}

function applyCrazyGamesMuteSetting(settings) {
    if (!settings || typeof settings.muteAudio !== 'boolean') return;
    if (settings.muteAudio) {
        audio.muteAll();
    } else {
        audio.unmuteAll();
    }
}

async function initSdkSettings() {
    if (typeof sdkInit !== 'function') return;
    try {
        await sdkInit();
        if (typeof sdk.getSettings === 'function') {
            const initialSettings = await sdk.getSettings();
            applyCrazyGamesMuteSetting(initialSettings);
        }
        if (typeof sdk.addSettingsChangeListener === 'function') {
            sdk.addSettingsChangeListener(newSettings => {
                applyCrazyGamesMuteSetting(newSettings);
            });
        }
    } catch (error) {
        console.warn('SDK init skipped:', error);
    }
}

if (isAllowedRuntimeHost()) {
    (async function () {
        if (FLAGS.USING_CRAZYGAMES_SDK) {
            await initSdkSettings();
        }
        new Phaser.Game(config);
    })();
} else {
    document.body.insertAdjacentHTML('beforeend',
        '<div style="color:#fff;background:#111;padding:18px 20px;border:1px solid #333;' +
        'font-family:Comfortaa,sans-serif;max-width:520px;margin:-10px auto 40px auto;text-align:center;">' +
        'This build is only allowed on localhost, maximtsai.com, or itch.io.</div>'
    );
}
