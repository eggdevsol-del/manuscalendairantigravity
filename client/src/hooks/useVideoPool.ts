/**
 * useVideoPool.ts — Centralized video element pool manager (with Phase 0 Instrumentation)
 * ───────────────────────────────────────────────────────────────────────────────────────
 * Phase 0 Diagnostics Active:
 * - Detailed video.play() rejection logging with error name & message
 * - 1-second periodic element state probe
 * - Reconcile churn counter & assign logging
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
let reconcileCount = 0;
const assignHistory = new Map<string, number>();

// Phase 0.2: Element state probe
if (typeof window !== "undefined" && !(window as any).__videoProbeStarted) {
  (window as any).__videoProbeStarted = true;
  setInterval(() => {
    const videos = document.querySelectorAll("video");
    if (videos.length === 0) return;
    videos.forEach((v, i) => {
      console.log(`[probe] video #${i}`, {
        src: v.currentSrc?.slice(-35) || v.src?.slice(-35) || "empty",
        paused: v.paused,
        t: +v.currentTime.toFixed(2),
        readyState: v.readyState,
        networkState: v.networkState,
        err: v.error ? `${v.error.code} - ${v.error.message}` : null,
        muted: v.muted,
        connected: v.isConnected,
        h: Math.round(v.getBoundingClientRect().height),
        w: Math.round(v.getBoundingClientRect().width),
      });
    });
  }, 1000);
}

function getOrCreatePool(): PoolEntry[] {
  if (pool.length > 0) return pool;

  for (let i = 0; i < MAX_POOL_SIZE; i++) {
    const video = document.createElement("video");
    video.playsInline = true;
    video.loop = true;
    video.muted = true;
    video.defaultMuted = true;
    video.autoplay = true;
    video.preload = "auto";
    video.setAttribute("muted", "");
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");
    video.setAttribute("autoplay", "");
    video.setAttribute("loop", "");
    video.setAttribute("preload", "auto");
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
  reconcileCount++;
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
  const url = container.src;

  // Phase 0.3: Reconcile churn counter
  const timesAssigned = (assignHistory.get(container.videoId) || 0) + 1;
  assignHistory.set(container.videoId, timesAssigned);
  console.log(`[pool] assignVideo (#${reconcileCount}): ${container.videoId} (assigned ${timesAssigned}x) -> ${url.slice(-35)}`);

  entry.assignedTo = container.videoId;
  video.setAttribute("muted", "");
  video.defaultMuted = true;
  video.muted = globalMuted;
  video.poster = container.poster;

  // Attach to DOM
  container.element.appendChild(video);

  // Phase 0.1: Catch play rejections
  const onCanPlay = () => {
    const p = video.play();
    if (p !== undefined) {
      p.catch((err) => {
        console.warn("[pool] play rejected (canplay):", err.name, err.message, url.slice(-35));
      });
    }
  };
  video.addEventListener("canplay", onCanPlay, { once: true });

  // Set src and trigger load
  video.src = container.src;
  video.load();

  // If already buffered (cached), attempt immediate playback
  if (video.readyState >= 3) {
    const p = video.play();
    if (p !== undefined) {
      p.catch((err) => {
        console.warn("[pool] play rejected (immediate):", err.name, err.message, url.slice(-35));
      });
    }
  }
}

function releaseVideo(entry: PoolEntry) {
  const { video } = entry;
  console.log(`[pool] releaseVideo: releasing slot from ${entry.assignedTo}`);

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
