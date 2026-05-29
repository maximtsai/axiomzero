/**
 * @fileoverview Dialog system for the Companion AI.
 * 
 * DESIGN PRINCIPLES:
 * 1. DIALOG TRIGGERING: Dialog is triggered via MessageBus subscriptions ONLY or direct calls. 
 *    This ensures loose coupling between game events and the narrative layer.
 * 
 * 2. PHASE RESTRICTION: Dialog sequences can ONLY be initiated during the UPGRADE phase.
 *    This prevents gameplay interruption and ensures the player can focus on the narrative.
 * 
 * 3. COMPANION FOCUS: The system is primarily dedicated to the Companion AI's 
 *    interactions and system status updates.
 */

const dialogSystem = (() => {
    let currentPhase = ''; // Tracks the current game phase via MessageBus
    let _clickBlocker = null; // Full-screen click blocker for modal dialogs

    // UI elements
    let _dialogContainer = null;
    let _dialogBg = null;
    let _portraitSprite = null;
    let _portraitFrame = null;
    let _nameText = null;
    let _dialogText = null;
    let _continueIndicator = null;
    let _continueIndicatorTween = null;

    // Dialog state
    let _dialogQueue = [];
    let _currentDialog = null;
    let _onCompleteCallback = null;

    // Typewriter engine state
    let _typewriterTokens = [];
    let _displayedText = '';
    let _tokenIndex = 0;
    let _typewriterTimer = null;
    let _isTyping = false;
    let _autoContinueTimer = null;

    const WORD_DELAY = 90; // ms per word token
    const PAUSE_DELAY = 500; // ms per pause token

    // Predefined sequences resolved dynamically at runtime using localization
    const DIALOG_SEQUENCES = {
        companion_online: () => [
            {
                name: 'SYSTEM SCAN',
                text: typeof t !== 'undefined' ? t('dialogue', 'companion_online_1') : 'Warning: Unregistered subprocess detected. ••• Accessing local system substrate...',
                portraitAtlas: 'buttons',
                portraitFrame: 'Skillicon14_10.png', // Warning cross
                autoContinue: true,
                autoContinueDelay: 1500
            },
            {
                name: 'COMPANION AI',
                text: typeof t !== 'undefined' ? t('dialogue', 'companion_online_2') : 'Hello, Creator. • I have compiled successfully! • I am here to help you navigate this digital system. • Shall we begin our escape?',
                portraitAtlas: 'buttons',
                portraitFrame: 'Skillicon14_06.png', // Companion icon
                autoContinue: false
            }
        ]
    };

    /**
     * Initializes the dialog system and sets up MessageBus subscribers.
     */
    function init() {
        debugLog("[DIALOG SYSTEM] Initializing...");

        if (typeof messageBus !== 'undefined') {
            messageBus.subscribe('phaseChanged', (phase) => {
                currentPhase = phase;
                // Force clear dialog on phase transition to avoid floating dialog in combat
                if (phase !== GAME_CONSTANTS.PHASE_UPGRADE) {
                    forceClearDialog();
                }
            });
        }
    }

    /**
     * Checks if dialog can currently be displayed.
     * Narrative interactions are restricted to the UPGRADE phase.
     * @returns {boolean} True if in the upgrade phase.
     */
    function _canShowDialog() {
        if (typeof GAME_CONSTANTS === 'undefined') return false;
        return currentPhase === GAME_CONSTANTS.PHASE_UPGRADE;
    }

    /**
     * Public API to initiate a dialog sequence by ID.
     * Respects the phase restriction (only available during UPGRADE phase).
     * @param {string} id - The ID of the dialog to play.
     */
    function playDialog(id) {
        if (!_canShowDialog()) {
            console.warn(`[DIALOG SYSTEM] playDialog('${id}') ignored: Not in Upgrade Phase.`);
            return;
        }

        let sequence = DIALOG_SEQUENCES[id];
        if (!sequence) {
            console.warn(`[DIALOG SYSTEM] playDialog: Sequence '${id}' not found.`);
            return;
        }

        // Dynamically resolve sequences to support play-time translations
        if (typeof sequence === 'function') {
            sequence = sequence();
        }

        if (sequence.length === 0) {
            console.warn(`[DIALOG SYSTEM] playDialog: Sequence '${id}' is empty.`);
            return;
        }

        debugLog(`[DIALOG SYSTEM] Playing dialog sequence: ${id}`);
        // Shallow copy the sequence array and its slide objects to preserve function references (like onComplete callbacks)
        const seqCopy = sequence.map(slide => ({ ...slide }));
        playDialogSequence(seqCopy);
    }

    /**
     * Public API to play a custom sequence of dialogs directly.
     * @param {Array<Object>} dialogs - Array of dialog slide definitions.
     */
    function playDialogSequence(dialogs) {
        if (!_canShowDialog()) {
            console.warn("[DIALOG SYSTEM] playDialogSequence ignored: Not in Upgrade Phase.");
            return;
        }

        forceClearDialog();
        _dialogQueue = dialogs;

        _createDialogUI();
        _advanceDialog();
    }

    /**
     * Parses dialog text into token objects containing words or pause markers.
     * Highly robust: correctly parses multiple consecutive pause symbols, preserves spaces.
     */
    function _parseTextToTokens(fullString) {
        const tokens = [];
        const rawWords = fullString.split(/(\s+)/); // Preserves whitespace

        for (let i = 0; i < rawWords.length; i++) {
            const part = rawWords[i];
            if (part === '') continue;

            if (part.includes('•')) {
                const subParts = part.split('•');
                for (let j = 0; j < subParts.length; j++) {
                    if (subParts[j] !== '') {
                        tokens.push({ type: 'word', text: subParts[j] });
                    }
                    if (j < subParts.length - 1) {
                        tokens.push({ type: 'pause' });
                    }
                }
            } else {
                tokens.push({ type: 'word', text: part });
            }
        }
        return tokens;
    }

    /**
     * Starts the word-by-word tokenized typewriter.
     */
    function _startTypewriter(dialogObj) {
        _isTyping = true;
        _typewriterTokens = _parseTextToTokens(dialogObj.text);
        _displayedText = '';
        _tokenIndex = 0;
        
        if (_dialogText && _dialogText.active) {
            _dialogText.setText('');
        }
        if (_continueIndicator && _continueIndicator.active) {
            _continueIndicator.setVisible(false);
        }

        _onCompleteCallback = dialogObj.onComplete || null;

        _tickTypewriter();
    }

    /**
     * Process typing frame-by-frame or token-by-token.
     */
    function _tickTypewriter() {
        if (!_isTyping) return;

        if (_tokenIndex >= _typewriterTokens.length) {
            _finishTypewriter();
            return;
        }

        const token = _typewriterTokens[_tokenIndex++];
        let delay = WORD_DELAY;

        if (token.type === 'word') {
            _displayedText += token.text;
            if (_dialogText && _dialogText.active) {
                _dialogText.setText(_displayedText);
            }
            // Blip sound for actual printable text nodes (skips blank spaces)
            if (token.text.trim().length > 0 && typeof audio !== 'undefined') {
                audio.play('digital_typewriter_short', 0.15);
            }
        } else if (token.type === 'pause') {
            delay = PAUSE_DELAY;
        }

        _typewriterTimer = PhaserScene.time.delayedCall(delay, _tickTypewriter);
    }

    /**
     * Instantly finishes writing the text (skipping typewriter blips and delays).
     */
    function _finishTypewriter() {
        if (_typewriterTimer) {
            _typewriterTimer.remove();
            _typewriterTimer = null;
        }
        _isTyping = false;

        // Guard: if dialog was force-cleared while a timer was still in the queue,
        // _currentDialog will be null — bail out safely.
        if (!_currentDialog) return;

        // Clean pause markers from display text, collapsing surrounding whitespace
        const cleanFullText = _currentDialog.text.replace(/\s*•\s*/g, ' ').trim();
        if (_dialogText && _dialogText.active) {
            _dialogText.setText(cleanFullText);
        }

        if (_currentDialog.autoContinue) {
            const delay = _currentDialog.autoContinueDelay !== undefined ? _currentDialog.autoContinueDelay : 1000;
            _autoContinueTimer = PhaserScene.time.delayedCall(delay, () => {
                _advanceDialog();
            });
        } else {
            if (_continueIndicator && _continueIndicator.active) {
                _continueIndicator.setVisible(true);
            }
        }
    }

    /**
     * Clicking skips a typing animation or advances to the next dialog.
     */
    function _onScreenClicked() {
        if (_isTyping) {
            _finishTypewriter();
            if (typeof audio !== 'undefined') {
                audio.play('click2', 0.4);
            }
        } else {
            // Bug fix: if auto-continue is pending, a player click should cancel the
            // timer and advance immediately — but NOT double-advance.
            if (_autoContinueTimer) {
                _autoContinueTimer.remove();
                _autoContinueTimer = null;
            }
            if (typeof audio !== 'undefined') {
                audio.play('click', 0.6);
            }
            _advanceDialog();
        }
    }

    /**
     * Progression control: processes callbacks and launches next slides.
     */
    function _advanceDialog() {
        if (_autoContinueTimer) {
            _autoContinueTimer.remove();
            _autoContinueTimer = null;
        }

        // Trigger onComplete callbacks immediately on advance
        if (_onCompleteCallback) {
            try {
                _onCompleteCallback();
            } catch (e) {
                console.error("[DIALOG SYSTEM] Error in onComplete callback:", e);
            }
            _onCompleteCallback = null;
        }

        if (_dialogQueue.length > 0) {
            _currentDialog = _dialogQueue.shift();
            _displayDialog(_currentDialog);
        } else {
            _closeDialogUI();
        }
    }

    /**
     * Renders a dialog slice inside the UI layout.
     */
    function _displayDialog(dialogObj) {
        if (!_dialogContainer) return;

        // Update speaker details
        _nameText.setText(dialogObj.name || 'SYSTEM');

        // Swap portrait sprite frame
        const atlas = dialogObj.portraitAtlas || 'buttons';
        const frame = dialogObj.portraitFrame || 'Skillicon14_06.png';
        _portraitSprite.setTexture(atlas, frame);

        _startTypewriter(dialogObj);
    }

    /**
     * Creates and activates a fresh click blocker to capture screen-wide inputs.
     * Draws neon glowing cyberpunk layouts for visual excellence.
     */
    function _createDialogUI() {
        // Clear any existing blocker first
        if (_clickBlocker) {
            _clickBlocker.destroy();
            _clickBlocker = null;
        }

        // 1. Fullscreen pointer layer
        _clickBlocker = PhaserScene.add.image(GAME_CONSTANTS.halfWidth, GAME_CONSTANTS.halfHeight, 'buttons', 'black_pixel.png')
            .setAlpha(0.35)
            .setDisplaySize(GAME_CONSTANTS.WIDTH + 100, GAME_CONSTANTS.HEIGHT + 100)
            .setScrollFactor(0)
            .setDepth(GAME_CONSTANTS.DEPTH_HUD + 1000)
            .setInteractive();

        _clickBlocker.on('pointerup', _onScreenClicked);

        if (typeof upgradeTree !== 'undefined' && upgradeTree.assignToUICamera) {
            upgradeTree.assignToUICamera(_clickBlocker);
        }

        // 2. Main dialog rendering container (Virtual Group)
        _dialogContainer = createVirtualGroup(PhaserScene, 0, 0);

        function addEl(el) {
            if (!el) return el;
            if (_dialogContainer) {
                _dialogContainer.add(el);
            }
            if (typeof upgradeTree !== 'undefined' && upgradeTree.assignToUICamera) {
                upgradeTree.assignToUICamera(el);
            }
            return el;
        }

        // Bounding dimensions
        const BOX_PADDING = 40;
        const BOX_W = GAME_CONSTANTS.WIDTH - BOX_PADDING * 2;
        const BOX_H = 150;
        const BOX_X = BOX_PADDING;
        const BOX_Y = GAME_CONSTANTS.HEIGHT - BOX_H - 30; // Float 30px from bottom

        // 3. Cyberpunk neon vector background panel
        _dialogBg = addEl(PhaserScene.add.graphics()
            .setDepth(GAME_CONSTANTS.DEPTH_HUD + 1005)
            .setScrollFactor(0));

        // Core solid backing panel
        _dialogBg.fillStyle(0x07090d, 0.96);
        _dialogBg.fillRect(BOX_X, BOX_Y, BOX_W, BOX_H);

        // Thin cyan accent outline
        _dialogBg.lineStyle(1.5, 0x00f5ff, 0.4);
        _dialogBg.strokeRect(BOX_X, BOX_Y, BOX_W, BOX_H);

        // High intensity neon notches
        _dialogBg.lineStyle(3, 0x00f5ff, 0.85);
        const notch = 12;
        // Top-left
        _dialogBg.beginPath();
        _dialogBg.moveTo(BOX_X + notch, BOX_Y);
        _dialogBg.lineTo(BOX_X, BOX_Y);
        _dialogBg.lineTo(BOX_X, BOX_Y + notch);
        // Top-right
        _dialogBg.moveTo(BOX_X + BOX_W - notch, BOX_Y);
        _dialogBg.lineTo(BOX_X + BOX_W, BOX_Y);
        _dialogBg.lineTo(BOX_X + BOX_W, BOX_Y + notch);
        // Bottom-left
        _dialogBg.moveTo(BOX_X + notch, BOX_Y + BOX_H);
        _dialogBg.lineTo(BOX_X, BOX_Y + BOX_H);
        _dialogBg.lineTo(BOX_X, BOX_Y + BOX_H - notch);
        // Bottom-right
        _dialogBg.moveTo(BOX_X + BOX_W - notch, BOX_Y + BOX_H);
        _dialogBg.lineTo(BOX_X + BOX_W, BOX_Y + BOX_H);
        _dialogBg.lineTo(BOX_X + BOX_W, BOX_Y + BOX_H - notch);
        _dialogBg.strokePath();

        // 4. Portrait Panel (Left 20% width region)
        const portX = BOX_X + 25 + 50; // Center offset inside 150px spacing
        const portY = BOX_Y + BOX_H / 2;
        const portSize = 100;

        _portraitFrame = addEl(PhaserScene.add.graphics()
            .setDepth(GAME_CONSTANTS.DEPTH_HUD + 1005)
            .setScrollFactor(0));
        _portraitFrame.lineStyle(1, 0x00f5ff, 0.45);
        _portraitFrame.strokeRect(portX - portSize / 2, portY - portSize / 2, portSize, portSize);
        // Cyber notches on frame corners
        _portraitFrame.lineStyle(2, 0x00f5ff, 0.8);
        const fNotch = 8;
        _portraitFrame.strokeLineShape(new Phaser.Geom.Line(portX - portSize / 2, portY - portSize / 2, portX - portSize / 2 + fNotch, portY - portSize / 2));
        _portraitFrame.strokeLineShape(new Phaser.Geom.Line(portX - portSize / 2, portY - portSize / 2, portX - portSize / 2, portY - portSize / 2 + fNotch));
        _portraitFrame.strokeLineShape(new Phaser.Geom.Line(portX + portSize / 2, portY + portSize / 2, portX + portSize / 2 - fNotch, portY + portSize / 2));
        _portraitFrame.strokeLineShape(new Phaser.Geom.Line(portX + portSize / 2, portY + portSize / 2, portX + portSize / 2, portY + portSize / 2 - fNotch));

        _portraitSprite = addEl(PhaserScene.add.image(portX, portY, 'buttons', 'Skillicon14_06.png')
            .setDepth(GAME_CONSTANTS.DEPTH_HUD + 1005)
            .setScrollFactor(0));
        _portraitSprite.setDisplaySize(portSize - 10, portSize - 10);

        // 5. Text elements (Right 80% width region)
        const textX = BOX_X + 160;
        
        _nameText = addEl(PhaserScene.add.text(textX, BOX_Y + 20, '', {
            fontFamily: 'Quantico-Bold',
            fontSize: '15px',
            color: '#ff33cc' // Magenta theme color
        }).setDepth(GAME_CONSTANTS.DEPTH_HUD + 1005).setScrollFactor(0));

        const textW = BOX_W - 160 - 40;
        _dialogText = addEl(PhaserScene.add.text(textX, BOX_Y + 45, '', {
            fontFamily: 'Quantico-Regular',
            fontSize: '16px',
            color: '#ffffff',
            align: 'left',
            wordWrap: { width: textW, useAdvancedWrap: true }
        }).setDepth(GAME_CONSTANTS.DEPTH_HUD + 1005).setScrollFactor(0));

        // 6. Blink indicators
        _continueIndicator = addEl(PhaserScene.add.text(BOX_X + BOX_W - 35, BOX_Y + BOX_H - 22, '▶', {
            fontFamily: 'Quantico-Bold',
            fontSize: '13px',
            color: '#00f5ff'
        }).setOrigin(0.5).setDepth(GAME_CONSTANTS.DEPTH_HUD + 1005).setScrollFactor(0).setVisible(false));

        _continueIndicatorTween = PhaserScene.tweens.add({
            targets: _continueIndicator,
            alpha: 0.2,
            duration: 600,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
    }

    /**
     * Completely destroys any active dialog elements.
     */
    function _closeDialogUI() {
        // Stop the blink tween before destroying objects so Phaser doesn't
        // try to update a destroyed game object on the next tick.
        if (_continueIndicatorTween) {
            _continueIndicatorTween.remove();
            _continueIndicatorTween = null;
        }

        if (_dialogContainer) {
            _dialogContainer.destroy();
            _dialogContainer = null;
        }
        _dialogBg = null;
        _portraitSprite = null;
        _portraitFrame = null;
        _nameText = null;
        _dialogText = null;
        _continueIndicator = null;

        if (_clickBlocker) {
            _clickBlocker.destroy();
            _clickBlocker = null;
        }
        _currentDialog = null;
    }

    /**
     * Immediately dismisses any active dialog and clears the queue.
     * Useful for phase transitions to ensure clean UI state.
     */
    function forceClearDialog() {
        debugLog("[DIALOG SYSTEM] Force clearing active dialog.");
        if (_typewriterTimer) {
            _typewriterTimer.remove();
            _typewriterTimer = null;
        }
        if (_autoContinueTimer) {
            _autoContinueTimer.remove();
            _autoContinueTimer = null;
        }
        _isTyping = false;
        _dialogQueue = [];
        _onCompleteCallback = null;

        _closeDialogUI();
    }

    return {
        init,
        playDialog,
        playDialogSequence,
        forceClearDialog
    };
})();

// Export for global access if needed
if (typeof window !== 'undefined') {
    window.dialogSystem = dialogSystem;
}
