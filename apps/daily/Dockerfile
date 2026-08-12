# --- build stage ---
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build

# --- runtime stage ---
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# Unlike the other apps in this repo, the runtime needs git: the daily job
# clones github.com/imnaifu/files onto the mounted volume and pushes each
# digest back. ca-certificates is what lets it talk HTTPS to GitHub.
RUN apk add --no-cache git ca-certificates

COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public

EXPOSE 3000
CMD ["node", "server.js"]
