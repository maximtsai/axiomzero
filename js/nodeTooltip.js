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
    let leakBg = null;
    let leakT = null;
    let bgEdges = null;
    let animValue = { val: 0 };
    let isReady = false;
    let costGlitchTimers = [];

    let currentNode = null;
    let lastShowTime = 0;
    let lastGlitchTime = 0;
    const bgWidth = helper.isMobileDevice() ? 398 : 378;
    const depth = GAME_CONSTANTS.DEPTH_POPUPS;

    function _formatValue(node, val) {
        if (node.costType === 'coin') {
            // Coins are stored as integers but displayed at 0.01x (e.g. 100 = 1.0)
            // to make them feel more valuable/dense while keeping math simple.
            return parseFloat((val * 0.01).toFixed(2)).toString();
        }
        return Math.floor(val).toString();
    }

    function _getCostColor(type) {
        if (type === 'insight') return '#f0f0f0';
        if (type === 'processor') return '#ffe600';
        if (type === 'shard') return '#f4f4f4';
        if (type === 'coin') return '#00ff66';
        return '#30ffff'; // data
    }

    function _updateCostText(node, value) {
        if (!node || !costT) return null;

        let iconStr = '◈';
        if (node.costType === 'shard') iconStr = '◆';
        else if (node.costType === 'insight') iconStr = '◐';
        else if (node.costType === 'coin') iconStr = 'ⓒ';
        else if (node.costType === 'processor') iconStr = '■';

        let currentRes = 0;
        if (resourceManager) {
            if (node.costType === 'shard') currentRes = resourceManager.getShards();
            else if (node.costType === 'insight') currentRes = resourceManager.getInsight();
            else if (node.costType === 'coin') currentRes = resourceManager.getCoins();
            else if (node.costType === 'processor') currentRes = resourceManager.getProcessors();
            else currentRes = resourceManager.getData();
        }

        const formattedRes = _formatValue(node, value !== undefined ? value : currentRes);
        const formattedCost = _formatValue(node, node.getCost());

        costT.setText(`${iconStr} ${formattedRes} / ${formattedCost}`);
        costT.setColor(_getCostColor(node.costType));

        return { iconStr, formattedRes, formattedCost };
    }

    function _getRandomChar() {
        const chars = '123456789!@#$%^&*()=+?';
        return chars.charAt(Math.floor(Math.random() * chars.length));
    }

    function _startCostGlitch(parts) {
        if (!parts || !costT) return;
        _clearGlitchTimers();

        const { iconStr, formattedRes, formattedCost } = parts;
        const len = formattedCost.length;

        const setGlitchText = (glitchedPart) => {
            if (costT && currentNode) costT.setText(`${iconStr} ${formattedRes} / ${glitchedPart}`);
        };

        // Phase 1: All random (0ms)
        let p1 = "";
        for (let i = 0; i < len; i++) p1 += _getRandomChar();
        setGlitchText(p1);

        // Phase 2: Randomize again after 25ms
        costGlitchTimers.push(setTimeout(() => {
            let p2 = "";
            for (let i = 0; i < len; i++) p2 += _getRandomChar();
            setGlitchText(p2);
        }, 90));

        // Phase 3: Leftmost correct, others random after 50ms
        costGlitchTimers.push(setTimeout(() => {
            let p3 = formattedCost.charAt(0);
            for (let i = 1; i < len; i++) p3 += _getRandomChar();
            setGlitchText(p3);
        }, 140));

        // Phase 4: All correct after 75ms
        costGlitchTimers.push(setTimeout(() => {
            setGlitchText(formattedCost);
        }, 200));
    }

    function _clearGlitchTimers() {
        costGlitchTimers.forEach(t => clearTimeout(t));
        costGlitchTimers = [];
    }

    function init() {
        if (container) return;

        container = PhaserScene.add.container(0, 0).setDepth(depth).setScrollFactor(0).setVisible(false);
        container.isTreeElement = true; // Allow treeCamera to render it so it appears on top of nodes

        // Edges sit below the backing
        bgEdges = PhaserScene.add.nineslice(0, 0, 'buttons', 'duo_hover_popup_edges.png', 100, 100, 52, 52, 52, 52).setOrigin(0.5, 0).setAlpha(1);
        container.add(bgEdges);

        bg = PhaserScene.add.image(0, 0, 'buttons', 'navy_pixel.png').setOrigin(0.5, 0).setAlpha(0.93);
        container.add(bg);

        // Icon holder
        iconHolder = PhaserScene.add.image(0, 0, 'buttons', 'icon_holder.png');
        iconSpr = PhaserScene.add.image(0, 0, 'buttons', 'Skillicon14_01.png').setDisplaySize(26, 26);
        container.add([iconHolder, iconSpr]);

        nameT = PhaserScene.add.text(0, 0, '', {
            fontFamily: 'Quantico-Bold',
            fontSize: '26px', // Initial size doesn't matter much as it is now set in show()
            color: '#ffffff',
            align: 'left',
            shadow: { offsetX: 1, offsetY: 1, color: '#000000', blur: 2, fill: true }
        }).setOrigin(0, 0.5);
        container.add(nameT);

        descT = PhaserScene.add.rexBBCodeText(0, 0, '', {
            fontFamily: 'Quantico-Regular',
            fontSize: '26px',
            color: '#ffffff',
            align: 'center',
            wrap: { mode: 'word', width: helper.isMobileDevice() ? 375 : 355 },
            lineSpacing: 5,
            shadow: { offsetX: 1, offsetY: 1, color: '#000000', blur: 2, fill: true }
        }).setOrigin(0.5, 0);
        container.add(descT);

        lvT = PhaserScene.add.text(0, 0, '', {
            fontFamily: 'Quantico-Regular',
            fontSize: '26px',
            color: '#d0d0d0',
            align: 'center',
            shadow: { offsetX: 1, offsetY: 1, color: '#000000', blur: 2, fill: true }
        }).setOrigin(0.5, 0);
        container.add(lvT);

        goldBg = PhaserScene.add.image(0, 0, 'buttons', 'gold_pixel.png').setDisplaySize(bgWidth - 6, 37);
        maxT = PhaserScene.add.text(0, 0, t('tooltips', 'max'), {
            fontFamily: 'Quantico-Bold',
            fontSize: '26px',
            color: '#ffffff',
            align: 'center',
        }).setOrigin(0.5, 0.5);
        container.add([goldBg, maxT]);

        costBg = PhaserScene.add.image(0, 0, 'buttons', 'dark_green_pixel.png').setDisplaySize(bgWidth - 6, 37);
        costT = PhaserScene.add.text(0, 0, '', {
            fontFamily: 'Quantico-Bold',
            fontSize: '26px',
            color: '#ffffff',
            align: 'center',
            shadow: { offsetX: 1, offsetY: 1, color: '#000000', blur: 2, fill: true }
        }).setOrigin(0.5, 0.5);
        container.add([costBg, costT]);

        leakBg = PhaserScene.add.image(0, 0, 'buttons', 'memory_leak_bg.png');
        leakT = PhaserScene.add.text(0, 0, 'MEMORY LEAK', {
            fontFamily: 'Quantico-Bold',
            fontSize: '26px',
            color: '#000000',
            align: 'center',
        }).setOrigin(0.5, 0.5);
        container.add([leakBg, leakT]);

        // Tooltip is a global UI element; it should NOT be added to tree groups
        // to avoid being clipped by the tree mask.

        // Route tooltip to global UI camera so it renders exactly on top
        if (typeof upgradeTree !== 'undefined' && upgradeTree.assignToUICamera) {
            upgradeTree.assignToUICamera(container);
            container.list.forEach(child => upgradeTree.assignToUICamera(child));
        }
    }

    function _clearTweens() {
        if (!container) return;
        _clearGlitchTimers();
        PhaserScene.tweens.killTweensOf([container, lvT, maxT, costT, animValue]);
        // Reset scale/angle but NOT Y (Y is handled by layout)
        container.setScale(1).setAngle(0);
        lvT.setScale(1);
        maxT.setScale(1);
        costT.setScale(1).setAlpha(1);
        leakT.setScale(1).setAlpha(1);
    }

    function show(node, isPurchaseRefresh = false, purchaseCost = 0) {
        if (!container) init();
        _clearTweens();
        isReady = isPurchaseRefresh; // If refreshing, it's already ready. Otherwise, wait for tween.

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
        const baseW = helper.isMobileDevice() ? 398 : 378;
        let currentBgWidth = (isBigValue ? baseW + 50 : baseW) + (node.tooltipExtraWidth || 0);

        const baseFontSize = isBigValue ? 30 : 26;
        const nameFontSize = isBigValue ? 36 : 32;

        nameT.setFontSize(nameFontSize + 'px');
        nameT.setText(node.name.toUpperCase());

        const iconOffset = node.icon ? 53 : 0;
        const titleWidth = nameT.width + iconOffset;

        // Auto-expand if title (+ buffer) exceeds default width
        if (titleWidth + 8 > currentBgWidth) {
            currentBgWidth = titleWidth + 8;
        }

        const currentWordWrap = currentBgWidth - 25;

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
        goldBg.setDisplaySize(currentBgWidth - 10, barHeight);
        costBg.setDisplaySize(currentBgWidth - 10, barHeight);

        const bgTexture = node.isDuoBox ? 'black_pixel.png' : 'navy_pixel.png';
        bg.setFrame(bgTexture);

        if (node.isDuoBox) {
            bgEdges.setFrame('duo_hover_popup_edges.png');
        } else {
            bgEdges.setFrame('normal_hover_popup_edges.png');
        }
        bgEdges.setAlpha(1);
        bg.setOrigin(0.5, 0);
        bgEdges.setOrigin(0.5, 0);

        const rowSpacing = isBigValue ? 10 : 7;
        const lineSpacingValue = isBigValue ? 7 : 4;
        descT.setLineSpacing(lineSpacingValue);

        let currentY = 6;

        // Row 1: Icon & Name
        const titleStartX = -titleWidth / 2 - 2;
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

        // Row 3.5: Memory Leak Warning
        if (node.leaky > 0) {
            leakBg.setVisible(true).setPosition(0, currentY + 16);
            leakT.setVisible(true).setPosition(0, currentY + 16);

            let leakStr = 'DATA LEAK';
            leakStr = `+${_formatValue(node, node.leaky)} ${leakStr}`;
            leakT.setText(leakStr);

            currentY += 39;
        } else {
            leakBg.setVisible(false);
            leakT.setVisible(false);
        }

        // Row 4: Cost, MAX, ACTIVE, or SWAP
        const isDuoActive = node.isDuoBox && gameState.duoBoxPurchased && gameState.duoBoxPurchased[node.duoBoxTier];
        const isThisNodeActive = isDuoActive && gameState.activeShards[node.duoBoxTier] === node.shardId;
        const isSwappable = isDuoActive && !isThisNodeActive;

        if (node.state === NODE_STATE.MAXED || isThisNodeActive) {
            goldBg.setVisible(true).setPosition(0, currentY + 20);
            maxT.setVisible(true).setPosition(0, currentY + 19); // was 15, moving up with others or keeping relative to background?
            maxT.setText(isThisNodeActive ? t('tooltips', 'active') : t('tooltips', 'max'));
            costBg.setVisible(false);
            costT.setVisible(false);
            currentY += 39;
        } else if (isSwappable) {
            goldBg.setVisible(false);
            maxT.setVisible(false);
            costBg.setVisible(true).setPosition(0, currentY + 20);
            costBg.setTexture('buttons', 'light_red_pixel.png');
            costT.setVisible(true).setPosition(0, currentY + 19);
            costT.setText(t('tooltips', 'swap'));
            costT.setColor('#ffffff');
            currentY += 39;
        } else {
            goldBg.setVisible(false);
            maxT.setVisible(false);
            costBg.setVisible(true).setPosition(0, currentY + 20);
            costT.setVisible(true).setPosition(0, currentY + 19);

            let bgPixel = node.canAfford() ? 'dark_green_pixel.png' : 'dark_red_pixel.png';

            let iconStr, currentRes;
            if (node.costType === 'shard') {
                iconStr = '◆';
                currentRes = resourceManager.getShards();
                bgPixel = 'light_red_pixel.png';
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
                _updateCostText(node, animValue.val);
                let calcDur = 250 + Math.floor(Math.sqrt(purchaseCost) * 5);
                PhaserScene.tweens.add({
                    targets: animValue,
                    val: targetRes,
                    duration: calcDur,
                    ease: 'Quad.easeOut',
                    onUpdate: () => {
                        if (currentNode === node && costT.visible) {
                            _updateCostText(node, animValue.val);
                        }
                    }
                });
            } else {
                const parts = _updateCostText(node);
                if (node.leaky > 0 && !isPurchaseRefresh && (gameState.leakPenalty || 0) > 0) {
                    _startCostGlitch(parts);
                }
            }
            costBg.setFrame(bgPixel);

            currentY += 39;
        }

        const totalHeight = currentY + 4;
        bg.setDisplaySize(currentBgWidth, totalHeight);
        const edgePadding = 42;
        bgEdges.setSize(currentBgWidth + edgePadding, totalHeight + edgePadding);

        // Use getBounds() to account for parent container transforms (e.g. treeMaskContainer shifts)
        const btnBounds = node.btn.getBounds();
        const centerX = btnBounds.centerX;
        const centerY = btnBounds.centerY;

        const zoom = (typeof upgradeTree !== 'undefined' && upgradeTree.getDraggableGroup) ? (upgradeTree.getDraggableGroup().getScale() || 1) : 1;

        // Position above the node (Duo nodes appear 52px higher)
        // Check for top-of-screen intersection to flip position if needed
        const verticalOffset = (node.isDuoBox ? 54 : 29) * zoom;
        const topSafeMargin = 15;

        let showAbove = true;
        if (centerY - verticalOffset - totalHeight < topSafeMargin) {
            showAbove = false;
        }

        let horizontalOffset = 0;
        if (node.isDuoBox) {
            const side = node._getDuoSide();
            if (side === 'left') horizontalOffset = 16 * zoom;
            else if (side === 'right') horizontalOffset = -16 * zoom;
        }

        // Clamp X position to stay within the leftpanel bounds
        let targetX = centerX + horizontalOffset;
        const halfW = currentBgWidth / 2;
        const margin = 10;
        targetX = Math.max(targetX, halfW + margin);
        const edgeOffset = 21;

        // Final container position and child alignment
        if (showAbove) {
            container.setPosition(targetX, centerY - verticalOffset);
            bg.y = -totalHeight;
            bgEdges.y = -totalHeight - edgeOffset;
            container.iterate(child => {
                if (child === bg || child === bgEdges) return;
                child.y -= totalHeight;
            });
        } else {
            // Position below the node
            container.setPosition(targetX, centerY + verticalOffset + 1);
            bg.y = 0;
            bgEdges.y = -edgeOffset;
            // Children are already relative to container top (Y=3), so no further shift needed
        }

        // Leaky node glitch effect (6s cooldown)
        if (node.leaky) {
            const now = Date.now();
            if (now - lastGlitchTime > 6000) {
                lastGlitchTime = now;
                const glitchY = showAbove ? (centerY - verticalOffset - totalHeight / 2) : (centerY + verticalOffset + totalHeight / 2);
                if (typeof cinematicManager !== 'undefined') {
                    cinematicManager.playLocalGlitch(targetX, glitchY, currentBgWidth * 0.45, 0.85, 350, true);
                }
            }
        }

        // Animations
        if (!isPurchaseRefresh) {
            container.setScale(0.8, 1.11).setAngle(6);
            PhaserScene.tweens.add({
                targets: container,
                scaleX: 1.06, scaleY: 0.97, angle: -2, y: container.y,
                duration: 80, ease: 'Quart.easeOut',
                onComplete: () => {
                    isReady = true;
                    PhaserScene.tweens.add({
                        targets: container,
                        scaleX: 1, scaleY: 1, angle: 0,
                        easeParams: [2.4],
                        duration: 220, ease: 'Back.easeOut'
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

        // Secondary Tooltip for Leaky nodes
        if (node.leaky > 0 && typeof secondaryTooltip !== 'undefined') {
            const side = targetX > GAME_CONSTANTS.halfWidth ? 'left' : 'right';
            const leakYOffset = (currentY - 120); // currentY was incremented by 39 after leakT
            const secondaryY = container.y + (showAbove ? -totalHeight : 0) + leakYOffset;

            const title = "DATA LEAK";
            const body = `Increases global cost of all DATA LEAK nodes.\nCURRENT PENALTY: [b][color=#ff5d5d]+${_formatValue(node, gameState.leakPenalty || 0)}[/color][/b]`;

            // Offset the X based on the main tooltip's width
            const secondaryX = targetX + (side === 'right' ? halfW : -halfW);
            secondaryTooltip.show(secondaryX, secondaryY, title, body, side);
        } else if (typeof secondaryTooltip !== 'undefined') {
            secondaryTooltip.hide();
        }
    }

    function hide() {
        if (container) {
            _clearTweens();
            container.setVisible(false);
        }
        if (typeof secondaryTooltip !== 'undefined') secondaryTooltip.hide();
        currentNode = null;
        isReady = false;
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
    function isReadyForInput() { return isReady; }
    function getCurrentNode() { return currentNode; }
    function getShowAge() { return Date.now() - lastShowTime; }

    return { init, show, hide, shakeCost, isVisible, isReadyForInput, getCurrentNode, getShowAge };
})();
