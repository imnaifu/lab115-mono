# 大厂幸存者 (Big Tech Survivors): exports the Godot project in game/ to a web build, then serves it with nginx.
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
# The 官网, made from the same game data (tools/dump_compendium.gd, tools/build_site.py), so what it
# says is what's live.
RUN cd /game && godot --headless --path . -s tools/dump_compendium.gd -- /tmp/compendium.json \
	&& python3 tools/build_site.py /tmp/compendium.json assets/art /site/index.html

# --- Stage 2: serve ------------------------------------------------------------------------
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
# The 官网 at the root, the game under /play/ (.39; the game was the root before, see nginx.conf
# for the old links).
COPY --from=export /site /usr/share/nginx/html
COPY --from=export /web /usr/share/nginx/html/play
# Two of the game's files stay at the root as well: the service worker that clears out the old PWA
# (browsers that installed it look for it where it was) and the link preview picture.
# The engine is ~40 MB of WebAssembly: compress it once here, and nginx's gzip_static hands
# the .gz to every browser instead of recompressing per request; the 官网 is one big page too.
RUN cp /usr/share/nginx/html/play/index.service.worker.js /usr/share/nginx/html/play/index.png /usr/share/nginx/html/ \
	&& gzip -k -9 /usr/share/nginx/html/play/*.wasm /usr/share/nginx/html/play/*.pck /usr/share/nginx/html/play/*.js /usr/share/nginx/html/index.html
EXPOSE 80
