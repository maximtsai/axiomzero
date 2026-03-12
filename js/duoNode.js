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
                if (this.parents && this.parents.length > 0) {
                    let allGhostOrHidden = true;
                    for (let pid of this.parents) {
                        const parentNode = neuralTree.getNode(pid);
                        if (parentNode && parentNode.state !== NODE_STATE.GHOST && parentNode.state !== NODE_STATE.HIDDEN) {
                            allGhostOrHidden = false;
                            break;
                        }
                    }
                    if (allGhostOrHidden) ghostAlpha = 0.5;
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
                this.btn.setDisableRef(`${p}_maxed.png`);
                this.btn.setState(DISABLE);
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
