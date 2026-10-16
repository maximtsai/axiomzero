// ESLint config for a no-bundler, script-tag game.
// All game scripts share one global scope, so the set of "known globals" is computed
// from the top-level declarations of every script in index.html. That lets `no-undef`
// catch typos and references to things that were never loaded.
// Cross-file duplicate declarations are checked separately by tools/check-globals.js.

const globals = require('globals');
const { getGameScripts, getTopLevelDeclarations } = require('./tools/gameScripts');

const gameScripts = getGameScripts();

const projectGlobals = {};
for (const file of gameScripts) {
    try {
        for (const d of getTopLevelDeclarations(file)) projectGlobals[d.name] = 'writable';
    } catch {
        // Parse errors are reported by ESLint itself on that file.
    }
}

const vendorGlobals = {
    Phaser: 'readonly',
    LZString: 'readonly',
    CrazyGames: 'readonly',
    gtag: 'readonly',
    dataLayer: 'writable',
    // Optional hooks, called behind `typeof x === 'function'` guards.
    migrateProjectState: 'readonly',
};

// Rules chosen for catching real bugs, not style. Formatting is left alone.
const bugRules = {
    'no-undef': 'error',
    'no-const-assign': 'error',
    'no-class-assign': 'error',
    'no-func-assign': 'error',
    'no-global-assign': 'error',
    'no-dupe-keys': 'error',
    'no-dupe-args': 'error',
    'no-dupe-class-members': 'error',
    'no-dupe-else-if': 'error',
    'no-duplicate-case': 'error',
    'no-redeclare': ['error', { builtinGlobals: false }],
    'no-unreachable': 'error',
    'no-unsafe-finally': 'error',
    'no-unsafe-negation': 'error',
    'no-unsafe-optional-chaining': 'error',
    'no-constant-binary-expression': 'error',
    'no-self-assign': 'error',
    'no-self-compare': 'error',
    'no-compare-neg-zero': 'error',
    'no-loss-of-precision': 'error',
    'no-sparse-arrays': 'error',
    'use-isnan': 'error',
    'valid-typeof': 'error',
    'getter-return': 'error',
    'no-setter-return': 'error',
    'no-shadow-restricted-names': 'error',
    'no-cond-assign': ['warn', 'except-parens'],
    'no-fallthrough': 'warn',
    'no-constant-condition': ['warn', { checkLoops: false }],
    'no-unmodified-loop-condition': 'warn',
    'no-unused-private-class-members': 'warn',
    // Top-level names are used from other files, so only flag unused locals.
    'no-unused-vars': ['warn', { vars: 'local', args: 'none', caughtErrors: 'none', ignoreRestSiblings: true }],
    // The one formatting rule: LF only (matches .gitattributes / .editorconfig).
    'linebreak-style': ['error', 'unix'],
};

module.exports = [
    {
        ignores: ['dist/**', 'node_modules/**', 'scratch/**', 'tmp/**', 'raw/**', '**/*.min.js', 'sw.js', 'test.js'],
    },
    {
        files: [...gameScripts, 'tools/playtest*.js'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'script',
            globals: { ...globals.browser, ...vendorGlobals, ...projectGlobals },
        },
        linterOptions: { reportUnusedDisableDirectives: 'warn' },
        rules: bugRules,
    },
    {
        files: ['eslint.config.js', 'build_prod.js', 'tools/*.js', 'tests/**/*.js', '.claude/skills/**/*.js'],
        ignores: ['tools/playtest*.js'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'commonjs',
            globals: { ...globals.node },
        },
        rules: bugRules,
    },
];
