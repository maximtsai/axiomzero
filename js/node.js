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
            this._showHover();
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

    _showHover() {
        if (this.state === NODE_STATE.HIDDEN || this.state === NODE_STATE.GHOST) return;
        this._hideHover();

        const x = this.btn.x;  // actual position of node (handles group offsets)
        const y = this.btn.y - 23;  // directly above
        const depth = GAME_CONSTANTS.DEPTH_POPUPS;
        const bgWidth = 300;
        const bgHeight = 138;
        const treeGroup = neuralTree.getGroup();
        const draggableGroup = neuralTree.getDraggableGroup();

        this.hoverGroup = [];

        // Background - centered above node
        const bg = PhaserScene.add.image(x, y, 'white_pixel');
        bg.setOrigin(0.5, 1)
            .setDisplaySize(bgWidth, bgHeight)
            .setTint(0x111122)
            .setAlpha(0.92)
            .setDepth(depth)
            .setScrollFactor(0);
        this.hoverGroup.push(bg);

        const padding = 12;
        const startY = y - bgHeight + padding;
        let currentY = startY;

        // --- ROW 1: Name & Icon ---
        const nameTextStr = this.name.toLowerCase();
        let iconOffset = 0;
        const boxOutlineSize = 34;
        const boxInnerSize = 30;
        const iconSize = 26;

        if (this.icon) {
            iconOffset = boxOutlineSize + 10;
        }

        const testNameT = PhaserScene.add.text(0, 0, nameTextStr, {
            fontFamily: 'VCR',
            fontSize: '24px'
        });
        const titleWidth = testNameT.width + iconOffset;
        testNameT.destroy();

        const titleStartX = x - titleWidth / 2;
        const centerTitleY = currentY + 17;

        if (this.icon) {
            const whiteBg = PhaserScene.add.image(titleStartX + boxOutlineSize / 2, centerTitleY, 'pixels', 'white_pixel.png')
                .setDisplaySize(boxOutlineSize, boxOutlineSize).setDepth(depth + 1).setScrollFactor(0);
            this.hoverGroup.push(whiteBg);

            const blackBg = PhaserScene.add.image(titleStartX + boxOutlineSize / 2, centerTitleY, 'pixels', 'black_pixel.png')
                .setDisplaySize(boxInnerSize, boxInnerSize).setDepth(depth + 2).setScrollFactor(0);
            this.hoverGroup.push(blackBg);

            const iconSpr = PhaserScene.add.sprite(titleStartX + boxOutlineSize / 2, centerTitleY, 'buttons', this.icon)
                .setDisplaySize(iconSize, iconSize).setDepth(depth + 3).setScrollFactor(0);
            this.hoverGroup.push(iconSpr);
        }

        const nameT = PhaserScene.add.text(titleStartX + iconOffset, centerTitleY, nameTextStr, {
            fontFamily: 'VCR',
            fontSize: '24px',
            color: '#ffffff',
            align: 'left',
        }).setOrigin(0, 0.5).setDepth(depth + 1).setScrollFactor(0);
        this.hoverGroup.push(nameT);

        currentY += 34 + 6;

        // --- ROW 2: Description ---
        const descT = PhaserScene.add.text(x, currentY, this.description.toLowerCase(), {
            fontFamily: 'VCR',
            fontSize: '18px',
            color: '#ffffff',
            align: 'center',
            wordWrap: { width: 275 },
        }).setOrigin(0.5, 0).setDepth(depth + 1).setScrollFactor(0);
        this.hoverGroup.push(descT);
        currentY += descT.height + 6;

        // --- ROW 3: Level ---
        const lvStr = 'Lv. ' + this.level + ' / ' + this.maxLevel;
        const lvT = PhaserScene.add.text(x, currentY, lvStr, {
            fontFamily: 'VCR',
            fontSize: '19px',
            color: '#ffffff',
            align: 'center',
        }).setOrigin(0.5, 0).setDepth(depth + 1).setScrollFactor(0);
        this.hoverGroup.push(lvT);
        currentY += lvT.height + 6;

        if (this.state === NODE_STATE.MAXED) {
            // --- ROW 4: MAX Bar ---
            const maxBgHeight = 24;
            const goldBg = PhaserScene.add.image(x, currentY + maxBgHeight / 2 - 2, 'pixels', 'gold_pixel.png')
                .setDisplaySize(bgWidth, maxBgHeight)
                .setDepth(depth + 1).setScrollFactor(0);
            this.hoverGroup.push(goldBg);

            const maxT = PhaserScene.add.text(x, currentY, 'MAX', {
                fontFamily: 'VCR',
                fontSize: '22px',
                color: '#ffffff',
                align: 'center',
            }).setOrigin(0.5, 0).setDepth(depth + 2).setScrollFactor(0);
            this.hoverGroup.push(maxT);
        } else {
            // --- ROW 4: Cost ---
            const costColor = this.costType === 'insight' ? '#ff9500' : '#ff2d78';
            const iconStr = this.costType === 'data' ? '◈' : '⦵';
            const currentRes = this.costType === 'data' ? resourceManager.getData() : resourceManager.getInsight();
            const costStr = iconStr + ' ' + this.getCost() + ' / ' + currentRes;

            const costBgHeight = 24;
            const darkRedBg = PhaserScene.add.image(x, currentY + costBgHeight / 2 - 2, 'pixels', 'dark_red_pixel.png')
                .setDisplaySize(bgWidth, costBgHeight)
                .setDepth(depth + 1).setScrollFactor(0);
            this.hoverGroup.push(darkRedBg);

            const costT = PhaserScene.add.text(x, currentY, costStr, {
                fontFamily: 'VCR',
                fontSize: '22px',
                color: costColor,
                align: 'center',
            }).setOrigin(0.5, 0).setDepth(depth + 2).setScrollFactor(0);
            this.hoverGroup.push(costT);
        }

        // Add all tooltip elements to the groups so they move if the tree moves
        if (treeGroup) {
            this.hoverGroup.forEach(obj => treeGroup.add(obj));
        }
        if (draggableGroup) {
            this.hoverGroup.forEach(obj => draggableGroup.add(obj));
        }
    }

    _hideHover() {
        if (this.hoverGroup) {
            for (let i = 0; i < this.hoverGroup.length; i++) {
                this.hoverGroup[i].destroy();
            }
            this.hoverGroup = null;
        }
    }

    _shakeCostText() {
        if (!this.hoverGroup || this.hoverGroup.length < 3) return;
        // infoT is the last element (added last in _showHover)
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
