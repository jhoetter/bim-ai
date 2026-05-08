import { noHexInChrome } from './rules/no-hex-in-chrome.js';

/** @type {import('eslint').ESLint.Plugin} */
const plugin = {
  meta: { name: 'eslint-plugin-bim-ai', version: '0.1.0' },
  rules: {
    'no-hex-in-chrome': noHexInChrome,
  },
};

export default plugin;
