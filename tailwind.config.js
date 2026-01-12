/** @type {import('tailwindcss').Config} */
export default {
  content: ['./client/index.html', './client/src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'slate-850': '#1e293b',
        'slate-750': '#2d3748'
      }
    }
  },
  plugins: []
}
