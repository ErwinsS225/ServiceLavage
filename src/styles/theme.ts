/**
 * ServiceLavage Design System Theme Tokens
 * Based on the CSS custom properties in src/index.css and enterprise SaaS guidelines.
 */

export const theme = {
  brand: {
    name: 'ServiceLavage',
    tagline: 'ERP Lavage Auto multitenant · Côte d’Ivoire',
    currency: 'FCFA',
    countryCode: 'CI',
  },

  colors: {
    brand: {
      primary: '#4f46e5',
      primaryHover: '#4338ca',
      primaryActive: '#3730a3',
      accent: '#38bdf8',
      accentHover: '#0ea5e9',
    },
    surface: {
      canvas: '#0c0e14',
      card: '#12151c',
      cardSubtle: '#161a23',
      elevated: '#181c25',
      hover: '#1e2330',
      active: '#242938',
    },
    border: {
      subtle: '#232834',
      medium: '#2d3546',
      strong: '#32394a',
      focus: '#6366f1',
    },
    text: {
      primary: '#f8fafc',
      secondary: '#94a3b8',
      muted: '#64748b',
      disabled: '#475569',
      inverse: '#0f172a',
    },
    status: {
      success: {
        text: 'text-emerald-300',
        bg: 'bg-emerald-500/10',
        border: 'border-emerald-500/25',
        dot: 'bg-emerald-400',
        solid: '#10b981',
      },
      warning: {
        text: 'text-amber-300',
        bg: 'bg-amber-500/10',
        border: 'border-amber-500/25',
        dot: 'bg-amber-400',
        solid: '#f59e0b',
      },
      danger: {
        text: 'text-rose-300',
        bg: 'bg-rose-500/10',
        border: 'border-rose-500/25',
        dot: 'bg-rose-400',
        solid: '#ef4444',
      },
      info: {
        text: 'text-sky-300',
        bg: 'bg-sky-500/10',
        border: 'border-sky-500/25',
        dot: 'bg-sky-400',
        solid: '#38bdf8',
      },
      neutral: {
        text: 'text-slate-300',
        bg: 'bg-slate-500/10',
        border: 'border-slate-500/25',
        dot: 'bg-slate-400',
        solid: '#64748b',
      },
    },
  },

  typography: {
    fontFamilies: {
      sans: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
      mono: "'JetBrains Mono', monospace",
    },
    fontSizes: {
      xs: '0.75rem', // 12px
      sm: '0.875rem', // 14px
      base: '1rem', // 16px
      lg: '1.125rem', // 18px
      xl: '1.25rem', // 20px
      '2xl': '1.5rem', // 24px
      '3xl': '1.875rem', // 30px
    },
    fontWeights: {
      normal: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
    },
  },

  spacing: {
    1: '0.25rem', // 4px
    2: '0.5rem', // 8px
    3: '0.75rem', // 12px
    4: '1rem', // 16px
    5: '1.25rem', // 20px
    6: '1.5rem', // 24px
    8: '2rem', // 32px
    10: '2.5rem', // 40px
    12: '3rem', // 48px
  },

  radius: {
    sm: '0.375rem', // 6px
    md: '0.5rem', // 8px
    lg: '0.75rem', // 12px
    xl: '1rem', // 16px
    '2xl': '1.25rem', // 20px
    full: '9999px',
  },

  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.3)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.4), 0 2px 4px -2px rgba(0, 0, 0, 0.3)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.5), 0 4px 6px -4px rgba(0, 0, 0, 0.4)',
    card: '0 2px 8px -1px rgba(0, 0, 0, 0.4)',
    modal: '0 20px 40px -10px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.08)',
  },
} as const;

export type Theme = typeof theme;
