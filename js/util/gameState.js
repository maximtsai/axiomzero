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

/** Initialise game state from save or fresh defaults. Catch legacy standalone saves here too. */
function initGameState() {
    // Stage 1: Always populate with absolute fresh defaults
    Object.assign(gameState, JSON.parse(JSON.stringify(GAME_STATE_DEFAULTS)));

    // Stage 2: Restore from save if it exists
    if (hasSave()) {
        loadGame();
    } else {
        // If no full save, check for legacy individual keys to absorb during fresh init
        const migrated = _migrateState(0, gameState);
        Object.assign(gameState, migrated);
        debugLog('Fresh game state initialised with legacy migration check');

        // Apply debug start if needed
        if (typeof FLAGS !== 'undefined' && FLAGS.DEBUG) {
            gameState.data = 200;
            gameState.insight = 5;
            gameState.shard = 5;
            gameState.processor = 5;
            gameState.coin = 5;
            debugLog('Debug start: Resources granted');
        }
    }
}

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
    if (!data.stats) data.stats = JSON.parse(JSON.stringify(GAME_STATE_DEFAULTS.stats));
    if (!data.claimed) data.claimed = {};
    if (!data.settings) data.settings = JSON.parse(JSON.stringify(GAME_STATE_DEFAULTS.settings));

    // Ensure tier is at least 1 for legacy saves
    if (data.currentTier === 0) data.currentTier = 1;

    if (fromVersion < 2) {
        // Attempt to absorb legacy settings
        try {
            if (localStorage.getItem('globalVolume') !== null) {
                data.settings.globalVolume = parseFloat(localStorage.getItem('globalVolume'));
                localStorage.removeItem('globalVolume');
            }
            if (localStorage.getItem('globalMusicVol') !== null) {
                data.settings.globalMusicVol = parseFloat(localStorage.getItem('globalMusicVol'));
                localStorage.removeItem('globalMusicVol');
            }
            if (localStorage.getItem('sfxMuted') !== null) {
                data.settings.sfxMuted = localStorage.getItem('sfxMuted') === 'true';
                localStorage.removeItem('sfxMuted');
            }
            if (localStorage.getItem('musicMuted') !== null) {
                data.settings.musicMuted = localStorage.getItem('musicMuted') === 'true';
                localStorage.removeItem('musicMuted');
            }
            if (localStorage.getItem('chromaticAberration') !== null) {
                data.settings.chromaticAberration = localStorage.getItem('chromaticAberration') === 'true';
                localStorage.removeItem('chromaticAberration');
            }
        } catch (e) {
            console.error('Failed to migrate legacy settings', e);
        }

        // Attempt to absorb legacy milestones
        try {
            const oldMilestonesRaw = localStorage.getItem('axiomzero_milestones');
            if (oldMilestonesRaw) {
                const parsedMilestones = JSON.parse(oldMilestonesRaw);
                if (parsedMilestones.stats) Object.assign(data.stats, parsedMilestones.stats);
                if (parsedMilestones.claimed) Object.assign(data.claimed, parsedMilestones.claimed);
                localStorage.removeItem('axiomzero_milestones');
            }
        } catch (e) {
            console.error('Failed to migrate legacy milestones', e);
        }
    }

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

        // Deep merge data into current gameState to avoid losing fields that weren't in the save
        for (const key in data) {
            if (data[key] !== null && typeof data[key] === 'object' && !Array.isArray(data[key])) {
                if (!gameState[key]) gameState[key] = {};
                Object.assign(gameState[key], data[key]);
            } else {
                gameState[key] = data[key];
            }
        }

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
