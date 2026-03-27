# Forsion AI Studio — Vite SPA + nginx (separate domain from API)
# Build arg VITE_API_URL must be the full backend API base, e.g. https://api.example.com/api

FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}

RUN if [ -z "$VITE_API_URL" ]; then \
      echo "VITE_API_URL is required (e.g. https://api.example.com/api). Set it in .env for docker compose."; \
      exit 1; \
    fi

RUN npm run build

FROM nginx:1.27-alpine AS production

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q --spider http://127.0.0.1/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
