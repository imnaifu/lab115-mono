# Static site. This is a Claude design-canvas export (client-rendered in the
# browser via CDN React/Babel), so there is no build step — nginx just serves
# the files as-is.
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html support.js image-slot.js /usr/share/nginx/html/
COPY _ds /usr/share/nginx/html/_ds
EXPOSE 80
