// coinMine.js — Phase 3 UI for depositing DATA and mining NETCOIN.
// Accessed via a button in the Upgrade Tree.

const coinMine = (() => {
    let bgOverlay = null;
    let blocker = null;
    let popupBg = null;
    let closeBtn = null;
    let titleText = null;
    let visible = false;
    function init() {
        const depth = GAME_CONSTANTS.DEPTH_POPUPS;
        const cx = GAME_CONSTANTS.halfWidth;
        const cy = GAME_CONSTANTS.halfHeight;
        const width = 800;
        const height = 600;

        bgOverlay = PhaserScene.add.image(cx, cy, 'white_pixel');
        bgOverlay.setDisplaySize(GAME_CONSTANTS.WIDTH, GAME_CONSTANTS.HEIGHT);
        bgOverlay.setTint(0x000000).setAlpha(0.75).setDepth(depth);
        bgOverlay.setScrollFactor(0);
        bgOverlay.setInteractive();

        blocker = new Button({
            normal: { ref: 'white_pixel', x: cx, y: cy, alpha: 0.001, scaleX: GAME_CONSTANTS.WIDTH, scaleY: GAME_CONSTANTS.HEIGHT }
        });
        blocker.setDepth(depth + 1);
        blocker.setScrollFactor(0);

        popupBg = PhaserScene.add.nineslice(cx, cy, 'ui', 'popup_nineslice.png', width, height, 64, 64, 64, 64);
        popupBg.setDepth(depth + 2);
        popupBg.setScrollFactor(0);

        titleText = PhaserScene.add.text(cx - width / 2 + 30, cy - height / 2 + 20, t('ui', 'coin_mine'), {
            fontFamily: 'JetBrainsMono_Bold',
            fontSize: '26px',
            color: '#ff9500',
        }).setOrigin(0, 0).setDepth(depth + 3).setScrollFactor(0).setShadow(2, 2, '#000000', 2, true, true);

        closeBtn = new Button({
            normal: { ref: 'close_button_normal.png', atlas: 'ui', x: cx + width / 2 - 35, y: cy - height / 2 + 36 },
            hover: { ref: 'close_button_hover.png', atlas: 'ui' },
            press: { ref: 'close_button_press.png', atlas: 'ui' },
            onMouseUp: hide
        });
        closeBtn.setDepth(depth + 3);
        closeBtn.setScrollFactor(0);

        _hideAll();
    }

    function show() {
        visible = true;

        bgOverlay.setVisible(true);
        blocker.setVisible(true);
        blocker.setState(NORMAL);
        popupBg.setVisible(true);
        titleText.setVisible(true);
        closeBtn.setVisible(true);
        closeBtn.setState(NORMAL);
    }

    function hide() {
        visible = false;
        _hideAll();
    }

    function _hideAll() {
        if (popupBg) popupBg.setVisible(false);
        if (titleText) titleText.setVisible(false);
        if (bgOverlay) bgOverlay.setVisible(false);
        if (blocker) {
            blocker.setVisible(false);
            blocker.setState(DISABLE);
        }
        if (closeBtn) {
            closeBtn.setVisible(false);
            closeBtn.setState(DISABLE);
        }
    }

    function isVisible() {
        return visible;
    }

    return { init, show, hide, isVisible };
})();
