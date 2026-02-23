// popupManager.js

// ─── Generic popup ────────────────────────────────────────────────────────────
//
// showPopup({ title, body, buttons, depth, fast })
//
// buttons = [{ text, onClick, primary }]
//   primary: true  → blue button  (confirm / yes)
//   primary: false → dark button  (cancel / no)
//
// Returns a closePopup() function.
// Works with any game — only requires 'white_pixel' (always in Phase 1 preload).

function showPopup({ title = '', body = '', buttons = [], depth = 111000, fast = false } = {}) {
    const W = GAME_CONSTANTS.halfWidth;
    const H = GAME_CONSTANTS.halfHeight;

    const POPUP_W = 460;
    const BTN_H   = 42;
    const BTN_Y   = H + 70;
    const POPUP_H = 200;

    // Dark overlay
    const darkBG = PhaserScene.add.image(W, H, 'white_pixel')
        .setScale(GAME_CONSTANTS.WIDTH, GAME_CONSTANTS.HEIGHT)
        .setTint(0x000000).setAlpha(0).setDepth(depth);

    // Click blocker
    const blocker = new Button({
        normal: { ref: 'white_pixel', x: W, y: H, scaleX: GAME_CONSTANTS.WIDTH, scaleY: GAME_CONSTANTS.HEIGHT, alpha: 0.001, tint: 0x000000 }
    });
    blocker.setDepth(depth);

    // Popup box
    const popupBG = PhaserScene.add.image(W, H - 10, 'white_pixel')
        .setScale(POPUP_W, POPUP_H).setTint(0x1a1a2e).setAlpha(0).setDepth(depth + 1);

    // Animate in
    const dur = fast ? 1 : 60;
    PhaserScene.tweens.add({ targets: darkBG,  alpha: 0.75,  ease: 'Cubic.easeOut', duration: dur });
    PhaserScene.tweens.add({ targets: popupBG, alpha: 1,     ease: 'Back.easeOut',  duration: fast ? 1 : 220 });

    // Title
    const titleObj = PhaserScene.add.text(W, H - 10 - POPUP_H * 0.5 + 32, title, {
        fontFamily: 'Arial', fontSize: 24, color: '#ffffff', fontStyle: 'bold', align: 'center'
    }).setOrigin(0.5, 0.5).setDepth(depth + 2).setAlpha(0);

    // Body
    const bodyObj = PhaserScene.add.text(W, H - 10, body, {
        fontFamily: 'Arial', fontSize: 19, color: '#cccccc', align: 'center',
        wordWrap: { width: POPUP_W - 48 }
    }).setOrigin(0.5, 0.5).setDepth(depth + 2).setAlpha(0);

    PhaserScene.tweens.add({ targets: [titleObj, bodyObj], alpha: 1, ease: 'Cubic.easeOut', duration: fast ? 1 : 220 });

    const btnObjs = [];

    function closePopup() {
        darkBG.destroy();
        popupBG.destroy();
        titleObj.destroy();
        bodyObj.destroy();
        blocker.destroy();
        btnObjs.forEach(b => b.destroy());
    }

    // Layout buttons evenly
    const BTN_W    = 140;
    const GAP      = 20;
    const n        = buttons.length;
    const totalW   = n * BTN_W + (n - 1) * GAP;
    const startX   = W - totalW / 2 + BTN_W / 2;

    buttons.forEach((def, i) => {
        const bx         = startX + i * (BTN_W + GAP);
        const tintNormal = def.primary ? 0x2c5282 : 0x2d3748;
        const tintHover  = def.primary ? 0x3a6ba8 : 0x4a5568;
        const tintPress  = def.primary ? 0x1a3561 : 0x1a202c;

        const btn = new Button({
            normal:  { ref: 'white_pixel', x: bx, y: BTN_Y, scaleX: BTN_W, scaleY: BTN_H, tint: tintNormal },
            hover:   { tint: tintHover },
            press:   { tint: tintPress },
            disable: { alpha: 0 },
            onMouseUp: () => {
                closePopup();
                if (def.onClick) def.onClick();
            }
        });
        btn.setDepth(depth + 2);
        btn.addText(def.text, { fontFamily: 'Arial', fontSize: 18, color: '#ffffff', align: 'center' });
        btnObjs.push(btn);
    });

    return closePopup;
}

// ─── Yes / No convenience wrapper ─────────────────────────────────────────────

function showYesNoPopup(yesText, noText, titleText = '...', bodyText = '...', onYes = () => {}, superFast = false) {
    const darkBG = PhaserScene.add.image(GAME_CONSTANTS.halfWidth, GAME_CONSTANTS.halfHeight, 'black_pixel')
        .setScale(500).setDepth(110900).setAlpha(0);
    const dieClickBlocker = new Button({
        normal: { ref: 'black_pixel', x: GAME_CONSTANTS.halfWidth, y: GAME_CONSTANTS.halfHeight, alpha: 0.001, scaleX: 1000, scaleY: 1000 },
        onMouseUp: () => {}
    });
    PhaserScene.tweens.add({ targets: darkBG, alpha: 0.75, ease: 'Cubic.easeOut', duration: superFast ? 0.2 : 50 });

    const popupBG = PhaserScene.add.image(GAME_CONSTANTS.halfWidth, GAME_CONSTANTS.halfHeight - 40, 'ui', 'paper_half.png')
        .setDepth(111000).setScale(0.7, 0.58);
    const newText = PhaserScene.add.text(GAME_CONSTANTS.halfWidth, popupBG.y - 75, titleText, { fontFamily: 'Arial', fontSize: 30, color: '#000000', align: 'center' })
        .setOrigin(0.5, 0.5).setDepth(111000).setAlpha(0.1);
    const descText = PhaserScene.add.text(GAME_CONSTANTS.halfWidth, popupBG.y - 17, bodyText, { fontFamily: 'Arial', fontSize: 24, color: '#000000', align: 'center' })
        .setOrigin(0.5, 0.5).setDepth(111000).setAlpha(0.1);

    PhaserScene.tweens.add({ targets: [newText, descText], alpha: 1,          ease: 'Cubic.easeOut', duration: superFast ? 0.7 : 200 });
    PhaserScene.tweens.add({ targets: popupBG,             scaleX: 0.72, scaleY: 0.6, ease: 'Back.easeOut', duration: superFast ? 0.7 : 200 });

    const canvas = PhaserScene.sys.canvas;
    let noBtn, closeBtn;

    const yesBtn = new Button({
        normal:  { ref: 'menu_btn_normal.png',  atlas: 'buttons', x: GAME_CONSTANTS.halfWidth + 128, y: popupBG.y + 55 },
        hover:   { ref: 'menu_btn_hover.png',   atlas: 'buttons' },
        press:   { ref: 'menu_btn_hover.png',   atlas: 'buttons' },
        disable: { alpha: 0 },
        onHover:    () => { if (canvas) canvas.style.cursor = 'pointer'; },
        onHoverOut: () => { if (canvas) canvas.style.cursor = 'default'; },
        onMouseUp: () => {
            if (noBtn)    noBtn.destroy();
            if (closeBtn) closeBtn.destroy();
            yesBtn.destroy();
            darkBG.destroy();
            dieClickBlocker.destroy();
            popupBG.destroy();
            newText.destroy();
            descText.destroy();
            onYes();
        }
    });
    yesBtn.setOrigin(0.5, 0.5);
    yesBtn.addText(yesText, { fontFamily: 'Arial', fontSize: 28, color: '#000000', align: 'center' });
    yesBtn.setDepth(111000);
    yesBtn.setScale(0.7);

    closeBtn = new Button({
        normal:  { ref: 'closebtn.png',       atlas: 'buttons', alpha: 0.95, x: GAME_CONSTANTS.halfWidth + 190, y: popupBG.y - 95 },
        hover:   { ref: 'closebtn_hover.png', atlas: 'buttons', alpha: 1 },
        press:   { ref: 'closebtn_press.png', atlas: 'buttons', alpha: 1 },
        disable: { ref: 'closebtn.png',       atlas: 'buttons', alpha: 0 },
        onHover:    () => { if (canvas) canvas.style.cursor = 'pointer'; },
        onHoverOut: () => { if (canvas) canvas.style.cursor = 'default'; },
        onMouseUp: () => {
            closeBtn.destroy();
            noBtn.destroy();
            yesBtn.destroy();
            darkBG.destroy();
            dieClickBlocker.destroy();
            newText.destroy();
            descText.destroy();
            popupBG.destroy();
        }
    });
    closeBtn.setOrigin(0.5, 0.5);
    closeBtn.setDepth(111000);

    const itemsToDestroy = [closeBtn, null, yesBtn, darkBG, dieClickBlocker, newText, descText, popupBG];

    noBtn = new Button({
        normal:  { ref: 'menu_btn2_normal.png', atlas: 'buttons', x: GAME_CONSTANTS.halfWidth - 128, y: popupBG.y + 55 },
        hover:   { ref: 'menu_btn2_hover.png',  atlas: 'buttons' },
        press:   { ref: 'menu_btn2_hover.png',  atlas: 'buttons' },
        disable: { alpha: 0 },
        onHover:    () => { if (canvas) canvas.style.cursor = 'pointer'; },
        onHoverOut: () => { if (canvas) canvas.style.cursor = 'default'; },
        onMouseUp: () => {
            itemsToDestroy[1] = noBtn;
            itemsToDestroy.forEach(item => { if (item) item.destroy(); });
        }
    });
    itemsToDestroy[1] = noBtn;

    noBtn.setOrigin(0.5, 0.5);
    noBtn.addText(noText, { fontFamily: 'Arial', fontSize: 28, color: '#000000', align: 'center' });
    noBtn.setDepth(111000);
    noBtn.setScale(0.7);

    return itemsToDestroy;
}
