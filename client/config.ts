// Central place for runtime configuration. Use VITE_API_URL to override.
const normalize = (value?: string) => {
  if (!value) return undefined;
  return value.endsWith('/') ? value.slice(0, -1) : value;
};

// Get API base URL - MUST be called at runtime, not at build time
const getApiBaseUrl = (): string => {
  const envApiBase = normalize(import.meta.env.VITE_API_URL);
  if (envApiBase) return envApiBase;

  // Vite injects import.meta.env.DEV = true during `vite dev`,
  // regardless of the hostname the browser uses to reach the page.
  if (import.meta.env.DEV) {
    return 'http://localhost:3001/api';
  }

  if (typeof window !== 'undefined') {
    return `${window.location.origin}/api`;
  }

  return '/api';
};

export const API_BASE_URL = typeof window !== 'undefined'
  ? getApiBaseUrl()
  : '/api';
