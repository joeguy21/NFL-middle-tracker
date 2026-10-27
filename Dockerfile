FROM node:22-alpine
WORKDIR /app
COPY package.json ./package.json
RUN npm install --omit=dev
COPY index.html ./index.html
COPY coordinated-games.html ./coordinated-games.html
COPY server.js ./server.js
COPY coordinated-game-lifecycle.js ./coordinated-game-lifecycle.js
COPY manifest.webmanifest ./manifest.webmanifest
COPY apple-touch-icon.png ./apple-touch-icon.png
COPY jg-icon.svg ./jg-icon.svg
ENV NODE_ENV=production
EXPOSE 10000
CMD ["npm","start"]
