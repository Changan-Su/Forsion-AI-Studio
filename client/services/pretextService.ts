/**
 * pretextService.ts
 *
 * Zero-reflow text measurement using @chenglou/pretext.
 * Provides fast height estimation for:
 * - Textarea auto-resize (pre-wrap mode)
 * - Chat message height prediction (for virtual scrolling)
 * - Streaming content height pre-calculation
 */
import { prepare, layout, clearCache as pretextClearCache } from '@chenglou/pretext';
import type { PreparedText } from '@chenglou/pretext';

// ── Font Constants ──────────────────────────────────────────────────────────
// Simplified font strings for canvas measurement (avoid system-ui on macOS)
const FONTS = {
  sans: '16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  serif: '16px Georgia, "Times New Roman", serif',
  mono: '14px "SFMono-Regular", Menlo, Monaco, Consolas, monospace',
} as const;

import type { ThemePreset } from '../types';

// ── Preparation Cache ───────────────────────────────────────────────────────
// Cache prepared text by content + font key to avoid re-measuring
const prepareCache = new Map<string, { prepared: PreparedText; timestamp: number }>();
const CACHE_MAX_SIZE = 500;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCacheKey(text: string, font: string, whiteSpace: 'normal' | 'pre-wrap'): string {
  return `${whiteSpace}|${font}|${text}`;
}

function getCachedOrPrepare(
  text: string,
  font: string,
  whiteSpace: 'normal' | 'pre-wrap' = 'normal'
): PreparedText {
  const key = getCacheKey(text, font, whiteSpace);
  const cached = prepareCache.get(key);
  const now = Date.now();

  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return cached.prepared;
  }

  // Evict oldest entries if cache is full
  if (prepareCache.size >= CACHE_MAX_SIZE) {
    const entries = [...prepareCache.entries()];
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    for (let i = 0; i < entries.length / 4; i++) {
      prepareCache.delete(entries[i][0]);
    }
  }

  const prepared = prepare(text, font, { whiteSpace });
  prepareCache.set(key, { prepared, timestamp: now });
  return prepared;
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Get the font string for a given theme preset.
 */
export function getFontForTheme(themePreset: ThemePreset): string {
  return themePreset === 'notion' ? FONTS.serif : FONTS.sans;
}

/**
 * Measure textarea height without DOM reflow.
 * Uses pre-wrap white-space mode to match textarea behavior.
 *
 * @param text - The textarea content
 * @param maxWidth - The textarea's inner width (excluding padding)
 * @param themePreset - Current theme for font selection
 * @param lineHeight - Line height in pixels (default 24 = Tailwind text-base)
 * @returns Calculated height in pixels
 */
export function measureTextareaHeight(
  text: string,
  maxWidth: number,
  themePreset: ThemePreset,
  lineHeight: number = 24
): number {
  if (!text || maxWidth <= 0) {
    return lineHeight; // Minimum 1 line
  }

  const font = getFontForTheme(themePreset);
  const prepared = getCachedOrPrepare(text, font, 'pre-wrap');
  const result = layout(prepared, maxWidth, lineHeight);
  return result.height;
}

/**
 * Estimate the height of a chat message's text content.
 * Uses normal white-space mode (CSS default for rendered markdown).
 *
 * @param text - The message content (plain text, not rendered markdown)
 * @param maxWidth - The message bubble's content width
 * @param themePreset - Current theme for font selection
 * @param lineHeight - Line height in pixels (default 24)
 * @returns Estimated height in pixels
 */
export function estimateMessageTextHeight(
  text: string,
  maxWidth: number,
  themePreset: ThemePreset,
  lineHeight: number = 24
): number {
  if (!text || maxWidth <= 0) return 0;

  const font = getFontForTheme(themePreset);
  const prepared = getCachedOrPrepare(text, font, 'normal');
  const result = layout(prepared, maxWidth, lineHeight);
  return result.height;
}

/**
 * Estimate total height of a chat message including non-text elements.
 * Provides a rough estimate by adding fixed heights for known components.
 */
export function estimateFullMessageHeight(
  message: {
    content: string;
    reasoning?: string;
    imageUrl?: string;
    attachments?: { type: string }[];
    toolCalls?: unknown[];
  },
  maxWidth: number,
  themePreset: ThemePreset,
  lineHeight: number = 24
): number {
  let height = 0;

  // Padding: py-4 (16px top + 16px bottom) + outer spacing (space-y-8 = 32px)
  height += 32 + 32;

  // Text content
  if (message.content) {
    height += estimateMessageTextHeight(message.content, maxWidth, themePreset, lineHeight);
  }

  // Reasoning block (collapsed): ~60px
  if (message.reasoning?.trim()) {
    height += 60;
  }

  // Image: ~300px average
  if (message.imageUrl) {
    height += 300;
  }

  // Attachments: ~48px per row, up to 3 per row
  if (message.attachments?.length) {
    const imageAttachments = message.attachments.filter(a => a.type === 'image');
    const docAttachments = message.attachments.filter(a => a.type !== 'image');
    if (imageAttachments.length > 0) height += 200; // Image previews
    if (docAttachments.length > 0) height += 48;    // Document chips
  }

  // Tool calls: ~40px each (collapsed)
  if (message.toolCalls?.length) {
    height += message.toolCalls.length * 40;
  }

  return Math.max(height, 60); // Minimum message height
}

/**
 * Measure code block height (monospace font).
 */
export function estimateCodeBlockHeight(
  code: string,
  maxWidth: number,
  lineHeight: number = 21 // text-sm leading-relaxed ≈ 14px * 1.5
): number {
  if (!code) return 0;

  // Code blocks have a header (~40px) + padding (16px * 2)
  const headerHeight = 40;
  const padding = 32;

  const prepared = getCachedOrPrepare(code, FONTS.mono, 'pre-wrap');
  const result = layout(prepared, maxWidth - 32, lineHeight); // 32px horizontal padding
  return headerHeight + padding + result.height;
}

/**
 * Clear the internal pretext + local caches.
 * Call this when theme changes or on memory pressure.
 */
export function clearMeasurementCache(): void {
  prepareCache.clear();
  pretextClearCache();
}

/**
 * Get cache statistics for debugging.
 */
export function getCacheStats(): { size: number; maxSize: number } {
  return { size: prepareCache.size, maxSize: CACHE_MAX_SIZE };
}
