/**
 * @fileoverview Manages the Financial Takeover interface popup.
 */
const takeoverPopup = (() => {
    let overlay = null;
    let elements = [];
    let isVisible = false;

    function show() {
        if (isVisible) return;
        isVisible = true;

        audio.play('retro1', 1.0);
        const cx = GAME_CONSTANTS.halfWidth;
        const cy = GAME_CONSTANTS.halfHeight;
        const depth = GAME_CONSTANTS.DEPTH_POPUPS + 2000;

        // Black back screen — Click blocker
        overlay = PhaserScene.add.image(cx, cy, 'buttons', 'black_pixel.png')
            .setAlpha(0.65)
            .setDisplaySize(GAME_CONSTANTS.WIDTH, GAME_CONSTANTS.HEIGHT)
            .setScrollFactor(0)
            .setDepth(depth);

        const blocker = helper.createGlobalClickBlocker(false).setDepth(depth + 0.5);
        if (typeof upgradeTree !== 'undefined' && upgradeTree.assignToUICamera) {
            upgradeTree.assignToUICamera(blocker);
        }

        const width = 950;
        const height = 600;

        const bg = helper.createNineSlice(cx, cy, 'buttons', 'popup_nineslice.png', width, height, 64, 64, 64, 64);
        bg.setDepth(depth + 1).setScrollFactor(0);
        elements.push(bg);

        // Title
        const titleText = t('ui', 'takeover') || 'TAKEOVER';
        const title = PhaserScene.add.text(cx, cy - height / 2 + 45, titleText, {
            fontFamily: 'Quantico-Bold',
            fontSize: '42px',
            color: '#FFD700',
            align: 'center',
        }).setOrigin(0.5).setShadow(2, 2, '#000000', 2, true, true).setDepth(depth + 2).setScrollFactor(0);
        elements.push(title);

        // Placeholder content
        const body = PhaserScene.add.text(cx, cy, 'INTERFACE LOADING...\n[ENCRYPTION ACTIVE]', {
            fontFamily: 'Quantico-Bold',
            fontSize: '24px',
            color: '#ffffff',
            align: 'center',
        }).setOrigin(0.5).setDepth(depth + 2).setScrollFactor(0);
        elements.push(body);

        // TOP-RIGHT Close Button (similar to Options Popup)
        const topCloseBtn = new Button({
            normal: { ref: 'close_button_normal.png', atlas: 'buttons', x: cx + width / 2 - 35, y: cy - height / 2 + 36 },
            hover: { ref: 'close_button_hover.png', atlas: 'buttons' },
            press: { ref: 'close_button_press.png', atlas: 'buttons' },
            onMouseUp: hide
        });
        topCloseBtn.setDepth(depth + 3);
        topCloseBtn.setScrollFactor(0);
        elements.push(topCloseBtn);

        // BOTTOM BACK Button
        const backText = t('ui', 'back') || 'BACK';
        const backBtn = new Button({
            normal: { ref: helper.isMobileDevice() ? 'button_normal_mobile.png' : 'button_normal.png', atlas: 'buttons', x: cx, y: cy + height / 2 - 65 },
            hover: { ref: 'button_hover.png', atlas: 'buttons', x: cx, y: cy + height / 2 - 65 },
            press: { ref: 'button_press.png', atlas: 'buttons', x: cx, y: cy + height / 2 - 65 },
            onMouseUp: hide
        });
        backBtn.setScale(0.75).addText(backText, { fontFamily: 'Quantico-Bold', fontSize: '28px', color: '#ffffff' });
        backBtn.setDepth(depth + 2);
        backBtn.setScrollFactor(0);
        elements.push(backBtn);

        if (typeof upgradeTree !== 'undefined' && upgradeTree.getUICamera()) {
            upgradeTree.assignToUICamera(overlay);
            elements.forEach(el => upgradeTree.assignToUICamera(el));
        }
    }

    function hide() {
        if (!isVisible) return;
        isVisible = false;

        if (overlay) {
            overlay.destroy();
            overlay = null;
            helper.hideGlobalClickBlocker();
        }
        elements.forEach(el => {
            if (el && el.destroy) el.destroy();
        });
        elements = [];
    }

    function isOpen() {
        return isVisible;
    }

    return {
        show,
        hide,
        isOpen
    };
})();
