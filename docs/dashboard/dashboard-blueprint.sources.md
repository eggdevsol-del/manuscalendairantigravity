# Dashboard Blueprint Sources

This document provides exact code references for every node and interaction in the Dashboard Page Blueprint.

## Zone A: Dashboard UI Tree

- **Node: PageShell** -> `client/src/pages/Dashboard.tsx:L250` (Render), imported from `client/src/components/ui/ssot/PageShell.tsx`
- **Node: PageHeader** -> `client/src/pages/Dashboard.tsx:L252` (Render), imported from `client/src/components/ui/ssot/PageHeader.tsx`
- **Node: SegmentedHeader** -> `client/src/pages/Dashboard.tsx:L286` (Render), imported from `client/src/components/ui/ssot/SegmentedHeader.tsx`
- **Node: GlassSheet** -> `client/src/pages/Dashboard.tsx:L297` (Render), imported from `client/src/components/ui/ssot/GlassSheet.tsx`
- **Node: TaskCard** -> `client/src/pages/Dashboard.tsx:L325` (Render), imported from `client/src/components/ui/ssot/TaskCard.tsx`
- **Node: LoadingState** -> `client/src/pages/Dashboard.tsx:L61-68` (Definition), `L322` (Usage)
- **Node: EmptyState** -> `client/src/pages/Dashboard.tsx:L39-59` (Definition), `L336` (Usage)

## Zone B: Interactions / Navigation

- **Arrow: "Header Tab Click" -> setActiveIndex** -> `client/src/pages/Dashboard.tsx:L289-294`
- **Arrow: "Task Card Click" -> handleTaskClick** -> `client/src/pages/Dashboard.tsx:L332` -> `L157-167`
- **Arrow: "Weekly Stats Click" -> setShowSnapshotModal** -> `client/src/pages/Dashboard.tsx:L349`
- **Arrow: "Dashboard Settings Click" -> setShowSettingsSheet** -> `client/src/pages/Dashboard.tsx:L359`
- **Arrow: "Start New Challenge Click" -> setShowChallengeSheet** -> `client/src/pages/Dashboard.tsx:L338`

## Zone C: Sheets & Modals

- **Node: HalfSheet (Task Details)** -> `client/src/pages/Dashboard.tsx:L375-480`, imported from `client/src/components/ui/ssot/HalfSheet.tsx`
- **Node: FullScreenSheet (Challenges)** -> `client/src/pages/Dashboard.tsx:L483-515`, imported from `client/src/components/ui/ssot/FullScreenSheet.tsx`
- **Node: HalfSheet (Dashboard Settings)** -> `client/src/pages/Dashboard.tsx:L518-625`
- **Node: WeeklySnapshotModal** -> `client/src/pages/Dashboard.tsx:L628-637`, imported from `client/src/components/ui/ssot/WeeklySnapshotModal.tsx`
- **Node: InstallAppModal** -> `client/src/pages/Dashboard.tsx:L74` (Definition), `L270` (Trigger), imported from `client/src/components/modals/InstallAppModal.tsx`

## Zone D: State & Logic

- **Node: useBusinessTasks** -> `client/src/pages/Dashboard.tsx:L81-87`, defined in `client/src/features/dashboard/useBusinessTasks.ts`
- **Node: useDashboardTasks** -> `client/src/pages/Dashboard.tsx:L78`, defined in `client/src/features/dashboard/useDashboardTasks.ts`
- **Node: useWeeklySnapshot** -> `client/src/pages/Dashboard.tsx:L90`, defined in `client/src/features/dashboard/useBusinessTasks.ts`
- **Node: useDashboardSettings** -> `client/src/pages/Dashboard.tsx:L93`, defined in `client/src/features/dashboard/useBusinessTasks.ts`
- **Node: useTeaser** -> `client/src/pages/Dashboard.tsx:L96`, defined in `client/src/contexts/TeaserContext.tsx`
- **Node: derived activeCategory** -> `client/src/pages/Dashboard.tsx:L120`

## Zone E: Data Flow

- **Node: getBusinessTasks (tRPC Query)** -> `client/src/features/dashboard/useBusinessTasks.ts:L45-52` -> `server/routers/dashboardTasks.ts:L20-76`
- **Node: completeTask (tRPC Mutation)** -> `client/src/features/dashboard/useBusinessTasks.ts:L83-112` -> `server/routers/dashboardTasks.ts:L125-185`
- **Node: getSettings (tRPC Query)** -> `client/src/features/dashboard/useBusinessTasks.ts:L340` -> `server/routers/dashboardTasks.ts:L190-230`
- **Node: updateSettings (tRPC Mutation)** -> `client/src/features/dashboard/useBusinessTasks.ts:L345-352` -> `server/routers/dashboardTasks.ts:L235-275`
- **Node: generateBusinessTasks (Service)** -> `server/routers/dashboardTasks.ts:L65` -> `server/services/businessTaskGenerator.ts`
- **Node: schema.activeTasks (DB Model)** -> `drizzle/schema.ts:L635-674`
- **Node: schema.taskCompletions (DB Model)** -> `drizzle/schema.ts:L520-540`
- **Node: schema.dashboardSettings (DB Model)** -> `drizzle/schema.ts:L606-628`

## Zone F: Side Effects

- **Arrow: "Task Completed" -> refetch()** -> `client/src/features/dashboard/useBusinessTasks.ts:L59-62`
- **Arrow: "Settings Updated" -> refetch()** -> `client/src/features/dashboard/useBusinessTasks.ts:L342`
- **Arrow: "SMS Link" -> window.location.href** -> `client/src/features/dashboard/useBusinessTasks.ts:L135`
- **Arrow: "Email Link" -> window.location.href** -> `client/src/features/dashboard/useBusinessTasks.ts:L234`
- **Arrow: "Legacy Persistence" -> localStorage** -> `client/src/features/dashboard/useDashboardTasks.ts:L39-41`
- **Arrow: "Event Logging" -> DashboardEventLogger** -> `client/src/features/dashboard/useDashboardTasks.ts:L110` (and others)
