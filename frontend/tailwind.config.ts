import type { Config } from 'tailwindcss';
import tailwindcssAnimate from 'tailwindcss-animate';

/**
 * This file holds NO values. Every entry is a `var(--…)` pointing at the
 * `:root` block of `src/app/index.css`, which is the single place where the
 * theme is defined. Writing a literal here (a hex, a px size, a font stack)
 * breaks that guarantee: declare it in `index.css` and reference it from here.
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'var(--color-primary)',
          hover: 'var(--color-primary-hover)',
          dark: 'var(--color-primary-dark)',
          100: 'var(--color-primary-100)',
          50: 'var(--color-primary-50)',
          foreground: 'var(--primary-foreground)',
        },
        ink: 'var(--color-ink)',
        body: 'var(--color-body)',
        // `muted` is a TEXT colour in this palette; `muted-foreground` is the
        // shadcn/ui alias for that same colour. Never use `bg-muted`.
        muted: {
          DEFAULT: 'var(--color-muted)',
          foreground: 'var(--muted-foreground)',
        },
        border: 'var(--color-border)',
        bg: 'var(--color-bg)',
        surface: 'var(--color-surface)',
        overlay: 'var(--color-overlay)',
        danger: {
          DEFAULT: 'var(--color-danger)',
          border: 'var(--color-danger-border)',
          bg: 'var(--color-danger-bg)',
        },
        // Names shadcn/ui is written against, aliased in `index.css` to the
        // project tokens above.
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        card: {
          DEFAULT: 'var(--card)',
          foreground: 'var(--card-foreground)',
        },
        popover: {
          DEFAULT: 'var(--popover)',
          foreground: 'var(--popover-foreground)',
        },
        secondary: {
          DEFAULT: 'var(--secondary)',
          foreground: 'var(--secondary-foreground)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          foreground: 'var(--accent-foreground)',
        },
        destructive: {
          DEFAULT: 'var(--destructive)',
          foreground: 'var(--destructive-foreground)',
        },
        input: 'var(--input)',
        ring: 'var(--ring)',
      },
      fontFamily: {
        serif: 'var(--font-serif)',
        sans: 'var(--font-sans)',
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        DEFAULT: 'var(--radius)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        float: 'var(--shadow-float)',
      },
    },
  },
  // Supplies the `animate-in` / `fade-in-0` / `zoom-in-95` utilities that the
  // shadcn/ui `Dialog` is written against. Without it those classes are inert.
  plugins: [tailwindcssAnimate],
} satisfies Config;
