# Portal image. The process listens on 0.0.0.0 inside the container.
# Publish that port on the host loopback only (see compose.yaml) and
# point the Cloudflare Tunnel hostname at http://127.0.0.1:3000.

FROM node:24-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:24-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000

COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/src/web/index.html ./src/web/index.html

USER node

EXPOSE 3000

CMD ["node", "dist/web/server.js"]
