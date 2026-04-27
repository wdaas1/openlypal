/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          900: '#060a14',
          800: '#0a0e1a',
          700: '#0d1424',
          600: '#111827',
          500: '#1a2235',
          400: '#243048',
        },
        neon: {
          green: '#00ff88',
          'green-dark': '#00cc6e',
          'green-dim': '#00ff8820',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
