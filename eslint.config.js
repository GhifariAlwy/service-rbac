const js = require('@eslint/js');
const globals = require('globals');
const tsParser = require('@typescript-eslint/parser');
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const prettier = require('eslint-config-prettier');

module.exports = [
  { ignores: ['dist/**', 'node_modules/**', 'coverage/**'] },
  js.configs.recommended,

  // Sumber TypeScript: berjalan di Node, jadi pakai global Node lengkap
  // (setTimeout, process, Buffer, dsb).
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
      globals: { ...globals.node },
    },
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      // Semua keluaran log wajib lewat logger JSON terstruktur, bukan console.
      'no-console': 'error',
      eqeqeq: ['error', 'always'],
      // Ditangani oleh aturan versi TypeScript di atas.
      'no-unused-vars': 'off',
      // TypeScript sudah memeriksa keberadaan simbol jauh lebih akurat.
      'no-undef': 'off',
    },
  },

  // File konfigurasi ini sendiri adalah CommonJS.
  {
    files: ['eslint.config.js', '*.config.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
  },

  prettier,
];
