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
 * costScaling: 'static'|'linear'|'custom',
 * costStep:    number,        // added per level for 'linear'
 * costStepScaling: number,    // scaling for the costStep in 'linear'
 * customCost:  number[],      // explicit costs per level for 'custom'
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
        this.costStepScaling = def.costStepScaling || 0;
        this.customCost = def.customCost || [];
        this.costType = def.costType || 'data';
        this.effect = def.effect || function () { };
        this.popupText = def.popupText || null;
        this.popupColor = def.popupColor || '#ffffff';
        this.parents = def.parents || [];
        this.childIds = def.childIds || [];
        this.treeX = def.treeX || 0;
        this.treeY = def.treeY || 0;
        this.icon = def.icon || null;
        this.lore = def.lore || false;

        // Tier and Duo-Box properties
        this.isDuoBox = def.isDuoBox || false;
        this.shardId = def.shardId || null;
        this.duoBoxTier = def.duoBoxTier || 0;
        this.duoSiblingId = def.duoSiblingId || null;
        this.requiresMaxParent = def.requiresMaxParent || false;
        this.isPlaceholder = def.isPlaceholder || false;
        this.monitorsDuoTier = def.monitorsDuoTier || 0;
        this.tooltipExtraWidth = def.tooltipExtraWidth || 0;
        this.prefix = 'node';

        this.duoBackingSprite = null;
        this.duoBackingOutline = null;
        this.duoOutlineTween = null;
        // Determine ownership: lexicographically smaller ID in a pair owns the backing
        this._isDuoBackingOwner = this.isDuoBox && this.duoSiblingId && (this.id < this.duoSiblingId);

        this.state = NODE_STATE.HIDDEN;
        this.level = 0;
        this.branchActive = true; // Tracks if this specific Shard path is active
        this.revealed = false;    // Whether this node is force-revealed by an event
        this.forceUnlocked = false; // Whether this node is force-unlocked by an event

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

        // Mobile two-tap purchase guard
        this._tapConfirmed = false;
    }

    // ── helpers ──────────────────────────────────────────────────────────

    _isDuoTierPurchased(tier = this.duoBoxTier) {
        return !!(gameState.duoBoxPurchased && gameState.duoBoxPurchased[tier]);
    }

    _getDuoSide() {
        if (!this.isDuoBox || !this.duoSiblingId) return null;
        const siblingDef = NODE_DEFS.find(d => d.id === this.duoSiblingId);
        if (!siblingDef) return null;
        return this.treeX < siblingDef.treeX ? 'left' : 'right';
    }

    // ── cost calculation ─────────────────────────────────────────────────

    getCost() {
        if (this.level >= this.maxLevel) return Infinity;
        if (this.costScaling === 'custom' && this.customCost.length > 0) {
            const idx = Math.min(this.level, this.customCost.length - 1);
            return this.customCost[idx];
        }
        if (this.costScaling === 'linear') {
            const scalingBonus = (this.level * (this.level + 1)) / 2 * this.costStepScaling;
            return this.baseCost + (this.costStep * this.level) + scalingBonus;
        }
        return this.baseCost; // static
    }

    getCostType() {
        return this.costType;
    }

    canAfford() {
        return resourceManager.canAfford(this.costType, this.getCost());
    }

    _deductCost(cost) {
        return resourceManager.spend(this.costType, cost);
    }

    // ── state management ─────────────────────────────────────────────────

    isDuoDescendant() {
        if (this.isDuoBox) return true;
        if (this.parents.length === 0) return false;
        for (let pid of this.parents) {
            const p = neuralTree.getNode(pid);
            if (p && p.isDuoDescendant()) return true;
        }
        return false;
    }

    isDuoPathPurchased() {
        if (this.isDuoBox) {
            return this._isDuoTierPurchased();
        }
        if (this.isPlaceholder && this.monitorsDuoTier > 0) {
            return this._isDuoTierPurchased(this.monitorsDuoTier);
        }
        if (this.parents.length === 0) return false;
        for (let pid of this.parents) {
            const p = neuralTree.getNode(pid);
            if (p && p.isDuoPathPurchased()) return true;
        }
        return false;
    }

    isRequirementsMet() {

        // Placeholders monitoring a Duo Tier don't need standard parents
        if (this.isPlaceholder && this.monitorsDuoTier > 0) {
            return this._isDuoTierPurchased(this.monitorsDuoTier);
        }

        if (this.parents.length > 0) {
            if (this.requiresMaxParent) {
                // ALL parents must be maxed
                for (let pid of this.parents) {
                    const p = neuralTree.getNode(pid);
                    if (!p || !p.branchActive) return false;
                    if (p.isDuoBox && !this._isDuoTierPurchased(p.duoBoxTier)) return false;
                    if (!p.isDuoBox && p.level < 1) return false;
                    if (p.level < p.maxLevel) return false;
                }
                return true;
            } else {
                // AT LEAST ONE parent must be unlocked (level >= 1)
                for (let pid of this.parents) {
                    const p = neuralTree.getNode(pid);
                    if (p && p.branchActive) {
                        if (p.isDuoBox && this._isDuoTierPurchased(p.duoBoxTier)) return true;
                        if (!p.isDuoBox && p.level >= 1) return true;
                    }
                }
                return false;
            }
        }
        return true;
    }

    // Handles Duo-Box swapping and recursive ghosting
    refreshState() {
        // 1. Determine if this branch is active (for Duo-Boxes)
        if (this.isDuoBox) {
            const activeShard = gameState.activeShards[this.duoBoxTier];
            if (activeShard) {
                // A shard has been chosen for this tier
                this.branchActive = (activeShard === this.shardId);
            } else {
                // No shard chosen yet — both are "active" (available to purchase)
                this.branchActive = true;
            }
        } else if (this.parents.length > 0) {
            this.branchActive = this.parents.some(pid => {
                const p = neuralTree.getNode(pid);
                return p ? p.branchActive : true;
            });
        }

        // 1a. Check for event-based revelation/unlocking (ignored if node is already purchased, placeholders, or duo nodes)
        this.revealed = !!(gameState.revealedNodes && gameState.revealedNodes[this.id]) && this.level === 0 && !this.isDuoBox && !this.isPlaceholder;
        this.forceUnlocked = !!(gameState.unlockedNodes && gameState.unlockedNodes[this.id]) && this.level === 0 && !this.isDuoBox && !this.isPlaceholder;

        // 1b. Strict visibility inheritance: HIDDEN if parent is HIDDEN
        if (this.parents.length > 0) {
            let anyRevealed = false;
            for (let pid of this.parents) {
                const parent = neuralTree.getNode(pid);
                if (parent) {
                    let isHidden = parent.state === NODE_STATE.HIDDEN;
                    if (parent.isDuoBox && !this._isDuoTierPurchased(parent.duoBoxTier)) {
                        isHidden = true; // Still "hidden" from this child's perspective
                    }
                    // Only nodes that are purchasable or already bought reveal their children naturally.
                    // Ghost nodes (previews or event-revealed) do NOT reveal their children,
                    // UNLESS they have been purchased (level > 0) or are part of a purchased Duo path.
                    const canReveal = !isHidden && (parent.state !== NODE_STATE.GHOST || parent.level > 0 || parent.isDuoPathPurchased());
                    if (canReveal) {
                        anyRevealed = true;
                        break;
                    }
                }
            }

            if (!anyRevealed && !this.revealed && !this.forceUnlocked && this.level === 0) {
                this.setState(NODE_STATE.HIDDEN);
                return;
            }
        }

        // 2. Set State based on requirements and level
        if (this.isPlaceholder) {
            if (this.isRequirementsMet()) {
                const justUnlocked = (this.level < this.maxLevel);
                this.level = this.maxLevel;
                this.setState(NODE_STATE.MAXED);
                if (!gameState.upgrades) gameState.upgrades = {};
                gameState.upgrades[this.id] = this.level;
                if (justUnlocked) neuralTree._revealChildren(this.id);
            } else {
                this.setState(NODE_STATE.GHOST);
            }
        } else if (this.isDuoBox) {
            // Duo-box special state logic
            const tierPurchased = this._isDuoTierPurchased();
            const activeShard = gameState.activeShards[this.duoBoxTier];

            if (!this.isRequirementsMet()) {
                // Parent not bought yet — Duo inner nodes stay HIDDEN until unlocked
                this.setState(NODE_STATE.HIDDEN);
            } else if (!tierPurchased) {
                // Parent bought, no shard purchased yet — both unlocked for purchase
                this.setState(NODE_STATE.UNLOCKED);
            } else if (this.branchActive) {
                // This is the currently active shard node
                this.setState(NODE_STATE.MAXED);
            } else {
                // This is the inactive sibling — clickable to swap
                this.setState(NODE_STATE.UNLOCKED);
            }
        } else if (!this.branchActive && this.level > 0) {
            this.setState(NODE_STATE.GHOST); // Purchased but currently deactivated
        } else if (this.level >= this.maxLevel) {
            this.setState(NODE_STATE.MAXED);
        } else if (this.isRequirementsMet() || this.forceUnlocked) {
            this.setState(NODE_STATE.UNLOCKED);
        } else {
            // If we reached here, the node is either force-revealed or has a purchasable parent.
            // Default to GHOST state (preview).
            this.setState(NODE_STATE.GHOST);
        }

        // 3. Update duo-box backing sprite if we own it
        this._updateDuoBacking();

        // 4. Recursively refresh children so ghost/active state cascades down the tree
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

        // Deduct cost and increment level
        this._deductCost(cost);
        this.level++;

        // Persist
        if (!gameState.upgrades) gameState.upgrades = {};
        gameState.upgrades[this.id] = this.level;

        // Effect and Metadata logic
        if (this.isDuoBox) {
            this._handleDuoBoxPurchase();
            // Refresh both siblings and their entire sub-trees BEFORE calling effect
            this.refreshState();
            const sibling = neuralTree.getNode(this.duoSiblingId);
            if (sibling) sibling.refreshState();
        }

        this.effect(this.level);

        // Reveal logic
        if (this.childIds.length > 0) neuralTree._revealChildren(this.id);
        if (this.isDuoBox) {
            const sibling = neuralTree.getNode(this.duoSiblingId);
            if (sibling && sibling.childIds.length > 0) neuralTree._revealChildren(sibling.id);
        }

        // Feedback via messageBus (Decoupled §5)
        messageBus.publish('node_purchase_feedback', {
            id: this.id,
            x: this.btn.x,
            y: this.btn.y,
            popupText: this.popupText,
            popupColor: this.popupColor,
            isLore: this.lore,
            level: this.level,
            maxLevel: this.maxLevel,
            isMaxed: this.isMaxed(),
            isDuoBox: this.isDuoBox,
            duoBoxTier: this.duoBoxTier
        });

        this._playLocalPurchaseAnimations();

        // System notifications
        messageBus.publish('upgradePurchased', this.id, this.level);

        // Final visual refresh
        if (this.isDuoBox) {
            const sibling = neuralTree.getNode(this.duoSiblingId);
            if (sibling) {
                sibling._updateVisual();
            }
            this._updateVisual();
        } else if (this.isMaxed()) {
            this.setState(NODE_STATE.MAXED);
        } else {
            this._updateVisual();
        }

        if (nodeTooltip.getCurrentNode() === this) this._showHover(true, cost);

        return true;
    }

    _playLocalPurchaseAnimations() {
        if (!this.btn || this.isDuoBox) return;

        const currentScaleX = this.btn.scaleX;
        const targetScaleX = (currentScaleX >= 0 ? 1 : -1);
        this.btn.rotation = 0.2;
        this.btn.setScale((currentScaleX >= 0 ? 0.95 : -0.95), 0.95);

        PhaserScene.tweens.add({
            targets: this.btn,
            rotation: -0.1,
            scaleX: targetScaleX,
            scaleY: 1,
            duration: 130,
            ease: 'Cubic.easeOut',
            onComplete: () => {
                PhaserScene.tweens.add({
                    targets: this.btn,
                    rotation: 0,
                    duration: 120,
                    ease: 'Back.easeOut'
                });
            }
        });
    }

    _handleDuoBoxPurchase() {
        if (!gameState.duoBoxPurchased) gameState.duoBoxPurchased = {};
        const isFirstDuoPurchaseEver = Object.keys(gameState.duoBoxPurchased).length === 0;
        gameState.duoBoxPurchased[this.duoBoxTier] = true;
        if (!gameState.activeShards) gameState.activeShards = {};
        gameState.activeShards[this.duoBoxTier] = this.shardId;

        if (isFirstDuoPurchaseEver) {
            messageBus.publish('trigger_tutorial', 'duo_swap');
        }

        const sibling = neuralTree.getNode(this.duoSiblingId);
        if (sibling) {
            sibling.level = 1;
            if (!gameState.upgrades) gameState.upgrades = {};
            gameState.upgrades[sibling.id] = sibling.level;
        }
    }

    // ── rendering ────────────────────────────────────────────────────────

    create(offsetX, offsetY) {

        let x = this.treeX + offsetX;
        let y = this.treeY + offsetY;

        // Duo-box positioning tweaks: Move buttons 14px apart (7px each) and offset icons 16px
        let iconX = x;
        if (this.isDuoBox && this.duoSiblingId) {
            const siblingDef = NODE_DEFS.find(d => d.id === this.duoSiblingId);
            if (siblingDef) {
                if (this.treeX < siblingDef.treeX) {
                    x -= 13;
                    iconX = x + 16;
                } else {
                    x += 13;
                    iconX = x - 16;
                }
            }
        }

        const nodeDepth = GAME_CONSTANTS.DEPTH_NEURAL_TREE + 2;
        this.btn = new Button({
            normal: {
                ref: this._getUnlockedSprite(),
                atlas: 'buttons',
                x: x, y: y,
                depth: nodeDepth,
            },
            hover: {
                ref: this._getHoverSprite(),
                atlas: 'buttons',
                x: x, y: y,
                depth: nodeDepth,
            },
            press: {
                ref: this._getPressSprite(),
                atlas: 'buttons',
                x: x, y: y,
                depth: nodeDepth,
            },
            disable: {
                ref: this._getUnlockedDisabledSprite(),
                atlas: 'buttons',
                x: x, y: y,
                depth: nodeDepth,
            },
            onMouseUp: () => { this._onClick(); },
            onHover: () => { this._showHover(); },
            onHoverOut: () => { this._hideHover(); },
            hoverWhileDisabled: !this.isPlaceholder,
        });
        this.btn.setDepth(nodeDepth);
        this.btn.setScrollFactor(0);


        // Node icon
        if (this.icon) {
            this.iconSprite = PhaserScene.add.sprite(iconX, y, 'buttons', this.icon)
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

        // Placeholders shouldn't intercept clicks or be visible, but need the Button obj to exist
        if (this.isPlaceholder) {
            this.btn.setState(DISABLE);
            this.btn.setAlpha(0);
            this.btn.setVisible(false);
            this.btn.setScale(0); // Fully collapse the hitbox
            if (this.fadeoutSprite) this.fadeoutSprite.setVisible(false);
        }

        // Flip X scale for the right-side duo node
        if (this.isDuoBox && this.duoSiblingId) {
            const siblingDef = NODE_DEFS.find(d => d.id === this.duoSiblingId);
            if (siblingDef && this.treeX > siblingDef.treeX) {
                this.btn.setScale(-1, 1);
                this.fadeoutSprite.setScale(-1, 1);
            }
        }

        // Duo-box backing sprite — only one sibling creates it
        if (this._isDuoBackingOwner) {
            const siblingDef = NODE_DEFS.find(d => d.id === this.duoSiblingId);
            const centerX = (this.treeX + (siblingDef ? siblingDef.treeX : this.treeX)) / 2 + offsetX;
            const centerY = (this.treeY + (siblingDef ? siblingDef.treeY : this.treeY)) / 2 + offsetY; // centered on siblings
            const backingDepth = GAME_CONSTANTS.DEPTH_NEURAL_TREE + 1.5; // Behind nodes but above lines

            this.duoBackingSprite = PhaserScene.add.image(centerX, centerY, 'buttons', 'duo_node_backing.png')
                .setOrigin(0.5, 0.5)
                .setScale(1.0)
                .setDepth(backingDepth)
                .setScrollFactor(0)
                .setVisible(false);

            this.duoBackingOutline = PhaserScene.add.image(centerX, centerY, 'buttons', 'duo_node_backing_outline.png')
                .setOrigin(0.5, 0.5)
                .setScale(1.0)
                .setDepth(backingDepth - 1)
                .setScrollFactor(0)
                .setVisible(false)
                .setAlpha(0);

            if (treeGroup) {
                treeGroup.add(this.duoBackingSprite);
                treeGroup.add(this.duoBackingOutline);
            }
            if (draggableGroup) {
                draggableGroup.add(this.duoBackingSprite);
                draggableGroup.add(this.duoBackingOutline);
            }
        }

        this._updateVisual();
    }

    _onClick() {
        if (this.state !== NODE_STATE.UNLOCKED) return;

        // 1. Duo-box swap logic
        if (this._handleDuoSwap()) return;

        // 2. Mobile interaction guard
        if (this._handleMobileInteraction()) return;

        // 3. Purchase logic
        if (this.canAfford()) {
            this.purchase();
        } else {
            // Can't afford — show hover and shake the cost text
            audio.play('retro1', 0.82);
            if (!nodeTooltip.isVisible() || nodeTooltip.getCurrentNode() !== this) {
                this._showHover();
            }
            nodeTooltip.shakeCost();
        }
    }

    _handleDuoSwap() {
        if (!this.isDuoBox || this.duoBoxTier <= 0) return false;

        const tierPurchased = this._isDuoTierPurchased();
        const activeShard = gameState.activeShards && gameState.activeShards[this.duoBoxTier];
        const isAlreadyBought = this.level > 0;

        if ((tierPurchased || isAlreadyBought) && activeShard !== this.shardId) {
            // Free swap — no cost
            gameState.activeShards[this.duoBoxTier] = this.shardId;

            // Refresh both siblings and their entire sub-trees BEFORE calling effect
            this.refreshState();
            const sibling = neuralTree.getNode(this.duoSiblingId);
            if (sibling) sibling.refreshState();

            // Apply this node's effect, deactivate sibling's (now with correct branchActive states)
            this.effect(this.level);

            // Explicitly update visuals for both siblings
            this._updateVisual();
            if (sibling) sibling._updateVisual();

            // Refresh tooltip
            if (nodeTooltip.getCurrentNode() === this) {
                this._showHover(true);
            }

            // Notify systems of state change
            messageBus.publish('upgradePurchased');
            this._playDuoPulse();

            return true;
        }
        return false;
    }

    _handleMobileInteraction() {
        if (!GAME_VARS.wasTouch) return false;

        if (!this._tapConfirmed) {
            // First tap — show the tooltip and mark as confirmed for next tap
            this._tapConfirmed = true;
            this._showHover();
            return true;
        }
        // Second tap — fall through to purchase
        return false;
    }

    getGhostAlpha() {
        if (this.revealed || this.level > 0) return 1.0;
        if (this.isDuoDescendant() || !this.parents || this.parents.length === 0) return 1.0;

        let allGhostOrHidden = true;
        for (let pid of this.parents) {
            const p = neuralTree.getNode(pid);
            if (p && p.state !== NODE_STATE.GHOST && p.state !== NODE_STATE.HIDDEN) {
                allGhostOrHidden = false;
                break;
            }
        }
        return allGhostOrHidden ? 0 : 1.0;
    }

    isDuoSwappable() {
        return this.isDuoBox &&
            this._isDuoTierPurchased() &&
            gameState.activeShards && gameState.activeShards[this.duoBoxTier] !== this.shardId;
    }

    _updateVisual() {
        if (this.isPlaceholder || !this.btn) return;

        // Trigger fadeout if state changed
        if (this.lastVisualState !== this.state && this.lastSpriteRef) {
            this._playFadeoutAnimation(this.lastSpriteRef);
        }

        let currentSpriteRef;
        switch (this.state) {
            case NODE_STATE.HIDDEN:
                currentSpriteRef = this._applyHiddenVisuals();
                break;
            case NODE_STATE.GHOST:
                currentSpriteRef = this._applyGhostVisuals();
                break;
            case NODE_STATE.UNLOCKED:
                currentSpriteRef = this._applyUnlockedVisuals();
                break;
            case NODE_STATE.MAXED:
                currentSpriteRef = this._applyMaxedVisuals();
                break;
        }

        this._applyVisualDepth();

        // Store current sprite for next state change
        this.lastSpriteRef = currentSpriteRef;
        this.lastVisualState = this.state;
    }

    _applyHiddenVisuals() {
        this.btn.setVisible(false);
        this.btn.setState(DISABLE);
        if (this.iconSprite) this.iconSprite.setVisible(false);
        return null;
    }

    _applyGhostVisuals() {
        const sprite = `${this.prefix}_ghost.png`;
        this.btn.setDisableRef(sprite);
        this.btn.setVisible(true);
        this.btn.setState(DISABLE);
        this.btn.setAlpha(this.getGhostAlpha());
        if (this.iconSprite) this.iconSprite.setVisible(false);
        return sprite;
    }

    _applyUnlockedVisuals() {
        const isSwappable = this.isDuoSwappable();
        const canAfford = this.canAfford();
        const isActive = isSwappable || canAfford;

        // Always NORMAL (interactable) to allow tooltip shaking/logs
        this.btn.setState(NORMAL);

        let sprite;
        if (isActive) {
            sprite = this._getUnlockedSprite();
            this.btn.setNormalRef(sprite);
            this.btn.setHoverRef(this._getHoverSprite());
            this.btn.setPressRef(this._getPressSprite());
        } else {
            sprite = this._getUnlockedDisabledSprite();
            this.btn.setNormalRef(sprite);
            this.btn.setHoverRef(sprite); // No hover highlight if inactive
            this.btn.setPressRef(sprite); // No press effect if inactive
        }

        this.btn.setDisableRef(this._getUnlockedDisabledSprite());
        this.btn.setVisible(true);
        this.btn.setAlpha(1);

        if (this.iconSprite) {
            this.iconSprite.setVisible(true);
            this.iconSprite.setAlpha(isActive ? 1 : 0.4);
        }
        return sprite;
    }

    _applyMaxedVisuals() {
        const sprite = `${this.prefix}_maxed.png`;
        this.btn.setDisableRef(sprite);
        this.btn.setVisible(true);
        this.btn.setState(DISABLE);
        this.btn.setAlpha(1);
        if (this.iconSprite) {
            this.iconSprite.setVisible(true);
            this.iconSprite.setAlpha(0.85);
        }
        return sprite;
    }

    _getUnlockedSprite() {
        return `${this.prefix}_unlocked.png`;
    }

    _getUnlockedDisabledSprite() {
        return `${this.prefix}_unlocked_disabled.png`;
    }

    _getHoverSprite() {
        return `${this.prefix}_unlocked_hover.png`;
    }

    _getPressSprite() {
        return `${this.prefix}_unlocked_press.png`;
    }

    _applyVisualDepth() {
        // Base Node doesn't need special depth logic beyond default
    }

    // ── duo-box backing sprite management ────────────────────────────────

    _updateDuoBacking() {
        // Only the backing owner manages the sprite
        if (!this._isDuoBackingOwner || !this.duoBackingSprite) return;

        const tierNum = this.duoBoxTier;
        const tierLevel = this.tier || 1;
        const currentTier = gameState.currentTier || 1;
        const tierPurchased = this._isDuoTierPurchased(tierNum);

        // Visible only if tier-appropriate AND at least one parent is "Unlocked" or better
        const isVisibleTier = (tierLevel <= currentTier);
        let anyParentActive = (this.parents.length === 0);
        for (let pid of this.parents) {
            const p = neuralTree.getNode(pid);
            if (p && p.state !== NODE_STATE.HIDDEN && p.state !== NODE_STATE.GHOST) {
                anyParentActive = true;
                break;
            }
        }

        if (!isVisibleTier || !anyParentActive) {
            this.duoBackingSprite.setVisible(false);
            if (this.duoBackingOutline) {
                this._stopDuoOutlineAnimation();
                this.duoBackingOutline.setVisible(false);
            }
            return;
        }

        this.duoBackingSprite.setVisible(true);

        let parentPurchased = false;
        if (this.parents && this.parents.length > 0) {
            for (let pid of this.parents) {
                const p = neuralTree.getNode(pid);
                if (p && p.level > 0) {
                    parentPurchased = true;
                    break;
                }
            }
        }

        if (tierPurchased || parentPurchased) {
            this.duoBackingSprite.setTexture('buttons', 'duo_node_backing_active.png');
            this.duoBackingSprite.setAlpha(1);

            if (this.duoBackingOutline) {
                this.duoBackingOutline.setVisible(true);
                if (!this.duoOutlineTween) {
                    this.duoBackingOutline.setAlpha(0.15);
                    this.duoOutlineTween = PhaserScene.tweens.add({
                        targets: this.duoBackingOutline,
                        alpha: 1.15,
                        duration: 2500,
                        yoyo: true,
                        repeat: -1,
                        ease: 'Quad.easeInOut'
                    });
                }
            }
        } else {
            // Unpurchased state: default texture
            this.duoBackingSprite.setTexture('buttons', 'duo_node_backing.png');
            // Show as solid foreshadowing
            this.duoBackingSprite.setAlpha(1.0);

            if (this.duoBackingOutline) {
                this._stopDuoOutlineAnimation();
                this.duoBackingOutline.setAlpha(0);
                this.duoBackingOutline.setVisible(false);
            }
        }
    }

    _stopDuoOutlineAnimation() {
        if (this.duoOutlineTween) {
            this.duoOutlineTween.stop();
            this.duoOutlineTween = null;
        }
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

    _showHover(isPurchaseRefresh = false, purchaseCost = 0) {
        if (this.isPlaceholder || this.state === NODE_STATE.HIDDEN || this.state === NODE_STATE.GHOST) return;
        nodeTooltip.show(this, isPurchaseRefresh, purchaseCost);
    }

    _hideHover() {
        if (this.isPlaceholder) return;
        this._tapConfirmed = false;
        if (nodeTooltip.getCurrentNode() === this) {
            nodeTooltip.hide();
        }
    }

    // ── cleanup ──────────────────────────────────────────────────────────

    setVisible(vis) {
        if (this.isPlaceholder) return;

        const isHidden = this.state === NODE_STATE.HIDDEN;
        const isGhost = this.state === NODE_STATE.GHOST;

        if (this.btn) {
            this.btn.setVisible(vis && !isHidden);
        }
        if (this.iconSprite) {
            // Ghost nodes should never show their icons
            this.iconSprite.setVisible(vis && !isHidden && !isGhost);
        }
        if (this.label) {
            this.label.setVisible(vis && !isHidden);
        }

        // Duo backing visibility is managed by its own logic
        if (this.duoBackingSprite && this._isDuoBackingOwner) {
            if (!vis) {
                this.duoBackingSprite.setVisible(false);
                if (this.duoBackingOutline) this.duoBackingOutline.setVisible(false);
                this._stopDuoOutlineAnimation();
            } else {
                this._updateDuoBacking();
            }
        }

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
        if (this.duoBackingSprite) {
            this.duoBackingSprite.destroy();
            this.duoBackingSprite = null;
        }
        if (this.duoBackingOutline) {
            this.duoBackingOutline.destroy();
            this.duoBackingOutline = null;
        }
        this._stopDuoOutlineAnimation();
        if (this.btn) { this.btn.destroy(); this.btn = null; }
        if (this.iconSprite) { this.iconSprite.destroy(); this.iconSprite = null; }
    }

    _playDuoPulse() {
        if (!this.btn) return;

        let x = this.btn.x;
        let y = this.btn.y;

        // Find the center of the duo box
        if (this._isDuoBackingOwner && this.duoBackingSprite) {
            x = this.duoBackingSprite.x;
            y = this.duoBackingSprite.y;
        } else {
            const sibling = neuralTree.getNode(this.duoSiblingId);
            if (sibling && sibling.duoBackingSprite) {
                x = sibling.duoBackingSprite.x;
                y = sibling.duoBackingSprite.y;
            }
        }

        const pulseDepth = this.btn.depth + 1;

        const pulse = PhaserScene.add.sprite(x, y, 'buttons', 'duo_node_pulse.png')
            .setOrigin(0.5, 0.5)
            .setDepth(pulseDepth)
            .setScrollFactor(0)
            .setAlpha(1.1)
            .setScale(0.95);

        const treeGroup = neuralTree.getGroup();
        const draggableGroup = neuralTree.getDraggableGroup();
        if (treeGroup) treeGroup.add(pulse);
        if (draggableGroup) draggableGroup.add(pulse);

        PhaserScene.tweens.add({
            targets: pulse,
            alpha: 0,
            duration: 1100,
        });

        PhaserScene.tweens.add({
            targets: pulse,
            scaleX: 1.6,
            scaleY: 1.6,
            duration: 1100,
            ease: 'Quart.easeOut',
            onComplete: () => {
                if (treeGroup) treeGroup.removeChild(pulse);
                if (draggableGroup) draggableGroup.removeChild(pulse);
                pulse.destroy();
            }
        });
    }
}

