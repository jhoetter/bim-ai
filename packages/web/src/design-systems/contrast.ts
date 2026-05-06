/**
 * WCAG contrast verifier — spec §22.
 *
 * Pure-math helpers for WCAG 2.1 luminance and contrast-ratio
 * calculations against documented token pairs. Used by the design-token
 * vitest to fail-loud when a token combination drops below AA on body
 * copy or AA-large on chrome.
 */

export interface RGB {
  r: number; // 0..255
  g: number;
  b: number;
}

/** Parse a CSS color string into an `{r, g, b}` triple. Supports the
 * subset our tokens emit: `hsl(...)`, `hsl(... / α)`, `#rgb`, `#rrggbb`,
 * `rgb(...)`, `color-mix(...)` (collapses to first arg). */
export function parseColor(input: string): RGB | null {
  const s = input.trim();
  if (s.startsWith('#')) return parseHex(s);
  if (s.startsWith('rgb')) return parseRgbFunctional(s);
  if (s.startsWith('hsl')) return parseHslFunctional(s);
  if (s.startsWith('color-mix')) return parseColorMix(s);
  return null;
}

function parseHex(s: string): RGB | null {
  let h = s.slice(1);
  if (h.length === 3) {
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  }
  if (h.length !== 6) return null;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if ([r, g, b].some((c) => Number.isNaN(c))) return null;
  return { r, g, b };
}

function parseRgbFunctional(s: string): RGB | null {
  const match = s.match(/rgba?\(([^)]+)\)/);
  if (!match) return null;
  const parts = match[1]!
    .split(/[,\s/]+/)
    .filter(Boolean)
    .slice(0, 3);
  if (parts.length < 3) return null;
  const [r, g, b] = parts.map((p) => Number(p.replace('%', '')));
  if ([r, g, b].some((c) => !Number.isFinite(c))) return null;
  return { r: r!, g: g!, b: b! };
}

function parseHslFunctional(s: string): RGB | null {
  const match = s.match(/hsla?\(([^)]+)\)/);
  if (!match) return null;
  const tokens = match[1]!
    .replace(/\//g, ' ')
    .split(/[\s,]+/)
    .filter(Boolean);
  const [hRaw, sRaw, lRaw] = tokens;
  if (!hRaw || !sRaw || !lRaw) return null;
  const h = Number(hRaw.replace('deg', ''));
  const sat = Number(sRaw.replace('%', '')) / 100;
  const lit = Number(lRaw.replace('%', '')) / 100;
  if (![h, sat, lit].every(Number.isFinite)) return null;
  return hslToRgb(h, sat, lit);
}

/** `color-mix(in srgb, A 12%, B)` — extract the first color component
 * (with paren-depth tracking so commas inside hsl(...) stay attached)
 * and return its RGB as an approximation. The percentage / B / closing
 * bits are ignored. */
function parseColorMix(s: string): RGB | null {
  const inner = s.slice(s.indexOf('(') + 1, s.lastIndexOf(')'));
  const tokens: string[] = [];
  let depth = 0;
  let cursor = 0;
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i]!;
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (ch === ',' && depth === 0) {
      tokens.push(inner.slice(cursor, i).trim());
      cursor = i + 1;
    }
  }
  tokens.push(inner.slice(cursor).trim());
  const colorTokens = tokens
    .filter((t) => !/^in\s/i.test(t))
    .map((t) => t.replace(/\s+\d+(?:\.\d+)?%$/u, '').trim());
  if (!colorTokens.length) return null;
  return parseColor(colorTokens[0]!);
}

function hslToRgb(h: number, s: number, l: number): RGB {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hh = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hh % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (hh < 1) [r, g, b] = [c, x, 0];
  else if (hh < 2) [r, g, b] = [x, c, 0];
  else if (hh < 3) [r, g, b] = [0, c, x];
  else if (hh < 4) [r, g, b] = [0, x, c];
  else if (hh < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

/** WCAG 2.1 relative luminance (sRGB → linearised → weighted). */
export function relativeLuminance({ r, g, b }: RGB): number {
  const channel = (n: number): number => {
    const v = n / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG 2.1 contrast ratio (1.0–21.0). */
export function contrastRatio(a: RGB, b: RGB): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [bright, dim] = la > lb ? [la, lb] : [lb, la];
  return (bright + 0.05) / (dim + 0.05);
}

/** Helper: compute contrast for two CSS color strings; returns null if
 * either fails to parse. */
export function contrastFor(a: string, b: string): number | null {
  const ra = parseColor(a);
  const rb = parseColor(b);
  if (!ra || !rb) return null;
  return contrastRatio(ra, rb);
}
