// node.js — Modular Node logic for the Upgrade Tree.
// Each Node instance represents a single upgrade in the tree.
// Handles: state (HIDDEN/GHOST/UNLOCKED/MAXED), rendering, hover info, click-to-purchase.
// treeNode.js
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
        this.leaky = def.leaky || 0;
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
        this.isLeftDuo = def.isLeftDuo || false;
        this.isDuoChild = def.isDuoChild || false;
        this.shardId = def.shardId || null;
        this.duoBoxTier = def.duoBoxTier || 0;
        this.duoSiblingId = def.duoSiblingId || null;
        this.requiresMaxParent = def.requiresMaxParent || false;
        this.isPlaceholder = def.isPlaceholder || false;
        this.monitorsDuoTier = def.monitorsDuoTier || 0;
        this.tooltipExtraWidth = def.tooltipExtraWidth || 0;
        this.labelCategory = def.label || "UPGRADE";
        this.delayActualPurchase = def.delayActualPurchase || null;

        // Asset prefixing based on cost type
        this.prefix = (this.costType === 'insight') ? 'insight_node' : 'node';

        this.duoBackingSprite = null;
        this.duoBackingOutline = null;
        this.duoOutlineTween = null;
        this._duoBackingRevealed = false;
        // Determine ownership: lexicographically smaller ID in a pair owns the backing
        this._isDuoBackingOwner = this.isDuoBox && this.duoSiblingId && (this.id < this.duoSiblingId);

        this.state = NODE_STATE.HIDDEN;
        this.level = (gameState.upgrades && gameState.upgrades[this.id] !== undefined) ? gameState.upgrades[this.id] : 0;
        this.branchActive = true; // Tracks if this specific Shard path is active
        this.revealed = false;    // Whether this node is force-revealed by an event
        this.revealedManually = false; // Whether this node was revealed via the revealNode API
        this.forceUnlocked = false; // Whether this node is force-unlocked by an event
        this.forceGhost = false;    // Whether this node is force-revealed as a ghost by an event

        // Cached recursive lookups (updated in refreshState)
        this._cachedIsDuoDescendant = this.isDuoBox;
        this._cachedIsDuoPathPurchased = false;
        this.lastAffordStatus = false;
        this.lastGhostAlpha = 0;
        this.lastRevealedManually = false;

        // Phaser objects
        this.btn = null;
        this.label = null;
        this.iconSprite = null;
        this.hoverGroup = null; // array of Phaser objects for hover tooltip

        // Fadeout sprite effect
        this.fadeoutSprite = null;
        this.fadeoutTween = null;
        this.glowSprite = null;
        this.lastVisualState = NODE_STATE.HIDDEN;
        this.lastSpriteRef = null;
        this.lastAffordStatus = null;

        // Mobile two-tap purchase guard
        this._tapConfirmed = false;

        // Ghost indicators
        this.ghost2Sprite = null;
        this.ghost2Visible = false;
        this.ghost2Tween = null;
    }

    static selectIndicator = null;
    static touchedNode = null;

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
        let cost = this.baseCost;
        if (this.costScaling === 'linear') {
            const scalingBonus = (this.level * (this.level + 1)) / 2 * this.costStepScaling;
            cost = this.baseCost + (this.costStep * this.level) + scalingBonus;
        } else if (this.costScaling === 'custom' && this.customCost.length > 0) {
            const idx = Math.min(this.level, this.customCost.length - 1);
            cost = this.customCost[idx];
        }

        if (this.leaky > 0 && gameState.leakPenalty) {
            cost += gameState.leakPenalty;
        }

        // Global Backdoor cost reduction
        if (this.costType === 'data' && gameState.upgrades && gameState.upgrades.global_backdoor) {
            cost = Math.max(0, cost - 30);
        }

        return cost;
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

    /** Returns cached result. Updated during refreshState(). */
    isDuoDescendant() {
        return this._cachedIsDuoDescendant;
    }

    /** Recomputes and caches isDuoDescendant from parent chain. */
    _recomputeIsDuoDescendant() {
        if (this.isDuoBox) { this._cachedIsDuoDescendant = true; return; }
        if (this.parents.length === 0) { this._cachedIsDuoDescendant = false; return; }
        for (let pid of this.parents) {
            const p = upgradeTree.getNode(pid);
            if (p && p._cachedIsDuoDescendant) { this._cachedIsDuoDescendant = true; return; }
        }
        this._cachedIsDuoDescendant = false;
    }

    /** Returns cached result. Updated during refreshState(). */
    isDuoPathPurchased() {
        return this._cachedIsDuoPathPurchased;
    }

    /** Recomputes and caches isDuoPathPurchased from parent chain. */
    _recomputeIsDuoPathPurchased() {
        if (this.isDuoBox) {
            this._cachedIsDuoPathPurchased = this._isDuoTierPurchased();
            return;
        }
        if (this.isPlaceholder && this.monitorsDuoTier > 0) {
            this._cachedIsDuoPathPurchased = this._isDuoTierPurchased(this.monitorsDuoTier);
            return;
        }
        if (this.parents.length === 0) { this._cachedIsDuoPathPurchased = false; return; }
        for (let pid of this.parents) {
            const p = upgradeTree.getNode(pid);
            if (p && p._cachedIsDuoPathPurchased) { this._cachedIsDuoPathPurchased = true; return; }
        }
        this._cachedIsDuoPathPurchased = false;
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
                    const p = upgradeTree.getNode(pid);
                    if (!p || !p.branchActive) return false;
                    if (p.isDuoBox && !this._isDuoTierPurchased(p.duoBoxTier)) return false;
                    if (!p.isDuoBox && p.level < 1) return false;
                    if (p.level < p.maxLevel) return false;
                }
                return true;
            } else {
                // AT LEAST ONE parent must be unlocked (level >= 1)
                for (let pid of this.parents) {
                    const p = upgradeTree.getNode(pid);
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
        const oldState = this.state;
        const oldLevel = this.level;
        const oldGhostAlpha = (this.state === NODE_STATE.GHOST) ? this.getGhostAlpha() : 1;

        // Update cached recursive lookups
        this._recomputeIsDuoDescendant();
        this._recomputeIsDuoPathPurchased();

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
                const p = upgradeTree.getNode(pid);
                return p ? p.branchActive : true;
            });
        }

        // 1a. Check for event-based revelation/unlocking (ignored if node is already purchased)
        this.revealed = !!(this.revealedManually || (gameState.revealedNodes && gameState.revealedNodes[this.id]) || (gameState.ghostNodes && gameState.ghostNodes[this.id])) && this.level === 0;
        this.forceUnlocked = !!(gameState.unlockedNodes && gameState.unlockedNodes[this.id]) && this.level === 0;
        this.forceGhost = !!(gameState.ghostNodes && gameState.ghostNodes[this.id]) && this.level === 0;

        let anyRevealed = false;
        // 1b. Strict visibility inheritance: HIDDEN if parent is HIDDEN
        if (this.parents.length > 0) {
            if (FLAGS.DEBUG && this.state === NODE_STATE.HIDDEN) {
                // console.log(`[NODE] Testing ${this.id} for revelation... (parents: ${this.parents.join(',')})`);
            }
            for (let pid of this.parents) {
                const parent = upgradeTree.getNode(pid);
                if (parent) {
                    let isHidden = parent.state === NODE_STATE.HIDDEN;
                    if (parent.isDuoBox && !this._isDuoTierPurchased(parent.duoBoxTier)) {
                        isHidden = true;
                    }

                    // NEW: duo nodes can be partially revealed (as ghosts) if parent is revealed manually
                    const canRevealParentState = (parent.state !== NODE_STATE.GHOST || parent.level > 0 || parent.isDuoChild);
                    const canRevealDuo = (this.isDuoBox && parent.revealedManually);
                    const canReveal = !isHidden && (canRevealParentState || canRevealDuo);

                    if (FLAGS.DEBUG && this.state === NODE_STATE.HIDDEN && canReveal) {
                        console.log(`[NODE] ${this.id} found revealer parent: ${pid} (state: ${parent.state}, level: ${parent.level})`);
                    }

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
                if (justUnlocked) upgradeTree._revealChildren(this.id);
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
        } else if (this.forceUnlocked || (this.isRequirementsMet() && !this.forceGhost)) {
            if (FLAGS.DEBUG && this.state !== NODE_STATE.UNLOCKED) {
                console.log(`[NODE] ${this.id} -> UNLOCKED (met: ${this.isRequirementsMet()})`);
            }
            this.setState(NODE_STATE.UNLOCKED);
        } else {
            // // If we reached here, the node is either force-revealed or has a purchasable parent.
            // // Default to GHOST state (preview).
            // if (FLAGS.DEBUG && this.state !== NODE_STATE.GHOST) {
            //     console.log(`[NODE] ${this.id} -> GHOST (anyRevealed: ${anyRevealed})`);
            // }
            this.setState(NODE_STATE.GHOST);
        }

        // 3. Update duo-box backing sprite if we own it
        this._updateDuoBacking();

        // 3a. Optimization: Only update visuals if affordability changed or alpha changed while state stayed same.
        // (State changes already trigger _updateVisual in setState)
        const currentAfford = this.canAfford();
        const currentGhostAlpha = this.state === NODE_STATE.GHOST ? this.getGhostAlpha() : 1;

        if (currentAfford !== this.lastAffordStatus || currentGhostAlpha !== this.lastGhostAlpha || this.revealedManually !== this.lastRevealedManually) {
            this.lastAffordStatus = currentAfford;
            this.lastGhostAlpha = currentGhostAlpha;
            this.lastRevealedManually = this.revealedManually;
            this._updateVisual();
        }

        if (this.state === NODE_STATE.GHOST) {
            this._updateGhostIndicators();
        }

        // 4. Recursively refresh children ONLY if something meaningful changed that could affect them.
        // This optimization prevents O(N^2) redundancy during global refreshes.
        const meaningfulChange = (this.state !== oldState || this.level !== oldLevel || currentGhostAlpha !== oldGhostAlpha);

        if (meaningfulChange) {
            for (let i = 0; i < this.childIds.length; i++) {
                const child = upgradeTree.getNode(this.childIds[i]);
                if (child) child.refreshState();
            }
        }
    }

    /**
     * Specialized refresh that forces a recursive update down a fixed number of generations.
     * This is used during Duo-Box swaps to ensure that even if a node's state doesn't 
     * technically change (e.g. Ghost -> Ghost), its descendants correctly inherit 
     * the new branchActive status and update their visuals/lines.
     */
    refreshBranch(generations = 2) {
        this.refreshState();
        if (generations > 0) {
            for (let i = 0; i < this.childIds.length; i++) {
                const child = upgradeTree.getNode(this.childIds[i]);
                if (child) child.refreshBranch(generations - 1);
            }
        }
    }

    setState(newState) {
        if (this.state === newState) return;

        const oldState = this.state;
        this.state = newState;
        this._updateVisual(); // Set textures and baseline values first

        // 1. Reveal Glow (Ghost -> Unlocked)
        if (oldState === NODE_STATE.GHOST && newState === NODE_STATE.UNLOCKED) {
            this._playRevealGlow();
        }
        // 2. Reveal Bloom (Hidden -> Ghost)
        else if (oldState === NODE_STATE.HIDDEN && newState === NODE_STATE.GHOST) {
            this._playGhostFadeIn();
        }

        // 3. Maxed Out Pop (Unlocked -> Maxed)
        if (oldState === NODE_STATE.UNLOCKED && newState === NODE_STATE.MAXED) {
            this._playMaxedAnimation();
        }
    }

    _playRevealGlow() {
        nodeAnims.playRevealGlow(this);
    }

    _playMaxedAnimation() {
        nodeAnims.playMaxedAnimation(this);
    }

    _playGhostFadeIn() {
        nodeAnims.playGhostFadeIn(this);
    }

    isInteractable() {
        return this.state === NODE_STATE.UNLOCKED;
    }

    isMaxed() {
        return this.level >= this.maxLevel;
    }

    getAlpha() {
        return this.btn ? this.btn.alpha : 0;
    }

    // ── purchase ─────────────────────────────────────────────────────────

    purchase() {
        if (this.state !== NODE_STATE.UNLOCKED) return false;
        if (this.isMaxed()) return false;
        const cost = this.getCost();
        if (!this.canAfford()) return false;
        // passed all our checks

        // Deduct cost and increment level
        this._deductCost(cost);
        this.level++;

        // Persist
        if (!gameState.upgrades) gameState.upgrades = {};
        gameState.upgrades[this.id] = this.level;

        // Leaky node global modifier
        if (this.leaky > 0 && this.level === 1) {
            gameState.leakPenalty = (gameState.leakPenalty || 0) + this.leaky;

            // Brief "System Shock" interruption
            if (typeof glitchFX !== 'undefined') glitchFX.triggerWarningGlitch(3, 0.4, 200);

            setTimeout(() => {
                if (typeof timeManager !== 'undefined') timeManager.setTempPause(70, 0.1);
                if (Math.random() < 0.6) {
                    if (typeof audio !== 'undefined') audio.setTempVolume(60, 0.6);
                }
            }, 60);
        }

        // Effect and Metadata logic
        if (this.isDuoBox) {
            this._handleDuoBoxPurchase();
            // Refresh both siblings and their entire sub-trees BEFORE calling effect
            this.refreshState();
            const sibling = upgradeTree.getNode(this.duoSiblingId);
            if (sibling) sibling.refreshState();
        }

        this.effect(this.level);

        // Reveal logic - refresh the whole tree to ensure cascades work (e.g. grandchildren becoming ghosts)
        // Might not be needed
        // upgradeTree._refreshAllNodes();

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

        if (!this.isMaxed()) {
            this._playLocalPurchaseAnimations();
        }

        // System notifications
        messageBus.publish('upgradePurchased', {
            id: this.id,
            level: this.level,
            costType: this.costType,
            cost: cost
        });

        // Completionist bonus: +20 DATA when maxing out ANY node
        if (this.isMaxed() && gameState.upgrades && gameState.upgrades['completionist']) {
            resourceManager.addData(20);
            if (typeof floatingText !== 'undefined' && typeof tower !== 'undefined') {
                const pos = tower.getPosition();
                messageBus.publish('showFloatingText',
                    pos.x + (Math.random() - 0.5) * 100,
                    pos.y + (Math.random() - 0.5) * 100,
                    '+20 DATA',
                    {
                        fontFamily: 'Quantico-Bold',
                        color: '#00ccff', // Matching cyan DATA color
                        fontSize: 24,
                        travel: 60,
                        noScale: true
                    }
                );
            }
        }

        // Final visual refresh
        if (this.isDuoBox) {
            const sibling = upgradeTree.getNode(this.duoSiblingId);
            if (sibling) {
                sibling._updateVisual();
            }
            this._updateVisual();
        } else if (this.isMaxed()) {
            this.setState(NODE_STATE.MAXED);
            Node._updateSelectIndicator(this);
        } else {
            this._updateVisual();
        }

        if (nodeTooltip.getCurrentNode() === this) this._showHover(true, cost);
        return true;
    }

    playPurchaseAnimationOnly() {
        if (this.state !== NODE_STATE.UNLOCKED) return false;
        if (this.isMaxed()) return false;
        if (!this.canAfford()) return false;

        // Set state and level locally (visuals follow state change)
        this.level++;
        this.setState(NODE_STATE.MAXED);

        // Pulses and particles
        if (typeof upgradeTree !== 'undefined' && upgradeTree.playPurchasePulse) {
            upgradeTree.playPurchasePulse(this.btn.x, this.btn.y + 1, true, this.costType === 'insight');
        }

        console.log(`[NODE] playPurchaseAnimationOnly triggered for ${this.id}`);
        return true;
    }

    finalizePurchase() {
        const cost = this.getCost();
        this._deductCost(cost);

        // Persist to global state
        if (!gameState.upgrades) gameState.upgrades = {};
        gameState.upgrades[this.id] = this.level;
        // saveGameState();
        messageBus.publish('upgradePurchased', { id: this.id, level: this.level });
        console.log(`[NODE] finalizePurchase completed for ${this.id}`);

        // Redraw all lines to match new node states
        if (typeof treeLineManager !== 'undefined') {
            treeLineManager.updateLines();
        }
    }

    _playLocalPurchaseAnimations() {
        nodeAnims.playLocalPurchaseAnimations(this);
    }

    _handleDuoBoxPurchase() {
        if (!gameState.duoBoxPurchased) gameState.duoBoxPurchased = {};
        const isFirstDuoPurchaseEver = Object.keys(gameState.duoBoxPurchased).length === 0;
        gameState.duoBoxPurchased[this.duoBoxTier] = true;
        if (!gameState.activeShards) gameState.activeShards = {};
        gameState.activeShards[this.duoBoxTier] = this.shardId;

        // Force both siblings to level 1 for safety
        if (this.level === 0) this.level = 1;
        if (!gameState.upgrades) gameState.upgrades = {};
        gameState.upgrades[this.id] = this.level;

        // Subtle camera shake on purchase
        if (PhaserScene && PhaserScene.cameras && PhaserScene.cameras.main) {
            PhaserScene.cameras.main.shake(150, 0.001);
        }

        if (isFirstDuoPurchaseEver) {
            messageBus.publish('trigger_tutorial', 'duo_swap');
        }

        const sibling = upgradeTree.getNode(this.duoSiblingId);
        if (sibling) {
            sibling.level = 1;
            gameState.upgrades[sibling.id] = sibling.level;
        }
    }

    // ── rendering ────────────────────────────────────────────────────────

    create(offsetX, offsetY) {
        const group = upgradeTree.getDraggableGroup();
        const gx = group ? group.x : 0;
        const gy = group ? group.y : 0;
        const gs = group ? group.getScale() : 1;

        let x = (this.treeX + offsetX) * gs + gx;
        let y = (this.treeY + offsetY) * gs + gy;

        // Duo-box positioning tweaks: Move buttons 14px apart (7px each) and offset icons 16px
        let iconX = x;
        if (this.isDuoBox && this.duoSiblingId) {
            const siblingDef = NODE_DEFS.find(d => d.id === this.duoSiblingId);
            if (siblingDef) {
                if (this.treeX < siblingDef.treeX) {
                    x -= 22;
                    iconX = x + 21;
                } else {
                    x += 22;
                    iconX = x - 21;
                }
            }
        }

        const nodeDepth = GAME_CONSTANTS.DEPTH_UPGRADE_TREE + 2;
        this.btn = new Button({
            normal: {
                ref: this._getUnlockedSprite(),
                atlas: 'buttons',
                x: x, y: y,
                depth: nodeDepth,
                scaleX: gs, scaleY: gs,
            },
            hover: {
                ref: this._getHoverSprite(),
                atlas: 'buttons',
                x: x, y: y,
                depth: nodeDepth,
                scaleX: gs, scaleY: gs,
            },
            press: {
                ref: this._getPressSprite(),
                atlas: 'buttons',
                x: x, y: y,
                depth: nodeDepth,
                scaleX: gs, scaleY: gs,
            },
            disable: {
                ref: this._getUnlockedDisabledSprite(),
                atlas: 'buttons',
                x: x, y: y,
                depth: nodeDepth,
                scaleX: gs, scaleY: gs,
            },
            onMouseUp: () => { this._onClick(); },
            onHover: () => {
                if (!GAME_VARS.wasTouch || this.state === NODE_STATE.MAXED) {
                    this._showHover();
                    if (GAME_VARS.wasTouch && this.state === NODE_STATE.MAXED) {
                        Node.touchedNode = this.id;
                    }
                }
            },
            onHoverOut: () => { this._hideHover(); },
            hoverWhileDisabled: !this.isPlaceholder,
        });
        this.btn.setDepth(nodeDepth);
        this.btn.setScrollFactor(0);

        // Apply hit area constraint to match the upgrade panel viewport
        this.btn.setHitArea(0, 0, GAME_CONSTANTS.halfWidth - 10, GAME_CONSTANTS.HEIGHT);


        // Node icon
        if (this.icon) {
            this.iconSprite = PhaserScene.add.image(iconX, y, 'buttons', this.icon)
                .setOrigin(0.5, 0.5)
                .setDepth(nodeDepth + 1)
                .setScrollFactor(0)
                .setScale(gs);
        }

        // Fadeout sprite — overlays button, starts invisible
        this.fadeoutSprite = PhaserScene.add.image(x, y, 'buttons', 'node_ghost.png')
            .setOrigin(0.5, 0.5)
            .setAlpha(0)
            .setDepth(nodeDepth + 1)
            .setScrollFactor(0)
            .setScale(gs);

        const draggableGroup = upgradeTree.getDraggableGroup();
        if (draggableGroup) {
            const btnObj = this.btn;
            draggableGroup.add(btnObj);
            if (this.iconSprite) draggableGroup.add(this.iconSprite);
            draggableGroup.add(this.fadeoutSprite);
        }

        // Reveal Glow sprite
        const startFrame = (this.costType === 'insight') ? 'insight_node_glow0.png' : 'node_glow0.png';
        this.glowSprite = PhaserScene.add.sprite(x, y, 'buttons', startFrame)
            .setOrigin(0.5, 0.5)
            .setAlpha(0)
            .setVisible(false)
            .setDepth(nodeDepth + 5)
            .setScrollFactor(0)
            .setScale(1.01 * gs);

        if (draggableGroup) {
            draggableGroup.add(this.glowSprite);
            // After adding all pieces, we need to ensure their local offsets match the tree coordinates
            // because create() just set their screen positions factoring in the current scroll/zoom.
            // draggableGroup.add() already records the offset, but let's be safe.
        }

        // Placeholders shouldn't intercept clicks or be visible, but need the Button obj to exist
        if (this.isPlaceholder) {
            this.btn.setState(DISABLE);
            this.btn.setAlpha(0);
            this.btn.setVisible(false);
            this.btn.setScale(0); // Fully collapse the hitbox
            if (this.fadeoutSprite) this.fadeoutSprite.setVisible(false);
        }

        // Duo-box backing sprite — only one sibling creates it
        if (this._isDuoBackingOwner) {
            const siblingDef = NODE_DEFS.find(d => d.id === this.duoSiblingId);
            const centerX = (this.treeX + (siblingDef ? siblingDef.treeX : this.treeX)) / 2 + offsetX;
            const centerY = (this.treeY + (siblingDef ? siblingDef.treeY : this.treeY)) / 2 + offsetY; // centered on siblings
            const backingDepth = GAME_CONSTANTS.DEPTH_UPGRADE_TREE + 1.5; // Behind nodes but above lines

            this.duoBackingSprite = PhaserScene.add.image(centerX, centerY, 'buttons', 'duo_node_backing.png')
                .setOrigin(0.5, 0.5)
                .setScale(1.0)
                .setDepth(backingDepth)
                .setScrollFactor(0)
                .setVisible(false);

            this.duoBackingOutline = PhaserScene.add.image(centerX, centerY, 'buttons', 'duo_node_backing_outline.png')
                .setOrigin(0.5, 0.5)
                .setScale(1.03)
                .setDepth(backingDepth - 1)
                .setScrollFactor(0)
                .setVisible(false)
                .setAlpha(0);

            if (draggableGroup) {
                draggableGroup.add(this.duoBackingSprite);
                draggableGroup.add(this.duoBackingOutline);
            }
        }

        this._updateVisual();
    }

    _onClick() {
        if (this.isPlaceholder) return;
        if (this.state === NODE_STATE.LOCKED) return;

        // Mobile interaction guard — handles showing tooltip on first tap
        if (this._handleMobileInteraction()) return;

        if (this.state !== NODE_STATE.UNLOCKED) return;

        if (FLAGS.DEBUG) {
            console.log(`[NODE] Clicked: ${this.id} (${this.name})`);
        }

        if (this.isDuoBox) {
            let sfx = audio.play('switch');
            if (sfx) {
                sfx.detune = this.isLeftDuo ? -150 : 20;
            }
        }

        // 1. Duo-box swap logic
        if (this._handleDuoSwap()) return;

        // 3. Purchase logic
        if (this.canAfford()) {
            if (this.delayActualPurchase) {
                this.playPurchaseAnimationOnly();
                this.effect();
            } else {
                this.purchase();
            }
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

            // Safety check: ensure level is synchronized if this is the first time we're activating this side
            if (this.level < 1) {
                this.level = 1;
                if (!gameState.upgrades) gameState.upgrades = {};
                gameState.upgrades[this.id] = this.level;
            }

            // Refresh both siblings and their sub-trees (2 generations) BEFORE calling effect
            this.refreshBranch(2);
            const sibling = upgradeTree.getNode(this.duoSiblingId);
            if (sibling) sibling.refreshBranch(2);

            // Apply this node's effect, deactivate sibling's (now with correct branchActive states)
            this.effect(this.level);

            // Recalculate ALL upgrade effects so deactivated branch children are properly zeroed out
            upgradeDispatcher.recalcEverything();

            // Explicitly update visuals for both siblings
            this._updateVisual();
            if (sibling) sibling._updateVisual();

            treeLineManager.updateLines();

            // Refresh tooltip
            if (nodeTooltip.getCurrentNode() === this) {
                this._showHover(true);
            }

            // Notify systems of state change
            messageBus.publish('upgradePurchased', { id: this.id });
            this._playDuoPulse();
            nodeAnims.playDuoSwapAnimation(this);

            return true;
        }
        return false;
    }

    _handleMobileInteraction() {
        if (!GAME_VARS.wasTouch) return false;

        // If tooltip is already showing this node and is ready, allow consecutive taps to purchase
        if (typeof nodeTooltip !== 'undefined' && nodeTooltip.isVisible() &&
            nodeTooltip.getCurrentNode() === this && nodeTooltip.isReadyForInput()) {
            Node.touchedNode = null; // Reset flag but allow purchase
            return false;
        }

        if (Node.touchedNode !== this.id) {
            // First tap — show the tooltip and mark this as the globally touched node ID
            Node.touchedNode = this.id;
            this._showHover();
            Node._updateSelectIndicator(this);
            return true;
        }

        // Second tap — check if tooltip is actually active/ready (fallback safety)
        if (typeof nodeTooltip !== 'undefined') {
            if (!nodeTooltip.isReadyForInput() || nodeTooltip.getCurrentNode() !== this) {
                // If not ready or showing a different node, treat as a "first tap" refresh
                this._showHover();
                return true;
            }
        }

        // Tooltip is ready and matches this node — reset flag and fall through to purchase
        Node.touchedNode = null;
        Node._updateSelectIndicator(null);
        return false;
    }

    getGhostAlpha() {
        if (this.revealed || this.level > 0) return 1.0;
        if (this.isDuoDescendant() || !this.parents || this.parents.length === 0) return 1.0;

        let allGhostOrHidden = true;
        for (let pid of this.parents) {
            const p = upgradeTree.getNode(pid);
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
        this._updateGhostIndicators();

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

        // Manually revealed nodes have full alpha but use ghost sprite
        const alpha = this.revealedManually ? 1.0 : this.getGhostAlpha();
        this.btn.setAlpha(alpha);

        // Ghost nodes should not show icons
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
            this.iconSprite.setAlpha(0.8);
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
            const p = upgradeTree.getNode(pid);
            if (p && p.state !== NODE_STATE.HIDDEN && (p.state !== NODE_STATE.GHOST || p.revealedManually)) {
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

        const wasVisible = this.duoBackingSprite.visible;
        this.duoBackingSprite.setVisible(true);

        // Only pulse if it's the very first time this backing is being revealed logically
        // and we are actually looking at the tree (prevents pulse on game load/refresh)
        if (!this._duoBackingRevealed && upgradeTree.isVisible()) {
            this._duoBackingRevealed = true;
            this._playDuoPulse(1.0, 1350, 2.0);
        } else if (isVisibleTier && anyParentActive) {
            // Ensure the logical flag is set even if we aren't pulsing (e.g. during initial load)
            this._duoBackingRevealed = true;
        }

        const sibling = upgradeTree.getNode(this.duoSiblingId);
        const shardCount = (typeof resourceManager !== 'undefined') ? resourceManager.getShards() : 0;
        const canAfford = !tierPurchased && shardCount > 0 && (this.isRequirementsMet() || (sibling && sibling.isRequirementsMet()));

        let parentPurchased = false;
        if (this.parents && this.parents.length > 0) {
            for (let pid of this.parents) {
                const p = upgradeTree.getNode(pid);
                if (p && p.level > 0) {
                    parentPurchased = true;
                    break;
                }
            }
        }

        if (tierPurchased) {
            // Already purchased state: active (lit blue)
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
        } else if (canAfford) {
            // Unpurchased but affordable state: bright (highlighted)
            this.duoBackingSprite.setTexture('buttons', 'duo_node_backing_bright.png');
            this.duoBackingSprite.setAlpha(1.0);

            if (this.duoBackingOutline) {
                this._stopDuoOutlineAnimation();
                this.duoBackingOutline.setAlpha(0);
                this.duoBackingOutline.setVisible(false);
            }
        } else if (parentPurchased) {
            // Unpurchased and unlocked but not affordable: active (lit blue)
            this.duoBackingSprite.setTexture('buttons', 'duo_node_backing_active.png');
            this.duoBackingSprite.setAlpha(1.0); // Always opaque to hide connecting lines

            if (this.duoBackingOutline) {
                this._stopDuoOutlineAnimation();
                this.duoBackingOutline.setAlpha(0);
                this.duoBackingOutline.setVisible(false);
            }
        } else {
            // Unpurchased and locked state: default texture
            this.duoBackingSprite.setTexture('buttons', 'duo_node_backing.png');
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
        nodeAnims.playFadeoutAnimation(this, spriteRef);
    }


    // ── hover tooltip ────────────────────────────────────────────────────

    _showHover(isPurchaseRefresh = false, purchaseCost = 0) {
        if (this.isPlaceholder || this.state === NODE_STATE.HIDDEN) return;
        if (this.state === NODE_STATE.GHOST && !this.revealedManually) return;
        nodeTooltip.show(this, isPurchaseRefresh, purchaseCost);

        if (this.state === NODE_STATE.UNLOCKED && !this.isMaxed()) {
            nodeAnims.playHoverJiggle(this);
        }

        if (typeof upgradeTree !== 'undefined') {
            const label = this.isDuoBox ? "TWIN NODE" : `${this.labelCategory} NODE`;
            upgradeTree.setHoverLabel(label);
        }
    }

    _hideHover() {
        if (this.isPlaceholder) return;
        this._tapConfirmed = false;
        if (nodeTooltip.getCurrentNode() === this) {
            nodeTooltip.hide();
            Node.touchedNode = null;
            Node._updateSelectIndicator(null);
        }

        if (typeof upgradeTree !== 'undefined') {
            upgradeTree.setHoverLabel(null);
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
            // Ghost nodes usually shouldn't show their icons, unless manually revealed
            this.iconSprite.setVisible(vis && !isHidden && (!isGhost || this.revealedManually));
        }
        if (this.label) {
            this.label.setVisible(vis && !isHidden);
        }
        if (this.ghost2Sprite) {
            this.ghost2Sprite.setVisible(vis && !isHidden && isGhost && this.requiresMaxParent);
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
        this._cleanupGhostIndicators();
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
        if (this.glowSprite) { this.glowSprite.destroy(); this.glowSprite = null; }
    }

    _updateGhostIndicators() {
        if (!this.requiresMaxParent) {
            return;
        }
        const wasGhost2Visible = this.ghost2Visible;

        // If not in a GHOST state or doesn't require max parents, clean up everything and exit
        const isGhost = this.state === NODE_STATE.GHOST;
        const shouldShowIndicators = isGhost && this.requiresMaxParent && !this.isPlaceholder;

        let parentsLeft = 0;
        if (shouldShowIndicators) {
            for (let pid of this.parents) {
                const p = upgradeTree.getNode(pid);
                const satisfied = p && p.branchActive && (p.isDuoBox ? this._isDuoTierPurchased(p.duoBoxTier) : (p.level >= p.maxLevel));
                if (!satisfied) {
                    parentsLeft++;
                }
            }
        }

        const draggableGroup = upgradeTree.getDraggableGroup();

        if (shouldShowIndicators && parentsLeft > 1) {
            // Show ghost 2
            if (!this.ghost2Sprite) {
                const treeScale = draggableGroup ? draggableGroup.getScale() : 1;
                this.ghost2Sprite = PhaserScene.add.image(this.btn.x, this.btn.y, 'buttons', 'node_ghost_2.png')
                    .setOrigin(0.5, 0.5)
                    .setDepth(this.btn.depth - 1)
                    .setScrollFactor(0)
                    .setScale(0.6 * treeScale);

                if (draggableGroup) {
                    draggableGroup.add(this.ghost2Sprite);
                }

                if (this.ghost2Tween) {
                    this.ghost2Tween.stop();
                }

                const scaleObj = { scale: 0.6 };
                this.ghost2Tween = PhaserScene.tweens.add({
                    targets: scaleObj,
                    scale: 1.0,
                    duration: 350,
                    ease: 'Cubic.easeOut',
                    onUpdate: () => {
                        if (this.ghost2Sprite && this.ghost2Sprite.scene && draggableGroup) {
                            draggableGroup.setChildLocalScale(this.ghost2Sprite, scaleObj.scale);
                        }
                    }
                });
            }

            // Set alpha based on node ghost alpha
            const alpha = this.revealedManually ? 1.0 : this.getGhostAlpha();
            this.ghost2Sprite.setAlpha(alpha);
            this.ghost2Visible = true;

        } else {
            console.log("ghost 2");
            // Hide ghost 2
            if (this.ghost2Sprite) {
                if (draggableGroup) draggableGroup.removeChild(this.ghost2Sprite);
                this.ghost2Sprite.destroy();
                this.ghost2Sprite = null;
            }
            if (this.ghost2Tween) {
                this.ghost2Tween.stop();
                this.ghost2Tween = null;
            }
            this.ghost2Visible = false;

            // Trigger single pulse ONLY if it was previously visible and now turned invisible
            if (wasGhost2Visible) {
                if (upgradeTree && upgradeTree.playIndicatorPulse) {
                    upgradeTree.playIndicatorPulse(this.btn.x, this.btn.y);
                }
            }
        }
    }

    _cleanupGhostIndicators() {
        if (this.ghost2Sprite) {
            const draggableGroup = upgradeTree.getDraggableGroup();
            if (draggableGroup) {
                draggableGroup.removeChild(this.ghost2Sprite);
            }
            this.ghost2Sprite.destroy();
            this.ghost2Sprite = null;
        }
        if (this.ghost2Tween) {
            this.ghost2Tween.stop();
            this.ghost2Tween = null;
        }
        this.ghost2Visible = false;
    }

    _playDuoPulse(scaleMult = 1.0, durationOverride = 1100, scaleOverride = 1.6) {
        nodeAnims.playDuoPulse(this, scaleMult, durationOverride, scaleOverride);
    }

    /**
     * Updates the node's position both in logic and visually.
     * @param {number} x - The new treeX coordinate.
     * @param {number} y - The new treeY coordinate.
     */
    setPosition(x, y) {
        this.treeX = x;
        this.treeY = y;

        const offsetX = 8;
        const group = upgradeTree.getDraggableGroup();
        const gx = group ? group.x : 0;
        const gy = group ? group.y : 0;
        const gs = group ? group.getScale() : 1;

        let visualX = (x + offsetX) * gs + gx;
        let visualY = y * gs + gy;
        let iconX = visualX;

        if (this.btn) this.btn.setPosition(visualX, visualY);
        if (this.iconSprite) this.iconSprite.setPosition(iconX, visualY);
        if (this.fadeoutSprite) this.fadeoutSprite.setPosition(visualX, visualY);
        if (this.glowSprite) this.glowSprite.setPosition(visualX, visualY);
        if (this.ghost2Sprite) this.ghost2Sprite.setPosition(visualX, visualY);

        // Crucial: Update the VirtualGroup's recorded offsets so it doesn't snap back
        if (group) {
            group.recalculateOffsets();
        }
    }

    /**
     * Optimized visibility check for culling.
de the current viewport to save draw calls.
     */
    updateVisibility() {
        if (!this.btn || this.state === NODE_STATE.HIDDEN) return;

        const group = upgradeTree.getDraggableGroup();
        const screenX = this.btn.x;
        const screenY = this.btn.y;

        // Viewport margin (relaxed to prevent popping)
        const margin = 150;
        const isVisible = (screenX > -margin && screenX < GAME_CONSTANTS.halfWidth + margin &&
            screenY > -margin && screenY < GAME_CONSTANTS.HEIGHT + margin);

        this.btn.setVisible(isVisible);
        if (this.iconSprite) {
            this.iconSprite.setVisible(isVisible && (this.state !== NODE_STATE.GHOST || this.revealedManually));
        }
    }

    /**
     * Plays a pop-in animation for manually revealed nodes.
     */
    playRevealAnimation() {
        if (!this.btn) return;

        // Start at 70% scale
        const startScale = 0.85;
        this.btn.setScale(startScale);
        if (this.iconSprite) this.iconSprite.setScale(startScale);

        // Tween to 100% scale with Back.easeOut
        let spriteTargets = [this.btn, this.iconSprite].filter(Boolean)
        PhaserScene.tweens.add({
            targets: spriteTargets,
            scale: 1.25,
            duration: 100,
            ease: 'Cubic.easeOut',
            onComplete: () => {
                PhaserScene.tweens.add({
                    targets: spriteTargets,
                    scale: 1,
                    duration: 500,
                    ease: 'Back.easeOut',
                });
            }
        });
    }

    /**
     * Manages the global selection indicator (NineSlice) for mobile touch states.
     * @param {Node|null} node - The node to highlight, or null to hide.
     */
    static _updateSelectIndicator(node) {
        if (!PhaserScene) return;

        if (!Node.selectIndicator) {
            // Updated: select_indicator.png is now a standard image asset
            Node.selectIndicator = PhaserScene.add.image(0, 0, 'buttons', 'select_indicator.png');
            Node.selectIndicator.setDepth(GAME_CONSTANTS.DEPTH_UPGRADE_TREE + 10);
            Node.selectIndicator.setScrollFactor(0);
            Node.selectIndicator.setVisible(false);

            // Add to draggableGroup to ensure it respects the tree mask and moves with the tree
            if (typeof upgradeTree !== 'undefined') {
                const group = upgradeTree.getDraggableGroup();
                if (group) group.add(Node.selectIndicator);
            }
        }

        if (!node || !node.btn || node.isDuoBox || node.isMaxed()) {
            if (Node.selectIndicator) Node.selectIndicator.setVisible(false);
            return;
        }

        // Snap to node button position
        Node.selectIndicator.setPosition(node.btn.x, node.btn.y);

        // Update frame based on cost type
        const frame = (node.costType === 'insight') ? 'select_indicator_insight.png' : 'select_indicator.png';
        Node.selectIndicator.setFrame(frame);

        Node.selectIndicator.setScale(1.09);
        PhaserScene.tweens.add({
            targets: Node.selectIndicator,
            scale: 0.975,
            duration: 80,
            ease: 'Quart.easeOut',
            onComplete: () => {
                PhaserScene.tweens.add({
                    targets: Node.selectIndicator,
                    scale: 1,
                    duration: 200,
                    ease: 'Back.easeOut',
                });
            }
        });
        Node.selectIndicator.setVisible(true);

        // Sync scale with tree zoom level
        const gs = (group && group.getScale()) || 1;
        Node.selectIndicator.setScale(gs);

        // Update the stored offset in the VirtualGroup so it stays attached during dragging
        if (group) group.recalculateOffsets();
    }
}

