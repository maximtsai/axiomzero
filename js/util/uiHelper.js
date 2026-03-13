'use strict';

// uiHelper.js — Fullscreen, mobile detection, and global click blocker.
// Extends the `helper` object defined in typewriterHelper.js.

Object.assign(helper, {
    openFullscreen: function () {
        const elem = document.body;
        if (elem.requestFullscreen) { elem.requestFullscreen(); }
        else if (elem.webkitRequestFullscreen) { elem.webkitRequestFullscreen(); }
        else if (elem.msRequestFullscreen) { elem.msRequestFullscreen(); }
    },

    isMobileDevice: function () {
        return /Mobi|Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    },

    isSafariIOS: function () {
        const ua = window.navigator.userAgent;
        const iOS = !!ua.match(/iPad/i) || !!ua.match(/iPhone/i);
        const webkit = !!ua.match(/WebKit/i);
        return iOS && webkit && !ua.match(/CriOS/i);
    },

    /**
     * Shows the singleton full-screen click blocker (creates it on first call).
     * Pass showPointer=true to display a pointer cursor while blocked.
     * Returns the blocker Button.
     */
    createGlobalClickBlocker: function (showPointer) {
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
                onMouseUp: function () { }
            });
            globalObjects.clickBlocker.setScrollFactor(0);
        } else {
            globalObjects.clickBlocker.setState(NORMAL);
            globalObjects.clickBlocker.setOnMouseUpFunc(function () { });
            buttonManager.bringButtonToTop(globalObjects.clickBlocker);
        }
        if (showPointer) {
            const canvas = PhaserScene.sys.canvas;
            if (canvas) { canvas.style.cursor = 'pointer'; }
        }
        return globalObjects.clickBlocker;
    },

    /** Disables the global click blocker and restores the default cursor. */
    hideGlobalClickBlocker: function () {
        if (!globalObjects.clickBlocker) { return; }
        globalObjects.clickBlocker.setState(DISABLE);
        const canvas = PhaserScene.sys.canvas;
        if (canvas) { canvas.style.cursor = 'default'; }
    },

    restartGame: function () {
        location.reload();
    },

    colorToHexString(color) {
        return '#' + color.toString(16).padStart(6, '0');
    },

    /**
     * Creates a nine-sliced indicator at (x,y) that expands and fades in.
     */
    ninesliceIndicator: function (x, y, texture, frame, startW, startH, endW, endH, cornerSize = 10) {
        // Create the nine-slice image
        const indicator = PhaserScene.add.nineslice(x, y, texture, frame, startW, startH, cornerSize, cornerSize, cornerSize, cornerSize);
        indicator.setAlpha(0);
        indicator.setScrollFactor(0);

        // Tween width and height
        PhaserScene.tweens.add({
            targets: indicator,
            width: endW,
            height: endH,
            duration: 1800,
            ease: 'Cubic.easeIn'
        });

        // Tween alpha and handle completion
        PhaserScene.tweens.add({
            targets: indicator,
            alpha: 1,
            duration: 1800,
            ease: 'Quad.easeIn',
            onComplete: () => {
                // Part 2: Contract to 70% of the midpoint between start and end size
                const diffW = endW - startW;
                const diffH = endH - startH;
                const contractW = startW + diffW * 0.3;
                const contractH = startH + diffH * 0.3;

                PhaserScene.tweens.add({
                    targets: indicator,
                    width: contractW,
                    height: contractH,
                    alpha: 0,
                    duration: 900,
                    ease: 'Cubic.easeOut',
                    onComplete: () => {
                        // Part 3: Expand back to full end size
                        PhaserScene.tweens.add({
                            targets: indicator,
                            width: endW,
                            height: endH,
                            alpha: 1,
                            duration: 900,
                            ease: 'Cubic.easeIn',
                            onComplete: () => {
                                // Part 4: Shrink to start size and fade out
                                PhaserScene.tweens.add({
                                    targets: indicator,
                                    width: contractW,
                                    height: contractH,
                                    duration: 900,
                                    ease: 'Cubic.easeOut'
                                });
                                PhaserScene.tweens.add({
                                    targets: indicator,
                                    alpha: 0,
                                    duration: 900,
                                    ease: 'Quad.easeOut',
                                    onComplete: () => {
                                        indicator.destroy();
                                    }
                                });
                            }
                        });
                    }
                });
            }
        });

        return indicator;
    },

    /**
     * Creates a nine-sliced indicator at (x,y) that expands and fades in.
     */
    ninesliceIndicatorShort: function (x, y, texture, frame, startW, startH, endW, endH, cornerSize = 10) {
        // Create the nine-slice image
        const indicator = PhaserScene.add.nineslice(x, y, texture, frame, startW, startH, cornerSize, cornerSize, cornerSize, cornerSize);
        indicator.setAlpha(0);
        indicator.setScrollFactor(0);

        // Tween width and height
        PhaserScene.tweens.add({
            targets: indicator,
            width: endW,
            height: endH,
            duration: 2000,
            ease: 'Quart.easeIn'
        });

        // Tween alpha and handle completion
        PhaserScene.tweens.add({
            targets: indicator,
            alpha: 1.2,
            duration: 2000,
            ease: 'Quart.easeIn',
            onComplete: () => {
                // Part 2: Contract to 70% of the midpoint between start and end size
                const diffW = endW - startW;
                const diffH = endH - startH;
                const contractW = startW + diffW * 0.7;
                const contractH = startH + diffH * 0.7;
                PhaserScene.tweens.add({
                    targets: indicator,
                    width: contractW,
                    height: contractH,
                    duration: 900,
                    ease: 'Cubic.easeOut',
                });
                PhaserScene.tweens.add({
                    targets: indicator,
                    duration: 900,
                    alpha: 0,
                    onComplete: () => {
                        indicator.destroy();
                    }
                });
            }
        });

        return indicator;
    }
});
