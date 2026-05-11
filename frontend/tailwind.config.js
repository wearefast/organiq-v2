/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['var(--font-mono)', 'JetBrains Mono', 'monospace'],
      },
      colors: {
        shell: 'var(--bg-shell)',
        sidebar: 'var(--bg-sidebar)',
        content: 'var(--bg-content)',
        elevated: 'var(--bg-elevated)',
        accent: {
          DEFAULT: 'var(--accent)',
          hover: 'var(--accent-hover)',
          muted: 'var(--accent-muted)',
        },
        phase: {
          1: 'var(--phase-1)',
          2: 'var(--phase-2)',
          3: 'var(--phase-3)',
          4: 'var(--phase-4)',
        },
      },
      fontSize: {
        'page-title': ['18px', { fontWeight: '600', lineHeight: '1.3' }],
        section: ['14px', { fontWeight: '600', lineHeight: '1.4' }],
        body: ['13px', { fontWeight: '400', lineHeight: '1.5' }],
        table: ['12px', { fontWeight: '400', lineHeight: '1.5' }],
        label: ['12px', { fontWeight: '500', lineHeight: '1.4' }],
        header: ['11px', { fontWeight: '600', lineHeight: '1.3', letterSpacing: '0.05em' }],
        badge: ['10px', { fontWeight: '500', lineHeight: '1.4' }],
      },
      spacing: {
        'topbar': '48px',
        'sidenav': '56px',
        'sidenav-expanded': '240px',
        'step-rail': '280px',
      },
    },
  },
  plugins: [],
};
