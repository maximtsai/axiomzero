// notificationManager.js
// Floating toast notifications — call notificationManager.notify() from anywhere.

const notificationManager = (() => {
    const DEPTH = 99000;

    /**
     * Show a floating text notification that rises and fades out.
     *
     * @param {string} text - Message to display
     * @param {object} opts
     * @param {number}  opts.x        - Screen X (default: center)
     * @param {number}  opts.y        - Screen Y (default: upper-center)
     * @param {number}  opts.duration - Fade duration in ms (default 1400)
     * @param {string}  opts.color    - Text color (default '#ffffff')
     * @param {number}  opts.fontSize - Font size in px (default 24)
     * @returns {Phaser.GameObjects.Text}
     */
    function notify(text, opts = {}) {
        if (!PhaserScene) return null;

        const x    = opts.x        !== undefined ? opts.x        : GAME_CONSTANTS.halfWidth;
        const y    = opts.y        !== undefined ? opts.y        : GAME_CONSTANTS.halfHeight - 60;
        const dur  = opts.duration !== undefined ? opts.duration : 1400;
        const col  = opts.color    || '#ffffff';
        const size = opts.fontSize || 24;

        const t = PhaserScene.add.text(x, y, text, {
            fontFamily:      'Arial',
            fontSize:        size,
            color:           col,
            stroke:          '#000000',
            strokeThickness: 4,
            align:           'center',
        }).setOrigin(0.5, 0.5).setDepth(DEPTH);

        PhaserScene.tweens.add({
            targets:  t,
            y:        y - 55,
            alpha:    0,
            duration: dur,
            ease:     'Cubic.easeOut',
            onComplete: () => { if (t && t.active) t.destroy(); }
        });

        return t;
    }

    return { notify };
})();
