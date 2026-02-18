# CalendAIr Quality & Architecture Audit - Feb 18, 2026

## 1. Executive Summary
This report evaluates the current state of the CalendAIr application against the established **Global Architecture Rules (SSOT)** and general software engineering best practices. While significant progress has been made since the last audit (e.g., `Chat.tsx` refactor), several critical violations of the SSOT and Barrel Export rules persist, along with technical debt in the consultation funnel.

---

## 2. Global Rules Compliance Status

### ✅ SSOT (API & Query Cache)
- **Status**: Excellent.
- **Findings**: tRPC is the authoritative interface across the app. `trpc.ts` correctly exposes the `AppRouter`, and TanStack Query is used consistently for data fetching.

### ⚠️ SSOT (Database)
- **Status**: Partially Compliant.
- **Violation**: Inconsistency between `users` and `leads` tables.
    - `users` uses `name` (text) and `birthday` (datetime).
    - `leads` uses `clientFirstName`, `clientLastName`, and `clientBirthdate` (varchar).
- **Recommendation**: Unify personal information schemas to prevent data mapping errors and redundant storage logic.

### 🚫 Shadow State (Client)
- **Status**: Non-Compliant in specific areas.
- **Violation**: Found instances of "Shadow State" where server data is copied into local `useState` via `useEffect`.
    - **Example**: `ArtistLink.tsx` (Lines 50-55) copies `settings` into `isEnabled` and `slug`.
- **Recommendation**: Use query data directly as the "source of truth" and only use local state for "dirty" form values, or leverage a form management library that integrates with the cache.

### 🚫 Barrel Exports
- **Status**: Non-Compliant.
- **Violation**: `ui/index.ts` only exports `FABMenu`, missing dozen of other UI components. Most components are still imported via deep paths (e.g., `@/components/ui/ssot/LoadingState`).
- **Recommendation**: Populate `ui/index.ts` (or `@/components/ui/index.ts`) with all reusable components as per the "Barrel Exports Only" rule.

---

## 3. Component Architecture & Debt

### ⚠️ Component Complexity
- **`FunnelWrapper.tsx` (848 lines)**: Still contains excessive logic including state management, image processing, and submission handling. While it uses sub-steps, the wrapper is a major maintenance bottleneck.
- **`Dashboard.tsx` (635 lines)**: High complexity, handling task transformations, swipe gestures, and multiple task categories.

### ✅ SSOT UI Library
- **Findings**: The `components/ui/ssot` library is very robust and well-used. `LoadingState.tsx` correctly consumes `tokens.ts`, and `PageShell` / `PageHeader` are used consistently to maintain visual standards.

---

## 4. Platform & Performance

### ✅ Platform Context
- **Findings**: Correct usage of `Capacitor.isNativePlatform()` across hooks and utility libraries (`useWebPush.ts`, `assets.ts`). Fallbacks for web are properly implemented.

### ✅ Design Tokens
- **Findings**: `tokens.ts` is the clear SSOT for styles. The shift to Tailwind-based tokens provides a good balance of flexibility and consistency.

---

## 5. Priority Recommendations

1. **[CRITICAL] Refactor `FunnelWrapper.tsx`**: Move submission logic and image processing into a `useFunnelController` hook or the domain layer.
2. **[HIGH] Fix Shadow State**: Audit all pages for `useEffect` syncing of server data to local state.
3. **[MEDIUM] Complete Barrel Exports**: Update `ui/index.ts` to export all components from `ssot/` and other UI directories.
4. **[MEDIUM] Schema Alignment**: Align `leads` and `users` table fields for personal information.
5. **[LOW] Clean up Console Logs**: A few remaining `console.log` statements were spotted in feature files.

---
**Audit performed by Antigravity AI**
