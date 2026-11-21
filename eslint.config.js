import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist', 'public', 'collab-server/node_modules', 'collab-server/.wrangler'] },
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
