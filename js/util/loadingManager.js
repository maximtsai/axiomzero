// LoadingManager - Centralized loading with retry, stall detection, and error handling

class LoadingManager {

    // ─── Phase 2: main asset load ─────────────────────────────────────────────
    //
    // Two completion paths, both routed through finish():
    //   1. Normal      — Phaser fires 'complete' after all files are processed.
    //   2. User forced — caller invokes forceFinish() (e.g. "RUN ANYWAYS" button).
    //
    // Two informational thresholds that fire callbacks but never auto-complete:
    //   - SLOW_WARNING_THRESHOLD  → onSlowWarning() (update loading text).
    //   - TIMEOUT_THRESHOLD       → onTimeoutReached() (show run-anyway button).
    //
    // Both thresholds reset on every progress event, so a slow-but-steady
    // connection is never penalised — only true silence triggers the callbacks.
    //
    // Returns { forceFinish } so the caller can trigger completion externally.

    setupMainLoading(scene, onCompleteCallback, onProgressCallback = null,
                     onSlowWarning = null, onTimeoutReached = null) {
        let loadComplete   = false;
        let pendingRetries = 0;      // retry timers in flight — complete is skipped while > 0
        let warningTimeout = null;
        let loadTimeout    = null;
        let failedFiles    = new Map();

        const finish = () => {
            if (loadComplete) return;
            loadComplete = true;
            clearTimeout(warningTimeout);
            clearTimeout(loadTimeout);
            if (onCompleteCallback) onCompleteCallback();
        };

        const resetTimer = () => {
            clearTimeout(warningTimeout);
            clearTimeout(loadTimeout);

            warningTimeout = setTimeout(() => {
                if (onSlowWarning) onSlowWarning();
            }, GAME_CONSTANTS.SLOW_WARNING_THRESHOLD);

            loadTimeout = setTimeout(() => {
                if (onTimeoutReached) onTimeoutReached();
            }, GAME_CONSTANTS.TIMEOUT_THRESHOLD);
        };

        // Overall progress (0–1) — update bar and reset stall timers
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
                pendingRetries++;
                console.warn(`Retrying ${file.key} (attempt ${retryCount}/${GAME_CONSTANTS.MAX_RETRIES})`);
                if (onProgressCallback) onProgressCallback(null, `retrying ${retryCount}/${GAME_CONSTANTS.MAX_RETRIES}`);
                setTimeout(() => { pendingRetries--; scene.load.retry(); }, GAME_CONSTANTS.RETRY_DELAY_BASE * retryCount);
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

        // Normal completion — skipped if retries are still pending; scene.load.retry()
        // will restart the loader and fire another 'complete' once those finish.
        scene.load.on('complete', () => {
            if (pendingRetries > 0) return;
            if (scene.load.totalFailed > 0) {
                console.warn(`${scene.load.totalFailed} file(s) failed — continuing anyway`);
            }
            finish();
        });

        // Seed the timers before load.start() is called
        resetTimer();

        return { forceFinish: finish };
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
