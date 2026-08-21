/**
 * useVideoPool.ts — Centralized video element pool manager
 * ────────────────────────────────────────────────────────
 * Manages a pool of reusable <video> elements to prevent iOS Safari
 * crashes from having too many active video elements.
 *
 * Features:
 * - Pool of MAX_POOL_SIZE video elements (reused, not created/destroyed)
 * - Single IntersectionObserver for all video containers
 * - Waits for `canplay` before calling `play()` (fixes race condition)
 * - Priority: nearest-to-viewport-center gets playback first
 * - Direct R2 CDN streams with Range request support
 */

import { useRef, useEffect, useCallback, useState } from "react";

const MAX_POOL_SIZE = 4; // iOS Safari handles 4-6 safely

interface PoolEntry {
  video: HTMLVideoElement;
  assignedTo: string | null; // data-video-id of the container
}

interface ContainerEntry {
  element: HTMLElement;
  videoId: string;
  src: string;
  poster: string;
  isInView: boolean;
}

// ── Singleton pool (shared across all FeedCard instances) ──

let pool: PoolEntry[] = [];
let containers = new Map<string, ContainerEntry>();
let observer: IntersectionObserver | null = null;
let globalMuted = true;

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
    pool.push({ video, assignedTo: null });
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
      // Re-evaluate which videos should be playing
      reconcilePool();
    },
    { rootMargin: "200px", threshold: 0.1 }
  );

  return observer;
}

/**
 * Core reconciliation: decide which containers get video elements.
 * Prioritizes visible containers closest to the viewport center.
 */
function reconcilePool() {
  const poolEntries = getOrCreatePool();

  // Get all visible containers
  const visibleContainers = Array.from(containers.values())
    .filter(c => c.isInView);

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
  video.muted = globalMuted;
  video.poster = container.poster;

  // Attach to DOM
  container.element.appendChild(video);

  // Set src and wait for canplay before playing
  video.src = container.src;
  video.load();

  const onCanPlay = () => {
    video.play().catch(() => {});
  };
  video.addEventListener("canplay", onCanPlay, { once: true });
}

function releaseVideo(entry: PoolEntry) {
  const { video } = entry;

  video.pause();
  video.removeAttribute("src");
  video.load(); // Reset the element

  // Detach from DOM
  if (video.parentElement) {
    video.parentElement.removeChild(video);
  }

  entry.assignedTo = null;
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
