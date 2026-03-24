/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx}',
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Arkaa brand tokens
        brand: {
          primary: '#E8640A',
          hover:   '#D05508',
          light:   '#FFF0E2',
          border:  '#F0B07A',
        },
        warm: {
          page:    '#FFFAF5',
          card:    '#FFFFFF',
          panel:   '#FFF5EC',
          border:  '#F0E8DC',
          input:   '#E8D8C8',
          inputbg: '#FFFAF6',
        },
        text: {
          dark:   '#1A1208',
          mid:    '#8A7060',
          soft:   '#C0A890',
          orange: '#C25A0A',
        },
        // Keep existing tokens so rest of app doesn't break
        primary: {
          DEFAULT: '#2563eb',
          light: '#3b82f6',
          dark: '#1e40af',
        },
        secondary: {
          DEFAULT: '#14b8a6',
          light: '#2dd4bf',
          dark: '#0f766e',
        },
        background: {
          DEFAULT: '#f8fafc',
          subtle: '#f1f5f9',
        },
        card: {
          DEFAULT: '#fff',
        },
        danger: {
          DEFAULT: '#ef4444',
        },
      },
      borderRadius: {
        md: '0.75rem',
        lg: '1.25rem',
      },
      boxShadow: {
        card: '0 2px 8px 0 rgba(16,30,54,0.08)',
        soft: '0 1.5px 6px 0 rgba(16,30,54,0.06)',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui'],
      },
      transitionProperty: {
        'height': 'height',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
  ],
};
