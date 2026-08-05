# Single-stage on purpose: the image is dominated by Chromium (~500MB), so
# splitting stages to save a few MB of dev deps buys nothing. `npm prune` at
# the end drops typescript/tsx from the runtime layer.
FROM node:22-bookworm-slim
WORKDIR /app

ENV NODE_ENV=production
ENV DATA_DIR=/data
ENV TZ=Asia/Shanghai

# python3/make/g++ are the fallback path for better-sqlite3 when no prebuilt
# binary matches the platform; tzdata makes the TZ env var actually apply.
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ tzdata ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Deps first for layer caching — `npm ci` includes dev deps so tsc can run.
COPY package.json package-lock.json ./
RUN npm ci --include=dev --no-audit --no-fund

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Chromium + its shared libraries. Kept after the build so source edits don't
# invalidate this (slow, ~500MB) layer.
RUN npx playwright install --with-deps chromium

RUN npm prune --omit=dev

# SQLite DB + the persistent browser profile (login state) live here.
VOLUME ["/data"]

CMD ["node", "dist/index.js"]
