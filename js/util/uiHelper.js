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
                    scaleY: 1000,
                    depth: 999999 // Ensure it starts at a very high depth
                },
                onMouseUp: function () { }
            });
            globalObjects.clickBlocker.setScrollFactor(0);
        } else {
            globalObjects.clickBlocker.setState(NORMAL);
            globalObjects.clickBlocker.setOnMouseUpFunc(function () { });
            globalObjects.clickBlocker.setDepth(999999);
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
 
    /** Returns true if the global click blocker is currently active (blocking). */
    isGlobalBlockerActive: function () {
        return globalObjects.clickBlocker && globalObjects.clickBlocker.state !== DISABLE;
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
    },
 
    _isWiping: false,
 
    /**
     * Perform a full-screen black wipe transition with input blocking and error safety.
     * @param {Function} callback - Function to execute when the screen is fully obscured.
     */
    screenWipe: function (callback) {
        if (this._isWiping) return;
        this._isWiping = true;
 
        const W = GAME_CONSTANTS.WIDTH;
        const H = GAME_CONSTANTS.HEIGHT;
        const halfW = GAME_CONSTANTS.halfWidth;
        const halfH = GAME_CONSTANTS.halfHeight;
 
        // Use existing global click blocker to eat all inputs during the wipe
        const blocker = this.createGlobalClickBlocker(false);
        blocker.setDepth(999999); // Just below the visual wipe
 
        // Create the visual black pixel (2x2 base size)
        const wipe = PhaserScene.add.image(-halfW, halfH, 'pixels', 'black_pixel.png');
        wipe.setDisplaySize(W, H);
        wipe.setDepth(1000000); // Highest possible depth layer
        wipe.setScrollFactor(0);
        wipe.setOrigin(0.5);
 
        // Phase 1: Slide in from left to center
        PhaserScene.tweens.add({
            targets: wipe,
            x: halfW,
            duration: 450,
            ease: 'Cubic.easeIn',
            onComplete: () => {
                // Screen is now fully black. Execute the provided logic safely.
                try {
                    if (typeof callback === 'function') callback();
                } catch (e) {
                    console.error('[uiHelper] screenWipe callback failed:', e);
                }
 
                // Phase 2: Slide out from center to right
                PhaserScene.tweens.add({
                    targets: wipe,
                    x: W + halfW,
                    duration: 450,
                    ease: 'Cubic.easeOut',
                    delay: 50,
                    onComplete: () => {
                        wipe.destroy();
                        this.hideGlobalClickBlocker();
                        this._isWiping = false;
                    }
                });
            }
        });
    },

    /**
     * Formats a number with comma separators or abbreviated suffixes (K, M, B).
     * @param {number} value - The number to format.
     * @param {number} [decimals=0] - Max decimal places to show.
     * @param {boolean} [abbreviate=false] - Whether to use K, M, B suffixes.
     */
    formatNumber: function (value, decimals = 0, abbreviate = false) {
        if (value === undefined || value === null) return '0';
        const val = Number(value);
        if (isNaN(val)) return '0';

        if (abbreviate && val >= 1000) {
            const suffixes = ['', 'K', 'M', 'B', 'T', 'P', 'E'];
            const suffixNum = Math.floor(Math.log10(val) / 3);
            const shortValue = val / Math.pow(1000, suffixNum);
            return shortValue.toFixed(shortValue < 10 ? 1 : 0) + suffixes[suffixNum];
        }

        if (decimals === 0) {
            return Math.floor(val).toLocaleString();
        }
        return val.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    },

    /**
     * Formats seconds into a string (e.g., "M:SS" or "H:MM:SS").
     * @param {number} totalSeconds - Total seconds to format.
     */
    formatTime: function (totalSeconds) {
        const total = Math.max(0, Math.floor(totalSeconds));
        const hours = Math.floor(total / 3600);
        const minutes = Math.floor((total % 3600) / 60);
        const seconds = total % 60;

        const mStr = minutes.toString().padStart(2, '0');
        const sStr = seconds.toString().padStart(2, '0');

        if (hours > 0) {
            return `${hours}:${mStr}:${sStr}`;
        }
        return `${mStr}:${sStr}`;
    },

    /**
     * Creates a header label and a horizontal line below it.
     */
    createHeader: function (x, y, width, label, depth) {
        const text = PhaserScene.add.text(x, y, label, {
            fontFamily: 'JetBrainsMono_Bold', fontSize: '23px', color: '#000000',
        }).setOrigin(0, 0.8).setDepth(depth).setScrollFactor(0);

        const line = PhaserScene.add.image(x + width / 2 - 40, y + 9, 'pixels', 'black_pixel.png');
        line.setDisplaySize(width - 80, 2);
        line.setDepth(depth);
        line.setScrollFactor(0);

        return { text, line };
    },

    /**
     * Creates a labeled checkbox with toggle logic.
     */
    createCheckbox: function (x, y, label, initialState, depth, onToggle) {
        let state = initialState;
        const btn = new Button({
            normal: { atlas: 'ui', ref: state ? 'checkbox_on_normal.png' : 'checkbox_off_normal.png', x: x + 70, y: y },
            hover: { atlas: 'ui', ref: state ? 'checkbox_on_hover.png' : 'checkbox_off_hover.png' },
            onMouseUp: () => {
                state = !state;
                onToggle(state);
                btn.normal.ref = state ? 'checkbox_on_normal.png' : 'checkbox_off_normal.png';
                btn.hover.ref = state ? 'checkbox_on_hover.png' : 'checkbox_off_hover.png';
                btn.setState(btn.state);
            }
        });
        btn.setDepth(depth).setScrollFactor(0);

        const text = PhaserScene.add.text(x, y, label, {
            fontFamily: 'JetBrainsMono_Bold', fontSize: '21px', color: '#ffffff',
        }).setOrigin(0, 0.5).setDepth(depth).setScrollFactor(0).setShadow(2, 2, '#000000', 2, true, true);

        return { btn, text, getState: () => state };
    },

    /**
     * Creates a styled button with a nine-slice background and hover effects.
     */
    createGlowButton: function (x, y, width, height, label, depth, onClick, isWarning = false) {
        const ref = isWarning ? 'warning_btn_9slice.png' : 'glow_btn_9slice.png';
        const textColor = isWarning ? '#ff3366' : '#ffffff';
        const bg = PhaserScene.add.nineslice(x, y, 'ui', ref, width, height, 20, 20, 20, 20);
        bg.setDepth(depth).setScrollFactor(0).setAlpha(0.75);

        const text = PhaserScene.add.text(x, y, label, {
            fontFamily: 'JetBrainsMono_Bold', fontSize: '18px', color: textColor,
        }).setOrigin(0.5).setDepth(depth).setScrollFactor(0);

        const btn = new Button({
            normal: { ref: 'white_pixel', x: x, y: y, alpha: 0.001, scaleX: width / 2, scaleY: height / 2 },
            onHover: () => { bg.setAlpha(1); },
            onHoverOut: () => { bg.setAlpha(0.75); },
            onMouseUp: onClick
        });
        btn.setDepth(depth + 1).setScrollFactor(0);

        return { bg, text, btn };
    }
});
