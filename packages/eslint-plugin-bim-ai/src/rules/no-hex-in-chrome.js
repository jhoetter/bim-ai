/**
 * bim-ai/no-hex-in-chrome
 *
 * Disallows hex color literals in chrome TSX files.
 * Use design tokens (--color-*, --disc-*, --draft-*, etc.) instead.
 *
 * Scope: packages/web/src/**\/*.tsx
 * Transitional allowlist: viewport/materials, families/wallTypeCatalog
 *
 * See spec/workpackage-tracker-v3.md §3 token reference for the full
 * Layer A/B/C token catalog.
 */

const HEX_RE = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

/** Files permanently allowed to contain hex literals (transitional). */
const ALLOWLIST = ['viewport/materials', 'families/wallTypeCatalog'];

/** @type {import('eslint').Rule.RuleModule} */
export const noHexInChrome = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow hex color literals in chrome TSX — use design tokens instead',
      url: 'spec/workpackage-tracker-v3.md#3-design-pillars--tokens',
    },
    schema: [],
    messages: {
      noHexInChrome:
        'Hex literal "{{ hex }}" found in chrome TSX. Use a design token ' +
        '(--color-*, --disc-*, --draft-*, etc.) instead. ' +
        'See spec/workpackage-tracker-v3.md §3.',
    },
  },

  create(context) {
    const filename = context.filename ?? context.getFilename?.() ?? '';
    const isChromeTsx = /packages[/\\]web[/\\]src[/\\].+\.tsx$/.test(filename);
    const isAllowlisted = ALLOWLIST.some((pattern) => filename.includes(pattern));

    if (!isChromeTsx || isAllowlisted) return {};

    return {
      Literal(node) {
        if (typeof node.value === 'string' && HEX_RE.test(node.value.trim())) {
          context.report({
            node,
            messageId: 'noHexInChrome',
            data: { hex: node.value },
          });
        }
      },
    };
  },
};
