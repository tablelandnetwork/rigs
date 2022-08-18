module.exports = {
  root: true,
  env: {
    browser: true,
    node: true
  },
  parserOptions: {
    parser: '@babel/eslint-parser',
    requireConfigFile: false
  },
  extends: [
    '@nuxtjs',
    'plugin:nuxt/recommended'
  ],
  plugins: [],
  // add your custom rules here
  rules: {
    semi: ['error', 'always'],
    curly: ['error', 'multi'],
    'no-multiple-empty-lines': 'off',
    'object-shorthand': ['error', 'never'],
    'vue/multiline-html-element-content-newline': 'off',
    'vue/no-unused-components': 'off',
    'vue/require-prop-types': 'off',
    'vue/html-self-closing': 'off',
    'vue/singleline-html-element-content-newline': 'off'
  }
};
