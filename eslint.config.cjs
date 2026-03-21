const {
    defineConfig,
} = require('eslint/config');

const js = require('@eslint/js');
const globals = require('globals');

module.exports = defineConfig([
    js.configs.recommended,
    {
        languageOptions: {
            globals: {
                ...globals.node,
            },

            'ecmaVersion': 2021,
            'sourceType': 'module',
        },

        'rules': {
            'indent': ['error', 4],
            'linebreak-style': ['error', 'unix'],
            'quotes': ['error', 'single'],
            'semi': ['error', 'always'],
        },
    },
]);
