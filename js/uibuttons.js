// UIButtons - Helper functions for creating UI buttons

function createOptionsButton(x, y) {
    const button = new Button({
        normal: {
            atlas: 'buttons',
            ref: 'options_normal.png',
            x: x,
            y: y
        },
        hover: {
            atlas: 'buttons',
            ref: 'options_hover.png',
            x: x,
            y: y
        },
        press: {
            atlas: 'buttons',
            ref: 'options_press.png',
            x: x,
            y: y
        },
        onMouseUp: function () {
            _showOptionsPopup();
        }
    });

    button.onHover = () => {
        if (button.state !== DISABLE) {
            button.setScale(helper.isMobileDevice() ? 0.85 : 0.72);
        }
    };
    button.onHoverOut = () => {
        if (button.state !== DISABLE) {
            button.setScale(helper.isMobileDevice() ? 0.8 : 0.68);
        }
    };

    button.setDepth(7000);
    button.setScale(helper.isMobileDevice() ? 0.8 : 0.68);
    button.setScrollFactor(0);
    return button;
}

function _showOptionsPopup() {
    messageBus.publish('gamePaused');
    audio.play('retro1', 1.0);
    const W = GAME_CONSTANTS.halfWidth;
    const H = GAME_CONSTANTS.halfHeight;
    const depth = 110900;
    const width = 800;
    const height = 600;
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

    const blocker = new Button({
        normal: { ref: 'white_pixel', x: W, y: H, alpha: 0.001, scaleX: GAME_CONSTANTS.WIDTH, scaleY: GAME_CONSTANTS.HEIGHT }
    });
    blocker.setDepth(depth + 1);
    blocker.setScrollFactor(0);
    elements.push(blocker);

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
    const audioLabel = PhaserScene.add.text(W - width / 2 + 40, audioHeaderY + 15, t('options', 'audio'), {
        fontFamily: 'JetBrainsMono_Bold', fontSize: '23px', color: '#000000',
    }).setOrigin(0, 0.8).setDepth(depth + 3).setScrollFactor(0);
    elements.push(audioLabel);
    textObjects.push({ obj: audioLabel, size: 23 });

    const audioLine = PhaserScene.add.image(W, audioHeaderY + 24, 'pixels', 'black_pixel.png');
    audioLine.setDisplaySize(width - 80, 2);
    audioLine.setAlpha(1);
    audioLine.setDepth(depth + 3);
    audioLine.setScrollFactor(0);
    elements.push(audioLine);

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
    const visualLabel = PhaserScene.add.text(W - width / 2 + 40, visualHeaderY - 1, t('options', 'visual'), {
        fontFamily: 'JetBrainsMono_Bold', fontSize: '23px', color: '#000000',
    }).setOrigin(0, 0.8).setDepth(depth + 3).setScrollFactor(0);
    elements.push(visualLabel);
    textObjects.push({ obj: visualLabel, size: 23 });

    const visualLine = PhaserScene.add.image(W, visualHeaderY + 8, 'pixels', 'black_pixel.png');
    visualLine.setDisplaySize(width - 80, 2);
    visualLine.setAlpha(1);
    visualLine.setDepth(depth + 3);
    visualLine.setScrollFactor(0);
    elements.push(visualLine);

    // Chromatic Aberration Checkbox
    let isChromaEnabled = gameState.settings.chromaticAberration; // Default to true
    const chromaCheckbox = new Button({
        normal: { atlas: 'ui', ref: isChromaEnabled ? 'checkbox_on_normal.png' : 'checkbox_off_normal.png', x: W - width / 2 + 165, y: visualHeaderY + 35 },
        hover: { atlas: 'ui', ref: isChromaEnabled ? 'checkbox_on_hover.png' : 'checkbox_off_hover.png' },
        onMouseUp: () => {
            isChromaEnabled = !isChromaEnabled;
            gameState.settings.chromaticAberration = isChromaEnabled;
            saveGame();
            chromaCheckbox.normal.ref = isChromaEnabled ? 'checkbox_on_normal.png' : 'checkbox_off_normal.png';
            chromaCheckbox.hover.ref = isChromaEnabled ? 'checkbox_on_hover.png' : 'checkbox_off_hover.png';
            chromaCheckbox.setState(chromaCheckbox.state);
        }
    });
    chromaCheckbox.setDepth(depth + 3);
    chromaCheckbox.setScrollFactor(0);
    chromaCheckbox.setScale(1.0);
    elements.push(chromaCheckbox);

    const chromaLabel = PhaserScene.add.text(W - width / 2 + 95, visualHeaderY + 35, t('options', 'chroma'), {
        fontFamily: 'JetBrainsMono_Bold', fontSize: '21px', color: '#ffffff',
    }).setOrigin(0, 0.5).setDepth(depth + 3).setScrollFactor(0).setShadow(2, 2, '#000000', 2, true, true);
    elements.push(chromaLabel);
    textObjects.push({ obj: chromaLabel, size: 21 });

    // Damage Numbers Checkbox
    let isDamageEnabled = gameState.settings.showDamageNumbers;
    const damageCheckbox = new Button({
        normal: { atlas: 'ui', ref: isDamageEnabled ? 'checkbox_on_normal.png' : 'checkbox_off_normal.png', x: W + 120, y: visualHeaderY + 35 },
        hover: { atlas: 'ui', ref: isDamageEnabled ? 'checkbox_on_hover.png' : 'checkbox_off_hover.png' },
        onMouseUp: () => {
            isDamageEnabled = !isDamageEnabled;
            gameState.settings.showDamageNumbers = isDamageEnabled;
            saveGame();
            damageCheckbox.normal.ref = isDamageEnabled ? 'checkbox_on_normal.png' : 'checkbox_off_normal.png';
            damageCheckbox.hover.ref = isDamageEnabled ? 'checkbox_on_hover.png' : 'checkbox_off_hover.png';
            damageCheckbox.setState(damageCheckbox.state);
        }
    });
    damageCheckbox.setDepth(depth + 3);
    damageCheckbox.setScrollFactor(0);
    damageCheckbox.setScale(1.0);
    elements.push(damageCheckbox);

    const damageNumbersLabel = PhaserScene.add.text(W + 50, visualHeaderY + 35, t('options', 'dmg_numbers'), {
        fontFamily: 'JetBrainsMono_Bold', fontSize: '21px', color: '#ffffff',
    }).setOrigin(0, 0.5).setDepth(depth + 3).setScrollFactor(0).setShadow(2, 2, '#000000', 2, true, true);
    elements.push(damageNumbersLabel);
    textObjects.push({ obj: damageNumbersLabel, size: 21 });

    // BIG font Checkbox (Visual row 2)
    let isBigFontEnabled = gameState.settings.bigFont;
    const bigFontCheckbox = new Button({
        normal: { atlas: 'ui', ref: isBigFontEnabled ? 'checkbox_on_normal.png' : 'checkbox_off_normal.png', x: W - width / 2 + 165, y: visualHeaderY + 80 },
        hover: { atlas: 'ui', ref: isBigFontEnabled ? 'checkbox_on_hover.png' : 'checkbox_off_hover.png' },
        onMouseUp: () => {
            isBigFontEnabled = !isBigFontEnabled;
            gameState.settings.bigFont = isBigFontEnabled;
            saveGame();
            bigFontCheckbox.normal.ref = isBigFontEnabled ? 'checkbox_on_normal.png' : 'checkbox_off_normal.png';
            bigFontCheckbox.hover.ref = isBigFontEnabled ? 'checkbox_on_hover.png' : 'checkbox_off_hover.png';
            bigFontCheckbox.setState(bigFontCheckbox.state);
            updateAllTextSizes();
            messageBus.publish('settingChanged_bigFont', isBigFontEnabled);
        }
    });
    bigFontCheckbox.setDepth(depth + 3);
    bigFontCheckbox.setScrollFactor(0);
    bigFontCheckbox.setScale(1.0);
    elements.push(bigFontCheckbox);

    const bigFontLabel = PhaserScene.add.text(W - width / 2 + 95, visualHeaderY + 80, t('options', 'big_font'), {
        fontFamily: 'JetBrainsMono_Bold', fontSize: '21px', color: '#ffffff',
    }).setOrigin(0, 0.5).setDepth(depth + 3).setScrollFactor(0).setShadow(2, 2, '#000000', 2, true, true);
    elements.push(bigFontLabel);
    textObjects.push({ obj: bigFontLabel, size: 21 });

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
    const languageLabel = PhaserScene.add.text(W - width / 2 + 40, languageHeaderY + 19, t('options', 'language'), {
        fontFamily: 'JetBrainsMono_Bold', fontSize: '23px', color: '#000000',
    }).setOrigin(0, 0.8).setDepth(depth + 3).setScrollFactor(0);
    elements.push(languageLabel);
    textObjects.push({ obj: languageLabel, size: 23 });

    const languageLine = PhaserScene.add.image(W, languageHeaderY + 28, 'pixels', 'black_pixel.png');
    languageLine.setDisplaySize(width - 80, 2);
    languageLine.setAlpha(1);
    languageLine.setDepth(depth + 3);
    languageLine.setScrollFactor(0);
    elements.push(languageLine);

    // --- DATA SECTION ---
    const dataHeaderY = languageHeaderY + 130;
    const dataLabel = PhaserScene.add.text(W - width / 2 + 40, dataHeaderY - 5, t('options', 'data_label'), {
        fontFamily: 'JetBrainsMono_Bold', fontSize: '23px', color: '#000000',
    }).setOrigin(0, 0.8).setDepth(depth + 3).setScrollFactor(0);
    elements.push(dataLabel);
    textObjects.push({ obj: dataLabel, size: 23 });

    const dataLine = PhaserScene.add.image(W, dataHeaderY + 4, 'pixels', 'black_pixel.png');
    dataLine.setDisplaySize(width - 80, 2);
    dataLine.setAlpha(1);
    dataLine.setDepth(depth + 3);
    dataLine.setScrollFactor(0);
    elements.push(dataLine);

    const resetUnderlay = PhaserScene.add.image(W, dataHeaderY + 35, 'pixels', 'black_pixel.png');
    resetUnderlay.setDisplaySize(width - 107, 31);
    resetUnderlay.setDepth(depth + 3).setAlpha(0.6);
    resetUnderlay.setScrollFactor(0);
    elements.push(resetUnderlay);

    const resetBg = PhaserScene.add.nineslice(W, dataHeaderY + 36, 'ui', 'warning_btn_9slice.png', width - 80, 56, 20, 20, 20, 20);
    resetBg.setDepth(depth + 3);
    resetBg.setScrollFactor(0);
    resetBg.setAlpha(0.5);
    elements.push(resetBg);

    const resetText = PhaserScene.add.text(W, dataHeaderY + 36, t('options', 'reset_progress'), {
        fontFamily: 'JetBrainsMono_Bold', fontSize: '21px', color: '#ff3366',
    }).setOrigin(0.5, 0.5).setDepth(depth + 3).setScrollFactor(0).setAlpha(0.5);
    elements.push(resetText);
    textObjects.push({ obj: resetText, size: 21 });

    updateAllTextSizes();

    const resetBtn = new Button({
        normal: { ref: 'white_pixel', x: W, y: dataHeaderY + 36, alpha: 0.001, scaleX: width * 0.5 - 50, scaleY: 24 },
        hover: { ref: 'white_pixel', x: W, y: dataHeaderY + 36, alpha: 0.001, scaleX: width * 0.5 - 50, scaleY: 24 },
        press: { ref: 'white_pixel', x: W, y: dataHeaderY + 36, alpha: 0.1, scaleX: width * 0.5 - 50, scaleY: 24 },
        onHover: () => {
            resetBg.setAlpha(1);
            resetText.setAlpha(1);
        },
        onHoverOut: () => {
            resetBg.setAlpha(0.5);
            resetText.setAlpha(0.75);
        },
        onMouseUp: () => {
            _showResetConfirmPopup();
        }
    });

    resetBtn.setDepth(depth + 4);
    resetBtn.setScrollFactor(0);
    elements.push(resetBtn);

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

    const blocker = new Button({
        normal: { ref: 'white_pixel', x: W, y: H, alpha: 0.001, scaleX: GAME_CONSTANTS.WIDTH, scaleY: GAME_CONSTANTS.HEIGHT }
    });
    blocker.setDepth(depth + 1);
    blocker.setScrollFactor(0);
    elements.push(blocker);

    const popupBG = PhaserScene.add.nineslice(W, H, 'ui', 'popup_nineslice.png', width, height, 64, 64, 64, 64);
    popupBG.setDepth(depth + 2);
    popupBG.setScrollFactor(0);
    elements.push(popupBG);

    const warningText = PhaserScene.add.text(W, H - 40, t('options', 'reset_confirm_text'), {
        fontFamily: 'JetBrainsMono_Bold', fontSize: '22px', color: '#ff3366', align: 'center', stroke: '#000000', strokeThickness: 4
    }).setOrigin(0.5).setDepth(depth + 3).setScrollFactor(0);
    elements.push(warningText);

    // YES Button
    const yesBg = PhaserScene.add.nineslice(W - 110, H + 70, 'ui', 'warning_btn_9slice.png', 160, 56, 20, 20, 20, 20);
    yesBg.setDepth(depth + 3).setScrollFactor(0).setAlpha(0.5);
    elements.push(yesBg);

    const yesText = PhaserScene.add.text(W - 110, H + 70, t('ui', 'yes'), {
        fontFamily: 'JetBrainsMono_Bold', fontSize: '20px', color: '#ffffff'
    }).setOrigin(0.5).setDepth(depth + 5).setScrollFactor(0).setAlpha(0.5);
    elements.push(yesText);

    const yesBtn = new Button({
        normal: { ref: 'white_pixel', x: W - 110, y: H + 70, alpha: 0.001, scaleX: 80, scaleY: 28 },
        press: { ref: 'white_pixel', alpha: 0.001 },
        onHover: () => {
            yesBg.setAlpha(1);
            yesText.setAlpha(1);
        },
        onHoverOut: () => {
            yesBg.setAlpha(0.5);
            yesText.setAlpha(0.5);
        },
        onMouseUp: () => {
            clearSave();
            window.location.reload();
        }
    });
    yesBtn.setDepth(depth + 4);
    yesBtn.setScrollFactor(0);
    elements.push(yesBtn);

    // NO Button
    const noBg = PhaserScene.add.nineslice(W + 110, H + 70, 'ui', 'glow_btn_9slice.png', 160, 56, 20, 20, 20, 20);
    noBg.setDepth(depth + 3).setScrollFactor(0).setAlpha(0.75);
    elements.push(noBg);

    const noText = PhaserScene.add.text(W + 110, H + 70, t('ui', 'no'), {
        fontFamily: 'JetBrainsMono_Bold', fontSize: '20px', color: '#ffffff'
    }).setOrigin(0.5).setDepth(depth + 5).setScrollFactor(0).setAlpha(0.75);
    elements.push(noText);

    const noBtn = new Button({
        normal: { ref: 'white_pixel', x: W + 110, y: H + 70, alpha: 0.001, scaleX: 80, scaleY: 28 },
        press: { ref: 'white_pixel', alpha: 0.001 },
        onHover: () => {
            noBg.setAlpha(1);
            noText.setAlpha(1);
        },
        onHoverOut: () => {
            noBg.setAlpha(0.75);
            noText.setAlpha(0.75);
        },
        onMouseUp: () => {
            elements.forEach(el => { if (el && el.destroy) el.destroy(); });
        }
    });
    noBtn.setDepth(depth + 4);
    noBtn.setScrollFactor(0);
    elements.push(noBtn);

    const closeBtn = new Button({
        normal: { ref: 'close_button_normal.png', atlas: 'ui', x: W + width / 2 - 36, y: H - height / 2 + 36 },
        hover: { ref: 'close_button_hover.png', atlas: 'ui' },
        press: { ref: 'close_button_press.png', atlas: 'ui' },
        onMouseUp: () => {
            elements.forEach(el => { if (el && el.destroy) el.destroy(); });
        }
    });
    closeBtn.setDepth(depth + 3);
    closeBtn.setScrollFactor(0);
    closeBtn.setScale(1);
    elements.push(closeBtn);
}
