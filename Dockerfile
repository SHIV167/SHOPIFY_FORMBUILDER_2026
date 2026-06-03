# Multi-stage build for Contact Form Builder App
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
COPY prisma/schema.prisma ./prisma/
RUN npm ci && npm cache clean --force

# Build stage
FROM base AS builder
COPY . .
RUN npx prisma generate --schema=./prisma/schema.prisma
RUN npm run build

# Production stage
FROM node:20-alpine AS runner
RUN apk add --no-cache openssl wget
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3005
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME="0.0.0.0"
# Fix HTTP 431 - Increase max header size to 256KB for Shopify OAuth callbacks
ENV NODE_OPTIONS="--max-http-header-size=262144"

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

# Copy standalone output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/public ./public

RUN chown -R nextjs:nodejs /app

# Create startup script
RUN echo '#!/bin/sh\n\
echo "Waiting for database..."\n\
sleep 5\n\
echo "Running database migrations..."\n\
cd /app && npx prisma migrate deploy --schema=./prisma/schema.prisma || npx prisma db push --schema=./prisma/schema.prisma\n\
echo "Starting Contact Form Builder App on port ${PORT}..."\n\
exec node server.js' > /app/start.sh && chmod +x /app/start.sh

USER nextjs
EXPOSE 3005

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 CMD wget --no-verbose --tries=1 --spider http://localhost:3005/ || exit 1

CMD ["/app/start.sh"]