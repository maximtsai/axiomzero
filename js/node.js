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
 * treeX:       number,        // x position within tree panel (0–640)
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

        this.btn = new Button({
            normal: {
                ref: 'empty_square.png',
                atlas: 'buttons',
                x: x,
                y: y,
                depth: GAME_CONSTANTS.DEPTH_NEURAL_TREE + 1,
            },
            hover: {
                ref: 'empty_square.png',
                atlas: 'buttons',
                x: x,
                y: y,
                depth: GAME_CONSTANTS.DEPTH_NEURAL_TREE + 1,
            },
            onMouseUp: () => { this._onClick(); },
            onHover: () => { this._showHover(); },
            onHoverOut: () => { this._hideHover(); },
        });

        // Node name label
        this.label = PhaserScene.add.text(x, y + 26, this.name, {
            fontFamily: 'JetBrainsMono',
            fontSize: '10px',
            color: '#ffffff',
            align: 'center',
        }).setOrigin(0.5, 0).setDepth(GAME_CONSTANTS.DEPTH_NEURAL_TREE + 2);

        this._updateVisual();
    }

    _onClick() {
        if (this.state === NODE_STATE.UNLOCKED) {
            this.purchase();
        }
    }

    _updateVisual() {
        if (!this.btn) return;

        switch (this.state) {
            case NODE_STATE.HIDDEN:
                this.btn.setVisible(false);
                if (this.label) this.label.setVisible(false);
                break;
            case NODE_STATE.GHOST:
                this.btn.setVisible(true);
                this.btn.setState(DISABLE);
                // Faint appearance
                this.btn.setAlpha(0.25);
                if (this.label) {
                    this.label.setVisible(true);
                    this.label.setAlpha(0.25);
                }
                break;
            case NODE_STATE.UNLOCKED:
                this.btn.setVisible(true);
                this.btn.setState(NORMAL);
                this.btn.setAlpha(1);
                if (this.label) {
                    this.label.setVisible(true);
                    this.label.setAlpha(1);
                    this.label.setColor('#00f5ff');
                }
                break;
            case NODE_STATE.MAXED:
                this.btn.setVisible(true);
                this.btn.setState(DISABLE);
                this.btn.setAlpha(0.8);
                if (this.label) {
                    this.label.setVisible(true);
                    this.label.setAlpha(0.8);
                    this.label.setColor('#ffe600');
                }
                break;
        }
    }

    // ── hover tooltip ────────────────────────────────────────────────────

    _showHover() {
        if (this.state === NODE_STATE.HIDDEN || this.state === NODE_STATE.GHOST) return;
        this._hideHover();

        const x = this.treeX + 40;
        const y = this.treeY - 10;
        const depth = GAME_CONSTANTS.DEPTH_NEURAL_TREE + 10;

        this.hoverGroup = [];

        // Background
        const bg = PhaserScene.add.image(x, y, 'white_pixel');
        bg.setOrigin(0, 1).setDisplaySize(180, 70).setTint(0x111122).setAlpha(0.92).setDepth(depth);
        this.hoverGroup.push(bg);

        // Name
        const nameT = PhaserScene.add.text(x + 8, y - 60, this.name, {
            fontFamily: 'JetBrainsMono-Bold',
            fontSize: '12px',
            color: '#00f5ff',
        }).setOrigin(0, 0).setDepth(depth + 1);
        this.hoverGroup.push(nameT);

        // Description
        const descT = PhaserScene.add.text(x + 8, y - 44, this.description, {
            fontFamily: 'JetBrainsMono',
            fontSize: '10px',
            color: '#cccccc',
            wordWrap: { width: 164 },
        }).setOrigin(0, 0).setDepth(depth + 1);
        this.hoverGroup.push(descT);

        if (this.state === NODE_STATE.MAXED) {
            const maxT = PhaserScene.add.text(x + 8, y - 16, 'MAXED', {
                fontFamily: 'JetBrainsMono-Italic',
                fontSize: '10px',
                color: '#ffe600',
            }).setOrigin(0, 0).setDepth(depth + 1);
            this.hoverGroup.push(maxT);
        } else {
            // Level and cost
            const lvStr = 'Lv ' + this.level + '/' + this.maxLevel;
            const costStr = 'Cost: ' + this.getCost() + ' ' + (this.costType === 'data' ? '\u25C8' : '\u25C9');
            const infoT = PhaserScene.add.text(x + 8, y - 16, lvStr + '  ' + costStr, {
                fontFamily: 'JetBrainsMono',
                fontSize: '10px',
                color: this.canAfford() ? '#00ff88' : '#ff4444',
            }).setOrigin(0, 0).setDepth(depth + 1);
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

    // ── cleanup ──────────────────────────────────────────────────────────

    setVisible(vis) {
        if (this.btn) this.btn.setVisible(vis);
        if (this.label) this.label.setVisible(vis);
        if (!vis) this._hideHover();
    }

    destroy() {
        this._hideHover();
        if (this.btn) { this.btn.destroy(); this.btn = null; }
        if (this.label) { this.label.destroy(); this.label = null; }
    }
}
