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
                    if (this._barText) {
                        const totalSegments = 20;
                        const filledSegments = Math.round(progress * totalSegments);
                        const emptySegments = Math.max(0, totalSegments - filledSegments);
                        const pct = Math.floor(progress * 100);
                        const pctStr = pct.toString().padStart(3, ' ');
                        const stringProgress = '     [' + '█'.repeat(filledSegments) + '-'.repeat(emptySegments) + '] ' + pctStr + '%';
                        this._barText.setText(stringProgress);
                    }
                }
                if (statusText) {
                    this._text.setText(t('loading_screen', 'status', statusText));
                }
            },
            () => { this._onSlowWarning(); },
            () => { this._onTimeoutReached(forceFinish); }
        );
    }

    // ─── Private ──────────────────────────────────────────────────────────────

    _buildUI(scene) {
        const cx = GAME_CONSTANTS.halfWidth;
        const cy = GAME_CONSTANTS.halfHeight;
        const barW = GAME_CONSTANTS.LOADING_BAR_WIDTH;
        const barH = GAME_CONSTANTS.LOADING_BAR_HEIGHT;

        this._bg = scene.add.image(cx, cy, 'bg').setDepth(0);

        // Text-based loading bar
        this._barText = scene.add.text(cx, cy + 50, '     [--------------------]   0%', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: 48,
            color: '#ffd700',
            fontStyle: 'bold',
            align: 'center',
        }).setOrigin(0.5, 0.5).setDepth(2);

        this._text = scene.add.text(cx, cy - 25, t('ui', 'loading'), {
            fontFamily: 'Times New Roman',
            fontSize: 29,
            color: '#ffffff',
            align: 'center',
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
        if (this._text) this._text.setText(t('loading_screen', 'slow'));
    }

    _onTimeoutReached(forceFinish) {
        if (this._text) this._text.setText(t('loading_screen', 'error'));
        this._showRunAnywaysButton(forceFinish);
    }

    _showRunAnywaysButton(forceFinish) {
        const scene = this._scene;
        const cx = GAME_CONSTANTS.halfWidth;
        const btnY = GAME_CONSTANTS.halfHeight + 125;  // below bar (bar is at cy+50)

        this._runBtnBg = scene.add.image(cx, btnY, 'black_pixel')
            .setScale(238 / 2, 43 / 2)
            .setAlpha(0.85)
            .setDepth(3)
            .setInteractive({ useHandCursor: true });

        this._runBtnText = scene.add.text(cx, btnY, t('loading_screen', 'run_anyways'), {
            fontFamily: 'Times New Roman',
            fontSize: 24,
            color: '#ffffff',
            align: 'center',
        }).setOrigin(0.5, 0.5).setDepth(4);

        this._runBtnBg.on('pointerover', () => this._runBtnBg.setAlpha(1));
        this._runBtnBg.on('pointerout', () => this._runBtnBg.setAlpha(0.85));
        this._runBtnBg.on('pointerup', () => forceFinish());
    }

    _onComplete() {
        if (this._bg) { this._bg.destroy(); this._bg = null; }
        if (this._barText) { this._barText.destroy(); this._barText = null; }
        if (this._runBtnBg) { this._runBtnBg.destroy(); this._runBtnBg = null; }
        if (this._runBtnText) { this._runBtnText.destroy(); this._runBtnText = null; }
        if (this._text) {
            this._text.setText(t('ui', 'done'));
            PhaserScene.tweens.add({
                targets: this._text,
                alpha: 0,
                duration: 100,
                onComplete: () => {
                    if (this._text) { this._text.destroy(); this._text = null; }
                }
            });
        }
        messageBus.publish('assetsLoaded');

    }
}

const loadingScreen = new LoadingScreen();
