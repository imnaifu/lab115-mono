# Unit Converter · converter.lab115.com

Bilingual (中文 / English) unit converter with closest-real-world-reference illustrations.

## Tech
- **Astro 5** (SSG / static output) — every page pre-rendered to HTML at build time for SEO
- **React 19** as an interactive island (`client:load`) for the converter UI
- TypeScript, strict mode
- Nginx (Docker, multi-stage build)
- Multi-arch GitHub Actions build (arm64 + amd64)
- Coolify auto-deploy

## Develop

```bash
npm install
npm run dev
```

Opens at `http://localhost:5173`.

## Build

```bash
npm run build
npm run preview
```

Build output goes to `dist/` (pure static HTML + JS). `preview` serves it locally.

## Categories
Length · Weight · Temperature · Volume · Area · Speed

## SEO

Every page is fully pre-rendered. The HTML shipped to crawlers contains:
- Page `<title>` + `description` + `keywords`
- Open Graph + Twitter card meta
- JSON-LD `WebApplication` structured data
- The complete converter UI (unit names, hero illustration, reference labels)

Edit per-page SEO in `src/pages/*.astro` (`title`, `description`, `jsonLd` props).
Global head shell lives in `src/layouts/Layout.astro`.

## Project layout

```
src/
├── layouts/
│   └── Layout.astro              # <html> shell, meta tags, JSON-LD, GA
├── pages/
│   └── index.astro               # homepage; mounts <ConverterApp client:load />
├── components/
│   ├── ConverterApp.tsx          # React island, top-level state
│   ├── TopBar / Intro / Tabs / CategoryHead / Hero / UnitGrid /
│   ├── UnitCard / Sidebar / SiteFooter / SvgIcon
├── data/
│   ├── categories.ts             # unit definitions per category
│   └── references.ts             # real-world reference objects
├── utils/
│   ├── format.ts                 # number formatting
│   └── convert.ts                # unit ↔ base conversion + closest-ref finder
├── hooks/
│   └── usePersistedState.ts      # SSR-safe localStorage state
├── i18n.ts                       # zh / en string tables
├── icons.ts                      # inline SVG illustrations
└── index.css                     # all styles (CSS variables in :root)
public/
├── robots.txt
├── sitemap.xml
└── ads.txt
```

## Add a unit / reference object
1. Add the unit to the relevant entry in `src/data/categories.ts` (`CATEGORIES`).
2. Add a reference object to `src/data/references.ts` (`REFS`) with size in base units + svg key + zh/en labels.
3. Add the SVG to `src/icons.ts` (60×60 viewBox).

## Colors / fonts
Edit the CSS variables in `:root` at the top of `src/index.css`.
