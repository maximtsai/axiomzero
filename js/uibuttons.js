// UIButtons - Helper functions for creating UI buttons

const UI_RADIUS_SMALL = 20;
const UI_RADIUS_LARGE = 64;

function createOptionsButton(x, y) {
    let icon;
    const button = new Button({
        normal: {
            atlas: 'buttons',
            ref: 'sq_button_normal.png',
            x: x,
            y: y
        },
        hover: {
            atlas: 'buttons',
            ref: 'sq_button_hover.png',
        },
        press: {
            atlas: 'buttons',
            ref: 'sq_button_press.png',
        },
        onMouseUp: function () {
            _showOptionsPopup();
        },
        onHover: () => {
            if (icon) icon.setAlpha(1.0);
        },
        onHoverOut: () => {
            if (icon) icon.setAlpha(0.75);
        }
    });

    icon = PhaserScene.add.image(x, y, 'buttons', 'gear_icon.png');
    icon.setDepth(7001).setScrollFactor(0);
    icon.setAlpha(0.75);

    button.setDepth(7000);
    button.setScale(helper.isMobileDevice() ? 0.8 : 0.68);
    button.setScrollFactor(0);
    icon.setScale(button.bgSprite.scaleX);
    return button;
}

function _showOptionsPopup() {
    messageBus.publish('gamePaused');
    audio.play('retro1', 1.0);
    const W = GAME_CONSTANTS.halfWidth;
    const H = GAME_CONSTANTS.halfHeight;
    const depth = 110900;
    const width = 800;
    const height = 644;
    const elements = [];
    const textObjects = [];

    const updateAllTextSizes = () => {
        const isBigValue = gameState.settings.bigFont;
        textObjects.forEach(item => {
            const newSize = item.size + (isBigValue ? 3 : 0);
            item.obj.setFontSize(newSize + 'px');
        });
    };

    const darkBG = PhaserScene.add.image(W, H, 'white_pixel');
    darkBG.setDisplaySize(GAME_CONSTANTS.WIDTH, GAME_CONSTANTS.HEIGHT);
    darkBG.setTint(0x000000);
    darkBG.setAlpha(0);
    darkBG.setDepth(depth);
    darkBG.setScrollFactor(0);
    PhaserScene.tweens.add({ targets: darkBG, alpha: 0.75, duration: 60 });
    elements.push(darkBG);

    // Use the global helper to block background clicks/dragging
    helper.createGlobalClickBlocker(false);

    const popupBG = PhaserScene.add.nineslice(W, H, 'ui', 'popup_nineslice.png', width, height, 64, 64, 64, 64);
    popupBG.setDepth(depth + 2);
    popupBG.setScrollFactor(0);
    elements.push(popupBG);

    const titleObj = PhaserScene.add.text(W - width / 2 + 30, H - height / 2 + 20, t('options', 'title'), {
        fontFamily: 'JetBrainsMono_Bold', fontSize: '27px', color: '#ffffff',
    }).setOrigin(0, 0).setDepth(depth + 3).setScrollFactor(0).setShadow(2, 2, '#000000', 2, true, true);
    elements.push(titleObj);
    textObjects.push({ obj: titleObj, size: 27 });

    // --- AUDIO SECTION ---
    const audioHeaderY = H - height / 2 + 75;
    const audioHeader = helper.createHeader(W - width / 2 + 40, audioHeaderY + 15, width, t('options', 'audio') + '♫', depth + 3);
    elements.push(audioHeader.text, audioHeader.line);
    textObjects.push({ obj: audioHeader.text, size: 23 });

    const musicLabel = PhaserScene.add.text(W - width / 2 + 40, audioHeaderY + 51, t('options', 'music_vol'), {
        fontFamily: 'JetBrainsMono_Bold', fontSize: '21px', color: '#ffffff',
    }).setOrigin(0, 0.5).setDepth(depth + 3).setScrollFactor(0).setShadow(2, 2, '#000000', 2, true, true);
    elements.push(musicLabel);
    textObjects.push({ obj: musicLabel, size: 21 });

    const musicSlider = new Slider(
        W + 70, audioHeaderY + 51, 400, 50,
        'slider_knob.png', 'buttons',
        (val) => audio.setMusicVolume(val),
        gameState.settings.globalMusicVol,
        depth + 3
    );
    elements.push(musicSlider);

    const sfxLabel = PhaserScene.add.text(W - width / 2 + 40, audioHeaderY + 89, t('options', 'sfx_vol'), {
        fontFamily: 'JetBrainsMono_Bold', fontSize: '21px', color: '#ffffff',
    }).setOrigin(0, 0.5).setDepth(depth + 3).setScrollFactor(0).setShadow(2, 2, '#000000', 2, true, true);
    elements.push(sfxLabel);
    textObjects.push({ obj: sfxLabel, size: 21 });

    const sfxSlider = new Slider(
        W + 70, audioHeaderY + 89, 400, 40,
        'slider_knob.png', 'buttons',
        (val) => audio.setVolume(val),
        gameState.settings.globalVolume,
        depth + 3
    );
    elements.push(sfxSlider);

    // --- VISUAL SECTION ---
    const visualHeaderY = audioHeaderY + 135;
    const visualHeader = helper.createHeader(W - width / 2 + 40, visualHeaderY - 1, width, t('options', 'visual') + '⏿', depth + 3);
    elements.push(visualHeader.text, visualHeader.line);
    textObjects.push({ obj: visualHeader.text, size: 23 });

    // Chromatic Aberration Checkbox
    const chroma = helper.createCheckbox(W - width / 2 + 95, visualHeaderY + 35, t('options', 'chroma'), gameState.settings.chromaticAberration, depth + 3, (val) => {
        gameState.settings.chromaticAberration = val;
        saveGame();
    });
    elements.push(chroma.btn, chroma.text);
    textObjects.push({ obj: chroma.text, size: 21 });

    // Damage Numbers Checkbox
    const dmgCheck = helper.createCheckbox(W + 50, visualHeaderY + 35, t('options', 'dmg_numbers'), gameState.settings.showDamageNumbers, depth + 3, (val) => {
        gameState.settings.showDamageNumbers = val;
        saveGame();
    });
    elements.push(dmgCheck.btn, dmgCheck.text);
    textObjects.push({ obj: dmgCheck.text, size: 21 });

    // BIG font Checkbox (Visual row 2)
    const bigFont = helper.createCheckbox(W - width / 2 + 95, visualHeaderY + 80, t('options', 'big_font'), gameState.settings.bigFont, depth + 3, (val) => {
        gameState.settings.bigFont = val;
        saveGame();
        updateAllTextSizes();
        messageBus.publish('settingChanged_bigFont', val);
    });
    elements.push(bigFont.btn, bigFont.text);
    textObjects.push({ obj: bigFont.text, size: 21 });

    // Fullscreen Checkbox (Visual row 2, right)
    const currentFullscreen = PhaserScene.scale.isFullscreen;
    gameState.settings.fullscreen = currentFullscreen; // Sync setting with reality
    const fullscreen = helper.createCheckbox(W + 50, visualHeaderY + 80, t('options', 'fullscreen'), currentFullscreen, depth + 3, (val) => {
        gameState.settings.fullscreen = val;
        saveGame();
        if (val) {
            if (PhaserScene.scale.fullscreenUnsupported) {
                console.warn('Fullscreen not supported');
            } else {
                PhaserScene.scale.startFullscreen();
            }
        } else {
            PhaserScene.scale.stopFullscreen();
        }
    });
    elements.push(fullscreen.btn, fullscreen.text);
    textObjects.push({ obj: fullscreen.text, size: 21 });

    const particlesLabel = PhaserScene.add.text(W - width / 2 + 40, visualHeaderY + 130, t('options', 'particles'), {
        fontFamily: 'JetBrainsMono_Bold', fontSize: '21px', color: '#ffffff',
    }).setOrigin(0, 0.5).setDepth(depth + 3).setScrollFactor(0).setShadow(2, 2, '#000000', 2, true, true);
    elements.push(particlesLabel);
    textObjects.push({ obj: particlesLabel, size: 21 });

    const fullBg = PhaserScene.add.nineslice(W - width / 2 + 244, visualHeaderY + 130, 'ui', 'glow_btn_9slice.png', 140, 56, 20, 20, 20, 20);
    fullBg.setDepth(depth + 3).setScrollFactor(0);
    elements.push(fullBg);

    const fullBtn = new Button({
        normal: { ref: 'white_pixel', x: W - width / 2 + 244, y: visualHeaderY + 130, alpha: 0.001, scaleX: 65, scaleY: 28 },
        disable: { ref: 'white_pixel', alpha: 0.001 },
        onHover: () => {
            if (fullBtn.state !== 'disable') {
                fullBg.setAlpha(1);
                fullText.setAlpha(1);
            }
        },
        onHoverOut: () => {
            if (fullBtn.state !== 'disable') {
                fullBg.setAlpha(0.4);
                fullText.setAlpha(0.4);
            }
        },
        onMouseUp: () => {
            gameState.settings.minimalParticles = false;
            saveGame();
            updateParticleButtons();
            messageBus.publish('settingChanged_minimalParticles', false);
        }
    });
    fullBtn.setDepth(depth + 4);
    fullBtn.setScrollFactor(0);
    elements.push(fullBtn);

    const fullText = PhaserScene.add.text(W - width / 2 + 244, visualHeaderY + 130, t('options', 'particles_full'), {
        fontFamily: 'JetBrainsMono_Bold', fontSize: '19px', color: '#ffffff'
    }).setOrigin(0.5).setDepth(depth + 5).setScrollFactor(0);
    elements.push(fullText);
    textObjects.push({ obj: fullText, size: 19 });

    const minBg = PhaserScene.add.nineslice(W - width / 2 + 386, visualHeaderY + 130, 'ui', 'glow_btn_9slice.png', 140, 56, 20, 20, 20, 20);
    minBg.setDepth(depth + 3).setScrollFactor(0);
    elements.push(minBg);

    const minBtn = new Button({
        normal: { ref: 'white_pixel', x: W - width / 2 + 386, y: visualHeaderY + 130, alpha: 0.001, scaleX: 65, scaleY: 28 },
        disable: { ref: 'white_pixel', alpha: 0.001 },
        onHover: () => {
            if (minBtn.state !== 'disable') {
                minBg.setAlpha(1);
                minText.setAlpha(1);
            }
        },
        onHoverOut: () => {
            if (minBtn.state !== 'disable') {
                minBg.setAlpha(0.4);
                minText.setAlpha(0.4);
            }
        },
        onMouseUp: () => {
            gameState.settings.minimalParticles = true;
            saveGame();
            updateParticleButtons();
            messageBus.publish('settingChanged_minimalParticles', true);
        }
    });
    minBtn.setDepth(depth + 4);
    minBtn.setScrollFactor(0);
    elements.push(minBtn);

    const minText = PhaserScene.add.text(W - width / 2 + 386, visualHeaderY + 130, t('options', 'particles_minimal'), {
        fontFamily: 'JetBrainsMono_Bold', fontSize: '19px', color: '#ffffff'
    }).setOrigin(0.5).setDepth(depth + 5).setScrollFactor(0);
    elements.push(minText);
    textObjects.push({ obj: minText, size: 19 });

    const updateParticleButtons = () => {
        const isMinimal = gameState.settings.minimalParticles;
        fullBtn.setState(isMinimal ? 'normal' : 'disable');
        minBtn.setState(isMinimal ? 'disable' : 'normal');

        fullBg.setAlpha(isMinimal ? 0.4 : 1);
        minBg.setAlpha(isMinimal ? 1 : 0.4);

        fullText.setAlpha(isMinimal ? 0.4 : 1);
        minText.setAlpha(isMinimal ? 1 : 0.4);
    };

    updateParticleButtons();

    // --- LANGUAGE SECTION ---
    const languageHeaderY = visualHeaderY + 166;
    const langHeader = helper.createHeader(W - width / 2 + 40, languageHeaderY + 19, width, t('options', 'language') + "文/A", depth + 3);
    elements.push(langHeader.text, langHeader.line);
    textObjects.push({ obj: langHeader.text, size: 23 });

    // --- DATA SECTION ---
    const dataHeaderY = languageHeaderY + 130;
    const dataHeader = helper.createHeader(W - width / 2 + 40, dataHeaderY - 5, width, t('options', 'data_label') + ' ⚠', depth + 3);
    elements.push(dataHeader.text, dataHeader.line);
    textObjects.push({ obj: dataHeader.text, size: 23 });

    const resetUnderlay = PhaserScene.add.image(W + 190, dataHeaderY + 82, 'pixels', 'black_pixel.png');
    resetUnderlay.setDisplaySize(width - 477, 31);
    resetUnderlay.setDepth(depth + 3).setAlpha(0.5);
    resetUnderlay.setScrollFactor(0);
    elements.push(resetUnderlay);

    const resetGlow = helper.createGlowButton(W + 190, dataHeaderY + 83, width - 450, 56, t('options', 'reset_progress'), depth + 3, () => {
        _showResetConfirmPopup();
    }, true);
    elements.push(resetGlow.bg, resetGlow.text, resetGlow.btn);
    resetGlow.text.setAlpha(0.7);

    const oldResetHoverFunc = resetGlow.btn.onHoverFunc;
    resetGlow.btn.onHoverFunc = () => {
        if (oldResetHoverFunc) oldResetHoverFunc();
        resetUnderlay.setAlpha(1);
        resetGlow.text.setAlpha(1);
    };
    const oldResetHoverOutFunc = resetGlow.btn.onHoverOutFunc;
    resetGlow.btn.onHoverOutFunc = () => {
        if (oldResetHoverOutFunc) oldResetHoverOutFunc();
        resetUnderlay.setAlpha(0.5);
        resetGlow.text.setAlpha(0.7);
    };
    textObjects.push({ obj: resetGlow.text, size: 21 });

    updateAllTextSizes();

    // --- EXPORT BUTTON ---
    const exportGlow = helper.createGlowButton(W - 240, dataHeaderY + 35, 240, 56, t('options', 'export_data'), depth + 3, () => {
        const str = exportSaveToString();
        if (str) {
            navigator.clipboard.writeText(str).then(() => {
                alert(t('options', 'export_success'));
            }).catch(() => {
                prompt(t('options', 'export_success'), str);
            });
        } else {
            alert(t('options', 'export_fail'));
        }
    });
    elements.push(exportGlow.bg, exportGlow.text, exportGlow.btn);
    textObjects.push({ obj: exportGlow.text, size: 18 });

    // --- IMPORT BUTTON ---
    const importGlow = helper.createGlowButton(W - 240, dataHeaderY + 83, 240, 56, t('options', 'import_data'), depth + 3, () => {
        const str = prompt(t('options', 'import_prompt'));
        if (str) {
            const result = importSaveFromString(str);
            if (result.success) {
                alert(t('options', 'import_success'));
                window.location.reload();
            } else {
                const errorMsg = t('options', result.error) || t('options', 'err_generic');
                alert(t('options', 'import_fail').replace('{0}', errorMsg));
            }
        }
    });
    elements.push(importGlow.bg, importGlow.text, importGlow.btn);
    textObjects.push({ obj: importGlow.text, size: 18 });

    // (resetBtn removed as it is now part of resetGlow)

    const closeBtn = new Button({
        normal: { ref: 'close_button_normal.png', atlas: 'ui', x: W + width / 2 - 35, y: H - height / 2 + 36 },
        hover: { ref: 'close_button_hover.png', atlas: 'ui' },
        press: { ref: 'close_button_press.png', atlas: 'ui' },
        onMouseUp: () => closePopup()
    });
    closeBtn.setDepth(depth + 3);
    closeBtn.setScrollFactor(0);
    elements.push(closeBtn);

    function closePopup() {
        messageBus.publish('gameResumed');
        helper.hideGlobalClickBlocker();
        elements.forEach(el => {
            if (el && el.destroy) el.destroy();
        });
    }
}


// Create a mute SFX button at position x, y
function createMuteSFXButton(x, y) {
    // Get current mute state from gameState
    let isMuted = gameState.settings.sfxMuted;

    // Determine which sprites to use based on current state
    const getSprites = () => {
        if (isMuted) {
            return {
                normal: { atlas: 'buttons', ref: 'sound_off.png' },
                hover: { atlas: 'buttons', ref: 'sound_off_hover.png' },
                press: { atlas: 'buttons', ref: 'sound_off_press.png' }
            };
        } else {
            return {
                normal: { atlas: 'buttons', ref: 'sound_on.png' },
                hover: { atlas: 'buttons', ref: 'sound_on_hover.png' },
                press: { atlas: 'buttons', ref: 'sound_on_press.png' }
            };
        }
    };

    const sprites = getSprites();

    // Create the button
    const button = new Button({
        normal: {
            atlas: sprites.normal.atlas,
            ref: sprites.normal.ref,
            x: x,
            y: y
        },
        hover: {
            atlas: sprites.hover.atlas,
            ref: sprites.hover.ref,
            x: x,
            y: y
        },
        press: {
            atlas: sprites.press.atlas,
            ref: sprites.press.ref,
            x: x,
            y: y
        },
        onMouseUp: () => {
            // Toggle mute state
            isMuted = !isMuted;
            audio.muteSFX(isMuted);

            // Update button sprites
            const newSprites = getSprites();
            button.normal.ref = newSprites.normal.ref;
            button.hover.ref = newSprites.hover.ref;
            button.press.ref = newSprites.press.ref;
            button.setState(button.state); // Refresh to show new sprite
        }
    });

    button.setDepth(7000);
    button.setScrollFactor(0);
    return button;
}

// Create a mute music button at position x, y
function createMuteMusicButton(x, y) {
    // Get current mute state from gameState
    let isMuted = gameState.settings.musicMuted;

    // Determine which sprites to use based on current state
    const getSprites = () => {
        if (isMuted) {
            return {
                normal: { atlas: 'buttons', ref: 'music_off.png' },
                hover: { atlas: 'buttons', ref: 'music_off_hover.png' },
                press: { atlas: 'buttons', ref: 'music_off_press.png' }
            };
        } else {
            return {
                normal: { atlas: 'buttons', ref: 'music_on.png' },
                hover: { atlas: 'buttons', ref: 'music_on_hover.png' },
                press: { atlas: 'buttons', ref: 'music_on_press.png' }
            };
        }
    };

    const sprites = getSprites();

    // Create the button
    const button = new Button({
        normal: {
            atlas: sprites.normal.atlas,
            ref: sprites.normal.ref,
            x: x,
            y: y
        },
        hover: {
            atlas: sprites.hover.atlas,
            ref: sprites.hover.ref,
            x: x,
            y: y
        },
        press: {
            atlas: sprites.press.atlas,
            ref: sprites.press.ref,
            x: x,
            y: y
        },
        onMouseUp: () => {
            // Toggle mute state
            isMuted = !isMuted;
            audio.muteMusic(isMuted);

            // Update button sprites
            const newSprites = getSprites();
            button.normal.ref = newSprites.normal.ref;
            button.hover.ref = newSprites.hover.ref;
            button.press.ref = newSprites.press.ref;
            button.setState(button.state); // Refresh to show new sprite
        }
    });

    button.setDepth(7000);
    button.setScrollFactor(0);
    return button;
}

function _showResetConfirmPopup() {
    const W = GAME_CONSTANTS.halfWidth;
    const H = GAME_CONSTANTS.halfHeight;
    const depth = 200000;
    const width = 500;
    const height = 300;
    const elements = [];

    const darkBG = PhaserScene.add.image(W, H, 'white_pixel');
    darkBG.setDisplaySize(GAME_CONSTANTS.WIDTH, GAME_CONSTANTS.HEIGHT);
    darkBG.setTint(0x000000);
    darkBG.setAlpha(0);
    darkBG.setDepth(depth);
    darkBG.setScrollFactor(0);
    PhaserScene.tweens.add({ targets: darkBG, alpha: 0.85, duration: 80 });
    elements.push(darkBG);

    // Use the global helper to block background clicks/dragging
    helper.createGlobalClickBlocker(false).setDepth(depth + 1);

    const popupBG = PhaserScene.add.nineslice(W, H, 'ui', 'popup_nineslice.png', width, height, UI_RADIUS_LARGE, UI_RADIUS_LARGE, UI_RADIUS_LARGE, UI_RADIUS_LARGE);
    popupBG.setDepth(depth + 2);
    popupBG.setScrollFactor(0);
    elements.push(popupBG);

    const warningText = PhaserScene.add.text(W, H - 40, t('options', 'reset_confirm_text'), {
        fontFamily: 'JetBrainsMono_Bold', fontSize: '22px', color: '#ff3366', align: 'center', stroke: '#000000', strokeThickness: 4
    }).setOrigin(0.5).setDepth(depth + 3).setScrollFactor(0);
    elements.push(warningText);

    // YES Button
    const yesGlow = helper.createGlowButton(W - 110, H + 70, 160, 56, t('ui', 'yes'), depth + 3, () => {
        clearSave();
        window.location.reload();
    }, true);
    elements.push(yesGlow.bg, yesGlow.text, yesGlow.btn);

    // NO Button
    const noGlow = helper.createGlowButton(W + 110, H + 70, 160, 56, t('ui', 'no'), depth + 3, () => {
        helper.hideGlobalClickBlocker();
        elements.forEach(el => { if (el && el.destroy) el.destroy(); });
    });
    elements.push(noGlow.bg, noGlow.text, noGlow.btn);

    const closeBtn = new Button({
        normal: { ref: 'close_button_normal.png', atlas: 'ui', x: W + width / 2 - 36, y: H - height / 2 + 36 },
        hover: { ref: 'close_button_hover.png', atlas: 'ui' },
        press: { ref: 'close_button_press.png', atlas: 'ui' },
        onMouseUp: () => {
            helper.hideGlobalClickBlocker();
            elements.forEach(el => { if (el && el.destroy) el.destroy(); });
        }
    });
    closeBtn.setDepth(depth + 3);
    closeBtn.setScrollFactor(0);
    closeBtn.setScale(1);
    elements.push(closeBtn);
}
