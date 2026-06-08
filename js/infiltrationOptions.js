/**
 * @fileoverview Modular UI components for the Infiltration Terminal.
 * Handles:
 *   - Custom notched cards (vector rendering).
 *   - Custom vector reward hexagon icons.
 *   - Modular Infiltration Target Card Component (utilizing isolated Phaser Containers).
 *   - High-fidelity sci-fi Confirmation Modal.
 */
const infiltrationOptions = (() => {

    // ── Vector Notch Outline Drawing Helper ───────────────────────────────────

    function drawNotchedCard(graphics, x, y, w, h, isHover, isSelected, themeColorHex, isOutlineOnly = false) {
        const bevel = 14;
        const points = [
            { x: x - w / 2 + bevel, y: y - h / 2 },
            { x: x + w / 2 - bevel, y: y - h / 2 },
            { x: x + w / 2, y: y - h / 2 + bevel },
            { x: x + w / 2, y: y + h / 2 - bevel },
            { x: x + w / 2 - bevel, y: y + h / 2 },
            { x: x - w / 2 + bevel, y: y + h / 2 },
            { x: x - w / 2, y: y + h / 2 - bevel },
            { x: x - w / 2, y: y - h / 2 + bevel }
        ];

        graphics.beginPath();
        graphics.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            graphics.lineTo(points[i].x, points[i].y);
        }
        graphics.closePath();

        if (!isOutlineOnly) {
            let fillAlpha = 0.82;
            if (isHover) fillAlpha = 0.94;
            graphics.fillStyle(0x070b12, fillAlpha);
            graphics.fillPath();
        }

        let alpha = 0.25;
        let thickness = 1;
        if (isHover) {
            alpha = 0.95;
            thickness = 2;
        } else if (isSelected) {
            alpha = 0.65;
            thickness = 1.5;
        }
        graphics.lineStyle(thickness, themeColorHex, alpha);
        graphics.strokePath();
    }

    // ── Vector Hexagon Icon Drawing Helper ────────────────────────────────────

    function drawHexagonIcon(graphics, x, y, r, rewardType, strokeColor) {
        const strokeColorHex = Phaser.Display.Color.HexStringToColor(strokeColor).color;
        
        // Pointy-topped hexagon
        const points = [];
        for (let i = 0; i < 6; i++) {
            const angleRad = Phaser.Math.DegToRad(-90 + i * 60);
            points.push({
                x: x + r * Math.cos(angleRad),
                y: y + r * Math.sin(angleRad)
            });
        }

        // Draw translucent difficulty-themed backing plate
        graphics.fillStyle(strokeColorHex, 0.12);
        graphics.beginPath();
        graphics.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < 6; i++) {
            graphics.lineTo(points[i].x, points[i].y);
        }
        graphics.closePath();
        graphics.fillPath();
        
        graphics.lineStyle(1.5, strokeColorHex, 0.85);
        graphics.beginPath();
        graphics.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < 6; i++) {
            graphics.lineTo(points[i].x, points[i].y);
        }
        graphics.closePath();
        graphics.strokePath();

        // Internals based on reward type
        const s = r / 24;
        graphics.lineStyle(1.5, strokeColorHex, 0.9);
        
        if (rewardType === 'coin') {
            // Finance Column building
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
            // Server rack data vault
            graphics.strokeRect(x - 11 * s, y - 10 * s, 9 * s, 21 * s);
            graphics.strokeRect(x + 2 * s, y - 6 * s, 9 * s, 17 * s);
            graphics.strokeLineShape(new Phaser.Geom.Line(x - 9 * s, y - 5 * s, x - 4 * s, y - 5 * s));
            graphics.strokeLineShape(new Phaser.Geom.Line(x - 9 * s, y, x - 4 * s, y));
            graphics.strokeLineShape(new Phaser.Geom.Line(x - 9 * s, y + 5 * s, x - 4 * s, y + 5 * s));
            graphics.strokeLineShape(new Phaser.Geom.Line(x + 4 * s, y - 2 * s, x + 9 * s, y - 2 * s));
            graphics.strokeLineShape(new Phaser.Geom.Line(x + 4 * s, y + 3 * s, x + 9 * s, y + 3 * s));
            graphics.strokeLineShape(new Phaser.Geom.Line(x + 4 * s, y + 8 * s, x + 9 * s, y + 8 * s));
        } else if (rewardType === 'insight') {
            // Brain circuit network
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

    // ── Target Hacking Card Component ──────────────────────────────────────────

    /**
     * Create a modular, isolated container for an option card.
     */
    function createTargetCard(PhaserScene, cx, rowY, target, i, depthBase, containerAlpha, onSelect) {
        const w = 780;
        const h = 130;
        const container = PhaserScene.add.container(cx, rowY).setDepth(depthBase).setScrollFactor(0).setAlpha(containerAlpha);

        const difficultyColor = takeoverTargets.getSecurityColor(target.security);
        const difficultyColorHex = Phaser.Display.Color.HexStringToColor(difficultyColor).color;

        // Visual outlines card graphics
        const cardGraphics = PhaserScene.add.graphics();
        container.add(cardGraphics);
        drawNotchedCard(cardGraphics, 0, 0, w, h, false, false, difficultyColorHex);

        // Dedicated icon graphics (separated so it doesn't get cleared on hover)
        const iconGraphics = PhaserScene.add.graphics();
        container.add(iconGraphics);
        drawHexagonIcon(iconGraphics, -320, 0, 30, target.rewardType, difficultyColor);

        // Corporate Title
        const nameText = PhaserScene.add.text(-270, -35, target.name, {
            fontFamily: 'Quantico-Bold', fontSize: '23px', color: '#ffffff'
        }).setOrigin(0, 0.5);
        container.add(nameText);

        // Difficulty Security tag with dynamic diamond prefix
        const diffText = PhaserScene.add.text(360, -35, '⧫ ' + target.security + ' SECURITY', {
            fontFamily: 'Quantico-Bold', fontSize: '15px', color: difficultyColor
        }).setOrigin(1, 0.5);
        container.add(diffText);

        // Flavor description
        const flavorText = PhaserScene.add.text(-270, -2, target.flavor, {
            fontFamily: 'Quantico-Italic', fontSize: '16px', color: '#8899aa'
        }).setOrigin(0, 0.5);
        container.add(flavorText);

        // Footer Payout Metrics (Pixel-Perfect Columnar Alignment)
        const canAfford = resourceManager.canAfford('data', target.cost);
        
        // 1. Cost Item (Column 1)
        const costLabel = PhaserScene.add.text(-270, 32, 'COST: ', {
            fontFamily: 'Quantico-Bold', fontSize: '14px', color: '#8899aa'
        }).setOrigin(0, 0.5);
        container.add(costLabel);
        
        const costVal = PhaserScene.add.text(-225, 32, `${target.cost} DATA`, {
            fontFamily: 'Quantico-Bold', fontSize: '16px', color: canAfford ? '#00f5ff' : '#ff5555'
        }).setOrigin(0, 0.5);
        container.add(costVal);

        // 2. Payout Item (Column 2)
        const payoutLabel = PhaserScene.add.text(-80, 32, 'PAYOUT: ', {
            fontFamily: 'Quantico-Bold', fontSize: '14px', color: '#8899aa'
        }).setOrigin(0, 0.5);
        container.add(payoutLabel);

        const rewardStr = takeoverTargets.formatReward(target.rewardType, target.rewardAmount);
        const rewardColor = takeoverTargets.getRewardColor(target.rewardType);
        const payoutVal = PhaserScene.add.text(-20, 32, rewardStr, {
            fontFamily: 'Quantico-Bold', fontSize: '16px', color: rewardColor
        }).setOrigin(0, 0.5);
        container.add(payoutVal);

        // 3. Duration Item (Column 3)
        const timeLabel = PhaserScene.add.text(160, 32, 'TIME: ', {
            fontFamily: 'Quantico-Bold', fontSize: '14px', color: '#8899aa'
        }).setOrigin(0, 0.5);
        container.add(timeLabel);

        const timeStr = helper.formatTime(target.duration);
        const timeVal = PhaserScene.add.text(205, 32, timeStr, {
            fontFamily: 'Quantico-Bold', fontSize: '16px', color: '#00f5ff'
        }).setOrigin(0, 0.5);
        container.add(timeVal);

        // Setup Hit Zone for interactions
        const hitZone = PhaserScene.add.zone(0, 0, w, h).setInteractive({ useHandCursor: true });
        container.add(hitZone);

        hitZone.on('pointerover', () => {
            cardGraphics.clear();
            drawNotchedCard(cardGraphics, 0, 0, w, h, true, false, difficultyColorHex);
        });

        hitZone.on('pointerout', () => {
            cardGraphics.clear();
            drawNotchedCard(cardGraphics, 0, 0, w, h, false, false, difficultyColorHex);
        });

        hitZone.on('pointerup', () => {
            onSelect(i, target);
        });

        return container;
    }

    // ── High-Fidelity Confirmation Modal Dialogue ──────────────────────────────

    /**
     * Create a modular confirmation dialog centered on screen.
     */
    function createConfirmPopup(PhaserScene, cx, cy, depthBase, target, onConfirm, onCancel) {
        const container = PhaserScene.add.container(cx, cy).setDepth(depthBase + 100).setScrollFactor(0);

        // 1. Dark dimmer overlay spanning exact popup panel
        const confirmDimmer = PhaserScene.add.image(0, 0, 'buttons', 'black_pixel.png')
            .setAlpha(0.65)
            .setDisplaySize(860, 680);
        container.add(confirmDimmer);

        // 2. Main Dialog Box Background Graphics
        const boxW = 460;
        const boxH = 220;
        const dialogGraphics = PhaserScene.add.graphics();
        container.add(dialogGraphics);

        // Draw notched/chamfered modal outline
        drawNotchedCard(dialogGraphics, 0, 0, boxW, boxH, false, true, 0x00f5ff);

        // Block background drag/clicks inside modal dialog
        const modalBlocker = PhaserScene.add.zone(0, 0, boxW, boxH).setInteractive();
        container.add(modalBlocker);

        // 3. Header Text
        const titleText = PhaserScene.add.text(0, -65, 'ESTABLISH DATA LINK', {
            fontFamily: 'Quantico-Bold', fontSize: '21px', color: '#00f5ff'
        }).setOrigin(0.5);
        container.add(titleText);

        // Body Description
        const bodyText = PhaserScene.add.text(0, -15, `Do you wish to initiate a cyber security breach against ${target.name}?\n\nThis transaction is irreversible.`, {
            fontFamily: 'Quantico-Regular', fontSize: '16px', color: '#ffffff', align: 'center', wordWrap: { width: 380 }
        }).setOrigin(0.5);
        container.add(bodyText);

        // Cost Indicator
        const costText = PhaserScene.add.text(0, 30, `DEBIT AMOUNT: ${target.cost} DATA`, {
            fontFamily: 'Quantico-Bold', fontSize: '15px', color: '#ff5555'
        }).setOrigin(0.5);
        container.add(costText);

        // 4. Action Buttons
        // [ CANCEL ] Button (Left)
        const cancelBtn = createConfirmVectorBtn(PhaserScene, -95, 75, 140, 36, 'CANCEL', 0xff5555, () => {
            container.destroy();
            onCancel();
        });
        container.add(cancelBtn);

        // [ CONFIRM ] Button (Right)
        const confirmBtn = createConfirmVectorBtn(PhaserScene, 95, 75, 140, 36, 'CONFIRM  >', 0x00f5ff, () => {
            container.destroy();
            onConfirm();
        });
        container.add(confirmBtn);

        return container;
    }

    /** Small helper for Confirmation Modal buttons */
    function createConfirmVectorBtn(PhaserScene, x, y, w, h, label, strokeColorHex, callback) {
        const container = PhaserScene.add.container(x, y);

        // Background hit area/visuals
        const hit = PhaserScene.add.zone(0, 0, w, h).setInteractive({ useHandCursor: true });
        container.add(hit);

        const graphics = PhaserScene.add.graphics();
        container.add(graphics);

        const drawState = (hover, press) => {
            graphics.clear();
            const alpha = press ? 0.9 : (hover ? 0.75 : 0.5);
            graphics.fillStyle(0x000000, alpha);
            graphics.fillRect(-w/2, -h/2, w, h);
            graphics.lineStyle(1.5, strokeColorHex, 0.8);
            graphics.strokeRect(-w/2, -h/2, w, h);
        };
        drawState(false, false);

        hit.on('pointerover', () => drawState(true, false));
        hit.on('pointerout', () => drawState(false, false));
        hit.on('pointerdown', () => drawState(true, true));
        hit.on('pointerup', () => {
            drawState(true, false);
            audio.play('click', 0.8);
            callback();
        });

        const text = PhaserScene.add.text(0, 0, label, {
            fontFamily: 'Quantico-Bold',
            fontSize: '15px',
            color: '#' + strokeColorHex.toString(16).padStart(6, '0'),
            align: 'center'
        }).setOrigin(0.5);
        container.add(text);

        return container;
    }

    return {
        drawNotchedCard,
        drawHexagonIcon,
        createTargetCard,
        createConfirmPopup
    };
})();
