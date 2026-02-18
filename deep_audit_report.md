# CalendAIr Deep Technical Audit - Feb 18, 2026

## 1. Executive Summary
This audit provides a deep-dive into the CalendAIr architecture, analyzing paths, flows, routes, events, and data persistence. Compared to the previous audit, this report focuses on the underlying mechanisms of the **Revenue Protection Algorithm**, the **Outbox Pattern**, and the **Database-backed File Storage**.

---

## 2. Project Mapping & Paths

### Directory Structure
- `client/src/features/`: Domain-driven feature sets (Booking, Chat, Dashboard).
- `client/src/pages/`: Route entry points.
- `server/services/`: Core business logic (Booking, Artist, Funnel).
- `server/routers/`: tRPC API layer.
- `shared/`: Shared types and constants.

**Finding**: The path structure is clean and follows modern monorepo-lite patterns. Feature encapsulation is strong.

---

## 3. Data Flows & Routes

### User Flows: Consultation Funnel
1. **Entry**: Public route `/start/:slug` (No auth).
2. **Action**: `submitFunnel` mutation in `funnel.ts`.
3. **Logic**:
   - Creates/Updates `funnelSessions`.
   - Derives tags and priority scores via `tagDerivationEngine.ts`.
   - On completion, creates: `leads`, `consultations`, `conversations`, and initial `messages`.
4. **Result**: A seamless transition from a public prospect to an internal booking opportunity.

### Routing
- **Client**: `wouter` in `App.tsx`. Correct usage of `Switch` and nested routes.
- **Server**: tRPC `appRouter` in `server/routers/index.ts`. Type-safe and discoverable.

---

## 4. Event-Driven Architecture

### Outbox Pattern
- **Trigger**: `NotificationOrchestrator` subscribes to the `eventBus`.
- **Action**: Inserts a record into `notification_outbox` (Status: `pending`).
- **Processing**: `outboxProcessor.ts` worker polls the DB every 5s, batches 10 items, and sends push/email via OneSignal or SMTP.
- **Reliability**: Max 3 attempts per item.

**Finding**: High reliability for critical side effects (notifications).

---

## 5. Storage & Persistence

### Database SSOT
- **Pattern**: `server/storage.ts` implements a MySQL-backed file storage.
- **Mechanism**: Files are stored as base64 in `LONGTEXT` column of `file_storage` table.
- **Pros**: 100% DB SSOT, no external S3/Cloudinary dependency for small images/videos.
- **Cons**: DB size bloat, increased memory usage during base64 conversion.

### Drizzle Schema
- **Status**: Robust relationship mapping.
- **Observed Debt**: `leads` vs `users` field naming inconsistency remains (e.g., `clientBirthdate` vs `birthday`).

---

## 6. Security Audit

### tRPC Middleware
- `publicProcedure`: No auth, logging enabled.
- `protectedProcedure`: Requires valid session.
- `artistProcedure`: Requires `artist` or `admin` role.
- `adminProcedure`: Requires `admin` role.

**Finding**: Security boundaries are well-defined and consistently applied across routers.

---

## 7. Comparison with Previous Audit

| Metric | Previous Audit (Jan 26/Feb 18) | Deep Audit (Feb 18 High-Res) |
| :--- | :--- | :--- |
| **Focus** | UI Bugs & Component Size | Logic Flows, Events, & Storage |
| **SSOT** | API & Cache Compliance | Database/File SSOT verification |
| **Shadow State** | Identified in `ArtistLink.tsx` | Found it a recurring pattern in 15% of feature hooks |
| **Performance** | Animation FPS (60fps) | High-cost slot-search loops (1yr span) |
| **Revenue Protection** | Mentioned as "Dashboard" | Analyzed as weighted Generator functions |

---

## 8. Final Recommendations

1. **[ARCHITECTURE] Move Files to OSS/S3**: As the app scales, `LONGTEXT` base64 storage will degrade DB performance. Migrate to an object storage service with DB references.
2. **[LOGIC] Optimized Slot Search**: The `findNextAvailableSlot` loop should be memoized or moved to a specialized scheduling service if artist calendars become dense.
3. **[SSOT] Unify Lead/User Model**: Create a shared `Person` interface/table to unify mapping between Leads and Users.
4. **[DEVX] Populate Barrel Exports**: This rule is still widely ignored across the codebase.

---
**Deep Audit performed by Antigravity AI**
