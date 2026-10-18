FROM nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY ./resources/* /mnt/data/
COPY ./icons /mnt/data/icons

EXPOSE 80

ENTRYPOINT ["nginx", "-g", "daemon off;"]

