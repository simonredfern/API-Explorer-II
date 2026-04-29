// ESLint 9 flat config for security scans only. Used by scripts/security-check.sh.
// Kept separate from the repo's .eslintrc.cjs so `npm run lint` is unaffected.
import security from 'eslint-plugin-security'
import tsParser from '@typescript-eslint/parser'

export default [
  security.configs.recommended,
  {
    files: ['src/**/*.{js,ts,mjs,cjs,mts,cts}', 'server/**/*.{js,ts,mjs,cjs,mts,cts}'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 'latest',
      sourceType: 'module'
    }
  },
  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/dist-server/**', '**/*.min.js']
  }
]
