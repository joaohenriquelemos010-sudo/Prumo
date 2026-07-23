import type { Config } from 'tailwindcss'

// The Tailwind theme reads from the CSS custom properties declared in
// src/styles/tokens.css — a single source of truth for the Prumo design system.
// Colours are OKLCH; the tokens carry the alpha channel via <alpha-value>.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: 'var(--color-paper)',
        'paper-2': 'var(--color-paper-2)',
        'paper-3': 'var(--color-paper-3)',
        ink: 'var(--color-ink)',
        'ink-soft': 'var(--color-ink-soft)',
        'ink-mute': 'var(--color-ink-mute)',
        lilas: 'var(--color-lilas)',
        'lilas-soft': 'var(--color-lilas-soft)',
        azul: 'var(--color-azul)',
        'azul-soft': 'var(--color-azul-soft)',
        indigo: 'var(--color-indigo)',
        line: 'var(--color-line)',
        success: 'var(--color-success)',
        warn: 'var(--color-warn)',
      },
      fontFamily: {
        display: 'var(--font-display)',
        body: 'var(--font-body)',
        hand: 'var(--font-hand)',
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        DEFAULT: 'var(--radius-md)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        '2xl': 'var(--radius-2xl)',
        pill: 'var(--radius-pill)',
      },
      boxShadow: {
        soft: 'var(--shadow-soft)',
        lift: 'var(--shadow-lift)',
        glow: 'var(--shadow-glow)',
      },
      spacing: {
        xs: 'var(--space-xs)',
        sm: 'var(--space-sm)',
        md: 'var(--space-md)',
        lg: 'var(--space-lg)',
        xl: 'var(--space-xl)',
        '2xl': 'var(--space-2xl)',
        '3xl': 'var(--space-3xl)',
      },
      transitionTimingFunction: {
        out: 'var(--ease-out)',
        in: 'var(--ease-in)',
        'in-out': 'var(--ease-in-out)',
      },
      maxWidth: {
        prose: '68ch',
        page: '1140px',
      },
    },
  },
  plugins: [],
} satisfies Config
