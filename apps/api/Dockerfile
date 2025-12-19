# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root package files
COPY package*.json ./
COPY turbo.json ./
COPY tsconfig.base.json ./

# Copy packages
COPY packages ./packages

# Copy API
COPY apps/api ./apps/api

# Install dependencies
RUN npm ci

# Build all packages
RUN npm run build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

# Copy built files
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/core/dist ./packages/core/dist
COPY --from=builder /app/packages/core/package.json ./packages/core/package.json
COPY --from=builder /app/packages/email-agent/dist ./packages/email-agent/dist
COPY --from=builder /app/packages/email-agent/package.json ./packages/email-agent/package.json
COPY --from=builder /app/packages/legal-agent/dist ./packages/legal-agent/dist
COPY --from=builder /app/packages/legal-agent/package.json ./packages/legal-agent/package.json
COPY --from=builder /app/packages/stablecoin-agent/dist ./packages/stablecoin-agent/dist
COPY --from=builder /app/packages/stablecoin-agent/package.json ./packages/stablecoin-agent/package.json
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/package.json ./package.json

# Set environment
ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

# Start the API
CMD ["node", "apps/api/dist/index.js"]

