# Base stage
FROM node:20-alpine AS base
WORKDIR /app
RUN npm install -g pnpm

# Dependencies stage
FROM base AS dependencies
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Development stage
FROM dependencies AS development
COPY . .
EXPOSE 3000
CMD ["pnpm", "run", "start:dev"]

# Builder stage
FROM dependencies AS builder
COPY . .
RUN pnpm run build
RUN pnpm prune --prod

# Production stage
FROM node:20-alpine AS production
# Set Node environment to production
ENV NODE_ENV production
WORKDIR /app

# Install curl for healthcheck
RUN apk add --no-cache curl

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nestjs -u 1001

# Copy built application assets from the builder stage
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/package.json ./

COPY --chown=nestjs:nodejs scripts/entrypoint.sh .
RUN chmod +x ./entrypoint.sh

USER nestjs
EXPOSE 3000

# Health check to ensure the application is running
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

ENTRYPOINT ["./entrypoint.sh"]

# Start the application
CMD ["pnpm", "start", "NODE_ENV=docker"]