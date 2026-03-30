/**
 * Specialized Node for Shard choices in the Duo Box.
 * Uses 'duo_node_button' assets.
 */
class DuoNode extends Node {
    constructor(def) {
        super(def);
        this.prefix = 'duo_node_button';
    }

    _getUnlockedSprite() {
        return `${this.prefix}_normal.png`;
    }

    _getUnlockedDisabledSprite() {
        return `${this.prefix}_normal.png`;
    }

    _getHoverSprite() {
        return `${this.prefix}_hover.png`;
    }

    _getPressSprite() {
        return `${this.prefix}_press.png`;
    }

    _applyVisualDepth() {
        // Adjust depth so maxed duo nodes sit 1 depth lower (behind the active overlapping sibling)
        const baseDepth = GAME_CONSTANTS.DEPTH_UPGRADE_TREE + 2;
        if (this.state === NODE_STATE.MAXED) {
            this.btn.setDepth(baseDepth);
            if (this.iconSprite) this.iconSprite.setDepth(baseDepth + 1);
        } else {
            this.btn.setDepth(baseDepth + 1);
            if (this.iconSprite) this.iconSprite.setDepth(baseDepth + 2);
        }
    }
}
