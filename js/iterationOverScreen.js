// iterationOverScreen.js — Post-combat "ITERATION COMPLETE" summary screen.
// Shows collected resources and offers UPGRADES or RETRY SESSION.

const iterationOverScreen = (() => {
    let overlay = null;
    let titleText = null;
    let dataText = null;           // "DATA COLLECTED" label (small)
    let dataNumberText = null;     // "◈ 2,847" big number line
    let dataDeltaText = null;      // "+203 vs last run" comparison
    let sniffedDataText = null;
    let insightText = null;
    let shardText = null;
    let processorText = null;
    let upgradesBtn = null;
    let retryBtn = null;
    let expHoverBtn = null;
    let diagElements = []; // Track diagnostic sprites/text for cleanup

    // EXP bar elements
    let expBarBg = null;
    let expBarFill = null;
    let expBarLabel = null;
    let expBarIcon = null;
    let expAnimElements = []; // Transient insight pop icons
    let _expFillTween = null;  // Active bar fill tween (so we can kill on exit)
    let _expDelayEvent = null; // Active post-levelup delay event
    let _activeBurstTweens = []; // Track data burst tweens for cleanup
    let _insightSparkleEmitter = null;

    // Session state
    let _lastRunData = null; // null until at least one run completes
    let _dataCountTween = null;
    let barW = 320;
    let barH = 11;
    let barX = 0;
    let barY = 0;

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
        titleText = PhaserScene.add.text(cx, cy - 190, t('results', 'iteration_complete'), {
            fontFamily: 'Michroma',
            fontSize: '36px',
            color: '#00f5ff',
            align: 'center',
        }).setOrigin(0.5, 0.5).setDepth(depth + 1);

        // Add slight glow
        titleText.setShadow(0, 0, '#00f5ff', 8, true, true);

        titleText.fullText = t('results', 'iteration_complete');
        titleText.setText('');

        // ── Data display (two-line) ───────────────────────────────────
        // Line 1 (large): "◈ 2,847"
        dataNumberText = PhaserScene.add.text(cx, 0, '', {
            fontFamily: 'JetBrainsMono_Bold',
            fontSize: '42px',
            color: '#00f5ff',
            align: 'center',
        }).setOrigin(0.5).setDepth(depth + 1);
        dataNumberText.setShadow(0, 0, '#00f5ff', 6, true, true);

        // Line 2 (small label): "DATA COLLECTED"
        dataText = PhaserScene.add.text(cx, 0, '', {
            fontFamily: 'JetBrainsMono_Regular',
            fontSize: '23px',
            color: '#66aacc',
            align: 'center',
        }).setOrigin(0.5).setDepth(depth + 1);

        // Line 3 (tiny delta): "+203 vs last run"
        dataDeltaText = PhaserScene.add.text(cx, 0, '', {
            fontFamily: 'JetBrainsMono_Regular',
            fontSize: '24px',
            color: '#aaaaaa',
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
        barW = 304; // Requested: 8px shorter than inner 308px container width
        barH = 7;
        barX = cx - barW / 2;
        barY = cy + 108; // moved 5px down

        const containerW = 320;
        const containerH = 21;
        const stableBarX = cx - 158; // Original center-alignment point

        expBarBg = PhaserScene.add.nineslice(stableBarX - 6, barY, 'ui', 'progress_container.png', containerW, containerH, 6, 6, 6, 6);
        expBarBg.setOrigin(0, 0.5).setDepth(depth + 2).setVisible(false).setAlpha(0.7);

        expBarFill = PhaserScene.add.image(stableBarX + 1, barY, 'white_pixel');
        expBarFill.setOrigin(0, 0.5).setDisplaySize(0, barH).setTint(0xffffff).setDepth(depth + 3).setVisible(false).setAlpha(0.7);

        expBarLabel = PhaserScene.add.text(cx, barY - 30, t('results', 'insight_progress'), {
            fontFamily: 'JetBrainsMono_Regular',
            fontSize: '23px',
            color: '#ffffff',
            align: 'center',
        }).setOrigin(0.5, 0.5).setDepth(depth + 2).setVisible(false);

        expBarIcon = PhaserScene.add.image(barX + barW + 18, barY, 'player', 'resrc_insight.png');
        expBarIcon.setOrigin(0.5, 0.5).setDepth(depth + 3).setAlpha(0.3).setVisible(false);

        // UPGRADES button — shifted down to accommodate EXP bar
        upgradesBtn = new Button({
            normal: {
                ref: helper.isMobileDevice() ? 'button_normal_mobile.png' : 'button_normal.png',
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
            onHover: () => {
                let sfx = audio.play('click', 0.95);
                if (sfx) sfx.detune = Phaser.Math.Between(-50, 50);
            },
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
                ref: helper.isMobileDevice() ? 'button_normal_mobile.png' : 'button_normal.png',
                atlas: 'buttons',
                x: cx,
                y: cy + 285,
                depth: depth + 12,
                alpha: 1,
            },
            hover: {
                ref: 'button_hover.png',
                atlas: 'buttons',
                x: cx,
                y: cy + 285,
                depth: depth + 12,
                alpha: 1,
            },
            press: {
                ref: 'button_press.png',
                atlas: 'buttons',
                x: cx,
                y: cy + 285,
                depth: depth + 12,
                alpha: 1,
            },
            disable: {
                alpha: 0
            },
            onMouseUp: _onRetryClicked,
            onHover: () => {
                let sfx = audio.play('click', 0.95);
                if (sfx) sfx.detune = Phaser.Math.Between(-50, 50);
            },
        });
        retryBtn.setScale(helper.isMobileDevice() ? 1.0 : 0.9);
        retryBtn.addText(t('ui', 'retry'), {
            fontFamily: 'JetBrainsMono_Bold',
            fontSize: '25px',
            color: '#ffffff',
        });
        retryBtn.setScrollFactor(0);
        retryBtn.setDepth(depth + 12);

        // ── EXP bar hover area ──
        expHoverBtn = new Button({
            normal: {
                ref: 'white_pixel',
                x: cx,
                y: barY - 11,
                alpha: 0.001,
                scaleX: (barW + 20) * 0.5,
                scaleY: 30
            },
            onHover: () => {
                let sfx = audio.play('click', 0.95);
                if (sfx) sfx.detune = Phaser.Math.Between(-150, -50);
                tooltipManager.show(expHoverBtn.x + 400, expHoverBtn.y - 90, [
                    { text: t('results', 'insight_progress_title'), style: 'title', color: '#ffffff' },
                    { text: t('results', 'insight_progress_desc'), style: 'normal' }
                ], 410);
            },
            onHoverOut: () => {
                tooltipManager.hide();
            }
        });
        expHoverBtn.setDepth(depth + 20);
        expHoverBtn.setScrollFactor(0);
        expHoverBtn.setVisible(false);

        // ── Sparkle emitter for Insight Level Up ──
        _insightSparkleEmitter = PhaserScene.add.particles(0, 0, 'ui', {
            frame: 'sparkle.png',
            speed: { min: 40, max: 80 },
            ease: 'Quad.easeOut',
            lifespan: 1800,
            scale: { start: 1.0, end: 0, ease: 'Quart.easeIn' },
            alpha: 1,
            rotate: { start: 0, end: 5400 },
            gravityY: 5,
            frequency: 75,
            emitting: false,
            depth: depth + 11,
            emitZone: {
                source: new Phaser.Geom.Rectangle(barX, barY - barH / 2, barW, barH),
                type: 'random'
            }
        });
        _insightSparkleEmitter.setDepth(depth + 11);
        if (typeof upgradeTree !== 'undefined' && upgradeTree.assignToUICamera) {
            upgradeTree.assignToUICamera(_insightSparkleEmitter);
        }

        const allStaticElements = [
            overlay, titleText, dataNumberText, dataText, dataDeltaText, sniffedDataText,
            insightText, shardText, processorText, expBarBg, expBarFill, expBarLabel, expBarIcon,
            upgradesBtn, retryBtn, expHoverBtn
        ];
        allStaticElements.forEach(el => {
            if (el && typeof upgradeTree !== 'undefined' && upgradeTree.assignToUICamera) {
                upgradeTree.assignToUICamera(el);
            }
        });
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
        retryBtn.setState(isBossKill ? DISABLE : NORMAL);
        expHoverBtn.setVisible(true);
        expHoverBtn.setState(DISABLE);

        if (isBossKill) {
            titleText.fullText = t('results', 'boss_defeated');
            audio.play('victory', 1.0, false);
        } else {
            titleText.fullText = t('results', 'iteration_complete');
        }

        const cx = GAME_CONSTANTS.halfWidth;
        const cy = GAME_CONSTANTS.halfHeight;

        // Hide all initially
        dataNumberText.setVisible(false);
        dataText.setVisible(false);
        dataDeltaText.setVisible(false);
        sniffedDataText.setVisible(false);
        insightText.setVisible(false);
        shardText.setVisible(false);
        processorText.setVisible(false);

        // Stop any previous count-up tween
        if (_dataCountTween) { _dataCountTween.stop(); _dataCountTween = null; }

        const activeTexts = [];

        if (sessionData === 0 && sessionInsight === 0 && sessionShards === 0 && sessionProcessors === 0) {
            dataText.setText(t('results', 'no_resources'));
            dataText.setFontSize(25); // Match Insight Progress/Data Collected
            dataText.setColor('#aaaaaa');
            dataText.setVisible(true);
            activeTexts.push(dataText);
        } else {
            if (sessionData > 0) {
                // Ensure default label style
                dataText.setFontSize(23); // Was 13
                dataText.setColor('#66aacc');
                // ── Number line (large, with ◈ prefix) ──
                dataNumberText.setText('◈ 0');
                dataNumberText.setVisible(true);
                activeTexts.push(dataNumberText);

                // ── Label line (small, dimmed) ──
                dataText.setText(t('results', 'data_collected'));
                dataText.setVisible(true);
                activeTexts.push(dataText);

                // ── Delta line vs last run ──
                if (_lastRunData !== null) {
                    const delta = sessionData - _lastRunData;
                    const sign = delta >= 0 ? '+' : '';
                    const color = delta >= 0 ? '#00ff88' : '#ff4444';
                    dataDeltaText.setText(`${sign}${delta} vs last run`);
                    dataDeltaText.setColor(color);
                    dataDeltaText.setVisible(true);
                    activeTexts.push(dataDeltaText);
                }

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

        // ── Dynamic vertical centering ────────────────────────────────
        // dataNumberText is taller than other lines, so give it extra spacing
        const baseSpacing = 30;

        // Calculate total block height first for proper centering
        const lineHeights = activeTexts.map(txt => {
            if (txt === dataNumberText) return 56;
            if (txt === dataText) return 30;
            if (txt === dataDeltaText) return 34;
            return baseSpacing;
        });
        const totalH = lineHeights.reduce((a, b) => a + b, 0);

        // Resource block starts around the center, slightly offset up
        const blockTopY = cy - 85 - totalH / 2;
        let currentY = blockTopY;

        for (let i = 0; i < activeTexts.length; i++) {
            let yOffset = (activeTexts[i] === dataNumberText) ? 4 : 0;
            activeTexts[i].setY(currentY + yOffset);
            currentY += lineHeights[i];
        }

        // Position title based on the block top - ensure at least 65px gap
        titleText.setY(Math.min(cy - 200, blockTopY - 55));

        // ── Count-up animation for DATA number ───────────────────────
        if (sessionData > 0) {
            const counter = { val: 0 };
            const duration = Math.max(200, Math.floor(Math.sqrt(sessionData) * 20));
            _dataCountTween = PhaserScene.tweens.add({
                targets: counter,
                val: sessionData,
                duration: duration,
                ease: 'Quad.easeOut',
                onUpdate: () => {
                    if (dataNumberText && dataNumberText.active) {
                        dataNumberText.setText(`◈ ${helper.formatNumber(counter.val)}`);
                    }
                },
                onComplete: () => {
                    if (dataNumberText && dataNumberText.active) {
                        dataNumberText.setText(`◈ ${helper.formatNumber(sessionData)}`);
                    }
                    _dataCountTween = null;
                    // Fire burst effect at the number's position
                    if (visible) _playDataBurst(dataNumberText.x, dataNumberText.y, sessionData);
                }
            });
        }

        // Save this run's data for next run's delta comparison
        // (we save at the END so the comparison logic above uses the PREVIOUS value)
        _lastRunData = sessionData;

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
     * Fires a burst of nineslice data_collect squares from the data number,
     * rotated 45°, scattering outward like the cursor collect FX but larger.
     */
    function _playDataBurst(cx, cy, amount) {
        const depth = GAME_CONSTANTS.DEPTH_ITERATION_OVER + 4;
        const spread = 80;

        let count = 8; // Default for 1000+
        if (amount <= 9) count = 1;
        else if (amount <= 99) count = 3;
        else if (amount <= 999) count = 5;

        for (let i = 0; i < count; i++) {
            let px = cx + (Math.random() - 0.5) * spread;
            let py = cy + (Math.random() - 0.5) * spread;

            const particle = PhaserScene.add.image(px, py, 'ui', 'square_particle.png');
            particle.setDepth(GAME_CONSTANTS.DEPTH_ITERATION_OVER + 10).setTint(0x00f5ff);
            
            if (typeof upgradeTree !== 'undefined' && upgradeTree.assignToUICamera) {
                upgradeTree.assignToUICamera(particle);
            }
            
            expAnimElements.push(particle);

            // Stagger each piece slightly
            const delay = i * 25;
            const startSize = 18 + Math.random() * 10;
            const endSize = (count === 1) ? (startSize * 3) : (80 + Math.random() * 60);

            PhaserScene.time.delayedCall(delay, () => {
                if (!visible) return;

                const slice = PhaserScene.add.nineslice(px, py, 'player', 'data_collect.png', startSize, startSize, 8, 8, 8, 8);
                slice.setRotation(Phaser.Math.DegToRad(45));
                slice.setDepth(depth);
                slice.setScrollFactor(0);
                slice.setAlpha(1);
                slice.setTint(0x00f5ff);
                expAnimElements.push(slice);
                
                if (typeof upgradeTree !== 'undefined' && upgradeTree.assignToUICamera) {
                    upgradeTree.assignToUICamera(slice);
                }

                // Expand and fade only (no position tween)
                const t = PhaserScene.tweens.add({
                    targets: slice,
                    width: endSize,
                    height: endSize,
                    alpha: { from: 1.4, to: 0 },
                    duration: 1400 + Math.random() * 200,
                    ease: count === 1 ? 'Back.easeOut' : 'Cubic.easeOut',
                    onComplete: () => {
                        if (slice.active) slice.destroy();
                        const idx = expAnimElements.indexOf(slice);
                        if (idx !== -1) expAnimElements.splice(idx, 1);
                        _activeBurstTweens = _activeBurstTweens.filter(tween => tween !== t);
                    }
                });
                _activeBurstTweens.push(t);
            });
        }
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
        const totalExpGained = sessionInsightCount * threshold + (expNow - expAtStart);

        // If literally no EXP was gained, show bar at current fill but no animation
        if (totalExpGained <= 0) {
            _showStaticExpBar(expAtStart / threshold);
            return;
        }

        // barW is now globally set to 300 in init()
        const depth = GAME_CONSTANTS.DEPTH_ITERATION_OVER;

        // Show bar elements
        expBarBg.setVisible(true).setAlpha(0);
        expBarFill.setVisible(true).setDisplaySize(0, barH).setAlpha(0.7);
        expBarLabel.setVisible(true).setAlpha(0);
        expBarIcon.setVisible(true).setAlpha(0.7);
        expHoverBtn.setState(NORMAL);

        // Fade elements in
        PhaserScene.tweens.add({
            targets: expBarBg,
            alpha: 0.7,
            duration: 350,
            ease: 'Cubic.easeOut',
        });
        PhaserScene.tweens.add({
            targets: expBarLabel,
            alpha: 0.8,
            duration: 350,
            ease: 'Cubic.easeOut',
        });

        // Build animation segments
        const startRatio = expAtStart / threshold;

        let segments = [];
        if (sessionInsightCount === 0) {
            segments.push({ from: startRatio, to: expNow / threshold, levelUp: false });
        } else {
            segments.push({ from: startRatio, to: 1.0, levelUp: true });
            for (let i = 1; i < sessionInsightCount; i++) {
                segments.push({ from: 0, to: 1.0, levelUp: true });
            }
            if (expNow > 0) {
                segments.push({ from: 0, to: expNow / threshold, levelUp: false });
            }
        }

        _runExpSegment(segments, 0, barW, depth);
    }

    function _showStaticExpBar(ratio) {
        expBarBg.setVisible(true).setAlpha(0.7);
        expBarFill.setVisible(true).setDisplaySize(barW * Math.min(1, Math.max(0, ratio)), barH).setAlpha(0.7);
        expBarLabel.setVisible(true).setAlpha(1);
        expBarIcon.setVisible(true).setAlpha(0.7);
        expHoverBtn.setState(NORMAL);
    }

    function _runExpSegment(segments, idx, currentBarW, depth) {
        if (idx >= segments.length) return;
        const seg = segments[idx];
        const fromW = currentBarW * Math.max(0, seg.from);
        const toW = currentBarW * Math.min(1, seg.to);
        const fillDuration = Math.max(250, (seg.to - seg.from) * 1600);

        expBarFill.setDisplaySize(fromW, barH);

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
                    _finishExpAnimation();
                }
            }
        });
    }

    function _playLevelUpEffect(depth, barW, segments, idx, fillDuration) {
        PhaserScene.tweens.add({
            targets: expBarFill,
            tint: { from: 0xffffff, to: 0xffd700 },
            duration: 300,
            ease: 'Cubic.easeOut',
        });

        // Start sparkle emission
        if (_insightSparkleEmitter) _insightSparkleEmitter.start();

        // Glow the icon and KEEP it at alpha 1
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
                    scaleX: 1,
                    scaleY: 1,
                    duration: 400,
                    ease: 'Quad.easeIn',
                });
            }
        });

        PhaserScene.tweens.add({
            targets: [expBarBg, expBarFill, expBarLabel],
            alpha: 1,
            duration: 250,
            ease: 'Sine.easeOut'
        });

        // Pop a floating insight icon at the bar's right end
        const popIcon = PhaserScene.add.image(
            expBarBg.x + barW, expBarBg.y,
            'player', 'resrc_insight.png'
        );
        popIcon.setOrigin(0.5, 0.5).setDepth(GAME_CONSTANTS.DEPTH_ITERATION_OVER + 4).setScale(1.2).setAlpha(1);
        expAnimElements.push(popIcon);
        
        if (typeof upgradeTree !== 'undefined' && upgradeTree.assignToUICamera) {
            upgradeTree.assignToUICamera(popIcon);
        }

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

        audio.play('levelup', 0.85, false);

        _expDelayEvent = PhaserScene.time.delayedCall(450, () => {
            if (!visible) return;
            expBarFill.setDisplaySize(0, barH);
            _runExpSegment(segments, idx + 1, barW, depth);
        });
    }

    function _finishExpAnimation() {
        PhaserScene.tweens.add({
            targets: expBarLabel,
            alpha: { from: 0.8, to: 0.4 },
            duration: 800,
            yoyo: true,
            repeat: 0,
            ease: 'Sine.easeInOut',
        });
    }

    function _populateDiagnostics(cx, cy) {
        diagElements.forEach(el => { if (el && el.destroy) el.destroy(); });
        diagElements = [];

        const hasDiagnostics = (gameState.upgrades || {}).diagnostic_analytics > 0;
        if (!hasDiagnostics) return;

        const depth = GAME_CONSTANTS.DEPTH_ITERATION_OVER + 1;
        const stats = statsTracker.getStats();
        const dmg = stats.damage;
        const totalDmg = Object.values(dmg).reduce((a, b) => a + b, 0);

        // Position: Bottom Left
        const margin = 25;
        const panelW = 440;
        const panelH = 300;
        const startX = margin;
        const startY = GAME_CONSTANTS.HEIGHT - panelH - margin;

        // Background Panel
        const panel = PhaserScene.add.image(startX, startY, 'white_pixel')
            .setOrigin(0)
            .setDisplaySize(panelW, panelH)
            .setTint(0x000000)
            .setAlpha(0.4)
            .setDepth(depth);
        diagElements.push(panel);

        const reportTitle = PhaserScene.add.text(startX + 15, startY + 15, t('results', 'diagnostic_report'), {
            fontFamily: 'Michroma',
            fontSize: '22px', // Was 16
            color: '#00f5ff',
        }).setOrigin(0).setDepth(depth + 1).setAlpha(0.8);
        diagElements.push(reportTitle);

        if (totalDmg <= 0) {
            const noDataText = PhaserScene.add.text(startX + 15, startY + 55, t('results', 'no_damage_dealt'), {
                fontFamily: 'JetBrainsMono_Regular',
                fontSize: '20px', // Was 14
                color: '#aaaaaa',
            }).setOrigin(0).setDepth(depth + 1).setAlpha(0.9);
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

        dmg.friendlyfire += (dmg.endgame || 0);

        const activeSources = sources.filter(s => dmg[s.id] > 0);
        const listStartY = startY + 55;
        const barMaxWidth = 200; // Was 120
        const entryHeight = 26; // Was 18

        activeSources.forEach((s, i) => {
            const y = listStartY + (i * entryHeight);
            const pct = dmg[s.id] / totalDmg;

            // Label
            const lbl = PhaserScene.add.text(startX + 15, y, s.label, {
                fontFamily: 'JetBrainsMono_Bold',
                fontSize: '17px', // Was 11
                color: '#ffffff',
            }).setOrigin(0, 0.5).setDepth(depth + 1).setAlpha(0.8);

            // Bar BG
            const barOffset = 135; // Was 85
            const bgW = barMaxWidth;
            const bg = PhaserScene.add.image(startX + barOffset, y, 'white_pixel')
                .setDepth(depth + 1)
                .setDisplaySize(bgW, 10) // Was 6
                .setTint(0x222222)
                .setAlpha(0.4)
                .setOrigin(0, 0.5);

            // Bar Fill
            const fill = PhaserScene.add.image(startX + barOffset, y, 'white_pixel')
                .setDepth(depth + 2)
                .setDisplaySize(bgW * pct, 10) // Was 6
                .setTint(s.color)
                .setOrigin(0, 0.5);

            // Percentage
            const pText = PhaserScene.add.text(startX + barOffset + bgW + 12, y, `${Math.round(pct * 100)}%`, {
                fontFamily: 'JetBrainsMono_Regular',
                fontSize: '16px', // Was 10
                color: '#ffffff',
            }).setOrigin(0, 0.5).setDepth(depth + 1).setAlpha(0.8);

            diagElements.push(lbl, bg, fill, pText);
        });

        if (stats.executions > 0) {
            const execY = listStartY + (activeSources.length * entryHeight) + 12;
            const lbl = PhaserScene.add.text(startX + 15, execY, 'EXECUTION COUNT:', {
                fontFamily: 'JetBrainsMono_Bold',
                fontSize: '17px', // Was 11
                color: '#ff2d78',
            }).setOrigin(0, 0.5).setDepth(depth + 1);

            const valText = PhaserScene.add.text(startX + 195, execY, stats.executions.toString(), {
                fontFamily: 'JetBrainsMono_Bold',
                fontSize: '17px', // Was 11
                color: '#ff2d78',
            }).setOrigin(0, 0.5).setDepth(depth + 1);

            diagElements.push(lbl, valText);
        }

        diagElements.forEach(el => {
            if (el && typeof upgradeTree !== 'undefined' && upgradeTree.assignToUICamera) {
                upgradeTree.assignToUICamera(el);
            }
        });
    }

    function _hideAll() {
        visible = false;
        overlay.setVisible(false);
        titleText.setVisible(false);
        dataNumberText.setVisible(false);
        dataText.setVisible(false);
        dataDeltaText.setVisible(false);
        sniffedDataText.setVisible(false);
        insightText.setVisible(false);
        shardText.setVisible(false);
        processorText.setVisible(false);
        upgradesBtn.setVisible(false);
        upgradesBtn.setState(DISABLE);
        retryBtn.setVisible(false);
        retryBtn.setState(DISABLE);
        expHoverBtn.setVisible(false);
        expHoverBtn.setState(DISABLE);

        // Stop count-up tween
        if (_dataCountTween) { _dataCountTween.stop(); _dataCountTween = null; }

        // EXP bar
        if (_expFillTween) { _expFillTween.stop(); _expFillTween = null; }
        if (_expDelayEvent) { _expDelayEvent.remove(); _expDelayEvent = null; }
        _activeBurstTweens.forEach(t => { if (t) t.stop(); });
        _activeBurstTweens = [];
        if (expBarBg) expBarBg.setVisible(false);
        if (expBarFill) expBarFill.setVisible(false);
        if (expBarLabel) expBarLabel.setVisible(false);
        if (expBarIcon) expBarIcon.setVisible(false);
        if (_insightSparkleEmitter) {
            _insightSparkleEmitter.stop();
            _insightSparkleEmitter.killAll();
        }

        // Clean up transient anim elements (insight pop icons + data burst pieces)
        expAnimElements.forEach(el => { if (el && el.active) el.destroy(); });
        expAnimElements = [];

        if (titleText.typewriterEvent) titleText.typewriterEvent.remove();
        diagElements.forEach(el => { if (el && el.destroy) el.destroy(); });
        diagElements = [];
        tooltipManager.hide();
    }

    // ── button handlers ──────────────────────────────────────────────

    function _onUpgradesClicked() {
        _hideAll();
        enemyManager.clearAllEnemies();
        projectileManager.clearAll();
        resourceManager.clearDrops();
        tower.reset();
        tower.setBackupUsed(false);
        tower.setIterativeGrowthUsed(false);
        transitionManager.transitionTo(GAME_CONSTANTS.PHASE_UPGRADE);
    }

    function _onRetryClicked() {
        _hideAll();
        if (typeof audio !== 'undefined' && audio.stopComplexTransition) {
            audio.stopComplexTransition(GAME_CONSTANTS.AUDIO_TRANSITIONS.BOSS);
        }
        enemyManager.clearAllEnemies();
        projectileManager.clearAll();
        resourceManager.clearDrops();
        tower.reset(true);
        tower.setBackupUsed(false);
        tower.setIterativeGrowthUsed(false);
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
