FROM node:22-alpine
WORKDIR /app
COPY package.json ./package.json
RUN npm install --omit=dev
COPY index.html ./index.html
COPY server.js ./server.js
ENV NODE_ENV=production
EXPOSE 10000
CMD ["npm","start"]
