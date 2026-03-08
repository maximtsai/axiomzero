// iterationOverScreen.js — Post-combat "ITERATION COMPLETE" summary screen.
// Shows collected resources and offers UPGRADES or RETRY SESSION.

const iterationOverScreen = (() => {
    let overlay = null;
    let titleText = null;
    let dataText = null;
    let insightText = null;
    let shardText = null;
    let processorText = null;
    let upgradesBtn = null;
    let retryBtn = null;
    let newTierText = null;

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
        titleText = PhaserScene.add.text(cx, cy - 125, 'ITERATION COMPLETE', {
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
        titleText.fullText = 'ITERATION COMPLETE';
        titleText.setText('');

        // Acquired resources
        dataText = PhaserScene.add.text(cx, 0, '', {
            fontFamily: 'JetBrainsMono_Regular',
            fontSize: '24px',
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

        newTierText = PhaserScene.add.text(cx, cy - 85, 'new tier unlocked', {
            fontFamily: 'JetBrainsMono_Italic',
            fontSize: '18px',
            color: '#00f5ff',
            align: 'center',
        }).setOrigin(0.5).setDepth(depth + 1).setVisible(false);

        // UPGRADES button
        upgradesBtn = new Button({
            normal: {
                ref: 'button_normal.png',
                atlas: 'buttons',
                x: cx - 113,
                y: cy + 160,
                depth: depth + 2,
            },
            hover: {
                ref: 'button_hover.png',
                atlas: 'buttons',
                x: cx - 113,
                y: cy + 160,
                depth: depth + 2,
            },
            press: {
                ref: 'button_press.png',
                atlas: 'buttons',
                x: cx - 113,
                y: cy + 160,
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
                y: cy + 160,
                depth: depth + 2,
            },
            hover: {
                ref: 'button_hover.png',
                atlas: 'buttons',
                x: cx + 113,
                y: cy + 160,
                depth: depth + 2,
            },
            press: {
                ref: 'button_press.png',
                atlas: 'buttons',
                x: cx + 113,
                y: cy + 160,
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
            titleText.fullText = 'BOSS DEFEATED';
            newTierText.setVisible(true);
        } else {
            titleText.fullText = 'ITERATION COMPLETE';
            newTierText.setVisible(false);
        }

        const cx = GAME_CONSTANTS.halfWidth;
        const cy = GAME_CONSTANTS.halfHeight;

        // Hide all initially
        dataText.setVisible(false);
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
            }
            if (sessionInsight > 0) {
                insightText.setText('⦵ INSIGHT gained: ' + sessionInsight);
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
        let startY = cy - 20 - (totalHeight / 2);

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
    }

    function _hideAll() {
        visible = false;
        overlay.setVisible(false);
        titleText.setVisible(false);
        dataText.setVisible(false);
        insightText.setVisible(false);
        shardText.setVisible(false);
        processorText.setVisible(false);
        if (newTierText) newTierText.setVisible(false);
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
        transitionManager.transitionTo(GAME_CONSTANTS.PHASE_UPGRADE);
    }

    function _onRetryClicked() {
        _hideAll();
        // Stop boss track & bring back main BGM if applicable
        if (typeof audio !== 'undefined' && audio.stopBossMusic) {
            audio.stopBossMusic();
        }
        // Reset combat state directly — no transition animation
        enemyManager.clearAllEnemies();
        projectileManager.clearAll();
        resourceManager.clearDrops();
        tower.reset();
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
