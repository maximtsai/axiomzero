// window.TRANSLATIONS is populated by external files in js/localization/
// en.js

const SUPPORTED_LANGUAGES = Object.freeze(['en', 'debug']);

const TRANSLATIONS = window.TRANSLATIONS || {};

// Cleaned up the local storage key
const STORAGE_KEY = 'axiomzero-lang';

/**
 * Cache for dot-path splitting
 */
const _pathCache = new Map();

/**
 * Resolves nested properties like "node.name"
 */
function _resolvePath(obj, path) {
    if (!obj || !path) return null;

    // Fast path (no nesting)
    if (path.indexOf('.') === -1) {
        return obj[path] ?? null;
    }

    let parts = _pathCache.get(path);
    if (!parts) {
        parts = path.split('.');
        _pathCache.set(path, parts);
    }

    let val = obj;

    for (let i = 0; i < parts.length; i++) {
        val = val[parts[i]];
        if (val === undefined || val === null) return null;
    }

    return val;
}

/**
 * Gets translation entry
 */
function _getEntry(lang, mainKey, subKey) {
    const dict = TRANSLATIONS[lang];
    if (!dict || !dict[mainKey]) return null;

    return _resolvePath(dict[mainKey], subKey);
}

/**
 * Loads language from storage
 */
function loadSavedLanguage() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);

        if (saved && SUPPORTED_LANGUAGES.includes(saved)) {
            return saved;
        }

        if (
            typeof gameOptions !== 'undefined' &&
            gameOptions.language &&
            SUPPORTED_LANGUAGES.includes(gameOptions.language)
        ) {
            return gameOptions.language;
        }
    } catch (e) { }

    return 'en';
}

/**
 * Saves language
 */
function saveLanguage(lang) {
    if (!SUPPORTED_LANGUAGES.includes(lang)) return;

    try {
        localStorage.setItem(STORAGE_KEY, lang);

        if (typeof gameOptions !== 'undefined') {
            gameOptions.language = lang;

            if (typeof saveGameOptions === 'function') {
                saveGameOptions();
            }
        }
    } catch (e) { }
}

let currentLanguage = loadSavedLanguage();
window.currentLanguage = currentLanguage;

/**
 * Sets current language
 */
function setLanguage(lang) {
    if (!SUPPORTED_LANGUAGES.includes(lang)) return;

    currentLanguage = lang;
    window.currentLanguage = lang;

    saveLanguage(lang);
}

/**
 * Translation lookup
 */
function t(mainKey, subKey, placeholders = []) {
    const lang = currentLanguage || 'en';

    let text = _getEntry(lang, mainKey, subKey);

    // Fallback to English
    if (text === null && lang !== 'en') {
        text = _getEntry('en', mainKey, subKey);
    }

    // Fixed consistency
    if (text === null) return `[${mainKey}.${subKey}]`;

    if (typeof text !== 'string') return text;

    if (placeholders.length) {
        for (let i = 0; i < placeholders.length; i++) {
            text = text.replaceAll(`{${i}}`, placeholders[i]);
        }
    }

    return text;
}

/**
 * Translation lookup ignoring global language
 */
function tRaw(mainKey, subKey, lang = 'en') {
    let text = _getEntry(lang, mainKey, subKey);

    if (text === null && lang !== 'en') {
        text = _getEntry('en', mainKey, subKey);
    }

    // Fixed consistency
    return text ?? `[${mainKey}.${subKey}]`;
}

/**
 * Checks if translation exists
 */
function hasTranslation(mainKey, subKey) {
    const lang = currentLanguage || 'en';

    const entry = _getEntry(lang, mainKey, subKey);
    if (entry !== null) return true;

    return lang !== 'en' && _getEntry('en', mainKey, subKey) !== null;
}

/**
 * Deep freezes object to prevent mutation.
 * Wrap in a function so it can be called explicitly after all JS translation files load.
 */
function finalizeTranslations() {
    function deepFreeze(obj) {
        if (!obj || Object.isFrozen(obj)) return obj;

        Object.freeze(obj);

        for (const value of Object.values(obj)) {
            if (value && typeof value === "object") {
                deepFreeze(value);
            }
        }

        return obj;
    }

    if (window.TRANSLATIONS) {
        deepFreeze(window.TRANSLATIONS);
    }
}

/**
 * Exports
 */
window.t = t;
window.tRaw = tRaw;
window.hasTranslation = hasTranslation;
window.setLanguage = setLanguage;
window.finalizeTranslations = finalizeTranslations;
window.SUPPORTED_LANGUAGES = SUPPORTED_LANGUAGES;