/** @type {import('tailwindcss').Config} */
// Colours are the Sokosoko design system's tokens. Every value lives once, as a
// CSS variable in src/popup/index.css; these names only point at them.
const token = (name) => `var(--${name})`;

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        paper: token('paper'),
        'paper-soft': token('paper-soft'),
        'paper-sunk': token('paper-sunk'),
        line: token('line'),
        'line-strong': token('line-strong'),
        ink: token('ink'),
        'ink-muted': token('ink-muted'),
        brand: token('brand'),
        'brand-deep': token('brand-deep'),
        'brand-soft': token('brand-soft'),
        'on-brand': token('on-brand'),
        link: token('link'),
        success: token('success'),
        'success-soft': token('success-soft'),
        scrim: token('scrim'),
        well: token('well'),
        'fill-sky': token('fill-sky'),
        'fill-mint': token('fill-mint'),
        'fill-yellow': token('fill-yellow'),
      },
      fontFamily: {
        // Nunito ships with the extension (Latin only); CJK falls through to the sans stack.
        display: ['Nunito', '"Noto Sans SC"', '"PingFang SC"', '"Microsoft YaHei"', 'system-ui', 'sans-serif'],
        sans: ['"Noto Sans SC"', '"PingFang SC"', '"Hiragino Sans GB"', '"Microsoft YaHei"', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        xs: '4px',
        sm: '6px',
        md: '12px',
        lg: '20px',
      },
      boxShadow: {
        pop: token('shadow-pop'),
        sheet: token('shadow-sheet'),
      },
    },
  },
  plugins: [],
};
