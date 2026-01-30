# UI SSOT LOCK FILE

**Version:** 1.0.0  
**Last Updated:** 2026-01-25  
**Status:** LOCKED - DO NOT MODIFY WITHOUT EXPLICIT APPROVAL

---

## Overview

This document defines the **Single Source of Truth (SSOT)** for all UI components in CalendAIr. Any changes to these components require explicit approval and must be documented here.

**Import Path:** `@/components/ui/ssot`

---

## Design Tokens (LOCKED)

### Colors (CSS Variables)

| Token | Light Mode | Dark Mode | Usage |
|-------|------------|-----------|-------|
| `--background` | `oklch(0.97 0.01 260)` | `oklch(0.12 0.05 260)` | Page background |
| `--foreground` | `oklch(0.20 0.05 260)` | `oklch(0.98 0 0)` | Primary text |
| `--card` | `oklch(1 0 0 / 0.8)` | `oklch(1 0 0 / 0.05)` | Card surfaces |
| `--primary` | `oklch(0.55 0.15 280)` | `oklch(0.70 0.15 280)` | Primary actions |
| `--muted-foreground` | `oklch(0.55 0.05 260)` | `oklch(0.70 0.02 260)` | Secondary text |
| `--border` | `oklch(0.20 0.05 260 / 0.1)` | `oklch(1 0 0 / 0.15)` | Borders |

### Spacing

| Token | Value | Usage |
|-------|-------|-------|
| `p-4` | 1rem (16px) | Card padding |
| `p-6` | 1.5rem (24px) | Page/sheet padding |
| `gap-4` | 1rem (16px) | Standard gap |

### Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `rounded-2xl` | 1rem (16px) | Cards |
| `rounded-t-[2.5rem]` | 2.5rem (40px) | Glass sheets |
| `rounded-full` | 9999px | Buttons, avatars |

### Shadows & Effects

| Effect | Value | Usage |
|--------|-------|-------|
| Glass blur | `backdrop-blur-[32px]` | GlassSheet |
| Sheet blur | `backdrop-blur-2xl` | FullScreenSheet, HalfSheet |
| Overlay blur | `backdrop-blur-sm` | Dialog overlays |
| Card hover | `hover:bg-white/10` | Interactive cards |

---

## Component Contracts (LOCKED)

### 1. PageShell

**Purpose:** Canonical full-screen page wrapper for all authenticated pages.

```typescript
interface PageShellProps {
  children: ReactNode;
  className?: string;
}
```

**Styling (LOCKED):**
- `fixed inset-0 w-full flex flex-col overflow-hidden`
- `bg-transparent` (allows body gradient to show)
- `height: 100dvh`
- `paddingBottom: env(safe-area-inset-bottom)`

**Usage:**
```tsx
<PageShell>
  <PageHeader title="Dashboard" />
  <GlassSheet>{content}</GlassSheet>
</PageShell>
```

---

### 2. PageHeader

**Purpose:** Canonical page header with left-aligned title.

```typescript
interface PageHeaderProps {
  title: string;
  className?: string;
}
```

**Styling (LOCKED):**
- `px-6 py-4 z-10 shrink-0 flex items-center bg-transparent`
- `paddingTop: calc(env(safe-area-inset-top) + 1rem)`
- Title: `text-2xl font-bold text-foreground`

**Rules:**
- ❌ DO NOT add icons or buttons to header
- ❌ DO NOT create custom headers in pages

---

### 3. GlassSheet

**Purpose:** Main content container with glass morphism effect.

```typescript
interface GlassSheetProps {
  children: ReactNode;
  className?: string;
}
```

**Styling (LOCKED):**
- `flex-1 z-20 flex flex-col relative overflow-hidden`
- `backdrop-blur-[32px] rounded-t-[2.5rem]`
- `shadow-[inset_0_1px_0_0_rgba(255,255,255,0.02)]`
- `bg-slate-950/40 border-t border-white/5`
- Top highlight: `h-px bg-gradient-to-l from-white/20 to-transparent opacity-50`

---

### 4. SegmentedHeader

**Purpose:** Tab navigation with blur effect on non-selected tabs.

```typescript
interface SegmentedHeaderProps {
  options: string[];
  activeIndex: number;
  onChange: (index: number) => void;
  className?: string;
}
```

**Styling (LOCKED):**
- Active: `text-foreground font-bold opacity-100 scale-[1.02]`
- Inactive: `text-muted-foreground font-medium opacity-40 scale-[0.98]`
- Inactive blur: `filter: blur(0.4px)`
- Active glow: `textShadow: 0 0 20px rgba(255,255,255,0.3)`

---

### 5. TaskCard

**Purpose:** Dashboard task cards with priority indicators.

```typescript
interface TaskCardProps {
  title: string;
  context?: string;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'completed' | 'snoozed' | 'dismissed';
  actionType: 'none' | 'email' | 'sms' | 'social' | 'internal';
  onClick?: () => void;
}
```

**Styling (LOCKED):**
- Container: `p-4 border-0 rounded-2xl bg-white/5 hover:bg-white/10`
- Priority colors:
  - High: `bg-red-600` (line), `from-red-600/20` (gradient)
  - Medium: `bg-orange-500` (line), `from-orange-500/20` (gradient)
  - Low: `bg-emerald-500` (line), `from-emerald-500/20` (gradient)
- Left edge: `w-[3px]` priority line
- Gradient swath: `w-[20%]` soft glow

---

### 6. ConversationCard

**Purpose:** Message/conversation list items.

```typescript
interface ConversationCardProps {
  name: string;
  avatar?: string | null;
  timestamp?: string;
  unreadCount?: number;
  onClick?: () => void;
  className?: string;
}
```

**Styling (LOCKED):**
- Container: `p-4 border-0 rounded-2xl bg-white/5 hover:bg-white/10`
- Avatar: `w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600`
- Unread badge: `bg-primary rounded-full w-6 h-6`

---

### 7. ConsultationCard

**Purpose:** Consultation request cards.

```typescript
interface ConsultationCardProps {
  subject: string;
  clientName?: string;
  description?: string;
  isNew?: boolean;
  onClick?: () => void;
  className?: string;
}
```

**Styling (LOCKED):**
- Normal: `bg-white/5 hover:bg-white/10`
- New/Pending: `bg-gradient-to-r from-primary/20 to-primary/5`
- New indicator: `w-2 h-2 rounded-full bg-primary animate-pulse`

---

### 8. FullScreenSheet

**Purpose:** Full-screen overlay for wizards and multi-step flows.

```typescript
interface FullScreenSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  contextTitle?: string;
  contextSubtitle?: string;
  contextContent?: React.ReactNode;
  onBack?: () => void;
  children: React.ReactNode;
  className?: string;
  contextHeight?: string;
}
```

**Styling (LOCKED):**
- Overlay: `bg-black/30 backdrop-blur-sm`
- Content: `fixed inset-0 z-[101] w-full h-[100dvh]`
- Glass container: `bg-white/5 backdrop-blur-2xl rounded-t-[2.5rem]`
- Context area default: `h-[15vh]`

---

### 9. HalfSheet

**Purpose:** Bottom sheet covering ~50% of screen.

```typescript
interface HalfSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}
```

**Styling (LOCKED):**
- Overlay: `bg-black/50 backdrop-blur-sm`
- Container: `bg-white/5 backdrop-blur-2xl rounded-t-[2.5rem]`
- Drag handle: `w-10 h-1 rounded-full bg-white/20`
- Animation: `spring damping=30 stiffness=300`

---

### 10. ActionSheet

**Purpose:** iOS-style action sheet from bottom.

```typescript
interface ActionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  title?: string;
  className?: string;
  maxHeight?: string;
}
```

**Styling (LOCKED):**
- Overlay: `bg-black/60 backdrop-blur-sm`
- Container: `bg-background/90 backdrop-blur-xl border-t border-white/10 rounded-t-[2rem]`
- Padding: `p-6 pb-12`
- Default maxHeight: `85vh`

---

### 11. BottomSheet

**Purpose:** Full-screen bottom sheet dialog.

```typescript
interface BottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  title?: string;
  className?: string;
  overlayVariant?: "default" | "dark";
}
```

**Styling (LOCKED):**
- Default overlay: `bg-black/30`
- Dark overlay: `bg-black/60`
- Content: `fixed inset-0 z-[101] w-full h-[100dvh]`

---

### 12. LoadingState

**Purpose:** Canonical loading indicator.

```typescript
interface LoadingStateProps {
  message?: string;
  fullScreen?: boolean;
  className?: string;
}
```

**Usage:**
- Default: Inline spinner with message
- Full screen: Centered in viewport

---

### 13. SheetHeader

**Purpose:** Sticky header inside sheets.

```typescript
interface SheetHeaderProps {
  children: ReactNode;
  className?: string;
}
```

**Styling (LOCKED):**
- `shrink-0 pt-6 pb-4 px-6 border-b border-white/5`
- `bg-white/[0.01] backdrop-blur-md`

---

## Z-Index Hierarchy (LOCKED)

| Layer | Z-Index | Usage |
|-------|---------|-------|
| Page content | `z-10` | Headers, content |
| Glass sheet | `z-20` | Main content container |
| Dialog overlay | `z-[100]` | Modal backdrops |
| Dialog content | `z-[101]` | Modal content |

---

## Animation Standards (LOCKED)

| Animation | Duration | Easing |
|-----------|----------|--------|
| Fade in/out | `300ms` | Default |
| Slide from bottom | `300ms` | Default |
| Scale | `300ms` | Default |
| Spring (sheets) | `damping: 30, stiffness: 300` | Spring |
| Hover transitions | `300ms` | `ease-out` |

---

## Rules & Restrictions

### DO NOT:
- ❌ Create custom page wrappers
- ❌ Create custom headers with icons/buttons
- ❌ Hardcode colors (use CSS variables)
- ❌ Override card border radius
- ❌ Create custom loading states
- ❌ Use inline styles for colors/spacing
- ❌ Create duplicate sheet components

### MUST:
- ✅ Import from `@/components/ui/ssot`
- ✅ Use PageShell for all authenticated pages
- ✅ Use PageHeader for page titles
- ✅ Use GlassSheet for main content
- ✅ Use TaskCard/ConversationCard/ConsultationCard for lists
- ✅ Use FullScreenSheet/HalfSheet/ActionSheet for overlays
- ✅ Use LoadingState for loading indicators

---

## Change Log

| Date | Version | Change | Approved By |
|------|---------|--------|-------------|
| 2026-01-25 | 1.0.0 | Initial lock | System |

---

## Approval Process

To modify any locked component:

1. Create a proposal document explaining the change
2. Show before/after visual comparison
3. Explain impact on existing pages
4. Get explicit user approval
5. Update this lock file with change log entry
