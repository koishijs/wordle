import * as hamster from '@hamster-bot/eslint-config'

/** @type {import('eslint').Linter.Config[]} */
export default [
  ...hamster.configs.typescript,
  {
    rules: {
      /*
       * We highly depend on `require` for dynamic import i18n files.
       * FIXME: Maybe we can use `import` instead of `require` in the future.
       */
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    languageOptions: {
      parserOptions: {
        project: './tsconfig.eslint.json',
        projectService: false,
      },
    },
  },
  {
    ignores: [
      'external',
      'node_modules',
      'lib',
      'dist',
      'coverage',
      'docs/.vitepress/dist',
      'docs/.vitepress/cache',
      'packages/*/lib',
      'packages/*/dist',
    ],
  },
]
