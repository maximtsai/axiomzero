/**
 * @fileoverview Global keyboard shortcuts and auto-pause.
 *  - Esc: close the top-most popup (reset confirm → Options → level select), otherwise open Options.
 *  - P:   toggle the pause menu (Options) during combat.
 *  - M:   mute / unmute all audio.
 *  - Hiding the tab or leaving the window during combat opens the pause menu.
 * The takeover terminal and the companion dialog own their own input while open.
 * @module hotkeys
 */
const hotkeys = (() => {

    function init() {
        // A generic 'keydown' listener registered at boot runs before the takeover terminal's
        // own listener (added when it opens), so we can still see that the terminal is open.
        PhaserScene.input.keyboard.on('keydown', _onKeyDown);

        document.addEventListener('visibilitychange', () => {
            if (document.hidden) _autoPause();
        });
        window.addEventListener('blur', _autoPause);
    }

    function _onKeyDown(e) {
        switch (e.key) {
            case 'Escape': _onEscape(); break;
            case 'p': case 'P': _onPauseKey(); break;
            case 'm': case 'M': toggleMute(); break;
        }
    }

    // ── Popups / pause ───────────────────────────────────────────────────

    function _onEscape() {
        if (takeoverPopup.isOpen()) return; // the terminal closes itself on Esc
        if (closeTopOptionsPopup()) return;
        if (treePopups.isLevelSelectOpen()) {
            treePopups.closeLevelSelect();
            return;
        }
        if (_canOpenOptions()) openOptionsPopup();
    }

    function _onPauseKey() {
        if (gameStateMachine.getPhase() !== GAME_CONSTANTS.PHASE_COMBAT) return;
        if (isOptionsPopupOpen()) {
            closeTopOptionsPopup(true);
        } else if (_canOpenOptions()) {
            openOptionsPopup();
        }
    }

    /** Leaving the game mid-combat (tab hidden, window blurred) pauses it. */
    function _autoPause() {
        if (gameStateMachine.getPhase() !== GAME_CONSTANTS.PHASE_COMBAT) return;
        if (isOptionsPopupOpen() || !_canOpenOptions()) return;
        openOptionsPopup();
    }

    /** Options can open when nothing else holds input (popup, dialog, transition, death). */
    function _canOpenOptions() {
        if (transitionManager.isTransitioning()) return false;
        if (helper.isInputBlocked()) return false;
        if (gameStateMachine.getPhase() === GAME_CONSTANTS.PHASE_COMBAT && !tower.isAlive()) return false;
        return true;
    }

    // ── Audio ────────────────────────────────────────────────────────────

    /** Mutes music and SFX together; unmuting restores both (and starts music if it never did). */
    function toggleMute() {
        const s = gameState.settings;
        const mute = !(s.sfxMuted && s.musicMuted);
        audio.muteSFX(mute);
        audio.muteMusic(mute);

        const awakened = ((gameState.upgrades && gameState.upgrades.awaken) || 0) >= 1;
        if (!mute && awakened && !audio.getMusicName()) audio.playMusic('bg_music1');

        notificationManager.notify(t('ui', mute ? 'audio_muted' : 'audio_on'), {
            y: 150, fontSize: 24, duration: 1200, color: mute ? '#ff9500' : '#00f5ff',
        });
    }

    return { init, toggleMute };
})();
