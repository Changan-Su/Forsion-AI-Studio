# =====================================================
# Forsion AI Studio - Frontend Dockerfile
# React 19 + Vite + Nginx
# =====================================================

# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Install dependencies first (for better caching)
COPY client/package*.json ./
RUN npm ci

# Copy source code
COPY client/ ./

# Build the application
# Note: VITE_API_URL is NOT set here - frontend will detect API URL at runtime
# based on window.location.origin
RUN npm run build

# Production stage with Nginx
FROM nginx:alpine AS production

# Install envsubst for environment variable substitution
RUN apk add --no-cache gettext

# Copy nginx configuration template
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

# Create entrypoint script to substitute environment variables
RUN echo '#!/bin/sh' > /docker-entrypoint.sh && \
    echo 'envsubst < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf' >> /docker-entrypoint.sh && \
    echo 'exec nginx -g "daemon off;"' >> /docker-entrypoint.sh && \
    chmod +x /docker-entrypoint.sh

# Copy built files from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy admin panel static (if exists in root directory)
# 注意：根据 v0.4.2 更新，admin 面板已移到 server-node/admin/ 并由后端服务提供
# 如果根目录下仍有 admin/ 目录，这里会复制；如果不存在，需要确保后端服务正常运行
# 后端服务会在 /admin 路径提供管理面板
COPY admin/index.html /usr/share/nginx/html/admin/index.html

# Create non-root user (nginx runs as nginx user by default)
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:80/ || exit 1

# Start Nginx with environment variable substitution
ENTRYPOINT ["/docker-entrypoint.sh"]
