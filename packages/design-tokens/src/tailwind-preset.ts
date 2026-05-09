import plugin from 'tailwindcss/plugin';

/**
 * Tailwind preset that exposes the §9 design tokens as utility classes.
 *
 * All values are CSS variables defined in:
 *   - packages/design-tokens/src/tokens-default.css (light chrome)
 *   - packages/design-tokens/src/tokens-dark.css    (dark chrome)
 *   - packages/design-tokens/src/tokens-drafting.css (canvas drafting)
 *
 * Spec: spec/ui-ux-redesign-v1-spec.md §9, §10, §21.
 */

export const bimAIPreset = {
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        // §9.1 Semantic chrome
        background: 'var(--color-background)',
        'canvas-paper': 'var(--color-canvas-paper)',
        foreground: 'var(--color-foreground)',
        surface: {
          DEFAULT: 'var(--color-surface)',
          strong: 'var(--color-surface-strong)',
          muted: 'var(--color-surface-muted)',
        },
        border: {
          DEFAULT: 'var(--color-border)',
          strong: 'var(--color-border-strong)',
        },
        muted: {
          DEFAULT: 'var(--color-muted-foreground)',
          foreground: 'var(--color-muted-foreground)',
        },
        accent: {
          DEFAULT: 'var(--color-accent)',
          foreground: 'var(--color-accent-foreground)',
          soft: 'var(--color-accent-soft)',
        },
        success: 'var(--color-success)',
        warning: 'var(--color-warning)',
        danger: 'var(--color-danger)',
        info: 'var(--color-info)',

        // §9.3 Element category colors (drafting; canvas + legend only)
        cat: {
          wall: 'var(--cat-wall)',
          floor: 'var(--cat-floor)',
          roof: 'var(--cat-roof)',
          door: 'var(--cat-door)',
          window: 'var(--cat-window)',
          stair: 'var(--cat-stair)',
          railing: 'var(--cat-railing)',
          room: 'var(--cat-room)',
          site: 'var(--cat-site)',
          section: 'var(--cat-section)',
          sheet: 'var(--cat-sheet)',
        },

        // §9.2 Drafting palette (canvas only)
        draft: {
          paper: 'var(--draft-paper)',
          'grid-major': 'var(--draft-grid-major)',
          'grid-minor': 'var(--draft-grid-minor)',
          'construction-blue': 'var(--draft-construction-blue)',
          witness: 'var(--draft-witness)',
          cut: 'var(--draft-cut)',
          projection: 'var(--draft-projection)',
          hidden: 'var(--draft-hidden)',
          selection: 'var(--draft-selection)',
          hover: 'var(--draft-hover)',
          snap: 'var(--draft-snap)',
        },
      },
      borderRadius: {
        xs: 'var(--radius-xs)',
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        pill: 'var(--radius-pill)',
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
        mono: ['var(--font-mono)'],
      },
      // §9.6 Typography scale
      fontSize: {
        xs: ['var(--text-xs)', 'var(--text-xs-line)'],
        sm: ['var(--text-sm)', 'var(--text-sm-line)'],
        base: ['var(--text-base)', 'var(--text-base-line)'],
        md: ['var(--text-md)', 'var(--text-md-line)'],
        lg: ['var(--text-lg)', 'var(--text-lg-line)'],
        xl: ['var(--text-xl)', 'var(--text-xl-line)'],
        'mono-xs': ['var(--text-mono-xs)', 'var(--text-mono-xs-line)'],
        'mono-sm': ['var(--text-mono-sm)', 'var(--text-mono-sm-line)'],
      },
      // §9.4 Spacing
      spacing: {
        '0': 'var(--space-0)',
        '1': 'var(--space-1)',
        '2': 'var(--space-2)',
        '3': 'var(--space-3)',
        '4': 'var(--space-4)',
        '5': 'var(--space-5)',
        '6': 'var(--space-6)',
        '7': 'var(--space-7)',
        '8': 'var(--space-8)',
        '10': 'var(--space-10)',
        '12': 'var(--space-12)',
      },
      // §9.7 Elevation
      boxShadow: {
        'elev-0': 'var(--elev-0)',
        'elev-1': 'var(--elev-1)',
        'elev-2': 'var(--elev-2)',
        'elev-3': 'var(--elev-3)',
      },
      ringColor: {
        DEFAULT: 'var(--color-ring)',
      },
      // §9.8 Motion
      transitionDuration: {
        fast: 'var(--motion-fast)',
        base: 'var(--motion-base)',
        slow: 'var(--motion-slow)',
      },
      transitionTimingFunction: {
        out: 'var(--ease-out)',
        'in-out': 'var(--ease-in-out)',
        snap: 'var(--ease-snap)',
      },
      // §8 Shell sizing
      height: {
        topbar: 'var(--shell-topbar-height)',
        statusbar: 'var(--shell-statusbar-height)',
      },
      width: {
        'rail-left': 'var(--shell-rail-left-width)',
        'rail-right': 'var(--shell-rail-right-width)',
        'rail-left-collapsed': 'var(--shell-rail-left-collapsed-width)',
      },
      letterSpacing: {
        eyebrow: 'var(--text-eyebrow-tracking)',
      },
    },
  },
  plugins: [
    plugin(({ addVariant }) => {
      addVariant('mobile-sheet', '@media (pointer: coarse) and (max-width: 640px)');
      addVariant('reduce-motion', '@media (prefers-reduced-motion: reduce)');
      addVariant('shell-md', '@media (min-width: 1280px)');
      addVariant('shell-lg', '@media (min-width: 1600px)');
    }),
  ],
};
