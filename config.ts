// Central place for runtime configuration. Use VITE_API_URL to override.
const normalize = (value?: string) => {
  if (!value) return undefined;
  return value.endsWith('/') ? value.slice(0, -1) : value;
};

// Get API base URL - MUST be called at runtime, not at build time
const getApiBaseUrl = (): string => {
  // First check env variable (set at build time)
  const envApiBase = normalize(import.meta.env.VITE_API_URL);
  if (envApiBase) return envApiBase;
  
  // Runtime detection - only works in browser
  if (typeof window !== 'undefined') {
    // Production: use same origin, Nginx will proxy /api to backend
    return `${window.location.origin}/api`;
  }
  
  // SSR/build time fallback - this should never be used in browser
  return '/api';
};

// Export as getter to ensure runtime evaluation
export const API_BASE_URL = typeof window !== 'undefined' 
  ? getApiBaseUrl() 
  : '/api';
