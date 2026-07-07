import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx,mdx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace']
      },
      colors: {
        neutral: {
          50: 'rgb(var(--neutral-50) / <alpha-value>)',
          100: 'rgb(var(--neutral-100) / <alpha-value>)',
          200: 'rgb(var(--neutral-200) / <alpha-value>)',
          300: 'rgb(var(--neutral-300) / <alpha-value>)',
          400: 'rgb(var(--neutral-400) / <alpha-value>)',
          500: 'rgb(var(--neutral-500) / <alpha-value>)',
          600: 'rgb(var(--neutral-600) / <alpha-value>)',
          700: 'rgb(var(--neutral-700) / <alpha-value>)',
          800: 'rgb(var(--neutral-800) / <alpha-value>)',
          900: 'rgb(var(--neutral-900) / <alpha-value>)',
          950: 'rgb(var(--neutral-950) / <alpha-value>)'
        },
        app: {
          DEFAULT: 'rgb(var(--app-text) / <alpha-value>)',
          bg: 'rgb(var(--app-bg) / <alpha-value>)',
          card: 'rgb(var(--app-card) / <alpha-value>)',
          border: 'rgb(var(--app-border) / <alpha-value>)',
          text: 'rgb(var(--app-text) / <alpha-value>)',
          muted: 'rgb(var(--app-text-muted) / <alpha-value>)'
        },
        ink: {
          DEFAULT: 'rgb(var(--ink-bg) / <alpha-value>)',
          fg: 'rgb(var(--ink-fg) / <alpha-value>)'
        },
        dot: {
          DEFAULT: 'rgb(var(--dot-bg) / <alpha-value>)',
          fg: 'rgb(var(--dot-fg) / <alpha-value>)'
        }
      }
    }
  },
  plugins: []
};

export default config;
