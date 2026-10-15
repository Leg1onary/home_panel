FROM node:22-bookworm-slim AS dependencies
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

FROM node:22-bookworm-slim
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY package.json server.mjs startup.mjs ./
COPY dist ./dist
ENV NODE_ENV=production PORT=8090 PANEL_DATA=/data/homepanel PANEL_ROOT=/app/dist
EXPOSE 8090
CMD ["node", "startup.mjs"]
