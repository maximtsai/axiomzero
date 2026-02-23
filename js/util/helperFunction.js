'use strict';

const helper = {
    _typewriterTimeouts: [],

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
            this.push(timeoutId);
._typewriterTimeouts        }
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
                    ref: "blackPixel",
                    x: gameConsts.halfWidth,
                    y: gameConsts.halfHeight,
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

    restartGame: function() {
        location.reload();
    }
};
