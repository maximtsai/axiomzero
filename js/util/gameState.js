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
            gameState.data = 8000;
            gameState.insight = 5;
            gameState.shard = 5;
            gameState.processor = 5;
            gameState.coin = 5;
            gameState.levelsDefeated = 5;
            debugLog('Debug start: Resources and progression granted');
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
    }

    // Call project-specific migration hook if defined (e.g. in gameConfig.js)
    if (typeof migrateProjectState === 'function') {
        data = migrateProjectState(fromVersion, data);
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
        if (parsed && typeof parsed.version === 'number' && parsed.data) {
            // Versioned format
            data = _migrateState(parsed.version, parsed.data);
        } else if (parsed && typeof parsed.version !== 'number') {
            // Legacy format (plain object) — treat as version 0
            data = _migrateState(0, parsed);
        } else {
            return false;
        }

        // Stage 1: Reset to defaults to prevent "Ghost Data" from previous session
        Object.assign(gameState, JSON.parse(JSON.stringify(GAME_STATE_DEFAULTS)));

        // Stage 2: Apply loaded data
        for (const key in data) {
            // SECURITY: Prevent Prototype Pollution
            if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;

            gameState[key] = data[key];
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

// ─── Export/Import Utilities ──────────────────────────────────────────────────


/** Simple checksum to prevent manual editing */
function _calculateChecksum(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
}

/** Export current game state to a compressed, scrambled string. */
function exportSaveToString() {
    try {
        const payload = JSON.stringify({ version: SAVE_VERSION, data: gameState });
        const checksum = _calculateChecksum(payload);
        const combined = checksum + '|' + payload;
        
        // This format is URL-safe and doesn't use trailing "=" padding,
        // making it much more reliable for copy-pasting on various platforms.
        return LZString.compressToEncodedURIComponent(combined);
    } catch (e) {
        console.error('Export failed:', e);
        return null;
    }
}

/** Import game state from a compressed, scrambled string. */
function importSaveFromString(str) {
    try {
        if (!str) return { success: false, error: 'Empty string' };
        
        const decompressed = LZString.decompressFromEncodedURIComponent(str.trim());
        if (!decompressed) return { success: false, error: 'Decompression failed' };

        const pipeIndex = decompressed.indexOf('|');
        if (pipeIndex === -1) return { success: false, error: 'Invalid format' };

        const checksum = decompressed.substring(0, pipeIndex);
        const payload = decompressed.substring(pipeIndex + 1);

        if (_calculateChecksum(payload) !== checksum) {
            return { success: false, error: 'Checksum mismatch (Tampered save)' };
        }

        const parsed = JSON.parse(payload);
        if (!parsed || typeof parsed.version !== 'number' || !parsed.data) {
            return { success: false, error: 'Malformed or incomplete payload' };
        }

        // Stage 1: Reset to defaults to prevent "Ghost Data"
        Object.assign(gameState, JSON.parse(JSON.stringify(GAME_STATE_DEFAULTS)));

        // Stage 2: Apply loaded data
        const data = _migrateState(parsed.version, parsed.data);
        for (const key in data) {
            // SECURITY: Prevent Prototype Pollution
            if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;

            gameState[key] = data[key];
        }

        gameState.isImported = true;
        saveGame(); // Persist the imported state immediately
        return { success: true };
    } catch (e) {
        console.error('Import failed:', e);
        return { success: false, error: e.message };
    }
}
