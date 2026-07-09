// Root ESLint flat config. Packages/apps inherit this via `pnpm lint` at root
// or their own `lint` script pointing at their sources.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/.turbo/**', '**/fixtures/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Blueprint discipline: clarity over brevity, no silent any-escape hatches.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },
  {
    // CLI entrypoints and tests may talk to stdout / relax boundary typing.
    files: ['**/*.test.ts', '**/cli/**', '**/boundaries.ts'],
    rules: {
      'no-console': 'off',
    },
  },
  prettier,
);
