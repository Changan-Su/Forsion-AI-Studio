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
    // Development: if running on localhost with non-standard port, use default backend
    const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const isNonStandardPort = window.location.port !== '' && window.location.port !== '80' && window.location.port !== '443';
    
    if (isDev && isNonStandardPort) {
      // Development mode: use default backend on port 3001
      return 'http://localhost:3001/api';
    }
    
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
