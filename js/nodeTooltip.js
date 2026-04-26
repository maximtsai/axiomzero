/**
 * Singleton tooltip for Upgrade Tree nodes.
 * Reuses a single set of Phaser objects to avoid GC pressure.
 */
const nodeTooltip = (() => {
    let container = null;
    let bg = null;
    let nameT = null;
    let descT = null;
    let lvT = null;
    let maxT = null;
    let costT = null;
    let iconHolder = null;
    let iconSpr = null;
    let goldBg = null;
    let costBg = null;
    let animValue = { val: 0 };

    let currentNode = null;
    let lastShowTime = 0;
    const bgWidth = helper.isMobileDevice() ? 400 : 380;
    const depth = GAME_CONSTANTS.DEPTH_POPUPS;
 
    function _formatValue(node, val) {
        if (node.costType === 'coin') {
            // Coins are stored as integers (e.g. 10) but displayed at 0.1x (e.g. 1.0)
            return (val * 0.1).toFixed(1);
        }
        return Math.floor(val).toString();
    }

    function init() {
        if (container) return;

        container = PhaserScene.add.container(0, 0).setDepth(depth).setScrollFactor(0).setVisible(false);

        bg = PhaserScene.add.image(0, 0, 'white_pixel').setOrigin(0.5, 0).setTint(0x182035).setAlpha(0.86);
        container.add(bg);

        // Icon holder
        iconHolder = PhaserScene.add.image(0, 0, 'buttons', 'icon_holder.png');
        iconSpr = PhaserScene.add.sprite(0, 0, 'buttons', 'Skillicon14_01.png').setDisplaySize(26, 26);
        container.add([iconHolder, iconSpr]);

        nameT = PhaserScene.add.text(0, 0, '', {
            fontFamily: 'VCR',
            fontSize: '26px', // Initial size doesn't matter much as it is now set in show()
            color: '#ffffff',
            align: 'left',
            shadow: { offsetX: 1, offsetY: 1, color: '#000000', blur: 2, fill: true }
        }).setOrigin(0, 0.5);
        container.add(nameT);

        descT = PhaserScene.add.rexBBCodeText(0, 0, '', {
            fontFamily: 'VCR',
            fontSize: '26px',
            color: '#ffffff',
            align: 'center',
            wrap: { mode: 'word', width: helper.isMobileDevice() ? 375 : 355 },
            lineSpacing: 5,
            shadow: { offsetX: 1, offsetY: 1, color: '#000000', blur: 2, fill: true }
        }).setOrigin(0.5, 0);
        container.add(descT);

        lvT = PhaserScene.add.text(0, 0, '', {
            fontFamily: 'VCR',
            fontSize: '26px',
            color: '#ffffff',
            align: 'center',
            shadow: { offsetX: 1, offsetY: 1, color: '#000000', blur: 2, fill: true }
        }).setOrigin(0.5, 0);
        container.add(lvT);

        goldBg = PhaserScene.add.image(0, 0, 'pixels', 'gold_pixel.png').setDisplaySize(bgWidth - 6, 37);
        maxT = PhaserScene.add.text(0, 0, t('tooltips', 'max'), {
            fontFamily: 'VCR',
            fontSize: '26px',
            color: '#ffffff',
            align: 'center',
        }).setOrigin(0.5, 0.5);
        container.add([goldBg, maxT]);

        costBg = PhaserScene.add.image(0, 0, 'pixels', 'dark_green_pixel.png').setDisplaySize(bgWidth - 6, 37);
        costT = PhaserScene.add.text(0, 0, '', {
            fontFamily: 'VCR',
            fontSize: '26px',
            color: '#ffffff',
            align: 'center',
        }).setOrigin(0.5, 0.5);
        container.add([costBg, costT]);

        // Tooltip is a global UI element; it should NOT be added to tree groups
        // to avoid being clipped by the tree mask.
    }

    function _clearTweens() {
        if (!container) return;
        PhaserScene.tweens.killTweensOf([container, lvT, maxT, costT, animValue]);
        // Reset scale/angle but NOT Y (Y is handled by layout)
        container.setScale(1).setAngle(0);
        lvT.setScale(1);
        maxT.setScale(1);
        costT.setScale(1).setAlpha(1);
    }

    function show(node, isPurchaseRefresh = false, purchaseCost = 0) {
        if (!container) init();
        _clearTweens();

        if (currentNode !== node) {
            lastShowTime = Date.now();
            if (!isPurchaseRefresh) {
                const s = audio.play('click', 0.85 + Math.random() * 0.15);
                if (s) s.detune = Phaser.Math.Between(-70, 70);
            }
        }

        currentNode = node;
        container.setVisible(true);

        const isBigValue = gameState.settings.bigFont;
        const baseW = helper.isMobileDevice() ? 400 : 380;
        const currentBgWidth = (isBigValue ? baseW + 50 : baseW) + (node.tooltipExtraWidth || 0);
        const currentWordWrap = currentBgWidth - 25;
        const baseFontSize = isBigValue ? 30 : 26;
        const nameFontSize = isBigValue ? 36 : 32;

        nameT.setFontSize(nameFontSize + 'px');
        descT.setFontSize(baseFontSize + 'px');
        lvT.setFontSize(baseFontSize + 'px');
        maxT.setFontSize(baseFontSize + 'px');
        costT.setFontSize(baseFontSize + 'px');

        // Update wrap width for description
        if (descT.setWrapWidth) {
            descT.setWrapWidth(currentWordWrap);
        } else if (descT.setWordWrapWidth) {
            descT.setWordWrapWidth(currentWordWrap);
        }

        // Update background elements display sizes
        const barHeight = isBigValue ? 37 : 35;
        goldBg.setDisplaySize(currentBgWidth - 6, barHeight);
        costBg.setDisplaySize(currentBgWidth - 6, barHeight);

        const rowSpacing = isBigValue ? 10 : 7;
        const lineSpacingValue = isBigValue ? 7 : 4;
        descT.setLineSpacing(lineSpacingValue);

        let currentY = 3;

        // Row 1: Icon & Name
        const iconOffset = node.icon ? 56 : 0;
        const nameTextStr = node.name.toUpperCase();
        nameT.setText(nameTextStr);

        const titleWidth = nameT.width + iconOffset;
        const titleStartX = -titleWidth / 2;
        const centerTitleY = currentY + 19;

        if (node.icon) {
            iconHolder.setVisible(true).setPosition(titleStartX + 22, centerTitleY);
            iconSpr.setVisible(true).setFrame(node.icon).setPosition(titleStartX + 22, centerTitleY);
        } else {
            iconHolder.setVisible(false);
            iconSpr.setVisible(false);
        }

        nameT.setPosition(titleStartX + iconOffset, centerTitleY);
        currentY += 44 + rowSpacing;

        // Row 2: Description
        descT.setText(node.description).setPosition(0, currentY - 5);
        currentY += descT.height + rowSpacing;

        // Row 3: Level (skip for duo-box nodes — always 1/1)
        if (node.isDuoBox) {
            lvT.setVisible(false);
        } else {
            lvT.setVisible(true);
            lvT.setText('Lv. ' + node.level + ' / ' + node.maxLevel).setPosition(0, currentY - 2);
            currentY += lvT.height + 7;
        }

        // Row 4: Cost, MAX, ACTIVE, or SWAP
        const isDuoActive = node.isDuoBox && gameState.duoBoxPurchased && gameState.duoBoxPurchased[node.duoBoxTier];
        const isThisNodeActive = isDuoActive && gameState.activeShards[node.duoBoxTier] === node.shardId;
        const isSwappable = isDuoActive && !isThisNodeActive;

        if (node.state === NODE_STATE.MAXED || isThisNodeActive) {
            goldBg.setVisible(true).setPosition(0, currentY + 20);
            maxT.setVisible(true).setPosition(0, currentY + 18); // was 15, moving up with others or keeping relative to background?
            maxT.setText(isThisNodeActive ? t('tooltips', 'active') : t('tooltips', 'max'));
            costBg.setVisible(false);
            costT.setVisible(false);
            currentY += 39;
        } else if (isSwappable) {
            goldBg.setVisible(false);
            maxT.setVisible(false);
            costBg.setVisible(true).setPosition(0, currentY + 20);
            costBg.setTexture('pixels', 'dark_green_pixel.png');
            costT.setVisible(true).setPosition(0, currentY + 18);
            costT.setText(t('tooltips', 'swap'));
            costT.setColor('#ffffff');
            currentY += 39;
        } else {
            goldBg.setVisible(false);
            maxT.setVisible(false);
            costBg.setVisible(true).setPosition(0, currentY + 20);
            costT.setVisible(true).setPosition(0, currentY + 18);

            const bgPixel = node.canAfford() ? 'dark_green_pixel.png' : 'dark_red_pixel.png';
            costBg.setTexture('pixels', bgPixel);

            let iconStr, currentRes;
            if (node.costType === 'shard') {
                iconStr = '◆';
                currentRes = resourceManager.getShards();
            } else if (node.costType === 'insight') {
                iconStr = '◐';
                currentRes = resourceManager.getInsight();
            } else if (node.costType === 'coin') {
                iconStr = 'ⓒ';
                currentRes = resourceManager.getCoins();
            } else if (node.costType === 'processor') {
                iconStr = '■';
                currentRes = resourceManager.getProcessors();
            } else {
                iconStr = '◈';
                currentRes = resourceManager.getData();
            }
            if (isPurchaseRefresh && purchaseCost > 0) {
                const targetRes = currentRes;
                animValue.val = targetRes + purchaseCost;
                costT.setText('\n' + iconStr + ' ' + _formatValue(node, animValue.val) + ' / ' + _formatValue(node, node.getCost()) + '\n');
                let calcDur = 250 + Math.floor(Math.sqrt(purchaseCost) * 5);
                PhaserScene.tweens.add({
                    targets: animValue,
                    val: targetRes,
                    duration: calcDur,
                    ease: 'Quad.easeOut',
                    onUpdate: () => {
                        // Check if node is still the current one to avoid updating stale tooltips
                        if (currentNode === node && costT.visible) {
                            costT.setText('\n' + iconStr + ' ' + _formatValue(node, animValue.val) + ' / ' + _formatValue(node, node.getCost()) + '\n');
                        }
                    }
                });
            } else {
                costT.setText('\n' + iconStr + ' ' + _formatValue(node, currentRes) + ' / ' + _formatValue(node, node.getCost()) + '\n');
            }

            let costColor = '#30ffff';
            if (node.costType === 'insight') costColor = '#f0f0f0';
            else if (node.costType === 'processor') costColor = '#ffe600';
            else if (node.costType === 'shard') costColor = '#ff2d78';
            else if (node.costType === 'coin') costColor = '#00ff66';
            costT.setColor(costColor);

            currentY += 39;
        }

        const totalHeight = currentY + 3;
        bg.setDisplaySize(currentBgWidth, totalHeight);

        // Use getBounds() to account for parent container transforms (e.g. treeMaskContainer shifts)
        const btnBounds = node.btn.getBounds();
        const centerX = btnBounds.centerX;
        const centerY = btnBounds.centerY;

        // Position above the node (Duo nodes appear 56px higher)
        // Check for top-of-screen intersection to flip position if needed
        const nodeHeight = node.size || 80;
        const verticalOffset = node.isDuoBox ? 52 : 26;
        const topSafeMargin = 15;

        let showAbove = true;
        if (centerY - verticalOffset - totalHeight < topSafeMargin) {
            showAbove = false;
        }

        let horizontalOffset = 0;
        if (node.isDuoBox) {
            const side = node._getDuoSide();
            if (side === 'left') horizontalOffset = 16;
            else if (side === 'right') horizontalOffset = -16;
        }

        // Clamp X position to stay within the leftpanel bounds
        let targetX = centerX + horizontalOffset;
        const halfW = currentBgWidth / 2;
        const margin = 10;
        targetX = Math.max(targetX, halfW + margin);

        // Final container position and child alignment
        if (showAbove) {
            container.setPosition(targetX, centerY - verticalOffset);
            bg.y = -totalHeight;
            container.iterate(child => {
                if (child === bg) return;
                child.y -= totalHeight;
            });
        } else {
            // Position below the node
            container.setPosition(targetX, centerY + verticalOffset + 1);
            bg.y = 0;
            // Children are already relative to container top (Y=3), so no further shift needed
        }

        // Animations
        if (!isPurchaseRefresh) {
            container.setScale(0.8, 1.1).setAngle(6);
            PhaserScene.tweens.add({
                targets: container,
                scaleX: 1.11, scaleY: 0.95, angle: -3, y: container.y,
                duration: 100, ease: 'Quart.easeOut',
                onComplete: () => {
                    PhaserScene.tweens.add({
                        targets: container,
                        scaleX: 1, scaleY: 1, angle: 0,
                        easeParams: [3],
                        duration: 175, ease: 'Back.easeOut'
                    });
                }
            });
        } else {
            const targets = [lvT, (node.state === NODE_STATE.MAXED ? maxT : costT)];
            targets.forEach(t => {
                t.setScale(0.78, 1);
                PhaserScene.tweens.add({ targets: t, scaleX: 1, duration: 440, easeParams: [3], ease: 'Back.easeOut' });
            });
        }
    }

    function hide() {
        if (container) {
            _clearTweens();
            container.setVisible(false);
        }
        currentNode = null;
    }

    function shakeCost() {
        if (!container || !costT.visible) return;
        _clearTweens();
        const origX = costT.x;
        costT.x = origX - 5;
        PhaserScene.tweens.add({
            targets: costT,
            x: origX + 5, duration: 50, yoyo: true, repeat: 3,
            onComplete: () => { costT.x = origX; }
        });
    }

    function isVisible() { return container && container.visible; }
    function getCurrentNode() { return currentNode; }
    function getShowAge() { return Date.now() - lastShowTime; }

    return { init, show, hide, shakeCost, isVisible, getCurrentNode, getShowAge };
})();
