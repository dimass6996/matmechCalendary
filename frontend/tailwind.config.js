/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        zinc: {
          750: '#27272a',
          850: '#1f1f22',
          900: '#18181b',
          950: '#09090b',
        },
      },
    },
  },
  plugins: [],
}
