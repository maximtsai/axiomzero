var gameState = {};

function getGameState() {
    return gameState;
}

function setGameState(key, value) {
    gameState[key] = value;
}

// ─── Persistence ──────────────────────────────────────────────────────────────

const SAVE_KEY = 'axiomzero_save';

function saveGame() {
    try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(gameState));
        debugLog('Game saved');
    } catch (e) {
        console.error('saveGame failed:', e);
    }
}

function loadGame() {
    try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (!raw) return false;
        const loaded = JSON.parse(raw);
        Object.assign(gameState, loaded);
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
