---
name: tattoi-feed-and-video-pool
description: Best practices and architecture for the Discover video reel feed, Cloudflare R2 direct streaming, HTML5 video pool management, and memory safety.
---

# Tattoi Discover Feed & Video Pool Architecture

## 1. Cloudflare R2 Direct Streaming Invariant

1. **Direct CDN URLs**:
   * All portfolio video assets must resolve directly via Cloudflare R2 public URLs (`https://pub-*.r2.dev/...` or custom domain).
   * **Never proxy streaming video through Express backend endpoints** (e.g. `/api/ig-video/:id`), as proxying causes `502 Bad Gateway` stalls and memory leaks on Node.js processes.
2. **CSP Configuration**:
   * Content Security Policy in `server/_core/index.ts` must maintain:
   ```
   media-src 'self' blob: data: https: http:;
   ```

---

## 2. HTML5 Video Pool Management (`useVideoPool.ts`)

Mobile browsers (iOS WebKit and Android Chromium) strictly limit the number of hardware-accelerated video decoders:

* **Max Active Video Instances**: Maintain a strict pool cap (maximum 3–5 active `<video>` DOM elements simultaneously).
* **Slot Reallocation**: As the user scrolls vertically through the reel, reallocate inactive offscreen video slots to incoming cards.
* **Error Recovery & Slot Release**:
  * Listen for video stream errors on every instance:
  ```ts
  video.addEventListener("error", onError, { once: true });
  ```
  * If a network or media error occurs, immediately release the pool slot and fall back to the static image thumbnail (`portfolio_items.imageUrl`).
* **Autoplay Attributes**:
  * Always include: `muted={true}`, `playsInline={true}`, `loop={true}`, `preload="metadata"`.

---

## 3. Gesture & Feed Snapping

* **Vertical Snapping**:
  * Container uses CSS `scroll-snap-type: y mandatory`.
  * Cards use `scroll-snap-align: start`.
* **Intersection Observer**:
  * Trigger video playback only when a card's intersection ratio exceeds `0.75` (75% visible in viewport). Pause immediately when out of view.
