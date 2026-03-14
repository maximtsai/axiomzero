window.TRANSLATIONS = {
    ui: {
        loading: {
            en: 'Loading...'
        },
        title: {
            en: 'Axiom Zero'
        },
        yes: {
            en: 'Yes',
            es: 'Sí',
            zh: '是'
        },
        no: {
            en: 'No',
            es: 'No',
            zh: '否'
        },
        replay: {
            en: 'Replay'
        },
        back: {
            en: 'Back',
            es: 'Volver',
            zh: '返回'
        }
    },
    nodes: {},
    descriptions: {}
};

const SUPPORTED_LANGUAGES = ['en', 'es', 'zh'];

/**
 * Loads the language from localStorage/gameOptions. 
 * Defaults to 'en'.
 */
function loadSavedLanguage() {
    try {
        // First check the specific translation key
        const saved = localStorage.getItem('catgirl-language');
        if (saved && SUPPORTED_LANGUAGES.includes(saved)) {
            return saved;
        }
        
        // Fallback to gameOptions if available (from globals.js)
        if (typeof gameOptions !== 'undefined' && gameOptions.language && SUPPORTED_LANGUAGES.includes(gameOptions.language)) {
            return gameOptions.language;
        }
    } catch (e) {
        // localStorage not available
    }
    return 'en';
}

function saveLanguage(lang) {
    try {
        localStorage.setItem('catgirl-language', lang);
        // Also sync with gameOptions if it exists for persistence consistency
        if (typeof gameOptions !== 'undefined') {
            gameOptions.language = lang;
            if (typeof saveGameOptions === 'function') saveGameOptions();
        }
    } catch (e) { }
}

function setLanguage(lang) {
    if (SUPPORTED_LANGUAGES.includes(lang)) {
        window.currentLanguage = lang;
        saveLanguage(lang);
    }
}

window.currentLanguage = loadSavedLanguage();

/**
 * Gets a translated string for the current language.
 * Supports fallbacks to 'en'.
 * Supports simple placeholders like {0}, {1} etc.
 * 
 * @param {string} mainKey - e.g. 'ui'
 * @param {string} subKey - e.g. 'loading'
 * @param {Array} [placeholders] - Values to replace {0}, {1}...
 */
function t(mainKey, subKey, placeholders = []) {
    let entry = window.TRANSLATIONS[mainKey] ? window.TRANSLATIONS[mainKey][subKey] : null;
    if (!entry) return `${mainKey}.${subKey}`;

    let text = entry[window.currentLanguage] || entry['en'] || `[${subKey}]`;

    if (placeholders.length > 0) {
        placeholders.forEach((val, i) => {
            text = text.replace(`{${i}}`, val);
        });
    }

    return text;
}

/**
 * Gets a translated string for a specific language (ignoring global state).
 */
function tRaw(mainKey, subKey, lang = 'en') {
    let entry = window.TRANSLATIONS[mainKey] ? window.TRANSLATIONS[mainKey][subKey] : null;
    if (!entry) return `[${subKey}]`;
    return entry[lang] || entry['en'] || `[${subKey}]`;
}

/**
 * Checks if a translation key exists.
 */
function hasTranslation(mainKey, subKey) {
    return !!(window.TRANSLATIONS[mainKey] && window.TRANSLATIONS[mainKey][subKey]);
}

// Exports
window.t = t;
window.tRaw = tRaw;
window.hasTranslation = hasTranslation;
window.setLanguage = setLanguage;
window.SUPPORTED_LANGUAGES = SUPPORTED_LANGUAGES;
