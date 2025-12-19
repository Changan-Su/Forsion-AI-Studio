// Avatar caching utility for model avatars
// Caches avatar data in localStorage to avoid repeated processing

const CACHE_PREFIX = 'model_avatar_';
const CACHE_VERSION = 'v1';
const MAX_CACHE_SIZE = 50; // Maximum number of avatars to cache

interface CachedAvatar {
  data: string; // Processed avatar URL (data URL)
  avatarData: string; // Original avatar data (preset:xxx or data:image/...)
  timestamp: number;
  version: string;
}

// Get cached avatar
// Returns cached URL if avatarData matches, null otherwise
export function getCachedAvatar(modelId: string, avatarData: string): string | null {
  try {
    if (!avatarData) return null;
    
    const cacheKey = `${CACHE_PREFIX}${modelId}`;
    const cached = localStorage.getItem(cacheKey);
    
    if (!cached) return null;
    
    const parsed: CachedAvatar = JSON.parse(cached);
    
    // Check version
    if (parsed.version !== CACHE_VERSION) {
      localStorage.removeItem(cacheKey);
      return null;
    }
    
    // Check if avatar data has changed
    if (parsed.avatarData !== avatarData) {
      // Avatar data changed, clear cache
      localStorage.removeItem(cacheKey);
      return null;
    }
    
    // Cache is valid for 7 days
    const now = Date.now();
    const age = now - parsed.timestamp;
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
    
    if (age > maxAge) {
      localStorage.removeItem(cacheKey);
      return null;
    }
    
    return parsed.data;
  } catch (error) {
    console.warn('Failed to get cached avatar:', error);
    return null;
  }
}

// Set cached avatar
// avatarData: original avatar data (preset:xxx or data:image/...)
// processedUrl: processed avatar URL (data URL)
export function setCachedAvatar(modelId: string, avatarData: string, processedUrl: string): void {
  try {
    const cacheKey = `${CACHE_PREFIX}${modelId}`;
    const cached: CachedAvatar = {
      data: processedUrl,
      avatarData: avatarData,
      timestamp: Date.now(),
      version: CACHE_VERSION
    };
    
    localStorage.setItem(cacheKey, JSON.stringify(cached));
    
    // Clean up old caches if too many
    cleanupOldCaches();
  } catch (error) {
    console.warn('Failed to cache avatar:', error);
  }
}

// Clear cache for a specific model
export function clearAvatarCache(modelId: string): void {
  try {
    const cacheKey = `${CACHE_PREFIX}${modelId}`;
    localStorage.removeItem(cacheKey);
  } catch (error) {
    console.warn('Failed to clear avatar cache:', error);
  }
}

// Clean up old caches
function cleanupOldCaches(): void {
  try {
    const keys: string[] = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CACHE_PREFIX)) {
        keys.push(key);
      }
    }
    
    if (keys.length <= MAX_CACHE_SIZE) return;
    
    // Get all cached avatars with timestamps
    const caches = keys.map(key => {
      try {
        const cached = JSON.parse(localStorage.getItem(key) || '{}');
        return { key, timestamp: cached.timestamp || 0 };
      } catch {
        return { key, timestamp: 0 };
      }
    });
    
    // Sort by timestamp (oldest first)
    caches.sort((a, b) => a.timestamp - b.timestamp);
    
    // Remove oldest caches
    const toRemove = caches.slice(0, keys.length - MAX_CACHE_SIZE);
    toRemove.forEach(cache => localStorage.removeItem(cache.key));
  } catch (error) {
    console.warn('Failed to cleanup old caches:', error);
  }
}

// Clear all avatar caches
export function clearAllAvatarCaches(): void {
  try {
    const keys: string[] = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CACHE_PREFIX)) {
        keys.push(key);
      }
    }
    
    keys.forEach(key => localStorage.removeItem(key));
  } catch (error) {
    console.warn('Failed to clear avatar caches:', error);
  }
}

