'use strict';

// effectPool.js — Click effect object pooling.
// Extends the `helper` object defined in typewriterHelper.js.

Object.assign(helper, {
    clickEffectPool: null,

    /** Must be called once after the Phaser scene is ready (pass PhaserScene). */
    initClickEffectPool: function(scene) {
        helper.clickEffectPool = new ObjectPool(
            function()    { return scene.add.image(0, 0, 'white_pixel'); },
            function(obj) {
                obj.setActive(false);
                obj.setVisible(false);
                obj.setScale(1);
                obj.setAlpha(0.6);
                obj.setDepth(10000);
            },
            50
        );
    },

    /** Spawns a brief expanding-then-collapsing flash at (x, y). */
    createClickEffect: function(x, y) {
        let clickImage;
        if (helper.clickEffectPool && helper.clickEffectPool.getPoolSize() > 0) {
            clickImage = helper.clickEffectPool.get();
            clickImage.setPosition(x, y);
            clickImage.setActive(true);
            clickImage.setVisible(true);
        } else {
            clickImage = PhaserScene.add.image(x, y, 'white_pixel');
            clickImage.setAlpha(0.6);
            clickImage.setDepth(10000);
            clickImage.setScale(7);
        }

        const releaseImage = function() {
            if (helper.clickEffectPool && helper.clickEffectPool.getPoolSize() < 50) {
                helper.clickEffectPool.release(clickImage);
            } else {
                clickImage.destroy();
            }
        };

        PhaserScene.tweens.add({
            targets: clickImage,
            scaleX: 11, scaleY: 11,
            duration: 50,
            ease: 'Quad.easeIn',
            onComplete: function() {
                PhaserScene.tweens.add({
                    targets: clickImage,
                    scaleX: 0, scaleY: 0,
                    duration: 250,
                    ease: 'Quad.easeOut',
                    onComplete: function() { releaseImage(); }
                });
            }
        });
    },
});
