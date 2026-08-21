/**
 * useVideoAutoplay.ts — Simple IntersectionObserver-based video autoplay
 * ─────────────────────────────────────────────────────────────────────
 * Replaces useVideoPool with a simpler approach: each video card has its
 * own native <video> element (rendered in JSX, not dynamically created).
 * This hook just controls play/pause based on visibility.
 *
 * Why this works better than a pool:
 * - Native <video> elements in JSX satisfy iOS Safari autoplay policies
 * - No dynamic DOM manipulation = no black flash
 * - IntersectionObserver is lightweight and well-supported
 * - Browser handles its own resource management for off-screen videos
 */

import { useRef, useEffect, useCallback, useState } from "react";

let globalMuted = true;

/**
 * Hook that auto-plays/pauses a video ref based on viewport visibility.
 * The video element must be rendered in JSX with muted, playsInline, loop.
 */
export function useVideoAutoplay() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const visible = entry.isIntersecting;
        setIsInView(visible);

        if (visible) {
          // Play when in view — muted autoplay is always allowed on iOS
          video.muted = globalMuted;
          video.play().catch(() => {});
        } else {
          // Pause and reset when out of view to save resources
          video.pause();
        }
      },
      { rootMargin: "100px", threshold: 0.3 }
    );

    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  return { videoRef, isInView };
}

/**
 * Set global mute state for all videos.
 */
export function setGlobalMuted(muted: boolean) {
  globalMuted = muted;
  // Update all video elements on the page
  document.querySelectorAll<HTMLVideoElement>("video[data-feed-video]").forEach(v => {
    v.muted = muted;
  });
}

/**
 * Get current global mute state.
 */
export function getGlobalMuted(): boolean {
  return globalMuted;
}
