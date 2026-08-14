/**
 * Tailwind v4 is a PostCSS plugin — there is no `tailwind.config.js`. The design
 * tokens live in `@theme` inside `src/index.css`, which is also where the few
 * rules that resist being utilities are kept.
 */
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
