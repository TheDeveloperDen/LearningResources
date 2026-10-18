FROM nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY ./resources/* /mnt/data/
COPY ./icons /mnt/data/icons
COPY ./database.json /mnt/data/

EXPOSE 80

ENTRYPOINT ["nginx", "-g", "daemon off;"]

