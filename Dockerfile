FROM node:22-alpine AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:22-alpine AS tools
WORKDIR /app
RUN apk add --no-cache git ca-certificates
COPY content ./content
COPY scripts ./scripts
RUN node scripts/sync-tools.mjs

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    TOOL_CACHE_DIR=/app/tool-cache
COPY package.json package-lock.json ./
COPY --from=dependencies /app/node_modules ./node_modules
COPY content ./content
COPY public ./public
COPY src ./src
COPY --from=tools /app/tool-cache ./tool-cache
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 CMD wget -q -O - http://127.0.0.1:3000/healthz || exit 1
CMD ["node", "src/server.mjs"]
