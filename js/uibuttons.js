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

    button.setDepth(1010);
    button.setScale(helper.testMobile() ? 0.8 : 0.68);
    button.setScrollFactor(0);
    return button;
}

function _showOptionsPopup() {
    messageBus.publish('gamePaused');
    const W = GAME_CONSTANTS.halfWidth;
    const H = GAME_CONSTANTS.halfHeight;
    const depth = 110900;
    const width = 800;
    const height = 600;
    const elements = [];

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

    const titleObj = PhaserScene.add.text(W - width / 2 + 30, H - height / 2 + 20, '// OPTIONS CONFIGURATION ', {
        fontFamily: 'JetBrainsMono_Bold', fontSize: '26px', color: '#ffffff',
    }).setOrigin(0, 0).setDepth(depth + 3).setScrollFactor(0).setShadow(2, 2, '#000000', 2, true, true);
    elements.push(titleObj);

    // --- AUDIO SECTION ---
    const audioHeaderY = H - height / 2 + 75;
    const audioLabel = PhaserScene.add.text(W - width / 2 + 40, audioHeaderY + 8, 'AUDIO ', {
        fontFamily: 'JetBrainsMono_Bold', fontSize: '22px', color: '#000000',
    }).setOrigin(0, 0.5).setDepth(depth + 3).setScrollFactor(0);
    elements.push(audioLabel);

    const audioLine = PhaserScene.add.image(W, audioHeaderY + 24, 'pixels', 'black_pixel.png');
    audioLine.setDisplaySize(width - 80, 2);
    audioLine.setAlpha(1);
    audioLine.setDepth(depth + 3);
    audioLine.setScrollFactor(0);
    elements.push(audioLine);

    const musicLabel = PhaserScene.add.text(W - width / 2 + 40, audioHeaderY + 51, 'MUSIC VOLUME ', {
        fontFamily: 'JetBrainsMono_Bold', fontSize: '20px', color: '#ffffff',
    }).setOrigin(0, 0.5).setDepth(depth + 3).setScrollFactor(0).setShadow(2, 2, '#000000', 2, true, true);
    elements.push(musicLabel);

    const musicSlider = new Slider(
        W + 70, audioHeaderY + 51, 400, 50,
        'slider_knob.png', 'buttons',
        (val) => audio.setMusicVolume(val),
        gameState.settings.globalMusicVol,
        depth + 3
    );
    elements.push(musicSlider);

    const sfxLabel = PhaserScene.add.text(W - width / 2 + 40, audioHeaderY + 89, 'SFX VOLUME ', {
        fontFamily: 'JetBrainsMono_Bold', fontSize: '20px', color: '#ffffff',
    }).setOrigin(0, 0.5).setDepth(depth + 3).setScrollFactor(0).setShadow(2, 2, '#000000', 2, true, true);
    elements.push(sfxLabel);

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
    const visualLabel = PhaserScene.add.text(W - width / 2 + 40, visualHeaderY - 8, 'VISUAL ', {
        fontFamily: 'JetBrainsMono_Bold', fontSize: '22px', color: '#000000',
    }).setOrigin(0, 0.5).setDepth(depth + 3).setScrollFactor(0);
    elements.push(visualLabel);

    const visualLine = PhaserScene.add.image(W, visualHeaderY + 8, 'pixels', 'black_pixel.png');
    visualLine.setDisplaySize(width - 80, 2);
    visualLine.setAlpha(1);
    visualLine.setDepth(depth + 3);
    visualLine.setScrollFactor(0);
    elements.push(visualLine);

    // Chromatic Aberration Checkbox
    let isChromaEnabled = gameState.settings.chromaticAberration; // Default to true
    const chromaCheckbox = new Button({
        normal: { atlas: 'ui', ref: isChromaEnabled ? 'checkbox_on_normal.png' : 'checkbox_off_normal.png', x: W - width / 2 + 65, y: visualHeaderY + 35 },
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

    const chromaLabel = PhaserScene.add.text(W - width / 2 + 105, visualHeaderY + 35, 'CHROMATIC ABERRATION ', {
        fontFamily: 'JetBrainsMono_Bold', fontSize: '20px', color: '#ffffff',
    }).setOrigin(0, 0.5).setDepth(depth + 3).setScrollFactor(0).setShadow(2, 2, '#000000', 2, true, true);
    elements.push(chromaLabel);

    // Damage Numbers Checkbox
    let isDamageEnabled = gameState.settings.showDamageNumbers;
    const damageCheckbox = new Button({
        normal: { atlas: 'ui', ref: isDamageEnabled ? 'checkbox_on_normal.png' : 'checkbox_off_normal.png', x: W + 20, y: visualHeaderY + 35 },
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

    const damageNumbersLabel = PhaserScene.add.text(W + 60, visualHeaderY + 35, 'DAMAGE NUMBERS ', {
        fontFamily: 'JetBrainsMono_Bold', fontSize: '20px', color: '#ffffff',
    }).setOrigin(0, 0.5).setDepth(depth + 3).setScrollFactor(0).setShadow(2, 2, '#000000', 2, true, true);
    elements.push(damageNumbersLabel);

    const particlesLabel = PhaserScene.add.text(W - width / 2 + 40, visualHeaderY + 75, 'PARTICLES ', {
        fontFamily: 'JetBrainsMono_Bold', fontSize: '20px', color: '#ffffff',
    }).setOrigin(0, 0.5).setDepth(depth + 3).setScrollFactor(0).setShadow(2, 2, '#000000', 2, true, true);
    elements.push(particlesLabel);

    // --- GAMEPLAY SECTION ---
    const gameplayHeaderY = visualHeaderY + 130;
    const gameplayLabel = PhaserScene.add.text(W - width / 2 + 40, gameplayHeaderY + 12, 'GAMEPLAY ', {
        fontFamily: 'JetBrainsMono_Bold', fontSize: '22px', color: '#000000',
    }).setOrigin(0, 0.5).setDepth(depth + 3).setScrollFactor(0);
    elements.push(gameplayLabel);

    const gameplayLine = PhaserScene.add.image(W, gameplayHeaderY + 28, 'pixels', 'black_pixel.png');
    gameplayLine.setDisplaySize(width - 80, 2);
    gameplayLine.setAlpha(1);
    gameplayLine.setDepth(depth + 3);
    gameplayLine.setScrollFactor(0);
    elements.push(gameplayLine);

    const languageLabel = PhaserScene.add.text(W - width / 2 + 40, gameplayHeaderY + 60, 'LANGUAGE ', {
        fontFamily: 'JetBrainsMono_Bold', fontSize: '20px', color: '#ffffff',
    }).setOrigin(0, 0.5).setDepth(depth + 3).setScrollFactor(0).setShadow(2, 2, '#000000', 2, true, true);
    elements.push(languageLabel);


    // --- DATA SECTION ---
    const dataHeaderY = gameplayHeaderY + 170;
    const dataLabel = PhaserScene.add.text(W - width / 2 + 40, dataHeaderY - 12, 'DATA', {
        fontFamily: 'JetBrainsMono_Bold', fontSize: '22px', color: '#000000',
    }).setOrigin(0, 0.5).setDepth(depth + 3).setScrollFactor(0);
    elements.push(dataLabel);

    const dataLine = PhaserScene.add.image(W, dataHeaderY + 4, 'pixels', 'black_pixel.png');
    dataLine.setDisplaySize(width - 80, 2);
    dataLine.setAlpha(1);
    dataLine.setDepth(depth + 3);
    dataLine.setScrollFactor(0);
    elements.push(dataLine);

    const resetUnderlay = PhaserScene.add.image(W, dataHeaderY + 31, 'pixels', 'black_pixel.png');
    resetUnderlay.setDisplaySize(width - 107, 31);
    resetUnderlay.setDepth(depth + 3).setAlpha(0.6);
    resetUnderlay.setScrollFactor(0);
    elements.push(resetUnderlay);

    const resetBg = PhaserScene.add.nineslice(W, dataHeaderY + 32, 'ui', 'warning_btn_9slice.png', width - 80, 56, 20, 20, 20, 20);
    resetBg.setDepth(depth + 3);
    resetBg.setScrollFactor(0);
    resetBg.setAlpha(0.5);
    elements.push(resetBg);

    const resetText = PhaserScene.add.text(W, dataHeaderY + 32, '[ \u26A0 RESET PROGRESS !! ]', {
        fontFamily: 'JetBrainsMono_Bold', fontSize: '20px', color: '#ff3366',
    }).setOrigin(0.5, 0.5).setDepth(depth + 3).setScrollFactor(0).setAlpha(0.5);
    elements.push(resetText);

    let confirmReset = false;

    const resetBtn = new Button({
        normal: { ref: 'white_pixel', x: W, y: dataHeaderY + 32, alpha: 0.001, scaleX: width * 0.5 - 50, scaleY: 24 },
        hover: { ref: 'white_pixel', x: W, y: dataHeaderY + 32, alpha: 0.001, scaleX: width * 0.5 - 50, scaleY: 24 },
        press: { ref: 'white_pixel', x: W, y: dataHeaderY + 32, alpha: 0.1, scaleX: width * 0.5 - 50, scaleY: 24 },
        onHover: () => {
            resetBg.setAlpha(1);
            resetText.setAlpha(1);
        },
        onHoverOut: () => {
            resetBg.setAlpha(0.5);
            resetText.setAlpha(0.75);
        },
        onMouseUp: () => {
            if (!confirmReset) {
                confirmReset = true;
                resetText.setText('[ CLICK AGAIN TO CONFIRM ]');
                resetText.setColor('#ffae00');

                // Cancel confirmation after 3 seconds
                PhaserScene.time.delayedCall(3000, () => {
                    if (confirmReset && resetText && resetText.active) {
                        confirmReset = false;
                        resetText.setText('[ \u26A0 RESET PROGRESS !! ]');
                        resetText.setColor('#ff3366');
                    }
                });
            } else {
                clearSave();
                window.location.reload();
            }
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

    button.setDepth(1010);
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

    button.setDepth(1010);
    button.setScrollFactor(0);
    return button;
}
