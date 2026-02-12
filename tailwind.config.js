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
        primary: {
          DEFAULT: '#2563eb', // indigo-600
          light: '#3b82f6',   // blue-500
          dark: '#1e40af',    // indigo-800
        },
        secondary: {
          DEFAULT: '#14b8a6', // teal-500
          light: '#2dd4bf',   // teal-400
          dark: '#0f766e',    // teal-800
        },
        background: {
          DEFAULT: '#f8fafc', // slate-50
          subtle: '#f1f5f9',  // slate-100
        },
        card: {
          DEFAULT: '#fff',
        },
        danger: {
          DEFAULT: '#ef4444', // red-500
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
