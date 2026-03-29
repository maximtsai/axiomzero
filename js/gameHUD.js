// gameHUD.js
// In-game HUD: health bar, EXP bar, currency counters, END ITERATION button.
// All elements use JetBrainsMono. Show/hide based on phaseChanged.

const gameHUD = (() => {
    // ── HUD elements ─────────────────────────────────────────────────────────
    let healthBarBg = null;
    let healthBarFill = null;
    let healthBarFlare = null;
    let healthText = null;
    let expBarBg = null;
    let expBarFill = null;
    let expText = null;
    let resourceUI = {}; // { data: { icon, text }, ... }
    let lastHealth = -1;

    let endIterationBtn = null;
    let testDefensesBtn = null;
    let waveProgressBar = null;

    // Layout
    const HUD_X = 20;
    const HUD_Y = 20;
    const BAR_W = 200;
    const BAR_H = helper.isMobileDevice() ? 22 : 18;
    const BAR_GAP = helper.isMobileDevice() ? 12 : 8;
    const EXP_BAR_H = helper.isMobileDevice() ? 14 : 10;
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
        messageBus.subscribe('expChanged', _onExpChanged);
        messageBus.subscribe('currencyChanged', _onCurrencyChanged);
        messageBus.subscribe('enemyKilled', _onEnemyKilled);
        messageBus.subscribe('upgradePurchased', _onUpgradePurchased);
        messageBus.subscribe('towerDeathStarted', _onTowerDeathStarted);
        messageBus.subscribe('waveProgressChanged', _onWaveProgressChanged);
        messageBus.subscribe('bossDefeated', () => {
            if (endIterationBtn) endIterationBtn.setState(DISABLE);
        });
        messageBus.subscribe('AnnounceText', showTransitionMessage);
        updateManager.addFunction(_update);
    }

    function _createElements() {
        const depth = GAME_CONSTANTS.DEPTH_NEURAL_TREE + 2;
        const groupX = GAME_CONSTANTS.halfWidth + 10 + HUD_X;

        // ── Health bar ──
        healthBarBg = PhaserScene.add.image(groupX, HUD_Y, 'white_pixel');
        healthBarBg.setOrigin(0, 0).setDisplaySize(BAR_W, BAR_H).setTint(GAME_CONSTANTS.HEALTH_BAR_TINT).setDepth(depth).setScrollFactor(0);

        healthBarFlare = PhaserScene.add.image(groupX, HUD_Y + BAR_H / 2, 'ui', 'white_vertical_line.png');
        healthBarFlare.setOrigin(0.5, 0.5).setScale(1, 0.75).setTint(0xffffff).setDepth(depth + 1).setScrollFactor(0);
        healthBarFlare.setAlpha(0);

        healthBarFill = PhaserScene.add.image(groupX, HUD_Y, 'white_pixel');
        healthBarFill.setOrigin(0, 0).setDisplaySize(BAR_W, BAR_H).setTint(GAME_CONSTANTS.COLOR_FRIENDLY).setDepth(depth + 2).setScrollFactor(0);

        healthText = PhaserScene.add.text(groupX + BAR_W + 8, HUD_Y - 1, '', {
            fontFamily: 'JetBrainsMono_Regular',
            fontSize: helper.isMobileDevice() ? '24px' : '20px',
            color: '#ffffff',
        }).setOrigin(0, 0).setDepth(depth + 2).setScrollFactor(0);

        // ── EXP bar ──
        const expY = HUD_Y + BAR_H + BAR_GAP + 3;
        expBarBg = PhaserScene.add.image(groupX, expY, 'white_pixel');
        expBarBg.setOrigin(0, 0).setDisplaySize(BAR_W, EXP_BAR_H).setTint(0x222222).setDepth(depth).setScrollFactor(0);

        expBarFill = PhaserScene.add.image(groupX, expY, 'white_pixel');
        expBarFill.setOrigin(0, 0).setDisplaySize(0, EXP_BAR_H).setTint(0xffffff).setDepth(depth + 1).setScrollFactor(0);

        expText = PhaserScene.add.text(groupX + BAR_W + 8, expY - (helper.isMobileDevice() ? 3 : 5), 'EXP 0%', {
            fontFamily: 'JetBrainsMono_Regular',
            fontSize: helper.isMobileDevice() ? '24px' : '20px',
            color: '#aaaaaa',
        }).setOrigin(0, 0).setDepth(depth + 2).setScrollFactor(0);

        // ── Currency counters ──
        const currY = expY + 10 + BAR_GAP + 5;
        const resourceTypes = [
            { id: 'data', icon: 'resrc_data.png', color: '#00f5ff' },
            { id: 'insight', icon: 'resrc_insight.png', color: '#ffffff' },
            { id: 'shard', icon: 'resrc_shard.png', color: '#ffb300' },
            { id: 'processor', icon: 'resrc_processor.png', color: '#ffe600' },
            { id: 'coin', icon: 'resrc_coin.png', color: '#00ff66' }
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
                fontSize: helper.isMobileDevice() ? '26px' : '21px',
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
                    ]);
                },
                onHoverOut: () => tooltipManager.hide()
            });
            btn.setOrigin(0.5, 0.5);
            btn.setScale(1, helper.isMobileDevice() ? 1.05 : 1);
            btn.setDepth(depth + 1);
            btn.setScrollFactor(0);
            btn.setVisible(false);

            resourceUI[type.id] = { icon, text, btn, baseY: currY };
        });

        _updateResourceLayout();

        if (typeof neuralTree !== 'undefined' && neuralTree.getGroup) {
            const treeGroup = neuralTree.getGroup();
            if (treeGroup) {
                treeGroup.add(healthBarBg);
                treeGroup.add(healthBarFill);
                treeGroup.add(healthBarFlare);
                treeGroup.add(healthText);
                treeGroup.add(expBarBg);
                treeGroup.add(expBarFill);
                treeGroup.add(expText);
                Object.values(resourceUI).forEach(res => {
                    treeGroup.add(res.icon);
                    treeGroup.add(res.text);
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
            color: '#ffffff',
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
            bgColor: 0x222233,
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
                if (typeof GAME_VARS !== 'undefined') {
                    GAME_VARS.testingDefenses = true;
                }
                if (typeof enemyManager !== 'undefined') {
                    enemyManager.startTestingDefenses();
                }
            },
        });
        testDefensesBtn.setScale(0.9);
        testDefensesBtn.addText("Test Defenses", {
            fontFamily: 'JetBrainsMono_Bold',
            fontSize: '19px',
            color: '#ffffff',
        });
        testDefensesBtn.setDepth(depth + 3);
        const isUnlocked = typeof gameState !== 'undefined' && gameState.upgrades && gameState.upgrades.test_defenses_unlocked;
        testDefensesBtn.setVisible(isUnlocked);
        if (!isUnlocked) testDefensesBtn.setState(DISABLE);
    }

    // ── show / hide ──────────────────────────────────────────────────────────

    function _showCombatHUD() {
        visible = true;
        healthBarBg.setVisible(true);
        healthBarFill.setVisible(true);
        healthBarFlare.setVisible(true);
        healthText.setVisible(true);
        expBarBg.setVisible(true);
        expBarFill.setVisible(true);
        expText.setVisible(true);
        _updateResourceLayout();
        endIterationBtn.setVisible(true);
        endIterationBtn.setState(NORMAL);
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
        expBarBg.setVisible(false);
        expBarFill.setVisible(false);
        expText.setVisible(false);
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

        // Show all HUD elements grouped with the Neural Tree
        healthBarBg.setVisible(true);
        healthBarFill.setVisible(true);
        healthBarFlare.setVisible(true);
        healthText.setVisible(true);
        expBarBg.setVisible(true);
        expBarFill.setVisible(true);
        expText.setVisible(true);

        _updateResourceLayout();

        // Count up animation for currencies
        const order = ['data', 'insight', 'shard', 'processor', 'coin'];
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

        // Show test defenses button if unlocked
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

        // Logarithmic scaling: 200px at 20 health, ~800px at 10,000 health
        // Formula: L = 222.3 * log10(max) - 89.2
        const dynamicW = Math.max(BAR_W, BAR_W + 222.3 * (Math.log10(max) - Math.log10(GAME_CONSTANTS.TOWER_BASE_HEALTH)));

        const ratio = Math.max(0, current / max);

        healthBarBg.setDisplaySize(dynamicW, BAR_H);
        healthBarFill.setDisplaySize(dynamicW * ratio, BAR_H);

        // Reposition text to the right of the dynamic bar
        healthText.x = healthBarBg.x + dynamicW + 8;

        // Color shift: cyan → red as health drops
        if (ratio > 0.5) {
            healthBarFill.setTint(GAME_CONSTANTS.COLOR_FRIENDLY);
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

    function _onExpChanged(current, max) {
        // Remove !visible guard to ensure exp bar updates on load
        const ratio = Math.min(1, Math.max(0, current / max));
        expBarFill.setDisplaySize(BAR_W * ratio, EXP_BAR_H);
        expText.setText('EXP ' + Math.floor(ratio * 100) + '%');
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
    }

    function _updateResourceLayout() {
        if (!visible) return;

        let currentY = HUD_Y + BAR_H + BAR_GAP + 3 + EXP_BAR_H + BAR_GAP + 15;
        const spacing = helper.isMobileDevice() ? 35 : 31;
        const groupX = GAME_CONSTANTS.halfWidth + 10 + HUD_X;

        const order = ['data', 'insight', 'shard', 'processor', 'coin'];
        order.forEach(id => {
            const ui = resourceUI[id];
            const val = _getResourceValue(id);

            if (val > 0) {
                const isUpgradePhase = gameStateMachine.getPhase() === GAME_CONSTANTS.PHASE_UPGRADE;
                if (ui.btn) {
                    ui.btn.setVisible(isUpgradePhase);
                    ui.btn.setPos(groupX + 45, currentY);
                    ui.btn.setState(isUpgradePhase ? NORMAL : DISABLE);
                }
                ui.icon.setVisible(isUpgradePhase);
                ui.text.setVisible(isUpgradePhase);
                ui.icon.y = currentY + (helper.isMobileDevice() ? 2 : 0);
                ui.text.y = currentY - 13;
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
        if (typeof neuralTree !== 'undefined' && neuralTree.getGroup) {
            const treeGroup = neuralTree.getGroup();
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
    function showTransitionMessage(msg) {
        // Measure final dimensions without delay symbols for proper centering
        const measureMsg = msg.replaceAll('#', '');
        const tempTxt = PhaserScene.add.text(0, 0, measureMsg, {
            fontFamily: 'VCR',
            fontSize: '44px',
        });
        const fullWidth = tempTxt.width;
        const fullHeight = tempTxt.height;
        tempTxt.destroy();

        const baseYPos = GAME_CONSTANTS.halfHeight - 310;
        const txt = PhaserScene.add.text(GAME_CONSTANTS.halfWidth - (fullWidth / 2), baseYPos - (fullHeight * 0.5), '', {
            fontFamily: 'VCR',
            fontSize: '44px',
            color: '#ffffff',
            align: 'center',
            lineSpacing: 2
        }).setOrigin(0, 0).setDepth(GAME_CONSTANTS.DEPTH_HUD + 10).setAlpha(1).setShadow(2, 2, '#000000', 2, true, true);

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
            if (txt.active) glitchFX.triggerChromaticAberration(txt, 500, 1.75);
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

            PhaserScene.time.delayedCall(2650, () => {
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

                        PhaserScene.time.delayedCall(50, () => {
                            txt.x = GAME_CONSTANTS.halfWidth - 50;
                            txt.setAlpha(0.45);
                            txt.setScale(3.2, 0.2);

                            line.x = GAME_CONSTANTS.halfWidth - 50;
                            line.setAlpha(0.45);
                            line.setScale(10, 0.1);

                            PhaserScene.time.delayedCall(25, () => {
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

    return { init, showTransitionMessage, setWaveProgressBarVisible, refreshTestDefensesButton };
})();
