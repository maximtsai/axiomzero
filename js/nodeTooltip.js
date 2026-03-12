/**
 * Singleton tooltip for Neural Tree nodes.
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
    let iconWhiteBg = null;
    let iconBlackBg = null;
    let iconSpr = null;
    let goldBg = null;
    let costBg = null;

    let currentNode = null;
    let lastShowTime = 0;
    const bgWidth = 280;
    const depth = GAME_CONSTANTS.DEPTH_POPUPS;

    function init() {
        if (container) return;

        container = PhaserScene.add.container(0, 0).setDepth(depth).setScrollFactor(0).setVisible(false);

        bg = PhaserScene.add.image(0, 0, 'white_pixel').setOrigin(0.5, 0).setTint(0x111122).setAlpha(0.92);
        container.add(bg);

        // Icon elements
        iconWhiteBg = PhaserScene.add.image(0, 0, 'pixels', 'white_pixel.png').setDisplaySize(34, 34);
        iconBlackBg = PhaserScene.add.image(0, 0, 'pixels', 'black_pixel.png').setDisplaySize(30, 30);
        iconSpr = PhaserScene.add.sprite(0, 0, 'buttons', 'Skillicon14_01.png').setDisplaySize(26, 26);
        container.add([iconWhiteBg, iconBlackBg, iconSpr]);

        nameT = PhaserScene.add.text(0, 0, '', {
            fontFamily: 'VCR',
            fontSize: '22px',
            color: '#ffffff',
            align: 'left',
        }).setOrigin(0, 0.5);
        container.add(nameT);

        descT = PhaserScene.add.text(0, 0, '', {
            fontFamily: 'VCR',
            fontSize: '22px',
            color: '#ffffff',
            align: 'center',
            wordWrap: { width: 255 },
            lineSpacing: 4,
        }).setOrigin(0.5, 0);
        container.add(descT);

        lvT = PhaserScene.add.text(0, 0, '', {
            fontFamily: 'VCR',
            fontSize: '22px',
            color: '#ffffff',
            align: 'center',
        }).setOrigin(0.5, 0);
        container.add(lvT);

        goldBg = PhaserScene.add.image(0, 0, 'pixels', 'gold_pixel.png').setDisplaySize(bgWidth - 6, 26);
        maxT = PhaserScene.add.text(0, 0, 'MAX', {
            fontFamily: 'VCR',
            fontSize: '22px',
            color: '#ffffff',
            align: 'center',
        }).setOrigin(0.5, 0.5);
        container.add([goldBg, maxT]);

        costBg = PhaserScene.add.image(0, 0, 'pixels', 'dark_green_pixel.png').setDisplaySize(bgWidth - 6, 26);
        costT = PhaserScene.add.text(0, 0, '', {
            fontFamily: 'VCR',
            fontSize: '22px',
            color: '#ffffff',
            align: 'center',
        }).setOrigin(0.5, 0.5);
        container.add([costBg, costT]);

        // Add to tree groups if available
        const treeGroup = neuralTree.getGroup();
        const draggableGroup = neuralTree.getDraggableGroup();
        if (treeGroup) treeGroup.add(container);
        if (draggableGroup) draggableGroup.add(container);
    }

    function _clearTweens() {
        if (!container) return;
        PhaserScene.tweens.killTweensOf([container, lvT, maxT, costT]);
        // Reset scale/angle but NOT Y (Y is handled by layout)
        container.setScale(1).setAngle(0);
        lvT.setScale(1);
        maxT.setScale(1);
        costT.setScale(1).setAlpha(1);
    }

    function show(node, isPurchaseRefresh = false) {
        if (!container) init();
        _clearTweens();

        if (currentNode !== node) {
            lastShowTime = Date.now();
        }

        currentNode = node;
        container.setVisible(true);

        const rowSpacing = 10;
        let currentY = 3;

        // Row 1: Icon & Name
        const iconOffset = node.icon ? 44 : 0;
        const nameTextStr = node.name.toUpperCase();
        nameT.setText(nameTextStr);

        const titleWidth = nameT.width + iconOffset;
        const titleStartX = -titleWidth / 2;
        const centerTitleY = currentY + 17;

        if (node.icon) {
            iconWhiteBg.setVisible(true).setPosition(titleStartX + 17, centerTitleY);
            iconBlackBg.setVisible(true).setPosition(titleStartX + 17, centerTitleY);
            iconSpr.setVisible(true).setFrame(node.icon).setPosition(titleStartX + 17, centerTitleY);
        } else {
            iconWhiteBg.setVisible(false);
            iconBlackBg.setVisible(false);
            iconSpr.setVisible(false);
        }

        nameT.setPosition(titleStartX + iconOffset, centerTitleY);
        currentY += 34 + rowSpacing;

        // Row 2: Description
        descT.setText(node.description).setPosition(0, currentY);
        currentY += descT.height + rowSpacing;

        // Row 3: Level (skip for duo-box nodes — always 1/1)
        if (node.isDuoBox) {
            lvT.setVisible(false);
        } else {
            lvT.setVisible(true);
            lvT.setText('Lv. ' + node.level + ' / ' + node.maxLevel).setPosition(0, currentY);
            currentY += lvT.height + 7;
        }

        // Row 4: Cost, MAX, ACTIVE, or SWAP
        const isDuoActive = node.isDuoBox && gameState.duoBoxPurchased && gameState.duoBoxPurchased[node.duoBoxTier];
        const isThisNodeActive = isDuoActive && gameState.activeShards[node.duoBoxTier] === node.shardId;
        const isSwappable = isDuoActive && !isThisNodeActive;

        if (node.state === NODE_STATE.MAXED || isThisNodeActive) {
            goldBg.setVisible(true).setPosition(0, currentY + 13);
            maxT.setVisible(true).setPosition(0, currentY + 13);
            maxT.setText(isThisNodeActive ? 'ACTIVE' : 'MAX');
            costBg.setVisible(false);
            costT.setVisible(false);
            currentY += 26;
        } else if (isSwappable) {
            goldBg.setVisible(false);
            maxT.setVisible(false);
            costBg.setVisible(true).setPosition(0, currentY + 13);
            costBg.setTexture('pixels', 'dark_green_pixel.png');
            costT.setVisible(true).setPosition(0, currentY + 13);
            costT.setText('CLICK TO SWAP');
            costT.setColor('#ffffff');
            currentY += 26;
        } else {
            goldBg.setVisible(false);
            maxT.setVisible(false);
            costBg.setVisible(true).setPosition(0, currentY + 13);
            costT.setVisible(true).setPosition(0, currentY + 13);

            const bgPixel = node.canAfford() ? 'dark_green_pixel.png' : 'dark_red_pixel.png';
            costBg.setTexture('pixels', bgPixel);

            let iconStr, currentRes;
            if (node.costType === 'shard') {
                iconStr = '◆';
                currentRes = resourceManager.getShards();
            } else if (node.costType === 'insight') {
                iconStr = '⦵';
                currentRes = resourceManager.getInsight();
            } else {
                iconStr = '◈';
                currentRes = resourceManager.getData();
            }
            costT.setText(iconStr + ' ' + Math.floor(currentRes) + ' / ' + node.getCost());

            let costColor = '#30ffff';
            if (node.costType === 'insight') costColor = '#ff9500';
            else if (node.costType === 'processor') costColor = '#ffe600';
            else if (node.costType === 'shard') costColor = '#ff2d78';
            else if (node.costType === 'coin') costColor = '#00ff66';
            costT.setColor(costColor);

            currentY += 26;
        }

        const totalHeight = currentY + 3;
        bg.setDisplaySize(bgWidth, totalHeight);

        // Position above the node (Duo nodes appear 20px higher)
        const verticalOffset = node.isDuoBox ? 58 : 23;
        let horizontalOffset = 0;
        if (node.isDuoBox) {
            const side = node._getDuoSide();
            if (side === 'left') horizontalOffset = -7;
            else if (side === 'right') horizontalOffset = 7;
        }

        container.setPosition(node.btn.x + horizontalOffset, node.btn.y - verticalOffset);

        // RESET AND SHIFT: First reset Y and children to 0, then shift so (0,0) is bottom-center
        // This is necessary because of the singleton pattern (reuse)
        bg.y = -totalHeight;
        container.iterate(child => {
            if (child === bg) return;
            // Since elements were positioned starting at Y=3, we don't need to reset
            // their specific currentY, we just need to subtract totalHeight FROM their
            // calculated positions.
            child.y -= totalHeight;
        });

        // Animations
        if (!isPurchaseRefresh) {
            container.setScale(0.75).setAngle(6);
            PhaserScene.tweens.add({
                targets: container,
                scaleX: 1.05, scaleY: 1.05, angle: -3,
                duration: 100, ease: 'Cubic.easeOut',
                onComplete: () => {
                    PhaserScene.tweens.add({
                        targets: container,
                        scaleX: 1, scaleY: 1, angle: 0,
                        duration: 200, ease: 'Back.easeOut'
                    });
                }
            });
        } else {
            const targets = [lvT, (node.state === NODE_STATE.MAXED ? maxT : costT)];
            targets.forEach(t => {
                t.setScale(0.82, 1);
                PhaserScene.tweens.add({ targets: t, scaleX: 1, duration: 400, ease: 'Back.easeOut' });
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
        PhaserScene.tweens.add({
            targets: costT,
            x: origX + 8, duration: 50, yoyo: true, repeat: 3,
            onComplete: () => { costT.x = origX; }
        });
    }

    function isVisible() { return container && container.visible; }
    function getCurrentNode() { return currentNode; }
    function getShowAge() { return Date.now() - lastShowTime; }

    return { init, show, hide, shakeCost, isVisible, getCurrentNode, getShowAge };
})();
