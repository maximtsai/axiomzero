'use strict';

// typewriterHelper.js — Typewriter text animation utilities.
// Defines the `helper` global object.  Extended by effectPool.js and uiHelper.js.

const helper = {
    _typewriterTimeouts: [],

    /**
     * Calls func(interval) for each entry in intervals[], honouring each
     * entry's delay and optional duration to calculate the next call's offset.
     */
    runFunctionOverIntervals: function(func, intervals = [], prevDelay = 0) {
        if (intervals.length > 0) {
            const firstInterval = intervals[0];
            const delayAmt = firstInterval.delay + prevDelay;
            prevDelay = firstInterval.duration ? firstInterval.duration : 0;
            const timeoutId = setTimeout(() => {
                func(firstInterval);
                intervals.shift();
                helper.runFunctionOverIntervals(func, intervals, prevDelay);
            }, delayAmt);
            this._typewriterTimeouts.push(timeoutId);
        }
    },

    /** Appends str to textObj one character at a time, skipping delay for spaces. */
    typewriterText: function(textObj, str, delay = 50, sfx) {
        if (str.length <= 0 || !textObj || !textObj.active) { return; }
        textObj.setText(textObj.text + str[0]);
        if (sfx && str[0] !== ' ' && str[0] !== '•') { playSound(sfx); }
        const timeoutId = setTimeout(function() {
            helper.typewriterText(textObj, str.substring(1), delay, sfx);
        }, str[0] === ' ' ? 0 : delay);
        this._typewriterTimeouts.push(timeoutId);
    },

    /** Appends str to textObj one word at a time. */
    typewriterTextByWord: function(textObj, str, delay = 50, sfx) {
        if (str.length <= 0 || !textObj || !textObj.active) { return; }

        const wordBoundaryRegex = /[\s\-.,!?;:()\[\]{}"']/;
        let wordEnd = 0;
        let foundNonBoundary = false;

        for (let i = 0; i < str.length; i++) {
            if (wordBoundaryRegex.test(str[i])) {
                if (foundNonBoundary) { wordEnd = i; break; }
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
        if (sfx && word.trim().length > 0) { playSound(sfx); }

        const timeoutId = setTimeout(function() {
            helper.typewriterTextByWord(textObj, str.substring(wordEnd), delay, sfx);
        }, delay);
        this._typewriterTimeouts.push(timeoutId);
    },

    /** Cancel all pending typewriter timeouts. */
    clearTypewriterTimeouts: function() {
        this._typewriterTimeouts.forEach(function(id) { clearTimeout(id); });
        this._typewriterTimeouts = [];
    },
};
