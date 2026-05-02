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
    let currentPhase = '';

    /**
     * Initializes the dialog system and sets up MessageBus subscribers.
     */
    function init() {
        console.log("[DIALOG SYSTEM] Initializing...");

        if (typeof messageBus !== 'undefined') {
            messageBus.subscribe('phaseChanged', (phase) => {
                currentPhase = phase;
            });

            // Stub for future dialog triggers
            // messageBus.subscribe('nodePurchased', _onNodePurchased);
            // messageBus.subscribe('iterationEnded', _onIterationEnded);
        }
    }

    /**
     * Checks if dialog can currently be displayed.
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
        console.log(`[DIALOG SYSTEM] Playing dialog sequence: ${id}`);
        // UI logic for displaying the dialog box and typewriter effect goes here
    }

    /**
     * Immediately dismisses any active dialog and clears the queue.
     * Useful for phase transitions or emergency interrupts.
     */
    function forceClearDialog() {
        console.log("[DIALOG SYSTEM] Force clearing active dialog.");
        // UI logic for hiding the dialog box goes here
    }

    return {
        init,
        playDialog,
        forceClearDialog
    };
})();

// Export for global access if needed
if (typeof window !== 'undefined') {
    window.dialogSystem = dialogSystem;
}
