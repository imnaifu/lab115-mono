# --- build stage ---
FROM node:22-alpine AS build
WORKDIR /app

# Install deps first (better layer caching when only source changes).
# `npm ci` strictly matches package-lock.json — fails fast on drift.
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build

# --- runtime stage ---
# `output: "standalone"` emits a minimal server bundle with only the
# node_modules it actually needs, so the runtime image stays small.
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# Listen on all interfaces so Traefik/Coolify can reach the container.
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# standalone server + the static assets and public files it doesn't bundle.
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public

EXPOSE 3000
CMD ["node", "server.js"]
