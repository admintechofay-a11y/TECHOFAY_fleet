# Multi-Stage Production Dockerfile for Technofay Fleet Platform
# Stage 1: Build Web Frontend Assets
FROM node:22-alpine AS web-builder
WORKDIR /app
COPY package*.json ./
COPY apps/web/package*.json ./apps/web/
COPY packages/shared/package*.json ./packages/shared/
RUN npm ci --workspace=packages/shared --workspace=apps/web
COPY packages/shared ./packages/shared
COPY apps/web ./apps/web
RUN npm --prefix apps/web run build

# Stage 2: Production API Runtime
FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=5000

# Install production dependencies
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY packages/shared/package*.json ./packages/shared/
RUN npm ci --omit=dev --workspace=packages/shared --workspace=apps/api

# Copy backend source
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

# Copy compiled frontend from Stage 1 into API public static folder for unified deployment
COPY --from=web-builder /app/apps/web/dist ./apps/api/public

EXPOSE 5000

# Health check probe
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/api/v1/health || exit 1

CMD ["node", "apps/api/src/server.js"]
