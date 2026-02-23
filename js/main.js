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
        super({ key: 'MainScene' });
    }

    // ─── Phase 1: preload ────────────────────────────────────────────────────
    // Load only the images needed to build the loading-screen UI.
    // All other assets are loaded in create() via loadingManager.

    preload() {
        const notice = document.getElementById('preload-notice');
        if (notice) notice.innerHTML = '';

        // Load preload images (white_pixel, black_pixel, bg)
        imageFilesPreload.forEach(f => {
            this.load.image(f.name, 'assets/' + f.src);
        });

        // Stall detection for the initial preload phase
        loadingManager.setupInitialPreload(this, notice);
    }

    // ─── Phase 2: create ─────────────────────────────────────────────────────

    create() {
        // Expose scene globally so utilities can reference it
        window.PhaserScene = this;

        // Build the loading-screen UI, queue assets, and kick off the load
        this._setupLoadingScreen();
        this.load.start();
    }

    // ─── Loading screen ───────────────────────────────────────────────────────

    _setupLoadingScreen() {
        const cx = GAME_CONSTANTS.halfWidth;
        const cy = GAME_CONSTANTS.halfHeight;
        const barW = GAME_CONSTANTS.LOADING_BAR_WIDTH;
        const barH = GAME_CONSTANTS.LOADING_BAR_HEIGHT;

        // Background image (loaded during preload)
        this._loadingBg = this.add.image(cx, cy, 'bg').setDepth(0);

        // Bar track (dim)
        this._loadingBarBg = this.add.image(cx, cy + 50, 'white_pixel')
            .setAlpha(0.3)
            .setScale(barW, barH)
            .setDepth(1);

        // Bar fill – anchored to the left edge so it grows rightward
        this._loadingBar = this.add.image(cx - barW / 2, cy + 50, 'white_pixel')
            .setOrigin(0, 0.5)
            .setScale(1, barH)
            .setDepth(2);

        // Status text
        this._loadingText = this.add.text(cx, cy - 20, 'Loading...', {
            fontFamily: 'Times New Roman',
            fontSize:   24,
            color:      '#ffffff',
            align:      'center',
        }).setOrigin(0.5, 0.5).setDepth(2);

        // Queue all main assets before calling setupMainLoading so they are
        // counted in the loader's progress events.
        this._queueMainAssets();

        // Delegate retry logic, stall detection, and the complete callback to
        // loadingManager.
        loadingManager.setupMainLoading(
            this,
            // onComplete
            () => { this._onLoadComplete(); },
            // onProgress
            (progress, statusText) => {
                if (progress !== null && progress !== undefined) {
                    this._loadingBar.scaleX = barW * progress;
                }
                if (statusText) {
                    this._loadingText.setText('Loading... (' + statusText + ')');
                }
            }
        );
    }

    _queueMainAssets() {
        // Audio
        audioFiles.forEach(f => {
            this.load.audio(f.name, 'assets/' + f.src);
        });

        // Texture atlases – JSON atlas files expect a matching .png alongside
        imageAtlases.forEach(f => {
            const jsonPath = 'assets/' + f.src;
            const imgPath  = jsonPath.replace('.json', '.png');
            this.load.atlas(f.name, imgPath, jsonPath);
        });

        // Bitmap fonts (XML / .fnt) – empty array by default, ready when needed
        fontFiles.forEach(f => {
            const xmlPath = 'assets/' + f.src;
            const imgPath = xmlPath.replace(/\.(xml|fnt)$/i, '.png');
            this.load.bitmapFont(f.name, imgPath, xmlPath);
        });
    }

    // ─── Load complete ────────────────────────────────────────────────────────

    _onLoadComplete() {
        // Clean up bar visuals
        if (this._loadingBarBg) { this._loadingBarBg.destroy(); this._loadingBarBg = null; }
        if (this._loadingBar)   { this._loadingBar.destroy();   this._loadingBar   = null; }

        // Confirm loading is finished
        this._loadingText.setText('Loading done');
    }

    // ─── Per-frame update ─────────────────────────────────────────────────────

    update(_time, delta) {
        updateManager.update(delta);
        buttonManager.update(delta);
    }
}

// ─── Host guard ───────────────────────────────────────────────────────────────

function isAllowedRuntimeHost() {
    const host     = (window.location.hostname || '').toLowerCase();
    const referrer = (document.referrer       || '').toLowerCase();

    const isLocalhost      = host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]';
    const isCrazyGamesHost = host === 'crazygames.com' || host.endsWith('.crazygames.com');
    const isItchHost       = host.endsWith('.itch.io') || host.endsWith('.itch.zone') || host.endsWith('.hwcdn.net');
    const hasItchReferrer  = /https?:\/\/([a-z0-9-]+\.)*itch\.io\//.test(referrer);

    return isLocalhost || isCrazyGamesHost || isItchHost || hasItchReferrer;
}

function onloadFunc() {}

function applyCrazyGamesMuteSetting(settings) {
    if (!settings || typeof settings.muteAudio !== 'boolean') return;
    if (settings.muteAudio) {
        if (typeof muteAll   === 'function') muteAll();
    } else {
        if (typeof unmuteAll === 'function') unmuteAll();
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
        await initSdkSettings();
        new Phaser.Game(config);
    })();
} else {
    document.body.insertAdjacentHTML('beforeend',
        '<div style="color:#fff;background:#111;padding:18px 20px;border:1px solid #333;' +
        'font-family:Comfortaa,sans-serif;max-width:520px;margin:40px auto;text-align:center;">' +
        'This build is only allowed on localhost, crazygames.com, or itch.io.</div>'
    );
}
