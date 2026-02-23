'use strict';

const helper = {
    _typewriterTimeouts: [],

    clickEffectPool: null,

    initClickEffectPool: function(scene) {
        helper.clickEffectPool = new ObjectPool(
            function() {
                return scene.add.image(0, 0, 'white_pixel');
            },
            function(obj) {
                obj.setActive(false);
                obj.setVisible(false);
                obj.setScale(1);
                obj.setAlpha(0.6);
                obj.setDepth(10000);
            },
            50
        );
    },

    runFunctionOverIntervals: function(func, intervals = [], prevDelay = 0) {
        if (intervals.length > 0) {
            const firstInterval = intervals[0];
            const delayAmt = firstInterval.delay + prevDelay;
            if (firstInterval.duration) {
                prevDelay = firstInterval.duration;
            } else {
                prevDelay = 0;
            }
            const timeoutId = setTimeout(() => {
                func(firstInterval);
                intervals.shift();
                helper.runFunctionOverIntervals(func, intervals, prevDelay);
            }, delayAmt);
            this._typewriterTimeouts.push(timeoutId);
        }
    },

    openFullscreen: function() {
        const elem = document.body;
        if (elem.requestFullscreen) {
            elem.requestFullscreen();
        } else if (elem.webkitRequestFullscreen) {
            elem.webkitRequestFullscreen();
        } else if (elem.msRequestFullscreen) {
            elem.msRequestFullscreen();
        }
    },

    testMobile: function() {
        const regex = /Mobi|Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
        return regex.test(navigator.userAgent);
    },

    isSafariIOS: function() {
        const ua = window.navigator.userAgent;
        const iOS = !!ua.match(/iPad/i) || !!ua.match(/iPhone/i);
        const webkit = !!ua.match(/WebKit/i);
        const iOSSafari = iOS && webkit && !ua.match(/CriOS/i);
        return iOSSafari;
    },

    createGlobalClickBlocker: function(showPointer) {
        if (!globalObjects.clickBlocker) {
            globalObjects.clickBlocker = new Button({
                normal: {
                    ref: "black_pixel",
                    x: GAME_CONSTANTS.halfWidth,
                    y: GAME_CONSTANTS.halfHeight,
                    alpha: 0.001,
                    scaleX: 1000,
                    scaleY: 1000
                },
                onMouseUp: function() {}
            });
        } else {
            globalObjects.clickBlocker.setState(NORMAL);
            globalObjects.clickBlocker.setOnMouseUpFunc(function() {});
            buttonManager.bringButtonToTop(globalObjects.clickBlocker);
        }
        if (showPointer && canvas) {
            canvas.style.cursor = 'pointer';
        }
        return globalObjects.clickBlocker;
    },

    hideGlobalClickBlocker: function() {
        if (!globalObjects.clickBlocker) {
            return;
        }
        globalObjects.clickBlocker.setState(DISABLE);
        if (canvas) {
            canvas.style.cursor = 'default';
        }
    },

    typewriterText: function(textObj, str, delay = 50, sfx) {
        if (str.length <= 0) {
            return;
        }
        if (!textObj || !textObj.active) {
            return;
        }
        textObj.setText(textObj.text + str[0]);
        if (sfx && str[0] !== " " && str[0] !== "•") {
            playSound(sfx);
        }
        let actualDelay = delay;
        if (str[0] === " ") {
            actualDelay = 0;
        }
        const timeoutId = setTimeout(function() {
            helper.typewriterText(textObj, str.substring(1, str.length), delay, sfx);
        }, actualDelay);
        this._typewriterTimeouts.push(timeoutId);
    },

    typewriterTextByWord: function(textObj, str, delay = 50, sfx) {
        if (str.length <= 0) {
            return;
        }
        if (!textObj || !textObj.active) {
            return;
        }

        const wordBoundaryRegex = /[\s\-.,!?;:()\[\]{}"']/;

        let wordEnd = 0;
        let foundNonBoundary = false;

        for (let i = 0; i < str.length; i++) {
            if (wordBoundaryRegex.test(str[i])) {
                if (foundNonBoundary) {
                    wordEnd = i;
                    break;
                }
                wordEnd = i + 1;
            } else {
                foundNonBoundary = true;
            }
        }

        if (wordEnd === 0 || (wordEnd === 1 && wordBoundaryRegex.test(str[0]))) {
            wordEnd = str.length;
        }

        const word = str.substring(0, wordEnd);
        textObj.setText(textObj.text + word);

        if (sfx && word.trim().length > 0) {
            playSound(sfx);
        }

        const timeoutId = setTimeout(function() {
            helper.typewriterTextByWord(textObj, str.substring(wordEnd), delay, sfx);
        }, delay);
        this._typewriterTimeouts.push(timeoutId);
    },

    clearTypewriterTimeouts: function() {
        this._typewriterTimeouts.forEach(function(id) {
            clearTimeout(id);
        });
        this._typewriterTimeouts = [];
    },

    createClickEffect: function(x, y) {
        let clickImage;
        if (helper.clickEffectPool && helper.clickEffectPool.getPoolSize() > 0) {
            clickImage = helper.clickEffectPool.get();
            clickImage.setPosition(x, y);
            clickImage.setActive(true);
            clickImage.setVisible(true);
        } else {
            clickImage = PhaserScene.add.image(x, y, 'white_pixel');
            clickImage.setAlpha(0.6);
            clickImage.setDepth(10000);
            clickImage.setScale(7);
        }

        const releaseImage = function() {
            if (helper.clickEffectPool && helper.clickEffectPool.getPoolSize() < 50) {
                helper.clickEffectPool.release(clickImage);
            } else {
                clickImage.destroy();
            }
        };

        PhaserScene.tweens.add({
            targets: clickImage,
            scaleX: 11,
            scaleY: 11,
            duration: 50,
            ease: 'Quad.easeIn',
            onComplete: function() {
                PhaserScene.tweens.add({
                    targets: clickImage,
                    scaleX: 0,
                    scaleY: 0,
                    duration: 250,
                    ease: 'Quad.easeOut',
                    onComplete: function() {
                        releaseImage();
                    }
                });
            }
        });
    },

    restartGame: function() {
        location.reload();
    }
};
