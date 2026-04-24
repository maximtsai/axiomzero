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
    let isFarming = false;
    let bombCanCancel = false;
    let bombPulseIndicator = null;
    let bombPulseTimer = null;

    // Layout
    const HUD_X = 20;
    const HUD_Y = 20;
    const BAR_W = 200;
    const BAR_H = helper.isMobileDevice() ? 28 : 24;
    const BAR_GAP = helper.isMobileDevice() ? 18 : 14;

    let visible = false;
    let needsLayoutUpdate = false;
    let layoutFrameCounter = 0;

    // ── init ─────────────────────────────────────────────────────────────────

    function init() {
        _createElements();
        _hideAll();
        messageBus.subscribe('phaseChanged', _onPhaseChanged);
        messageBus.subscribe('healthChanged', _onHealthChanged);
        messageBus.subscribe('currencyChanged', _onCurrencyChanged);
        messageBus.subscribe('upgradePurchased', _onUpgradePurchased);
        messageBus.subscribe('towerDeathStarted', _onTowerDeathStarted);
        messageBus.subscribe('waveProgressChanged', _onWaveProgressChanged);
        messageBus.subscribe('bossDefeated', () => {
            if (endIterationBtn) endIterationBtn.setState(DISABLE);
        });

        messageBus.subscribe('transitionComplete', () => {
            if (gameStateMachine.getPhase() === GAME_CONSTANTS.PHASE_COMBAT && endIterationBtn) {
                endIterationBtn.setVisible(true);
                endIterationBtn.setState(NORMAL);
            }
        });

        messageBus.subscribe('cursorBombArmed', () => {
            if (bombBtn) bombBtn.setState(DISABLE);
        });
        messageBus.subscribe('bombUsesChanged', _updateBombUI);
        messageBus.subscribe('cursorBombReady', () => {
            bombCanCancel = false;
            _updateBombUI();
        });
        messageBus.subscribe('cursorBombCanCancel', () => {
            bombCanCancel = true;
            _updateBombUI();
        });
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

        messageBus.subscribe('waveModeFarmingStarted', () => {
            if (waveProgressBar) waveProgressBar.setVisible(false);
            isFarming = true;
            _playFarmingTimerFlicker();
        });
        messageBus.subscribe('waveModeNormalStarted', () => {
            setWaveProgressBarVisible(true);
            isFarming = false;
            if (farmingTimerTxt) farmingTimerTxt.setVisible(false);
        });

        updateManager.addFunction(_update);
    }

    function _createElements() {
        const depth = GAME_CONSTANTS.DEPTH_UPGRADE_TREE + 2;
        const groupX = GAME_CONSTANTS.halfWidth + 10 + HUD_X;

        // 1. Health Bar Component
        healthBar = new HealthBar({
            x: groupX,
            y: HUD_Y,
            width: BAR_W,
            height: BAR_H,
            depth: depth
        });

        // Invisible button overlay for health bar info
        healthBtn = new Button({
            normal: { ref: 'wide_pointer2_normal.png', atlas: 'buttons', x: groupX + 101, y: HUD_Y + (BAR_H / 2) },
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
        healthBtn.setOrigin(0.5, 0.5).setScale(1.05, helper.isMobileDevice() ? 1.1 : 1.05).setDepth(depth + 1).setScrollFactor(0).setVisible(false);

        // 2. Currency Cluster Component
        const currY = HUD_Y + BAR_H + BAR_GAP + 13;
        const spacing = helper.isMobileDevice() ? 40 : 36;
        currencyCluster = new CurrencyCluster({
            x: groupX,
            y: currY,
            depth: depth,
            spacing: spacing
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
            normal: { ref: helper.isMobileDevice() ? 'button_normal_mobile.png' : 'button_normal.png', atlas: 'buttons', x: 105, y: GAME_CONSTANTS.HEIGHT - 69, alpha: 1 },
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
        endIterationBtn.setDepth(depth + 3).setScrollFactor(0);

        bombBtn = new Button({
            normal: { ref: helper.isMobileDevice() ? 'button_normal_mobile.png' : 'button_normal.png', atlas: 'buttons', x: GAME_CONSTANTS.WIDTH - 105, y: GAME_CONSTANTS.HEIGHT - 69, alpha: 1 },
            hover: { ref: 'button_hover.png', atlas: 'buttons', alpha: 1 },
            press: { ref: 'button_press.png', atlas: 'buttons', alpha: 1 },
            disable: { ref: 'button_press.png', atlas: 'buttons', alpha: 0.5 },
            onMouseUp: () => {
                if (bombCanCancel) {
                    if (typeof pulseAttack !== 'undefined' && pulseAttack.cancelBomb) pulseAttack.cancelBomb();
                } else {
                    _armBomb();
                }
            },
        });
        bombBtn.setScale(0.675);
        const bombKeyHint = helper.isMobileDevice() ? "<CLICK>" : "<SPACEBAR>";
        bombBtnTxt = bombBtn.addText(`BOMB\n${bombKeyHint}`, {
            fontFamily: 'JetBrainsMono_Bold',
            fontSize: '19px',
            color: GAME_CONSTANTS.COLOR_NEUTRAL,
            align: 'center'
        });
        bombBtn.setDepth(depth + 3).setScrollFactor(0);

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
        testDefensesBtn.setDepth(depth + 3).setScrollFactor(0).setVisible(false);

        farmingTimerTxt = PhaserScene.add.text(20, GAME_CONSTANTS.HEIGHT - 22, '00:00', {
            fontFamily: 'JetBrainsMono_Regular',
            fontSize: '24px',
            color: '#00f5ff', // Cyan matching the progress bar
            stroke: '#000000',
            strokeThickness: 1
        }).setOrigin(0, 0.5).setDepth(depth + 1).setScrollFactor(0).setVisible(false);
        farmingTimerTxt.setShadow(0, 0, '#000000', 3, true, true);

        // 4. Wave Progress Bar (Restore missing initialization)
        waveProgressBar = new ProgressBar(PhaserScene, {
            x: GAME_CONSTANTS.halfWidth,
            y: GAME_CONSTANTS.HEIGHT - 26,
            width: 1570,
            height: 18,
            padding: 6,
            bgColor: 0x1a1e2e,
            fillColor: 0x00f5ff,
            depth: depth
        });
        waveProgressBar.setVisible(false);
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
        bombBtn.setVisible(hasBombs);
        if (hasBombs) {
            if (bombCanCancel) {
                bombBtn.setState(NORMAL);
                if (bombBtnTxt) bombBtnTxt.setText(`CANCEL\n(CLICK)`);
            } else {
                if (model.bombUses > 0 && !model.bombArmed && !model.bombFired) {
                    bombBtn.setState(NORMAL);
                } else {
                    bombBtn.setState(DISABLE);
                }
                const bombKeyHint = helper.isMobileDevice() ? "<CLICK>" : "<SPACEBAR>";
                if (bombBtnTxt) bombBtnTxt.setText(`BOMB (${model.bombUses}/${model.maxBombUses})\n${bombKeyHint}`);
            }
        }
    }

    function _showCombatHUD() {
        visible = true;
        healthBar.setVisible(true);
        healthBtn.setVisible(false).setState(DISABLE);

        currencyCluster.updateLayout(true, false);

        if (!isFarming) {
            setWaveProgressBarVisible(true);
        }

        const isTrans = typeof transitionManager !== 'undefined' && transitionManager.isTransitioning();
        endIterationBtn.setVisible(!isTrans).setState(isTrans ? DISABLE : NORMAL);

        if (bombBtn) _updateBombUI();
        if (testDefensesBtn) testDefensesBtn.setVisible(false).setState(DISABLE);
    }

    function _showUpgradeHUD() {
        visible = true;
        healthBar.setVisible(true);

        const isFullView = (typeof upgradeTree !== 'undefined' && upgradeTree.isFullView && upgradeTree.isFullView());
        setHealthBtnVisible(!isFullView);

        currencyCluster.updateLayout(true, true);

        // Count up animation for currencies when entering upgrade phase
        ['data', 'insight', 'shard', 'coin', 'processor'].forEach(id => {
            const val = _getResourceVal(id);
            if (val >= 2) currencyCluster.animateToValue(id, val);
            else currencyCluster.setStaticValue(id, val);
        });

        endIterationBtn.setVisible(false).setState(DISABLE);
        if (bombBtn) _updateBombUI();
        if (waveProgressBar) waveProgressBar.setVisible(false);

        refreshTestDefensesButton();
    }

    function _hideAll() {
        visible = false;
        if (healthBar) healthBar.setVisible(false);
        if (healthBtn) healthBtn.setVisible(false).setState(DISABLE);
        if (currencyCluster) currencyCluster.setVisible(false);

        endIterationBtn.setVisible(false).setState(DISABLE);
        if (bombBtn) bombBtn.setVisible(false).setState(DISABLE);
        if (testDefensesBtn) testDefensesBtn.setVisible(false).setState(DISABLE);
        if (waveProgressBar) waveProgressBar.setVisible(false);
        if (farmingTimerTxt) farmingTimerTxt.setVisible(false);
        isFarming = false;
    }

    // ── event handlers ───────────────────────────────────────────────────────

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

            // Flicker Sequence (Matching waveProgressBar timings)
            farmingTimerTxt.setAlpha(0.5);

            PhaserScene.time.delayedCall(40, () => {
                farmingTimerTxt.setAlpha(0);

                PhaserScene.time.delayedCall(75, () => {
                    farmingTimerTxt.setAlpha(0.6);
                    PhaserScene.time.delayedCall(200, () => {
                        farmingTimerTxt.setAlpha(0.4);
                        PhaserScene.time.delayedCall(75, () => {
                            farmingTimerTxt.setAlpha(1);
                        });
                    });
                });
            });
        });
    }

    function setWaveProgressBarVisible(vis) {
        if (!waveProgressBar) return;
        waveProgressBar.setVisible(vis);

        if (vis) {
            // Animation sequence:
            // 0.5 alpha, wait 0.05s (50ms), 0 alpha, wait 0.2s (200ms), 0.5 alpha, wait 0.1s (100ms), 0 alpha, wait 0.75s (750ms), 1 alpha.
            waveProgressBar.setAlpha(0.5);
            waveProgressBar.setBorderAlpha(0.3);

            PhaserScene.time.delayedCall(40, () => {
                waveProgressBar.setAlpha(0);
                waveProgressBar.setBorderAlpha(0);

                PhaserScene.time.delayedCall(100, () => {
                    waveProgressBar.setAlpha(0.6);
                    waveProgressBar.setBorderAlpha(0.4);

                    PhaserScene.time.delayedCall(40, () => {
                        waveProgressBar.setAlpha(0);
                        waveProgressBar.setBorderAlpha(0);

                        PhaserScene.time.delayedCall(350, () => {
                            waveProgressBar.setAlpha(0.7);
                            waveProgressBar.setBorderAlpha(0.4);

                            PhaserScene.time.delayedCall(250, () => {
                                waveProgressBar.setAlpha(0.4);
                                waveProgressBar.setBorderAlpha(0.2);
                                PhaserScene.time.delayedCall(100, () => {
                                    waveProgressBar.setAlpha(1);
                                    waveProgressBar.setBorderAlpha(0.5);
                                    PhaserScene.time.delayedCall(400, () => {
                                        waveProgressBar.setBorderAlpha(0.6);
                                    });
                                });
                            });
                        });
                    });
                });
            });
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

    function setTestButtonVisible(visible) {
        if (!testDefensesBtn) return;
        testDefensesBtn.setVisible(visible);
        if (!visible) testDefensesBtn.setState(DISABLE);
        else refreshTestDefensesButton(); // ensures state matches unlock status if shown
    }

    function setHealthBtnVisible(visible) {
        if (!healthBtn) return;
        healthBtn.setVisible(visible).setState(visible ? NORMAL : DISABLE);
    }

    return { init, setWaveProgressBarVisible, refreshTestDefensesButton, setTestButtonVisible, setHealthBtnVisible, setAlpha, setBombPulse, clearBombPulse };
})();
