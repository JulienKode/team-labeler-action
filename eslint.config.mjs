import js from '@eslint/js'
import tsParser from '@typescript-eslint/parser'
import tsEslint from '@typescript-eslint/eslint-plugin'
import globals from 'globals'

export default [
  // Base configuration for all files
  {
    ignores: ['**/dist/**', '**/lib/**', '**/node_modules/**']
  },
  js.configs.recommended,

  // TypeScript configuration
  {
    files: ['**/*.ts'],
    plugins: {
      '@typescript-eslint': tsEslint
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
        project: './tsconfig.json'
      },
      globals: {
        ...globals.node,
        ...globals.jest
      }
    },
    rules: {
      // Disable base rules that TypeScript handles
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_.*$',
          varsIgnorePattern: '^_.*$',
          caughtErrorsIgnorePattern: '^_.*$'
        }
      ],

      // Core TypeScript rules
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-var-requires': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-empty-interface': 'error',

      // Style rules
      camelcase: 'off', // Disable base rule
      semi: 'off' // Disable base rule
    }
  }
]
