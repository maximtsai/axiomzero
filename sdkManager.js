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
                    sdkRoot.data.setItem(key, value);
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
            sdkRoot.data.removeItem(key);
            return true;
        });
    },

    clearData: function() {
        return this._call("data clear", function(sdkRoot) {
            sdkRoot.data.clear();
            return true;
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
