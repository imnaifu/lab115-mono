# video.lab115.com: the interactive preview (Vite build) served by nginx, with the narration clips
# published to public/__simlab/voice (npm run publish:voice). Rendering videos stays a local tool;
# nothing here needs Python, FFmpeg or a browser.

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
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
