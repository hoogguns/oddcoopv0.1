/**
 * eslint.config.js — ESLint flat config (ESLint 9+ / 10+)
 *
 * Rules:
 *   • eslint:recommended  — standard safety rules
 *   • eslint-config-prettier — turn off rules that conflict with Prettier formatting
 *   • eslint-plugin-jsdoc — lightweight JSDoc enforcement on exported functions
 */
'use strict';

const js      = require('@eslint/js');
const prettier = require('eslint-config-prettier');
const jsdoc   = require('eslint-plugin-jsdoc');

module.exports = [
  // ── Base recommended rules ────────────────────────────────────────────────
  js.configs.recommended,

  // ── Server-side Node files (entry point + all server/ modules) ───────────
  {
    files: ['server.js', 'server/**/*.js'],
    plugins: { jsdoc },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        require:  'readonly',
        module:   'readonly',
        exports:  'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        process:  'readonly',
        console:  'readonly',
        Buffer:   'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
      },
    },
    rules: {
      // ── Style ───────────────────────────────────────────────────────────
      'no-var': 'error',
      'prefer-const': 'error',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'eqeqeq': ['error', 'always', { null: 'ignore' }],

      // ── Safety ──────────────────────────────────────────────────────────
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-throw-literal': 'error',

      // ── JSDoc (lightweight — only exported functions) ────────────────────
      'jsdoc/require-jsdoc': [
        'warn',
        {
          publicOnly: true,
          require: {
            FunctionDeclaration: true,
            MethodDefinition: false,
            ClassDeclaration: false,
            ArrowFunctionExpression: false,
          },
        },
      ],
      'jsdoc/require-param-description': 'off',
      'jsdoc/require-returns-description': 'off',
      'jsdoc/require-param-type': 'off',
      'jsdoc/require-returns-type': 'off',
      'jsdoc/tag-lines': 'off',
      'jsdoc/valid-types': 'off',
      'jsdoc/check-tag-names': 'off',
    },
  },

  // ── Config + seed files — relax JSDoc ────────────────────────────────────
  {
    files: ['server/config/**/*.js', 'server/seed.js', 'scripts/**/*.js'],
    rules: {
      'jsdoc/require-jsdoc': 'off',
    },
  },

  // ── Public browser JS ─────────────────────────────────────────────────────
  {
    files: ['public/js/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        // Browser built-ins
        window:         'readonly',
        document:       'readonly',
        navigator:      'readonly',
        fetch:          'readonly',
        location:       'readonly',
        history:        'readonly',
        localStorage:   'readonly',
        sessionStorage: 'readonly',
        WebSocket:      'readonly',
        URL:            'readonly',
        URLSearchParams:'readonly',
        Node:           'readonly',
        console:        'readonly',
        setTimeout:     'readonly',
        clearTimeout:   'readonly',
        setInterval:    'readonly',
        clearInterval:  'readonly',
        HTMLCanvasElement: 'readonly',
        Event:          'readonly',
        Blob:           'readonly',
        FileReader:     'readonly',
        FormData:       'readonly',
        alert:          'readonly',
        confirm:        'readonly',
        prompt:         'readonly',
        // Module interop (api.js exports itself for Node test harnesses)
        module:         'readonly',
        Intl:           'readonly',
        getComputedStyle: 'readonly',
        // App globals injected by <script src> load order
        API:            'readonly',   // defined by api.js, consumed by dashboard/drivers/etc.
        OC:             'readonly',   // namespace exported by site.js
        Pricing:        'readonly',   // exported by pricing.js
        DeviceSelector: 'readonly',   // exported by deviceSelector.js
      },
    },
    rules: {
      'no-unused-vars': 'off',     // public globals used by inline HTML scripts
      'jsdoc/require-jsdoc': 'off',
    },
  },

  // ── api.js: declares its own API const — remove the global to avoid redeclare ─
  {
    files: ['public/js/api.js'],
    languageOptions: {
      globals: {
        API: 'off',   // api.js declares its own `const API` — suppress global redeclare
      },
    },
  },

  // ── Prettier formatting override (must be last) ────────────────────────────
  prettier,

  // ── Global ignores ────────────────────────────────────────────────────────
  {
    ignores: ['node_modules/**', 'data/**'],
  },
];
