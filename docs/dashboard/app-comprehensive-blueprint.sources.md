# Comprehensive App Blueprint - Granular Code References

This document provides a line-level map for "teaching a dummy" how the application is built.

## 1. Dashboard Domain (`Dashboard.tsx`)
- **Main Layout:** [Dashboard.tsx:L128-642](file:///c:/Users/Piripi/manuscalendairversion/client/src/pages/Dashboard.tsx#L128-642)
  - `PageShell` [SSOT]: [L129](file:///c:/Users/Piripi/manuscalendairversion/client/src/pages/Dashboard.tsx#L129)
  - `PageHeader` [SSOT]: [L131](file:///c:/Users/Piripi/manuscalendairversion/client/src/pages/Dashboard.tsx#L131)
  - `SegmentedHeader` [SSOT]: [L158](file:///c:/Users/Piripi/manuscalendairversion/client/src/pages/Dashboard.tsx#L158)
  - `TaskCard` [SSOT] (Business): [L256](file:///c:/Users/Piripi/manuscalendairversion/client/src/pages/Dashboard.tsx#L256)
- **Primary Logic:**
  - `useBusinessTasks()` (Controller): [useBusinessTasks.ts](file:///c:/Users/Piripi/manuscalendairversion/client/src/features/dashboard/useBusinessTasks.ts)
  - `handleTaskClick` (Interaction Handler): [Dashboard.tsx:L73-82](file:///c:/Users/Piripi/manuscalendairversion/client/src/pages/Dashboard.tsx#L73-82)
  - `executeAction` (Action Orchestrator): [Dashboard.tsx:L84-119](file:///c:/Users/Piripi/manuscalendairversion/client/src/pages/Dashboard.tsx#L84-119)
  - `completeTask.mutate` (TRPC Mutation): [useBusinessTasks.ts:L142-168](file:///c:/Users/Piripi/manuscalendairversion/client/src/features/dashboard/useBusinessTasks.ts#L142-168)

## 2. Messaging Domain (`Chat.tsx` & `Conversations.tsx`)
- **Chat Page Layout:** [Chat.tsx:L178-537](file:///c:/Users/Piripi/manuscalendairversion/client/src/pages/Chat.tsx#L178-537)
  - `PageShell` [SSOT]: [L179](file:///c:/Users/Piripi/manuscalendairversion/client/src/pages/Chat.tsx#L179)
  - `StickyHeader`: [L182-224](file:///c:/Users/Piripi/manuscalendairversion/client/src/pages/Chat.tsx#L182-224)
  - `QuickActionsRow`: [L103-145](file:///c:/Users/Piripi/manuscalendairversion/client/src/pages/Chat.tsx#L103-145)
- **Messaging Logic:**
  - `useChatController()` (Master Hook): [useChatController.ts](file:///c:/Users/Piripi/manuscalendairversion/client/src/features/chat/useChatController.ts)
  - `handleSendMessage()` (Handler): [useChatController.ts:L186-218](file:///c:/Users/Piripi/manuscalendairversion/client/src/features/chat/useChatController.ts#L186-218)
  - `trpc.messages.list.useQuery`: [useChatController.ts:L129-136](file:///c:/Users/Piripi/manuscalendairversion/client/src/features/chat/useChatController.ts#L129-136)

## 3. Scheduling Domain (`Calendar.tsx`)
- **Calendar Layout:** [Calendar.tsx:L487-1218](file:///c:/Users/Piripi/manuscalendairversion/client/src/pages/Calendar.tsx#L487-1218)
  - `CalendarGrid` (Month View): [L651-721](file:///c:/Users/Piripi/manuscalendairversion/client/src/pages/Calendar.tsx#L651-721)
  - `DayTimeline` (24h slots): [L724-840](file:///c:/Users/Piripi/manuscalendairversion/client/src/pages/Calendar.tsx#L724-840)
  - `HalfSheet` [SSOT] (Apt Dialog): [L859](file:///c:/Users/Piripi/manuscalendairversion/client/src/pages/Calendar.tsx#L859)
- **Scheduling Logic:**
  - `trpc.appointments.list.useQuery`: [Calendar.tsx:L128-138](file:///c:/Users/Piripi/manuscalendairversion/client/src/pages/Calendar.tsx#L128-138)
  - `useCalendarGestures` (Internal logic): [L363-407](file:///c:/Users/Piripi/manuscalendairversion/client/src/pages/Calendar.tsx#L363-407)
  - `handleDateClick()` (Interaction): [L210-223](file:///c:/Users/Piripi/manuscalendairversion/client/src/pages/Calendar.tsx#L210-223)

## 4. Public Flow Domain (`FunnelWrapper.tsx`)
- **Funnel Layout:** [FunnelWrapper.tsx:L489-848](file:///c:/Users/Piripi/manuscalendairversion/client/src/pages/funnel/FunnelWrapper.tsx#L489-848)
  - `ProgressBar`: [L491-497](file:///c:/Users/Piripi/manuscalendairversion/client/src/pages/funnel/FunnelWrapper.tsx#L491-497)
  - `TeaserRegistrationForm`: [L469](file:///c:/Users/Piripi/manuscalendairversion/client/src/pages/funnel/FunnelWrapper.tsx#L469)
- **Funnel Logic:**
  - `handleSubmit()` (Submission flow): [L323-388](file:///c:/Users/Piripi/manuscalendairversion/client/src/pages/funnel/FunnelWrapper.tsx#L323-388)
  - `processImages()` (Upload logic): [L266-307](file:///c:/Users/Piripi/manuscalendairversion/client/src/pages/funnel/FunnelWrapper.tsx#L266-307)
  - `trpc.upload.uploadImage`: [L264](file:///c:/Users/Piripi/manuscalendairversion/client/src/pages/funnel/FunnelWrapper.tsx#L264)

## 5. Global SSOT Component Library
- **Directory:** [client/src/components/ui/ssot/](file:///c:/Users/Piripi/manuscalendairversion/client/src/components/ui/ssot/)
- **Index:** [index.ts](file:///c:/Users/Piripi/manuscalendairversion/client/src/components/ui/ssot/index.ts)
