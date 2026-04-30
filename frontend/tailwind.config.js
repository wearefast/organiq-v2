/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Gilroy', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['DM Mono', 'monospace'],
      },
      colors: {
        border: 'var(--border)',
        input: 'var(--input-border)',
        ring: 'var(--ring)',
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        canvas: 'var(--canvas)',
        surface: 'var(--surface)',
        'section-tint': 'var(--section-tint)',
        primary: {
          DEFAULT: 'var(--cc-red)',
          dark: 'var(--cc-red-dark)',
          foreground: '#ffffff',
        },
        navy: {
          DEFAULT: 'var(--cc-navy)',
          light: 'var(--cc-navy-light)',
        },
        accent: {
          DEFAULT: 'var(--cc-accent)',
          soft: 'var(--cc-accent-soft)',
          pale: 'var(--cc-accent-pale)',
        },
        secondary: {
          DEFAULT: 'var(--surface)',
          foreground: 'var(--text-primary)',
        },
        destructive: {
          DEFAULT: 'var(--cc-red)',
          foreground: '#ffffff',
        },
        muted: {
          DEFAULT: 'var(--surface)',
          foreground: 'var(--text-muted)',
        },
        card: {
          DEFAULT: 'var(--canvas)',
          foreground: 'var(--text-primary)',
        },
        'text-primary': 'var(--text-primary)',
        'text-body': 'var(--text-body)',
        'text-muted': 'var(--text-muted)',
      },
      borderRadius: {
        sm: '4px',
        md: '8px',
        lg: '12px',
        xl: '16px',
        '2xl': '20px',
        pill: '9999px',
      },
      fontSize: {
        hero: ['40px', { fontWeight: '800', lineHeight: '1.1' }],
        headline: ['32px', { fontWeight: '700', lineHeight: '1.2' }],
        section: ['24px', { fontWeight: '700', lineHeight: '1.3' }],
        'card-title': ['20px', { fontWeight: '600', lineHeight: '1.4' }],
        label: ['16px', { fontWeight: '600', lineHeight: '1.5' }],
        body: ['14px', { fontWeight: '400', lineHeight: '1.6' }],
        table: ['13px', { fontWeight: '400', lineHeight: '1.5' }],
        helper: ['12px', { fontWeight: '400', lineHeight: '1.5' }],
        'table-header': ['11px', { fontWeight: '600', lineHeight: '1.4', letterSpacing: '0.05em' }],
      },
      boxShadow: {
        xs: '0 1px 2px 0 rgba(7,25,50,0.04)',
        sm: '0 1px 3px 0 rgba(7,25,50,0.06), 0 1px 2px -1px rgba(7,25,50,0.04)',
        md: '0 4px 6px -1px rgba(7,25,50,0.06), 0 2px 4px -2px rgba(7,25,50,0.04)',
        lg: '0 10px 15px -3px rgba(7,25,50,0.06), 0 4px 6px -4px rgba(7,25,50,0.04)',
        xl: '0 20px 25px -5px rgba(7,25,50,0.06), 0 8px 10px -6px rgba(7,25,50,0.04)',
      },
      backgroundImage: {
        'gradient-hero': 'linear-gradient(135deg, #071932 0%, #AE213E 55%, #DA304F 100%)',
        'gradient-cta': 'linear-gradient(135deg, #AE213E 0%, #DA304F 100%)',
        'gradient-secondary-cta': 'linear-gradient(135deg, #071932 0%, #AE213E 100%)',
        'gradient-sidebar': 'linear-gradient(180deg, #071932 0%, #102447 100%)',
        'gradient-soft': 'linear-gradient(135deg, #FFF7F8 0%, #F8D6DC 100%)',
      },
      maxWidth: {
        layout: '1440px',
      },
    },
  },
  plugins: [],
};
