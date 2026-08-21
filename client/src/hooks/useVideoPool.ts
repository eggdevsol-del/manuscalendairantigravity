/**
 * useVideoPool.ts — Centralized video element pool manager (v2)
 * ─────────────────────────────────────────────────────────────
 * Manages a pool of reusable <video> elements for infinite-scroll feeds.
 * Designed for thousands of concurrent users on iOS Safari.
 *
 * v2 improvements:
 * - Error recovery: releases pool slots on load failure
 * - Retry with backoff: retries failed videos once after 2s
 * - Debounced reconciliation: prevents thrashing during fast scrolling
 * - Proper cleanup: no orphaned event listeners
 * - Timeout guard: releases slots if video can't load within 8s
 */

import { useRef, useEffect, useCallback, useState } from "react";

const MAX_POOL_SIZE = 4; // iOS Safari handles 4-6 safely
const LOAD_TIMEOUT_MS = 8000; // Give up if video can't load in 8s
const RETRY_DELAY_MS = 2000; // Wait before retrying a failed video
const RECONCILE_DEBOUNCE_MS = 100; // Debounce reconciliation during fast scrolls

interface PoolEntry {
  video: HTMLVideoElement;
  assignedTo: string | null;
  retryCount: number;
  loadTimeout: ReturnType<typeof setTimeout> | null;
}

interface ContainerEntry {
  element: HTMLElement;
  videoId: string;
  src: string;
  poster: string;
  isInView: boolean;
  failedAt: number; // timestamp of last failure (0 = no failure)
}

// ── Singleton pool (shared across all FeedCard instances) ──

let pool: PoolEntry[] = [];
let containers = new Map<string, ContainerEntry>();
let observer: IntersectionObserver | null = null;
let globalMuted = true;
let reconcileTimer: ReturnType<typeof setTimeout> | null = null;

function getOrCreatePool(): PoolEntry[] {
  if (pool.length > 0) return pool;

  for (let i = 0; i < MAX_POOL_SIZE; i++) {
    const video = document.createElement("video");
    video.playsInline = true;
    video.loop = true;
    video.muted = true;
    video.preload = "auto";
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");
    video.style.cssText = "width:100%;height:100%;object-fit:cover;display:block;";
    pool.push({ video, assignedTo: null, retryCount: 0, loadTimeout: null });
  }

  return pool;
}

function getOrCreateObserver(): IntersectionObserver {
  if (observer) return observer;

  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const videoId = (entry.target as HTMLElement).dataset.videoId;
        if (!videoId) continue;

        const container = containers.get(videoId);
        if (container) {
          container.isInView = entry.isIntersecting;
        }
      }
      // Debounced reconciliation — prevents thrashing during fast scrolls
      scheduleReconcile();
    },
    { rootMargin: "200px", threshold: 0.1 }
  );

  return observer;
}

/** Debounce reconciliation to avoid churning pool slots during fast scrolls */
function scheduleReconcile() {
  if (reconcileTimer) clearTimeout(reconcileTimer);
  reconcileTimer = setTimeout(() => {
    reconcileTimer = null;
    reconcilePool();
  }, RECONCILE_DEBOUNCE_MS);
}

/**
 * Core reconciliation: decide which containers get video elements.
 * Prioritizes visible containers closest to the viewport center.
 * Skips containers that recently failed (cooldown period).
 */
function reconcilePool() {
  const poolEntries = getOrCreatePool();
  const now = Date.now();

  // Get all visible containers, excluding recently-failed ones in cooldown
  const visibleContainers = Array.from(containers.values())
    .filter(c => c.isInView && (c.failedAt === 0 || now - c.failedAt > RETRY_DELAY_MS));

  // Sort by proximity to viewport center (lower = closer)
  const viewportCenter = window.innerHeight / 2;
  visibleContainers.sort((a, b) => {
    const aRect = a.element.getBoundingClientRect();
    const bRect = b.element.getBoundingClientRect();
    const aDist = Math.abs(aRect.top + aRect.height / 2 - viewportCenter);
    const bDist = Math.abs(bRect.top + bRect.height / 2 - viewportCenter);
    return aDist - bDist;
  });

  // Determine which containers should have a video
  const shouldHaveVideo = new Set(
    visibleContainers.slice(0, MAX_POOL_SIZE).map(c => c.videoId)
  );

  // 1. Release videos from containers that are no longer prioritized
  for (const entry of poolEntries) {
    if (entry.assignedTo && !shouldHaveVideo.has(entry.assignedTo)) {
      releaseVideo(entry);
    }
  }

  // 2. Assign videos to containers that need them
  for (const container of visibleContainers) {
    if (!shouldHaveVideo.has(container.videoId)) continue;
    if (!container.src) continue; // Skip containers with no video URL

    // Already assigned?
    const existingEntry = poolEntries.find(e => e.assignedTo === container.videoId);
    if (existingEntry) continue;

    // Find a free pool entry
    const freeEntry = poolEntries.find(e => e.assignedTo === null);
    if (!freeEntry) break; // All slots taken

    assignVideo(freeEntry, container);
  }
}

function assignVideo(entry: PoolEntry, container: ContainerEntry) {
  const { video } = entry;

  entry.assignedTo = container.videoId;
  entry.retryCount = container.failedAt > 0 ? 1 : 0; // Track if this is a retry
  video.muted = globalMuted;
  video.poster = container.poster;

  // Attach to DOM
  container.element.appendChild(video);

  // ── Event handlers with proper cleanup ──
  const cleanup = () => {
    video.removeEventListener("canplay", onCanPlay);
    video.removeEventListener("error", onError);
    if (entry.loadTimeout) {
      clearTimeout(entry.loadTimeout);
      entry.loadTimeout = null;
    }
  };

  const onCanPlay = () => {
    cleanup();
    video.play().catch(() => {});
  };

  const onError = () => {
    cleanup();
    console.warn(`[VideoPool] Failed to load video for ${container.videoId}: ${container.src.slice(0, 60)}`);
    container.failedAt = Date.now();
    releaseVideo(entry);
    // Schedule reconcile to potentially retry after cooldown
    setTimeout(scheduleReconcile, RETRY_DELAY_MS + 100);
  };

  // Timeout guard: if video doesn't load in time, release the slot
  entry.loadTimeout = setTimeout(() => {
    entry.loadTimeout = null;
    if (entry.assignedTo === container.videoId && video.readyState < 3) {
      console.warn(`[VideoPool] Load timeout for ${container.videoId}`);
      cleanup();
      container.failedAt = Date.now();
      releaseVideo(entry);
      setTimeout(scheduleReconcile, RETRY_DELAY_MS + 100);
    }
  }, LOAD_TIMEOUT_MS);

  video.addEventListener("canplay", onCanPlay, { once: true });
  video.addEventListener("error", onError, { once: true });

  // Set src and trigger load
  video.src = container.src;
  video.load();
}

function releaseVideo(entry: PoolEntry) {
  const { video } = entry;

  // Clear timeout
  if (entry.loadTimeout) {
    clearTimeout(entry.loadTimeout);
    entry.loadTimeout = null;
  }

  video.pause();
  video.removeAttribute("src");
  video.load(); // Reset the element

  // Detach from DOM
  if (video.parentElement) {
    video.parentElement.removeChild(video);
  }

  entry.assignedTo = null;
  entry.retryCount = 0;
}

// ── Public hook ──────────────────────────────────────────

let nextVideoId = 0;

/**
 * Hook for a single video container in the feed.
 * Registers the container with the global pool manager.
 *
 * Usage:
 * ```tsx
 * const { containerRef, isInView } = useVideoPool(videoUrl, posterUrl);
 * return <div ref={containerRef} data-video-id={...} />;
 * ```
 */
export function useVideoPool(src: string, poster: string) {
  const videoIdRef = useRef<string>(`vpool-${nextVideoId++}`);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isInView, setIsInView] = useState(false);

  // Register container with pool
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const videoId = videoIdRef.current;
    el.dataset.videoId = videoId;

    // Register
    containers.set(videoId, {
      element: el,
      videoId,
      src,
      poster,
      isInView: false,
      failedAt: 0,
    });

    // Observe
    const obs = getOrCreateObserver();
    obs.observe(el);

    return () => {
      // Cleanup: release video if assigned, unobserve, unregister
      const poolEntry = pool.find(e => e.assignedTo === videoId);
      if (poolEntry) releaseVideo(poolEntry);

      obs.unobserve(el);
      containers.delete(videoId);
    };
  }, [src, poster]);

  // Track isInView for the component
  useEffect(() => {
    const interval = setInterval(() => {
      const container = containers.get(videoIdRef.current);
      if (container && container.isInView !== isInView) {
        setIsInView(container.isInView);
      }
    }, 200);
    return () => clearInterval(interval);
  }, [isInView]);

  return { containerRef, isInView, videoId: videoIdRef.current };
}

/**
 * Set global mute state for all pooled videos.
 */
export function setGlobalMuted(muted: boolean) {
  globalMuted = muted;
  for (const entry of pool) {
    if (entry.video) {
      entry.video.muted = muted;
    }
  }
}

/**
 * Get current global mute state.
 */
export function getGlobalMuted(): boolean {
  return globalMuted;
}
