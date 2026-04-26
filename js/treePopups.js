/**
 * @fileoverview Manages popups associated with the Upgrade Tree, such as the Level Select menu.
 * Extracted to reduce the size of upgradeTree.js.
 */
const treePopups = (() => {
    // Level Selection Popup State
    let levelSelectOverlay = null;
    let levelSelectButtons = [];
    let selectedLevel = 1;

    function showLevelSelectPopup() {
        audio.play('retro1', 1.0);
        const cx = GAME_CONSTANTS.halfWidth;
        const cy = GAME_CONSTANTS.halfHeight;
        const depth = GAME_CONSTANTS.DEPTH_POPUPS + 1000;

        // Default to highest unlocked level (highest boss defeated + 1), capped by max config
        const maxLevel = Math.min((gameState.levelsDefeated || 0) + 1, getMaxConfiguredLevel());
        selectedLevel = maxLevel;

        // Black back screen — Click blocker
        levelSelectOverlay = PhaserScene.add.image(cx, cy, 'black_pixel')
            .setAlpha(0.55)
            .setDisplaySize(GAME_CONSTANTS.WIDTH, GAME_CONSTANTS.HEIGHT)
            .setScrollFactor(0)
            .setDepth(depth);

        helper.createGlobalClickBlocker(false).setDepth(depth + 0.5);

        const bg = PhaserScene.add.nineslice(cx, cy, 'ui', 'popup_nineslice.png', 550, 360, 64, 64, 64, 64);
        bg.setDepth(depth + 1).setScrollFactor(0);
        levelSelectButtons.push(bg);

        // Title
        const title = PhaserScene.add.text(cx, cy - 140, t('ui', 'choose_level'), {
            fontFamily: 'JetBrainsMono_Bold',
            fontSize: '34px',
            color: '#00f5ff',
            align: 'center',
        }).setOrigin(0.5).setShadow(2, 2, '#000000', 2, true, true).setDepth(depth + 1).setScrollFactor(0);
        levelSelectButtons.push(title);

        const levelDisplay = PhaserScene.add.text(cx, cy - 78, t('ui', 'level') + selectedLevel, {
            fontFamily: 'JetBrainsMono_Bold',
            fontSize: '34px',
            color: GAME_CONSTANTS.COLOR_NEUTRAL,
            align: 'center',
        }).setOrigin(0.5).setShadow(2, 2, '#000000', 2, true, true).setDepth(depth + 1).setScrollFactor(0);
        levelSelectButtons.push(levelDisplay);

        // DATA Bonus text
        const bonusDisplay = PhaserScene.add.text(cx, cy - 36, '', {
            fontFamily: 'JetBrainsMono_Bold',
            fontSize: '22px',
            color: '#00f5ff',
            align: 'center',
        }).setOrigin(0.5, 0.75).setShadow(1, 1, '#000000', 1, true, true).setDepth(depth + 1).setScrollFactor(0);
        levelSelectButtons.push(bonusDisplay);

        // Best score text
        const bestScoreDisplay = PhaserScene.add.text(cx, cy - 10, '', {
            fontFamily: 'JetBrainsMono_Bold',
            fontSize: '18px',
            color: '#00ff66',
            align: 'center',
        }).setOrigin(0.5).setShadow(1, 1, '#000000', 1, true, true).setDepth(depth + 1).setScrollFactor(0);
        levelSelectButtons.push(bestScoreDisplay);

        const updateLevelUI = () => {
            levelDisplay.setText(t('ui', 'level') + selectedLevel);

            // Calculate and show DATA bonus
            const isEndless = selectedLevel < maxLevel;
            const config = LEVEL_CONFIG[selectedLevel] || {};
            const mult = config.dataDropMultiplier || 1.0;

            let bonusText = "";
            if (isEndless) bonusText += "(ENDLESS)";
            if (mult > 1.0) {
                const pct = Math.round((mult - 1) * 100);
                if (bonusText !== "") bonusText += " ";
                bonusText += `+${pct}% DATA`;
            }

            if (bonusText !== "") {
                bonusDisplay.setText(bonusText);
                bonusDisplay.setVisible(true);

                // Quick bounce animation for feedback
                PhaserScene.tweens.add({
                    targets: bonusDisplay,
                    scale: { from: 1, to: 1.07 },
                    duration: 100,
                    yoyo: true,
                    ease: 'Cubic.easeOut'
                });
            } else {
                bonusDisplay.setVisible(false);
            }

            // High score display
            const best = scoreManager.getBestScore(selectedLevel);
            if (best) {
                bestScoreDisplay.setText(`${t('ui', 'best_time')}: ${scoreManager.formatTime(best.bestTime)}  [${best.kills} KILLS]`);
                bestScoreDisplay.setVisible(true);
            } else {
                bestScoreDisplay.setVisible(false);
            }

            // Update button states
            minusBtn.setState(selectedLevel > 1 ? NORMAL : DISABLE);
            plusBtn.setState(selectedLevel < maxLevel ? NORMAL : DISABLE);
        };

        // Minus button
        const minusBtn = new Button({
            normal: { ref: 'increment_normal.png', atlas: 'buttons', x: cx - 35, y: cy + 15 },
            hover: { ref: 'increment_hover.png', atlas: 'buttons', x: cx - 35, y: cy + 15 },
            press: { ref: 'increment_press.png', atlas: 'buttons', x: cx - 35, y: cy + 15 },
            disable: { ref: 'increment_disable.png', atlas: 'buttons', x: cx - 35, y: cy + 15 },
            onMouseUp: () => {
                if (selectedLevel > 1) {
                    selectedLevel--;
                    updateLevelUI();
                }
            }
        });
        minusBtn.addText("-", { fontFamily: 'JetBrainsMono_Bold', fontSize: '48px', color: GAME_CONSTANTS.COLOR_NEUTRAL });
        minusBtn.setDepth(depth + 2);
        minusBtn.setScrollFactor(0);
        levelSelectButtons.push(minusBtn);

        // Plus button
        const plusBtn = new Button({
            normal: { ref: 'increment_normal.png', atlas: 'buttons', x: cx + 35, y: cy + 15 },
            hover: { ref: 'increment_hover.png', atlas: 'buttons', x: cx + 35, y: cy + 15 },
            press: { ref: 'increment_press.png', atlas: 'buttons', x: cx + 35, y: cy + 15 },
            disable: { ref: 'increment_disable.png', atlas: 'buttons', x: cx + 35, y: cy + 15 },
            onMouseUp: () => {
                if (selectedLevel < maxLevel) {
                    selectedLevel++;
                    updateLevelUI();
                }
            }
        });
        plusBtn.addText("+", { fontFamily: 'JetBrainsMono_Bold', fontSize: '48px', color: GAME_CONSTANTS.COLOR_NEUTRAL });
        plusBtn.setDepth(depth + 2);
        plusBtn.setScrollFactor(0);
        levelSelectButtons.push(plusBtn);

        // START Button
        const startBtn = new Button({
            normal: { ref: helper.isMobileDevice() ? 'button_normal_mobile.png' : 'button_normal.png', atlas: 'buttons', x: cx, y: cy + 80 },
            hover: { ref: 'button_hover.png', atlas: 'buttons', x: cx, y: cy + 80 },
            press: { ref: 'button_press.png', atlas: 'buttons', x: cx, y: cy + 80 },
            onMouseUp: () => {
                gameState.currentLevel = selectedLevel;
                closeLevelSelect();
                transitionManager.transitionTo(GAME_CONSTANTS.PHASE_COMBAT);
            }
        });
        startBtn.setScale(0.675).addText(t('ui', 'start'), { fontFamily: 'JetBrainsMono_Bold', fontSize: '28px', color: GAME_CONSTANTS.COLOR_NEUTRAL });
        startBtn.setDepth(depth + 2);
        startBtn.setScrollFactor(0);
        levelSelectButtons.push(startBtn);

        // BACK Button
        const backBtn = new Button({
            normal: { ref: helper.isMobileDevice() ? 'button_normal_mobile.png' : 'button_normal.png', atlas: 'buttons', x: cx, y: cy + 140 },
            hover: { ref: 'button_hover.png', atlas: 'buttons', x: cx, y: cy + 140 },
            press: { ref: 'button_press.png', atlas: 'buttons', x: cx, y: cy + 140 },
            onMouseUp: closeLevelSelect
        });
        backBtn.setScale(0.675).addText(t('ui', 'back'), { fontFamily: 'JetBrainsMono_Bold', fontSize: '25px', color: '#aaaaaa' });
        backBtn.setDepth(depth + 2);
        backBtn.setScrollFactor(0);
        levelSelectButtons.push(backBtn);

        updateLevelUI();

        if (upgradeTree && upgradeTree.getUICamera()) {
            upgradeTree.assignToUICamera(levelSelectOverlay);
            levelSelectButtons.forEach(el => upgradeTree.assignToUICamera(el));
        }
    }

    function closeLevelSelect() {
        if (levelSelectOverlay) {
            levelSelectOverlay.destroy();
            levelSelectOverlay = null;
            helper.hideGlobalClickBlocker();
        }
        levelSelectButtons.forEach(b => {
            if (b && b.destroy) b.destroy();
        });
        levelSelectButtons = [];
    }

    function isAnyPopupVisible() {
        return !!levelSelectOverlay;
    }

    return {
        showLevelSelectPopup,
        closeLevelSelect,
        isAnyPopupVisible
    };
})();
