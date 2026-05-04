/**
 * @fileoverview Dialog system for the Companion AI.
 * 
 * DESIGN PRINCIPLES:
 * 1. DIALOG TRIGGERING: Dialog is triggered via MessageBus subscriptions ONLY. 
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

    /**
     * Initializes the dialog system and sets up MessageBus subscribers.
     */
    function init() {
        debugLog("[DIALOG SYSTEM] Initializing...");

        if (typeof messageBus !== 'undefined') {
            messageBus.subscribe('phaseChanged', (phase) => {
                currentPhase = phase;
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
        debugLog(`[DIALOG SYSTEM] Playing dialog sequence: ${id}`);
        // TODO: UI logic for displaying the dialog box and typewriter effect
    }

    /**
     * Creates and activates a fresh click blocker to capture screen-wide inputs.
     * This prevents the player from interacting with the upgrade tree during dialog.
     * The blocker is destroyed automatically once clicked.
     */
    function createDialogClickBlocker() {
        // Clear any existing blocker first
        if (_clickBlocker) {
            _clickBlocker.destroy();
            _clickBlocker = null;
        }

        _clickBlocker = new Button({
            normal: {
                atlas: 'buttons',
                ref: 'black_pixel.png',
                x: GAME_CONSTANTS.halfWidth,
                y: GAME_CONSTANTS.halfHeight,
                alpha: 0.35 // Semi-transparent black overlay
            },
            onMouseUp: () => {
                console.log("test");
                if (_clickBlocker) {
                    _clickBlocker.destroy();
                    _clickBlocker = null;
                }
            }
        });

        // Scale to fit screen with 100px padding (Requirement: black_pixel is 2x2)
        const targetW = GAME_CONSTANTS.WIDTH + 100;
        const targetH = GAME_CONSTANTS.HEIGHT + 100;
        _clickBlocker.setScale(targetW / 2, targetH / 2);
        _clickBlocker.setDepth(GAME_CONSTANTS.DEPTH_HUD + 1000);

        // Ensure the click blocker renders on the UI camera (Requirement §N.3)
        if (typeof upgradeTree !== 'undefined' && upgradeTree.assignToUICamera) {
            upgradeTree.assignToUICamera(_clickBlocker);
        }
    }

    /**
     * Immediately dismisses any active dialog and clears the queue.
     * Useful for phase transitions to ensure clean UI state.
     */
    function forceClearDialog() {
        debugLog("[DIALOG SYSTEM] Force clearing active dialog.");
        if (_clickBlocker) {
            _clickBlocker.destroy();
            _clickBlocker = null;
        }
        // TODO: UI logic for hiding the dialog box
    }

    return {
        init,
        playDialog,
        createDialogClickBlocker,
        forceClearDialog
    };
})();

// Export for global access if needed
if (typeof window !== 'undefined') {
    window.dialogSystem = dialogSystem;
}
