/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg:      'rgb(var(--bg) / <alpha-value>)',
        s1:      'rgb(var(--s1) / <alpha-value>)',
        s2:      'rgb(var(--s2) / <alpha-value>)',
        s3:      'rgb(var(--s3) / <alpha-value>)',
        border:  'rgb(var(--border) / <alpha-value>)',
        border2: 'rgb(var(--border2) / <alpha-value>)',
        lime:    'rgb(var(--theme) / <alpha-value>)',
        cyan:    'rgb(var(--cyan) / <alpha-value>)',
        gold:    'rgb(var(--gold) / <alpha-value>)',
        txt:     'rgb(var(--txt) / <alpha-value>)',
        txt2:    'rgb(var(--txt2) / <alpha-value>)',
        txt3:    'rgb(var(--txt3) / <alpha-value>)',
        red:     '#f03a5f',
        silver:  '#a8b8c8',
        bronze:  '#cd8b4a',
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
