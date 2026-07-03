/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        char: {
          950: '#0b0a09',
          900: '#131110',
          800: '#1c1917',
          700: '#3a332c',
        },
        smoke: {
          300: '#e7e2db',
          400: '#b9b0a3',
          500: '#8a8074',
        },
        ember: {
          400: '#5eb1ff',
          500: '#2f7de8',
          600: '#1b5fc4',
        },
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        body: ['"Space Grotesk"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      backgroundImage: {
        'ember-gradient': 'linear-gradient(135deg, #5eb1ff, #2f7de8 55%, #123f96)',
      },
      boxShadow: {
        ember: '0 8px 30px -8px rgba(47, 125, 232, 0.45)',
        glass: '0 8px 32px -12px rgba(0, 0, 0, 0.5)',
      },
    },
  },
  plugins: [],
}
