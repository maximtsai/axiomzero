/**
 * @fileoverview Generic game state management and save/load persistence.
 * Defines: gameState, getGameState, setGameState, saveGame, loadGame, hasSave, clearSave.
 * Uses localStorage with versioned save format for migration support.
 *
 * Game-specific data (GAME_STATE_DEFAULTS, SAVE_KEY, SAVE_VERSION) is defined
 * in js/gameConfig.js, which must be loaded before this file.
 * @module gameState
 */

const gameState = {};

/** @returns {Object} The current game state object. */
function getGameState() {
    return gameState;
}

/** Set a game state field. @param {string} key @param {*} value */
function setGameState(key, value) {
    gameState[key] = value;
}

// ─── Persistence ──────────────────────────────────────────────────────────────

function _migrateState(fromVersion, data) {
    // Add cases here as the save format evolves.
    // Example: if (fromVersion < 2) { data.newField = defaultValue; }
    return data;
}


/** Serialize game state to localStorage. */
function saveGame() {
    try {
        const payload = JSON.stringify({ version: SAVE_VERSION, data: gameState });
        localStorage.setItem(SAVE_KEY, payload);
        debugLog('Game saved');
    } catch (e) {
        console.error('saveGame failed:', e);
    }
}

/** Load game state from localStorage. @returns {boolean} true if a save was found and loaded. */
function loadGame() {
    try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (!raw) return false;
        const parsed = JSON.parse(raw);

        let data;
        if (parsed && typeof parsed.version === 'number') {
            // Versioned format
            data = _migrateState(parsed.version, parsed.data);
        } else {
            // Legacy format (plain object) — treat as version 0
            data = _migrateState(0, parsed);
        }

        Object.assign(gameState, data);
        debugLog('Game loaded');
        return true;
    } catch (e) {
        console.error('loadGame failed:', e);
        return false;
    }
}

/** @returns {boolean} True if a save exists in localStorage. */
function hasSave() {
    return localStorage.getItem(SAVE_KEY) !== null;
}

/** Delete the save from localStorage. */
function clearSave() {
    localStorage.removeItem(SAVE_KEY);
    debugLog('Save cleared');
}
