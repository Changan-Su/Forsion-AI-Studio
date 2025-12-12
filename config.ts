// Central place for runtime configuration. Use VITE_API_URL to override.
const normalize = (value?: string) => {
  if (!value) return undefined;
  return value.endsWith('/') ? value.slice(0, -1) : value;
};

const envApiBase = normalize(import.meta.env.VITE_API_URL);

// In development, always use localhost:3002
// In production, use same origin (Nginx proxy) or VITE_API_URL
const getDefaultApiBase = () => {
  if (typeof window === 'undefined') {
    return 'http://localhost:3002/api';
  }
  // Check if running in development (different ports, not standard web ports or backend port)
  const isDev = window.location.port && !['80', '443', '3002', '1111'].includes(window.location.port);
  if (isDev) {
    return 'http://localhost:3002/api';
  }
  // Production: use same origin, Nginx will proxy /api to backend
  return `${window.location.origin}/api`;
};

export const API_BASE_URL = envApiBase || normalize(getDefaultApiBase()) || 'http://localhost:3002/api';
