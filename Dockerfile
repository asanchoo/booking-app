FROM node:22-bookworm-slim AS client-build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

FROM node:22-bookworm-slim AS app
WORKDIR /app/server
COPY server/package*.json ./
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && npm ci --omit=dev \
  && apt-get purge -y --auto-remove python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY server/ ./
COPY --from=client-build /app/client/dist /app/client/dist
RUN mkdir -p /app/data /app/server/uploads/barbers
ENV NODE_ENV=production
EXPOSE 3001
CMD ["sh", "-c", "node src/db/setup.js && node src/db/seed.js && node index.js"]
