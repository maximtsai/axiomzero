/**
 * @fileoverview Generic game state management and save/load persistence.
 * Defines: gameState, getGameState, setGameState, saveGame, saveSettings, loadGame, hasSave, clearSave.
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

    // A save holding only settings (written by Options or Reset before any progress) still
    // starts a fresh game, so the fresh path below runs (legacy migration, debug start)
    const savedSettings = _settingsOnlySave();

    // Stage 2: Restore from save if it exists
    if (hasSave() && !savedSettings) {
        // An unreadable save would be overwritten by the fresh game's first save; keep a copy
        if (!loadGame()) _backupUnreadableSave();
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
            gameState.coin = 50;
            gameState.levelsDefeated = 3;
            debugLog('Debug start: Resources and progression granted');
        }
        if (savedSettings) gameState.settings = _withDefaults(GAME_STATE_DEFAULTS.settings, savedSettings);
    }
}

/** @returns {Object|null} The settings of a save that contains nothing but settings. */
function _settingsOnlySave() {
    try {
        const stored = _readStoredSave();
        const data = stored && typeof stored.version === 'number' ? stored.data : null;
        if (data && Object.keys(data).length === 1 && data.settings) return data.settings;
    } catch (e) { /* unreadable: handled by the normal load path */ }
    return null;
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


/**
 * Serialize game state to localStorage (and the CrazyGames cloud when enabled).
 * @returns {Promise} Resolves once the cloud write settles, so callers can wait before reloading.
 */
function saveGame() {
    try {
        const synced = _writeSave(gameState);
        debugLog('Game saved');
        return synced;
    } catch (e) {
        console.error('saveGame failed:', e);
    }
    return Promise.resolve();
}

/**
 * Persist only gameState.settings (volume, mute, visual toggles). The rest of the stored
 * save stays as it was at the last phase change: progress is deliberately saved only on
 * phase changes, so a player can reload to undo a misclick even after touching Options.
 * @returns {Promise} Resolves once the cloud write settles.
 */
function saveSettings() {
    try {
        const stored = _readStoredSave();
        let version = SAVE_VERSION;
        let data = {};
        if (stored && typeof stored.version === 'number' && stored.data) {
            version = stored.version;
            data = stored.data;
        } else if (stored && typeof stored.version !== 'number') {
            version = 0; // legacy plain-object save
            data = stored;
        }
        // With no save yet, a settings-only save loads as a fresh game with these settings
        data.settings = JSON.parse(JSON.stringify(gameState.settings));
        const synced = _writeSave(data, version);
        debugLog('Settings saved');
        return synced;
    } catch (e) {
        console.error('saveSettings failed:', e);
    }
    return Promise.resolve();
}

/** Write a save payload to localStorage and, when enabled, the CrazyGames cloud. */
function _writeSave(data, version = SAVE_VERSION) {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ version, data }));

    if (typeof FLAGS !== 'undefined' && FLAGS.USING_CRAZYGAMES_SDK && typeof sdk !== 'undefined') {
        // Suggestion 2: Selective Syncing (exclude localBestScores from cloud payloads)
        const cloudState = { ...data };
        delete cloudState.localBestScores;

        const cloudPayload = JSON.stringify({ version, data: cloudState });

        // Suggestion 1: LZ-string compression
        const compressed = LZString.compressToEncodedURIComponent(cloudPayload);

        return sdk.setItem(SAVE_KEY, compressed).catch(e => {
            console.error('[Cloud] Cloud save failed:', e);
        });
    }
    return Promise.resolve();
}

/** Parse the stored save (plain or LZ-compressed JSON). @returns {Object|null} */
function _readStoredSave() {
    let raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    // A failed cloud write falls back to storing the LZ-compressed payload locally
    if (raw.trim()[0] !== '{' && typeof LZString !== 'undefined') {
        raw = LZString.decompressFromEncodedURIComponent(raw.trim()) || raw;
    }
    return JSON.parse(raw);
}

function _isPlainObject(v) {
    return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/**
 * Merge a saved value over its default. Nested objects (settings, stats, tutorialsSeen)
 * keep default keys the save predates, and a numeric field that was saved as null
 * (a NaN that went through JSON) falls back to its default.
 */
function _withDefaults(def, saved) {
    if (_isPlainObject(def) && _isPlainObject(saved)) {
        const merged = JSON.parse(JSON.stringify(def));
        for (const key in saved) {
            // SECURITY: Prevent Prototype Pollution
            if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
            merged[key] = _withDefaults(def[key], saved[key]);
        }
        return merged;
    }
    if (typeof def === 'number' && !Number.isFinite(saved)) return def;
    return saved;
}

/** Apply loaded save data onto gameState (which already holds fresh defaults). */
function _applySaveData(data, skipKeys = []) {
    for (const key in data) {
        // SECURITY: Prevent Prototype Pollution
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
        if (skipKeys.includes(key)) continue;
        gameState[key] = _withDefaults(GAME_STATE_DEFAULTS[key], data[key]);
    }
}

/** Copy a save that failed to load to a side key, so starting fresh doesn't destroy it. */
function _backupUnreadableSave() {
    try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (raw) {
            localStorage.setItem(SAVE_KEY + '_unreadable', raw);
            console.error('Save could not be loaded; a copy was kept under "' + SAVE_KEY + '_unreadable".');
        }
    } catch (e) {
        console.error('Could not back up unreadable save:', e);
    }
}

/** Load game state from localStorage. @returns {boolean} true if a save was found and loaded. */
function loadGame() {
    try {
        const parsed = _readStoredSave();
        if (!parsed) return false;

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
        _applySaveData(data);

        debugLog('Game loaded');
        return true;
    } catch (e) {
        console.error('loadGame failed:', e);
        return false;
    }
}

/** @returns {boolean} True if a save exists in localStorage. */
function hasSave() {
    try {
        return localStorage.getItem(SAVE_KEY) !== null;
    } catch (e) {
        return false; // Storage blocked (sandboxed iframe, site data disabled)
    }
}

/**
 * Delete the save from localStorage and the CrazyGames cloud.
 * @returns {Promise} Resolves once the cloud copy is gone; reload only after it, or the
 * boot-time cloud fetch restores the old save.
 */
function clearSave() {
    try {
        localStorage.removeItem(SAVE_KEY);
    } catch (e) {
        console.error('clearSave failed:', e);
    }
    debugLog('Save cleared');
    if (typeof FLAGS !== 'undefined' && FLAGS.USING_CRAZYGAMES_SDK && typeof sdk !== 'undefined') {
        return Promise.resolve(sdk.removeItem(SAVE_KEY)).catch(e => {
            console.error('[Cloud] Cloud save delete failed:', e);
        });
    }
    return Promise.resolve();
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
        // Create a copy of state and remove local settings before exporting
        const exportData = JSON.parse(JSON.stringify(gameState));
        delete exportData.settings;

        const payload = JSON.stringify({ version: SAVE_VERSION, data: exportData });
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
        if (!str) return { success: false, error: 'err_empty' };

        const decompressed = LZString.decompressFromEncodedURIComponent(str.trim());
        if (!decompressed) return { success: false, error: 'err_decompression' };

        const pipeIndex = decompressed.indexOf('|');
        if (pipeIndex === -1) return { success: false, error: 'err_format' };

        const checksum = decompressed.substring(0, pipeIndex);
        const payload = decompressed.substring(pipeIndex + 1);

        if (_calculateChecksum(payload) !== checksum) {
            return { success: false, error: 'err_checksum' };
        }

        const parsed = JSON.parse(payload);
        if (!parsed || typeof parsed.version !== 'number' || !parsed.data) {
            return { success: false, error: 'err_malformed' };
        }

        // GUARD: Prevent importing from newer versions of the game
        if (parsed.version > SAVE_VERSION) {
            return { success: false, error: 'import_version_err' };
        }

        // Stage 1: Reset to defaults to prevent "Ghost Data", but preserve local settings
        const localSettings = JSON.parse(JSON.stringify(gameState.settings));
        Object.assign(gameState, JSON.parse(JSON.stringify(GAME_STATE_DEFAULTS)));

        // Stage 2: Apply loaded data
        // UI/Audio settings are local to the device and shouldn't be overwritten by imports
        const data = _migrateState(parsed.version, parsed.data);
        _applySaveData(data, ['settings']);

        // Restore preserved settings
        gameState.settings = localSettings;

        gameState.isImported = true;
        // Persist immediately. Callers must wait on `synced` before reloading, or the
        // boot-time cloud fetch can bring back the pre-import save.
        const synced = saveGame();
        return { success: true, synced };
    } catch (e) {
        console.error('Import failed:', e);
        return { success: false, error: 'err_generic' };
    }
}
