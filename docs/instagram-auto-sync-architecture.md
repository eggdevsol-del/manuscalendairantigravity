# Instagram Auto-Sync Architecture

> DOTS × Instagram — Permanent media hosting + real-time sync

---

## Overview

When an artist posts new content on Instagram, it should automatically appear in their DOTS portfolio — permanently, with no broken links or expired URLs.

This document covers the two-layer solution:

1. **R2 Video Hosting** — All imported media (images + videos/reels) stored permanently on Cloudflare R2
2. **Real-Time Sync** — New posts auto-imported via Meta Webhooks (production) or polling cron (dev)

---

## Layer 1: R2 Media Hosting

### The Problem

Instagram CDN URLs expire after 12-48 hours. The current import saves these temporary URLs directly to the database. Once they expire, reels stop playing.

### The Solution

During import, download the actual video/image files and re-host them on Cloudflare R2 (S3-compatible object storage with free egress).

### Import Flow

```
Instagram Post
    │
    ▼
Fetch media metadata (thumbnail URL, video URL, caption, tags)
    │
    ├──→ Download thumbnail ──→ Upload to R2 ──→ Store R2 URL in DB ✅ (already done)
    │
    └──→ Download video file ──→ Upload to R2 ──→ Store R2 URL in DB 🆕
    │
    ▼
Portfolio row created with permanent R2 URLs
```

### R2 Storage Structure

```
r2-bucket/
├── portfolio/
│   ├── {artistId}/
│   │   ├── thumb_{mediaId}.jpg      ← thumbnail (already working)
│   │   ├── video_{mediaId}.mp4      ← reel/video file (new)
│   │   └── ...
```

### Cost Projection

| Scale | Total Videos | Storage (at ~8MB avg) | Monthly Cost |
|-------|-------------|----------------------|-------------|
| 200 artists × 500 reels | 100,000 | ~800GB | **~$12/mo** |
| 500 artists × 500 reels | 250,000 | ~2TB | **~$30/mo** |
| 1,000 artists × 500 reels | 500,000 | ~4TB | **~$60/mo** |

R2 charges $0.015/GB/month for storage. **Egress (streaming) is free** — no bandwidth charges no matter how many times a reel is viewed.

---

## Layer 2: Real-Time Auto-Sync

### Production: Meta Webhooks

When an artist connects their Instagram account to DOTS, the app subscribes to their media changes. Instagram pushes a notification to DOTS whenever they post.

```
┌──────────────┐       webhook POST        ┌──────────────────┐
│              │ ─────────────────────────→ │                  │
│  Instagram   │  { field: "media",        │   DOTS Server    │
│  (Meta)      │    media_id: "123..." }   │   /api/webhooks  │
│              │                           │   /instagram     │
└──────────────┘                           └────────┬─────────┘
                                                    │
                                                    ▼
                                           Fetch media details
                                           GET /{media_id}?fields=
                                             media_url,thumbnail_url,
                                             caption,timestamp,
                                             media_type,permalink
                                                    │
                                                    ▼
                                           Download media files
                                           ┌─────────────────┐
                                           │ video → R2      │
                                           │ thumbnail → R2  │
                                           └─────────────────┘
                                                    │
                                                    ▼
                                           Insert portfolio row
                                           (permanent R2 URLs)
```

### Webhook Setup Requirements

| Requirement | Details |
|-------------|---------|
| **Meta Developer Account** | developers.facebook.com |
| **Meta App** | Create an app with "Instagram" product enabled |
| **App Review** | Required for instagram_basic, instagram_manage_insights, pages_show_list permissions |
| **Instagram Business/Creator Account** | Artists must have a Business or Creator IG account (free to switch) |
| **Facebook Page** | Artist's IG must be linked to a Facebook Page |
| **OAuth Flow** | Artist logs in via "Connect Instagram" → grants permissions → DOTS stores long-lived token |
| **Webhook Endpoint** | HTTPS endpoint on DOTS server that Meta can POST to |
| **Webhook Verification** | Meta sends a GET challenge during subscription; server must echo the hub.challenge param |

### Artist Connection Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     ARTIST ONBOARDING                       │
│                                                             │
│  1. Artist taps "Connect Instagram" in DOTS Settings        │
│                          │                                  │
│  2. Redirected to Facebook/Instagram OAuth                  │
│     → Grants permissions: instagram_basic, pages_show_list  │
│                          │                                  │
│  3. DOTS receives short-lived token                         │
│     → Exchanges for long-lived token (60-day)               │
│     → Stores encrypted token in DB                          │
│                          │                                  │
│  4. DOTS subscribes to artist's media via Webhooks API      │
│                          │                                  │
│  5. Initial import runs (downloads all existing posts to R2)│
│                          │                                  │
│  6. From now on: new posts auto-imported via webhook        │
└─────────────────────────────────────────────────────────────┘
```

### Token Management

| Token Type | Lifespan | Action |
|-----------|----------|--------|
| Short-lived | 1 hour | Exchanged immediately for long-lived |
| Long-lived | 60 days | Refreshed automatically before expiry |
| Refresh | Before day 55 | GET /oauth/access_token?grant_type=ig_refresh_token&access_token={token} |

A background job must refresh tokens before they expire. If a token expires, DOTS loses access to that artist's media until they re-authenticate. Run a daily check for tokens expiring within 7 days and refresh them.

### Webhook Payload Example

When an artist posts a new photo/reel, Meta sends:

```json
{
  "entry": [{
    "id": "17841405309211844",
    "time": 1723567890,
    "changes": [{
      "field": "media",
      "value": {
        "media_id": "17846368219941370",
        "verb": "add"
      }
    }]
  }]
}
```

DOTS then calls the Graph API to get the full media details:

```
GET https://graph.instagram.com/17846368219941370
  ?fields=id,media_type,media_url,thumbnail_url,caption,timestamp,permalink
  &access_token={artist_long_lived_token}
```

---

## Dev/Testing: Polling Cron (RapidAPI)

Since webhooks aren't available with the RapidAPI scraper, use a lightweight polling job during development.

### How It Works

```
Every 12 hours:
  For each artist with Instagram connected:
    1. Fetch page 1 of their feed (~12 latest posts)
    2. Compare externalMediaId against existing portfolio rows
    3. For any new items:
       - Download thumbnail → R2
       - Download video (if reel) → R2
       - Insert portfolio row with R2 URLs
    4. Stop (don't paginate further — only checking for NEW posts)
```

### Scale (Dev Only)

| Metric | Value |
|--------|-------|
| API calls per cycle | 200 (one per artist) |
| Cycles per day | 2 (every 12h) |
| Monthly calls | ~12,000 |
| Latency | Up to 12 hour delay |

This is a dev-only fallback. In production, webhooks replace this entirely — zero polling, zero wasted calls, near-real-time sync.

---

## API Comparison Summary

| | RapidAPI (Dev) | Meta Graph API (Production) |
|--|---------------|---------------------------|
| **Auth model** | API key (scrapes public profiles) | Per-artist OAuth token |
| **Cost per call** | $0.001-0.005 | Free |
| **Webhooks** | Not available | Real-time push |
| **Per-media refresh** | Must paginate feed | GET /{media_id} |
| **Rate limits** | ~500/mo (basic) | 200/user/hour |
| **Sync method** | Polling cron | Webhooks |
| **App review** | Not required | Required by Meta |

---

## Implementation Phases

### Phase 1: R2 Video Hosting (Now)
- Modify instagramImportWorker.ts to download video files to R2
- Store R2 video URL in cdnUrl field instead of Instagram CDN URL
- Backfill existing broken video URLs with a migration script
- **Result**: All imported reels work permanently

### Phase 2: Polling Cron for Dev Sync (Now)
- Add a cron endpoint / scheduled job
- Fetches page 1 per artist every 12h
- Imports only new posts (dedup via externalMediaId)
- Downloads to R2 during import
- **Result**: New posts appear within 12h during development

### Phase 3: Meta OAuth + Webhooks (Production)
- Register Meta Developer App
- Build "Connect Instagram" OAuth flow in DOTS Settings
- Implement webhook endpoint (POST /api/webhooks/instagram)
- Implement webhook verification (GET /api/webhooks/instagram)
- Subscribe to media changes per artist
- Token refresh background job
- Submit for Meta App Review
- **Result**: New posts appear in seconds, zero polling, free

---

## File Reference

| File | Purpose |
|------|---------|
| server/services/instagramProvider.ts | API adapter (RapidAPI now, Meta later) |
| server/services/instagramImportWorker.ts | Downloads + processes media |
| server/routers/instagram.ts | Client-facing tRPC endpoints |
| server/services/r2.ts | R2 upload utilities (existing) |

---

*Last updated: August 2026*
