/**
 * @fileoverview Animation utilities for Upgrade Tree nodes.
 * Decouples visual effects and tweens from the core Node logic.
 */

const nodeAnims = {

    /**
     * Plays a glowing expansion animation when a node is revealed.
     * @param {Node} node 
     */
    playRevealGlow: (node) => {
        if (!node.glowSprite) return;
        node.glowSprite.setVisible(true).setAlpha(1);
        node.glowSprite.play('node_glow');
        node.glowSprite.once('animationcomplete', () => {
            if (node.glowSprite) node.glowSprite.setVisible(false).setAlpha(0);
        });
    },

    /**
     * Highlights a node when it reaches its maximum level.
     * @param {Node} node 
     */
    playMaxedAnimation: (node) => {
        if (!node.btn) return;

        const baseScaleX = node.btn.scaleX;
        const baseScaleY = node.btn.scaleY;
        node.btn.setScale(baseScaleX * 0.9, baseScaleY * 0.9);

        PhaserScene.tweens.add({
            targets: node.btn,
            scaleX: baseScaleX,
            scaleY: baseScaleY,
            duration: 250,
            easeParams: [2.5],
            ease: 'Back.easeOut',
        });
    },

    /**
     * Fades in a "ghost" node (unlocked but not yet purchasable/revealed).
     * @param {Node} node 
     */
    playGhostFadeIn: (node) => {
        if (!node.btn) return;

        const endAlpha = node.getGhostAlpha();
        if (endAlpha === 0) return;

        const baseScaleX = node.btn.scaleX;
        const baseScaleY = node.btn.scaleY;

        // Set starting state
        node.btn.setAlpha(endAlpha * 0.2);
        node.btn.setScale(baseScaleX * 0.75, baseScaleY * 0.75);

        // Alpha fade — 400ms
        PhaserScene.tweens.add({
            targets: node.btn,
            alpha: endAlpha,
            duration: 400,
            ease: 'Linear'
        });

        // Scale pop — 500ms
        PhaserScene.tweens.add({
            targets: node.btn,
            scaleX: baseScaleX,
            scaleY: baseScaleY,
            duration: 500,
            easeParams: [2.5],
            ease: 'Back.easeOut'
        });
    },

    /**
     * Plays a quick punchy scale/rotate animation upon purchase.
     * @param {Node} node 
     */
    playLocalPurchaseAnimations: (node) => {
        if (!node.btn || node.isDuoBox) return;

        const currentScaleX = node.btn.scaleX;
        const targetScaleX = (currentScaleX >= 0 ? 1 : -1);
        node.btn.rotation = 0.2;
        node.btn.setScale((currentScaleX >= 0 ? 0.95 : -0.95), 0.95);

        PhaserScene.tweens.add({
            targets: node.btn,
            rotation: -0.1,
            scaleX: targetScaleX,
            scaleY: 1,
            duration: 130,
            ease: 'Cubic.easeOut',
            onComplete: () => {
                PhaserScene.tweens.add({
                    targets: node.btn,
                    rotation: 0,
                    duration: 120,
                    ease: 'Back.easeOut'
                });
            }
        });
    },

    /**
     * Overlays a fading sprite of the old state to smooth visual transitions.
     * @param {Node} node 
     * @param {string} spriteRef - The texture key of the old sprite.
     */
    playFadeoutAnimation: (node, spriteRef) => {
        // Stop any existing tween
        if (node.fadeoutTween) {
            node.fadeoutTween.stop();
            node.fadeoutTween = null;
        }

        if (!node.fadeoutSprite || !spriteRef) return;

        // Set fadeout sprite to the old sprite and make it visible
        node.fadeoutSprite.setTexture('buttons', spriteRef);
        node.fadeoutSprite.setAlpha(1);

        // Tween to alpha 0 over 400ms
        node.fadeoutTween = PhaserScene.tweens.add({
            targets: node.fadeoutSprite,
            alpha: 0,
            duration: 400,
            ease: 'Linear',
            onComplete: () => {
                node.fadeoutTween = null;
            }
        });
    },

    /**
     * Plays a "ripple" pulse effect from a Duo-Box center or specific node.
     * @param {Node} node 
     * @param {number} scaleMult - Size multiplier for the pulse.
     */
    playDuoPulse: (node, scaleMult = 1.0) => {
        if (!node.btn) return;

        let x = node.btn.x;
        let y = node.btn.y;

        // Find the center of the duo box if applicable
        if (node._isDuoBackingOwner && node.duoBackingSprite) {
            x = node.duoBackingSprite.x;
            y = node.duoBackingSprite.y;
        } else {
            const sibling = upgradeTree.getNode(node.duoSiblingId);
            if (sibling && sibling.duoBackingSprite) {
                x = sibling.duoBackingSprite.x;
                y = sibling.duoBackingSprite.y;
            }
        }

        const pulseDepth = node.btn.depth + 1;

        const pulse = PhaserScene.add.sprite(x, y, 'buttons', 'duo_node_pulse.png')
            .setOrigin(0.5, 0.5)
            .setDepth(pulseDepth)
            .setScrollFactor(0)
            .setAlpha(1.1)
            .setScale(0.95);

        const treeGroup = upgradeTree.getGroup();
        const draggableGroup = upgradeTree.getDraggableGroup();
        if (treeGroup) treeGroup.add(pulse);
        if (draggableGroup) draggableGroup.add(pulse);

        PhaserScene.tweens.add({
            targets: pulse,
            alpha: 0,
            duration: 1100,
        });

        PhaserScene.tweens.add({
            targets: pulse,
            scaleX: 1.6 * scaleMult,
            scaleY: 1.6 * scaleMult,
            duration: 1100,
            ease: 'Quart.easeOut',
            onComplete: () => {
                if (treeGroup) treeGroup.removeChild(pulse);
                if (draggableGroup) draggableGroup.removeChild(pulse);
                pulse.destroy();
            }
        });
    }
};
