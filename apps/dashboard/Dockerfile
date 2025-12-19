# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY turbo.json ./
COPY packages ./packages
COPY apps/dashboard ./apps/dashboard

# Install dependencies
RUN npm ci

# Build args for API URL
ARG VITE_API_URL=http://localhost:3001
ENV VITE_API_URL=$VITE_API_URL

# Build dashboard
RUN npm run build --workspace=@agent-hub/dashboard

# Production stage with nginx
FROM nginx:alpine AS runner

# Copy built files
COPY --from=builder /app/apps/dashboard/dist /usr/share/nginx/html

# Copy nginx config
COPY apps/dashboard/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

