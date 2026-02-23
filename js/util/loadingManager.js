// LoadingManager - Centralized loading with retry, stall detection, and error handling

class LoadingManager {

    // ─── Phase 2: main asset load ─────────────────────────────────────────────
    //
    // Three completion paths, all routed through finish():
    //   1. Normal  — Phaser fires 'complete' after all files are processed.
    //   2. Stall   — no progress for TIMEOUT_THRESHOLD ms; hard timeout fires.
    //   3. Forced  — caller could invoke resetTimer externally if needed.
    //
    // The hard timeout resets on every progress event, so a slow-but-steady
    // connection is never penalised — only a true silence triggers the fallback.

    setupMainLoading(scene, onCompleteCallback, onProgressCallback = null) {
        let loadComplete = false;
        let loadTimeout  = null;
        let failedFiles  = new Map();

        const finish = () => {
            if (loadComplete) return;
            loadComplete = true;
            clearTimeout(loadTimeout);
            if (onCompleteCallback) onCompleteCallback();
        };

        const resetTimer = () => {
            clearTimeout(loadTimeout);
            loadTimeout = setTimeout(() => {
                console.warn(`No loader progress for ${GAME_CONSTANTS.TIMEOUT_THRESHOLD}ms — forcing start (${scene.load.totalFailed || 0} failed file(s))`);
                finish();
            }, GAME_CONSTANTS.TIMEOUT_THRESHOLD);
        };

        // Overall progress (0–1) — update bar and reset stall timer
        scene.load.on('progress', (value) => {
            resetTimer();
            if (onProgressCallback) onProgressCallback(value);
        });

        // Per-file progress — also counts as activity
        scene.load.on('fileprogress', resetTimer);

        // File error — retry with exponential backoff up to MAX_RETRIES
        scene.load.on('loaderror', (file) => {
            console.error('Load error:', file.key, file.url);
            resetTimer();

            const retryCount = (failedFiles.get(file.key) || 0) + 1;

            if (retryCount <= GAME_CONSTANTS.MAX_RETRIES) {
                failedFiles.set(file.key, retryCount);
                console.warn(`Retrying ${file.key} (attempt ${retryCount}/${GAME_CONSTANTS.MAX_RETRIES})`);
                if (onProgressCallback) onProgressCallback(null, `retrying ${retryCount}/${GAME_CONSTANTS.MAX_RETRIES}`);
                setTimeout(() => scene.load.retry(), GAME_CONSTANTS.RETRY_DELAY_BASE * retryCount);
            } else {
                console.error(`Giving up on ${file.key} after ${GAME_CONSTANTS.MAX_RETRIES} attempts`);
                if (onProgressCallback) onProgressCallback(null, 'some files failed');
            }
        });

        // File success — clear retry record
        scene.load.on('filecomplete', (key) => {
            if (failedFiles.has(key)) {
                debugLog(`${key} recovered on retry`);
                failedFiles.delete(key);
            }
        });

        // Normal completion
        scene.load.once('complete', () => {
            if (scene.load.totalFailed > 0) {
                console.warn(`${scene.load.totalFailed} file(s) failed — continuing anyway`);
            }
            finish();
        });

        // Seed the timeout before load.start() is called
        resetTimer();
    }

    // ─── Phase 1: minimal preload ─────────────────────────────────────────────
    //
    // No hard timeout — we can't start the game without the preload images.
    // Instead, detect a stall and tell the user to refresh.

    setupInitialPreload(scene, statusElement) {
        let lastProgressTime = Date.now();
        let failedFiles      = new Map();

        const resetTimer = () => { lastProgressTime = Date.now(); };

        // Stall detection — reports if no activity for INITIAL_PRELOAD_STALL ms
        const stallCheck = setInterval(() => {
            if (Date.now() - lastProgressTime > GAME_CONSTANTS.INITIAL_PRELOAD_STALL) {
                console.error('Phase 1 load stalled');
                if (statusElement) {
                    statusElement.innerHTML   = 'Loading appears stuck. Please check your connection and refresh.';
                    statusElement.style.color = '#ff6b6b';
                }
                clearInterval(stallCheck);
            }
        }, GAME_CONSTANTS.WATCHDOG_INTERVAL);

        scene.load.on('progress',     resetTimer);
        scene.load.on('fileprogress', resetTimer);
        scene.load.on('complete', () => clearInterval(stallCheck));

        // Retry logic (same pattern as Phase 2, no progress callback needed)
        scene.load.on('loaderror', (file) => {
            console.error('Phase 1 load error:', file.key);
            resetTimer();

            const retryCount = (failedFiles.get(file.key) || 0) + 1;
            if (retryCount <= GAME_CONSTANTS.MAX_RETRIES) {
                failedFiles.set(file.key, retryCount);
                console.warn(`Retrying ${file.key} (attempt ${retryCount}/${GAME_CONSTANTS.MAX_RETRIES})`);
                setTimeout(() => scene.load.retry(), GAME_CONSTANTS.RETRY_DELAY_BASE * retryCount);
            } else {
                console.error(`Giving up on ${file.key} after ${GAME_CONSTANTS.MAX_RETRIES} attempts`);
            }
        });

        scene.load.on('filecomplete', (key) => {
            if (failedFiles.has(key)) {
                debugLog(`${key} recovered on retry`);
                failedFiles.delete(key);
            }
        });
    }
}

const loadingManager = new LoadingManager();
