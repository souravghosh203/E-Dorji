FROM node:22-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=10000
ENV E_DORJI_DB_PATH=/var/data/e-dorji.sqlite

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY server.js ./server.js
COPY src/data ./src/data
COPY --from=build /app/dist ./dist

EXPOSE 10000
CMD ["node", "server.js"]
