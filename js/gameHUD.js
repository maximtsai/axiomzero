// gameHUD.js
// In-game HUD: health bar, EXP bar, currency counters, END ITERATION button.
// All elements use JetBrainsMono. Show/hide based on phaseChanged.

const gameHUD = (() => {
    // ── HUD elements ─────────────────────────────────────────────────────────
    let healthBarBg = null;
    let healthBarFill = null;
    let healthBarFlare = null;
    let healthText = null;
    let healthBtn = null;
    let resourceUI = {}; // { data: { icon, text }, ... }
    let lastHealth = -1;

    let endIterationBtn = null;
    let testDefensesBtn = null;
    let waveProgressBar = null;
    let farmingTimerTxt = null;
    let roundDataTxt = null;
    let farmingStartTime = 0;
    let isFarming = false;

    // Layout
    const HUD_X = 20;
    const HUD_Y = 20;
    const BAR_W = 200;
    const BAR_H = helper.isMobileDevice() ? 28 : 24;
    const BAR_GAP = helper.isMobileDevice() ? 18 : 14;
    const DATA_ICON_SIZE = 18;
    const DATA_ICON_GAP = 5;

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
        messageBus.subscribe('enemyKilled', _onEnemyKilled);
        messageBus.subscribe('upgradePurchased', _onUpgradePurchased);
        messageBus.subscribe('towerDeathStarted', _onTowerDeathStarted);
        messageBus.subscribe('waveProgressChanged', _onWaveProgressChanged);
        messageBus.subscribe('bossDefeated', () => {
            if (endIterationBtn) endIterationBtn.setState(DISABLE);
        });
        messageBus.subscribe('AnnounceText', showAnnounceMessage);
        messageBus.subscribe('BossAnnounceText', ({ msg1, msg2 }) => showBossAnnouncement(msg1, msg2));

        messageBus.subscribe('waveModeFarmingStarted', () => {
            if (waveProgressBar) waveProgressBar.setVisible(false);
            isFarming = true;
            farmingStartTime = Date.now();
            if (farmingTimerTxt) {
                farmingTimerTxt.setVisible(false); // Ensure hidden initially
                PhaserScene.time.delayedCall(450, () => {
                    if (isFarming && farmingTimerTxt) {
                        farmingTimerTxt.setVisible(true).setAlpha(0.2);
                        farmingTimerTxt.setText('00:00');
                        PhaserScene.tweens.add({
                            targets: farmingTimerTxt,
                            alpha: 1,
                            duration: 1000,
                            ease: 'Power1'
                        });
                    }
                });
            }
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

        // ── Health bar ──
        healthBarBg = PhaserScene.add.image(groupX, HUD_Y, 'white_pixel');
        healthBarBg.setOrigin(0, 0).setDisplaySize(BAR_W, BAR_H).setTint(GAME_CONSTANTS.HEALTH_BAR_TINT).setDepth(depth).setScrollFactor(0);

        healthBarFlare = PhaserScene.add.image(groupX, HUD_Y + BAR_H / 2, 'ui', 'white_vertical_line.png');
        healthBarFlare.setOrigin(0.5, 0.5).setScale(1, 0.75).setTint(0xffffff).setDepth(depth + 1).setScrollFactor(0);
        healthBarFlare.setAlpha(0);

        healthBarFill = PhaserScene.add.image(groupX, HUD_Y, 'white_pixel');
        healthBarFill.setOrigin(0, 0).setDisplaySize(BAR_W, BAR_H).setTint(0x00ff66).setDepth(depth + 2).setScrollFactor(0);

        healthText = PhaserScene.add.text(groupX + BAR_W + 8, HUD_Y - 4, '', {
            fontFamily: 'JetBrainsMono_Regular',
            fontSize: helper.isMobileDevice() ? '30px' : '26px',
            color: GAME_CONSTANTS.COLOR_NEUTRAL,
        }).setOrigin(0, 0).setDepth(depth + 2).setScrollFactor(0);

        healthBtn = new Button({
            normal: { ref: 'wide_pointer2_normal.png', atlas: 'buttons', x: groupX + 95, y: HUD_Y + (BAR_H / 2) },
            hover: { ref: 'wide_pointer2_hover.png', atlas: 'buttons', x: groupX + 95, y: HUD_Y + (BAR_H / 2) },
            press: { ref: 'wide_pointer2_hover.png', atlas: 'buttons', x: groupX + 95, y: HUD_Y + (BAR_H / 2) },
            disable: { ref: 'wide_pointer2_normal.png', atlas: 'buttons', x: groupX + 95, y: HUD_Y + (BAR_H / 2) },
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
        healthBtn.setOrigin(0.5, 0.5);
        healthBtn.setScale(1, helper.isMobileDevice() ? 1.05 : 1);
        healthBtn.setDepth(depth + 1);
        healthBtn.setScrollFactor(0);
        healthBtn.setVisible(false);

        // ── Currency counters ──
        const currY = HUD_Y + BAR_H + BAR_GAP + 13;
        const resourceTypes = [
            { id: 'data', icon: 'resrc_data.png', color: '#00f5ff' },
            { id: 'insight', icon: 'resrc_insight.png', color: GAME_CONSTANTS.COLOR_NEUTRAL },
            { id: 'shard', icon: 'resrc_shard.png', color: '#ffb300' },
            { id: 'coin', icon: 'resrc_coin.png', color: '#00ff66' },
            { id: 'processor', icon: 'resrc_processor.png', color: '#ffe600' }
        ];

        resourceTypes.forEach((type, i) => {
            const icon = PhaserScene.add.image(groupX + 11, currY, 'player', type.icon);
            icon.setOrigin(0.5, 0.5).setDepth(depth + 2).setScrollFactor(0).setVisible(false);

            const scale = (type.id === 'data') ? 1 : 1.06;
            icon.setScale(scale);

            // Fetch initial value from resourceManager
            const initialVal = _getResourceValue(type.id);

            const text = PhaserScene.add.text(groupX + 28, currY - 11, Math.floor(initialVal).toString(), {
                fontFamily: 'JetBrainsMono_Regular',
                fontSize: helper.isMobileDevice() ? '32px' : '27px',
                color: type.color,
            }).setOrigin(0, 0).setDepth(depth + 2).setScrollFactor(0).setVisible(false);

            // Button background for upgrade phase
            let btn;
            btn = new Button({
                normal: { ref: 'wide_pointer_normal.png', atlas: 'buttons', x: groupX + 45, y: currY },
                hover: { ref: 'wide_pointer_hover.png', atlas: 'buttons', x: groupX + 45, y: currY },
                press: { ref: 'wide_pointer_hover.png', atlas: 'buttons', x: groupX + 45, y: currY },
                disable: { ref: 'wide_pointer_normal.png', atlas: 'buttons', x: groupX + 45, y: currY },
                onHover: () => {
                    let sfxclick = audio.play('click', 0.95);
                    if (sfxclick) sfxclick.detune = Phaser.Math.Between(-150, -50);
                    tooltipManager.show(btn.x + 50, btn.y + 17, [
                        { text: t('hud', `${type.id}_title`), style: 'title', color: type.color },
                        { text: t('hud', `${type.id}_desc`), style: 'normal' }
                    ], 410);
                    if (typeof upgradeTree !== 'undefined') {
                        upgradeTree.setHoverLabel(type.id.toUpperCase());
                    }
                },
                onHoverOut: () => {
                    tooltipManager.hide();
                    if (typeof upgradeTree !== 'undefined') {
                        upgradeTree.setHoverLabel(null);
                    }
                }
            });
            btn.setOrigin(0.5, 0.5);
            btn.setScale(1, helper.isMobileDevice() ? 1.05 : 1);
            btn.setDepth(depth + 1);
            btn.setScrollFactor(0);
            btn.setVisible(false);

            resourceUI[type.id] = { icon, text, btn, baseY: currY };
        });

        _updateResourceLayout();

        if (typeof upgradeTree !== 'undefined' && upgradeTree.getGroup) {
            const treeGroup = upgradeTree.getGroup();
            if (treeGroup) {
                treeGroup.add(healthBarBg);
                treeGroup.add(healthBarFill);
                treeGroup.add(healthBarFlare);
                treeGroup.add(healthText);
                if (healthBtn.getContainer) treeGroup.add(healthBtn.getContainer());
                Object.values(resourceUI).forEach(res => {
                    treeGroup.add(res.icon);
                    treeGroup.add(res.text);
                    if (res.btn && res.btn.getContainer) treeGroup.add(res.btn.getContainer());
                });
            }
        }



        endIterationBtn = new Button({
            normal: {
                ref: 'button_normal.png',
                atlas: 'buttons',
                x: helper.isMobileDevice() ? 105 : GAME_CONSTANTS.WIDTH - 100,
                y: GAME_CONSTANTS.HEIGHT - (helper.isMobileDevice() ? 38 : 35),
            },
            hover: {
                ref: 'button_hover.png',
                atlas: 'buttons',
                x: helper.isMobileDevice() ? 105 : GAME_CONSTANTS.WIDTH - 100,
                y: GAME_CONSTANTS.HEIGHT - (helper.isMobileDevice() ? 38 : 35),
            },
            press: {
                ref: 'button_press.png',
                atlas: 'buttons',
                x: helper.isMobileDevice() ? 105 : GAME_CONSTANTS.WIDTH - 100,
                y: GAME_CONSTANTS.HEIGHT - (helper.isMobileDevice() ? 38 : 35),
            },
            onMouseUp: () => {
                messageBus.publish('endIterationRequested');
            },
        });
        endIterationBtn.setScale(helper.isMobileDevice() ? 1.0 : 0.9);
        endIterationBtn.addText(t('ui', 'end_iteration'), {
            fontFamily: 'JetBrainsMono_Bold',
            fontSize: helper.isMobileDevice() ? '18px' : '19px',
            color: GAME_CONSTANTS.COLOR_NEUTRAL,
        });
        endIterationBtn.setDepth(depth + 3);
        endIterationBtn.setScrollFactor(0);

        // ── Progress bar ──
        waveProgressBar = new ProgressBar(PhaserScene, {
            x: helper.isMobileDevice() ? 898 : 705,
            y: GAME_CONSTANTS.HEIGHT - 22,
            width: GAME_CONSTANTS.WIDTH - (helper.isMobileDevice() ? 234 : 220),
            height: 20,
            padding: 7,
            bgColor: 0x1a1e2e,
            fillColor: 0x00f5ff,
            depth: depth
        });
        waveProgressBar.setVisible(false);

        testDefensesBtn = new Button({
            normal: {
                ref: 'button_normal.png',
                atlas: 'buttons',
                x: GAME_CONSTANTS.halfWidth,
                y: GAME_CONSTANTS.HEIGHT - 57,
                alpha: 1
            },
            hover: {
                ref: 'button_hover.png',
                atlas: 'buttons',
                x: GAME_CONSTANTS.halfWidth,
                y: GAME_CONSTANTS.HEIGHT - 57,
            },
            press: {
                ref: 'button_press.png',
                atlas: 'buttons',
                x: GAME_CONSTANTS.halfWidth,
                y: GAME_CONSTANTS.HEIGHT - 57,
            },
            disable: {
                ref: 'button_press.png',
                atlas: 'buttons',
                x: GAME_CONSTANTS.halfWidth,
                y: GAME_CONSTANTS.HEIGHT - 57,
                alpha: 0
            },
            onMouseUp: () => {
                if (typeof enemyManager !== 'undefined') {
                    enemyManager.startTestingDefenses();
                }
                if (typeof GAME_VARS !== 'undefined') {
                    GAME_VARS.testingDefenses = true;
                }
            },
            onHover: () => {
                let sfx = audio.play('click', 0.95);
                if (sfx) sfx.detune = Phaser.Math.Between(-50, 50);
                if (typeof upgradeTree !== 'undefined') {
                    upgradeTree.setHoverLabel("CREATE\nTEST ENEMIES");
                }
            },
            onHoverOut: () => {
                if (typeof upgradeTree !== 'undefined') {
                    upgradeTree.setHoverLabel(null);
                }
            }
        });
        testDefensesBtn.setScale(0.9);
        testDefensesBtn.addText(t('ui', 'test_weapons'), {
            fontFamily: 'JetBrainsMono_Bold',
            fontSize: '19px',
            color: GAME_CONSTANTS.COLOR_NEUTRAL,
        });
        testDefensesBtn.setDepth(depth + 3);
        const isUnlocked = typeof gameState !== 'undefined' && gameState.upgrades && gameState.upgrades.test_defenses_unlocked;
        testDefensesBtn.setVisible(isUnlocked);
        if (!isUnlocked) testDefensesBtn.setState(DISABLE);

        // ── Farming timer ──
        farmingTimerTxt = PhaserScene.add.text(24, GAME_CONSTANTS.HEIGHT - 35, '00:00', {
            fontFamily: 'JetBrainsMono_Bold',
            fontSize: '24px',
            color: '#00f5ff',
        }).setOrigin(0, 0.5).setDepth(depth + 1).setScrollFactor(0).setVisible(false);
        farmingTimerTxt.setShadow(2, 2, '#000000', 2, true, true);

        // ── Round Data counter ──
        roundDataTxt = PhaserScene.add.text(24, GAME_CONSTANTS.HEIGHT - 62, 'DATA: 0', {
            fontFamily: 'JetBrainsMono_Bold',
            fontSize: '24px',
            color: '#00f5ff',
        }).setOrigin(0, 0.5).setDepth(depth + 1).setScrollFactor(0).setVisible(false);
        roundDataTxt.setShadow(2, 2, '#000000', 2, true, true);
    }

    // ── show / hide ──────────────────────────────────────────────────────────

    function _showCombatHUD() {
        visible = true;
        healthBarBg.setVisible(true);
        healthBarFill.setVisible(true);
        healthBarFlare.setVisible(true);
        healthText.setVisible(true);
        healthBtn.setVisible(false);
        healthBtn.setState(DISABLE);
        _updateResourceLayout();
        endIterationBtn.setVisible(true);
        endIterationBtn.setState(NORMAL);
        if (roundDataTxt) roundDataTxt.setVisible(true).setText('DATA: 0');
        if (testDefensesBtn) {
            testDefensesBtn.setVisible(false);
            testDefensesBtn.setState(DISABLE);
        }
    }

    function _hideAll() {
        visible = false;
        healthBarBg.setVisible(false);
        healthBarFill.setVisible(false);
        healthBarFlare.setVisible(false);
        healthText.setVisible(false);
        healthBtn.setVisible(false);
        healthBtn.setState(DISABLE);
        Object.values(resourceUI).forEach(res => {
            if (res.btn) res.btn.setVisible(false);
            res.icon.setVisible(false);
            res.text.setVisible(false);
        });
        endIterationBtn.setVisible(false);
        endIterationBtn.setState(DISABLE);
        if (testDefensesBtn) {
            testDefensesBtn.setVisible(false);
            testDefensesBtn.setState(DISABLE);
        }
        if (waveProgressBar) waveProgressBar.setVisible(false);
        if (farmingTimerTxt) farmingTimerTxt.setVisible(false);
        if (roundDataTxt) roundDataTxt.setVisible(false);
        isFarming = false;
    }

    // ── event handlers ───────────────────────────────────────────────────────

    function _onPhaseChanged(phase) {
        if (phase === GAME_CONSTANTS.PHASE_COMBAT) {
            _showCombatHUD();
        } else if (phase === GAME_CONSTANTS.PHASE_UPGRADE) {
            // During upgrade, show currencies but hide combat-only elements
            _showUpgradeHUD();
        } else {
            _hideAll();
        }
    }

    function _showUpgradeHUD() {
        visible = true;

        // Show all HUD elements grouped with the Upgrade Tree
        healthBarBg.setVisible(true);
        healthBarFill.setVisible(true);
        healthBarFlare.setVisible(true);
        healthText.setVisible(true);
        healthBtn.setVisible(true);
        healthBtn.setState(NORMAL);

        _updateResourceLayout();

        // Count up animation for currencies
        const order = ['data', 'insight', 'shard', 'coin', 'processor'];
        order.forEach(id => {
            const val = _getResourceValue(id);
            if (val >= 2) {
                _animateCurrencyCount(id, val);
            } else {
                if (resourceUI[id]) resourceUI[id].text.setText(Math.floor(val));
            }
        });

        // Hide combat-only elements
        endIterationBtn.setVisible(false);
        endIterationBtn.setState(DISABLE);
        if (waveProgressBar) waveProgressBar.setVisible(false);

        // Show test weapons button if unlocked
        if (testDefensesBtn) {
            const isUnlocked = typeof gameState !== 'undefined' && gameState.upgrades && gameState.upgrades.test_defenses_unlocked;
            testDefensesBtn.setVisible(isUnlocked);
            if (isUnlocked) {
                testDefensesBtn.setState(NORMAL);
            } else {
                testDefensesBtn.setState(DISABLE);
            }
        }
    }

    /**
     * Tween a currency counter from 0 to targetVal.
     * @param {string} id - resource id
     * @param {number} targetVal 
     */
    function _animateCurrencyCount(id, targetVal) {
        const ui = resourceUI[id];
        if (!ui || !ui.text) return;

        const duration = (id === 'data') ? 1000 : (250 + Math.floor(Math.random() * 250));
        const counter = { val: 0 };
        ui.text.setText('0');

        ui.countTween = PhaserScene.tweens.add({
            targets: counter,
            val: targetVal,
            duration: duration,
            ease: 'Quad.easeOut',
            onUpdate: () => {
                ui.text.setText(Math.floor(counter.val).toString());
            },
            onComplete: () => {
                ui.text.setText(Math.floor(targetVal).toString());
                ui.countTween = null;
            }
        });
    }

    function _onHealthChanged(current, max) {
        // Remove !visible guard to ensure health bar updates on load

        // Logarithmic scaling: 200px at 10 health, ~800px at 10,000 health
        // Formula: L = 222.3 * log10(max) - 89.2
        const logBase = Math.log10(GAME_CONSTANTS.TOWER_BASE_HEALTH);
        const dynamicW = Math.max(BAR_W, BAR_W + 222.3 * (Math.log10(max) - logBase));

        const ratio = Math.max(0, current / max);

        healthBarBg.setDisplaySize(dynamicW, BAR_H);
        healthBarFill.setDisplaySize(dynamicW * ratio, BAR_H);

        // Reposition text to the right of the dynamic bar
        healthText.x = healthBarBg.x + dynamicW + 8;

        // Color shift: cyan → red as health drops
        if (ratio > 0.5) {
            healthBarFill.setTint(0x00ff66);
        } else if (ratio > 0.25) {
            healthBarFill.setTint(GAME_CONSTANTS.COLOR_RESOURCE);
        } else {
            healthBarFill.setTint(GAME_CONSTANTS.COLOR_HOSTILE);
        }

        // Damage flare
        healthBarFlare.x = healthBarBg.x + dynamicW * ratio;

        if (lastHealth !== -1 && (lastHealth - current) >= 0.5) {
            healthBarFlare.setAlpha(1);
            healthBarFlare.scaleY = 2;
            PhaserScene.tweens.killTweensOf(healthBarFlare);
            PhaserScene.tweens.add({
                targets: healthBarFlare,
                scaleY: 0.85,
                ease: 'Quad.easeOut',
                duration: 500,
            });
            PhaserScene.tweens.add({
                targets: healthBarFlare,
                alpha: 0,
                duration: 500,
            });
        }
        lastHealth = current;

        healthText.setText(current.toFixed(1) + ' / ' + max.toFixed(0));
    }

    function _onCurrencyChanged(type, amount) {
        if (resourceUI[type]) {
            // Stop active count-up tween if balance changes while it's running
            if (resourceUI[type].countTween) {
                resourceUI[type].countTween.stop();
                resourceUI[type].countTween = null;
            }
            resourceUI[type].text.setText(Math.floor(amount));
            needsLayoutUpdate = true;
        }
    }

    function _update(delta) {
        layoutFrameCounter++;
        if (layoutFrameCounter % 5 === 0 && needsLayoutUpdate) {
            _updateResourceLayout();
            needsLayoutUpdate = false;
        }

        // Update farming timer if active
        if (isFarming && farmingTimerTxt && farmingTimerTxt.visible) {
            const totalSec = Math.floor(enemyManager.getRoundTimeElapsed());
            // Only update text object if the second has actually changed
            if (farmingTimerTxt.lastSec !== totalSec) {
                farmingTimerTxt.lastSec = totalSec;
                const mm = Math.floor(totalSec / 60).toString().padStart(2, '0');
                const ss = (totalSec % 60).toString().padStart(2, '0');
                farmingTimerTxt.setText(`${mm}:${ss}`);
            }
        }

        // Update round data counter if active
        if (roundDataTxt && roundDataTxt.visible) {
            const currentRoundData = Math.floor(resourceManager.getSessionData());
            if (roundDataTxt.lastVal !== currentRoundData) {
                roundDataTxt.lastVal = currentRoundData;
                roundDataTxt.setText(t('hud', 'data_round') + ': ' + currentRoundData);
            }
        }
    }

    function _updateResourceLayout() {
        if (!visible) return;

        let currentY = HUD_Y + BAR_H + BAR_GAP + 13;
        const spacing = helper.isMobileDevice() ? 41 : 37;
        const groupX = GAME_CONSTANTS.halfWidth + 10 + HUD_X;
        const isUpgradePhase = gameStateMachine.getPhase() === GAME_CONSTANTS.PHASE_UPGRADE;

        const order = ['data', 'insight', 'shard', 'coin', 'processor'];
        order.forEach(id => {
            const ui = resourceUI[id];
            const val = _getResourceValue(id);

            if (val > 0) {
                if (ui.btn) {
                    ui.btn.setVisible(isUpgradePhase);
                    ui.btn.setPos(groupX + 45, currentY);
                    ui.btn.setState(isUpgradePhase ? NORMAL : DISABLE);
                }
                ui.icon.setVisible(isUpgradePhase);
                ui.text.setVisible(isUpgradePhase);
                ui.icon.y = currentY + (helper.isMobileDevice() ? 2 : 0);
                ui.text.y = currentY - 16;
                currentY += spacing;
            } else {
                if (ui.btn) {
                    ui.btn.setVisible(false);
                    ui.btn.setState(DISABLE);
                }
                ui.icon.setVisible(false);
                ui.text.setVisible(false);
            }
        });

        // Recalculate offsets for items in the tree group (health/text)
        if (typeof upgradeTree !== 'undefined' && upgradeTree.getGroup) {
            const treeGroup = upgradeTree.getGroup();
            if (treeGroup && treeGroup.recalculateOffsets) {
                treeGroup.recalculateOffsets();
            }
        }
    }

    function _getResourceValue(id) {
        if (id === 'data') return resourceManager.getData();
        if (id === 'insight') return resourceManager.getInsight();
        if (id === 'shard') return resourceManager.getShards();
        if (id === 'processor') return resourceManager.getProcessors();
        if (id === 'coin') return resourceManager.getCoins();
        return 0;
    }

    function _onEnemyKilled() {
        // Could add kill counter later
    }

    function _onWaveProgressChanged(progress) {
        // Remove !visible guard to ensure wave progress updates on load
        if (waveProgressBar) waveProgressBar.setProgress(progress);
    }

    function _onTowerDeathStarted() {
        endIterationBtn.setVisible(false);
        endIterationBtn.setState(DISABLE);
    }

    function _onUpgradePurchased() {
        // Refresh currency display labels
        Object.keys(resourceUI).forEach(id => {
            const ui = resourceUI[id];
            // Stop active count-up tween if user buys something
            if (ui.countTween) {
                ui.countTween.stop();
                ui.countTween = null;
            }
            const val = _getResourceValue(id);
            ui.text.setText(Math.floor(val));
        });
        _updateResourceLayout();
    }


    /**
     * Show a centered transition message using a typewriter effect.
     * @param {string} msg 
     */
    function showBossAnnouncement(msg1, msg2) {
        const baseSize = (gameState.settings.bigFont ? 56 : 50);
        const fSize1 = Math.floor(baseSize * 0.8) + 'px';
        const fSize2 = Math.floor(baseSize * 1.5) + 'px';

        // 1. Measure both pieces for overall centering
        const tempTxt1 = PhaserScene.add.text(0, 0, msg1, { fontFamily: 'MunroSmall', fontSize: fSize1 });
        const tempTxt2 = PhaserScene.add.text(0, 0, msg2, { fontFamily: 'MunroSmall', fontSize: fSize2 });
        const h1 = tempTxt1.height;
        const h2 = tempTxt2.height;
        const totalHeight = h1 + h2 + 4; // 4px spacing
        const maxWidth = Math.max(tempTxt1.width, tempTxt2.width);
        tempTxt1.destroy();
        tempTxt2.destroy();

        const baseYPos = GAME_CONSTANTS.halfHeight - 320;
        const commonX = GAME_CONSTANTS.halfWidth;

        // Message 1 (Status)
        const txt1 = PhaserScene.add.text(commonX, baseYPos - totalHeight / 2, '', {
            fontFamily: 'MunroSmall',
            fontSize: fSize1,
            color: '#ffffff',
            align: 'center',
            stroke: '#000000',
            strokeThickness: 3,
        }).setOrigin(0.5, 0).setDepth(GAME_CONSTANTS.DEPTH_HUD + 10).setAlpha(1).setShadow(1, 2, '#000000', 4, true, true);

        // Message 2 (Boss Name)
        const txt2 = PhaserScene.add.text(commonX, txt1.y + h1 - 5, '', {
            fontFamily: 'MunroSmall',
            fontSize: fSize2,
            color: '#ffffff',
            align: 'center',
            stroke: '#000000',
            strokeThickness: 6,
        }).setOrigin(0.5, 0).setDepth(GAME_CONSTANTS.DEPTH_HUD + 10).setAlpha(1).setShadow(2, 3, '#000000', 8, true, true);

        // Decorative Line (centered between them or below)
        const line = PhaserScene.add.image(commonX, txt2.y + h2 + 10, 'ui', 'white_line.png');
        line.setDepth(GAME_CONSTANTS.DEPTH_HUD + 9).setAlpha(0).setScale(0, 1.0);

        // Line Animation
        PhaserScene.tweens.add({
            delay: 400,
            targets: line,
            scaleX: (maxWidth / line.width) * 1.2 + 0.5,
            alpha: 1,
            duration: 800,
            ease: 'Cubic.easeOut',
            onComplete: () => {
                PhaserScene.tweens.add({
                    targets: line,
                    alpha: 0.7,
                    duration: 1000,
                    yoyo: true,
                    repeat: -1
                });
            }
        });

        // Global Glitch/Glow effects
        audio.play('data_reveal', 1.0);

        PhaserScene.time.delayedCall(1200, () => {
            if (txt2.active) {
                glitchFX.triggerChromaticAberration(txt2, 700, 2.5);
                glitchFX.triggerAnnounceGlow(commonX, txt1.y + totalHeight / 2, 1600, totalHeight + 100);
            }
        });

        // Typewriter Logic Staged
        let idx1 = 0;
        let idx2 = 0;

        const type2 = () => {
            if (!txt2.scene) return;
            if (idx2 >= msg2.length) {
                _finalizeAnnouncement();
                return;
            }
            txt2.text += msg2[idx2++];
            // Slower typewriter for boss name
            PhaserScene.time.delayedCall(65, type2);
        };

        const type1 = () => {
            if (!txt1.scene) return;
            if (idx1 >= msg1.length) {
                // Done with message 1, start message 2 after a small dramatic pause
                PhaserScene.time.delayedCall(150, type2);
                return;
            }
            txt1.text += msg1[idx1++];
            // Faster typewriter for prefix
            PhaserScene.time.delayedCall(20, type1);
        };

        const _finalizeAnnouncement = () => {
            const linger = 4100;
            PhaserScene.time.delayedCall(linger, () => {
                if (!txt1.scene) return;
                // Final jitter/fade
                [txt1, txt2, line].forEach(obj => {
                    PhaserScene.tweens.add({
                        targets: obj,
                        alpha: 0,
                        duration: 800,
                        onComplete: () => obj.destroy()
                    });
                });
            });
        };

        // Kick off
        type1();
    }

    function showAnnounceMessage(msg) {
        // Measure final dimensions without delay symbols for proper centering
        const fSize = (gameState.settings.bigFont ? 56 : 50) + 'px';
        const measureMsg = msg.replaceAll('#', '');
        const tempTxt = PhaserScene.add.text(0, 0, measureMsg, {
            fontFamily: 'MunroSmall',
            fontSize: fSize,
        });
        const fullWidth = tempTxt.width;
        const fullHeight = tempTxt.height;
        tempTxt.destroy();

        const baseYPos = GAME_CONSTANTS.halfHeight - 310;
        const txt = PhaserScene.add.text(GAME_CONSTANTS.halfWidth - (fullWidth / 2), baseYPos - (fullHeight * 0.5), '', {
            fontFamily: 'MunroSmall',
            fontSize: fSize,
            color: '#ffffff',
            align: 'center',
            stroke: '#000000',
            strokeThickness: 4,
            lineSpacing: -4
        }).setOrigin(0, 0).setDepth(GAME_CONSTANTS.DEPTH_HUD + 10).setAlpha(1).setShadow(1, 2, '#000000', 6, true, true);

        const line = PhaserScene.add.image(GAME_CONSTANTS.halfWidth, txt.y + fullHeight + 10, 'ui', 'white_line.png');
        line.setDepth(GAME_CONSTANTS.DEPTH_HUD + 9).setAlpha(0).setScale(0, 1.0);

        PhaserScene.tweens.add({
            delay: 600,
            targets: line,
            scaleX: 4,
            alpha: 1,
            duration: 600,
            ease: 'Cubic.easeOut',
            onComplete: () => {
                PhaserScene.tweens.add({
                    targets: line,
                    alpha: 0.8,
                    duration: 800,
                });
            }
        });

        // Play reveal sound when string begins to appear
        audio.play('data_reveal', 0.8);

        // Apply chromatic glitch 0.75s after it pops up
        PhaserScene.time.delayedCall(750, () => {
            if (txt.active) {
                glitchFX.triggerChromaticAberration(txt, 600, 1.75);
            }
        });
        PhaserScene.time.delayedCall(250, () => {
            if (txt.active) {
                glitchFX.triggerAnnounceGlow(GAME_CONSTANTS.halfWidth, txt.y + fullHeight / 2, 1200, fullHeight + 30);
            }
        });

        let charIdx = 0;

        const typeChar = () => {
            if (!txt.scene) return;

            if (charIdx >= msg.length) {
                _transitionMessageDone();
                return;
            }

            const char = msg[charIdx];
            if (char === '#') {
                charIdx++;
                PhaserScene.time.delayedCall(400, typeChar);
            } else {
                txt.text += char;
                charIdx++;
                PhaserScene.time.delayedCall(25, typeChar);
            }
        };

        const _transitionMessageDone = () => {
            const baseX = txt.x;
            const baseY = txt.y;
            const lineBaseX = line.x;
            const lineBaseY = line.y;

            const lingerTime = msg.includes('\n') ? 3400 : 2850;
            PhaserScene.time.delayedCall(lingerTime, () => {
                // Glitch jitter phase — erratic shaking + alpha flicker
                let jitterCount = 0;
                const jitterTotal = 8;
                const jitterEvent = PhaserScene.time.addEvent({
                    delay: 35,
                    repeat: jitterTotal - 1,
                    callback: () => {
                        jitterCount++;
                        // Random position offset
                        const ox = (Math.random() - 0.5) * 12;
                        const oy = (Math.random() - 0.5) * 6;
                        txt.x = baseX + ox;
                        txt.y = baseY + oy;
                        line.x = lineBaseX + ox;
                        line.y = lineBaseY + oy;

                        // Random alpha flicker between 0.5 and 1
                        const flickAlpha = 0.5 + Math.random() * 0.5;
                        txt.setAlpha(flickAlpha);
                        line.setAlpha(flickAlpha);
                    }
                });

                // Blink 1 — deeper alpha dip at ~180ms into jitter
                PhaserScene.time.delayedCall(180, () => {
                    txt.setAlpha(0.3);
                    line.setAlpha(0.3);
                    const ox = (Math.random() - 0.5) * 18;
                    txt.x = baseX + ox;
                    line.x = lineBaseX + ox;
                    PhaserScene.time.delayedCall(30, () => {
                        txt.setAlpha(0.85);
                        line.setAlpha(0.85);
                        txt.x = baseX;
                        txt.y = baseY;
                        line.x = lineBaseX;
                        line.y = lineBaseY;
                    });
                });

                // Blink 2 — deeper alpha dip at ~350ms into jitter
                PhaserScene.time.delayedCall(350, () => {
                    txt.setAlpha(0.3);
                    line.setAlpha(0.3);
                    const ox = (Math.random() - 0.5) * 18;
                    txt.x = baseX + ox;
                    line.x = lineBaseX + ox;
                    PhaserScene.time.delayedCall(30, () => {
                        txt.setAlpha(0.85);
                        line.setAlpha(0.85);
                        txt.x = baseX;
                        txt.y = baseY;
                        line.x = lineBaseX;
                        line.y = lineBaseY;
                    });
                });

                // Final: reset position, pause 0.5s, then vanish
                PhaserScene.time.delayedCall(jitterTotal * 35 + 10, () => {
                    txt.x = baseX;
                    txt.y = baseY;
                    txt.setAlpha(1);
                    line.x = lineBaseX;
                    line.y = lineBaseY;
                    line.setAlpha(1);

                    PhaserScene.time.delayedCall(400, () => {
                        txt.setOrigin(0.5, 0.5);
                        txt.x = GAME_CONSTANTS.halfWidth + 60;
                        txt.y = baseYPos; // Recenter vertically for the exit animation
                        txt.setAlpha(0.65);
                        txt.setScale(1.4, 0.8);

                        line.x = GAME_CONSTANTS.halfWidth + 60;
                        line.setAlpha(0.65);
                        line.setScale(4.2, 0.4); // Adjusted proportional stretch

                        PhaserScene.time.delayedCall(30, () => {
                            txt.x = GAME_CONSTANTS.halfWidth - 50;
                            txt.setAlpha(0.45);
                            txt.setScale(3.2, 0.2);

                            line.x = GAME_CONSTANTS.halfWidth - 50;
                            line.setAlpha(0.45);
                            line.setScale(10, 0.1);

                            PhaserScene.time.delayedCall(35, () => {
                                txt.destroy();
                                line.destroy();
                            });
                        });
                    });
                });
            });
        };

        typeChar();
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
        if (testDefensesBtn) {
            const isUnlocked = typeof gameState !== 'undefined' && gameState.upgrades && gameState.upgrades.test_defenses_unlocked;
            testDefensesBtn.setVisible(isUnlocked);
            if (isUnlocked) {
                testDefensesBtn.setState(NORMAL);
            } else {
                testDefensesBtn.setState(DISABLE);
            }
        }
    }

    return { init, showAnnounceMessage, showBossAnnouncement, setWaveProgressBarVisible, refreshTestDefensesButton };
})();
