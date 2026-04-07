/**
 * useVirtualMessages.ts
 *
 * Virtual scrolling hook for chat messages.
 * Uses pretext for height estimation of off-screen messages,
 * then caches actual DOM heights once rendered.
 *
 * Strategy:
 * 1. Estimate all message heights via pretext (fast, no DOM)
 * 2. Render only messages in/near the viewport
 * 3. After render, measure actual DOM heights and cache them
 * 4. Re-calculate positions with real heights for rendered items
 */
import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { estimateFullMessageHeight } from './pretextService';

interface VirtualMessage {
  id: string;
  content: string;
  role: 'user' | 'model' | 'system' | 'tool';
  reasoning?: string;
  imageUrl?: string;
  attachments?: { type: string }[];
  toolCalls?: unknown[];
}

interface VirtualItem {
  index: number;
  offsetTop: number;
  height: number;
  measured: boolean;
}

interface UseVirtualMessagesOptions {
  messages: VirtualMessage[];
  containerRef: React.RefObject<HTMLElement | null>;
  contentWidth: number;
  themePreset: import('../types').ThemePreset;
  overscan?: number; // Number of extra items to render above/below viewport
  enabled?: boolean; // Toggle virtual scrolling on/off
  streamingMessageId?: string | null; // ID of the currently streaming message
}

interface UseVirtualMessagesResult {
  virtualItems: VirtualItem[];
  totalHeight: number;
  visibleRange: { start: number; end: number };
  measureRef: (index: number) => (el: HTMLElement | null) => void;
  onScroll: () => void;
  isVirtualized: boolean;
}

// Minimum number of messages before we enable virtual scrolling
const VIRTUALIZATION_THRESHOLD = 30;

export function useVirtualMessages({
  messages,
  containerRef,
  contentWidth,
  themePreset,
  overscan = 5,
  enabled = true,
  streamingMessageId = null,
}: UseVirtualMessagesOptions): UseVirtualMessagesResult {
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  // Cache of measured DOM heights per message ID
  const measuredHeights = useRef<Map<string, number>>(new Map());

  // Whether we should actually virtualize (only for long conversations)
  const isVirtualized = enabled && messages.length > VIRTUALIZATION_THRESHOLD;

  // Estimate heights for all messages
  const itemHeights = useMemo(() => {
    // Use a narrower width for content (accounting for padding, avatar, etc.)
    // max-w-3xl (768px) - avatar (36px + 16px gap) - padding (40px) - 85% max
    const messageWidth = Math.min(contentWidth, 768) * 0.85 - 56;
    const effectiveWidth = Math.max(messageWidth, 200);

    return messages.map((msg) => {
      // Tool messages are rendered inline, skip them
      if (msg.role === 'tool') return 0;

      // Streaming message: always re-estimate via pretext (content is changing)
      if (msg.id === streamingMessageId) {
        return estimateFullMessageHeight(msg, effectiveWidth, themePreset);
      }

      // If we have a cached DOM measurement, use it (most accurate)
      const cached = measuredHeights.current.get(msg.id);
      if (cached !== undefined) return cached;

      // Use pretext estimation
      return estimateFullMessageHeight(msg, effectiveWidth, themePreset);
    });
  }, [messages, contentWidth, themePreset, streamingMessageId]);

  // Build virtual items with offsets
  const { virtualItems, totalHeight } = useMemo(() => {
    const items: VirtualItem[] = [];
    let offset = 0;

    for (let i = 0; i < messages.length; i++) {
      const height = itemHeights[i];
      items.push({
        index: i,
        offsetTop: offset,
        height,
        measured: measuredHeights.current.has(messages[i].id),
      });
      offset += height;
    }

    return { virtualItems: items, totalHeight: offset };
  }, [messages, itemHeights]);

  // Calculate visible range
  const visibleRange = useMemo(() => {
    if (!isVirtualized) {
      return { start: 0, end: messages.length - 1 };
    }

    let start = 0;
    let end = messages.length - 1;

    // Find first visible item
    for (let i = 0; i < virtualItems.length; i++) {
      const item = virtualItems[i];
      if (item.offsetTop + item.height >= scrollTop) {
        start = i;
        break;
      }
    }

    // Find last visible item
    const viewportBottom = scrollTop + containerHeight;
    for (let i = start; i < virtualItems.length; i++) {
      if (virtualItems[i].offsetTop > viewportBottom) {
        end = i;
        break;
      }
    }

    // Apply overscan
    start = Math.max(0, start - overscan);
    end = Math.min(messages.length - 1, end + overscan);

    return { start, end };
  }, [isVirtualized, virtualItems, scrollTop, containerHeight, messages.length, overscan]);

  // Scroll handler
  const onScroll = useCallback(() => {
    if (!containerRef.current || !isVirtualized) return;
    setScrollTop(containerRef.current.scrollTop);
  }, [containerRef, isVirtualized]);

  // Observe container resize
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerHeight(entry.contentRect.height);
      }
    });
    observer.observe(el);
    setContainerHeight(el.clientHeight);

    return () => observer.disconnect();
  }, [containerRef]);

  // Ref callback for measuring rendered items
  const measureRef = useCallback(
    (index: number) => (el: HTMLElement | null) => {
      if (!el || index >= messages.length) return;

      const msg = messages[index];
      const height = el.getBoundingClientRect().height;

      // Only update if significantly different (>2px) to avoid thrashing
      const existing = measuredHeights.current.get(msg.id);
      if (existing === undefined || Math.abs(existing - height) > 2) {
        measuredHeights.current.set(msg.id, height);
      }
    },
    [messages]
  );

  // Invalidate measurements when messages change content (streaming)
  useEffect(() => {
    // Remove measurements for messages that no longer exist
    const currentIds = new Set(messages.map(m => m.id));
    for (const id of measuredHeights.current.keys()) {
      if (!currentIds.has(id)) {
        measuredHeights.current.delete(id);
      }
    }
  }, [messages]);

  return {
    virtualItems,
    totalHeight,
    visibleRange,
    measureRef,
    onScroll,
    isVirtualized,
  };
}
