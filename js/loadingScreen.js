// LoadingScreen - Two-phase asset loading with progress bar
//
// Phase 1  preload()  → loadingScreen.preload(scene)
//   Loads imageFilesPreload so the UI images are ready for phase 2.
//
// Phase 2  create()   → loadingScreen.create(scene)
//   Builds the loading bar UI, queues all main assets, and delegates
//   retry / stall / completion handling to loadingManager.

class LoadingScreen {

    // ─── Phase 1 ──────────────────────────────────────────────────────────────

    preload(scene) {
        const notice = document.getElementById('preload-notice');
        if (notice) notice.innerHTML = '';

        // Load the minimal set of images needed to build the loading UI
        imageFilesPreload.forEach(f => {
            scene.load.image(f.name, 'assets/' + f.src);
        });

        // Stall detection only – no timeout or retry needed for this phase
        loadingManager.setupInitialPreload(scene, notice);
    }

    // ─── Phase 2 ──────────────────────────────────────────────────────────────

    create(scene) {
        this._buildUI(scene);
        this._queueAssets(scene);

        loadingManager.setupMainLoading(
            scene,
            () => { this._onComplete(); },
            (progress, statusText) => {
                if (progress !== null && progress !== undefined) {
                    this._bar.scaleX = GAME_CONSTANTS.LOADING_BAR_WIDTH * progress;
                }
                if (statusText) {
                    this._text.setText('Loading... (' + statusText + ')');
                }
            }
        );
    }

    // ─── Private ──────────────────────────────────────────────────────────────

    _buildUI(scene) {
        const cx   = GAME_CONSTANTS.halfWidth;
        const cy   = GAME_CONSTANTS.halfHeight;
        const barW = GAME_CONSTANTS.LOADING_BAR_WIDTH;
        const barH = GAME_CONSTANTS.LOADING_BAR_HEIGHT;

        scene.add.image(cx, cy, 'bg').setDepth(0);

        // Bar track
        scene.add.image(cx, cy + 50, 'white_pixel')
            .setAlpha(0.3)
            .setScale(barW, barH)
            .setDepth(1);

        // Bar fill – grows rightward from the left edge
        this._bar = scene.add.image(cx - barW / 2, cy + 50, 'white_pixel')
            .setOrigin(0, 0.5)
            .setScale(1, barH)
            .setDepth(2);

        this._text = scene.add.text(cx, cy - 20, 'Loading...', {
            fontFamily: 'Times New Roman',
            fontSize:   24,
            color:      '#ffffff',
            align:      'center',
        }).setOrigin(0.5, 0.5).setDepth(2);
    }

    _queueAssets(scene) {
        audioFiles.forEach(f => {
            scene.load.audio(f.name, 'assets/' + f.src);
        });

        imageAtlases.forEach(f => {
            const json = 'assets/' + f.src;
            const base = json.substring(0, json.lastIndexOf('/') + 1);
            scene.load.multiatlas(f.name, json, base);
        });

        fontFiles.forEach(f => {
            const xml = 'assets/' + f.src;
            scene.load.bitmapFont(f.name, xml.replace(/\.(xml|fnt)$/i, '.png'), xml);
        });
    }

    _onComplete() {
        if (this._bar)  { this._bar.destroy();  this._bar  = null; }
        this._text.setText('Loading done');
    }
}

const loadingScreen = new LoadingScreen();
