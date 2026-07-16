# lab115 apps

A monorepo of **independent Next.js apps**, one per subdomain. Each app under
`apps/<name>/` is a self-contained Next.js project (its own `package.json`,
deps and `Dockerfile`). A single `docker-compose.yml` builds them all and
Traefik routes each domain to its container. Coolify auto-deploys on push.

```
repo/
├── apps/
│   └── converter/            # converter.lab115.com — bilingual unit converter
│       ├── package.json / next.config.mjs / tsconfig.json / Dockerfile
│       ├── public/
│       └── src/{app,components,data,hooks,utils,i18n.ts,icons.ts,index.css}
├── docker-compose.yml        # one service per app + Traefik host routing
└── .github/workflows/ci.yml  # quality gate (builds each app on PR/push)
```

## Deploy

Deployment is handled by **Coolify's native git integration** — no custom CI:

- Coolify resource = a **Docker Compose** app connected to this repo
  (compose file `docker-compose.yml`), auto-deploy on push to `main`.
- `git push` → Coolify builds each `apps/*` context (Docker layer cache skips
  unchanged apps) → runs the containers → Traefik + Let's Encrypt serve them.
- Wildcard `*.lab115.com` DNS + a DNS-01 wildcard cert means new subdomains
  need no DNS/cert changes.

## Add a new app

1. Drop the (Claude-design-exported) Next.js project into `apps/<name>/`.
2. Ensure it has a `Dockerfile` — copy `apps/converter/Dockerfile` if missing
   (standard Next.js `output: "standalone"` image, works for any Next app).
3. In `docker-compose.yml`, copy the `converter` service block and change:
   the service name, `build.context` (`./apps/<name>`), every `converter` in
   the Traefik labels, and the `Host(...)` domain.
4. Point the subdomain at the server (or rely on the `*.lab115.com` wildcard),
   then `git push`.

## Develop a single app

```bash
cd apps/converter
npm install
npm run dev      # http://localhost:3000
npm run build    # production build (output: standalone)
```

---

## apps/converter

Bilingual (中文 / English) unit converter with closest-real-world-reference
illustrations. Next.js 15 (App Router) + React 19, TypeScript strict.
Categories: Length · Weight · Temperature · Volume · Area · Speed.

- Layout / global `<head>` / metadata / GA: `src/app/layout.tsx`
- Page + JSON-LD: `src/app/page.tsx`
- Converter UI: `src/components/` (`ConverterApp.tsx` is the client root)

**Add a unit / reference object**
1. Add the unit to the relevant `CATEGORIES` entry in `src/data/categories.ts`.
2. Add a reference object to `REFS` in `src/data/references.ts` (size in base
   units + svg key + zh/en labels).
3. Add the SVG to `src/icons.ts` (60×60 viewBox).

**Colors / fonts** — edit the CSS variables in `:root` at the top of
`src/index.css`.
