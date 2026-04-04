/**
 * Specialized Node for Shard choices in the Duo Box.
 * Uses 'duo_node_button' assets.
 */
class DuoNode extends Node {
    constructor(def) {
        super(def);
        this.prefix = 'duo_node_button';
    }

    _applyGhostVisuals() {
        const suffix = this._getDuoSide() === 'right' ? '2' : '';
        const sprite = `${this.prefix}_ghost${suffix}.png`;
        this.btn.setDisableRef(sprite);
        this.btn.setVisible(true);
        this.btn.setState(DISABLE);
        this.btn.setAlpha(this.getGhostAlpha());
        if (this.iconSprite) this.iconSprite.setVisible(false);
        return sprite;
    }

    _applyMaxedVisuals() {
        const suffix = this._getDuoSide() === 'right' ? '2' : '';
        const sprite = `${this.prefix}_maxed${suffix}.png`;
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
        const suffix = this._getDuoSide() === 'right' ? '2' : '';
        return `${this.prefix}_normal${suffix}.png`;
    }

    _getUnlockedDisabledSprite() {
        const suffix = this._getDuoSide() === 'right' ? '2' : '';
        return `${this.prefix}_normal${suffix}.png`;
    }

    _getHoverSprite() {
        const suffix = this._getDuoSide() === 'right' ? '2' : '';
        return `${this.prefix}_hover${suffix}.png`;
    }

    _getPressSprite() {
        const suffix = this._getDuoSide() === 'right' ? '2' : '';
        return `${this.prefix}_press${suffix}.png`;
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
