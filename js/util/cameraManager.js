/**
 * @fileoverview Camera management singleton — shake, flash, and slide transitions.
 * The camera scrolls between views rather than moving game objects.
 * @module cameraManager
 *
 * Views:
 *   Combat:  scrollX = 0 (tower at screen center)
 *   Upgrade: scrollX = -halfWidth (tower visible in right half, tree panel on left)
 */
const cameraManager = (() => {
    let camera = null;
    let sliding = false;
    let paused = false;

    function init() {
        camera = PhaserScene.cameras.main;

        messageBus.subscribe('gamePaused', () => { paused = true; });
        messageBus.subscribe('gameResumed', () => { paused = false; });
    }

    /**
     * Smoothly scroll the camera to a target scrollX.
     * @param {number} targetX - Target scrollX value.
     * @param {number} [duration=GAME_CONSTANTS.TRANSITION_DURATION] - Transition duration in ms.
     * @param {string} [ease='Cubic.easeOut'] - Easing function.
     * @param {Function} [onComplete] - Called when slide finishes.
     */
    function slideTo(targetX, duration = GAME_CONSTANTS.TRANSITION_DURATION, ease = 'Cubic.easeOut', onComplete) {
        if (!camera) return;
        sliding = true;
        PhaserScene.tweens.add({
            targets: camera,
            scrollX: targetX,
            duration,
            ease,
            onComplete: () => {
                sliding = false;
                if (onComplete) onComplete();
            }
        });
    }

    /** Scroll camera to Upgrade Phase view (tower in right half). */
    function toUpgradeView(duration = GAME_CONSTANTS.TRANSITION_DURATION, onComplete) {
        slideTo(-GAME_CONSTANTS.halfWidth / 2, duration, 'Cubic.easeOut', onComplete);
    }

    /** Scroll camera to Combat view (tower centered). */
    function toCombatView(duration = GAME_CONSTANTS.TRANSITION_DURATION, onComplete) {
        slideTo(0, duration, 'Cubic.easeOut', onComplete);
    }

    /**
     * Camera shake effect.
     * @param {number} [duration=150] - Duration in ms.
     * @param {number} [intensity=0.01] - Shake intensity (0–1).
     */
    function shake(duration = 150, intensity = 0.01) {
        if (!camera || paused) return;
        camera.shake(duration, intensity);
    }

    /**
     * Screen flash effect.
     * @param {number} [duration=500] - Flash duration in ms.
     * @param {number} [r=255] @param {number} [g=255] @param {number} [b=255]
     */
    function flash(duration = 500, r = 255, g = 255, b = 255) {
        if (!camera) return;
        camera.flash(duration, r, g, b);
    }

    /** @returns {boolean} True if a slide transition is currently active. */
    function isSliding() {
        return sliding;
    }

    /** @returns {number} Current camera scrollX. */
    function getScrollX() {
        return camera ? camera.scrollX : 0;
    }

    /**
     * Creates and configures the secondary cameras used by the Upgrade Tree.
     * @param {number} panelWidth - Width of the tree panel.
     * @param {Phaser.GameObjects.Container} treeContainer - Container to exclude from main camera.
     * @returns {{ treeNodeCamera: Phaser.Cameras.Scene2D.Camera, uiCamera: Phaser.Cameras.Scene2D.Camera }}
     */
    function setupTreeCameras(panelWidth, treeContainer) {
        const treeNodeCamera = PhaserScene.cameras.add(0, 0, panelWidth, GAME_CONSTANTS.HEIGHT);
        treeNodeCamera.setBackgroundColor('rgba(0,0,0,0)');

        const uiCamera = PhaserScene.cameras.add(0, 0, GAME_CONSTANTS.WIDTH, GAME_CONSTANTS.HEIGHT);
        uiCamera.setBackgroundColor('rgba(0,0,0,0)');

        // Cross-filtering: Hide tree from main camera, and world from tree cameras
        PhaserScene.cameras.main.ignore(treeContainer);
        treeNodeCamera.ignore(PhaserScene.children.list);
        uiCamera.ignore(PhaserScene.children.list);

        // Un-ignore the container itself for the node camera
        treeContainer.cameraFilter &= ~treeNodeCamera.id;

        // Global hook: newly spawned non-tree elements get ignored by tree cameras
        PhaserScene.events.on('addedtoscene', (child) => {
            if (!child.isTreeElement) {
                if (treeNodeCamera && treeNodeCamera.scene) treeNodeCamera.ignore(child);
                if (uiCamera && uiCamera.scene) uiCamera.ignore(child);
            }
        });

        return { treeNodeCamera, uiCamera };
    }

    /**
     * Assigns a game object to be rendered ONLY by a specific camera (e.g. the UI camera).
     * Automatically handles recursive assignment for Containers and common component properties (bgSprite, text).
     * @param {Phaser.GameObjects.GameObject} gameObject 
     * @param {Phaser.Cameras.Scene2D.Camera} targetCamera 
     * @param {Phaser.Cameras.Scene2D.Camera[]} ignoreCameras 
     */
    function assignToCamera(gameObject, targetCamera, ignoreCameras = []) {
        if (!gameObject || !targetCamera) return;

        const _apply = (obj) => {
            if (!obj) return;

            // 1. Hide from main camera by default
            PhaserScene.cameras.main.ignore(obj);

            // 2. Hide from other provided cameras
            ignoreCameras.forEach(cam => {
                if (cam && cam !== targetCamera) cam.ignore(obj);
            });

            // 3. Ensure it's NOT ignored by the target camera
            if (obj.cameraFilter !== undefined) obj.cameraFilter &= ~targetCamera.id;


            // 4. Handle custom Button class (if applicable)
            if (obj.bgSprite) {
                _apply(obj.bgSprite);
                if (obj.text) _apply(obj.text);
            }

            // 5. Recursive handle for Containers or VirtualGroups
            if (obj.list && Array.isArray(obj.list)) {
                obj.list.forEach(child => _apply(child));
            } else if (obj.getChildren && typeof obj.getChildren === 'function') {
                obj.getChildren().forEach(child => {
                    if (child.ref) _apply(child.ref);
                });
            }
        };

        _apply(gameObject);
    }

    /**
     * Temporarily offsets the viewport of all cameras (HUD, World, and Tree).
     * @param {number} duration - Duration in ms.
     * @param {number} x - Horizontal offset in pixels.
     * @param {number} y - Vertical offset in pixels.
     */
    function setTempShift(duration, x, y) {
        if (!PhaserScene || !PhaserScene.cameras) return;

        const cams = PhaserScene.cameras.cameras;
        const originalPositions = cams.map(c => ({ cam: c, x: c.x, y: c.y }));

        cams.forEach(c => {
            c.x += x;
            c.y += y;
        });

        PhaserScene.time.delayedCall(duration, () => {
            originalPositions.forEach(p => {
                p.cam.x = p.x;
                p.cam.y = p.y;
            });
        });
    }

    return { init, slideTo, toUpgradeView, toCombatView, shake, flash, isSliding, getScrollX, setupTreeCameras, assignToCamera, setTempShift };
})();
