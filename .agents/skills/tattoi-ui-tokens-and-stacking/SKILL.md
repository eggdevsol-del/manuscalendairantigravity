---
name: tattoi-ui-tokens-and-stacking
description: SSOT design tokens, Z-index stacking hierarchy, React portal rules, safe area insets, and touch scroll invariants.
---

# Tattoi UI Tokens & Stacking Context Architecture

## 1. Strict Z-Index Hierarchy

To prevent UI elements, chat input pills, and sheets from clashing, all components must strictly follow this stacking order:

```
┌─────────────────────────────────────────────────────────────┐
│ LEVEL 5: Lightboxes, Image Viewers & Critical Alerts        │
│          z-index: 9999 (Portalled to document.body)         │
├─────────────────────────────────────────────────────────────┤
│ LEVEL 4: Bottom Sheets, Checkout Sheets & Modal Shells      │
│          z-index: var(--z-bottom-sheet) (z-60, Portalled)   │
├─────────────────────────────────────────────────────────────┤
│ LEVEL 3: Bottom Navigation Bar                              │
│          z-index: var(--z-bottom-nav) (z-50)                │
├─────────────────────────────────────────────────────────────┤
│ LEVEL 2: Floating Chat Input Pill & Floating Action Buttons │
│          z-index: 30                                        │
├─────────────────────────────────────────────────────────────┤
│ LEVEL 1: Sliding Calendar Content Layer                     │
│          z-index: 10                                        │
├─────────────────────────────────────────────────────────────┤
│ LEVEL 0: Base Scrollable Streams & Message Threads          │
│          z-index: 0                                         │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Mandatory Portal Invariant

> [!IMPORTANT]
> **Portal Rule**: Any bottom sheet, dialog, modal, or lightbox triggered from inside a child message bubble, list item, or scrollable card **MUST use `createPortal(content, document.body)`**.
> Never render raw fixed `<div>` overlays inside a scroll container, as CSS transforms/overflow trap the fixed element within the parent's lower stacking context.

---

## 3. Safe Area & Viewport Invariants

* **iOS Home Indicator Inset**:
  * Bottom nav and full-screen sheets must accommodate safe area insets:
  ```css
  padding-bottom: env(safe-area-inset-bottom, 0px);
  ```
* **Dynamic Viewport Height**:
  * Use `100dvh` or `h-full` on mobile screen wrappers to avoid layout shifts when the virtual keyboard or URL bar appears/disappears.
* **Momentum Scrolling**:
  * Any custom scroll container on iOS/Android must include:
  ```tsx
  className="w-full h-full overflow-y-auto touch-pan-y overscroll-contain"
  ```

---

## 4. Design System Tokens (`tokens.ts`)

* **Colors**:
  * Use semantic tokens from `tokens.ts` (`primary`, `muted`, `accent`, `border`, `card`).
  * Never hardcode arbitrary hex values for common UI surfaces.
* **Calendar Pastel Palettes**:
  * Hashed across 5 semantic sets (`orange`, `purple`, `green`, `pink`, `blue`) with coordinated light and dark mode variants.
