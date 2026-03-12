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
        this.parentId = def.parentId || null;
        this.childIds = def.childIds || [];
        this.treeX = def.treeX || 0;
        this.treeY = def.treeY || 0;
        this.icon = def.icon || null;

        // Tier and Duo-Box properties
        this.tier = def.tier || 1;
        this.isDuoBox = def.isDuoBox || false;
        this.shardId = def.shardId || null;
        this.duoBoxTier = def.duoBoxTier || 0;
        this.duoSiblingId = def.duoSiblingId || null;
        this.requiresMaxParent = def.requiresMaxParent || false;
        this.isPlaceholder = def.isPlaceholder || false;
        this.monitorsDuoTier = def.monitorsDuoTier || 0;

        this.state = NODE_STATE.HIDDEN;
        this.level = 0;
        this.branchActive = true; // Tracks if this specific Shard path is active

        // Duo-box backing sprite (only created by one of the two siblings)
        this.duoBackingSprite = null;
        this._isDuoBackingOwner = false; // true for the node that creates/owns the shared backing

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
        const cost = this.getCost();
        // Updated to use resourceManager API
        if (this.costType === 'shard') return resourceManager.getShards() >= cost;
        if (this.costType === 'insight') return resourceManager.getInsight() >= cost;
        return resourceManager.getData() >= cost;
    }

    _deductCost(cost) {
        if (this.costType === 'shard') { resourceManager.addShard(-cost); }
        else if (this.costType === 'insight') { resourceManager.addInsight(-cost); }
        else { resourceManager.addData(-cost); }
    }

    // ── state management ─────────────────────────────────────────────────

    isRequirementsMet() {
        if (gameState.currentTier < this.tier) return false;

        // Placeholders monitoring a Duo Tier don't need standard parents
        if (this.isPlaceholder && this.monitorsDuoTier > 0) {
            return this._isDuoTierPurchased(this.monitorsDuoTier);
        }

        if (this.parentId) {
            const p = neuralTree.getNode(this.parentId);
            if (!p || !p.branchActive) return false;

            if (p.isDuoBox) {
                if (!this._isDuoTierPurchased(p.duoBoxTier)) return false;
            } else {
                // Standard node parent must be bought
                if (p.level < 1) return false;
            }

            // Check for full upgrade if required
            if (this.requiresMaxParent && p.level < p.maxLevel) return false;
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
        } else if (this.parentId) {
            const parent = neuralTree.getNode(this.parentId);
            this.branchActive = parent ? parent.branchActive : true;
        }

        // 1b. Strict visibility inheritance: HIDDEN if parent is HIDDEN
        if (this.parentId) {
            const parent = neuralTree.getNode(this.parentId);
            if (parent && parent.state === NODE_STATE.HIDDEN) {
                this.setState(NODE_STATE.HIDDEN);
                for (let i = 0; i < this.childIds.length; i++) {
                    const child = neuralTree.getNode(this.childIds[i]);
                    if (child) child.refreshState();
                }
                return;
            }

            // Duo child reveal: Keep hidden until DUO is actually BOUGHT
            if (parent && parent.isDuoBox) {
                if (!this._isDuoTierPurchased(parent.duoBoxTier)) {
                    this.setState(NODE_STATE.HIDDEN);
                    return;
                }
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
                this.setState(NODE_STATE.HIDDEN);
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
        } else if (this.isRequirementsMet()) {
            this.setState(NODE_STATE.UNLOCKED);
        } else if (this.parentId && neuralTree.getNode(this.parentId).level > 0) {
            this.setState(NODE_STATE.GHOST); // Visible but locked
        } else {
            // Show as GHOST if in current tier, otherwise HIDDEN
            if (this.tier <= gameState.currentTier) {
                this.setState(NODE_STATE.GHOST);
            } else {
                this.setState(NODE_STATE.HIDDEN);
            }
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

        // Deduct cost
        this._deductCost(cost);

        this.level++;

        // Persist
        if (!gameState.upgrades) gameState.upgrades = {};
        gameState.upgrades[this.id] = this.level;

        // Duo-Box first-purchase logic
        if (this.isDuoBox && this.duoBoxTier > 0) {
            if (!gameState.duoBoxPurchased) gameState.duoBoxPurchased = {};
            const isFirstDuoPurchaseEver = Object.keys(gameState.duoBoxPurchased).length === 0;
            gameState.duoBoxPurchased[this.duoBoxTier] = true;
            if (!gameState.activeShards) gameState.activeShards = {};
            gameState.activeShards[this.duoBoxTier] = this.shardId;

            // First-purchase notification (GDD §11)
            if (isFirstDuoPurchaseEver) {
                const pos = tower.getPosition();
                floatingText.show(
                    pos.x,
                    pos.y - 60,
                    'SWAP FREELY DURING UPGRADES',
                    { fontFamily: 'JetBrainsMono_Bold', color: '#ffffff', fontSize: 18 }
                );
            }

            // Refresh both siblings so their states update
            const sibling = neuralTree.getNode(this.duoSiblingId);
            if (sibling) {
                sibling.level = 1;
                if (!gameState.upgrades) gameState.upgrades = {};
                gameState.upgrades[sibling.id] = sibling.level;
            }
        }

        // Apply effect
        this.effect(this.level);

        // Visual pulse effect
        if (typeof neuralTree !== 'undefined') {
            neuralTree.playPurchasePulse(this.btn.x, this.btn.y, this.isMaxed());
        }

        // Reveal children — any HIDDEN children become at least visible
        if (this.childIds.length > 0) {
            neuralTree._revealChildren(this.id);
        }

        // For duo-box, we also need to reveal the sibling's children
        if (this.isDuoBox) {
            const sibling = neuralTree.getNode(this.duoSiblingId);
            if (sibling && sibling.childIds.length > 0) {
                neuralTree._revealChildren(sibling.id);
            }
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

        // Check if maxed (for duo-box both siblings need a full refresh)
        if (this.isDuoBox) {
            this.refreshState();
            const sibling = neuralTree.getNode(this.duoSiblingId);
            if (sibling) {
                sibling.refreshState();
                sibling._updateVisual();
            }
            this._updateVisual();
        } else if (this.isMaxed()) {
            this.setState(NODE_STATE.MAXED);
        } else {
            this._updateVisual();
        }

        messageBus.publish('upgradePurchased', this.id, this.level);

        // Refresh hover text if it was visible
        if (nodeTooltip.getCurrentNode() === this) {
            this._showHover(true);
        }

        return true;
    }

    // ── rendering ────────────────────────────────────────────────────────

    create(offsetX, offsetY) {

        let x = this.treeX + offsetX;
        let y = this.treeY + offsetY;

        // Duo-box positioning tweaks: Move buttons 8px apart (4px each) and offset icons 16px
        let iconX = x;
        if (this.isDuoBox && this.duoSiblingId) {
            const siblingDef = NODE_DEFS.find(d => d.id === this.duoSiblingId);
            if (siblingDef) {
                if (this.treeX < siblingDef.treeX) {
                    x -= 4;
                    iconX = x + 16;
                } else {
                    x += 4;
                    iconX = x - 16;
                }
            }
        }

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

        // Duo-box backing sprite — only one sibling creates it (the one whose id sorts first)
        if (this.isDuoBox && this.duoSiblingId && this.id < this.duoSiblingId) {
            this._isDuoBackingOwner = true;
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

            if (treeGroup) treeGroup.add(this.duoBackingSprite);
            if (draggableGroup) draggableGroup.add(this.duoBackingSprite);
        }

        this._updateVisual();
    }

    _onClick() {
        if (this.state !== NODE_STATE.UNLOCKED) return;

        // Duo-box swap logic: if this tier is already purchased and this is the inactive sibling
        if (this.isDuoBox && this.duoBoxTier > 0) {
            const tierPurchased = this._isDuoTierPurchased();
            const activeShard = gameState.activeShards && gameState.activeShards[this.duoBoxTier];
            // Also treat as swappable if this node's level is already > 0 (means it's been bought before)
            const isAlreadyBought = this.level > 0;

            if ((tierPurchased || isAlreadyBought) && activeShard !== this.shardId) {
                // Free swap — no cost
                gameState.activeShards[this.duoBoxTier] = this.shardId;

                // Apply this node's effect, deactivate sibling's
                this.effect(this.level);

                // Refresh both siblings and their entire sub-trees
                this.refreshState();
                const sibling = neuralTree.getNode(this.duoSiblingId);
                if (sibling) sibling.refreshState();

                // Explicitly update visuals for both siblings
                this._updateVisual();
                if (sibling) sibling._updateVisual();

                // Refresh tooltip
                if (nodeTooltip.getCurrentNode() === this) {
                    this._showHover(true);
                }

                // Notify systems of state change
                messageBus.publish('upgradePurchased');

                return;
            }
        }

        // Mobile interaction refinement: First tap shows info, second tap buys.
        if (GAME_VARS.wasTouch) {
            if (!this._tapConfirmed) {
                // First tap — show the tooltip and mark as confirmed for next tap
                this._tapConfirmed = true;
                this._showHover();
                return;
            }
            // Second tap — fall through to purchase
        }

        if (this.canAfford()) {
            this.purchase();
        } else {
            // Can't afford — show hover and shake the cost text
            if (!nodeTooltip.isVisible() || nodeTooltip.getCurrentNode() !== this) {
                this._showHover();
            }
            nodeTooltip.shakeCost();
        }
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
                this.btn.setVisible(false);
                this.btn.setState(DISABLE);
                if (this.iconSprite) this.iconSprite.setVisible(false);
                currentSpriteRef = null;
                break;

            case NODE_STATE.GHOST:
                // swap disable ref to ghost image, then disable the button
                this.btn.setDisableRef('node_ghost.png');
                this.btn.setVisible(true);
                this.btn.setState(DISABLE);

                // Set alpha based on parent state
                let ghostAlpha = 1.0;
                if (this.parentId) {
                    const p = neuralTree.getNode(this.parentId);
                    if (p && (p.state === NODE_STATE.GHOST || p.state === NODE_STATE.HIDDEN)) {
                        ghostAlpha = 0.5;
                    }
                }
                this.btn.setAlpha(ghostAlpha);

                if (this.iconSprite) {
                    this.iconSprite.setVisible(false);
                }
                currentSpriteRef = 'node_ghost.png';
                break;

            case NODE_STATE.UNLOCKED:
                // Restore disable ref to the unlocked-disabled image
                this.btn.setDisableRef('node_unlocked_disabled.png');
                this.btn.setVisible(true);
                this.btn.setAlpha(1);

                // Handle affordability vs. free swap for Duo-Boxes
                // A duo-box node is swappable if its tier is purchased but it isn't the active one
                const isDuoSwappable = this.isDuoBox &&
                    this._isDuoTierPurchased() &&
                    gameState.activeShards[this.duoBoxTier] !== this.shardId;

                // Show disabled appearance when unaffordable, but hover still works
                // Skip afford check if it's already swappable (free)
                if (isDuoSwappable || this.canAfford()) {
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
                this.btn.setDisableRef('node_maxed.png');
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

    // ── duo-box backing sprite management ────────────────────────────────

    _updateDuoBacking() {
        // Only the backing owner manages the sprite
        if (!this._isDuoBackingOwner || !this.duoBackingSprite) return;

        const tierNum = this.duoBoxTier;
        const tierLevel = this.tier || 1;
        const currentTier = gameState.currentTier || 1;
        const tierPurchased = this._isDuoTierPurchased(tierNum);

        // Visible from the beginning (if tier-appropriate)
        const isVisibleTier = (tierLevel <= currentTier);

        if (!isVisibleTier) {
            this.duoBackingSprite.setVisible(false);
            return;
        }

        this.duoBackingSprite.setVisible(true);

        if (tierPurchased) {
            this.duoBackingSprite.setTexture('buttons', 'duo_node_backing.png');
            this.duoBackingSprite.setAlpha(1);
        } else {
            // Unpurchased state: use same texture as purchased now
            this.duoBackingSprite.setTexture('buttons', 'duo_node_backing.png');
            // Show as solid foreshadowing
            this.duoBackingSprite.setAlpha(1.0); // Set to 1.0 for all foreshadowed states
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

    _showHover(isPurchaseRefresh = false) {
        if (this.isPlaceholder || this.state === NODE_STATE.HIDDEN || this.state === NODE_STATE.GHOST) return;
        nodeTooltip.show(this, isPurchaseRefresh);
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
        if (this.btn) { this.btn.destroy(); this.btn = null; }
        if (this.iconSprite) { this.iconSprite.destroy(); this.iconSprite = null; }
    }
}

/**
 * Specialized Node for Shard choices in the Duo Box.
 * Uses 'duo_node_button' assets.
 */
class DuoNode extends Node {
    constructor(def) {
        super(def);
        this.prefix = 'duo_node_button';
    }

    _updateVisual() {
        if (!this.btn) return;

        // Trigger fadeout if state changed
        if (this.lastVisualState !== this.state && this.lastSpriteRef) {
            this._playFadeoutAnimation(this.lastSpriteRef);
        }

        let currentSpriteRef;
        const p = this.prefix;



        switch (this.state) {
            case NODE_STATE.HIDDEN:
                this.btn.setVisible(false);
                this.btn.setState(DISABLE);
                if (this.iconSprite) this.iconSprite.setVisible(false);
                currentSpriteRef = null;
                break;

            case NODE_STATE.GHOST:
                this.btn.setDisableRef(`${p}_ghost.png`);
                this.btn.setVisible(true);
                this.btn.setState(DISABLE);
                let ghostAlpha = 1.0;
                if (this.parentId) {
                    const parentNode = neuralTree.getNode(this.parentId);
                    if (parentNode && (parentNode.state === NODE_STATE.GHOST || parentNode.state === NODE_STATE.HIDDEN)) {
                        ghostAlpha = 0.5;
                    }
                }
                this.btn.setAlpha(ghostAlpha);
                if (this.iconSprite) this.iconSprite.setVisible(false);
                currentSpriteRef = `${p}_ghost.png`;
                break;

            case NODE_STATE.UNLOCKED:
                this.btn.setDisableRef(`${p}_normal.png`);
                this.btn.setVisible(true);
                this.btn.setAlpha(1);

                const isDuoSwappable = this.isDuoBox &&
                    this._isDuoTierPurchased() &&
                    gameState.activeShards && gameState.activeShards[this.duoBoxTier] !== this.shardId;

                if (isDuoSwappable || this.canAfford()) {
                    this.btn.setNormalRef(`${p}_normal.png`);
                    this.btn.setHoverRef(`${p}_hover.png`);
                    this.btn.setPressRef(`${p}_press.png`);
                    this.btn.setState(NORMAL);
                    currentSpriteRef = `${p}_normal.png`;
                } else {
                    this.btn.setDisableRef(`${p}_normal.png`);
                    this.btn.setState(DISABLE);
                    currentSpriteRef = `${p}_normal.png`;
                }
                if (this.iconSprite) {
                    this.iconSprite.setVisible(true);
                    this.iconSprite.setAlpha(1);
                }
                break;

            case NODE_STATE.MAXED:
                // Active Shards in a DuoBox stay interactive (NORMAL button state) so they can be clicked
                // even though the node is 'MAXED'. This allows the swap logic in _onClick to stay reachable.
                if (this.isDuoBox) {
                    this.btn.setNormalRef(`${p}_maxed.png`);
                    this.btn.setHoverRef(`${p}_maxed.png`);
                    this.btn.setPressRef(`${p}_maxed.png`);
                    this.btn.setState(NORMAL);
                } else {
                    this.btn.setDisableRef(`${p}_maxed.png`);
                    this.btn.setState(DISABLE);
                }
                this.btn.setVisible(true);
                this.btn.setAlpha(1);
                if (this.iconSprite) {
                    this.iconSprite.setVisible(true);
                    this.iconSprite.setAlpha(1);
                }
                currentSpriteRef = `${p}_maxed.png`;
                break;
        }

        // Adjust depth so maxed duo nodes sit 1 depth lower (behind the active overlapping sibling)
        const baseDepth = GAME_CONSTANTS.DEPTH_NEURAL_TREE + 2;
        if (this.state === NODE_STATE.MAXED) {
            this.btn.setDepth(baseDepth);
            if (this.iconSprite) this.iconSprite.setDepth(baseDepth + 1);
        } else {
            this.btn.setDepth(baseDepth + 1);
            if (this.iconSprite) this.iconSprite.setDepth(baseDepth + 2);
        }

        this.lastSpriteRef = currentSpriteRef;
        this.lastVisualState = this.state;
    }
}
