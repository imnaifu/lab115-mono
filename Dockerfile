FROM nginx:alpine
COPY index.html style.css app.js about.html privacy.html contact.html /usr/share/nginx/html/
COPY sitemap.xml robots.txt ads.txt /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
