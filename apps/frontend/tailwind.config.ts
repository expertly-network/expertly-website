import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}', './components/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      // Color tokens — values live in app/globals.css as CSS custom
      // properties; this just exposes them as Tailwind utilities
      // (bg-accent, text-ink-3, border-line-2, …). To change a color
      // everywhere it's used, edit the CSS variable in globals.css, not
      // here. Full usage guidance: docs/design-system.md.
      colors: {
        bg: {
          DEFAULT: 'var(--bg)',
          alt: 'var(--bg-alt)',
          card: 'var(--bg-card)',
        },
        ink: {
          DEFAULT: 'var(--ink)',
          2: 'var(--ink-2)',
          3: 'var(--ink-3)',
          4: 'var(--ink-4)',
        },
        line: {
          DEFAULT: 'var(--line)',
          2: 'var(--line-2)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          2: 'var(--accent-2)',
        },
        neon: 'var(--neon)',
        ok: 'var(--ok)',
        error: 'var(--error)',
        'nav-green': 'var(--nav-green)',
      },

      fontFamily: {
        sans: ['var(--font-geist-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['var(--font-archivo)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },

      // Typography scale — the single place font-size/line-height/
      // letter-spacing/weight get defined. Use these (text-heading,
      // text-eyebrow, etc.) instead of arbitrary text-[Npx] values in
      // components, so changing a size means editing one line here, not
      // hunting through every component that used that number. See
      // docs/design-system.md for what each token is for and where it came
      // from (theme.css's own named scale vs. this app's additions).
      fontSize: {
        // From theme.css verbatim — the design's own hero/marketing scale.
        eyebrow: ['11px', { lineHeight: 'normal', letterSpacing: '0.14em', fontWeight: '500' }],
        display: [
          'clamp(44px, 6.5vw, 96px)',
          { lineHeight: '0.98', letterSpacing: '-0.03em', fontWeight: '500' },
        ],
        headline: [
          'clamp(32px, 4vw, 56px)',
          { lineHeight: '1.04', letterSpacing: '-0.025em', fontWeight: '500' },
        ],
        'section-title': [
          'clamp(28px, 3.2vw, 44px)',
          { lineHeight: '1.08', letterSpacing: '-0.02em', fontWeight: '500' },
        ],
        lede: [
          'clamp(17px, 1.3vw, 20px)',
          { lineHeight: '1.5', letterSpacing: '-0.005em', fontWeight: '400' },
        ],

        // This app's additions — consolidated from recurring (but not
        // perfectly consistent, e.g. 17/18/19px card titles) sizes used
        // across the prototype's non-hero pages. One named size each,
        // rather than reproducing every prototype variant.
        heading: ['32px', { lineHeight: '1.1', letterSpacing: '-0.02em', fontWeight: '500' }],
        // `.art-detail-title` — the article detail page's own clamp range, distinct from
        // `headline` (32-56px, too large here — this was the "title size is huge" bug).
        'article-title': [
          'clamp(24px, 2.8vw, 38px)',
          { lineHeight: '1.12', letterSpacing: '-0.025em', fontWeight: '500' },
        ],
        title: ['18px', { lineHeight: '1.25', letterSpacing: '-0.012em', fontWeight: '500' }],
        stat: ['28px', { lineHeight: 'normal', letterSpacing: '-0.02em', fontWeight: '500' }],
        label: ['12px', { lineHeight: 'normal', letterSpacing: 'normal', fontWeight: '500' }],
        caption: ['13px', { lineHeight: '1.4', letterSpacing: 'normal', fontWeight: '400' }],
        'mono-label': [
          '11px',
          { lineHeight: 'normal', letterSpacing: '0.12em', fontWeight: '500' },
        ],
      },

      // Radii used repeatedly that don't already have a matching Tailwind
      // default (rounded-lg=8px, rounded-xl=12px, rounded-2xl=16px,
      // rounded-3xl=24px, rounded-full already cover the rest of the scale).
      borderRadius: {
        input: '10px',
        card: '20px',
      },
    },
  },
  plugins: [],
};

export default config;
