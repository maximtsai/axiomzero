// UIButtons - Helper functions for creating UI buttons

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
            localStorage.setItem('sfxMuted', isMuted.toString());
            
            // Apply using helper function
            muteSFX(isMuted);
            
            // Update button sprites
            const newSprites = getSprites();
            button.normal.ref = newSprites.normal.ref;
            button.hover.ref = newSprites.hover.ref;
            button.press.ref = newSprites.press.ref;
            button.setState(button.state); // Refresh to show new sprite
            
            console.log('SFX muted:', isMuted);
        }
    });
    
    button.setDepth(1010);
    
    // Apply initial mute state if needed
    if (isMuted && typeof isSFXMuted !== 'undefined' && !isSFXMuted) {
        muteSFX(true);
    }
    
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
            localStorage.setItem('musicMuted', isMuted.toString());
            
            // Apply using helper function
            muteMusic(isMuted);
            
            // Update button sprites
            const newSprites = getSprites();
            button.normal.ref = newSprites.normal.ref;
            button.hover.ref = newSprites.hover.ref;
            button.press.ref = newSprites.press.ref;
            button.setState(button.state); // Refresh to show new sprite
            
            console.log('Music muted:', isMuted);
        }
    });
    
    button.setDepth(1010);
    
    // Apply initial mute state if needed
    if (isMuted && typeof isMusicMuted !== 'undefined' && !isMusicMuted) {
        muteMusic(true);
    }
    
    return button;
}
