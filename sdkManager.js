'use strict';

const sdk = {
    _initialized: false,
    _initPromise: null,

    _getRoot: function() {
        if (typeof window === "undefined") {
            return null;
        }
        return window.CrazyGames && window.CrazyGames.SDK ? window.CrazyGames.SDK : null;
    },

    _isReady: function() {
        return this._initialized && this._getRoot() !== null;
    },

    init: function() {
        if (this._isReady()) {
            return Promise.resolve(true);
        }

        if (this._initPromise) {
            return this._initPromise;
        }

        const self = this;
        this._initPromise = (function() {
            return (async function() {
                const sdkRoot = self._getRoot();
                if (!sdkRoot || typeof sdkRoot.init !== "function") {
                    throw new Error("SDK is unavailable. Make sure the SDK script is loaded in index.html.");
                }

                await sdkRoot.init();
                self._initialized = true;
                self._setupSettingsListener(sdkRoot);
                return true;
            })();
        })();

        return this._initPromise;
    },

    _call: function(actionName, action) {
        if (!FLAGS.USING_CRAZYGAMES_SDK) {
            return Promise.resolve(null);
        }
        const self = this;
        return (async function() {
            try {
                await self.init();
                return await action(self._getRoot());
            } catch (error) {
                console.warn("[SDK] " + actionName + " failed:", error);
                return null;
            }
        })();
    },

    getEnvironment: function() {
        const sdkRoot = this._getRoot();
        return sdkRoot ? sdkRoot.environment : "disabled";
    },

    isEnvironmentSupported: function() {
        const env = this.getEnvironment();
        return env === "local" || env === "crazygames";
    },

    requestMidgameAd: function(callbacks) {
        return this._call("request midgame ad", function(sdkRoot) {
            return sdkRoot.ad.requestAd("midgame", callbacks || {});
        });
    },

    requestRewardedAd: function(callbacks) {
        return this._call("request rewarded ad", function(sdkRoot) {
            return sdkRoot.ad.requestAd("rewarded", callbacks || {});
        });
    },

    hasAdblock: function() {
        return this._call("adblock check", function(sdkRoot) {
            return sdkRoot.ad.hasAdblock();
        });
    },

    gameplayStart: function() {
        return this._call("gameplay start", function(sdkRoot) {
            sdkRoot.game.gameplayStart();
            return true;
        });
    },

    gameplayStop: function() {
        return this._call("gameplay stop", function(sdkRoot) {
            sdkRoot.game.gameplayStop();
            return true;
        });
    },

    loadingStart: function() {
        return this._call("loading start", function(sdkRoot) {
            sdkRoot.game.loadingStart();
            return true;
        });
    },

    loadingStop: function() {
        return this._call("loading stop", function(sdkRoot) {
            sdkRoot.game.loadingStop();
            return true;
        });
    },

    happytime: function() {
        return this._call("happytime", function(sdkRoot) {
            sdkRoot.game.happytime();
            return true;
        });
    },

    getSettings: function() {
        return this._call("get game settings", function(sdkRoot) {
            return sdkRoot.game.settings;
        });
    },

    getUser: function() {
        return this._call("get user", function(sdkRoot) {
            return sdkRoot.user.getUser();
        });
    },

    getUserToken: function() {
        return this._call("get user token", function(sdkRoot) {
            return sdkRoot.user.getUserToken();
        });
    },

    showAuthPrompt: function() {
        return this._call("show auth prompt", function(sdkRoot) {
            return sdkRoot.user.showAuthPrompt();
        });
    },

    showAccountLinkPrompt: function() {
        return this._call("show account link prompt", function(sdkRoot) {
            return sdkRoot.user.showAccountLinkPrompt();
        });
    },

    isUserAccountAvailable: function() {
        return this._call("check account availability", function(sdkRoot) {
            return !!sdkRoot.user.isUserAccountAvailable;
        });
    },

    getItem: function(key) {
        if (!FLAGS.USING_CRAZYGAMES_SDK) {
            return Promise.resolve(localStorage.getItem(key));
        }
        const self = this;
        return (async function() {
            try {
                await self.init();
                const sdkRoot = self._getRoot();
                if (sdkRoot && sdkRoot.data && typeof sdkRoot.data.getItem === "function") {
                    return sdkRoot.data.getItem(key);
                }
            } catch (error) {
                console.warn("[SDK] getItem failed:", error);
            }
            return localStorage.getItem(key);
        })();
    },

    setItem: function(key, value) {
        if (!FLAGS.USING_CRAZYGAMES_SDK) {
            localStorage.setItem(key, value);
            return Promise.resolve(true);
        }
        const self = this;
        return (async function() {
            try {
                await self.init();
                const sdkRoot = self._getRoot();
                if (sdkRoot && sdkRoot.data && typeof sdkRoot.data.setItem === "function") {
                    await sdkRoot.data.setItem(key, value);
                    return true;
                }
            } catch (error) {
                console.warn("[SDK] setItem failed:", error);
            }
            localStorage.setItem(key, value);
            return true;
        })();
    },

    removeItem: function(key) {
        return this._call("data remove item", function(sdkRoot) {
            if (sdkRoot && sdkRoot.data && typeof sdkRoot.data.removeItem === "function") {
                return sdkRoot.data.removeItem(key);
            }
            return Promise.resolve();
        });
    },

    clearData: function() {
        return this._call("data clear", function(sdkRoot) {
            if (sdkRoot && sdkRoot.data && typeof sdkRoot.data.clear === "function") {
                return sdkRoot.data.clear();
            }
            return Promise.resolve();
        });
    },

    requestBanner: function(config) {
        return this._call("request banner", function(sdkRoot) {
            return sdkRoot.banner.requestBanner(config);
        });
    },

    requestResponsiveBanner: function(containerId) {
        return this._call("request responsive banner", function(sdkRoot) {
            return sdkRoot.banner.requestResponsiveBanner(containerId);
        });
    },

    clearBanner: function(containerId) {
        return this._call("clear banner", function(sdkRoot) {
            sdkRoot.banner.clearBanner(containerId);
            return true;
        });
    },

    clearAllBanners: function() {
        return this._call("clear all banners", function(sdkRoot) {
            sdkRoot.banner.clearAllBanners();
            return true;
        });
    },

    addSettingsChangeListener: function(listener) {
        const sdkRoot = this._getRoot();
        if (!sdkRoot || !sdkRoot.game || typeof sdkRoot.game.addSettingsChangeListener !== "function") {
            return false;
        }
        sdkRoot.game.addSettingsChangeListener(listener);
        return true;
    },

    removeSettingsChangeListener: function(listener) {
        const sdkRoot = this._getRoot();
        if (!sdkRoot || !sdkRoot.game || typeof sdkRoot.game.removeSettingsChangeListener !== "function") {
            return false;
        }
        sdkRoot.game.removeSettingsChangeListener(listener);
        return true;
    },

    addAuthListener: function(listener) {
        const sdkRoot = this._getRoot();
        if (!sdkRoot || !sdkRoot.user || typeof sdkRoot.user.addAuthListener !== "function") {
            return false;
        }
        sdkRoot.user.addAuthListener(listener);
        return true;
    },

    removeAuthListener: function(listener) {
        const sdkRoot = this._getRoot();
        if (!sdkRoot || !sdkRoot.user || typeof sdkRoot.user.removeAuthListener !== "function") {
            return false;
        }
        sdkRoot.user.removeAuthListener(listener);
        return true;
    },

    // Audio Listeners
    _muteCallbacks: [],
    _unmuteCallbacks: [],
    _isAudioMuted: false,
    _isAudioSettingsResolved: false,

    onAudioMute: function(callback) {
        if (typeof callback === "function") {
            this._muteCallbacks.push(callback);
            // Only replay initial state if SDK has already resolved it
            if (this._isAudioSettingsResolved && this._isAudioMuted) {
                try { callback(); } catch (e) {}
            }
        }
    },

    onAudioUnmute: function(callback) {
        if (typeof callback === "function") {
            this._unmuteCallbacks.push(callback);
            // Only replay initial state if SDK has already resolved it
            if (this._isAudioSettingsResolved && !this._isAudioMuted) {
                try { callback(); } catch (e) {}
            }
        }
    },

    _triggerAudioChange: function(mute) {
        const callbacks = mute ? this._muteCallbacks : this._unmuteCallbacks;
        callbacks.forEach(cb => {
            try {
                cb();
            } catch (e) {
                console.error("[SDK] Audio callback error:", e);
            }
        });
    },

    _setupSettingsListener: function(sdkRoot) {
        const self = this;
        if (sdkRoot && sdkRoot.game) {
            if (sdkRoot.game.settings && sdkRoot.game.settings.muteAudio) {
                self._isAudioMuted = true;
            }
            // Mark initial state as known so late-registered callbacks can replay it correctly
            self._isAudioSettingsResolved = true;
            self._triggerAudioChange(self._isAudioMuted);
            if (typeof sdkRoot.game.addSettingsChangeListener === "function") {
                sdkRoot.game.addSettingsChangeListener(function(newSettings) {
                    if (newSettings && typeof newSettings.muteAudio !== "undefined") {
                        self._isAudioMuted = newSettings.muteAudio;
                        self._triggerAudioChange(newSettings.muteAudio);
                    }
                });
            }
        }
    },

    // Game Context
    setGameContext: function(context) {
        return this._call("set game context", function(sdkRoot) {
            if (sdkRoot.game && typeof sdkRoot.game.setGameContext === "function") {
                sdkRoot.game.setGameContext(context);
                return true;
            }
            return false;
        });
    },

    clearGameContext: function() {
        return this._call("clear game context", function(sdkRoot) {
            if (sdkRoot.game && typeof sdkRoot.game.clearGameContext === "function") {
                sdkRoot.game.clearGameContext();
                return true;
            }
            return false;
        });
    },


    // Leaderboards
    submitScore: function(score, optionsOrLeaderboardId) {
        return this._call("submit score", function(sdkRoot) {
            if (sdkRoot.user && typeof sdkRoot.user.submitScore === "function") {
                const payload = {
                    score: score
                };
                if (optionsOrLeaderboardId && typeof optionsOrLeaderboardId === "object" && optionsOrLeaderboardId.encryptedScore) {
                    payload.encryptedScore = optionsOrLeaderboardId.encryptedScore;
                }
                sdkRoot.user.submitScore(payload);
                return true;
            }
            return false;
        });
    },

    showLeaderboard: function(leaderboardId) {
        return this._call("show leaderboard", function(sdkRoot) {
            if (sdkRoot.leaderboard && typeof sdkRoot.leaderboard.showLeaderboard === "function") {
                sdkRoot.leaderboard.showLeaderboard({
                    leaderboardId: leaderboardId
                });
                return true;
            }
            return false;
        });
    },
};

const sdkGetItem = function(key) {
    return sdk.getItem(key);
};

const sdkSetItem = function(key, value) {
    return sdk.setItem(key, value);
};

const sdkInit = function() {
    return sdk.init();
};
