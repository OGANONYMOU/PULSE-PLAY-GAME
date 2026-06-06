import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
      // Downgrade: existing codebase uses `any` intentionally for Supabase query results
      '@typescript-eslint/no-explicit-any': 'warn',
      // Downgrade: v7 new rule fires on valid async-in-effect and guard-clause patterns
      'react-hooks/set-state-in-effect': 'warn',
      // Downgrade: Math.random in useMemo is flagged but not a real render stability bug
      'react-hooks/purity': 'warn',
      // Context and UI library files legitimately export hooks + components together
      'react-refresh/only-export-components': 'warn',
      // Allow @ts-nocheck in the two legacy Supabase-typed hooks (usePermissions, useOrganizers)
      '@typescript-eslint/ban-ts-comment': ['error', {
        'ts-check': false,
        'ts-expect-error': 'allow-with-description',
        'ts-ignore': true,
        'ts-nocheck': false,
      }],
    },
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
])
