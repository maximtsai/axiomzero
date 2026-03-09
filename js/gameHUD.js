// gameHUD.js
// In-game HUD: health bar, EXP bar, currency counters, END ITERATION button.
// All elements use JetBrainsMono. Show/hide based on phaseChanged.

const gameHUD = (() => {
    // ── HUD elements ─────────────────────────────────────────────────────────
    let healthBarBg = null;
    let healthBarFill = null;
    let healthText = null;
    let expBarBg = null;
    let expBarFill = null;
    let expText = null;
    let resourceUI = {}; // { data: { icon, text }, ... }

    let endIterationBtn = null;
    let waveProgressBar = null;

    // Layout
    const HUD_X = 20;
    const HUD_Y = 20;
    const BAR_W = 200;
    const BAR_H = 18;
    const BAR_GAP = 8;
    const DATA_ICON_SIZE = 18;
    const DATA_ICON_GAP = 5;

    let visible = false;

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
    }

    function _createElements() {
        const depth = GAME_CONSTANTS.DEPTH_NEURAL_TREE + 2;
        const groupX = GAME_CONSTANTS.halfWidth + 10 + HUD_X;

        // ── Health bar ──
        healthBarBg = PhaserScene.add.image(groupX, HUD_Y, 'white_pixel');
        healthBarBg.setOrigin(0, 0).setDisplaySize(BAR_W, BAR_H).setTint(GAME_CONSTANTS.HEALTH_BAR_TINT).setDepth(depth).setScrollFactor(0);

        healthBarFill = PhaserScene.add.image(groupX, HUD_Y, 'white_pixel');
        healthBarFill.setOrigin(0, 0).setDisplaySize(BAR_W, BAR_H).setTint(GAME_CONSTANTS.COLOR_FRIENDLY).setDepth(depth + 1).setScrollFactor(0);

        healthText = PhaserScene.add.text(groupX + BAR_W + 8, HUD_Y - 1, '', {
            fontFamily: 'JetBrainsMono_Regular',
            fontSize: '20px',
            color: '#ffffff',
        }).setOrigin(0, 0).setDepth(depth + 2).setScrollFactor(0);

        // ── EXP bar ──
        const expY = HUD_Y + BAR_H + BAR_GAP + 3;
        expBarBg = PhaserScene.add.image(groupX, expY, 'white_pixel');
        expBarBg.setOrigin(0, 0).setDisplaySize(BAR_W, 10).setTint(0x222222).setDepth(depth).setScrollFactor(0);

        expBarFill = PhaserScene.add.image(groupX, expY, 'white_pixel');
        expBarFill.setOrigin(0, 0).setDisplaySize(0, 10).setTint(0xffffff).setDepth(depth + 1).setScrollFactor(0);

        expText = PhaserScene.add.text(groupX + BAR_W + 8, expY - 5, 'EXP 0%', {
            fontFamily: 'JetBrainsMono_Regular',
            fontSize: '20px',
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
                fontSize: '21px',
                color: type.color,
            }).setOrigin(0, 0).setDepth(depth + 2).setScrollFactor(0).setVisible(false);

            resourceUI[type.id] = { icon, text, baseY: currY };
        });

        _updateResourceLayout();

        if (typeof neuralTree !== 'undefined' && neuralTree.getGroup) {
            const treeGroup = neuralTree.getGroup();
            if (treeGroup) {
                treeGroup.add(healthBarBg);
                treeGroup.add(healthBarFill);
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

        // ── END ITERATION button ──
        endIterationBtn = new Button({
            normal: {
                ref: 'button_normal.png',
                atlas: 'buttons',
                x: GAME_CONSTANTS.WIDTH - 100,
                y: GAME_CONSTANTS.HEIGHT - 34,
            },
            hover: {
                ref: 'button_hover.png',
                atlas: 'buttons',
                x: GAME_CONSTANTS.WIDTH - 100,
                y: GAME_CONSTANTS.HEIGHT - 34,
            },
            press: {
                ref: 'button_press.png',
                atlas: 'buttons',
                x: GAME_CONSTANTS.WIDTH - 100,
                y: GAME_CONSTANTS.HEIGHT - 34,
            },
            onMouseUp: () => {
                messageBus.publish('endIterationRequested');
            },
        });
        endIterationBtn.addText('END ITERATION', {
            fontFamily: 'JetBrainsMono_Bold',
            fontSize: '18px',
            color: '#ffffff',
        });
        endIterationBtn.setDepth(depth + 3);
        endIterationBtn.setScrollFactor(0);

        // ── Progress bar ──
        waveProgressBar = new ProgressBar(PhaserScene, {
            x: 705,
            y: GAME_CONSTANTS.HEIGHT - 22,
            width: GAME_CONSTANTS.WIDTH - 220,
            height: 27,
            padding: 7,
            bgColor: 0x222233,
            fillColor: 0x00f5ff,
            depth: depth
        });
        waveProgressBar.setVisible(false);
    }

    // ── show / hide ──────────────────────────────────────────────────────────

    function _showCombatHUD() {
        visible = true;
        healthBarBg.setVisible(true);
        healthBarFill.setVisible(true);
        healthText.setVisible(true);
        expBarBg.setVisible(true);
        expBarFill.setVisible(true);
        expText.setVisible(true);
        _updateResourceLayout();
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
        Object.values(resourceUI).forEach(res => {
            res.icon.setVisible(false);
            res.text.setVisible(false);
        });
        endIterationBtn.setVisible(false);
        endIterationBtn.setState(DISABLE);
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
        healthText.setVisible(true);
        expBarBg.setVisible(true);
        expBarFill.setVisible(true);
        expText.setVisible(true);

        _updateResourceLayout();

        // Hide combat-only elements
        endIterationBtn.setVisible(false);
        endIterationBtn.setState(DISABLE);
        if (waveProgressBar) waveProgressBar.setVisible(false);
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

        healthText.setText(current.toFixed(1) + ' / ' + max.toFixed(0));
    }

    function _onExpChanged(current, max) {
        // Remove !visible guard to ensure exp bar updates on load
        const ratio = Math.min(1, Math.max(0, current / max));
        expBarFill.setDisplaySize(BAR_W * ratio, 10);
        expText.setText('EXP ' + Math.floor(ratio * 100) + '%');
    }

    function _onCurrencyChanged(type, amount) {
        if (resourceUI[type]) {
            resourceUI[type].text.setText(Math.floor(amount));
            _updateResourceLayout();
        }
    }

    function _updateResourceLayout() {
        if (!visible) return;

        let currentY = HUD_Y + BAR_H + BAR_GAP + 3 + 10 + BAR_GAP + 15;
        const spacing = 28;

        const order = ['data', 'insight', 'shard', 'processor', 'coin'];
        order.forEach(id => {
            const ui = resourceUI[id];
            const val = _getResourceValue(id);

            if (val > 0) {
                ui.icon.setVisible(true);
                ui.text.setVisible(true);
                ui.icon.y = currentY;
                ui.text.y = currentY - 13;
                currentY += spacing;
            } else {
                ui.icon.setVisible(false);
                ui.text.setVisible(false);
            }
        });

        // Tell the virtualGroup that its children have moved so they don't snap back to overlapping positions
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
            const val = _getResourceValue(id);
            resourceUI[id].text.setText(Math.floor(val));
        });
        _updateResourceLayout();
    }


    /**
     * Show a centered transition message using a typewriter effect.
     * @param {string} msg 
     */
    function showTransitionMessage(msg) {
        const txt = PhaserScene.add.text(GAME_CONSTANTS.halfWidth, GAME_CONSTANTS.halfHeight - 340, msg, {
            fontFamily: 'VCR',
            fontSize: '44px',
            color: '#ffffff',
            align: 'center'
        }).setOrigin(0, 0.5).setDepth(GAME_CONSTANTS.DEPTH_HUD + 10).setAlpha(1);

        // Calculate final width and shift x to keep it centered as we type
        const fullWidth = txt.width;
        txt.text = '';
        txt.x = GAME_CONSTANTS.halfWidth - (fullWidth / 2);

        // Play reveal sound when string begins to appear
        audio.play('data_reveal', 0.8);

        // Apply chromatic glitch 0.58s after it pops up
        PhaserScene.time.delayedCall(750, () => glitchFX.triggerChromaticAberration(txt, 500, 1.75));

        let charIdx = 0;
        PhaserScene.time.addEvent({
            delay: 25,
            repeat: msg.length - 1,
            callback: () => {
                txt.text += msg[charIdx];
                charIdx++;

                // When done typing, hold, then glitch out
                if (charIdx === msg.length) {
                    const baseX = txt.x;
                    const baseY = txt.y;

                    PhaserScene.time.delayedCall(1500, () => {
                        // Glitch jitter phase — erratic shaking + alpha flicker
                        let jitterCount = 0;
                        const jitterTotal = 8;
                        const jitterEvent = PhaserScene.time.addEvent({
                            delay: 35,
                            repeat: jitterTotal - 1,
                            callback: () => {
                                jitterCount++;
                                // Random position offset
                                txt.x = baseX + (Math.random() - 0.5) * 12;
                                txt.y = baseY + (Math.random() - 0.5) * 6;
                                // Random alpha flicker between 0.5 and 1
                                txt.setAlpha(0.5 + Math.random() * 0.5);
                            }
                        });

                        // Blink 1 — deeper alpha dip at ~180ms into jitter
                        PhaserScene.time.delayedCall(180, () => {
                            txt.setAlpha(0.3);
                            txt.x = baseX + (Math.random() - 0.5) * 18;
                            PhaserScene.time.delayedCall(30, () => {
                                txt.setAlpha(0.85);
                                txt.x = baseX;
                                txt.y = baseY;
                            });
                        });

                        // Blink 2 — deeper alpha dip at ~350ms into jitter
                        PhaserScene.time.delayedCall(350, () => {
                            txt.setAlpha(0.3);
                            txt.x = baseX + (Math.random() - 0.5) * 18;
                            PhaserScene.time.delayedCall(30, () => {
                                txt.setAlpha(0.85);
                                txt.x = baseX;
                                txt.y = baseY;
                            });
                        });

                        // Final: reset position, pause 0.5s, then vanish
                        PhaserScene.time.delayedCall(jitterTotal * 35 + 10, () => {
                            txt.x = baseX;
                            txt.y = baseY;
                            txt.setAlpha(1);
                            PhaserScene.time.delayedCall(400, () => {
                                txt.setOrigin(0.5, 0.5);
                                txt.x = GAME_CONSTANTS.halfWidth + 60;
                                txt.setAlpha(0.65);
                                txt.setScale(1.4, 0.8);
                                PhaserScene.time.delayedCall(50, () => {
                                    txt.x = GAME_CONSTANTS.halfWidth - 50;
                                    txt.setAlpha(0.45);
                                    txt.setScale(3.2, 0.2);
                                    PhaserScene.time.delayedCall(25, () => {
                                        txt.destroy();
                                    });
                                });
                            });
                        });
                    });
                }
            }
        });
    }

    function setWaveProgressBarVisible(vis) {
        if (!waveProgressBar) return;
        waveProgressBar.setVisible(vis);

        if (vis) {
            // Animation sequence:
            // 0.5 alpha, wait 0.05s (50ms), 0 alpha, wait 0.2s (200ms), 0.5 alpha, wait 0.1s (100ms), 0 alpha, wait 0.75s (750ms), 1 alpha.
            waveProgressBar.setAlpha(0.5);

            PhaserScene.time.delayedCall(40, () => {
                waveProgressBar.setAlpha(0);

                PhaserScene.time.delayedCall(100, () => {
                    waveProgressBar.setAlpha(0.6);

                    PhaserScene.time.delayedCall(40, () => {
                        waveProgressBar.setAlpha(0);

                        PhaserScene.time.delayedCall(350, () => {
                            waveProgressBar.setAlpha(0.7);
                            PhaserScene.time.delayedCall(250, () => {
                                waveProgressBar.setAlpha(0.4);
                                PhaserScene.time.delayedCall(100, () => {
                                    waveProgressBar.setAlpha(1);
                                });
                            });
                        });
                    });
                });
            });
        }
    }

    return { init, showTransitionMessage, setWaveProgressBarVisible };
})();
