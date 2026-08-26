import { defineConfig } from 'eslint/config';

export default defineConfig([
    {
        files: ['**/*.js', '**/*.mjs'],
        ignores: ['node_modules/**', 'tool-cache/**'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module'
        },
        rules: {
            'array-callback-return': 'error',
            eqeqeq: 'error',
            'no-constant-condition': 'error',
            'no-duplicate-imports': 'error',
            'no-promise-executor-return': 'error',
            'no-return-await': 'error',
            'no-unused-vars': [
                'error',
                {
                    argsIgnorePattern: '^_'
                }
            ],
            'no-useless-catch': 'error',
            'no-useless-concat': 'error',
            'prefer-const': 'error',
            'prefer-template': 'error'
        }
    }
]);
