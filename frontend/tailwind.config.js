/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0a0c10',
        s1: '#111318',
        s2: '#181c24',
        s3: '#1f2433',
        border: '#252d3d',
        border2: '#2e3a50',
        lime: '#c8f135',
        cyan: '#38e8d5',
        red: '#f03a5f',
        gold: '#f5c542',
        silver: '#a8b8c8',
        bronze: '#cd8b4a',
        txt: '#dde6f0',
        txt2: '#7a8fa8',
        txt3: '#4a5a6e',
      },
      fontFamily: {
        barlow: ['Barlow', 'sans-serif'],
        condensed: ['Barlow Condensed', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
