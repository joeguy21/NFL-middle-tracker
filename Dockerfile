FROM node:22-alpine
WORKDIR /app
COPY index.html ./index.html
COPY server.js ./server.js
ENV NODE_ENV=production
EXPOSE 10000
CMD ["node", "server.js"]
