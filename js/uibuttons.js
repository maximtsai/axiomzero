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
    const W = GAME_CONSTANTS.halfWidth;
    const H = GAME_CONSTANTS.halfHeight;
    const depth = 110900;
    const width = 450;
    const height = 300;

    const darkBG = PhaserScene.add.image(W, H, 'white_pixel');
    darkBG.setDisplaySize(GAME_CONSTANTS.WIDTH, GAME_CONSTANTS.HEIGHT);
    darkBG.setTint(0x000000);
    darkBG.setAlpha(0);
    darkBG.setDepth(depth);
    darkBG.setScrollFactor(0);
    PhaserScene.tweens.add({ targets: darkBG, alpha: 0.75, duration: 60 });

    const blocker = new Button({
        normal: { ref: 'white_pixel', x: W, y: H, alpha: 0.001, scaleX: GAME_CONSTANTS.WIDTH, scaleY: GAME_CONSTANTS.HEIGHT },
        onMouseUp: () => closePopup()
    });
    blocker.setDepth(depth + 1);
    blocker.setScrollFactor(0);

    const popupBG = PhaserScene.add.nineslice(W, H, 'ui', 'popup_nineslice.png', width, height, 60, 60, 60, 60);
    popupBG.setDepth(depth + 2);
    popupBG.setScrollFactor(0);

    const titleObj = PhaserScene.add.text(W - width / 2 + 30, H - height / 2 + 35, '// OPTIONS', {
        fontFamily: 'VCR', fontSize: '24px', color: '#ffffff',
    }).setOrigin(0, 0).setDepth(depth + 3).setScrollFactor(0);

    const sfxLabel = PhaserScene.add.text(W - 120, H - 40, 'SFX', {
        fontFamily: 'VCR', fontSize: '18px', color: '#ffffff',
    }).setOrigin(0, 0.5).setDepth(depth + 3).setScrollFactor(0);

    const musicLabel = PhaserScene.add.text(W - 120, H + 20, 'MUSIC', {
        fontFamily: 'VCR', fontSize: '18px', color: '#ffffff',
    }).setOrigin(0, 0.5).setDepth(depth + 3).setScrollFactor(0);

    const sfxSliderWidth = 200;
    const musicSliderWidth = 200;

    const sfxSlider = new Slider(
        W + 20, H - 40, sfxSliderWidth, 20,
        'sound_on.png', 'buttons',
        (value) => {
            const volume = Math.max(0, Math.min(1, value));
            localStorage.setItem('sfxVolume', volume);
            audio.recheckMuteState();
        },
        parseFloat(localStorage.getItem('sfxVolume')) || 1.0,
        depth + 3
    );

    const musicSlider = new Slider(
        W + 20, H + 20, musicSliderWidth, 20,
        'music_on.png', 'buttons',
        (value) => {
            const volume = Math.max(0, Math.min(1, value));
            localStorage.setItem('musicVolume', volume);
            audio.recheckMuteState();
        },
        parseFloat(localStorage.getItem('musicVolume')) || 1.0,
        depth + 3
    );

    const closeBtn = new Button({
        normal: { ref: 'close_button_normal.png', atlas: 'ui', x: W + width / 2 - 33, y: H - height / 2 + 34 },
        hover: { ref: 'close_button_hover.png', atlas: 'ui' },
        press: { ref: 'close_button_press.png', atlas: 'ui' },
        onMouseUp: () => closePopup()
    });
    closeBtn.setDepth(depth + 3);
    closeBtn.setScrollFactor(0);

    function closePopup() {
        darkBG.destroy();
        blocker.destroy();
        popupBG.destroy();
        titleObj.destroy();
        sfxLabel.destroy();
        musicLabel.destroy();
        sfxSlider.knob.destroy();
        sfxSlider.hitArea.destroy();
        musicSlider.knob.destroy();
        musicSlider.hitArea.destroy();
        closeBtn.destroy();
    }
}


// Create a mute SFX button at position x, y
function createMuteSFXButton(x, y) {
    // Get current mute state from localStorage or default to false
    let isMuted = localStorage.getItem('sfxMuted') === 'true';

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
    // Get current mute state from localStorage or default to false
    let isMuted = localStorage.getItem('musicMuted') === 'true';

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
