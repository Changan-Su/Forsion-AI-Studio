// Central place for runtime configuration. Use VITE_API_URL to override.
const normalize = (value?: string) => {
  if (!value) return undefined;
  return value.endsWith('/') ? value.slice(0, -1) : value;
};

const envApiBase = normalize(import.meta.env.VITE_API_URL);
const inferredBase = (() => {
  if (typeof window === 'undefined') {
    return 'http://localhost:3001/api';
  }
  return `${window.location.origin}/api`;
})();

export const API_BASE_URL = envApiBase || normalize(inferredBase) || 'http://localhost:3001/api';
