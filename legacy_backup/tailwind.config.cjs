/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: { 
    extend: {
      colors: {
        'bloomberg': {
          'bg': '#0a0e27',
          'panel': '#141b2d',
          'border': '#1e2a3a',
          'text': '#d4d4d4',
          'text-dim': '#8b949e',
          'accent': '#00d4aa',
          'positive': '#00d4aa',
          'negative': '#ff6b6b',
          'warning': '#ffa500',
        }
      },
      fontFamily: {
        'mono': ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-down': 'slideDown 0.4s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'slide-in-right': 'slideInRight 0.4s ease-out',
      },
      transitionProperty: {
        'height': 'height',
        'spacing': 'margin, padding',
      }
    } 
  },
  plugins: [],
}
