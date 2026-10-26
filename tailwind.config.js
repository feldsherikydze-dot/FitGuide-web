/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#EAF7EF',
          100: '#D5EFDF',
          200: '#ACE0C0',
          300: '#7FCF9C',
          400: '#56C57F',
          500: '#3AA76D',
          600: '#2C8555',
          700: '#236B45',
          800: '#1B5437',
          900: '#123A26',
        },
        dark: {
          bg: '#0D0F11',
          card: '#14171A',
          border: '#2A3033',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}