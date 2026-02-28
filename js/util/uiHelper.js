'use strict';

// uiHelper.js — Fullscreen, mobile detection, and global click blocker.
// Extends the `helper` object defined in typewriterHelper.js.

Object.assign(helper, {
    openFullscreen: function() {
        const elem = document.body;
        if      (elem.requestFullscreen)       { elem.requestFullscreen(); }
        else if (elem.webkitRequestFullscreen) { elem.webkitRequestFullscreen(); }
        else if (elem.msRequestFullscreen)     { elem.msRequestFullscreen(); }
    },

    testMobile: function() {
        return /Mobi|Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    },

    isSafariIOS: function() {
        const ua = window.navigator.userAgent;
        const iOS    = !!ua.match(/iPad/i) || !!ua.match(/iPhone/i);
        const webkit = !!ua.match(/WebKit/i);
        return iOS && webkit && !ua.match(/CriOS/i);
    },

    /**
     * Shows the singleton full-screen click blocker (creates it on first call).
     * Pass showPointer=true to display a pointer cursor while blocked.
     * Returns the blocker Button.
     */
    createGlobalClickBlocker: function(showPointer) {
        if (!globalObjects.clickBlocker) {
            globalObjects.clickBlocker = new Button({
                normal: {
                    ref: 'black_pixel',
                    x: GAME_CONSTANTS.halfWidth,
                    y: GAME_CONSTANTS.halfHeight,
                    alpha: 0.001,
                    scaleX: 1000,
                    scaleY: 1000
                },
                onMouseUp: function() {}
            });
            globalObjects.clickBlocker.setScrollFactor(0);
        } else {
            globalObjects.clickBlocker.setState(NORMAL);
            globalObjects.clickBlocker.setOnMouseUpFunc(function() {});
            buttonManager.bringButtonToTop(globalObjects.clickBlocker);
        }
        if (showPointer) {
            const canvas = PhaserScene.sys.canvas;
            if (canvas) { canvas.style.cursor = 'pointer'; }
        }
        return globalObjects.clickBlocker;
    },

    /** Disables the global click blocker and restores the default cursor. */
    hideGlobalClickBlocker: function() {
        if (!globalObjects.clickBlocker) { return; }
        globalObjects.clickBlocker.setState(DISABLE);
        const canvas = PhaserScene.sys.canvas;
        if (canvas) { canvas.style.cursor = 'default'; }
    },

    restartGame: function() {
        location.reload();
    },

    colorToHexString(color) {
        return '#' + color.toString(16).padStart(6, '0');
    }
});
