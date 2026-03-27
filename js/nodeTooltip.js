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
    let iconHolder = null;
    let iconSpr = null;
    let goldBg = null;
    let costBg = null;
    let animValue = { val: 0 };

    let currentNode = null;
    let lastShowTime = 0;
    const bgWidth = 280;
    const depth = GAME_CONSTANTS.DEPTH_POPUPS;

    function init() {
        if (container) return;

        container = PhaserScene.add.container(0, 0).setDepth(depth).setScrollFactor(0).setVisible(false);

        bg = PhaserScene.add.image(0, 0, 'white_pixel').setOrigin(0.5, 0).setTint(0x111122).setAlpha(0.82);
        container.add(bg);

        // Icon holder
        iconHolder = PhaserScene.add.image(0, 0, 'buttons', 'icon_holder.png');
        iconSpr = PhaserScene.add.sprite(0, 0, 'buttons', 'Skillicon14_01.png').setDisplaySize(26, 26);
        container.add([iconHolder, iconSpr]);

        nameT = PhaserScene.add.text(0, 0, '', {
            fontFamily: 'VCR',
            fontSize: '22px',
            color: '#ffffff',
            align: 'left',
            shadow: { offsetX: 1, offsetY: 1, color: '#000000', blur: 2, fill: true }
        }).setOrigin(0, 0.5);
        container.add(nameT);

        descT = PhaserScene.add.text(0, 0, '', {
            fontFamily: 'VCR',
            fontSize: '22px',
            color: '#ffffff',
            align: 'center',
            wordWrap: { width: 255 },
            lineSpacing: 4,
            shadow: { offsetX: 1, offsetY: 1, color: '#000000', blur: 2, fill: true }
        }).setOrigin(0.5, 0);
        container.add(descT);

        lvT = PhaserScene.add.text(0, 0, '', {
            fontFamily: 'VCR',
            fontSize: '22px',
            color: '#ffffff',
            align: 'center',
            shadow: { offsetX: 1, offsetY: 1, color: '#000000', blur: 2, fill: true }
        }).setOrigin(0.5, 0);
        container.add(lvT);

        goldBg = PhaserScene.add.image(0, 0, 'pixels', 'gold_pixel.png').setDisplaySize(bgWidth - 6, 26);
        maxT = PhaserScene.add.text(0, 0, t('tooltips', 'max'), {
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

        const currentBgWidth = 280 + (node.tooltipExtraWidth || 0);
        const currentWordWrap = currentBgWidth - 25;

        // Update word wrap for description
        descT.setWordWrapWidth(currentWordWrap);

        // Update background elements display sizes
        goldBg.setDisplaySize(currentBgWidth - 6, 26);
        costBg.setDisplaySize(currentBgWidth - 6, 26);

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
            iconHolder.setVisible(true).setPosition(titleStartX + 17, centerTitleY);
            iconSpr.setVisible(true).setFrame(node.icon).setPosition(titleStartX + 17, centerTitleY);
        } else {
            iconHolder.setVisible(false);
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
            maxT.setText(isThisNodeActive ? t('tooltips', 'active') : t('tooltips', 'max'));
            costBg.setVisible(false);
            costT.setVisible(false);
            currentY += 26;
        } else if (isSwappable) {
            goldBg.setVisible(false);
            maxT.setVisible(false);
            costBg.setVisible(true).setPosition(0, currentY + 13);
            costBg.setTexture('pixels', 'dark_green_pixel.png');
            costT.setVisible(true).setPosition(0, currentY + 13);
            costT.setText(t('tooltips', 'swap'));
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
                costT.setText(iconStr + ' ' + Math.floor(animValue.val) + ' / ' + node.getCost());
                let calcDur = 250 + Math.floor(Math.sqrt(purchaseCost) * 5);
                PhaserScene.tweens.add({
                    targets: animValue,
                    val: targetRes,
                    duration: calcDur,
                    ease: 'Quad.easeOut',
                    onUpdate: () => {
                        // Check if node is still the current one to avoid updating stale tooltips
                        if (currentNode === node && costT.visible) {
                            costT.setText(iconStr + ' ' + Math.floor(animValue.val) + ' / ' + node.getCost());
                        }
                    }
                });
            } else {
                costT.setText(iconStr + ' ' + Math.floor(currentRes) + ' / ' + node.getCost());
            }

            let costColor = '#30ffff';
            if (node.costType === 'insight') costColor = '#ff9500';
            else if (node.costType === 'processor') costColor = '#ffe600';
            else if (node.costType === 'shard') costColor = '#ff2d78';
            else if (node.costType === 'coin') costColor = '#00ff66';
            costT.setColor(costColor);

            currentY += 26;
        }

        const totalHeight = currentY + 3;
        bg.setDisplaySize(currentBgWidth, totalHeight);

        // Position above the node (Duo nodes appear 20px higher)
        const verticalOffset = node.isDuoBox ? 56 : 21;
        let horizontalOffset = 0;
        if (node.isDuoBox) {
            const side = node._getDuoSide();
            if (side === 'left') horizontalOffset = 16;
            else if (side === 'right') horizontalOffset = -16;
        }

        // Clamp X position to stay within the 800px Neural Tree panel bounds
        let targetX = node.btn.x + horizontalOffset;
        const halfW = currentBgWidth / 2;
        const margin = 10;
        targetX = Math.max(targetX, halfW + margin);
        // targetX = Math.min(targetX, 800 - halfW - margin); // Right clamp removed per user request

        // TODO: if hover popup gets cut off from the top (.ie we are hovering over a node near the top of the screen), instead render it below the node.
        container.setPosition(targetX, node.btn.y - verticalOffset);

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
            container.setScale(0.75, 1.1).setAngle(6);
            PhaserScene.tweens.add({
                targets: container,
                scaleX: 1.11, scaleY: 0.95, angle: -2, y: node.btn.y - verticalOffset,
                duration: 95, ease: 'Quart.easeOut',
                onComplete: () => {
                    PhaserScene.tweens.add({
                        targets: container,
                        scaleX: 1, scaleY: 1, angle: 0,
                        duration: 180, ease: 'Back.easeOut'
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
