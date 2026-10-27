# 硅谷幸存者: exports the Godot project in game/ to a web build, then serves it with nginx.
# The export runs here instead of being committed, so what's live is always what's in the repo
# and shipping doesn't depend on anyone's local Godot install.

# --- Stage 1: export -----------------------------------------------------------------------
FROM debian:bookworm-slim AS export
ARG GODOT_VERSION=4.7.2
# Set by BuildKit: arm64 on the (aarch64) deploy server, amd64 on Intel/AMD machines.
ARG TARGETARCH
# fontconfig only quiets the editor's "system font support is disabled" errors in the log; the
# game ships its own font.
RUN apt-get update \
	&& apt-get install -y --no-install-recommends ca-certificates curl unzip python3 libfontconfig1 \
	&& rm -rf /var/lib/apt/lists/*
# Godot's official Linux build for this architecture; --headless needs no display libraries.
RUN case "$TARGETARCH" in arm64) godot_arch=arm64 ;; *) godot_arch=x86_64 ;; esac \
	&& curl -fsSL -o /tmp/godot.zip "https://github.com/godotengine/godot/releases/download/${GODOT_VERSION}-stable/Godot_v${GODOT_VERSION}-stable_linux.${godot_arch}.zip" \
	&& unzip -q /tmp/godot.zip -d /tmp/godot \
	&& mv "/tmp/godot/Godot_v${GODOT_VERSION}-stable_linux.${godot_arch}" /usr/local/bin/godot \
	&& rm -rf /tmp/godot /tmp/godot.zip
# Only the web templates, read out of the 1.3 GB templates archive with range requests.
COPY game/tools/fetch_web_templates.py /tmp/fetch_web_templates.py
RUN python3 /tmp/fetch_web_templates.py "$GODOT_VERSION" "/root/.local/share/godot/export_templates/${GODOT_VERSION}.stable"
# Everything above is cached between deploys; only the game itself is re-exported.
COPY game /game
RUN /game/tools/export_web.sh /web

# --- Stage 2: serve ------------------------------------------------------------------------
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=export /web /usr/share/nginx/html
# The engine is ~40 MB of WebAssembly: compress it once here, and nginx's gzip_static hands
# the .gz to every browser instead of recompressing per request.
RUN gzip -k -9 /usr/share/nginx/html/*.wasm /usr/share/nginx/html/*.pck /usr/share/nginx/html/*.js
EXPOSE 80
