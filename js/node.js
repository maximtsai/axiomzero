// node.js — Modular Node logic for the Neural Tree.
// Each Node instance represents a single upgrade in the tree.
// Handles: state (HIDDEN/GHOST/UNLOCKED/MAXED), rendering, hover info, click-to-purchase.

const NODE_STATE = {
    HIDDEN:   'HIDDEN',
    GHOST:    'GHOST',
    UNLOCKED: 'UNLOCKED',
    MAXED:    'MAXED',
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
        this.id          = def.id;
        this.name        = def.name;
        this.description = def.description;
        this.maxLevel    = def.maxLevel    || 1;
        this.baseCost    = def.baseCost    || 0;
        this.costScaling = def.costScaling || 'static';
        this.costStep    = def.costStep    || 0;
        this.costType    = def.costType    || 'data';
        this.effect      = def.effect      || function() {};
        this.popupText   = def.popupText   || null;
        this.popupColor  = def.popupColor  || '#ffffff';
        this.parentId    = def.parentId    || null;
        this.childIds    = def.childIds    || [];
        this.treeX       = def.treeX       || 0;
        this.treeY       = def.treeY       || 0;

        // New Properties for Tier and Duo-Box Logic
        this.tier        = def.tier        || 1;
        this.isDuoBox    = def.isDuoBox    || false;
        this.shardId     = def.shardId     || null;

        this.state = NODE_STATE.HIDDEN;
        this.level = 0;
        this.branchActive = true; // Tracks if this specific Shard path is active

        // Phaser objects
        this.btn        = null;
        this.label      = null;
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
        debugLog('Purchased node:', this.id, 'Lv', this.level);
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

        // Node name label
        this.label = PhaserScene.add.text(x, y + 32, this.name, {
            fontFamily: 'JetBrainsMono_Regular',
            fontSize: '17px',
            color: '#ffffff',
            align: 'center',
            stroke: '#000000',
            strokeThickness: 6,
        }).setOrigin(0.5, 0).setDepth(GAME_CONSTANTS.DEPTH_NEURAL_TREE + 2);

        // Fadeout sprite — overlays button, starts invisible
        this.fadeoutSprite = PhaserScene.add.sprite(x, y, 'buttons', 'node_ghost.png')
            .setOrigin(0.5, 0.5)
            .setAlpha(0)
            .setDepth(nodeDepth + 1);

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
        this._hideHover(); // Clear any lingering tooltip when state changes

        // Trigger fadeout if state changed
        if (this.lastVisualState !== this.state && this.lastSpriteRef) {
            this._playFadeoutAnimation(this.lastSpriteRef);
        }

        let currentSpriteRef;

        switch (this.state) {
            case NODE_STATE.HIDDEN:
                this.btn.setVisible(false);
                this.btn.setState(DISABLE);
                if (this.label) this.label.setVisible(false);
                currentSpriteRef = null;
                break;

            case NODE_STATE.GHOST:
                // Swap disable ref to ghost image, then disable the button
                this.btn.disable = { ref: 'node_ghost.png', atlas: 'buttons' };
                this.btn.setVisible(true);
                this.btn.setState(DISABLE);
                this.btn.setAlpha(1);
                if (this.label) {
                    this.label.setVisible(true);
                    this.label.setAlpha(0.25);
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
                if (this.label) {
                    this.label.setVisible(true);
                    this.label.setAlpha(1);
                    this.label.setColor('#00f5ff');
                }
                break;

            case NODE_STATE.MAXED:
                // Swap disable ref to maxed image
                this.btn.disable = { ref: 'node_maxed.png', atlas: 'buttons' };
                this.btn.setVisible(true);
                this.btn.setState(DISABLE);
                this.btn.setAlpha(1);
                if (this.label) {
                    this.label.setVisible(true);
                    this.label.setAlpha(0.8);
                    this.label.setColor('#ffe600');
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

        const x = this.treeX;  // center of node
        const y = this.treeY - 63;  // directly above
        const depth = GAME_CONSTANTS.DEPTH_NEURAL_TREE + 10;
        const bgWidth = 300;
        const bgHeight = 138;

        this.hoverGroup = [];

        // Background - centered above node
        const bg = PhaserScene.add.image(x, y, 'white_pixel');
        bg.setOrigin(0.5, 1)  // center-top
            .setDisplaySize(bgWidth, bgHeight)
            .setTint(0x111122)
            .setAlpha(0.92)
            .setDepth(depth);
        this.hoverGroup.push(bg);

        const padding = 12;
        const startY = y - bgHeight + padding;
        let currentY = startY;

        // Name - center aligned, larger font
        const nameT = PhaserScene.add.text(x, currentY, this.name, {
            fontFamily: 'JetBrainsMono_Bold',
            fontSize: '22px',
            color: '#00f5ff',
            align: 'center',
        }).setOrigin(0.5, 0).setDepth(depth + 1);
        this.hoverGroup.push(nameT);
        currentY += nameT.height + 6;

        // Description - center aligned, larger font
        const descT = PhaserScene.add.text(x, currentY, this.description, {
            fontFamily: 'JetBrainsMono_Regular',
            fontSize: '19px',
            color: '#cccccc',
            align: 'center',
            wordWrap: { width: 275 },
        }).setOrigin(0.5, 0).setDepth(depth + 1);
        this.hoverGroup.push(descT);
        currentY += descT.height + 6;

        if (this.state === NODE_STATE.MAXED) {
            const maxT = PhaserScene.add.text(x, currentY, 'MAXED', {
                fontFamily: 'JetBrainsMono_Italic',
                fontSize: '19px',
                color: '#ffe600',
                align: 'center',
            }).setOrigin(0.5, 0).setDepth(depth + 1);
            this.hoverGroup.push(maxT);
        } else {
            // Level and cost - center aligned, larger font
            const lvStr = 'Lv ' + this.level + '/' + this.maxLevel;
            const costStr = 'Cost: ' + this.getCost() + ' ' + (this.costType === 'data' ? '\u25C8' : '\u25C9');
            const infoT = PhaserScene.add.text(x, currentY, lvStr + '  ' + costStr, {
                fontFamily: 'JetBrainsMono_Regular',
                fontSize: '19px',
                color: this.canAfford() ? '#00ff88' : '#ff4444',
                align: 'center',
            }).setOrigin(0.5, 0).setDepth(depth + 1);
            this.hoverGroup.push(infoT);
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
        if (this.label) this.label.setVisible(vis);
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
        if (this.label) { this.label.destroy(); this.label = null; }
    }
}
