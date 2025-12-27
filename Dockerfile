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
    echo 'export BACKEND_URL=${BACKEND_URL:-http://host.docker.internal:3001}' >> /docker-entrypoint.sh && \
    echo 'envsubst '"'"'$BACKEND_URL'"'"' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf' >> /docker-entrypoint.sh && \
    echo 'exec nginx -g "daemon off;"' >> /docker-entrypoint.sh && \
    chmod +x /docker-entrypoint.sh

# Copy built files from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Admin panel 说明：
# 根据 v0.4.2 更新，admin 面板已移到 server-node/admin/ 并由后端服务提供
# 前端不需要复制 admin 文件，admin 面板由后端服务在 /admin 路径提供
# 如果需要在 Nginx 中代理 admin，可以通过 nginx.conf.template 配置

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
