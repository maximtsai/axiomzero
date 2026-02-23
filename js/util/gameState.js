var gameState = {};

const SAVE_VERSION = 1;

function getGameState() {
    return gameState;
}

function setGameState(key, value) {
    gameState[key] = value;
}

// ─── Persistence ──────────────────────────────────────────────────────────────

const SAVE_KEY = 'axiomzero_save';

function _migrateState(fromVersion, data) {
    // Add cases here as the save format evolves.
    // Example: if (fromVersion < 2) { data.newField = defaultValue; }
    return data;
}

function saveGame() {
    try {
        const payload = JSON.stringify({ version: SAVE_VERSION, data: gameState });
        localStorage.setItem(SAVE_KEY, payload);
        debugLog('Game saved');
    } catch (e) {
        console.error('saveGame failed:', e);
    }
}

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

function hasSave() {
    return localStorage.getItem(SAVE_KEY) !== null;
}

function clearSave() {
    localStorage.removeItem(SAVE_KEY);
    debugLog('Save cleared');
}
