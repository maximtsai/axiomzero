// gameHUD.js
// In-game HUD: health bar, EXP bar, currency counters, END ITERATION button.
// All elements use JetBrainsMono. Show/hide based on phaseChanged.

const gameHUD = (() => {
    // ── HUD elements ─────────────────────────────────────────────────────────
    let healthBarBg   = null;
    let healthBarFill = null;
    let healthText    = null;
    let expBarBg      = null;
    let expBarFill    = null;
    let expText       = null;
    let dataIcon      = null;
    let dataText      = null;
    let insightText   = null;

    let endIterationBtn = null;

    // Layout
    const HUD_X = 20;
    const HUD_Y = 20;
    const BAR_W = 250;
    const BAR_H = 18;
    const BAR_GAP = 8;
    const DATA_ICON_SIZE = 18;
    const DATA_ICON_GAP  = 5;

    let visible = false;

    // ── init ─────────────────────────────────────────────────────────────────

    function init() {
        _createElements();
        _hideAll();
        messageBus.subscribe('phaseChanged',       _onPhaseChanged);
        messageBus.subscribe('healthChanged',       _onHealthChanged);
        messageBus.subscribe('expChanged',          _onExpChanged);
        messageBus.subscribe('currencyChanged',     _onCurrencyChanged);
        messageBus.subscribe('enemyKilled',         _onEnemyKilled);
        messageBus.subscribe('upgradePurchased',    _onUpgradePurchased);
        messageBus.subscribe('towerDeathStarted',   _onTowerDeathStarted);
    }

    function _createElements() {
        const depth = GAME_CONSTANTS.DEPTH_HUD;

        // ── Health bar ──
        healthBarBg = PhaserScene.add.image(HUD_X, HUD_Y, 'white_pixel');
        healthBarBg.setOrigin(0, 0).setDisplaySize(BAR_W, BAR_H).setTint(GAME_CONSTANTS.HEALTH_BAR_TINT).setDepth(depth);

        healthBarFill = PhaserScene.add.image(HUD_X, HUD_Y, 'white_pixel');
        healthBarFill.setOrigin(0, 0).setDisplaySize(BAR_W, BAR_H).setTint(GAME_CONSTANTS.COLOR_FRIENDLY).setDepth(depth + 1);

        healthText = PhaserScene.add.text(HUD_X + BAR_W + 8, HUD_Y, '', {
            fontFamily: 'JetBrainsMono_Regular',
            fontSize: '16px',
            color: '#ffffff',
        }).setOrigin(0, 0).setDepth(depth + 2);

        // ── EXP bar ──
        const expY = HUD_Y + BAR_H + BAR_GAP;
        expBarBg = PhaserScene.add.image(HUD_X, expY, 'white_pixel');
        expBarBg.setOrigin(0, 0).setDisplaySize(BAR_W, 8).setTint(0x222222).setDepth(depth);

        expBarFill = PhaserScene.add.image(HUD_X, expY, 'white_pixel');
        expBarFill.setOrigin(0, 0).setDisplaySize(0, 8).setTint(0xffffff).setDepth(depth + 1);

        expText = PhaserScene.add.text(HUD_X + BAR_W + 8, expY - 2, 'EXP 0%', {
            fontFamily: 'JetBrainsMono_Regular',
            fontSize: '12px',
            color: '#aaaaaa',
        }).setOrigin(0, 0).setDepth(depth + 2);

        // ── Currency counters ──
        const currY = expY + 8 + BAR_GAP + 5;

        dataIcon = PhaserScene.add.image(HUD_X, currY + DATA_ICON_SIZE / 2, 'player', 'resrc_data.png');
        dataIcon.setOrigin(0, 0.5).setDisplaySize(DATA_ICON_SIZE, DATA_ICON_SIZE).setDepth(depth + 2);

        dataText = PhaserScene.add.text(HUD_X + DATA_ICON_SIZE + DATA_ICON_GAP, currY, '0', {
            fontFamily: 'JetBrainsMono_Regular',
            fontSize: '17px',
            color: '#00f5ff',
        }).setOrigin(0, 0).setDepth(depth + 2);

        insightText = PhaserScene.add.text(HUD_X + 125, currY, '\u25C9 0', {
            fontFamily: 'JetBrainsMono_Regular',
            fontSize: '17px',
            color: '#ffffff',
        }).setOrigin(0, 0).setDepth(depth + 2);

        // ── END ITERATION button ──
        endIterationBtn = new Button({
            normal: {
                ref: 'button_normal.png',
                atlas: 'buttons',
                x: GAME_CONSTANTS.WIDTH - 125,
                y: GAME_CONSTANTS.HEIGHT - 45,
                depth: depth + 3,
            },
            hover: {
                ref: 'button_hover.png',
                atlas: 'buttons',
                x: GAME_CONSTANTS.WIDTH - 125,
                y: GAME_CONSTANTS.HEIGHT - 45,
                depth: depth + 3,
            },
            press: {
                ref: 'button_press.png',
                atlas: 'buttons',
                x: GAME_CONSTANTS.WIDTH - 125,
                y: GAME_CONSTANTS.HEIGHT - 45,
                depth: depth + 3,
            },
            onMouseUp: () => {
                messageBus.publish('endIterationRequested');
            },
        });
        endIterationBtn.addText('END ITERATION', {
            fontFamily: 'JetBrainsMono_Bold',
            fontSize: '14px',
            color: '#ffffff',
        });
    }

    // ── show / hide ──────────────────────────────────────────────────────────

    function _showCombatHUD() {
        visible = true;
        _resetCombatPositions();
        healthBarBg.setVisible(true);
        healthBarFill.setVisible(true);
        healthText.setVisible(true);
        expBarBg.setVisible(true);
        expBarFill.setVisible(true);
        expText.setVisible(true);
        dataIcon.setVisible(true);
        dataText.setVisible(true);
        insightText.setVisible(true);
        endIterationBtn.setVisible(true);
        endIterationBtn.setState(NORMAL);
    }

    function _hideAll() {
        visible = false;
        healthBarBg.setVisible(false);
        healthBarFill.setVisible(false);
        healthText.setVisible(false);
        expBarBg.setVisible(false);
        expBarFill.setVisible(false);
        expText.setVisible(false);
        dataIcon.setVisible(false);
        dataText.setVisible(false);
        insightText.setVisible(false);
        endIterationBtn.setVisible(false);
        endIterationBtn.setState(DISABLE);
    }

    // ── event handlers ───────────────────────────────────────────────────────

    function _onPhaseChanged(phase) {
        if (phase === 'WAVE_ACTIVE') {
            _showCombatHUD();
        } else if (phase === 'UPGRADE_PHASE') {
            // During upgrade, show currencies but hide combat-only elements
            _showUpgradeHUD();
        } else {
            _hideAll();
        }
    }

    function _showUpgradeHUD() {
        visible = true;
        // Show currency counters on the right half
        const upgradeBaseX = GAME_CONSTANTS.halfWidth + 16;
        dataIcon.setVisible(true);
        dataIcon.setPosition(upgradeBaseX, HUD_Y + DATA_ICON_SIZE / 2);
        dataText.setVisible(true);
        dataText.setPosition(upgradeBaseX + DATA_ICON_SIZE + DATA_ICON_GAP, HUD_Y);
        insightText.setVisible(true);
        insightText.setPosition(GAME_CONSTANTS.halfWidth + 145, HUD_Y);

        // Hide combat-only elements
        healthBarBg.setVisible(false);
        healthBarFill.setVisible(false);
        healthText.setVisible(false);
        expBarBg.setVisible(false);
        expBarFill.setVisible(false);
        expText.setVisible(false);
        endIterationBtn.setVisible(false);
        endIterationBtn.setState(DISABLE);
    }

    function _onHealthChanged(current, max) {
        if (!visible) return;
        const ratio = Math.max(0, current / max);
        healthBarFill.setDisplaySize(BAR_W * ratio, BAR_H);

        // Color shift: cyan → red as health drops
        if (ratio > 0.5) {
            healthBarFill.setTint(GAME_CONSTANTS.COLOR_FRIENDLY);
        } else if (ratio > 0.25) {
            healthBarFill.setTint(GAME_CONSTANTS.COLOR_RESOURCE);
        } else {
            healthBarFill.setTint(GAME_CONSTANTS.COLOR_HOSTILE);
        }

        healthText.setText(current.toFixed(1) + ' / ' + max.toFixed(0));
    }

    function _onExpChanged(current, max) {
        if (!visible) return;
        const ratio = Math.min(1, Math.max(0, current / max));
        expBarFill.setDisplaySize(BAR_W * ratio, 8);
        expText.setText('EXP ' + Math.floor(ratio * 100) + '%');
    }

    function _onCurrencyChanged(type, amount) {
        if (type === 'data')    dataText.setText('' + Math.floor(amount));
        if (type === 'insight') insightText.setText('\u25C9 ' + Math.floor(amount));
    }

    function _onEnemyKilled() {
        // Could add kill counter later
    }

    function _onTowerDeathStarted() {
        endIterationBtn.setVisible(false);
        endIterationBtn.setState(DISABLE);
    }

    function _onUpgradePurchased() {
        // Refresh currency display
        dataText.setText('' + Math.floor(resourceManager.getData()));
        insightText.setText('\u25C9 ' + Math.floor(resourceManager.getInsight()));
    }

    /** Reposition HUD for full-screen combat layout. */
    function _resetCombatPositions() {
        const combatCurrY = HUD_Y + BAR_H + BAR_GAP + 8 + BAR_GAP + 5;
        dataIcon.setPosition(HUD_X, combatCurrY + DATA_ICON_SIZE / 2);
        dataText.setPosition(HUD_X + DATA_ICON_SIZE + DATA_ICON_GAP, combatCurrY);
        insightText.setPosition(HUD_X + 125, combatCurrY);
    }

    return { init };
})();
