/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // brand accent is a CSS var so the whole UI can be re-themed in one place
        brand: 'var(--brand)',
        'brand-tint': 'var(--brand-tint)',
        ink: '#1d1d1f',
        ink2: '#8a8a90',
        ink3: '#b6b6bc',
        line: '#efeff1',
        header: '#18181d',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"PingFang SC"', '"Microsoft YaHei"', '"Segoe UI"', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
