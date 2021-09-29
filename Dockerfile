FROM nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY ./resources/* /mnt/data/

EXPOSE 80

ENTRYPOINT ["nginx", "-g", "daemon off;"]

