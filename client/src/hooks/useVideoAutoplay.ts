/**
 * useVideoAutoplay.ts — Robust IntersectionObserver-based video autoplay
 * ─────────────────────────────────────────────────────────────────────
 * Each video card renders its own native <video> in JSX with muted, playsInline,
 * and autoPlay. This hook monitors visibility and controls play/pause smoothly.
 *
 * iOS Safari Requirements implemented:
 * - HTML attributes `muted=""`, `playsinline=""`, `webkit-playsinline=""` set on mount
 * - `defaultMuted = true` to satisfy WebKit autoplay policy before React hydration
 * - `autoPlay` attribute so WebKit starts buffering & playing immediately when in view
 * - Threshold 0.2 with 50px rootMargin for seamless scrolling transitions
 */

import { useRef, useEffect, useState } from "react";

let globalMuted = true;

/**
 * Hook that manages playback of a video element based on viewport visibility.
 */
export function useVideoAutoplay(src?: string | null) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isInView, setIsInView] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Reset error state if src changes
  useEffect(() => {
    setHasError(false);
  }, [src]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    // Enforce iOS Safari required attributes explicitly on the DOM element
    video.setAttribute("muted", "");
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");
    video.defaultMuted = true;
    video.muted = globalMuted;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const visible = entry.isIntersecting;
        setIsInView(visible);

        if (visible) {
          video.muted = globalMuted;
          const playPromise = video.play();
          if (playPromise !== undefined) {
            playPromise.catch(() => {
              // Ignore expected abort/user-gesture errors
            });
          }
        } else {
          if (!video.paused) {
            video.pause();
          }
        }
      },
      { rootMargin: "50px", threshold: 0.2 }
    );

    observer.observe(video);
    return () => observer.disconnect();
  }, [src]);

  return { videoRef, isInView, hasError, setHasError };
}

/**
 * Set global mute state for all videos on the page.
 */
export function setGlobalMuted(muted: boolean) {
  globalMuted = muted;
  document.querySelectorAll<HTMLVideoElement>("video[data-feed-video]").forEach((v) => {
    v.muted = muted;
  });
}

/**
 * Get current global mute state.
 */
export function getGlobalMuted(): boolean {
  return globalMuted;
}
