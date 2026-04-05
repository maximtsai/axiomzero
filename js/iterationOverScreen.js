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

    // EXP bar elements
    let expBarBg = null;
    let expBarFill = null;
    let expBarLabel = null;
    let expBarIcon = null;
    let expAnimElements = []; // Transient insight pop icons
    let _expFillTween = null;  // Active bar fill tween (so we can kill on exit)
    let _expDelayEvent = null; // Active post-levelup delay event

    let visible = false;
    let isBossKill = false;

    // ── init ─────────────────────────────────────────────────────────

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
        titleText = PhaserScene.add.text(cx, cy - 200, t('results', 'iteration_complete'), {
            fontFamily: 'Michroma',
            fontSize: '36px',
            color: '#00f5ff',
            align: 'center',
        }).setOrigin(0.5, 0.5).setDepth(depth + 1);

        // Add slight glow
        titleText.setShadow(0, 0, '#00f5ff', 8, true, true);

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

        // ── EXP Progress Bar ──────────────────────────────────────────
        const barW = 320;
        const barH = 14;
        const barX = cx - barW / 2;
        const barY = cy + 95; // positioned below resource summary

        expBarBg = PhaserScene.add.image(barX, barY, 'white_pixel');
        expBarBg.setOrigin(0, 0.5).setDisplaySize(barW, barH).setTint(0x222233).setDepth(depth + 2).setVisible(false);

        expBarFill = PhaserScene.add.image(barX, barY, 'white_pixel');
        expBarFill.setOrigin(0, 0.5).setDisplaySize(0, barH).setTint(0xffd700).setDepth(depth + 3).setVisible(false);

        expBarLabel = PhaserScene.add.text(cx, barY - 18, 'INSIGHT PROGRESS', {
            fontFamily: 'JetBrainsMono_Regular',
            fontSize: '13px',
            color: '#aaaaaa',
            align: 'center',
        }).setOrigin(0.5, 0.5).setDepth(depth + 2).setVisible(false);

        expBarIcon = PhaserScene.add.image(barX + barW + 14, barY, 'player', 'resrc_insight.png');
        expBarIcon.setOrigin(0.5, 0.5).setDepth(depth + 3).setAlpha(0.3).setVisible(false);

        // UPGRADES button — shifted down to accommodate EXP bar
        upgradesBtn = new Button({
            normal: {
                ref: 'button_normal.png',
                atlas: 'buttons',
                x: cx,
                y: cy + 190,
                depth: depth + 12,
            },
            hover: {
                ref: 'button_hover.png',
                atlas: 'buttons',
                x: cx,
                y: cy + 190,
                depth: depth + 12,
            },
            press: {
                ref: 'button_press.png',
                atlas: 'buttons',
                x: cx,
                y: cy + 190,
                depth: depth + 12,
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
        upgradesBtn.setDepth(depth + 12);

        // RETRY SESSION button
        retryBtn = new Button({
            normal: {
                ref: 'button_normal.png',
                atlas: 'buttons',
                x: cx,
                y: cy + 265,
                depth: depth + 12,
            },
            hover: {
                ref: 'button_hover.png',
                atlas: 'buttons',
                x: cx,
                y: cy + 265,
                depth: depth + 12,
            },
            press: {
                ref: 'button_press.png',
                atlas: 'buttons',
                x: cx,
                y: cy + 265,
                depth: depth + 12,
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
        retryBtn.setDepth(depth + 12);
    }

    // ── show / hide ──────────────────────────────────────────────────

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
            dataText.setText(t('results', 'no_resources'));
            dataText.setVisible(true);
            activeTexts.push(dataText);
        } else {
            if (sessionData > 0) {
                dataText.setText(t('results', 'data_collected') + sessionData);
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
                insightText.setText(t('results', 'insight_gained') + sessionInsight);
                insightText.setVisible(true);
                activeTexts.push(insightText);
            }
            if (sessionShards > 0) {
                shardText.setText(t('results', 'shards_found') + sessionShards);
                shardText.setVisible(true);
                activeTexts.push(shardText);
            }
            if (sessionProcessors > 0) {
                processorText.setText(t('results', 'processors_salvaged') + sessionProcessors);
                processorText.setVisible(true);
                activeTexts.push(processorText);
            }
        }

        // Center block dynamically — kept compact, above EXP bar
        const lineSpacing = 30;
        const totalHeight = (activeTexts.length - 1) * lineSpacing;
        let startY = cy - 95 - (totalHeight / 2);

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

        // ── EXP Bar Animation ─────────────────────────────────────────
        // Delay so it plays after the typewriter finishes
        const typewriterDuration = titleText.fullText.length * 30 + 400;
        PhaserScene.time.delayedCall(typewriterDuration, () => {
            if (visible) _playExpAnimation();
        });

        // ── Diagnostics ──────────────────────────────────────────────
        _populateDiagnostics(cx, cy);
    }

    /**
     * Plays the animated EXP progress bar on the iteration complete screen.
     * Handles partial bars, multiple level-ups within one session, and
     * edge cases (zero EXP gained, exactly 0 start state).
     */
    function _playExpAnimation() {
        const expState = tower.getExpState();
        const { expAtStart, expNow, sessionInsightCount, threshold } = expState;

        // Total EXP gained this session = full levels + partial progress
        // If expNow < expAtStart, exp wrapped around at least once more
        const totalExpGained = sessionInsightCount * threshold + (expNow - expAtStart);

        // If literally no EXP was gained, show bar at current fill but no animation
        if (totalExpGained <= 0) {
            _showStaticExpBar(expAtStart / threshold);
            return;
        }

        const barW = 320;
        const depth = GAME_CONSTANTS.DEPTH_ITERATION_OVER;

        // Show bar elements
        expBarBg.setVisible(true);
        expBarFill.setVisible(true).setDisplaySize(0, 14);
        expBarLabel.setVisible(true);
        expBarIcon.setVisible(true).setAlpha(0.3);

        // Fade label in
        PhaserScene.tweens.add({
            targets: [expBarBg, expBarLabel],
            alpha: { from: 0, to: 1 },
            duration: 350,
            ease: 'Cubic.easeOut',
        });

        // Start the fill animation sequence
        // Each "segment" = one trip from startFill → 1.0 (level up) or → endFill (partial)
        const startRatio = expAtStart / threshold;

        let segments = [];
        if (sessionInsightCount === 0) {
            // Pure partial — no level-ups this session
            segments.push({ from: startRatio, to: expNow / threshold, levelUp: false });
        } else {
            // First: fill from startRatio to 1.0 (first level-up)
            segments.push({ from: startRatio, to: 1.0, levelUp: true });
            // Middle: full bars for any additional level-ups
            for (let i = 1; i < sessionInsightCount; i++) {
                segments.push({ from: 0, to: 1.0, levelUp: true });
            }
            // Last: partial fill with remaining EXP
            if (expNow > 0) {
                segments.push({ from: 0, to: expNow / threshold, levelUp: false });
            }
        }

        _runExpSegment(segments, 0, barW, depth);
    }

    function _showStaticExpBar(ratio) {
        const barW = 320;
        expBarBg.setVisible(true).setAlpha(1);
        expBarFill.setVisible(true).setDisplaySize(barW * Math.min(1, Math.max(0, ratio)), 14);
        expBarLabel.setVisible(true).setAlpha(1);
        expBarIcon.setVisible(true).setAlpha(0.3);
    }

    function _runExpSegment(segments, idx, barW, depth) {
        if (idx >= segments.length) return;
        const seg = segments[idx];
        const fromW = barW * Math.max(0, seg.from);
        const toW = barW * Math.min(1, seg.to);
        const fillDuration = Math.max(250, (seg.to - seg.from) * 1600);

        // Reset fill width for this segment
        expBarFill.setDisplaySize(fromW, 14);

        _expFillTween = PhaserScene.tweens.add({
            targets: expBarFill,
            displayWidth: toW,
            duration: fillDuration,
            ease: 'Sine.easeInOut',
            onComplete: () => {
                if (!visible) return;

                if (seg.levelUp) {
                    _playLevelUpEffect(depth, barW, segments, idx, fillDuration);
                } else {
                    // Final partial fill — done
                    _finishExpAnimation();
                }
            }
        });
    }

    function _playLevelUpEffect(depth, barW, segments, idx, fillDuration) {
        // Flash the bar white
        PhaserScene.tweens.add({
            targets: expBarFill,
            tint: { from: 0xffffff, to: 0xffd700 },
            duration: 300,
            ease: 'Cubic.easeOut',
        });

        // Glow the icon
        PhaserScene.tweens.add({
            targets: expBarIcon,
            alpha: 1,
            scaleX: 1.4,
            scaleY: 1.4,
            duration: 180,
            ease: 'Quad.easeOut',
            onComplete: () => {
                PhaserScene.tweens.add({
                    targets: expBarIcon,
                    alpha: 0.3,
                    scaleX: 1,
                    scaleY: 1,
                    duration: 400,
                    ease: 'Quad.easeIn',
                });
            }
        });

        // Pop a floating insight icon at the bar's right end
        const popIcon = PhaserScene.add.image(
            expBarBg.x + barW, expBarBg.y,
            'player', 'resrc_insight.png'
        );
        popIcon.setOrigin(0.5, 0.5).setDepth(GAME_CONSTANTS.DEPTH_ITERATION_OVER + 4).setScale(1.2).setAlpha(1);
        expAnimElements.push(popIcon);

        PhaserScene.tweens.add({
            targets: popIcon,
            y: popIcon.y - 45,
            scaleX: 2.0,
            scaleY: 2.0,
            alpha: 0,
            duration: 900,
            ease: 'Cubic.easeOut',
            onComplete: () => {
                if (popIcon.active) popIcon.destroy();
                const i = expAnimElements.indexOf(popIcon);
                if (i !== -1) expAnimElements.splice(i, 1);
            }
        });

        // Play levelup sound
        audio.play('levelup', 0.85, false);

        // Brief pause, then reset bar and play next segment
        _expDelayEvent = PhaserScene.time.delayedCall(450, () => {
            if (!visible) return;
            expBarFill.setDisplaySize(0, 14);
            _runExpSegment(segments, idx + 1, barW, depth);
        });
    }

    function _finishExpAnimation() {
        // Subtle pulse on bar label to signal completion
        PhaserScene.tweens.add({
            targets: expBarLabel,
            alpha: { from: 1, to: 0.4 },
            duration: 800,
            yoyo: true,
            repeat: 0,
            ease: 'Sine.easeInOut',
        });
    }

    function _populateDiagnostics(cx, cy) {
        // Clear old elements if any
        diagElements.forEach(el => { if (el && el.destroy) el.destroy(); });
        diagElements = [];

        const hasDiagnostics = (gameState.upgrades || {}).diagnostic_analytics > 0;
        if (!hasDiagnostics) return;

        const depth = GAME_CONSTANTS.DEPTH_ITERATION_OVER + 1;
        const stats = statsTracker.getStats();
        const dmg = stats.damage;
        const totalDmg = Object.values(dmg).reduce((a, b) => a + b, 0);

        // "DIAGNOSTIC REPORT" Header — shifted up slightly to coexist with EXP bar
        const reportTitle = PhaserScene.add.text(cx, cy - 45, t('results', 'diagnostic_report'), {
            fontFamily: 'Michroma',
            fontSize: '20px',
            color: '#00f5ff',
        }).setOrigin(0.5).setDepth(depth).setAlpha(0.8);
        diagElements.push(reportTitle);

        if (totalDmg <= 0) {
            const noDataText = PhaserScene.add.text(cx, cy - 10, t('results', 'no_damage_dealt'), {
                fontFamily: 'JetBrainsMono_Regular',
                fontSize: '18px',
                color: '#aaaaaa',
            }).setOrigin(0.5).setDepth(depth).setAlpha(0.9);
            diagElements.push(noDataText);
            return;
        }

        const sources = [
            { id: 'cursor', label: t('results', 'cursor'), color: 0x00f5ff },
            { id: 'tower', label: t('results', 'tower'), color: 0xffe600 },
            { id: 'lightning', label: t('results', 'lightning'), color: 0xffe600 },
            { id: 'shockwave', label: t('results', 'shockwave'), color: 0x00f5ff },
            { id: 'laser', label: t('results', 'laser'), color: 0xff2d78 },
            { id: 'artillery', label: t('results', 'artillery'), color: 0xff9500 },
            { id: 'friendlyfire', label: t('results', 'collateral'), color: 0xff2d78 },
            { id: 'other', label: t('results', 'system'), color: 0x777777 },
        ];

        // Combine endgame into collateral if needed, or group
        dmg.friendlyfire += (dmg.endgame || 0);

        const activeSources = sources.filter(s => dmg[s.id] > 0);
        const startY = cy - 10;
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

            // Percentage and Raw Damage
            const rawDmg = Math.round(dmg[s.id]);
            const pText = PhaserScene.add.text(cx + (barWidth / 2) + 10, y, `${Math.round(pct * 100)}% (${rawDmg.toLocaleString()})`, {
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

        // EXP bar
        if (_expFillTween) { _expFillTween.stop(); _expFillTween = null; }
        if (_expDelayEvent) { _expDelayEvent.remove(); _expDelayEvent = null; }
        if (expBarBg) expBarBg.setVisible(false);
        if (expBarFill) expBarFill.setVisible(false);
        if (expBarLabel) expBarLabel.setVisible(false);
        if (expBarIcon) expBarIcon.setVisible(false);

        // Clean up transient insight pop icons
        expAnimElements.forEach(el => { if (el && el.destroy) el.destroy(); });
        expAnimElements = [];

        if (titleText.typewriterEvent) titleText.typewriterEvent.remove();
        diagElements.forEach(el => { if (el && el.destroy) el.destroy(); });
        diagElements = [];
    }

    // ── button handlers ──────────────────────────────────────────────

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
        gameStateMachine.goTo(GAME_CONSTANTS.PHASE_COMBAT);
    }

    // ── events ───────────────────────────────────────────────────────

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
