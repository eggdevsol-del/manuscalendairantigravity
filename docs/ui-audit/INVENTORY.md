# Navigable UI SSOT inventory

Generated from the App import closure (including nested settings, dialogs and re-exported shared components). Static review coverage is distinct from runtime scenario coverage; shared viewport fixtures exercise geometry, not business data or provider authentication.

Scanned 228 imported JSX files; 95 page/layout/overlay records below.

| Source | Route(s) | Shared UI boundary | Safe-area ownership |
|---|---|---|---|
| client/src/components/auth/AuthLayout.tsx | Nested/component | Specialised layout | Explicit safe-area contract |
| client/src/components/BottomNav.tsx | Nested/component | Specialised layout | Explicit safe-area contract |
| client/src/components/FunnelSettings.tsx | Nested/component | PageHeader | Header fallback / parent viewport |
| client/src/components/IOSInstallPrompt.tsx | Nested/component | Specialised layout | Parent layout; inspect local controls |
| client/src/components/modals/EditBookingModal.tsx | Nested/component | Specialised layout | Explicit safe-area contract |
| client/src/components/settings/BusinessSettings.tsx | Nested/component | PageHeader | Header fallback / parent viewport |
| client/src/components/settings/ConsultationSettings.tsx | Nested/component | PageHeader, ModalShell | Inherited shared shell |
| client/src/components/settings/DangerZoneSettings.tsx | Nested/component | PageHeader | Header fallback / parent viewport |
| client/src/components/settings/DataImportSettings.tsx | Nested/component | PageHeader | Header fallback / parent viewport |
| client/src/components/settings/HowTosSettings.tsx | Nested/component | PageHeader | Header fallback / parent viewport |
| client/src/components/settings/InstagramImportSettings.tsx | Nested/component | Specialised layout | Explicit safe-area contract |
| client/src/components/settings/NotificationSettings.tsx | Nested/component | PageHeader, ModalShell | Inherited shared shell |
| client/src/components/settings/PortfolioSettings.tsx | Nested/component | PageHeader | Header fallback / parent viewport |
| client/src/components/settings/ProfileSettings.tsx | Nested/component | PageHeader | Header fallback / parent viewport |
| client/src/components/settings/RegulationSettings.tsx | Nested/component | PageHeader | Header fallback / parent viewport |
| client/src/components/settings/StudioDashboardSettings.tsx | Nested/component | PageShell, PageHeader | Inherited shared shell |
| client/src/components/settings/SubscriptionCheckoutSheet.tsx | Nested/component | SheetShell | Inherited shared shell |
| client/src/components/settings/TravelSettings.tsx | Nested/component | PageHeader | Header fallback / parent viewport |
| client/src/components/settings/WorkHoursAndServicesSettings.tsx | Nested/component | PageHeader | Header fallback / parent viewport |
| client/src/components/SplashScreen.tsx | Nested/component | Specialised layout | Parent layout; inspect local controls |
| client/src/components/ui/alert-dialog.tsx | Nested/component | Specialised layout | Explicit safe-area contract |
| client/src/components/ui/command.tsx | Nested/component | DialogContent | Parent layout; inspect local controls |
| client/src/components/ui/dialog.tsx | Nested/component | Specialised layout | Explicit safe-area contract |
| client/src/components/ui/drawer.tsx | Nested/component | Specialised layout | Explicit safe-area contract |
| client/src/components/ui/NativeConfirmToast.tsx | Nested/component | Specialised layout | Explicit safe-area contract |
| client/src/components/ui/overlays/modal-shell.tsx | Nested/component | DialogContent | Parent layout; inspect local controls |
| client/src/components/ui/overlays/sheet-shell.tsx | Nested/component | SheetContent | Parent layout; inspect local controls |
| client/src/components/ui/sheet.tsx | Nested/component | Specialised layout | Explicit safe-area contract |
| client/src/components/ui/sidebar.tsx | Nested/component | SheetContent | Parent layout; inspect local controls |
| client/src/components/ui/ssot/FullScreenSheet.tsx | Nested/component | FullScreenSheet | Explicit safe-area contract |
| client/src/components/ui/ssot/PageHeader.tsx | Nested/component | Specialised layout | Explicit safe-area contract |
| client/src/components/ui/ssot/WeeklySnapshotModal.tsx | Nested/component | Specialised layout | Explicit safe-area contract |
| client/src/features/bookings/BalanceCheckoutSheet.tsx | Nested/component | SheetShell | Inherited shared shell |
| client/src/features/bookings/BookingsPage.tsx | /bookings | PageHeader | Explicit safe-area contract |
| client/src/features/bookings/ProjectSummary.tsx | /projects/:id | PageHeader | Explicit safe-area contract |
| client/src/features/bookings/SessionPlanCheckoutSheet.tsx | Nested/component | SheetShell | Inherited shared shell |
| client/src/features/bookings/WaitlistPage.tsx | /waitlist | PageHeader, SheetShell | Explicit safe-area contract |
| client/src/features/chat/ClientProfileSheet.tsx | Nested/component | BottomSheet | Explicit safe-area contract |
| client/src/features/chat/components/ChatInterface.tsx | Nested/component | BottomSheet, ActionSheet | Explicit safe-area contract |
| client/src/features/client-home/ClientHome.tsx | /discover | Specialised layout | Parent layout; inspect local controls |
| client/src/features/client-profile/ArtistMapOverlay.tsx | Nested/component | Specialised layout | Explicit safe-area contract |
| client/src/features/dashboard/SupplierCheckoutSheet.tsx | Nested/component | Specialised layout | Explicit safe-area contract |
| client/src/features/dashboard/SupplierOrderHistory.tsx | /supply-orders | PageHeader | Explicit safe-area contract |
| client/src/features/merchant/Dashboard.tsx | Nested/component | PageShell, PageHeader | Inherited shared shell |
| client/src/features/merchant/Orders.tsx | Nested/component | PageShell, PageHeader | Inherited shared shell |
| client/src/features/merchant/Products.tsx | Nested/component | PageShell, PageHeader, SheetShell | Inherited shared shell |
| client/src/features/merchant/Settings.tsx | Nested/component | PageShell, PageHeader | Inherited shared shell |
| client/src/features/storefront/Purchases.tsx | /purchases | PageShell, PageHeader | Inherited shared shell |
| client/src/features/storefront/StorefrontCheckoutFAB.tsx | Nested/component | SheetShell | Inherited shared shell |
| client/src/features/studio/ArtistInvitations.tsx | Nested/component | PageShell, PageHeader | Inherited shared shell |
| client/src/pages/admin/ErrorDashboard.tsx | /admin/errors | Specialised layout | Explicit safe-area contract |
| client/src/pages/admin/Reconciliation.tsx | /admin/operations | PageShell, PageHeader | Inherited shared shell |
| client/src/pages/ArtistProfileTab.tsx | /artist-profile | Specialised layout | Parent layout; inspect local controls |
| client/src/pages/BankPayoutsPage.tsx | /bank-payouts | PageShell, PageHeader | Inherited shared shell |
| client/src/pages/Calendar.tsx | /calendar | Specialised layout | Parent layout; inspect local controls |
| client/src/pages/calendar/CalendarAgendaPage.tsx | Nested/component | PageShell, PageHeader | Inherited shared shell |
| client/src/pages/calendar/components/AgendaBreakdownList.tsx | Nested/component | Specialised layout | Parent layout; inspect local controls |
| client/src/pages/calendar/components/AgendaDayList.tsx | Nested/component | Specialised layout | Parent layout; inspect local controls |
| client/src/pages/calendar/components/CalendarDateStrip7.tsx | Nested/component | Specialised layout | Parent layout; inspect local controls |
| client/src/pages/calendar/components/CalendarMonthHeader.tsx | Nested/component | Specialised layout | Parent layout; inspect local controls |
| client/src/pages/Chat.tsx | /chat/:id | PageShell, PageHeader | Inherited shared shell |
| client/src/pages/Clients.tsx | /clients | PageHeader, ModalShell | Explicit safe-area contract |
| client/src/pages/CompleteProfile.tsx | /complete-profile | Specialised layout | Explicit safe-area contract |
| client/src/pages/Conversations.tsx | /conversations | PageShell, PageHeader | Inherited shared shell |
| client/src/pages/Dashboard.tsx | /dashboard | PageShell, PageHeader | Explicit safe-area contract |
| client/src/pages/funnel/BalanceSheet.tsx | Nested/component | Specialised layout | Parent layout; inspect local controls |
| client/src/pages/funnel/components/ArtistSelectionGrid.tsx | Nested/component | Specialised layout | Parent layout; inspect local controls |
| client/src/pages/funnel/components/FunnelStepWrapper.tsx | Nested/component | Specialised layout | Parent layout; inspect local controls |
| client/src/pages/funnel/components/ImageUploadSheet.tsx | Nested/component | Specialised layout | Explicit safe-area contract |
| client/src/pages/funnel/DepositSheet.tsx | Nested/component | Specialised layout | Parent layout; inspect local controls |
| client/src/pages/funnel/FunnelWrapper.tsx | Nested/component | Specialised layout | Explicit safe-area contract |
| client/src/pages/funnel/PaymentLinkPage.tsx | Nested/component | Specialised layout | Explicit safe-area contract |
| client/src/pages/funnel/PaymentRequestSheet.tsx | Nested/component | Specialised layout | Explicit safe-area contract |
| client/src/pages/funnel/PublicFunnel.tsx | Nested/component | Specialised layout | Parent layout; inspect local controls |
| client/src/pages/funnel/PublicStudioFunnel.tsx | /studio/:slug | Specialised layout | Explicit safe-area contract |
| client/src/pages/funnel/steps/FunnelContactStep.tsx | Nested/component | Specialised layout | Parent layout; inspect local controls |
| client/src/pages/LeadDetail.tsx | /lead/:id | PageShell, PageHeader | Inherited shared shell |
| client/src/pages/Login.tsx | /, /login | Specialised layout | Parent layout; inspect local controls |
| client/src/pages/MagicLink.tsx | /auth/magic | Specialised layout | Parent layout; inspect local controls |
| client/src/pages/NotFound.tsx | Nested/component | Specialised layout | Explicit safe-area contract |
| client/src/pages/NotificationsManagement.tsx | /notifications-management | PageShell, PageHeader, ModalShell | Inherited shared shell |
| client/src/pages/PasswordRecovery.tsx | /forgot-password, /auth/reset-password | Specialised layout | Parent layout; inspect local controls |
| client/src/pages/PayoutHistory.tsx | /payout-history | PageShell, PageHeader | Inherited shared shell |
| client/src/pages/profile/ClientProfilePage.tsx | /profile | PageShell, PageHeader | Inherited shared shell |
| client/src/pages/public/ArtistHub.tsx | Nested/component | Specialised layout | Explicit safe-area contract |
| client/src/pages/public/PublicArtistProfile.tsx | /book/:slug | Specialised layout | Parent layout; inspect local controls |
| client/src/pages/public/PublicEvents.tsx | /events/:slug | SheetShell | Explicit safe-area contract |
| client/src/pages/public/PublicStorefront.tsx | /shop/:slug | Specialised layout | Explicit safe-area contract |
| client/src/pages/SetPassword.tsx | /set-password | Specialised layout | Parent layout; inspect local controls |
| client/src/pages/Settings.tsx | /settings, /account-settings | PageShell, PageHeader | Inherited shared shell |
| client/src/pages/Signup.tsx | /signup | Specialised layout | Parent layout; inspect local controls |
| client/src/pages/Subscriptions.tsx | /subscriptions | PageShell, PageHeader | Inherited shared shell |
| client/src/pages/SupplierSignup.tsx | Nested/component | PageShell | Inherited shared shell |
| client/src/pages/WorkHours.tsx | /work-hours | PageHeader, DialogContent | Explicit safe-area contract |
| client/src/ui/FABMenu.tsx | Nested/component | Specialised layout | Parent layout; inspect local controls |
