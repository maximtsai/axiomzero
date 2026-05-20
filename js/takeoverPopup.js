/**
 * @fileoverview Manages the Financial Breach / Takeover popup interface.
 * Three visual states:
 *   1. Target Selection — 3 horizontal cards with ATTACK buttons
 *   2. Attack In Progress — chosen card centered, progress bar, CANCEL button
 *   3. Reward Collection — BREACH SUCCESSFUL, COLLECT button
 */
const takeoverPopup = (() => {
    let overlay = null;
    let elements = [];
    let isVisible = false;
    let updateFn = null;

    // Layout constants
    const POPUP_W = 1000;
    const POPUP_H = 600;
    const CARD_W = 270;
    const CARD_H = 390;
    const CARD_GAP = 30;
    const CARD_CORNER = 20;
    const DEPTH_BASE = GAME_CONSTANTS.DEPTH_POPUPS + 2000;

    // ── Show ──────────────────────────────────────────────────────────────────

    function show() {
        if (isVisible) return;
        isVisible = true;

        audio.play('retro1', 1.0);

        const cx = GAME_CONSTANTS.halfWidth;
        const cy = GAME_CONSTANTS.halfHeight;

        // Dark overlay
        overlay = PhaserScene.add.image(cx, cy, 'buttons', 'black_pixel.png')
            .setAlpha(0.65)
            .setDisplaySize(GAME_CONSTANTS.WIDTH, GAME_CONSTANTS.HEIGHT)
            .setScrollFactor(0)
            .setDepth(DEPTH_BASE);

        // Click blocker
        const blocker = helper.createGlobalClickBlocker(false).setDepth(DEPTH_BASE + 0.5);
        if (typeof upgradeTree !== 'undefined' && upgradeTree.assignToUICamera) {
            upgradeTree.assignToUICamera(blocker);
        }

        // Popup background
        const bg = helper.createNineSlice(cx, cy, 'buttons', 'popup_nineslice.png', POPUP_W, POPUP_H, 64, 64, 64, 64);
        bg.setDepth(DEPTH_BASE + 1).setScrollFactor(0);
        elements.push(bg);

        // Title
        const title = PhaserScene.add.text(cx, cy - POPUP_H / 2 + 45, t('popup', 'takeover_title'), {
            fontFamily: 'Quantico-Bold',
            fontSize: '42px',
            color: '#FFD700',
            align: 'center',
        }).setOrigin(0.5).setShadow(2, 2, '#000000', 2, true, true).setDepth(DEPTH_BASE + 2).setScrollFactor(0);
        elements.push(title);

        // Close button (top-right)
        const closeBtn = new Button({
            normal: { ref: 'close_button_normal.png', atlas: 'buttons', x: cx + POPUP_W / 2 - 35, y: cy - POPUP_H / 2 + 36 },
            hover: { ref: 'close_button_hover.png', atlas: 'buttons' },
            press: { ref: 'close_button_press.png', atlas: 'buttons' },
            onMouseUp: hide
        });
        closeBtn.setDepth(DEPTH_BASE + 5);
        closeBtn.setScrollFactor(0);
        elements.push(closeBtn);

        // Determine which state to show
        if (takeoverTargets.hasRewardPending()) {
            _buildRewardState(cx, cy);
        } else if (takeoverTargets.isAttacking()) {
            _buildAttackState(cx, cy);
        } else {
            _buildSelectionState(cx, cy);
        }

        // Register per-frame update
        if (!updateFn) {
            updateFn = _update;
            updateManager.addFunction(updateFn);
        }

        // Camera assignment
        if (typeof upgradeTree !== 'undefined' && upgradeTree.getUICamera()) {
            upgradeTree.assignToUICamera(overlay);
            elements.forEach(el => upgradeTree.assignToUICamera(el));
        }
    }

    // ── State 1: Target Selection ─────────────────────────────────────────────

    function _buildSelectionState(cx, cy) {
        const targets = takeoverTargets.getTargets();
        const activeTargets = targets.filter(t => t !== null);
        const count = activeTargets.length;

        if (count === 2) {
            // Center two cards horizontally
            const offset = (CARD_W + CARD_GAP) / 2;
            const startX = cx - offset;
            for (let i = 0; i < count; i++) {
                const target = activeTargets[i];
                const origIndex = targets.indexOf(target);
                const cardX = startX + i * (CARD_W + CARD_GAP);
                const cardY = cy + 20;
                _createTargetCard(cardX, cardY, target, origIndex);
            }
        } else {
            // Center three cards horizontally (standard)
            const startX = cx - (CARD_W + CARD_GAP);
            for (let i = 0; i < 3; i++) {
                const target = targets[i];
                if (!target) continue;
                const cardX = startX + i * (CARD_W + CARD_GAP);
                const cardY = cy + 20;
                _createTargetCard(cardX, cardY, target, i);
            }
        }
    }

    function _createTargetCard(x, y, target, index) {
        const d = DEPTH_BASE + 3;
        const canAfford = resourceManager.canAfford('data', target.cost);

        // Card background
        const cardBg = helper.createNineSlice(x, y, 'buttons', 'popup_nineslice.png', CARD_W, CARD_H, 32, 32, 32, 32);
        cardBg.setDepth(d).setScrollFactor(0).setAlpha(canAfford ? 0.9 : 0.5);
        elements.push(cardBg);

        // Reward accent bar (left edge)
        const accentColor = takeoverTargets.getRewardColor(target.rewardType);
        const accent = PhaserScene.add.image(x - CARD_W / 2 + 6, y, 'buttons', 'white_pixel.png');
        accent.setDisplaySize(4, CARD_H - 40);
        accent.setDepth(d + 1).setScrollFactor(0).setTint(Phaser.Display.Color.HexStringToColor(accentColor).color);
        accent.setAlpha(canAfford ? 0.8 : 0.3);
        elements.push(accent);

        let yOff = y - CARD_H / 2 + 35;

        // Corp name
        const nameText = PhaserScene.add.text(x, yOff, target.name, {
            fontFamily: 'Quantico-Bold',
            fontSize: '17px',
            color: '#ffffff',
            align: 'center',
            wordWrap: { width: CARD_W - 40 },
        }).setOrigin(0.5, 0).setDepth(d + 2).setScrollFactor(0);
        nameText.setAlpha(canAfford ? 1 : 0.5);
        elements.push(nameText);
        yOff += nameText.height + 12;

        // Security badge
        const secColor = takeoverTargets.getSecurityColor(target.security);
        const badge = PhaserScene.add.text(x, yOff, target.security, {
            fontFamily: 'Quantico-Bold',
            fontSize: '14px',
            color: secColor,
            align: 'center',
            padding: { x: 8, y: 3 },
        }).setOrigin(0.5, 0).setDepth(d + 2).setScrollFactor(0);
        badge.setAlpha(canAfford ? 1 : 0.5);
        elements.push(badge);
        yOff += badge.height + 10;

        // Flavor text
        const flavor = PhaserScene.add.text(x, yOff, target.flavor, {
            fontFamily: 'Quantico-Italic',
            fontSize: '13px',
            color: '#999999',
            align: 'center',
            fontStyle: 'italic',
            wordWrap: { width: CARD_W - 50 },
        }).setOrigin(0.5, 0).setDepth(d + 2).setScrollFactor(0);
        flavor.setAlpha(canAfford ? 1 : 0.5);
        elements.push(flavor);
        yOff += flavor.height + 18;

        // Divider line
        const divider = PhaserScene.add.image(x, yOff, 'buttons', 'white_pixel.png');
        divider.setDisplaySize(CARD_W - 60, 1);
        divider.setDepth(d + 1).setScrollFactor(0).setAlpha(0.15);
        elements.push(divider);
        yOff += 14;

        // Cost
        const costText = PhaserScene.add.text(x, yOff, `COST: ${target.cost} ◈`, {
            fontFamily: 'Quantico-Bold',
            fontSize: '16px',
            color: canAfford ? '#00f5ff' : '#ff5555',
            align: 'center',
        }).setOrigin(0.5, 0).setDepth(d + 2).setScrollFactor(0);
        elements.push(costText);
        yOff += 24;

        // Duration
        const durText = PhaserScene.add.text(x, yOff, `TIME: ${helper.formatTime(target.duration)}`, {
            fontFamily: 'Quantico-Regular',
            fontSize: '14px',
            color: '#aaaaaa',
            align: 'center',
        }).setOrigin(0.5, 0).setDepth(d + 2).setScrollFactor(0);
        elements.push(durText);
        yOff += 24;

        // Reward
        const rewardStr = takeoverTargets.formatReward(target.rewardType, target.rewardAmount);
        const rewardText = PhaserScene.add.text(x, yOff, rewardStr, {
            fontFamily: 'Quantico-Bold',
            fontSize: '18px',
            color: accentColor,
            align: 'center',
        }).setOrigin(0.5, 0).setDepth(d + 2).setScrollFactor(0);
        elements.push(rewardText);

        // ATTACK button
        const btnY = y + CARD_H / 2 - 38;
        const isMobile = helper.isMobileDevice();
        const atkBtn = new Button({
            normal: { ref: isMobile ? 'button_normal_mobile.png' : 'button_normal.png', atlas: 'buttons', x: x, y: btnY },
            hover: { ref: 'button_hover.png', atlas: 'buttons', x: x, y: btnY },
            press: { ref: 'button_press.png', atlas: 'buttons', x: x, y: btnY },
            onMouseUp: () => {
                if (!canAfford) return;
                if (takeoverTargets.startAttack(index)) {
                    audio.play('upgrade', 1.0);
                    _rebuild();
                }
            }
        });
        atkBtn.setScale(0.7);
        atkBtn.addText(t('popup', 'attack'), { fontFamily: 'Quantico-Bold', fontSize: '22px', color: canAfford ? '#ffffff' : '#666666' });
        atkBtn.setDepth(d + 3);
        atkBtn.setScrollFactor(0);
        if (!canAfford) atkBtn.setState(DISABLE);
        elements.push(atkBtn);
    }

    // ── State 2: Attack In Progress ───────────────────────────────────────────

    // References to live-updated UI elements
    let progressBarFill = null;
    let timerText = null;

    function _buildAttackState(cx, cy) {
        const attack = takeoverTargets.getActiveAttack();
        if (!attack) return;
        const target = attack.target;
        const d = DEPTH_BASE + 3;

        const cardY = cy - 10;
        const largeCardW = CARD_W + 40;
        const largeCardH = CARD_H - 30;

        // Card background (centered, slightly larger)
        const cardBg = helper.createNineSlice(cx, cardY, 'buttons', 'popup_nineslice.png', largeCardW, largeCardH, 32, 32, 32, 32);
        cardBg.setDepth(d).setScrollFactor(0).setAlpha(0.95);
        elements.push(cardBg);

        // Pulsing glow around card
        const glow = helper.createNineSlice(cx, cardY, 'buttons', 'popup_nineslice.png', largeCardW + 10, largeCardH + 10, 32, 32, 32, 32);
        glow.setDepth(d - 0.5).setScrollFactor(0).setAlpha(0.15);
        helper.setTint(glow, 0x00f5ff);
        elements.push(glow);
        PhaserScene.tweens.add({
            targets: glow,
            alpha: 0.35,
            duration: 1200,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
        });

        let yOff = cardY - largeCardH / 2 + 35;

        // Corp name
        const nameText = PhaserScene.add.text(cx, yOff, target.name, {
            fontFamily: 'Quantico-Bold', fontSize: '20px', color: '#ffffff', align: 'center',
            wordWrap: { width: largeCardW - 40 },
        }).setOrigin(0.5, 0).setDepth(d + 2).setScrollFactor(0);
        elements.push(nameText);
        yOff += nameText.height + 10;

        // Security badge
        const secColor = takeoverTargets.getSecurityColor(target.security);
        const badge = PhaserScene.add.text(cx, yOff, target.security, {
            fontFamily: 'Quantico-Bold', fontSize: '14px', color: secColor, align: 'center',
        }).setOrigin(0.5, 0).setDepth(d + 2).setScrollFactor(0);
        elements.push(badge);
        yOff += badge.height + 8;

        // Flavor text
        const flavor = PhaserScene.add.text(cx, yOff, target.flavor, {
            fontFamily: 'Quantico-Italic', fontSize: '13px', color: '#999999', align: 'center',
            fontStyle: 'italic', wordWrap: { width: largeCardW - 40 },
        }).setOrigin(0.5, 0).setDepth(d + 2).setScrollFactor(0);
        elements.push(flavor);
        yOff += flavor.height + 20;

        // ── Progress bar ──
        const barW = largeCardW - 60;
        const barH = 16;
        const barX = cx;
        const barY = yOff + barH / 2;

        // Bar track (dark gray)
        const barTrack = PhaserScene.add.image(barX, barY, 'buttons', 'white_pixel.png');
        barTrack.setDisplaySize(barW, barH);
        barTrack.setDepth(d + 1).setScrollFactor(0).setTint(0x1a1e2e).setAlpha(0.9);
        elements.push(barTrack);

        // Bar fill (cyan)
        progressBarFill = PhaserScene.add.image(barX - barW / 2, barY, 'buttons', 'white_pixel.png');
        progressBarFill.setOrigin(0, 0.5);
        progressBarFill.setDisplaySize(1, barH - 2);
        progressBarFill.setDepth(d + 2).setScrollFactor(0).setTint(0x00f5ff);
        progressBarFill._barMaxW = barW;
        elements.push(progressBarFill);

        yOff += barH + 14;

        // Timer text
        timerText = PhaserScene.add.text(cx, yOff, t('popup', 'breaching'), {
            fontFamily: 'Quantico-Bold', fontSize: '20px', color: '#00f5ff', align: 'center',
        }).setOrigin(0.5, 0).setDepth(d + 2).setScrollFactor(0);
        elements.push(timerText);
        yOff += 30;

        // Reward preview
        const rewardStr = takeoverTargets.formatReward(target.rewardType, target.rewardAmount);
        const rewardColor = takeoverTargets.getRewardColor(target.rewardType);
        const rewardText = PhaserScene.add.text(cx, yOff, rewardStr, {
            fontFamily: 'Quantico-Bold', fontSize: '22px', color: rewardColor, align: 'center',
        }).setOrigin(0.5, 0).setDepth(d + 2).setScrollFactor(0);
        elements.push(rewardText);
        yOff += 36;

        // CANCEL button
        const isMobile = helper.isMobileDevice();
        const cancelBtn = new Button({
            normal: { ref: isMobile ? 'button_normal_mobile.png' : 'button_normal.png', atlas: 'buttons', x: cx, y: yOff + 12 },
            hover: { ref: 'button_hover.png', atlas: 'buttons', x: cx, y: yOff + 12 },
            press: { ref: 'button_press.png', atlas: 'buttons', x: cx, y: yOff + 12 },
            onMouseUp: () => {
                if (takeoverTargets.cancelAttack()) {
                    audio.play('click', 1.0);
                    _rebuild();
                }
            }
        });
        cancelBtn.setScale(0.7);
        cancelBtn.addText(t('popup', 'cancel'), { fontFamily: 'Quantico-Bold', fontSize: '22px', color: '#ff5555' });
        cancelBtn.setDepth(d + 3);
        cancelBtn.setScrollFactor(0);
        elements.push(cancelBtn);

        // Refund hint
        const refundHint = PhaserScene.add.text(cx, yOff + 40, t('popup', 'cancel_refund'), {
            fontFamily: 'Quantico-Regular', fontSize: '12px', color: '#666666', align: 'center',
        }).setOrigin(0.5, 0).setDepth(d + 2).setScrollFactor(0);
        elements.push(refundHint);
    }

    // ── State 3: Reward Collection ────────────────────────────────────────────

    function _buildRewardState(cx, cy) {
        const pending = takeoverTargets.getPendingReward();
        const attack = takeoverTargets.getActiveAttack();
        if (!pending) return;
        const target = attack ? attack.target : {};
        const d = DEPTH_BASE + 3;

        const cardY = cy - 10;
        const largeCardW = CARD_W + 40;
        const largeCardH = CARD_H - 30;

        // Card background with green tint
        const cardBg = helper.createNineSlice(cx, cardY, 'buttons', 'popup_nineslice.png', largeCardW, largeCardH, 32, 32, 32, 32);
        cardBg.setDepth(d).setScrollFactor(0).setAlpha(0.95);
        elements.push(cardBg);

        // Green glow
        const glow = helper.createNineSlice(cx, cardY, 'buttons', 'popup_nineslice.png', largeCardW + 10, largeCardH + 10, 32, 32, 32, 32);
        glow.setDepth(d - 0.5).setScrollFactor(0).setAlpha(0.25);
        helper.setTint(glow, 0x44ff44);
        elements.push(glow);
        PhaserScene.tweens.add({
            targets: glow,
            alpha: 0.45,
            duration: 1000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
        });

        let yOff = cardY - largeCardH / 2 + 35;

        // Corp name
        const nameText = PhaserScene.add.text(cx, yOff, target.name || pending.targetName || 'TARGET', {
            fontFamily: 'Quantico-Bold', fontSize: '20px', color: '#ffffff', align: 'center',
            wordWrap: { width: largeCardW - 40 },
        }).setOrigin(0.5, 0).setDepth(d + 2).setScrollFactor(0);
        elements.push(nameText);
        yOff += nameText.height + 12;

        // Security badge (dimmed)
        if (target.security) {
            const badge = PhaserScene.add.text(cx, yOff, target.security, {
                fontFamily: 'Quantico-Bold', fontSize: '14px',
                color: takeoverTargets.getSecurityColor(target.security), align: 'center',
            }).setOrigin(0.5, 0).setDepth(d + 2).setScrollFactor(0).setAlpha(0.4);
            elements.push(badge);
            yOff += badge.height + 12;
        }

        // Full progress bar (green)
        const barW = largeCardW - 60;
        const barH = 16;
        const barTrack = PhaserScene.add.image(cx, yOff + barH / 2, 'buttons', 'white_pixel.png');
        barTrack.setDisplaySize(barW, barH);
        barTrack.setDepth(d + 1).setScrollFactor(0).setTint(0x1a1e2e).setAlpha(0.9);
        elements.push(barTrack);

        const barFill = PhaserScene.add.image(cx - barW / 2, yOff + barH / 2, 'buttons', 'white_pixel.png');
        barFill.setOrigin(0, 0.5);
        barFill.setDisplaySize(barW, barH - 2);
        barFill.setDepth(d + 2).setScrollFactor(0).setTint(0x44ff44);
        elements.push(barFill);
        yOff += barH + 20;

        // BREACH SUCCESSFUL text
        const successText = PhaserScene.add.text(cx, yOff, t('popup', 'breach_successful'), {
            fontFamily: 'Quantico-Bold', fontSize: '24px', color: '#44ff44', align: 'center',
        }).setOrigin(0.5, 0).setDepth(d + 2).setScrollFactor(0);
        elements.push(successText);

        // Pulsing animation on success text
        PhaserScene.tweens.add({
            targets: successText,
            alpha: 0.7,
            duration: 800,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
        });
        yOff += 36;

        // Reward amount (large, prominent)
        const rewardStr = takeoverTargets.formatReward(pending.rewardType, pending.rewardAmount);
        const rewardColor = takeoverTargets.getRewardColor(pending.rewardType);
        const rewardText = PhaserScene.add.text(cx, yOff, rewardStr, {
            fontFamily: 'Quantico-Bold', fontSize: '28px', color: rewardColor, align: 'center',
        }).setOrigin(0.5, 0).setDepth(d + 2).setScrollFactor(0);
        elements.push(rewardText);
        yOff += 44;

        // COLLECT button (green styled)
        const isMobile = helper.isMobileDevice();
        const collectBtn = new Button({
            normal: { ref: isMobile ? 'button_normal_mobile.png' : 'button_normal.png', atlas: 'buttons', x: cx, y: yOff + 10 },
            hover: { ref: 'button_hover.png', atlas: 'buttons', x: cx, y: yOff + 10 },
            press: { ref: 'button_press.png', atlas: 'buttons', x: cx, y: yOff + 10 },
            onMouseUp: () => {
                const reward = takeoverTargets.collectReward();
                if (reward) {
                    audio.play('upgrade_max', 0.6);
                    // Show floating text on game screen
                    if (typeof messageBus !== 'undefined') {
                        const pos = typeof tower !== 'undefined' ? tower.getPosition() : { x: GAME_CONSTANTS.halfWidth, y: GAME_CONSTANTS.halfHeight };
                        messageBus.publish('showFloatingText',
                            pos.x + (Math.random() - 0.5) * 80,
                            pos.y + (Math.random() - 0.5) * 60,
                            takeoverTargets.formatReward(reward.rewardType, reward.rewardAmount),
                            { fontFamily: 'Quantico-Bold', color: takeoverTargets.getRewardColor(reward.rewardType), fontSize: 28, travel: 60, noScale: true }
                        );
                    }
                    _rebuild();
                }
            }
        });
        collectBtn.setScale(0.8);
        collectBtn.addText(t('popup', 'collect'), { fontFamily: 'Quantico-Bold', fontSize: '24px', color: '#44ff44' });
        collectBtn.setDepth(d + 3);
        collectBtn.setScrollFactor(0);
        elements.push(collectBtn);
    }

    let lastRemainingSeconds = -1;
    let updateFrameCount = 0;

    function _update() {
        if (!isVisible) return;

        // Check if attack just completed
        const justCompleted = takeoverTargets.checkCompletion();
        if (justCompleted) {
            _rebuild();
            return;
        }

        // Update progress bar and timer text if attacking
        if (takeoverTargets.isAttacking() && progressBarFill && timerText) {
            // Only update visuals every 10 frames or on the first frame to save CPU/rendering overhead
            if (updateFrameCount % 10 === 0 || lastRemainingSeconds === -1) {
                const progress = takeoverTargets.getProgress();
                const remaining = takeoverTargets.getRemainingSeconds();

                // Update bar fill width
                const fillW = Math.max(1, progress * progressBarFill._barMaxW);
                progressBarFill.setDisplaySize(fillW, progressBarFill.displayHeight);

                // Update timer text (only when seconds change to reduce GC pressure)
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

    // ── Rebuild (clear and re-render current state) ───────────────────────────

    function _rebuild() {
        // Clear dynamic content but keep overlay and blocker
        _clearContent();

        const cx = GAME_CONSTANTS.halfWidth;
        const cy = GAME_CONSTANTS.halfHeight;

        // Re-create popup background
        const bg = helper.createNineSlice(cx, cy, 'buttons', 'popup_nineslice.png', POPUP_W, POPUP_H, 64, 64, 64, 64);
        bg.setDepth(DEPTH_BASE + 1).setScrollFactor(0);
        elements.push(bg);

        // Title
        const title = PhaserScene.add.text(cx, cy - POPUP_H / 2 + 45, t('popup', 'takeover_title'), {
            fontFamily: 'Quantico-Bold', fontSize: '42px', color: '#FFD700', align: 'center',
        }).setOrigin(0.5).setShadow(2, 2, '#000000', 2, true, true).setDepth(DEPTH_BASE + 2).setScrollFactor(0);
        elements.push(title);

        // Close button
        const closeBtn = new Button({
            normal: { ref: 'close_button_normal.png', atlas: 'buttons', x: cx + POPUP_W / 2 - 35, y: cy - POPUP_H / 2 + 36 },
            hover: { ref: 'close_button_hover.png', atlas: 'buttons' },
            press: { ref: 'close_button_press.png', atlas: 'buttons' },
            onMouseUp: hide
        });
        closeBtn.setDepth(DEPTH_BASE + 5);
        closeBtn.setScrollFactor(0);
        elements.push(closeBtn);

        // Build appropriate state
        if (takeoverTargets.hasRewardPending()) {
            _buildRewardState(cx, cy);
        } else if (takeoverTargets.isAttacking()) {
            _buildAttackState(cx, cy);
        } else {
            _buildSelectionState(cx, cy);
        }

        // Camera assignment
        if (typeof upgradeTree !== 'undefined' && upgradeTree.getUICamera()) {
            elements.forEach(el => upgradeTree.assignToUICamera(el));
        }
    }

    function _clearContent() {
        progressBarFill = null;
        timerText = null;
        lastRemainingSeconds = -1;
        updateFrameCount = 0;
        elements.forEach(el => {
            if (el && el.destroy) el.destroy();
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

        progressBarFill = null;
        timerText = null;
        lastRemainingSeconds = -1;
        updateFrameCount = 0;

        if (overlay) {
            overlay.destroy();
            overlay = null;
            helper.hideGlobalClickBlocker();
        }
        elements.forEach(el => {
            if (el && el.destroy) el.destroy();
        });
        elements = [];
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
