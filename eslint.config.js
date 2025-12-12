import prettier from 'eslint-config-prettier'
import vue from 'eslint-plugin-vue'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: ['.nuxt/**/*', 'dist/**/*'],
  },
  {
    files: ['**/*.{js,jsx,ts,tsx,vue}'],
    extends: [
      ...vue.configs['flat/essential'],
      ...tseslint.configs.recommended,
      prettier,
    ],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: ['.vue'],
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    rules: {
      'vue/multi-word-component-names': 'off',
    },
  }
)
