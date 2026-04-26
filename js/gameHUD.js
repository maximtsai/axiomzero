// gameHUD.js
// In-game HUD: health bar, EXP bar, currency counters, END ITERATION button.
// All elements use JetBrainsMono. Show/hide based on phaseChanged.

const gameHUD = (() => {
    // ── HUD sub-components ───────────────────────────────────────────────────
    let healthBar = null;
    let currencyCluster = null;

    // ── HUD buttons/elements ─────────────────────────────────────────────────
    let healthBtn = null;
    let endIterationBtn = null;
    let testDefensesBtn = null;
    let waveProgressBar = null;
    let farmingTimerTxt = null;
    let bombBtn = null;
    let bombBtnTxt = null;
    let bombIcon = null;
    let isFarming = false;
    let bombCanCancel = false;
    let bombPulseIndicator = null;
    let bombPulseTimer = null;

    // Layout & Depth Configuration
    const DEPTHS = {
        BAR_BASE: GAME_CONSTANTS.DEPTH_UPGRADE_TREE + 2,
        BAR_OVERLAY: GAME_CONSTANTS.DEPTH_UPGRADE_TREE + 3,
        BUTTONS: GAME_CONSTANTS.DEPTH_UPGRADE_TREE + 5,
        ICONS: GAME_CONSTANTS.DEPTH_UPGRADE_TREE + 6,
        PROGRESS: GAME_CONSTANTS.DEPTH_UPGRADE_TREE + 2,
        TEXT: GAME_CONSTANTS.DEPTH_UPGRADE_TREE + 3
    };

    const LAYOUT = {
        HUD_X: 20,
        HUD_Y: 20,
        BAR_W: 200,
        BAR_H: helper.isMobileDevice() ? 28 : 24,
        BAR_GAP: helper.isMobileDevice() ? 18 : 14,
        CURRENCY_SPACING: helper.isMobileDevice() ? 40 : 36,
        GROUP_X_OFFSET: 10
    };

    let visible = false;
    let needsLayoutUpdate = false;
    let layoutFrameCounter = 0;

    // ── init ─────────────────────────────────────────────────────────────────

    function init() {
        _createElements();
        _hideAll();
        _setupSubscriptions();

        if (currencyCluster && typeof upgradeTree !== 'undefined' && upgradeTree.assignToUICamera) {
            currencyCluster.assignToUICamera();
        }

        updateManager.addFunction(_update);
    }

    function _setupSubscriptions() {
        // Core Phase/Transition
        messageBus.subscribe('phaseChanged', _onPhaseChanged);
        messageBus.subscribe('transitionComplete', _onTransitionComplete);
        messageBus.subscribe('towerDeathStarted', _onTowerDeathStarted);
        messageBus.subscribe('bossDefeated', _onBossDefeated);

        // Tower Stats
        messageBus.subscribe('healthChanged', _onHealthChanged);
        messageBus.subscribe('currencyChanged', _onCurrencyChanged);
        messageBus.subscribe('upgradePurchased', _onUpgradePurchased);

        // Bomb UI logic
        messageBus.subscribe('cursorBombArmed', () => { if (bombBtn) bombBtn.setState(DISABLE); });
        messageBus.subscribe('bombUsesChanged', _updateBombUI);
        messageBus.subscribe('cursorBombReady', () => { bombCanCancel = false; _updateBombUI(); });
        messageBus.subscribe('cursorBombCanCancel', () => { bombCanCancel = true; _updateBombUI(); });
        messageBus.subscribe('cursorBombCancelled', () => {
            bombCanCancel = false;
            _updateBombUI();
            clearBombPulse();
        });
        messageBus.subscribe('cursorBombFired', () => {
            bombCanCancel = false;
            _updateBombUI();
            clearBombPulse();
        });
        messageBus.subscribe('bombShowHint', (enabled) => {
            if (enabled) setBombPulse();
            else clearBombPulse();
        });

        // Wave Progress
        messageBus.subscribe('waveProgressChanged', _onWaveProgressChanged);
        messageBus.subscribe('waveModeFarmingStarted', _onFarmingStarted);
        messageBus.subscribe('waveModeNormalStarted', _onNormalWaveStarted);
    }

    function _createElements() {
        const groupX = GAME_CONSTANTS.halfWidth + LAYOUT.GROUP_X_OFFSET + LAYOUT.HUD_X;

        // 1. Health Bar Component
        healthBar = new HealthBar({
            x: groupX,
            y: LAYOUT.HUD_Y,
            width: LAYOUT.BAR_W,
            height: LAYOUT.BAR_H,
            depth: DEPTHS.BAR_BASE
        });

        // Invisible button overlay for health bar info
        healthBtn = new Button({
            normal: { ref: 'wide_pointer2_normal.png', atlas: 'buttons', x: groupX + 101, y: LAYOUT.HUD_Y + (LAYOUT.BAR_H / 2) },
            hover: { ref: 'wide_pointer2_hover.png', atlas: 'buttons' },
            press: { ref: 'wide_pointer2_hover.png', atlas: 'buttons' },
            disable: { ref: 'wide_pointer2_normal.png', atlas: 'buttons' },
            onHover: () => {
                let sfxRel = audio.play('click', 0.95);
                if (sfxRel) sfxRel.detune = Phaser.Math.Between(-150, -50);
                tooltipManager.show(healthBtn.x, healthBtn.y + 17, [
                    { text: t('hud', 'health_title'), style: 'title', color: '#00ff66' },
                    { text: t('hud', 'health_desc'), style: 'normal' }
                ], 410);
                if (typeof upgradeTree !== 'undefined') {
                    upgradeTree.setHoverLabel('HEALTH');
                }
            },
            onHoverOut: () => {
                tooltipManager.hide();
                if (typeof upgradeTree !== 'undefined') {
                    upgradeTree.setHoverLabel(null);
                }
            }
        });
        healthBtn.setOrigin(0.5, 0.5).setScale(1.05, helper.isMobileDevice() ? 1.1 : 1.05).setDepth(DEPTHS.BAR_OVERLAY).setScrollFactor(0).setVisible(false);

        // 2. Currency Cluster Component
        const currY = LAYOUT.HUD_Y + LAYOUT.BAR_H + LAYOUT.BAR_GAP + 13;
        currencyCluster = new CurrencyCluster({
            x: groupX,
            y: currY,
            depth: DEPTHS.BAR_BASE,
            spacing: LAYOUT.CURRENCY_SPACING
        });

        // Add to upgrade tree group if needed
        if (typeof upgradeTree !== 'undefined' && upgradeTree.getGroup) {
            const treeGroup = upgradeTree.getGroup();
            if (treeGroup) {
                healthBar.addToGroup(treeGroup);
                if (healthBtn.getContainer) treeGroup.add(healthBtn.getContainer());
                currencyCluster.addToGroup(treeGroup);
            }
        }

        // 3. Action Buttons
        endIterationBtn = new Button({
            normal: { ref: helper.isMobileDevice() ? 'button_normal_mobile.png' : 'button_normal.png', atlas: 'buttons', x: 107, y: GAME_CONSTANTS.HEIGHT - 69, alpha: 1 },
            hover: { ref: 'button_hover.png', atlas: 'buttons', },
            press: { ref: 'button_press.png', atlas: 'buttons', },
            disable: { ref: 'button_press.png', atlas: 'buttons', alpha: 0 },
            onMouseUp: () => messageBus.publish('endIterationRequested'),
        });
        endIterationBtn.setScale(0.675).addText(t('ui', 'end_iteration'), {
            fontFamily: 'JetBrainsMono_Bold',
            fontSize: '19px',
            color: GAME_CONSTANTS.COLOR_NEUTRAL,
        });
        endIterationBtn.setDepth(DEPTHS.BUTTONS).setScrollFactor(0);

        bombBtn = new Button({
            normal: { ref: 'sq_button_normal.png', atlas: 'buttons', x: GAME_CONSTANTS.WIDTH - 42, y: GAME_CONSTANTS.HEIGHT - 72, alpha: 1 },
            hover: { ref: 'sq_button_hover.png', atlas: 'buttons', alpha: 1 },
            press: { ref: 'sq_button_press.png', atlas: 'buttons', alpha: 1 },
            disable: { ref: 'sq_button_press.png', atlas: 'buttons', alpha: 0.5 },
            onMouseUp: () => {
                if (bombCanCancel) {
                    if (typeof pulseAttack !== 'undefined' && pulseAttack.cancelBomb) pulseAttack.cancelBomb();
                } else {
                    _armBomb();
                }
            },
            onHover: () => {
                if (bombIcon) bombIcon.setAlpha(1);
            },
            onHoverOut: () => {
                _updateBombUI();
            }
        });
        bombBtn.setScale(0.675);
        bombBtnTxt = bombBtn.addText('', {
            fontFamily: 'JetBrainsMono_Bold',
            fontSize: '19px',
            color: GAME_CONSTANTS.COLOR_NEUTRAL,
            align: 'center'
        });
        bombBtnTxt.setOrigin(0.5, 0.5);
        bombBtn.setTextOffset(0, -44);
        bombBtn.setDepth(DEPTHS.BUTTONS).setScrollFactor(0);

        bombIcon = PhaserScene.add.image(GAME_CONSTANTS.WIDTH - 42, GAME_CONSTANTS.HEIGHT - 72, 'buttons', 'bomb_icon.png');
        bombIcon.setScale(0.675).setDepth(DEPTHS.ICONS).setScrollFactor(0).setAlpha(0.9);

        testDefensesBtn = new Button({
            normal: { ref: helper.isMobileDevice() ? 'button_normal_mobile.png' : 'button_normal.png', atlas: 'buttons', x: GAME_CONSTANTS.WIDTH * 0.75, y: GAME_CONSTANTS.HEIGHT - 69, alpha: 1 },
            hover: { ref: 'button_hover.png', atlas: 'buttons' },
            press: { ref: 'button_press.png', atlas: 'buttons' },
            disable: { ref: 'button_press.png', atlas: 'buttons', alpha: 0 },
            onMouseUp: () => {
                if (typeof enemyManager !== 'undefined') enemyManager.startTestingDefenses();
                if (typeof GAME_VARS !== 'undefined') GAME_VARS.testingDefenses = true;
            },
            onHover: () => {
                let sfx = audio.play('click', 0.95);
                if (sfx) sfx.detune = Phaser.Math.Between(-50, 50);
                if (typeof upgradeTree !== 'undefined') upgradeTree.setHoverLabel(t('ui', 'create_test_enemies'));
            },
            onHoverOut: () => {
                if (typeof upgradeTree !== 'undefined') upgradeTree.setHoverLabel(null);
            }
        });
        testDefensesBtn.setScale(0.675);
        testDefensesBtn.addText(t('ui', 'test_weapons'), {
            fontFamily: 'JetBrainsMono_Bold',
            fontSize: '19px',
            color: GAME_CONSTANTS.COLOR_NEUTRAL,
        });
        testDefensesBtn.setDepth(DEPTHS.BUTTONS).setScrollFactor(0).setVisible(false);

        farmingTimerTxt = PhaserScene.add.text(20, GAME_CONSTANTS.HEIGHT - 22, '00:00', {
            fontFamily: 'JetBrainsMono_Regular',
            fontSize: '24px',
            color: '#00f5ff', // Cyan matching the progress bar
            stroke: '#000000',
            strokeThickness: 1
        }).setOrigin(0, 0.5).setDepth(DEPTHS.TEXT).setScrollFactor(0).setVisible(false);
        farmingTimerTxt.setShadow(0, 0, '#000000', 3, true, true);

        // 4. Wave Progress Bar
        waveProgressBar = new ProgressBar(PhaserScene, {
            x: GAME_CONSTANTS.halfWidth,
            y: GAME_CONSTANTS.HEIGHT - 26,
            width: 1570,
            height: 18,
            padding: 6,
            bgColor: 0x1a1e2e,
            fillColor: 0x00f5ff,
            depth: DEPTHS.PROGRESS
        });
        waveProgressBar.setVisible(false);
    }

    function _flickerElement(element, steps, onComplete = null) {
        if (!element) return;
        let currentStep = 0;

        function nextStep() {
            if (currentStep >= steps.length) {
                if (onComplete) onComplete();
                return;
            }
            const { alpha, delay, borderAlpha } = steps[currentStep];
            if (element.setAlpha) element.setAlpha(alpha);
            if (borderAlpha !== undefined && element.setBorderAlpha) element.setBorderAlpha(borderAlpha);

            currentStep++;
            PhaserScene.time.delayedCall(delay, nextStep);
        }
        nextStep();
    }

    function _armBomb() {
        if (typeof pulseAttack !== 'undefined' && pulseAttack.armBomb) {
            pulseAttack.armBomb();
        }
    }

    function _updateBombUI() {
        if (!bombBtn || typeof pulseAttack === 'undefined') return;
        const model = pulseAttack.getModel();
        const hasBombs = model.maxBombUses > 0;
        const isFullView = (typeof upgradeTree !== 'undefined' && upgradeTree.isFullView && upgradeTree.isFullView());
        const shouldShow = hasBombs && !isFullView;

        bombBtn.setVisible(shouldShow);
        if (bombIcon) bombIcon.setVisible(shouldShow);
        if (!shouldShow) return;

        const isDisabled = (model.bombUses <= 0 && !bombCanCancel) || model.bombArmed || model.bombFired;

        if (bombCanCancel) {
            bombBtn.setState(NORMAL);
            if (bombBtnTxt) bombBtnTxt.setText(t('ui', 'cancel'));
        } else {
            bombBtn.setState(isDisabled ? DISABLE : NORMAL);
            if (bombBtnTxt) bombBtnTxt.setText(`${model.bombUses}/${model.maxBombUses}`);
        }

        if (bombIcon) {
            const isInteracted = bombBtn.state === HOVER || bombBtn.state === PRESS;
            bombIcon.setAlpha(isInteracted ? 1 : (isDisabled ? 0.5 : 0.75));
        }
    }

    function _refreshHUDVisibility() {
        const phase = gameStateMachine.getPhase();
        const isCombat = phase === GAME_CONSTANTS.PHASE_COMBAT;
        const isUpgrade = phase === GAME_CONSTANTS.PHASE_UPGRADE;
        const isFullView = (typeof upgradeTree !== 'undefined' && upgradeTree.isFullView && upgradeTree.isFullView());

        visible = isCombat || isUpgrade;

        if (healthBar) healthBar.setVisible(visible);
        if (healthBtn) healthBtn.setVisible(isUpgrade && !isFullView).setState(isUpgrade && !isFullView ? NORMAL : DISABLE);
        if (currencyCluster) {
            currencyCluster.setVisible(visible);
            currencyCluster.updateLayout(visible, isUpgrade);
        }

        if (isUpgrade) {
            // Count up animation for currencies when entering upgrade phase
            ['data', 'insight', 'shard', 'coin', 'processor'].forEach(id => {
                const val = _getResourceVal(id);
                if (val >= 2) currencyCluster.animateToValue(id, val);
                else currencyCluster.setStaticValue(id, val);
            });
        }

        const isTrans = typeof transitionManager !== 'undefined' && transitionManager.isTransitioning();
        if (endIterationBtn) endIterationBtn.setVisible(isCombat && !isTrans).setState(isTrans ? DISABLE : NORMAL);

        _updateBombUI();
        refreshTestDefensesButton();

        if (waveProgressBar) waveProgressBar.setVisible(isCombat && !isFarming);
        if (farmingTimerTxt) farmingTimerTxt.setVisible(isCombat && isFarming);
    }

    function _showCombatHUD() {
        _refreshHUDVisibility();
    }

    function _showUpgradeHUD() {
        _refreshHUDVisibility();
    }

    function _hideAll() {
        visible = false;
        if (healthBar) healthBar.setVisible(false);
        if (healthBtn) healthBtn.setVisible(false).setState(DISABLE);
        if (currencyCluster) currencyCluster.setVisible(false);

        if (endIterationBtn) endIterationBtn.setVisible(false).setState(DISABLE);
        if (bombBtn) bombBtn.setVisible(false).setState(DISABLE);
        if (bombIcon) bombIcon.setVisible(false);
        if (testDefensesBtn) testDefensesBtn.setVisible(false).setState(DISABLE);
        if (waveProgressBar) waveProgressBar.setVisible(false);
        if (farmingTimerTxt) farmingTimerTxt.setVisible(false);
        isFarming = false;
    }

    // ── event handlers ───────────────────────────────────────────────────────
    function _onTransitionComplete() {
        if (gameStateMachine.getPhase() === GAME_CONSTANTS.PHASE_COMBAT && endIterationBtn) {
            endIterationBtn.setVisible(true);
            endIterationBtn.setState(NORMAL);
        }
    }

    function _onBossDefeated() {
        if (endIterationBtn) endIterationBtn.setState(DISABLE);
    }

    function _onFarmingStarted() {
        if (waveProgressBar) waveProgressBar.setVisible(false);
        isFarming = true;
        _playFarmingTimerFlicker();
    }

    function _onNormalWaveStarted() {
        setWaveProgressBarVisible(true);
        isFarming = false;
        if (farmingTimerTxt) farmingTimerTxt.setVisible(false);
    }

    function _onPhaseChanged(phase) {
        bombCanCancel = false;
        clearBombPulse();
        if (phase === GAME_CONSTANTS.PHASE_COMBAT) _showCombatHUD();
        else if (phase === GAME_CONSTANTS.PHASE_UPGRADE) _showUpgradeHUD();
        else _hideAll();
    }

    function _onHealthChanged(current, max) {
        if (healthBar) healthBar.update(current, max);
    }

    function _onCurrencyChanged(type, amount) {
        if (currencyCluster) {
            currencyCluster.setStaticValue(type, amount);
            needsLayoutUpdate = true;
        }
    }

    function _onUpgradePurchased() {
        if (currencyCluster) {
            currencyCluster.refreshAll();
            needsLayoutUpdate = true;
        }
        _updateBombUI();
        refreshTestDefensesButton();
    }

    function _update(delta) {
        layoutFrameCounter++;
        if (layoutFrameCounter % 5 === 0 && needsLayoutUpdate) {
            if (visible && currencyCluster) {
                currencyCluster.updateLayout(true, gameStateMachine.getPhase() === GAME_CONSTANTS.PHASE_UPGRADE);
                needsLayoutUpdate = false;
            }
        }

        if (isFarming && farmingTimerTxt && farmingTimerTxt.visible) {
            const totalSec = Math.floor(enemyManager.getRoundTimeElapsed());
            if (farmingTimerTxt.lastSec !== totalSec) {
                farmingTimerTxt.lastSec = totalSec;
                farmingTimerTxt.setText(helper.formatTime(totalSec));
            }
        }
    }

    function _getResourceVal(id) {
        return helper.getResource(id);
    }

    function _onWaveProgressChanged(progress) {
        if (waveProgressBar) waveProgressBar.setProgress(progress);
    }

    function _onTowerDeathStarted() {
        endIterationBtn.setVisible(false).setState(DISABLE);
    }

    function _playFarmingTimerFlicker() {
        if (!farmingTimerTxt) return;

        farmingTimerTxt.lastSec = -1;
        farmingTimerTxt.setText('00:00');
        farmingTimerTxt.setVisible(true).setAlpha(0);

        // Wait 0.5s before starting the flicker sequence
        PhaserScene.time.delayedCall(500, () => {
            if (!isFarming) return;

            const steps = [
                { alpha: 0.5, delay: 40 },
                { alpha: 0, delay: 75 },
                { alpha: 0.6, delay: 200 },
                { alpha: 0.4, delay: 75 },
                { alpha: 1, delay: 0 }
            ];
            _flickerElement(farmingTimerTxt, steps);
        });
    }

    function setWaveProgressBarVisible(vis) {
        if (!waveProgressBar) return;
        waveProgressBar.setVisible(vis);

        if (vis) {
            const steps = [
                { alpha: 0.5, borderAlpha: 0.3, delay: 40 },
                { alpha: 0, borderAlpha: 0, delay: 100 },
                { alpha: 0.6, borderAlpha: 0.4, delay: 40 },
                { alpha: 0, borderAlpha: 0, delay: 350 },
                { alpha: 0.7, borderAlpha: 0.4, delay: 250 },
                { alpha: 0.4, borderAlpha: 0.2, delay: 100 },
                { alpha: 1, borderAlpha: 0.5, delay: 400 },
                { alpha: 1, borderAlpha: 0.6, delay: 0 }
            ];
            _flickerElement(waveProgressBar, steps);
        }
    }

    function refreshTestDefensesButton() {
        if (!testDefensesBtn) return;
        const isUnlocked = !!(typeof gameState !== 'undefined' && gameState.upgrades && gameState.upgrades.test_defenses_unlocked);

        // Hide if tree is in full view expansion
        const isFullView = (typeof upgradeTree !== 'undefined' && upgradeTree.isFullView && upgradeTree.isFullView());
        const show = isUnlocked && !isFullView;

        testDefensesBtn.setVisible(show).setState(show ? NORMAL : DISABLE);
    }

    function setAlpha(alpha) {
        if (healthBar) healthBar.setAlpha(alpha);
        if (healthBtn) healthBtn.setAlpha(alpha);
        if (currencyCluster) currencyCluster.setAlpha(alpha);
        if (endIterationBtn) endIterationBtn.setAlpha(alpha);
        if (testDefensesBtn) testDefensesBtn.setAlpha(alpha);
        if (waveProgressBar) waveProgressBar.setAlpha(alpha);
        if (farmingTimerTxt) farmingTimerTxt.setAlpha(alpha);
        if (bombBtn) bombBtn.setAlpha(alpha);
    }

    function setBombPulse() {
        if (!bombBtn || bombPulseIndicator || bombPulseTimer) return;
        function playPulse() {
            if (!bombBtn || !bombBtn.visible) return;
            const bx = bombBtn.x;
            const by = bombBtn.y;
            const bw = bombBtn.displayWidth;
            const bh = bombBtn.displayHeight;
            bombPulseIndicator = helper.ninesliceIndicatorShort(bx, by, 'buttons', 'button_normal.png', bw + 60, bh + 60, bw, bh, 24);
            bombPulseIndicator.setDepth(bombBtn.depth - 1);
            bombPulseTimer = PhaserScene.time.delayedCall(5000, () => {
                if (bombPulseIndicator) bombPulseIndicator.destroy();
                bombPulseIndicator = null;
                bombPulseTimer = null;
                playPulse();
            });
        }
        playPulse();
    }

    function clearBombPulse() {
        if (bombPulseIndicator) {
            bombPulseIndicator.destroy();
            bombPulseIndicator = null;
        }
        if (bombPulseTimer) {
            bombPulseTimer.destroy();
            bombPulseTimer = null;
        }
    }

    function setTestButtonVisible(vis) {
        if (!testDefensesBtn) return;
        // This is now mostly handled by _refreshHUDVisibility, but we keep it 
        // for explicit overrides if needed.
        testDefensesBtn.setVisible(vis);
        if (!vis) testDefensesBtn.setState(DISABLE);
        else refreshTestDefensesButton();
    }

    function setBombButtonVisible(vis) {
        if (!bombBtn) return;
        bombBtn.setVisible(vis);
        if (bombIcon) bombIcon.setVisible(vis);
        if (!vis) bombBtn.setState(DISABLE);
        else _updateBombUI();
    }

    function setHealthBtnVisible(vis) {
        if (!healthBtn) return;
        healthBtn.setVisible(vis).setState(vis ? NORMAL : DISABLE);
    }

    function setCurrencyHUDShifted(shifted) {
        // Reverted to standalone HUD: no longer shifts with tree
    }

    return { init, setWaveProgressBarVisible, refreshTestDefensesButton, setTestButtonVisible, setBombButtonVisible, setHealthBtnVisible, setCurrencyHUDShifted, setAlpha, setBombPulse, clearBombPulse };
})();
