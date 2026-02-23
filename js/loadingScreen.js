// LoadingScreen - Two-phase asset loading with progress bar
//
// Phase 1  preload()  → loadingScreen.preload(scene)
//   Loads imageFilesPreload so the UI images are ready for phase 2.
//
// Phase 2  create()   → loadingScreen.create(scene)
//   Builds the loading bar UI, queues all main assets, and delegates
//   retry / stall / completion handling to loadingManager.
//
// Stall feedback:
//   15 s of silence → "Slow loading detected"
//   25 s of silence → "Load error, run game anyways?" + RUN ANYWAYS button
//   Only a button click forces the game to start.

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
        this._scene = scene;
        this._buildUI(scene);
        this._queueAssets(scene);

        const { forceFinish } = loadingManager.setupMainLoading(
            scene,
            () => { this._onComplete(); },
            (progress, statusText) => {
                if (progress !== null && progress !== undefined) {
                    this._bar.scaleX = GAME_CONSTANTS.LOADING_BAR_WIDTH * progress;
                }
                if (statusText) {
                    this._text.setText('Loading... (' + statusText + ')');
                }
            },
            () => { this._onSlowWarning(); },
            () => { this._onTimeoutReached(forceFinish); }
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

    _onSlowWarning() {
        if (this._text) this._text.setText('Slow loading detected');
    }

    _onTimeoutReached(forceFinish) {
        if (this._text) this._text.setText('Load error, run game anyways?');
        this._showRunAnywaysButton(forceFinish);
    }

    _showRunAnywaysButton(forceFinish) {
        const scene = this._scene;
        const cx    = GAME_CONSTANTS.halfWidth;
        const btnY  = GAME_CONSTANTS.halfHeight + 100;  // below bar (bar is at cy+50)

        this._runBtnBg = scene.add.image(cx, btnY, 'black_pixel')
            .setScale(190, 34)
            .setAlpha(0.85)
            .setDepth(3)
            .setInteractive({ useHandCursor: true });

        this._runBtnText = scene.add.text(cx, btnY, 'RUN ANYWAYS', {
            fontFamily: 'Times New Roman',
            fontSize:   20,
            color:      '#ffffff',
            align:      'center',
        }).setOrigin(0.5, 0.5).setDepth(4);

        this._runBtnBg.on('pointerover', () => this._runBtnBg.setAlpha(1));
        this._runBtnBg.on('pointerout',  () => this._runBtnBg.setAlpha(0.85));
        this._runBtnBg.on('pointerup',   () => forceFinish());
    }

    _onComplete() {
        if (this._bar)        { this._bar.destroy();        this._bar = null; }
        if (this._runBtnBg)   { this._runBtnBg.destroy();   this._runBtnBg = null; }
        if (this._runBtnText) { this._runBtnText.destroy();  this._runBtnText = null; }
        if (this._text) {
            this._text.setText('Done');
            PhaserScene.tweens.add({
                targets:  this._text,
                alpha:    0,
                delay:    300,
                duration: 400,
                onComplete: () => {
                    if (this._text) { this._text.destroy(); this._text = null; }
                    messageBus.publish('assetsLoaded');
                }
            });
        } else {
            messageBus.publish('assetsLoaded');
        }
    }
}

const loadingScreen = new LoadingScreen();
