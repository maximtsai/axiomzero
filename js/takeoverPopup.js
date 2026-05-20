/**
 * @fileoverview Manages the Financial Breach / Takeover popup interface.
 * Two-panel Tactical Terminal layout:
 *   - Left Panel: Vertical target list.
 *   - Right Panel: Detailed view (static info, breaching progress, or reward extraction).
 */
const takeoverPopup = (() => {
    let overlay = null;
    let elements = [];
    let isVisible = false;
    let updateFn = null;

    let selectedTargetIndex = 0;

    // Transition & Animation state
    let isTransitioning = false;
    let activeTweens = [];

    // Right-panel progress bar references for update loop
    let progressBarFill = null;
    let timerText = null;

    // Bounding dimensions
    const POPUP_W = 1000;
    const POPUP_H = 600;
    const DEPTH_BASE = GAME_CONSTANTS.DEPTH_POPUPS + 2000;

    // ── Helper UI Functions ───────────────────────────────────────────────────

    function getTargetCategory(target) {
        if (target.rewardType === 'insight') return 'QUANT LAB';
        if (target.rewardType === 'data') return 'DATA VAULT';
        if (target.security === 'LOW') return 'BLACK MARKET';
        return 'FINANCE';
    }

    function getCategoryColor(category) {
        if (category === 'QUANT LAB') return '#ff33cc';   // Pink/Magenta
        if (category === 'DATA VAULT') return '#00f5ff';  // Cyan
        if (category === 'BLACK MARKET') return '#44ff44'; // Green
        if (category === 'FINANCE') return '#ffcc00';      // Yellow
        return '#ffffff';
    }

    function getTargetThemeColor(target, index) {
        if (index === 0) return '#00f5ff'; // Cyan
        if (index === 1) return '#44ff44'; // Green
        return '#ff33cc'; // Pink/Magenta
    }

    function addEl(el) {
        if (!el) return;
        elements.push(el);
        if (typeof upgradeTree !== 'undefined' && upgradeTree.assignToUICamera) {
            upgradeTree.assignToUICamera(el);
        }
        return el;
    }

    // ── Vector Hexagon and Icon Drawing ────────────────────────────────────────

    function drawHexagonIcon(graphics, x, y, r, rewardType, strokeColor) {
        const strokeColorHex = Phaser.Display.Color.HexStringToColor(strokeColor).color;
        
        // Compute 6 vertices of a pointy-topped hexagon
        const points = [];
        for (let i = 0; i < 6; i++) {
            const angleRad = Phaser.Math.DegToRad(-90 + i * 60);
            points.push({
                x: x + r * Math.cos(angleRad),
                y: y + r * Math.sin(angleRad)
            });
        }
        
        graphics.lineStyle(1.5, strokeColorHex, 0.85);
        graphics.beginPath();
        graphics.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < 6; i++) {
            graphics.lineTo(points[i].x, points[i].y);
        }
        graphics.closePath();
        graphics.strokePath();

        // Draw custom vector symbol inside
        const s = r / 24;
        graphics.lineStyle(1.5, strokeColorHex, 0.9);
        
        if (rewardType === 'coin') {
            // Finance / Bank Icon (columns and roof)
            graphics.strokeLineShape(new Phaser.Geom.Line(x - 12 * s, y + 10 * s, x + 12 * s, y + 10 * s));
            graphics.strokeLineShape(new Phaser.Geom.Line(x - 14 * s, y - 2 * s, x + 14 * s, y - 2 * s));
            graphics.beginPath();
            graphics.moveTo(x - 14 * s, y - 2 * s);
            graphics.lineTo(x, y - 12 * s);
            graphics.lineTo(x + 14 * s, y - 2 * s);
            graphics.strokePath();
            graphics.strokeLineShape(new Phaser.Geom.Line(x - 7 * s, y - 2 * s, x - 7 * s, y + 10 * s));
            graphics.strokeLineShape(new Phaser.Geom.Line(x, y - 2 * s, x, y + 10 * s));
            graphics.strokeLineShape(new Phaser.Geom.Line(x + 7 * s, y - 2 * s, x + 7 * s, y + 10 * s));
        } else if (rewardType === 'data') {
            // Data / Server Rack Icon
            graphics.strokeRect(x - 11 * s, y - 10 * s, 9 * s, 21 * s);
            graphics.strokeRect(x + 2 * s, y - 6 * s, 9 * s, 17 * s);
            graphics.strokeLineShape(new Phaser.Geom.Line(x - 9 * s, y - 5 * s, x - 4 * s, y - 5 * s));
            graphics.strokeLineShape(new Phaser.Geom.Line(x - 9 * s, y, x - 4 * s, y));
            graphics.strokeLineShape(new Phaser.Geom.Line(x - 9 * s, y + 5 * s, x - 4 * s, y + 5 * s));
            graphics.strokeLineShape(new Phaser.Geom.Line(x + 4 * s, y - 2 * s, x + 9 * s, y - 2 * s));
            graphics.strokeLineShape(new Phaser.Geom.Line(x + 4 * s, y + 3 * s, x + 9 * s, y + 3 * s));
            graphics.strokeLineShape(new Phaser.Geom.Line(x + 4 * s, y + 8 * s, x + 9 * s, y + 8 * s));
        } else if (rewardType === 'insight') {
            // Insight / Brain Circuit Icon
            graphics.strokeLineShape(new Phaser.Geom.Line(x, y - 12 * s, x, y + 12 * s));
            graphics.beginPath();
            graphics.moveTo(x, y - 6 * s);
            graphics.lineTo(x - 7 * s, y - 10 * s);
            graphics.lineTo(x - 12 * s, y - 10 * s);
            graphics.moveTo(x, y);
            graphics.lineTo(x - 10 * s, y);
            graphics.moveTo(x, y + 6 * s);
            graphics.lineTo(x - 7 * s, y + 10 * s);
            graphics.lineTo(x - 12 * s, y + 10 * s);
            graphics.strokePath();
            
            graphics.beginPath();
            graphics.moveTo(x, y - 6 * s);
            graphics.lineTo(x + 7 * s, y - 10 * s);
            graphics.lineTo(x + 12 * s, y - 10 * s);
            graphics.moveTo(x, y);
            graphics.lineTo(x + 10 * s, y);
            graphics.moveTo(x, y + 6 * s);
            graphics.lineTo(x + 7 * s, y + 10 * s);
            graphics.lineTo(x + 12 * s, y + 10 * s);
            graphics.strokePath();
            
            graphics.fillStyle(strokeColorHex, 1.0);
            graphics.fillCircle(x - 12 * s, y - 10 * s, 1.5);
            graphics.fillCircle(x - 10 * s, y, 1.5);
            graphics.fillCircle(x - 12 * s, y + 10 * s, 1.5);
            graphics.fillCircle(x + 12 * s, y - 10 * s, 1.5);
            graphics.fillCircle(x + 10 * s, y, 1.5);
            graphics.fillCircle(x + 12 * s, y + 10 * s, 1.5);
        }
    }

    // ── Custom Vector Button Factory ──────────────────────────────────────────

    function createVectorButton(x, y, w, h, label, strokeColorHex, callback) {
        const container = PhaserScene.add.container(0, 0).setDepth(DEPTH_BASE + 10).setScrollFactor(0);
        addEl(container);

        const graphics = PhaserScene.add.graphics().setScrollFactor(0);
        container.add(graphics);

        function drawState(isHover, isPressed) {
            graphics.clear();
            let alpha = 0.4;
            let fillAlpha = 0.02;
            if (isPressed) {
                alpha = 1.0;
                fillAlpha = 0.15;
            } else if (isHover) {
                alpha = 0.8;
                fillAlpha = 0.08;
            }
            graphics.lineStyle(1, strokeColorHex, alpha);
            graphics.strokeRect(x - w / 2, y - h / 2, w, h);
            graphics.fillStyle(strokeColorHex, fillAlpha);
            graphics.fillRect(x - w / 2, y - h / 2, w, h);
        }
        drawState(false, false);

        const text = PhaserScene.add.text(x, y, label, {
            fontFamily: 'Quantico-Bold',
            fontSize: '15px',
            color: '#' + strokeColorHex.toString(16).padStart(6, '0'),
            align: 'center'
        }).setOrigin(0.5).setScrollFactor(0);
        container.add(text);

        const hitArea = new Phaser.Geom.Rectangle(x - w / 2, y - h / 2, w, h);
        graphics.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains);

        graphics.on('pointerover', () => {
            audio.play('click', 0.3);
            drawState(true, false);
            text.setStyle({ color: '#ffffff' });
        });

        graphics.on('pointerout', () => {
            drawState(false, false);
            text.setStyle({ color: '#' + strokeColorHex.toString(16).padStart(6, '0') });
        });

        graphics.on('pointerdown', () => {
            drawState(true, true);
        });

        graphics.on('pointerup', () => {
            drawState(true, false);
            audio.play('click', 0.8);
            callback();
        });

        return container;
    }

    // ── Mixed-Color Metadata Line ─────────────────────────────────────────────

    function createInlineMetaRow(x, y, target, depth) {
        const payoutLabel = PhaserScene.add.text(x, y, 'PAYOUT', {
            fontFamily: 'Quantico-Bold', fontSize: '11px', color: '#8899aa'
        }).setDepth(depth).setScrollFactor(0);
        addEl(payoutLabel);

        const rewardStr = takeoverTargets.formatReward(target.rewardType, target.rewardAmount);
        const rewardColor = takeoverTargets.getRewardColor(target.rewardType);
        const payoutVal = PhaserScene.add.text(x + 60, y - 2, rewardStr, {
            fontFamily: 'Quantico-Bold', fontSize: '13px', color: rewardColor
        }).setDepth(depth).setScrollFactor(0);
        addEl(payoutVal);

        const dividerX = x + 60 + payoutVal.width + 12;
        const divider = PhaserScene.add.text(dividerX, y, '|', {
            fontFamily: 'Quantico-Bold', fontSize: '11px', color: '#445566'
        }).setDepth(depth).setScrollFactor(0);
        addEl(divider);

        const timeLabelX = dividerX + 15;
        const timeLabel = PhaserScene.add.text(timeLabelX, y, 'TIME', {
            fontFamily: 'Quantico-Bold', fontSize: '11px', color: '#8899aa'
        }).setDepth(depth).setScrollFactor(0);
        addEl(timeLabel);

        const timeStr = helper.formatTime(target.duration);
        const timeVal = PhaserScene.add.text(timeLabelX + 40, y - 2, timeStr, {
            fontFamily: 'Quantico-Bold', fontSize: '13px', color: '#00f5ff'
        }).setDepth(depth).setScrollFactor(0);
        addEl(timeVal);
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
            .setAlpha(0.65)
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

        // Initialize selected index to first active target
        const targets = takeoverTargets.getTargets();
        const activeIndex = targets.findIndex(t => t !== null);
        selectedTargetIndex = activeIndex !== -1 ? activeIndex : 0;

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

        // Main layout Graphics (outer bounds, vertical divider, header highlights)
        const mainGraphics = PhaserScene.add.graphics().setDepth(d).setScrollFactor(0);
        addEl(mainGraphics);

        // 1. Dark background panel fill
        mainGraphics.fillStyle(0x07090d, 0.96);
        mainGraphics.fillRect(cx - 470, cy - 270, 940, 540);

        // 2. Thin Cyan Outer Bounding Rectangle
        mainGraphics.lineStyle(1, 0x00f5ff, 0.35);
        mainGraphics.strokeRect(cx - 470, cy - 270, 940, 540);

        // 3. Technical Corner Accent Notches
        mainGraphics.lineStyle(1, 0x00f5ff, 0.85);
        const notch = 12;
        const offset = 8;
        // Top-left
        mainGraphics.strokeLineShape(new Phaser.Geom.Line(cx - 470 - offset, cy - 270 - offset, cx - 470 - offset + notch, cy - 270 - offset));
        mainGraphics.strokeLineShape(new Phaser.Geom.Line(cx - 470 - offset, cy - 270 - offset, cx - 470 - offset, cy - 270 - offset + notch));
        // Top-right
        mainGraphics.strokeLineShape(new Phaser.Geom.Line(cx + 470 + offset, cy - 270 - offset, cx + 470 + offset - notch, cy - 270 - offset));
        mainGraphics.strokeLineShape(new Phaser.Geom.Line(cx + 470 + offset, cy - 270 - offset, cx + 470 + offset, cy - 270 - offset + notch));
        // Bottom-left
        mainGraphics.strokeLineShape(new Phaser.Geom.Line(cx - 470 - offset, cy + 270 + offset, cx - 470 - offset + notch, cy + 270 + offset));
        mainGraphics.strokeLineShape(new Phaser.Geom.Line(cx - 470 - offset, cy + 270 + offset, cx - 470 - offset, cy + 270 + offset - notch));
        // Bottom-right
        mainGraphics.strokeLineShape(new Phaser.Geom.Line(cx + 470 + offset, cy + 270 + offset, cx + 470 + offset - notch, cy + 270 + offset));
        mainGraphics.strokeLineShape(new Phaser.Geom.Line(cx + 470 + offset, cy + 270 + offset, cx + 470 + offset, cy + 270 + offset - notch));

        // 4. Header Labels
        const titleText = PhaserScene.add.text(cx - 440, cy - 235, t('popup', 'takeover_title'), {
            fontFamily: 'Quantico-Bold', fontSize: '32px', color: '#00f5ff'
        }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(d + 1);
        addEl(titleText);

        let subTextStr = 'SELECT TARGET';
        if (takeoverTargets.hasRewardPending()) {
            subTextStr = 'EXTRACTION READY';
        } else if (takeoverTargets.isAttacking()) {
            subTextStr = 'BREACH IN PROGRESS';
        }
        const subtitleText = PhaserScene.add.text(cx - 440, cy - 205, subTextStr, {
            fontFamily: 'Quantico-Bold', fontSize: '12px', color: '#8899aa'
        }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(d + 1);
        addEl(subtitleText);

        // 5. Header Close Button
        const closeBtn = PhaserScene.add.text(cx + 470 - 35, cy - 270 + 25, '✕', {
            fontFamily: 'Quantico-Bold', fontSize: '24px', color: '#00f5ff'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(d + 1).setInteractive({ useHandCursor: true });
        addEl(closeBtn);
        closeBtn.on('pointerover', () => closeBtn.setStyle({ color: '#ffffff' }));
        closeBtn.on('pointerout', () => closeBtn.setStyle({ color: '#00f5ff' }));
        closeBtn.on('pointerup', () => {
            audio.play('click', 1.0);
            hide();
        });

        // 6. Dividers
        // Top Horizontal Divider below header
        mainGraphics.lineStyle(1, 0x00f5ff, 0.2);
        mainGraphics.strokeLineShape(new Phaser.Geom.Line(cx - 440, cy - 180, cx + 440, cy - 180));
        // Short cyan accent line over header divider
        mainGraphics.lineStyle(2, 0x00f5ff, 0.85);
        mainGraphics.strokeLineShape(new Phaser.Geom.Line(cx + 260, cy - 180, cx + 410, cy - 180));

        // Middle Vertical Divider
        mainGraphics.lineStyle(1, 0x00f5ff, 0.2);
        mainGraphics.strokeLineShape(new Phaser.Geom.Line(cx, cy - 180, cx, cy + 180));

        // Bottom Horizontal Divider above action bar
        mainGraphics.strokeLineShape(new Phaser.Geom.Line(cx - 440, cy + 180, cx + 440, cy + 180));

        // ── Render Panels ─────────────────────────────────────────────────────
        _buildLeftPanel(cx, cy, d);
        _buildRightPanel(cx, cy, d);
    }

    // ── Left Panel (Target Rows) ──────────────────────────────────────────────

    function _buildLeftPanel(cx, cy, d) {
        const targets = takeoverTargets.getTargets();
        const activeAttack = takeoverTargets.getActiveAttack();
        const pendingReward = takeoverTargets.getPendingReward();
        const isAttackingOrPending = activeAttack || pendingReward;

        // Draw horizontal slot dividers inside left column
        const mainGraphics = elements.find(el => el.type === 'Graphics');
        if (mainGraphics) {
            mainGraphics.lineStyle(1, 0x00f5ff, 0.15);
            mainGraphics.strokeLineShape(new Phaser.Geom.Line(cx - 440, cy - 60, cx - 20, cy - 60));
            mainGraphics.strokeLineShape(new Phaser.Geom.Line(cx - 440, cy + 60, cx - 20, cy + 60));
        }

        // If an attack or reward is active, locked row coordinates correspond to that specific target
        let lockedIndex = -1;
        if (activeAttack) {
            lockedIndex = targets.findIndex(t => t && t.name === activeAttack.target.name);
        } else if (pendingReward) {
            lockedIndex = targets.findIndex(t => t && t.name === pendingReward.targetName);
        }

        if (lockedIndex !== -1) {
            selectedTargetIndex = lockedIndex;
        }

        for (let i = 0; i < 3; i++) {
            const rowY = cy - 120 + i * 120;
            const target = targets[i];
            const isSelected = (i === selectedTargetIndex);

            if (target) {
                const themeColor = getTargetThemeColor(target, i);
                const themeColorHex = Phaser.Display.Color.HexStringToColor(themeColor).color;

                // Dedicated Graphics for this row's outlines/selection state
                const rowGraphics = PhaserScene.add.graphics().setDepth(d + 1).setScrollFactor(0);
                addEl(rowGraphics);

                const containerAlpha = (isAttackingOrPending && !isSelected) ? 0.3 : 1.0;
                rowGraphics.setAlpha(containerAlpha);

                // Draw row outline/highlight if selected
                if (isSelected) {
                    rowGraphics.lineStyle(1, themeColorHex, 0.45);
                    rowGraphics.strokeRect(cx - 440, rowY - 45, 420, 90);
                    rowGraphics.fillStyle(themeColorHex, 0.04);
                    rowGraphics.fillRect(cx - 440, rowY - 45, 420, 90);

                    // Pulsing chevron pointing at the row
                    const chevron = PhaserScene.add.text(cx - 456, rowY, '>', {
                        fontFamily: 'Quantico-Bold', fontSize: '18px', color: themeColor
                    }).setOrigin(0.5).setScrollFactor(0).setDepth(d + 2);
                    addEl(chevron);
                    PhaserScene.tweens.add({
                        targets: chevron,
                        alpha: 0.3,
                        duration: 800,
                        yoyo: true,
                        repeat: -1,
                        ease: 'Sine.easeInOut'
                    });
                }

                // Hexagon Icon on the left
                drawHexagonIcon(rowGraphics, cx - 400, rowY, 24, target.rewardType, themeColor);

                // Target Number index
                const indexText = PhaserScene.add.text(cx - 360, rowY - 24, (i + 1).toString().padStart(2, '0'), {
                    fontFamily: 'Quantico-Bold', fontSize: '11px', color: themeColor
                }).setOrigin(0).setScrollFactor(0).setDepth(d + 2).setAlpha(containerAlpha);
                addEl(indexText);

                // Target Name
                const nameText = PhaserScene.add.text(cx - 360, rowY - 10, target.name, {
                    fontFamily: 'Quantico-Bold', fontSize: '16px', color: '#ffffff'
                }).setOrigin(0).setScrollFactor(0).setDepth(d + 2).setAlpha(containerAlpha);
                addEl(nameText);

                // Mixed-color payout / time readout
                createInlineMetaRow(cx - 360, rowY + 18, target, d + 2);

                // Row Interaction Hitbox Zone
                if (!isAttackingOrPending) {
                    const hitZone = PhaserScene.add.zone(cx - 230, rowY, 420, 90).setScrollFactor(0).setInteractive({ useHandCursor: true });
                    addEl(hitZone);

                    hitZone.on('pointerover', () => {
                        if (!isSelected) {
                            rowGraphics.clear();
                            rowGraphics.lineStyle(1, 0x00f5ff, 0.15);
                            rowGraphics.strokeRect(cx - 440, rowY - 45, 420, 90);
                        }
                    });

                    hitZone.on('pointerout', () => {
                        if (!isSelected) {
                            rowGraphics.clear();
                        }
                    });

                    hitZone.on('pointerup', () => {
                        if (selectedTargetIndex !== i) {
                            selectedTargetIndex = i;
                            audio.play('click', 1.0);
                            _rebuild();
                        }
                    });
                }
            } else {
                // Empty / Searching signal placeholder
                const placeholder = PhaserScene.add.text(cx - 230, rowY, '[ SLOT 03: SIGNAL OFFLINE // SCANNING ]', {
                    fontFamily: 'Quantico-Bold', fontSize: '12px', color: '#445566', align: 'center'
                }).setOrigin(0.5).setScrollFactor(0).setDepth(d + 2);
                addEl(placeholder);
            }
        }
    }

    // ── Right Panel (Details / Breach Progress / Rewards) ──────────────────────

    function _buildRightPanel(cx, cy, d) {
        const targets = takeoverTargets.getTargets();
        const activeAttack = takeoverTargets.getActiveAttack();
        const pendingReward = takeoverTargets.getPendingReward();

        // 1. Get correct target object
        let validIndex = selectedTargetIndex;
        if (!targets[validIndex]) {
            validIndex = targets.findIndex(t => t !== null);
            if (validIndex === -1) return;
            selectedTargetIndex = validIndex;
        }
        const target = targets[validIndex];
        const themeColor = getTargetThemeColor(target, validIndex);
        const themeColorHex = Phaser.Display.Color.HexStringToColor(themeColor).color;

        // 2. Draw Header Area (Large Hexagon, Index, Name, Category)
        const headerGraphics = PhaserScene.add.graphics().setDepth(d + 1).setScrollFactor(0);
        addEl(headerGraphics);
        drawHexagonIcon(headerGraphics, cx + 55, cy - 120, 32, target.rewardType, themeColor);

        const nameX = cx + 110;
        const numText = PhaserScene.add.text(nameX, cy - 146, (validIndex + 1).toString().padStart(2, '0'), {
            fontFamily: 'Quantico-Bold', fontSize: '12px', color: themeColor
        }).setOrigin(0).setScrollFactor(0).setDepth(d + 2);
        addEl(numText);

        const nameText = PhaserScene.add.text(nameX, cy - 132, target.name, {
            fontFamily: 'Quantico-Bold', fontSize: '20px', color: '#ffffff',
            wordWrap: { width: 320 }
        }).setOrigin(0).setScrollFactor(0).setDepth(d + 2);
        addEl(nameText);

        const category = getTargetCategory(target);
        const categoryColor = getCategoryColor(category);
        const catText = PhaserScene.add.text(nameX, cy - 106, category, {
            fontFamily: 'Quantico-Bold', fontSize: '11px', color: categoryColor
        }).setOrigin(0).setScrollFactor(0).setDepth(d + 2);
        addEl(catText);

        // 3. Section dividers & content depending on visual state
        const contentGraphics = PhaserScene.add.graphics().setDepth(d + 1).setScrollFactor(0);
        addEl(contentGraphics);
        contentGraphics.lineStyle(1, 0x00f5ff, 0.15);

        if (pendingReward) {
            // STATE 3: REWARD PENDING / EXTRACTION
            contentGraphics.strokeLineShape(new Phaser.Geom.Line(cx + 20, cy - 70, cx + 440, cy - 70));
            contentGraphics.strokeLineShape(new Phaser.Geom.Line(cx + 20, cy + 30, cx + 440, cy + 30));
            contentGraphics.strokeLineShape(new Phaser.Geom.Line(cx + 20, cy + 130, cx + 440, cy + 130));

            // Payout Section
            const pLabel = PhaserScene.add.text(cx + 30, cy - 60, 'PAYOUT', {
                fontFamily: 'Quantico-Bold', fontSize: '11px', color: '#8899aa'
            }).setScrollFactor(0).setDepth(d + 2);
            addEl(pLabel);

            const pStr = takeoverTargets.formatReward(pendingReward.rewardType, pendingReward.rewardAmount);
            const pColor = takeoverTargets.getRewardColor(pendingReward.rewardType);
            const pVal = PhaserScene.add.text(cx + 30, cy - 46, pStr, {
                fontFamily: 'Quantico-Bold', fontSize: '28px', color: pColor
            }).setScrollFactor(0).setDepth(d + 2);
            addEl(pVal);

            // Breach Status Section
            const sLabel = PhaserScene.add.text(cx + 30, cy + 40, 'BREACH STATUS', {
                fontFamily: 'Quantico-Bold', fontSize: '11px', color: '#8899aa'
            }).setScrollFactor(0).setDepth(d + 2);
            addEl(sLabel);

            const sVal = PhaserScene.add.text(cx + 30, cy + 54, 'BREACH SUCCESSFUL', {
                fontFamily: 'Quantico-Bold', fontSize: '24px', color: '#44ff44'
            }).setScrollFactor(0).setDepth(d + 2);
            addEl(sVal);
            PhaserScene.tweens.add({
                targets: sVal,
                alpha: 0.45,
                duration: 800,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });

            // Notes / Extraction Summary Section
            const nLabel = PhaserScene.add.text(cx + 30, cy + 140, 'EXTRACTION DETAILS', {
                fontFamily: 'Quantico-Bold', fontSize: '11px', color: '#8899aa'
            }).setScrollFactor(0).setDepth(d + 2);
            addEl(nLabel);

            const nVal = PhaserScene.add.text(cx + 30, cy + 154, 'Firewalls cleared. Cryptographic vaults bypassed. Direct link established. Slush funds ready for direct wire transfer.', {
                fontFamily: 'Quantico-Italic', fontSize: '13px', color: '#8899aa', fontStyle: 'italic',
                wordWrap: { width: 380 }
            }).setScrollFactor(0).setDepth(d + 2);
            addEl(nVal);

            // Bottom Green Outline Extraction Button
            createVectorButton(cx + 240, cy + 220, 380, 48, 'EXTRACT REWARD', 0x44ff44, () => {
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
                    _rebuild();
                }
            });

        } else if (activeAttack) {
            // STATE 2: ATTACK IN PROGRESS / PROGRESS BAR
            contentGraphics.strokeLineShape(new Phaser.Geom.Line(cx + 20, cy - 70, cx + 440, cy - 70));
            contentGraphics.strokeLineShape(new Phaser.Geom.Line(cx + 20, cy + 30, cx + 440, cy + 30));
            contentGraphics.strokeLineShape(new Phaser.Geom.Line(cx + 20, cy + 130, cx + 440, cy + 130));

            // Payout Section
            const pLabel = PhaserScene.add.text(cx + 30, cy - 60, 'PAYOUT', {
                fontFamily: 'Quantico-Bold', fontSize: '11px', color: '#8899aa'
            }).setScrollFactor(0).setDepth(d + 2);
            addEl(pLabel);

            const pStr = takeoverTargets.formatReward(target.rewardType, target.rewardAmount);
            const pColor = takeoverTargets.getRewardColor(target.rewardType);
            const pVal = PhaserScene.add.text(cx + 30, cy - 46, pStr, {
                fontFamily: 'Quantico-Bold', fontSize: '28px', color: pColor
            }).setScrollFactor(0).setDepth(d + 2);
            addEl(pVal);

            // Breaching Progress Section
            const bpLabel = PhaserScene.add.text(cx + 30, cy + 40, 'BREACH IN PROGRESS', {
                fontFamily: 'Quantico-Bold', fontSize: '11px', color: '#00f5ff'
            }).setScrollFactor(0).setDepth(d + 2);
            addEl(bpLabel);

            timerText = PhaserScene.add.text(cx + 30, cy + 54, t('popup', 'breaching'), {
                fontFamily: 'Quantico-Bold', fontSize: '24px', color: '#00f5ff'
            }).setScrollFactor(0).setDepth(d + 2);
            addEl(timerText);

            // Thin linear progress bar
            const barW = 380;
            const barTrack = PhaserScene.add.image(cx + 220, cy + 95, 'buttons', 'white_pixel.png');
            barTrack.setDisplaySize(barW, 10);
            barTrack.setDepth(d + 1).setScrollFactor(0).setTint(0x131722).setAlpha(0.9);
            addEl(barTrack);

            progressBarFill = PhaserScene.add.image(cx + 30, cy + 95, 'buttons', 'white_pixel.png');
            progressBarFill.setOrigin(0, 0.5);
            progressBarFill.setDisplaySize(1, 10);
            progressBarFill.setDepth(d + 2).setScrollFactor(0).setTint(0x00f5ff);
            progressBarFill._barMaxW = barW;
            addEl(progressBarFill);

            // Recovery Section
            const rLabel = PhaserScene.add.text(cx + 30, cy + 140, 'RECOVERY STATUS', {
                fontFamily: 'Quantico-Bold', fontSize: '11px', color: '#8899aa'
            }).setScrollFactor(0).setDepth(d + 2);
            addEl(rLabel);

            const rVal = PhaserScene.add.text(cx + 30, cy + 154, `+${Math.floor(activeAttack.cost * 0.75)} DATA returned on breach abort.`, {
                fontFamily: 'Quantico-Italic', fontSize: '13px', color: '#8899aa', fontStyle: 'italic'
            }).setScrollFactor(0).setDepth(d + 2);
            addEl(rVal);

            // Wide Red Abort Button
            createVectorButton(cx + 240, cy + 220, 380, 48, 'ABORT BREACH', 0xff5555, () => {
                if (isTransitioning) return;
                if (takeoverTargets.cancelAttack()) {
                    audio.play('click', 1.0);
                    _rebuild();
                }
            });

        } else {
            // STATE 1: STANDARD SELECTION
            contentGraphics.strokeLineShape(new Phaser.Geom.Line(cx + 20, cy - 70, cx + 440, cy - 70));
            contentGraphics.strokeLineShape(new Phaser.Geom.Line(cx + 20, cy, cx + 440, cy));
            contentGraphics.strokeLineShape(new Phaser.Geom.Line(cx + 20, cy + 70, cx + 440, cy + 70));
            contentGraphics.strokeLineShape(new Phaser.Geom.Line(cx + 20, cy + 130, cx + 440, cy + 130));

            const canAfford = resourceManager.canAfford('data', target.cost);

            // Payout Section
            const pLabel = PhaserScene.add.text(cx + 30, cy - 60, 'PAYOUT', {
                fontFamily: 'Quantico-Bold', fontSize: '11px', color: '#8899aa'
            }).setScrollFactor(0).setDepth(d + 2);
            addEl(pLabel);

            const pStr = takeoverTargets.formatReward(target.rewardType, target.rewardAmount);
            const pColor = takeoverTargets.getRewardColor(target.rewardType);
            const pVal = PhaserScene.add.text(cx + 30, cy - 46, pStr, {
                fontFamily: 'Quantico-Bold', fontSize: '28px', color: pColor
            }).setScrollFactor(0).setDepth(d + 2);
            addEl(pVal);

            // Duration Section
            const dLabel = PhaserScene.add.text(cx + 30, cy + 10, 'DURATION', {
                fontFamily: 'Quantico-Bold', fontSize: '11px', color: '#8899aa'
            }).setScrollFactor(0).setDepth(d + 2);
            addEl(dLabel);

            const dStr = helper.formatTime(target.duration);
            const dVal = PhaserScene.add.text(cx + 30, cy + 24, dStr, {
                fontFamily: 'Quantico-Bold', fontSize: '18px', color: '#00f5ff'
            }).setScrollFactor(0).setDepth(d + 2);
            addEl(dVal);

            // Cost Section
            const cLabel = PhaserScene.add.text(cx + 30, cy + 80, 'COST', {
                fontFamily: 'Quantico-Bold', fontSize: '11px', color: '#8899aa'
            }).setScrollFactor(0).setDepth(d + 2);
            addEl(cLabel);

            const cVal = PhaserScene.add.text(cx + 30, cy + 94, `${target.cost} DATA`, {
                fontFamily: 'Quantico-Bold', fontSize: '18px', color: canAfford ? '#00f5ff' : '#ff5555'
            }).setScrollFactor(0).setDepth(d + 2);
            addEl(cVal);

            // Notes Section
            const nLabel = PhaserScene.add.text(cx + 30, cy + 140, 'RECON NOTES', {
                fontFamily: 'Quantico-Bold', fontSize: '11px', color: '#8899aa'
            }).setScrollFactor(0).setDepth(d + 2);
            addEl(nLabel);

            const nVal = PhaserScene.add.text(cx + 30, cy + 154, `[RECON]: ${target.flavor}`, {
                fontFamily: 'Quantico-Italic', fontSize: '13px', color: '#8899aa', fontStyle: 'italic',
                wordWrap: { width: 380 }
            }).setScrollFactor(0).setDepth(d + 2);
            addEl(nVal);

            // Center / Right action button
            const buttonColor = canAfford ? 0x00f5ff : 0x445566;
            createVectorButton(cx + 240, cy + 220, 380, 48, 'EXECUTE BREACH    >', buttonColor, () => {
                if (!canAfford) {
                    audio.play('click', 0.5); // Dull feedback
                    return;
                }
                _animateBreachTransition(validIndex);
            });
        }
    }

    // ── Visual Breach Transition Animation ─────────────────────────────────────

    function _animateBreachTransition(selectedIndex) {
        if (isTransitioning) return;
        isTransitioning = true;

        if (!takeoverTargets.startAttack(selectedIndex)) {
            isTransitioning = false;
            return;
        }
        audio.play('upgrade', 1.0);

        const cx = GAME_CONSTANTS.halfWidth;
        const cy = GAME_CONSTANTS.halfHeight;

        // To make the transition look extremely sci-fi and fluid:
        // We will fade out the current right-panel details and morph into the attack progress details!
        const fadeOutList = [];
        elements.forEach(el => {
            // Find all elements that correspond to the right panel contents we want to fade out
            // Specifically text nodes and buttons on the right side (x > cx)
            if (el && el.x && el.x > cx + 10 && el.y > cy - 80) {
                fadeOutList.push(el);
            }
        });

        // Fade out static components
        fadeOutList.forEach(obj => {
            const tw = PhaserScene.tweens.add({
                targets: obj,
                alpha: 0,
                duration: 200,
                ease: 'Power1'
            });
            activeTweens.push(tw);
        });

        // Wait 220ms and rebuild the screen in Attack State!
        const compTimer = PhaserScene.time.delayedCall(220, () => {
            isTransitioning = false;
            _rebuild();
        });
        elements.push(compTimer);
    }

    let lastRemainingSeconds = -1;
    let updateFrameCount = 0;

    function _update() {
        if (!isVisible) return;

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
        activeTweens.forEach(t => {
            if (t && t.stop) t.stop();
        });
        activeTweens = [];
        isTransitioning = false;

        progressBarFill = null;
        timerText = null;
        lastRemainingSeconds = -1;
        updateFrameCount = 0;

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

        activeTweens.forEach(t => {
            if (t && t.stop) t.stop();
        });
        activeTweens = [];
        isTransitioning = false;

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
            else if (el && el.remove) el.remove();
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
