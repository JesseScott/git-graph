import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import prettier from 'eslint-config-prettier';

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      'server/exports/**',
      'test-results/**',
      'playwright-report/**',
    ],
  },
  js.configs.recommended,
  {
    files: [
      'server/**/*.js',
      'frontend/test/**/*.js',
      'e2e/**/*.js',
      'eslint.config.js',
      'playwright.config.js',
    ],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['frontend/src/**/*.{js,jsx}', 'frontend/vite.config.js'],
    plugins: { react, 'react-hooks': reactHooks },
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { react: { version: '18.3' } },
    rules: {
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,
      // R3F uses non-DOM props (args, position, emissive, ...) on lowercase elements
      'react/no-unknown-property': 'off',
      'react/prop-types': 'off',
    },
  },
  prettier,
];
