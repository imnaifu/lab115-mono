# Static site: the Godot web export of games/survivors, written to public/ by
# games/survivors/tools/export_web.sh. There is no build step here — nginx serves the files.
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY public /usr/share/nginx/html
# The engine is ~40 MB of WebAssembly: compress it once here, and nginx's gzip_static hands
# the .gz to every browser instead of recompressing per request.
RUN gzip -k -9 /usr/share/nginx/html/*.wasm /usr/share/nginx/html/*.pck /usr/share/nginx/html/*.js
EXPOSE 80
