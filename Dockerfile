FROM node:22-alpine
WORKDIR /app
COPY package.json ./package.json
RUN npm install --omit=dev
COPY index.html ./index.html
COPY coordinated-games.html ./coordinated-games.html
COPY server.js ./server.js
COPY coordinated-game-lifecycle.js ./coordinated-game-lifecycle.js
COPY odds-collector.js ./odds-collector.js
COPY odds-poll-scheduler.js ./odds-poll-scheduler.js
COPY game-status.js ./game-status.js
COPY manifest.webmanifest ./manifest.webmanifest
COPY apple-touch-icon.png ./apple-touch-icon.png
COPY jg-icon.svg ./jg-icon.svg
COPY coordinated-plan-preview.js ./coordinated-plan-preview.js
COPY canonicalize-fanline-quotes.js ./canonicalize-fanline-quotes.js
COPY coordinated-middle-planner.js ./coordinated-middle-planner.js
COPY fanline-spread-normalizer.js ./fanline-spread-normalizer.js
COPY cross-feed-event-matcher.js ./cross-feed-event-matcher.js
COPY odds-eligibility.js ./odds-eligibility.js
COPY hedge-calculator.js ./hedge-calculator.js
COPY hedge-optimizer.js ./hedge-optimizer.js
COPY coordinated-alert-service.js ./coordinated-alert-service.js
COPY coordinated-alert-candidate.js ./coordinated-alert-candidate.js
COPY coordinated-alert-outcomes.js ./coordinated-alert-outcomes.js
ENV NODE_ENV=production
EXPOSE 10000
CMD ["npm","start"]
