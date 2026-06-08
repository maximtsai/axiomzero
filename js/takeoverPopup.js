/**
 * @fileoverview Refactored Infiltration Terminal Popup Manager.
 * Orchestrates:
 *   - Sleek header titles, subtitles, and native close button configurations.
 *   - Grid card generation utilizing modular Infiltration Target Cards.
 *   - Launch of modal dialogue confirmation popup upon selection.
 *   - Cinematic slide tween transition: fades others and slides selected card to center (cy).
 *   - Displays large status header ("HACKING IN PROGRESS") and a 700px panel-spanning progress bar.
 *   - Rebuilds dynamically on breach success with pulsing text and panel-spanning "EXTRACT REWARD".
 */
const takeoverPopup = (() => {
    let overlay = null;
    let elements = [];
    let isVisible = false;
    let updateFn = null;

    // References to cards during selection
    let cardContainers = [null, null, null];
    let isTransitioning = false;
    let shouldAnimateCardsIn = false;

    // References for update loop (progress bar fill & timer text)
    let progressBarFill = null;
    let timerText = null;

    // Dimensions & Depths
    const POPUP_W = 860;
    const POPUP_H = 680;
    const DEPTH_BASE = GAME_CONSTANTS.DEPTH_POPUPS + 2000;

    function addEl(el) {
        if (!el) return;
        elements.push(el);
        if (typeof upgradeTree !== 'undefined' && upgradeTree.assignToUICamera) {
            upgradeTree.assignToUICamera(el);
        }
        return el;
    }

    // ── Custom Button Factory (Using Project's Button Class) ─────────────────
 
    function createVectorButton(x, y, w, h, label, strokeColorHex, callback) {
        const btn = new Button({
            normal: {
                atlas: 'buttons',
                ref: 'black_pixel.png',
                x: x,
                y: y,
                alpha: 0.5,
                scaleX: w / 2,
                scaleY: h / 2
            },
            hover: {
                atlas: 'buttons',
                ref: 'black_pixel.png',
                alpha: 0.75
            },
            press: {
                atlas: 'buttons',
                ref: 'black_pixel.png',
                alpha: 0.9
            },
            onMouseUp: () => {
                audio.play('click', 0.8);
                callback();
            }
        });
        btn.setDepth(DEPTH_BASE + 20);
        btn.setScrollFactor(0);
        addEl(btn);
 
        // Sync hover and out triggers
        btn.setOnHoverFunc(() => {
            audio.play('click', 0.35);
            text.setStyle({ color: '#ffffff' });
        });
        btn.setOnHoverOutFunc(() => {
            text.setStyle({ color: '#' + strokeColorHex.toString(16).padStart(6, '0') });
        });
 
        const text = PhaserScene.add.text(x, y, label, {
            fontFamily: 'Quantico-Bold',
            fontSize: '16px',
            color: '#' + strokeColorHex.toString(16).padStart(6, '0'),
            align: 'center'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH_BASE + 21);
        addEl(text);
 
        return btn;
    }

    // ── Show ──────────────────────────────────────────────────────────────────

    function show() {
        if (isVisible) return;
        isVisible = true;

        audio.play('retro1', 1.0);

        const cx = GAME_CONSTANTS.halfWidth;
        const cy = GAME_CONSTANTS.halfHeight;

        // Dark dimming overlay
        overlay = PhaserScene.add.image(cx, cy, 'buttons', 'black_pixel.png')
            .setAlpha(0.7)
            .setDisplaySize(GAME_CONSTANTS.WIDTH, GAME_CONSTANTS.HEIGHT)
            .setScrollFactor(0)
            .setDepth(DEPTH_BASE);
        if (typeof upgradeTree !== 'undefined' && upgradeTree.assignToUICamera) {
            upgradeTree.assignToUICamera(overlay);
        }

        // Global click blocker
        const blocker = helper.createGlobalClickBlocker(false).setDepth(DEPTH_BASE + 0.5);
        if (typeof upgradeTree !== 'undefined' && upgradeTree.assignToUICamera) {
            upgradeTree.assignToUICamera(blocker);
        }

        _rebuild();

        // Register update loop
        if (!updateFn) {
            updateFn = _update;
            updateManager.addFunction(updateFn);
        }
    }

    // ── Rebuild ───────────────────────────────────────────────────────────────

    function _rebuild() {
        _clearContent();

        const cx = GAME_CONSTANTS.halfWidth;
        const cy = GAME_CONSTANTS.halfHeight;
        const d = DEPTH_BASE + 1.5;

        // popup background box nineslice
        const popupBG = helper.createNineSlice(cx, cy, 'buttons', 'popup_nineslice.png', POPUP_W, POPUP_H, 64, 64, 64, 64);
        popupBG.setDepth(d).setScrollFactor(0);
        addEl(popupBG);

        // Header Title
        const titleText = PhaserScene.add.text(cx - 380, cy - 280, 'SYSTEM INFILTRATION TERMINAL', {
            fontFamily: 'Quantico-Bold', fontSize: '28px', color: '#ffffff'
        }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(d + 1);
        addEl(titleText);

        // Subtitle
        const subtitleText = PhaserScene.add.text(cx - 380, cy - 252, 'INFILTRATE SECURE CORPORATE NETWORKS TO EXFILTRATE FUNDS, DATA AND INTEL.', {
            fontFamily: 'Quantico-Italic', fontSize: '11px', color: '#8899aa'
        }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(d + 1);
        addEl(subtitleText);

        // Close Button (native assets)
        const closeBtn = new Button({
            normal: { ref: 'close_button_normal.png', atlas: 'buttons', x: cx + 380, y: cy - 280 },
            hover: { ref: 'close_button_hover.png', atlas: 'buttons' },
            press: { ref: 'close_button_press.png', atlas: 'buttons' },
            onMouseUp: () => {
                audio.play('click', 1.0);
                hide();
            }
        });
        closeBtn.setDepth(d + 2);
        closeBtn.setScrollFactor(0);
        addEl(closeBtn);

        // ── Render States ─────────────────────────────────────────────────────
        const targets = takeoverTargets.getTargets();
        const activeAttack = takeoverTargets.getActiveAttack();
        const pendingReward = takeoverTargets.getPendingReward();

        let activeIndex = -1;
        if (activeAttack) {
            activeIndex = targets.findIndex(t => t && t.name === activeAttack.target.name);
        } else if (pendingReward) {
            activeIndex = targets.findIndex(t => t && t.name === pendingReward.targetName);
        }

        if (activeIndex !== -1) {
            // STATE A: AN ACTIVE BREACH IS RUNNING OR PENDING
            const target = targets[activeIndex];

            // Render active card locked in the center Y coordinate (cy)
            const activeCard = infiltrationOptions.createTargetCard(PhaserScene, cx, cy, target, activeIndex, d + 2, 1.0, () => { });
            // Disable interaction zone since a breach is already ongoing
            activeCard.list.forEach(child => {
                if (child instanceof Phaser.GameObjects.Zone) child.disableInteractive();
            });
            addEl(activeCard);

            if (pendingReward) {
                // BREACH SUCCESSFUL & READY FOR EXTRACTION
                const statusHeader = PhaserScene.add.text(cx, cy - 130, 'BREACH SUCCESSFUL', {
                    fontFamily: 'Quantico-Bold', fontSize: '26px', color: '#44ff44'
                }).setOrigin(0.5).setScrollFactor(0).setDepth(d + 2);
                addEl(statusHeader);

                PhaserScene.tweens.add({
                    targets: statusHeader,
                    alpha: 0.45,
                    duration: 800,
                    yoyo: true,
                    repeat: -1,
                    ease: 'Sine.easeInOut'
                });

                // Spanning green extraction button featuring dynamic exact rewards
                const rewardStr = takeoverTargets.formatReward(pendingReward.rewardType, pendingReward.rewardAmount);
                const buttonLabel = `CLAIM ${rewardStr}    ▶`;
                let rewardBtn = null;
                rewardBtn = createVectorButton(cx, cy + 120, 320, 48, buttonLabel, 0x44ff44, () => {
                    if (isTransitioning) return;
                    isTransitioning = true;

                    // Cinematic Fade-Out of Success Layout
                    PhaserScene.tweens.add({
                        targets: [statusHeader, activeCard, rewardBtn],
                        alpha: 0,
                        duration: 350,
                        ease: 'Power1',
                        onComplete: () => {
                            const reward = takeoverTargets.collectReward();
                            if (reward) {
                                audio.play('upgrade_max', 0.6);
                                if (typeof messageBus !== 'undefined') {
                                    const pos = typeof tower !== 'undefined' ? tower.getPosition() : { x: GAME_CONSTANTS.halfWidth, y: GAME_CONSTANTS.halfHeight };
                                    messageBus.publish('showFloatingText',
                                        pos.x + (Math.random() - 0.5) * 80,
                                        pos.y + (Math.random() - 0.5) * 60,
                                        takeoverTargets.formatReward(reward.rewardType, reward.rewardAmount),
                                        { fontFamily: 'Quantico-Bold', color: takeoverTargets.getRewardColor(reward.rewardType), fontSize: 28, travel: 60, noScale: true }
                                    );
                                }
                            }
                            shouldAnimateCardsIn = true;
                            isTransitioning = false;
                            _rebuild();
                        }
                    });
                });

            } else if (activeAttack) {
                // BREACHING IN PROGRESS
                const statusHeader = PhaserScene.add.text(cx, cy - 130, 'HACKING IN PROGRESS', {
                    fontFamily: 'Quantico-Bold', fontSize: '26px', color: '#00f5ff'
                }).setOrigin(0.5).setScrollFactor(0).setDepth(d + 2);
                addEl(statusHeader);

                PhaserScene.tweens.add({
                    targets: statusHeader,
                    alpha: 0.5,
                    duration: 800,
                    yoyo: true,
                    repeat: -1,
                    ease: 'Sine.easeInOut'
                });

                // Panel-spanning progress track background (700px wide)
                const barTrack = PhaserScene.add.image(cx, cy + 120, 'buttons', 'white_pixel.png');
                barTrack.setDisplaySize(700, 14);
                barTrack.setDepth(d + 2).setScrollFactor(0).setTint(0x131722).setAlpha(0.95);
                addEl(barTrack);

                // Spanning loading bar fill
                progressBarFill = PhaserScene.add.image(cx - 350, cy + 120, 'buttons', 'white_pixel.png');
                progressBarFill.setOrigin(0, 0.5);
                progressBarFill.setDisplaySize(1, 14);
                progressBarFill.setDepth(d + 3).setScrollFactor(0).setTint(0x00f5ff);
                progressBarFill._barMaxW = 700;
                addEl(progressBarFill);

                // Small subtext remaining timer
                timerText = PhaserScene.add.text(cx, cy + 92, '', {
                    fontFamily: 'Quantico-Bold', fontSize: '15px', color: '#00f5ff'
                }).setOrigin(0.5).setScrollFactor(0).setDepth(d + 3);
                addEl(timerText);

                // Large abort button underneath progress bar
                createVectorButton(cx, cy + 190, 220, 48, 'ABORT BREACH', 0xff5555, () => {
                    if (takeoverTargets.cancelAttack()) {
                        audio.play('click', 1.0);
                        _rebuild();
                    }
                });
            }

        } else {
            // STATE B: NO BREACH ACTIVE. DRAW THREE STACKED OPTIONS
            const rowYs = [cy - 90, cy + 35, cy + 160];
            cardContainers = [null, null, null];

            for (let i = 0; i < 3; i++) {
                const target = targets[i];
                const rowY = rowYs[i];

                if (!target) {
                    // Empty target slot scanner card
                    const offlineGraphics = PhaserScene.add.graphics().setDepth(d + 1).setScrollFactor(0);
                    addEl(offlineGraphics);
                    infiltrationOptions.drawNotchedCard(offlineGraphics, cx, rowY, 780, 110, false, false, 0x445566);

                    const placeholder = PhaserScene.add.text(cx, rowY, '[ SIGNAL OFFLINE // SCANNING FOR SECURE GRIDS ]', {
                        fontFamily: 'Quantico-Bold', fontSize: '13px', color: '#445566', align: 'center'
                    }).setOrigin(0.5).setScrollFactor(0).setDepth(d + 2);
                    addEl(placeholder);

                    PhaserScene.tweens.add({
                        targets: placeholder,
                        alpha: 0.35,
                        duration: 1000,
                        yoyo: true,
                        repeat: -1,
                        ease: 'Sine.easeInOut'
                    });
                    continue;
                }

                // Render standard card component
                const card = infiltrationOptions.createTargetCard(PhaserScene, cx, rowY, target, i, d + 2, 1.0, (selectedIndex, selTarget) => {
                    if (isTransitioning) return;
                    _triggerInfiltrationConfirm(selectedIndex, selTarget);
                });
                addEl(card);
                cardContainers[i] = card;
            }

            // Apply cinematic staggered slide-in/fade-in animation for fresh cards
            if (shouldAnimateCardsIn) {
                isTransitioning = true;
                let activeCount = 0;
                let animatedCount = 0;
                
                cardContainers.forEach(c => { if (c) activeCount++; });
                
                for (let i = 0; i < 3; i++) {
                    const card = cardContainers[i];
                    if (card) {
                        card.setAlpha(0);
                        card.y = rowYs[i] + 20; // slide up from slightly below
                        PhaserScene.tweens.add({
                            targets: card,
                            alpha: 1,
                            y: rowYs[i],
                            duration: 450,
                            ease: 'Cubic.easeOut',
                            delay: i * 90,
                            onComplete: () => {
                                animatedCount++;
                                if (animatedCount === activeCount) {
                                    isTransitioning = false;
                                    shouldAnimateCardsIn = false;
                                }
                            }
                        });
                    }
                }
            }
        }
    }

    // ── Confirmation Modal popup logic ───────────────────────────────────────

    function _triggerInfiltrationConfirm(selectedIndex, target) {
        const cx = GAME_CONSTANTS.halfWidth;
        const cy = GAME_CONSTANTS.halfHeight;

        // Temporarily disable options hit zones while modal popup is active
        cardContainers.forEach(c => {
            if (c) {
                c.list.forEach(child => {
                    if (child instanceof Phaser.GameObjects.Zone) child.disableInteractive();
                });
            }
        });

        const confirmPopup = infiltrationOptions.createConfirmPopup(PhaserScene, cx, cy, DEPTH_BASE + 20, target, () => {
            // YES: Trigger the cinematic hacking sequence!
            _triggerHackingSequence(selectedIndex);
        }, () => {
            // NO/CANCEL: Re-enable options click interactions
            cardContainers.forEach(c => {
                if (c) {
                    c.list.forEach(child => {
                        if (child instanceof Phaser.GameObjects.Zone) child.setInteractive();
                    });
                }
            });
        });
        addEl(confirmPopup);
    }

    // ── Cinematic Slide/Fade Tween Transition ──────────────────────────────────

    function _triggerHackingSequence(selectedIndex) {
        if (isTransitioning) return;
        isTransitioning = true;

        const cy = GAME_CONSTANTS.halfHeight;

        // 1. Fade out the two non-selected option cards
        for (let i = 0; i < 3; i++) {
            if (i !== selectedIndex && cardContainers[i]) {
                PhaserScene.tweens.add({
                    targets: cardContainers[i],
                    alpha: 0,
                    duration: 300,
                    ease: 'Power1'
                });
            }
        }

        // 2. Glide the selected option card smoothly to the exact Y center (cy)
        const selectedCard = cardContainers[selectedIndex];
        if (selectedCard) {
            PhaserScene.tweens.add({
                targets: selectedCard,
                y: cy,
                duration: 380,
                ease: 'Cubic.easeOut',
                onComplete: () => {
                    // Trigger actual breach attack logic
                    if (takeoverTargets.startAttack(selectedIndex)) {
                        audio.play('upgrade', 1.0);
                    }
                    isTransitioning = false;
                    _rebuild(); // Rebuild into state-2 (Active hacking)
                }
            });
        } else {
            isTransitioning = false;
            _rebuild();
        }
    }

    let lastRemainingSeconds = -1;
    let updateFrameCount = 0;

    function _update() {
        if (!isVisible || isTransitioning) return;

        const justCompleted = takeoverTargets.checkCompletion();
        const needsRewardState = takeoverTargets.hasRewardPending() && progressBarFill !== null;
        if (justCompleted || needsRewardState) {
            _rebuild();
            return;
        }

        // Update progress bar fill & remaining timer text
        if (takeoverTargets.isAttacking() && progressBarFill && timerText) {
            if (updateFrameCount % 10 === 0 || lastRemainingSeconds === -1) {
                const progress = takeoverTargets.getProgress();
                const remaining = takeoverTargets.getRemainingSeconds();

                const fillW = Math.max(1, progress * progressBarFill._barMaxW);
                progressBarFill.setDisplaySize(fillW, progressBarFill.displayHeight);

                if (remaining !== lastRemainingSeconds) {
                    lastRemainingSeconds = remaining;
                    const mins = Math.floor(remaining / 60);
                    const secs = remaining % 60;
                    const timeStr = mins > 0
                        ? `${mins}:${secs.toString().padStart(2, '0')}`
                        : `${secs}s`;
                    timerText.setText(`${t('popup', 'breaching')} ${timeStr}`);
                }
            }
            updateFrameCount++;
        }
    }

    function _clearContent() {
        progressBarFill = null;
        timerText = null;
        lastRemainingSeconds = -1;
        updateFrameCount = 0;
        cardContainers = [null, null, null];

        elements.forEach(el => {
            if (el && el.destroy) el.destroy();
            else if (el && el.remove) el.remove();
        });
        elements = [];
    }

    // ── Hide ──────────────────────────────────────────────────────────────────

    function hide() {
        if (!isVisible) return;
        isVisible = false;

        if (updateFn) {
            updateManager.removeFunction(updateFn);
            updateFn = null;
        }

        _clearContent();

        if (overlay) {
            overlay.destroy();
            overlay = null;
            helper.hideGlobalClickBlocker();
        }
    }

    function isOpen() {
        return isVisible;
    }

    return {
        show,
        hide,
        isOpen
    };
})();
