// iterationOverScreen.js — Post-combat "ITERATION COMPLETE" summary screen.
// Shows collected resources and offers UPGRADES or RETRY SESSION.

const iterationOverScreen = (() => {
    let overlay = null;
    let titleText = null;
    let dataText = null;
    let sniffedDataText = null;
    let insightText = null;
    let shardText = null;
    let processorText = null;
    let upgradesBtn = null;
    let retryBtn = null;
    let diagElements = []; // Track diagnostic sprites/text for cleanup

    let visible = false;
    let isBossKill = false;

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
        titleText = PhaserScene.add.text(cx, cy - 175, t('results', 'iteration_complete'), {
            fontFamily: 'Michroma',
            fontSize: '36px',
            color: '#00f5ff',
            align: 'center',
        }).setDepth(depth + 1);

        // Add slight glow
        titleText.setShadow(0, 0, '#00f5ff', 8, true, true);

        // Calculate centered X for origin (0, 0.5)
        const fullWidth = titleText.width;
        titleText.setOrigin(0, 0.5);
        titleText.setX(cx - fullWidth / 2);
        titleText.fullText = t('results', 'iteration_complete');
        titleText.setText('');

        // Acquired resources
        dataText = PhaserScene.add.text(cx, 0, '', {
            fontFamily: 'JetBrainsMono_Regular',
            fontSize: '24px',
            color: '#00f5ff',
            align: 'center',
        }).setOrigin(0.5).setDepth(depth + 1);

        sniffedDataText = PhaserScene.add.text(cx, 0, '', {
            fontFamily: 'JetBrainsMono_Regular',
            fontSize: '18px',
            color: '#00f5ff',
            align: 'center',
        }).setOrigin(0.5).setDepth(depth + 1);

        insightText = PhaserScene.add.text(cx, 0, '', {
            fontFamily: 'JetBrainsMono_Regular',
            fontSize: '24px',
            color: '#ffffff',
            align: 'center',
        }).setOrigin(0.5).setDepth(depth + 1);

        shardText = PhaserScene.add.text(cx, 0, '', {
            fontFamily: 'JetBrainsMono_Regular',
            fontSize: '24px',
            color: '#ff2d78',
            align: 'center',
        }).setOrigin(0.5).setDepth(depth + 1);

        processorText = PhaserScene.add.text(cx, 0, '', {
            fontFamily: 'JetBrainsMono_Regular',
            fontSize: '24px',
            color: '#ff9500',
            align: 'center',
        }).setOrigin(0.5).setDepth(depth + 1);

        // UPGRADES button
        upgradesBtn = new Button({
            normal: {
                ref: 'button_normal.png',
                atlas: 'buttons',
                x: cx - 113,
                y: cy + 310,
                depth: depth + 2,
            },
            hover: {
                ref: 'button_hover.png',
                atlas: 'buttons',
                x: cx - 113,
                y: cy + 310,
                depth: depth + 2,
            },
            press: {
                ref: 'button_press.png',
                atlas: 'buttons',
                x: cx - 113,
                y: cy + 310,
                depth: depth + 2,
            },
            onMouseUp: _onUpgradesClicked,
        });
        upgradesBtn.setScale(helper.isMobileDevice() ? 1.0 : 0.9);
        upgradesBtn.addText(t('ui', 'upgrades'), {
            fontFamily: 'JetBrainsMono_Bold',
            fontSize: '25px',
            color: '#ffffff',
        });
        upgradesBtn.setScrollFactor(0);

        // RETRY SESSION button
        retryBtn = new Button({
            normal: {
                ref: 'button_normal.png',
                atlas: 'buttons',
                x: cx + 113,
                y: cy + 310,
                depth: depth + 2,
            },
            hover: {
                ref: 'button_hover.png',
                atlas: 'buttons',
                x: cx + 113,
                y: cy + 310,
                depth: depth + 2,
            },
            press: {
                ref: 'button_press.png',
                atlas: 'buttons',
                x: cx + 113,
                y: cy + 310,
                depth: depth + 2,
            },
            onMouseUp: _onRetryClicked,
        });
        retryBtn.setScale(helper.isMobileDevice() ? 1.0 : 0.9);
        retryBtn.addText(t('ui', 'retry'), {
            fontFamily: 'JetBrainsMono_Bold',
            fontSize: '25px',
            color: '#ffffff',
        });
        retryBtn.setScrollFactor(0);
    }

    // ── show / hide ──────────────────────────────────────────────────────

    function show() {
        visible = true;

        const sessionData = resourceManager.getSessionData();
        const sessionInsight = resourceManager.getSessionInsight();
        const sessionShards = resourceManager.getSessionShards();
        const sessionProcessors = resourceManager.getSessionProcessors();

        overlay.setVisible(true);
        titleText.setVisible(true);
        titleText.setText('');
        upgradesBtn.setVisible(true);
        upgradesBtn.setState(NORMAL);
        retryBtn.setVisible(true);
        retryBtn.setState(NORMAL);

        if (isBossKill) {
            titleText.fullText = t('results', 'boss_defeated');
            audio.play('victory', 1.0, false);
        } else {
            titleText.fullText = t('results', 'iteration_complete');
        }

        const cx = GAME_CONSTANTS.halfWidth;
        const cy = GAME_CONSTANTS.halfHeight;

        // Hide all initially
        dataText.setVisible(false);
        sniffedDataText.setVisible(false);
        insightText.setVisible(false);
        shardText.setVisible(false);
        processorText.setVisible(false);

        const activeTexts = [];

        if (sessionData === 0 && sessionInsight === 0 && sessionShards === 0 && sessionProcessors === 0) {
            dataText.setText('no resources');
            dataText.setVisible(true);
            activeTexts.push(dataText);
        } else {
            if (sessionData > 0) {
                dataText.setText('\u25C8 DATA collected: ' + sessionData);
                dataText.setVisible(true);
                activeTexts.push(dataText);

                const sniffedData = resourceManager.getSessionSniffedData();
                if (sniffedData > 0) {
                    sniffedDataText.setText(t('results', 'packet_sniffing_data', [sniffedData]));
                    sniffedDataText.setVisible(true);
                    activeTexts.push(sniffedDataText);
                }
            }
            if (sessionInsight > 0) {
                insightText.setText('◐ INSIGHT gained: ' + sessionInsight);
                insightText.setVisible(true);
                activeTexts.push(insightText);
            }
            if (sessionShards > 0) {
                shardText.setText('♦ SHARDS found: ' + sessionShards);
                shardText.setVisible(true);
                activeTexts.push(shardText);
            }
            if (sessionProcessors > 0) {
                processorText.setText('■ PROCESSORS salvaged: ' + sessionProcessors);
                processorText.setVisible(true);
                activeTexts.push(processorText);
            }
        }

        // Center block dynamically
        const lineSpacing = 30;
        const totalHeight = (activeTexts.length - 1) * lineSpacing;
        let startY = cy - 70 - (totalHeight / 2);

        for (let i = 0; i < activeTexts.length; i++) {
            activeTexts[i].setY(startY + (i * lineSpacing));
        }

        // Start typewriter effect
        if (titleText.typewriterEvent) titleText.typewriterEvent.remove();

        let charIndex = 0;
        titleText.typewriterEvent = PhaserScene.time.addEvent({
            delay: 30,
            repeat: titleText.fullText.length - 1,
            callback: () => {
                charIndex++;
                titleText.setText(titleText.fullText.substring(0, charIndex));
                audio.play('digital_typewriter_short', 0.75);
            }
        });

        // ── Diagnostics ──────────────────────────────────────────────────
        _populateDiagnostics(cx, cy);
    }

    function _populateDiagnostics(cx, cy) {
        // Clear old elements if any
        diagElements.forEach(el => el.destroy());
        diagElements = [];

        const hasDiagnostics = (gameState.upgrades || {}).diagnostic_analytics > 0;
        if (!hasDiagnostics) return;

        const depth = GAME_CONSTANTS.DEPTH_ITERATION_OVER + 1;
        const stats = statsTracker.getStats();
        const dmg = stats.damage;
        const totalDmg = Object.values(dmg).reduce((a, b) => a + b, 0);

        // "DIAGNOSTIC REPORT" Header
        const reportTitle = PhaserScene.add.text(cx, cy + 35, '— DIAGNOSTIC REPORT —', {
            fontFamily: 'Michroma',
            fontSize: '20px',
            color: '#00f5ff',
        }).setOrigin(0.5).setDepth(depth).setAlpha(0.8);
        diagElements.push(reportTitle);

        if (totalDmg <= 0) {
            const noDataText = PhaserScene.add.text(cx, cy + 70, 'NO DAMAGE DEALT', {
                fontFamily: 'JetBrainsMono_Regular',
                fontSize: '18px',
                color: '#aaaaaa',
            }).setOrigin(0.5).setDepth(depth).setAlpha(0.9);
            diagElements.push(noDataText);
            return;
        }

        const sources = [
            { id: 'cursor', label: 'CURSOR', color: 0x00f5ff },
            { id: 'tower', label: 'TOWER', color: 0xffe600 },
            { id: 'lightning', label: 'LIGHTNING', color: 0xffe600 },
            { id: 'shockwave', label: 'SHOCKWAVE', color: 0x00f5ff },
            { id: 'laser', label: 'LASER', color: 0xff2d78 },
            { id: 'artillery', label: 'ARTILLERY', color: 0xff9500 },
            { id: 'friendlyfire', label: 'COLLATERAL', color: 0xff2d78 },
            { id: 'other', label: 'SYSTEM', color: 0x777777 },
        ];

        // Combine endgame into collateral if needed, or group
        dmg.friendlyfire += (dmg.endgame || 0);

        const activeSources = sources.filter(s => dmg[s.id] > 0);
        const startY = cy + 70;
        const barWidth = 240;
        const entryHeight = 22;

        activeSources.forEach((s, i) => {
            const y = startY + (i * entryHeight);
            const pct = dmg[s.id] / totalDmg;

            // Label
            const lbl = PhaserScene.add.text(cx - (barWidth / 2) - 10, y, s.label, {
                fontFamily: 'JetBrainsMono_Bold',
                fontSize: '13px',
                color: '#ffffff',
            }).setOrigin(1, 0.5).setDepth(depth).setAlpha(0.9);

            // Bar BG
            const bg = PhaserScene.add.image(cx, y, 'white_pixel')
                .setDepth(depth)
                .setDisplaySize(barWidth, 10)
                .setTint(0x222222)
                .setAlpha(0.6)
                .setOrigin(0.5);

            // Bar Fill
            const fill = PhaserScene.add.image(cx - (barWidth / 2), y, 'white_pixel')
                .setDepth(depth + 1)
                .setDisplaySize(barWidth * pct, 10)
                .setTint(s.color)
                .setOrigin(0, 0.5);

            // Percentage
            const pText = PhaserScene.add.text(cx + (barWidth / 2) + 10, y, Math.round(pct * 100) + '%', {
                fontFamily: 'JetBrainsMono_Regular',
                fontSize: '13px',
                color: '#ffffff',
            }).setOrigin(0, 0.5).setDepth(depth).setAlpha(0.9);

            diagElements.push(lbl, bg, fill, pText);
        });

        // Executions
        if (stats.executions > 0) {
            const execY = startY + (activeSources.length * entryHeight);
            
            // Label - Aligned with weapon labels
            const lbl = PhaserScene.add.text(cx - (barWidth / 2) - 10, execY, 'EXECUTIONS', {
                fontFamily: 'JetBrainsMono_Bold',
                fontSize: '13px',
                color: '#ff2d78',
            }).setOrigin(1, 0.5).setDepth(depth).setAlpha(0.9);

            // Count - Aligned with bar start
            const valText = PhaserScene.add.text(cx - (barWidth / 2), execY, stats.executions.toString(), {
                fontFamily: 'JetBrainsMono_Bold',
                fontSize: '13px',
                color: '#ff2d78',
            }).setOrigin(0, 0.5).setDepth(depth).setAlpha(0.9);

            diagElements.push(lbl, valText);
        }
    }

    function _hideAll() {
        visible = false;
        overlay.setVisible(false);
        titleText.setVisible(false);
        dataText.setVisible(false);
        sniffedDataText.setVisible(false);
        insightText.setVisible(false);
        shardText.setVisible(false);
        processorText.setVisible(false);
        upgradesBtn.setVisible(false);
        upgradesBtn.setState(DISABLE);
        retryBtn.setVisible(false);
        retryBtn.setState(DISABLE);
        if (titleText.typewriterEvent) titleText.typewriterEvent.remove();
        diagElements.forEach(el => el.destroy());
        diagElements = [];
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
        transitionManager.transitionTo(GAME_CONSTANTS.PHASE_UPGRADE);
    }

    function _onRetryClicked() {
        _hideAll();
        // Stop boss track & bring back main BGM if applicable
        if (typeof audio !== 'undefined' && audio.stopComplexTransition) {
            audio.stopComplexTransition(GAME_CONSTANTS.AUDIO_TRANSITIONS.BOSS);
        }
        // Reset combat state directly — no transition animation
        enemyManager.clearAllEnemies();
        projectileManager.clearAll();
        resourceManager.clearDrops();
        tower.reset(true);
        // Go straight back to combat
        gameStateMachine.goTo(GAME_CONSTANTS.PHASE_COMBAT);

        // Explicitly show the progress bar (and trigger its animation) since we skipped the transitionManager
        if (typeof gameHUD !== 'undefined') {
            gameHUD.setWaveProgressBarVisible(true);
        }
    }

    // ── events ───────────────────────────────────────────────────────────

    function _onPhaseChanged(phase, data = {}) {
        if (phase === GAME_CONSTANTS.PHASE_WAVE_COMPLETE) {
            isBossKill = !!data.bossKill;
            show();
        } else if (visible) {
            _hideAll();
        }
    }

    return { init, show };
})();
