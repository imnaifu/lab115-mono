#!/bin/bash
set -eo pipefail

COOLIFY_TOKEN="$1"
COOLIFY_URL="$2"
COOLIFY_PROJECT="$3"
COOLIFY_SERVER="$4"
SHA_TAG="$5"

echo "==> Checking existing services..."

LIST=$(curl -s -H "Authorization: Bearer $COOLIFY_TOKEN" "$COOLIFY_URL/api/v1/services")

# Find any service named "unit-converter-website"
UUID=$(echo "$LIST" | grep -oP '"name":"unit-converter-website"[^}]*' | grep -oP '"uuid":"[^"]*"' | cut -d'"' -f4 | head -1 || true)

if [ -z "$UUID" ]; then
  echo "==> No existing service found, creating new one..."

  COMPOSE=$(cat <<-YAML
services:
  web:
    image: ghcr.io/imnaifu/unit-converter:$SHA_TAG
    restart: unless-stopped
    ports:
      - "80"
    labels:
      - traefik.enable=true
      - traefik.http.middlewares.gzip.compress=true
      - traefik.http.middlewares.redirect-to-https.redirectscheme.scheme=https
      - traefik.http.routers.http-0-converter.entryPoints=http
      - traefik.http.routers.http-0-converter.middlewares=redirect-to-https
      - traefik.http.routers.http-0-converter.rule=Host(\`converter.lab115.com\`) && PathPrefix(\`/\`)
      - traefik.http.routers.http-0-converter.service=http-0-converter
      - traefik.http.routers.https-0-converter.entryPoints=https
      - traefik.http.routers.https-0-converter.middlewares=gzip
      - traefik.http.routers.https-0-converter.rule=Host(\`converter.lab115.com\`) && PathPrefix(\`/\`)
      - traefik.http.routers.https-0-converter.tls=true
      - traefik.http.routers.https-0-converter.tls.certresolver=letsencrypt
      - traefik.http.services.http-0-converter.loadbalancer.server.port=80
YAML
)
  B64=$(echo "$COMPOSE" | base64 -w0)

  RESPONSE=$(curl -s -X POST -H "Authorization: Bearer $COOLIFY_TOKEN" \
    -H "Content-Type: application/json" \
    "$COOLIFY_URL/api/v1/services" \
    -d "{\"project_uuid\":\"$COOLIFY_PROJECT\",\"server_uuid\":\"$COOLIFY_SERVER\",\"environment_name\":\"production\",\"docker_compose_raw\":\"$B64\",\"name\":\"unit-converter-website\"}")
  echo "Create response: $RESPONSE"
  UUID=$(echo "$RESPONSE" | grep -o '"uuid":"[^"]*"' | cut -d'"' -f4 | head -1)
  echo "New UUID: $UUID"
  sleep 5
else
  echo "==> Found existing service: $UUID"
fi

echo "==> Deploying service $UUID..."
DEPLOY_RESPONSE=$(curl -s -X POST -H "Authorization: Bearer $COOLIFY_TOKEN" "$COOLIFY_URL/api/v1/deploy?uuid=$UUID")
echo "Deploy response: $DEPLOY_RESPONSE"
echo "==> Done! https://converter.lab115.com"
