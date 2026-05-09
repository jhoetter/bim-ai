/**
 * MAT-V3-02: CSS custom-property token reader for use in TypeScript modules.
 *
 * Reads a CSS custom property from the document root at call time, enabling
 * runtime theme / brand-swap awareness without bundling hex literals.
 *
 * Falls back to `fallback` when:
 *   - Running in SSR / Node (no `window`)
 *   - The token has not been defined yet (e.g. before the stylesheet loads)
 */
export function readToken(varName: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return value.length > 0 ? value : fallback;
}
