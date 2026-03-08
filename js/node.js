// node.js — Modular Node logic for the Neural Tree.
// Each Node instance represents a single upgrade in the tree.
// Handles: state (HIDDEN/GHOST/UNLOCKED/MAXED), rendering, hover info, click-to-purchase.

const NODE_STATE = {
    HIDDEN: 'HIDDEN',
    GHOST: 'GHOST',
    UNLOCKED: 'UNLOCKED',
    MAXED: 'MAXED',
};

/**
 * Node definition schema (passed into constructor):
 * {
 * id:          string,
 * name:        string,
 * description: string,
 * maxLevel:    number,
 * baseCost:    number,        // DATA cost at level 1
 * costScaling: 'static'|'linear',
 * costStep:    number,        // added per level for 'linear'
 * costType:    'data'|'insight',
 * effect:      function(level),  // called after purchase to apply effect
 * parentId:    string|null,
 * childIds:    string[],
 * treeX:       number,        // x position within tree panel (0–800)
 * treeY:       number,        // y position within tree panel
 * tier:        number,        // NEW: Required global tier
 * isDuoBox:    boolean,       // NEW: Is this part of a Shard choice?
 * shardId:     string|null,   // NEW: Unique ID for this specific shard choice
 * }
 */

class Node {
    constructor(def) {
        this.id = def.id;
        this.name = def.name;
        this.description = def.description;
        this.maxLevel = def.maxLevel || 1;
        this.baseCost = def.baseCost || 0;
        this.costScaling = def.costScaling || 'static';
        this.costStep = def.costStep || 0;
        this.costType = def.costType || 'data';
        this.effect = def.effect || function () { };
        this.popupText = def.popupText || null;
        this.popupColor = def.popupColor || '#ffffff';
        this.parentId = def.parentId || null;
        this.childIds = def.childIds || [];
        this.treeX = def.treeX || 0;
        this.treeY = def.treeY || 0;
        this.icon = def.icon || null;

        // New Properties for Tier and Duo-Box Logic
        this.tier = def.tier || 1;
        this.isDuoBox = def.isDuoBox || false;
        this.shardId = def.shardId || null;
        this.requiresMaxParent = def.requiresMaxParent || false;

        this.state = NODE_STATE.HIDDEN;
        this.level = 0;
        this.branchActive = true; // Tracks if this specific Shard path is active

        // Phaser objects
        this.btn = null;
        this.label = null;
        this.iconSprite = null;
        this.hoverGroup = null; // array of Phaser objects for hover tooltip

        // Fadeout sprite effect
        this.fadeoutSprite = null;
        this.fadeoutTween = null;
        this.lastVisualState = NODE_STATE.HIDDEN;
        this.lastSpriteRef = null;
    }

    // ── cost calculation ─────────────────────────────────────────────────

    getCost() {
        if (this.level >= this.maxLevel) return Infinity;
        if (this.costScaling === 'linear') {
            return this.baseCost + this.costStep * this.level;
        }
        return this.baseCost; // static
    }

    getCostType() {
        return this.costType;
    }

    canAfford() {
        const cost = this.getCost();
        // Updated to use resourceManager API
        if (this.costType === 'insight') return resourceManager.getInsight() >= cost;
        return resourceManager.getData() >= cost;
    }

    // ── state management ─────────────────────────────────────────────────

    // NEW: Logic to check Tier and Parent requirements
    isRequirementsMet() {
        if (gameState.currentTier < this.tier) return false;
        if (this.parentId) {
            const p = neuralTree.getNode(this.parentId);
            if (!p || p.level < 1 || !p.branchActive) return false;
            // NEW: Check for full upgrade if required
            if (this.requiresMaxParent && p.level < p.maxLevel) return false;
        }
        return true;
    }

    // NEW: Handles Duo-Box swapping and recursive ghosting
    refreshState() {
        // 1. Determine if this branch is active (for Duo-Boxes)
        if (this.isDuoBox) {
            this.branchActive = (gameState.activeShards[this.tier] === this.shardId);
        } else if (this.parentId) {
            const p = neuralTree.getNode(this.parentId);
            this.branchActive = p ? p.branchActive : true;
        }

        // 2. Set State based on requirements and level
        if (!this.branchActive && this.level > 0) {
            this.setState(NODE_STATE.GHOST); // Purchased but currently deactivated
        } else if (this.level >= this.maxLevel) {
            this.setState(NODE_STATE.MAXED);
        } else if (this.isRequirementsMet()) {
            this.setState(NODE_STATE.UNLOCKED);
        } else if (this.parentId && neuralTree.getNode(this.parentId).level > 0) {
            this.setState(NODE_STATE.GHOST); // Visible but locked
        } else {
            this.setState(NODE_STATE.HIDDEN);
        }

        // 3. Recursively refresh children so ghost/active state cascades down the tree
        for (let i = 0; i < this.childIds.length; i++) {
            const child = neuralTree.getNode(this.childIds[i]);
            if (child) child.refreshState();
        }
    }

    setState(newState) {
        this.state = newState;
        this._updateVisual();
    }

    isInteractable() {
        return this.state === NODE_STATE.UNLOCKED;
    }

    isMaxed() {
        return this.level >= this.maxLevel;
    }

    // ── purchase ─────────────────────────────────────────────────────────

    purchase() {
        if (this.state !== NODE_STATE.UNLOCKED) return false;
        if (this.isMaxed()) return false;
        const cost = this.getCost();
        if (!this.canAfford()) return false;

        // Deduct cost via resourceManager (Fix 2: Centralized Economy)
        if (this.costType === 'insight') {
            resourceManager.addInsight(-cost);
        } else {
            resourceManager.addData(-cost);
        }

        this.level++;

        // Persist
        if (!gameState.upgrades) gameState.upgrades = {};
        gameState.upgrades[this.id] = this.level;

        // Apply effect
        this.effect(this.level);

        // Reveal children — any HIDDEN children become at least visible
        if (this.childIds.length > 0) {
            neuralTree._revealChildren(this.id);
        }

        // Floating text popup (if defined on this node)
        if (this.popupText) {
            const pos = tower.getPosition();
            floatingText.show(
                pos.x + (Math.random() - 0.5) * 100,
                pos.y + (Math.random() - 0.5) * 100,
                this.popupText,
                { fontFamily: 'JetBrainsMono_Bold', color: this.popupColor, fontSize: 24 }
            );
        }

        // Check if maxed
        if (this.isMaxed()) {
            this.setState(NODE_STATE.MAXED);
        } else {
            this._updateVisual();
        }

        messageBus.publish('upgradePurchased', this.id, this.level);

        // Refresh hover text if it was visible
        if (this.hoverGroup) {
            this._showHover(true);
        }

        return true;
    }

    // ── rendering ────────────────────────────────────────────────────────

    create(offsetX, offsetY) {
        const x = this.treeX + offsetX;
        const y = this.treeY + offsetY;

        const nodeDepth = GAME_CONSTANTS.DEPTH_NEURAL_TREE + 2;
        this.btn = new Button({
            normal: {
                ref: 'node_unlocked.png',
                atlas: 'buttons',
                x: x, y: y,
                depth: nodeDepth,
            },
            hover: {
                ref: 'node_unlocked_hover.png',
                atlas: 'buttons',
                x: x, y: y,
                depth: nodeDepth,
            },
            press: {
                ref: 'node_unlocked_press.png',
                atlas: 'buttons',
                x: x, y: y,
                depth: nodeDepth,
            },
            disable: {
                ref: 'node_unlocked_disabled.png',
                atlas: 'buttons',
                x: x, y: y,
                depth: nodeDepth,
            },
            onMouseUp: () => { this._onClick(); },
            onHover: () => { this._showHover(); },
            onHoverOut: () => { this._hideHover(); },
            hoverWhileDisabled: true,
        });
        this.btn.setDepth(nodeDepth);
        this.btn.setScrollFactor(0);

        // Node icon
        if (this.icon) {
            this.iconSprite = PhaserScene.add.sprite(x, y, 'buttons', this.icon)
                .setOrigin(0.5, 0.5)
                .setDepth(nodeDepth + 1)
                .setScrollFactor(0);
        }

        // Fadeout sprite — overlays button, starts invisible
        this.fadeoutSprite = PhaserScene.add.sprite(x, y, 'buttons', 'node_ghost.png')
            .setOrigin(0.5, 0.5)
            .setAlpha(0)
            .setDepth(nodeDepth + 1)
            .setScrollFactor(0);

        const treeGroup = neuralTree.getGroup();
        const draggableGroup = neuralTree.getDraggableGroup();
        if (treeGroup) {
            const btnObj = this.btn.getContainer ? this.btn.getContainer() : this.btn;
            treeGroup.add(btnObj);
            if (this.iconSprite) treeGroup.add(this.iconSprite);
            treeGroup.add(this.fadeoutSprite);

            if (draggableGroup) {
                draggableGroup.add(btnObj);
                if (this.iconSprite) draggableGroup.add(this.iconSprite);
                draggableGroup.add(this.fadeoutSprite);
            }
        }

        this._updateVisual();
    }

    _onClick() {
        if (this.state !== NODE_STATE.UNLOCKED) return;

        if (this.canAfford()) {
            this.purchase();
        } else {
            // Can't afford — show hover and shake the cost text
            if (!this.hoverGroup) {
                this._showHover();
            }
            this._shakeCostText();
        }
    }

    _updateVisual() {
        if (!this.btn) return;

        // Trigger fadeout if state changed
        if (this.lastVisualState !== this.state && this.lastSpriteRef) {
            this._playFadeoutAnimation(this.lastSpriteRef);
        }

        let currentSpriteRef;

        switch (this.state) {
            case NODE_STATE.HIDDEN:
                this.btn.setVisible(false);
                this.btn.setState(DISABLE);
                if (this.iconSprite) this.iconSprite.setVisible(false);
                currentSpriteRef = null;
                break;

            case NODE_STATE.GHOST:
                // Swap disable ref to ghost image, then disable the button
                this.btn.disable = { ref: 'node_ghost.png', atlas: 'buttons' };
                this.btn.setVisible(true);
                this.btn.setState(DISABLE);
                this.btn.setAlpha(0.4);
                if (this.iconSprite) {
                    this.iconSprite.setVisible(false);
                }
                currentSpriteRef = 'node_ghost.png';
                break;

            case NODE_STATE.UNLOCKED:
                // Restore disable ref to the unlocked-disabled image
                this.btn.disable = { ref: 'node_unlocked_disabled.png', atlas: 'buttons' };
                this.btn.setVisible(true);
                this.btn.setAlpha(1);
                // Show disabled appearance when unaffordable, but hover still works
                if (this.canAfford()) {
                    this.btn.setState(NORMAL);
                    currentSpriteRef = 'node_unlocked.png';
                } else {
                    this.btn.setState(DISABLE);
                    currentSpriteRef = 'node_unlocked_disabled.png';
                }
                if (this.iconSprite) {
                    this.iconSprite.setVisible(true);
                    this.iconSprite.setAlpha(1);
                }
                break;

            case NODE_STATE.MAXED:
                // Swap disable ref to maxed image
                this.btn.disable = { ref: 'node_maxed.png', atlas: 'buttons' };
                this.btn.setVisible(true);
                this.btn.setState(DISABLE);
                this.btn.setAlpha(1);
                if (this.iconSprite) {
                    this.iconSprite.setVisible(true);
                    this.iconSprite.setAlpha(1);
                }
                currentSpriteRef = 'node_maxed.png';
                break;
        }

        // Store current sprite for next state change
        this.lastSpriteRef = currentSpriteRef;
        this.lastVisualState = this.state;
    }

    // ── fadeout animation ───────────────────────────────────────────────

    _playFadeoutAnimation(spriteRef) {
        // Stop any existing tween
        if (this.fadeoutTween) {
            this.fadeoutTween.stop();
            this.fadeoutTween = null;
        }

        if (!this.fadeoutSprite || !spriteRef) return;

        // Set fadeout sprite to the old sprite and make it visible
        this.fadeoutSprite.setTexture('buttons', spriteRef);
        this.fadeoutSprite.setAlpha(1);

        // Tween to alpha 0 over 0.5 seconds
        this.fadeoutTween = PhaserScene.tweens.add({
            targets: this.fadeoutSprite,
            alpha: 0,
            duration: 400,
            ease: 'Linear',
            onComplete: () => {
                this.fadeoutTween = null;
            }
        });
    }

    // ── hover tooltip ────────────────────────────────────────────────────

    _showHover(isPurchaseRefresh = false) {
        if (this.state === NODE_STATE.HIDDEN || this.state === NODE_STATE.GHOST) return;
        this._hideHover();

        const x = this.btn.x;  // actual position of node (handles group offsets)
        const y = this.btn.y - 23;  // directly above
        const depth = GAME_CONSTANTS.DEPTH_POPUPS;
        const bgWidth = 280;
        const bgHeight = 138;
        const treeGroup = neuralTree.getGroup();
        const draggableGroup = neuralTree.getDraggableGroup();

        // 1. Create a Container initially at (0,0) to measure contents
        this.hoverContainer = PhaserScene.add.container(0, 0).setDepth(depth).setScrollFactor(0);
        this.hoverGroup = [];

        const padding = 12; // Legacy padding for other refs, used for desc wrapping
        const rowSpacing = 10;
        let currentY = 3; // Shifted up so backing is 3px from top

        // --- ROW 1: Name & Icon ---
        const nameTextStr = this.name.toUpperCase();
        let iconOffset = 0;
        const boxOutlineSize = 34;
        const boxInnerSize = 30;
        const iconSize = 26;

        if (this.icon) {
            iconOffset = boxOutlineSize + 10;
        }

        const nameT = PhaserScene.add.text(0, 0, nameTextStr, {
            fontFamily: 'VCR',
            fontSize: '22px',
            color: '#ffffff',
            align: 'left',
        }).setOrigin(0, 0.5);

        const titleWidth = nameT.width + iconOffset;
        const titleStartX = -titleWidth / 2;
        const centerTitleY = currentY + boxOutlineSize / 2;

        if (this.icon) {
            const whiteBg = PhaserScene.add.image(titleStartX + boxOutlineSize / 2, centerTitleY, 'pixels', 'white_pixel.png')
                .setDisplaySize(boxOutlineSize, boxOutlineSize);
            this.hoverContainer.add(whiteBg);

            const blackBg = PhaserScene.add.image(titleStartX + boxOutlineSize / 2, centerTitleY, 'pixels', 'black_pixel.png')
                .setDisplaySize(boxInnerSize, boxInnerSize);
            this.hoverContainer.add(blackBg);

            const iconSpr = PhaserScene.add.sprite(titleStartX + boxOutlineSize / 2, centerTitleY, 'buttons', this.icon)
                .setDisplaySize(iconSize, iconSize);
            this.hoverContainer.add(iconSpr);
        }

        nameT.setPosition(titleStartX + iconOffset, centerTitleY);
        this.hoverContainer.add(nameT);

        currentY += boxOutlineSize + rowSpacing;

        // --- ROW 2: Description ---
        const descT = PhaserScene.add.text(0, currentY, this.description.toLowerCase(), {
            fontFamily: 'VCR',
            fontSize: '22px',
            color: '#ffffff',
            align: 'center',
            wordWrap: { width: 255 },
            lineSpacing: 4,
        }).setOrigin(0.5, 0);
        this.hoverContainer.add(descT);
        currentY += descT.height + rowSpacing;

        // --- ROW 3: Level ---
        const lvStr = 'Lv. ' + this.level + ' / ' + this.maxLevel;
        const lvT = PhaserScene.add.text(0, currentY, lvStr, {
            fontFamily: 'VCR',
            fontSize: '22px',
            color: '#ffffff',
            align: 'center',
        }).setOrigin(0.5, 0);
        this.hoverContainer.add(lvT);
        currentY += lvT.height + (rowSpacing - 3); // Shifted up 3px as requested

        let goldBg, maxT, costBg, costT;
        const barHeight = 26;
        const barWidth = bgWidth - 6; // 3px padding on sides
        if (this.state === NODE_STATE.MAXED) {
            // --- ROW 4: MAX Bar ---
            goldBg = PhaserScene.add.image(0, currentY + barHeight / 2, 'pixels', 'gold_pixel.png')
                .setDisplaySize(barWidth, barHeight);
            this.hoverContainer.add(goldBg);

            maxT = PhaserScene.add.text(0, currentY + barHeight / 2, 'MAX', {
                fontFamily: 'VCR',
                fontSize: '22px',
                color: '#ffffff',
                align: 'center',
            }).setOrigin(0.5, 0.5);
            this.hoverContainer.add(maxT);
            currentY += barHeight;
        } else {
            // --- ROW 4: Cost ---
            const costColor = this.costType === 'insight' ? '#ff9500' : '#ff2d78';
            const iconStr = this.costType === 'data' ? '◈' : '⦵';
            const currentRes = this.costType === 'data' ? resourceManager.getData() : resourceManager.getInsight();
            const costStr = iconStr + ' ' + this.getCost() + ' / ' + currentRes;

            const bgPixel = this.canAfford() ? 'dark_green_pixel.png' : 'dark_red_pixel.png';
            costBg = PhaserScene.add.image(0, currentY + barHeight / 2, 'pixels', bgPixel)
                .setDisplaySize(barWidth, barHeight);
            this.hoverContainer.add(costBg);

            costT = PhaserScene.add.text(0, currentY + barHeight / 2, costStr, {
                fontFamily: 'VCR',
                fontSize: '22px',
                color: costColor,
                align: 'center',
            }).setOrigin(0.5, 0.5);
            this.hoverContainer.add(costT);
            this.hoverGroup.push(costT);
            currentY += barHeight;
        }

        const totalHeight = currentY + 3; // 3px bottom padding

        // Final position adjustment: move container to 'y' and shift content so (0,0) is bottom-center
        this.hoverContainer.setPosition(x, y);
        this.hoverContainer.iterate(child => {
            child.y -= totalHeight;
        });

        // Background (add at the back of the container)
        const bg = PhaserScene.add.image(0, -totalHeight, 'white_pixel');
        bg.setOrigin(0.5, 0) // Pin at top, expand down
            .setDisplaySize(bgWidth, totalHeight)
            .setTint(0x111122)
            .setAlpha(0.92);
        this.hoverContainer.addAt(bg, 0);

        // Add container to the groups so it moves if the tree moves
        if (treeGroup) {
            treeGroup.add(this.hoverContainer);
        }
        if (draggableGroup) {
            draggableGroup.add(this.hoverContainer);
        }

        // --- Entrance Animation (The "Bouncy" Pop) ---
        if (!isPurchaseRefresh) {
            this.hoverContainer.setScale(0.2);
            this.hoverContainer.angle = -8; // Start slightly tilted
            PhaserScene.tweens.add({
                targets: this.hoverContainer,
                scaleX: 1,
                scaleY: 1,
                angle: 0, // Snap to upright
                duration: 250, // Quicker duration
                ease: 'Back.easeOut',
            });
        }

        // --- Purchase Animation ---
        if (isPurchaseRefresh) {
            const animateTargets = [lvT];
            if (this.state === NODE_STATE.MAXED) {
                if (maxT) animateTargets.push(maxT);
            } else {
                if (costT) animateTargets.push(costT);
            }

            animateTargets.forEach(target => {
                target.setScale(0.82, 1);
                PhaserScene.tweens.add({
                    targets: target,
                    scaleX: 1.18,
                    duration: 150,
                    ease: 'Cubic.easeOut',
                    onComplete: () => {
                        PhaserScene.tweens.add({
                            targets: target,
                            scaleX: 1,
                            duration: 350,
                            ease: 'Back.easeOut'
                        });
                    }
                });
            });
        }
    }

    _hideHover() {
        if (this.hoverContainer) {
            this.hoverContainer.destroy();
            this.hoverContainer = null;
        }
        if (this.hoverGroup) {
            this.hoverGroup = null;
        }
    }

    _shakeCostText() {
        if (!this.hoverContainer || !this.hoverGroup || this.hoverGroup.length === 0) return;

        // infoT is the costT we saved into hoverGroup
        const infoT = this.hoverGroup[this.hoverGroup.length - 1];
        if (!infoT) return;

        const origX = infoT.x;
        const shakeAmp = 8; // pixels
        const shakes = 4;   // number of oscillations
        const duration = 80; // ms per oscillation

        for (let i = 0; i < shakes; i++) {
            PhaserScene.tweens.add({
                targets: infoT,
                x: origX + (i % 2 === 0 ? shakeAmp : -shakeAmp),
                duration: duration,
                ease: 'Linear',
                delay: i * duration,
            });
        }

        // Return to original position
        PhaserScene.tweens.add({
            targets: infoT,
            x: origX,
            duration: 150,
            ease: 'Cubic.easeOut',
            delay: shakes * duration,
        });
    }

    // ── cleanup ──────────────────────────────────────────────────────────

    setVisible(vis) {
        if (this.btn) this.btn.setVisible(vis);
        if (this.iconSprite) this.iconSprite.setVisible(vis);
        if (!vis) this._hideHover();
    }

    destroy() {
        this._hideHover();
        if (this.fadeoutTween) {
            this.fadeoutTween.stop();
            this.fadeoutTween = null;
        }
        if (this.fadeoutSprite) {
            this.fadeoutSprite.destroy();
            this.fadeoutSprite = null;
        }
        if (this.btn) { this.btn.destroy(); this.btn = null; }
        if (this.iconSprite) { this.iconSprite.destroy(); this.iconSprite = null; }
    }
}
