import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist', 'public', 'collab-server/node_modules', 'collab-server/.wrangler', 'e2e/.out'] },
  js.configs.recommended,
  {
    files: ['src/core/**/*.js'],
    languageOptions: { sourceType: 'module', globals: globals.browser }
  },
  {
    files: ['collab-server/src/**/*.js'],
    languageOptions: { sourceType: 'module', globals: { ...globals.serviceworker, WebSocketPair: 'readonly' } }
  },
  {
    // End-to-end tests drive a browser; they read like scripts, so a few style rules are relaxed.
    files: ['e2e/**/*.cjs'],
    languageOptions: { sourceType: 'commonjs', globals: { ...globals.node, ...globals.browser } },
    rules: { 'no-unused-vars': 'off', 'no-empty': 'off', 'no-undef': 'off', 'no-irregular-whitespace': 'off' }
  },
  {
    files: ['e2e/**/*.mjs', 'scripts/**/*.mjs'],
    languageOptions: { sourceType: 'module', globals: { ...globals.node, fetch: 'readonly' } }
  },
  {
    files: ['collab-server/test/**/*.mjs'],
    languageOptions: { sourceType: 'module', globals: { ...globals.node, WebSocket: 'readonly', fetch: 'readonly' } }
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [tseslint.configs.recommended],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { ignoreRestSiblings: true }]
    }
  }
);
