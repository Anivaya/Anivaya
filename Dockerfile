# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY front/package.json front/package-lock.json ./front/
RUN npm --prefix front ci
COPY back/package.json back/package-lock.json ./back/
RUN npm --prefix back ci --omit=dev
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS api
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3001 DATABASE_PATH=/data/central.sqlite
WORKDIR /app
COPY --from=build --chown=node:node /app/back ./back
COPY --from=build --chown=node:node /app/shared ./shared
COPY --from=build --chown=node:node /app/scripts ./scripts
COPY --from=build --chown=node:node /app/package.json ./package.json
RUN mkdir /data /backups && chown node:node /data /backups
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s CMD node -e "fetch('http://127.0.0.1:3001/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "back/api/server.ts"]

FROM caddy:2-alpine AS web
COPY --from=build /app/front/dist /srv
COPY deploy/Caddyfile /etc/caddy/Caddyfile
