/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: '#0A0A0F',
          card: '#13131A',
          elevated: '#1C1C28',
        },
        accent: {
          red: '#E53935',
          'red-bright': '#FF1744',
          orange: '#F57C00',
          yellow: '#F9A825',
          green: '#00C853',
        },
        text: {
          primary: '#F5F5F5',
          muted: '#9E9E9E',
        },
        border: {
          DEFAULT: '#2A2A3A',
        },
      },
      keyframes: {
        'pulse-red': {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.02)' },
        },
        'ring-danger': {
          '0%, 100%': { borderColor: '#F57C00' },
          '50%': { borderColor: 'transparent' },
        },
      },
      animation: {
        'pulse-red': 'pulse-red 0.8s ease-in-out infinite',
        'ring-danger': 'ring-danger 1s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
