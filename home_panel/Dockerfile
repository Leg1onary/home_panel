FROM node:22-bookworm-slim AS dependencies
WORKDIR /app
# better-sqlite3 11.10.0 ships prebuilt binaries for Node 22 (linux-x64 glibc),
# so no python3/make/g++ toolchain is needed: apt-get was the slowest step.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

FROM node:22-bookworm-slim
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY package.json server.mjs startup.mjs config.json ./
COPY dist ./dist
ENV NODE_ENV=production PORT=8090 PANEL_DATA=/data/homepanel PANEL_ROOT=/app/dist
EXPOSE 8090
CMD ["node", "startup.mjs"]
