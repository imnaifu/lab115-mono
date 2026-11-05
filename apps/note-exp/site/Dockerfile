# rednote.lab115.com: RedNote Exporter's home page and privacy policy.
# Hand-written static files in public/, no build step — nginx serves them as they are.
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY public /usr/share/nginx/html
EXPOSE 80
