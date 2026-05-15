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
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
