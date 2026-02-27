// popupManager.js

// ─── Layout constants ──────────────────────────────────────────────────────────
const _POPUP = {
    DEPTH:         111000,  // content depth for both popup types
    OVERLAY_DEPTH: 110900,  // dark overlay sits just below content
    W:             460,     // showPopup box width
    H:             200,     // showPopup box height
    BTN_H:         42,      // showPopup button height
    BTN_W:         140,     // showPopup button width
    BTN_GAP:       20,      // gap between showPopup buttons
    FONT_TITLE:    24,      // showPopup title font size
    FONT_BODY:     19,      // showPopup body font size
    FONT_BTN:      18,      // showPopup button font size
    FONT_YN:       28,      // showYesNoPopup button / title font size
    FONT_YN_TITLE: 30,      // showYesNoPopup title font size
    FONT_YN_BODY:  24,      // showYesNoPopup body font size
};

// ─── Private helpers ───────────────────────────────────────────────────────────

/**
 * Creates a dark full-screen overlay image at the screen centre and tweens
 * it to targetAlpha.  Returns the image for later cleanup.
 *
 * opts: { ref, scaleX, scaleY, tint, depth, targetAlpha, duration }
 */
function _createDarkOverlay(opts) {
    const ref     = opts.ref         || 'black_pixel';
    const scaleX  = opts.scaleX      || 500;
    const scaleY  = opts.scaleY      || scaleX;
    const alpha   = opts.targetAlpha !== undefined ? opts.targetAlpha : 0.75;
    const dur     = opts.duration    !== undefined ? opts.duration    : 60;

    const img = PhaserScene.add.image(GAME_CONSTANTS.halfWidth, GAME_CONSTANTS.halfHeight, ref)
        .setScale(scaleX, scaleY).setDepth(opts.depth).setAlpha(0);
    if (opts.tint !== undefined) { img.setTint(opts.tint); }
    PhaserScene.tweens.add({ targets: img, alpha, ease: 'Cubic.easeOut', duration: dur });
    return img;
}

/**
 * Creates an invisible full-screen click-blocker button at the given depth.
 * Returns the Button.
 */
function _createFullscreenBlocker(depth) {
    const blocker = new Button({
        normal: {
            ref:    'white_pixel',
            x:      GAME_CONSTANTS.halfWidth,
            y:      GAME_CONSTANTS.halfHeight,
            scaleX: GAME_CONSTANTS.WIDTH,
            scaleY: GAME_CONSTANTS.HEIGHT,
            alpha:  0.001,
            tint:   0x000000,
        },
        onMouseUp: () => {}
    });
    blocker.setDepth(depth);
    return blocker;
}

// ─── Generic popup ─────────────────────────────────────────────────────────────
//
// showPopup({ title, body, buttons, depth, fast })
//
// buttons = [{ text, onClick, primary }]
//   primary: true  → blue button  (confirm / yes)
//   primary: false → dark button  (cancel / no)
//
// Returns a closePopup() function.
// Works with any game — only requires 'white_pixel' (always in Phase 1 preload).

function showPopup({ title = '', body = '', buttons = [], depth = _POPUP.DEPTH, fast = false } = {}) {
    const W = GAME_CONSTANTS.halfWidth;
    const H = GAME_CONSTANTS.halfHeight;

    // Dark overlay + click blocker
    const darkBG  = _createDarkOverlay({
        ref: 'white_pixel', scaleX: GAME_CONSTANTS.WIDTH, scaleY: GAME_CONSTANTS.HEIGHT,
        tint: 0x000000, depth, targetAlpha: 0.75, duration: fast ? 1 : 60,
    });
    const blocker = _createFullscreenBlocker(depth);

    // Popup box
    const popupBG = PhaserScene.add.image(W, H - 10, 'white_pixel')
        .setScale(_POPUP.W, _POPUP.H).setTint(0x1a1a2e).setAlpha(0).setDepth(depth + 1);
    PhaserScene.tweens.add({ targets: popupBG, alpha: 1, ease: 'Back.easeOut', duration: fast ? 1 : 220 });

    // Title
    const titleObj = PhaserScene.add.text(W, H - 10 - _POPUP.H * 0.5 + 32, title, {
        fontFamily: 'Arial', fontSize: _POPUP.FONT_TITLE, color: '#ffffff',
        fontStyle: 'bold', align: 'center',
    }).setOrigin(0.5, 0.5).setDepth(depth + 2).setAlpha(0);

    // Body
    const bodyObj = PhaserScene.add.text(W, H - 10, body, {
        fontFamily: 'Arial', fontSize: _POPUP.FONT_BODY, color: '#cccccc',
        align: 'center', wordWrap: { width: _POPUP.W - 48 },
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
    const n      = buttons.length;
    const totalW = n * _POPUP.BTN_W + (n - 1) * _POPUP.BTN_GAP;
    const startX = W - totalW / 2 + _POPUP.BTN_W / 2;
    const BTN_Y  = H + 70;

    buttons.forEach((def, i) => {
        const bx         = startX + i * (_POPUP.BTN_W + _POPUP.BTN_GAP);
        const tintNormal = def.primary ? 0x2c5282 : 0x2d3748;
        const tintHover  = def.primary ? 0x3a6ba8 : 0x4a5568;
        const tintPress  = def.primary ? 0x1a3561 : 0x1a202c;

        const btn = new Button({
            normal:  { ref: 'white_pixel', x: bx, y: BTN_Y, scaleX: _POPUP.BTN_W, scaleY: _POPUP.BTN_H, tint: tintNormal },
            hover:   { tint: tintHover },
            press:   { tint: tintPress },
            disable: { alpha: 0 },
            onMouseUp: () => {
                closePopup();
                if (def.onClick) def.onClick();
            }
        });
        btn.setDepth(depth + 2);
        btn.addText(def.text, { fontFamily: 'Arial', fontSize: _POPUP.FONT_BTN, color: '#ffffff', align: 'center' });
        btnObjs.push(btn);
    });

    return closePopup;
}

// ─── Yes / No convenience wrapper ─────────────────────────────────────────────

function showYesNoPopup(yesText, noText, titleText = '...', bodyText = '...', onYes = () => {}, superFast = false) {
    const dur = superFast ? 0.2 : 50;

    const darkBG         = _createDarkOverlay({ ref: 'black_pixel', scaleX: 500, depth: _POPUP.OVERLAY_DEPTH, targetAlpha: 0.75, duration: dur });
    const dieClickBlocker = _createFullscreenBlocker(_POPUP.OVERLAY_DEPTH);

    const popupBG = PhaserScene.add.image(GAME_CONSTANTS.halfWidth, GAME_CONSTANTS.halfHeight - 40, 'ui', 'paper_half.png')
        .setDepth(_POPUP.DEPTH).setScale(0.7, 0.58);

    const newText = PhaserScene.add.text(GAME_CONSTANTS.halfWidth, popupBG.y - 75, titleText, {
        fontFamily: 'Arial', fontSize: _POPUP.FONT_YN_TITLE, color: '#000000', align: 'center',
    }).setOrigin(0.5, 0.5).setDepth(_POPUP.DEPTH).setAlpha(0.1);

    const descText = PhaserScene.add.text(GAME_CONSTANTS.halfWidth, popupBG.y - 17, bodyText, {
        fontFamily: 'Arial', fontSize: _POPUP.FONT_YN_BODY, color: '#000000', align: 'center',
    }).setOrigin(0.5, 0.5).setDepth(_POPUP.DEPTH).setAlpha(0.1);

    const animDur = superFast ? 0.7 : 200;
    PhaserScene.tweens.add({ targets: [newText, descText], alpha: 1,                       ease: 'Cubic.easeOut', duration: animDur });
    PhaserScene.tweens.add({ targets: popupBG,             scaleX: 0.72, scaleY: 0.6,      ease: 'Back.easeOut',  duration: animDur });

    const canvas = PhaserScene.sys.canvas;
    let noBtn, closeBtn;

    const _destroyAll = (items) => items.forEach(item => { if (item) item.destroy(); });

    const yesBtn = new Button({
        normal:  { ref: 'menu_btn_normal.png', atlas: 'buttons', x: GAME_CONSTANTS.halfWidth + 128, y: popupBG.y + 55 },
        hover:   { ref: 'menu_btn_hover.png',  atlas: 'buttons' },
        press:   { ref: 'menu_btn_hover.png',  atlas: 'buttons' },
        disable: { alpha: 0 },
        onHover:    () => { if (canvas) canvas.style.cursor = 'pointer'; },
        onHoverOut: () => { if (canvas) canvas.style.cursor = 'default'; },
        onMouseUp: () => {
            _destroyAll([closeBtn, noBtn, yesBtn, darkBG, dieClickBlocker, newText, descText, popupBG]);
            onYes();
        }
    });
    yesBtn.setOrigin(0.5, 0.5);
    yesBtn.addText(yesText, { fontFamily: 'Arial', fontSize: _POPUP.FONT_YN, color: '#000000', align: 'center' });
    yesBtn.setDepth(_POPUP.DEPTH);
    yesBtn.setScale(0.7);

    closeBtn = new Button({
        normal:  { ref: 'closebtn.png',       atlas: 'buttons', alpha: 0.95, x: GAME_CONSTANTS.halfWidth + 190, y: popupBG.y - 95 },
        hover:   { ref: 'closebtn_hover.png', atlas: 'buttons', alpha: 1 },
        press:   { ref: 'closebtn_press.png', atlas: 'buttons', alpha: 1 },
        disable: { ref: 'closebtn.png',       atlas: 'buttons', alpha: 0 },
        onHover:    () => { if (canvas) canvas.style.cursor = 'pointer'; },
        onHoverOut: () => { if (canvas) canvas.style.cursor = 'default'; },
        onMouseUp: () => {
            _destroyAll([closeBtn, noBtn, yesBtn, darkBG, dieClickBlocker, newText, descText, popupBG]);
        }
    });
    closeBtn.setOrigin(0.5, 0.5);
    closeBtn.setDepth(_POPUP.DEPTH);

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
            _destroyAll(itemsToDestroy);
        }
    });
    itemsToDestroy[1] = noBtn;

    noBtn.setOrigin(0.5, 0.5);
    noBtn.addText(noText, { fontFamily: 'Arial', fontSize: _POPUP.FONT_YN, color: '#000000', align: 'center' });
    noBtn.setDepth(_POPUP.DEPTH);
    noBtn.setScale(0.7);

    return itemsToDestroy;
}
