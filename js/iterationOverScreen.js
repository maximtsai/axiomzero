// iterationOverScreen.js — Post-combat "ITERATION COMPLETE" summary screen.
// Shows collected resources and offers UPGRADES or RETRY SESSION.

const iterationOverScreen = (() => {
    let overlay     = null;
    let titleText   = null;
    let dataText    = null;
    let insightText = null;
    let upgradesBtn = null;
    let retryBtn    = null;

    let visible = false;

    // ── init ─────────────────────────────────────────────────────────────

    function init() {
        _createElements();
        _hideAll();
        messageBus.subscribe('phaseChanged', _onPhaseChanged);
    }

    function _createElements() {
        const depth = GAME_CONSTANTS.DEPTH_ITERATION_OVER;
        const cx = GAME_CONSTANTS.halfWidth;
        const cy = GAME_CONSTANTS.halfHeight;

        // Dark overlay
        overlay = PhaserScene.add.image(cx, cy, 'white_pixel');
        overlay.setDisplaySize(GAME_CONSTANTS.WIDTH, GAME_CONSTANTS.HEIGHT);
        overlay.setTint(0x000000).setAlpha(0.75).setDepth(depth);

        // Title — Michroma
        titleText = PhaserScene.add.text(cx, cy - 125, 'ITERATION COMPLETE', {
            fontFamily: 'Michroma',
            fontSize: '36px',
            color: '#00f5ff',
            align: 'center',
        }).setOrigin(0.5).setDepth(depth + 1);

        // Acquired resources
        dataText = PhaserScene.add.text(cx, cy - 38, '', {
            fontFamily: 'JetBrainsMono_Regular',
            fontSize: '24px',
            color: '#00f5ff',
            align: 'center',
        }).setOrigin(0.5).setDepth(depth + 1);

        insightText = PhaserScene.add.text(cx, cy, '', {
            fontFamily: 'JetBrainsMono_Regular',
            fontSize: '24px',
            color: '#ffffff',
            align: 'center',
        }).setOrigin(0.5).setDepth(depth + 1);

        // UPGRADES button
        upgradesBtn = new Button({
            normal: {
                ref: 'button_normal.png',
                atlas: 'buttons',
                x: cx - 113,
                y: cy + 100,
                depth: depth + 2,
            },
            hover: {
                ref: 'button_hover.png',
                atlas: 'buttons',
                x: cx - 113,
                y: cy + 100,
                depth: depth + 2,
            },
            press: {
                ref: 'button_press.png',
                atlas: 'buttons',
                x: cx - 113,
                y: cy + 100,
                depth: depth + 2,
            },
            onMouseUp: _onUpgradesClicked,
        });
        upgradesBtn.addText('UPGRADES', {
            fontFamily: 'JetBrainsMono_Bold',
            fontSize: '22px',
            color: '#ffffff',
        });
        upgradesBtn.setScrollFactor(0);

        // RETRY SESSION button
        retryBtn = new Button({
            normal: {
                ref: 'button_normal.png',
                atlas: 'buttons',
                x: cx + 113,
                y: cy + 100,
                depth: depth + 2,
            },
            hover: {
                ref: 'button_hover.png',
                atlas: 'buttons',
                x: cx + 113,
                y: cy + 100,
                depth: depth + 2,
            },
            press: {
                ref: 'button_press.png',
                atlas: 'buttons',
                x: cx + 113,
                y: cy + 100,
                depth: depth + 2,
            },
            onMouseUp: _onRetryClicked,
        });
        retryBtn.addText('RETRY', {
            fontFamily: 'JetBrainsMono_Bold',
            fontSize: '22px',
            color: '#ffffff',
        });
        retryBtn.setScrollFactor(0);
    }

    // ── show / hide ──────────────────────────────────────────────────────

    function show() {
        visible = true;

        // Update resource text
        dataText.setText('\u25C8 DATA collected: ' + resourceManager.getSessionData());
        insightText.setText('\u25C9 INSIGHT gained: ' + resourceManager.getSessionInsight());

        overlay.setVisible(true);
        titleText.setVisible(true);
        dataText.setVisible(true);
        insightText.setVisible(true);
        upgradesBtn.setVisible(true);
        upgradesBtn.setState(NORMAL);
        retryBtn.setVisible(true);
        retryBtn.setState(NORMAL);
    }

    function _hideAll() {
        visible = false;
        overlay.setVisible(false);
        titleText.setVisible(false);
        dataText.setVisible(false);
        insightText.setVisible(false);
        upgradesBtn.setVisible(false);
        upgradesBtn.setState(DISABLE);
        retryBtn.setVisible(false);
        retryBtn.setState(DISABLE);
    }

    // ── button handlers ──────────────────────────────────────────────────

    function _onUpgradesClicked() {
        _hideAll();
        // Clean up combat state
        enemyManager.clearAllEnemies();
        projectileManager.clearAll();
        resourceManager.clearDrops();
        tower.reset();
        // Transition to upgrade phase
        transitionManager.transitionTo('UPGRADE_PHASE');
    }

    function _onRetryClicked() {
        _hideAll();
        // Reset combat state directly — no transition animation
        enemyManager.clearAllEnemies();
        projectileManager.clearAll();
        resourceManager.clearDrops();
        tower.reset();
        // Go straight back to combat
        gameStateMachine.goTo('WAVE_ACTIVE');
    }

    // ── events ───────────────────────────────────────────────────────────

    function _onPhaseChanged(phase) {
        if (phase === 'WAVE_COMPLETE') {
            show();
        } else if (visible) {
            _hideAll();
        }
    }

    return { init, show };
})();
